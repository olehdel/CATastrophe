$ErrorActionPreference = 'Stop'

$projectRoot = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd([IO.Path]::DirectorySeparatorChar)
$rootPrefix = $projectRoot + [IO.Path]::DirectorySeparatorChar
$moduleBodies = @{}
$pending = [Collections.Generic.Queue[string]]::new()
$pending.Enqueue('game.js')
$importPattern = [regex]'(?ms)^[ \t]*import\s+(.+?)\s+from\s+["'']([^"'']+)["''];?'
$assetPattern = [regex]'(?i)(?:(?:\.\.?/)+)?assets/[A-Za-z0-9_./-]+\.(?:png|jpe?g|webp|gif|svg|mp3|wav|ogg|mp4|webm|woff2?|ttf|otf)'

function Resolve-ModuleId([string] $fromId, [string] $specifier) {
  if (-not $specifier.StartsWith('.')) { throw "External JavaScript import is not supported in this standalone build: $specifier" }
  $fromPath = Join-Path $projectRoot ($fromId.Replace('/', [IO.Path]::DirectorySeparatorChar))
  $target = [IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $fromPath) $specifier))
  if (-not $target.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw "Import resolves outside the project: $specifier in $fromId" }
  if (-not (Test-Path -LiteralPath $target -PathType Leaf)) { throw "Missing imported module: $target" }
  return $target.Substring($rootPrefix.Length).Replace('\', '/')
}

function Resolve-AssetReference([string] $reference, [string] $sourceId) {
  $pathText = $reference.Replace('/', [IO.Path]::DirectorySeparatorChar)
  if ($reference.StartsWith('assets/')) {
    $fullPath = [IO.Path]::GetFullPath((Join-Path $projectRoot $pathText))
  } else {
    $sourcePath = Join-Path $projectRoot ($sourceId.Replace('/', [IO.Path]::DirectorySeparatorChar))
    $fullPath = [IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $sourcePath) $pathText))
  }
  if (-not $fullPath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) { throw "Asset resolves outside the project: $reference in $sourceId" }
  if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) { throw "Missing referenced asset: $fullPath (from $sourceId)" }
  return $fullPath.Substring($rootPrefix.Length).Replace('\', '/')
}

function Get-DataUri([string] $assetKey) {
  $fullPath = Join-Path $projectRoot ($assetKey.Replace('/', [IO.Path]::DirectorySeparatorChar))
  $extension = [IO.Path]::GetExtension($fullPath).ToLowerInvariant()
  $mimeType = switch ($extension) {
    '.png' { 'image/png' }
    '.jpg' { 'image/jpeg' }
    '.jpeg' { 'image/jpeg' }
    '.webp' { 'image/webp' }
    '.gif' { 'image/gif' }
    '.svg' { 'image/svg+xml' }
    '.mp3' { 'audio/mpeg' }
    '.wav' { 'audio/wav' }
    '.ogg' { 'audio/ogg' }
    '.mp4' { 'video/mp4' }
    '.webm' { 'video/webm' }
    '.woff' { 'font/woff' }
    '.woff2' { 'font/woff2' }
    '.ttf' { 'font/ttf' }
    '.otf' { 'font/otf' }
    default { throw "Unsupported asset type: $extension ($assetKey)" }
  }
  return "data:$mimeType;base64,$([Convert]::ToBase64String([IO.File]::ReadAllBytes($fullPath)))"
}

while ($pending.Count -gt 0) {
  $moduleId = $pending.Dequeue()
  if ($moduleBodies.ContainsKey($moduleId)) { continue }
  $modulePath = Join-Path $projectRoot ($moduleId.Replace('/', [IO.Path]::DirectorySeparatorChar))
  $source = [IO.File]::ReadAllText($modulePath)
  foreach ($match in $importPattern.Matches($source)) {
    $dependencyId = Resolve-ModuleId $moduleId $match.Groups[2].Value
    if (-not $moduleBodies.ContainsKey($dependencyId) -and -not ($pending.ToArray() -contains $dependencyId)) { $pending.Enqueue($dependencyId) }
  }
  $moduleBodies[$moduleId] = $source
}

$moduleFactories = [Text.StringBuilder]::new()
$allAssetKeys = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$moduleIds = @($moduleBodies.Keys | Sort-Object)

foreach ($moduleId in $moduleIds) {
  $body = $moduleBodies[$moduleId]
  $imports = @($importPattern.Matches($body))
  for ($index = $imports.Count - 1; $index -ge 0; $index--) {
    $match = $imports[$index]
    $clause = $match.Groups[1].Value.Trim().TrimEnd(';').Trim()
    $dependencyId = Resolve-ModuleId $moduleId $match.Groups[2].Value
    $importCode = ''
    if ($clause.StartsWith('{') -and $clause.EndsWith('}')) {
      $bindings = $clause.Substring(1, $clause.Length - 2).Split(',') | ForEach-Object {
        $binding = $_.Trim()
        if (-not $binding) { return }
        if ($binding -match '^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$') { return ($Matches[1] + ': ' + $Matches[2]) }
        return $binding
      }
      $importCode = "const { $($bindings -join ', ') } = __require('$dependencyId');"
    } elseif ($clause -match '^\*\s+as\s+([A-Za-z_$][\w$]*)$') {
      $importCode = "const $($Matches[1]) = __require('$dependencyId');"
    } elseif ($clause -match '^([A-Za-z_$][\w$]*)$') {
      $importCode = "const { default: $($Matches[1]) } = __require('$dependencyId');"
    } else {
      throw "Unsupported import syntax in $moduleId`: $clause"
    }
    $body = $body.Remove($match.Index, $match.Length).Insert($match.Index, $importCode)
  }

  $exportPattern = [regex]'(?m)^([ \t]*)export[ \t]+(class|function|const|let|var)[ \t]+([A-Za-z_$][\w$]*)'
  $exportNames = @($exportPattern.Matches($body) | ForEach-Object { $_.Groups[3].Value })
  $body = $exportPattern.Replace($body, '$1$2 $3')
  if ($body -match '(?m)^\s*export\b') { throw "Unsupported export syntax in $moduleId." }

  $urlPattern = [regex]'new URL\(([^,\r\n]+),\s*import\.meta\.url\)\.href'
  $urlMatches = @($urlPattern.Matches($body))
  for ($index = $urlMatches.Count - 1; $index -ge 0; $index--) {
    $match = $urlMatches[$index]
    $expression = $match.Groups[1].Value.Trim()
    $replacement = "__assetUrl($expression, '$moduleId')"
    $body = $body.Remove($match.Index, $match.Length).Insert($match.Index, $replacement)
  }

  foreach ($match in $assetPattern.Matches($body)) {
    [void]$allAssetKeys.Add((Resolve-AssetReference $match.Value $moduleId))
  }
  $dynamicSpriteFiles = [regex]::Matches($body, '(?i)\bloadSprite\(\s*["'']([^"'']+\.(?:png|jpe?g|webp|gif|svg))["'']\s*\)')
  foreach ($match in $dynamicSpriteFiles) {
    [void]$allAssetKeys.Add((Resolve-AssetReference ('../../assets/characters/' + $match.Groups[1].Value) $moduleId))
  }

  [void]$moduleFactories.Append("__factories['$moduleId'] = function(exports, __require) {`n")
  [void]$moduleFactories.Append($body)
  [void]$moduleFactories.Append("`n")
  foreach ($exportName in $exportNames) { [void]$moduleFactories.Append("exports.$exportName = $exportName;`n") }
  [void]$moduleFactories.Append("};`n")
}

$htmlPath = Join-Path $projectRoot 'index.html'
$cssPath = Join-Path $projectRoot 'style.css'
$html = [IO.File]::ReadAllText($htmlPath)
$css = [IO.File]::ReadAllText($cssPath)
foreach ($content in @(@{ Text = $html; Id = 'index.html' }, @{ Text = $css; Id = 'style.css' })) {
  foreach ($match in $assetPattern.Matches($content.Text)) {
    [void]$allAssetKeys.Add((Resolve-AssetReference $match.Value $content.Id))
  }
}
$dynamicHtmlImages = [regex]::Matches($html, '(?i)\bsrc=["''](assets/[^"'']+)["'']')
foreach ($match in $dynamicHtmlImages) { [void]$allAssetKeys.Add((Resolve-AssetReference $match.Groups[1].Value 'index.html')) }
$assets = @{}
foreach ($assetKey in $allAssetKeys) { $assets[$assetKey] = Get-DataUri $assetKey }

$cssUrlPattern = [regex]'url\(\s*["'']?(assets/[^)"'']+)["'']?\s*\)'
$cssUrlMatches = @($cssUrlPattern.Matches($css))
for ($index = $cssUrlMatches.Count - 1; $index -ge 0; $index--) {
  $match = $cssUrlMatches[$index]
  $assetKey = Resolve-AssetReference $match.Groups[1].Value 'style.css'
  $replacement = 'url("' + $assets[$assetKey] + '")'
  $css = $css.Remove($match.Index, $match.Length).Insert($match.Index, $replacement)
}
$html = [regex]::Replace($html, '(?is)<link\s+rel=["'']stylesheet["'']\s+href=["'']style\.css["'']\s*/?>', ('<style>' + $css + '</style>'))

$htmlImageMatches = @([regex]::Matches($html, '(?i)\bsrc=["''](assets/[^"'']+)["'']'))
for ($index = $htmlImageMatches.Count - 1; $index -ge 0; $index--) {
  $match = $htmlImageMatches[$index]
  $assetKey = Resolve-AssetReference $match.Groups[1].Value 'index.html'
  $replacement = 'src="' + $assets[$assetKey] + '"'
  $html = $html.Remove($match.Index, $match.Length).Insert($match.Index, $replacement)
}

$assetJson = [Collections.Generic.List[string]]::new()
foreach ($assetKey in ($assets.Keys | Sort-Object)) {
  $keyJson = ConvertTo-Json -InputObject $assetKey -Compress
  $valueJson = ConvertTo-Json -InputObject $assets[$assetKey] -Compress
  $assetJson.Add("${keyJson}:$valueJson")
}
$runtime = @"
const __CAT_EMBEDDED_ASSETS__ = {$($assetJson -join ',')};
const __factories = Object.create(null);
const __cache = Object.create(null);
function __assetUrl(path, moduleId) {
  const clean = String(path).split(/[?#]/, 1)[0].replace(/\\/g, '/');
  const parts = moduleId.split('/').slice(0, -1);
  for (const part of clean.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  const key = parts.join('/');
  const dataUrl = __CAT_EMBEDDED_ASSETS__[key];
  if (!dataUrl) throw new Error('Standalone build is missing embedded asset: ' + key);
  return dataUrl;
}
function __require(id) {
  if (__cache[id]) return __cache[id];
  const factory = __factories[id];
  if (!factory) throw new Error('Standalone build is missing module: ' + id);
  const exports = {};
  __cache[id] = exports;
  factory(exports, __require);
  return exports;
}
$moduleFactories
__require('game.js');
"@
$bundledScript = '<script type="module">' + $runtime + '</script>'
$html = [regex]::Replace($html, '(?is)<script\s+type=["'']module["'']\s+src=["'']game\.js["'']\s*>\s*</script>', [System.Text.RegularExpressions.MatchEvaluator]{ param($match) $bundledScript }.GetNewClosure(), 1)
if ($html -notmatch '<script type="module">') { throw 'Could not find the game.js module script in index.html to replace.' }

$outputPath = Join-Path $projectRoot 'CATastrophe.html'
[IO.File]::WriteAllText($outputPath, $html, [Text.UTF8Encoding]::new($false))
$sizeMb = [math]::Round((Get-Item -LiteralPath $outputPath).Length / 1MB, 2)
Write-Host "Bundled $($moduleIds.Count) JavaScript modules and $($assets.Count) embedded assets."
Write-Host "Created $outputPath ($sizeMb MB)."
