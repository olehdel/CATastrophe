param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('Start', 'Stop', 'Serve')]
  [string] $Action,

  [Parameter(Mandatory = $true)]
  [string] $ProjectRoot,

  [string] $StatePath,
  [string] $LogPath
)

$ErrorActionPreference = 'Stop'
$port = 5500
$url = "http://127.0.0.1:$port/index.html"
$root = [IO.Path]::GetFullPath($ProjectRoot).TrimEnd([IO.Path]::DirectorySeparatorChar)
$rootPrefix = $root + [IO.Path]::DirectorySeparatorChar

if (-not $StatePath) {
  $stateDirectory = Join-Path $root '.catastrophe-server'
  $StatePath = Join-Path $stateDirectory 'server.pid'
  $LogPath = Join-Path $stateDirectory 'server.log'
}

function Get-ContentType([string] $path) {
  switch ([IO.Path]::GetExtension($path).ToLowerInvariant()) {
    '.html' { return 'text/html; charset=utf-8' }
    '.htm'  { return 'text/html; charset=utf-8' }
    '.js'   { return 'text/javascript; charset=utf-8' }
    '.mjs'  { return 'text/javascript; charset=utf-8' }
    '.css'  { return 'text/css; charset=utf-8' }
    '.json' { return 'application/json; charset=utf-8' }
    '.png'  { return 'image/png' }
    '.jpg'  { return 'image/jpeg' }
    '.jpeg' { return 'image/jpeg' }
    '.webp' { return 'image/webp' }
    '.gif'  { return 'image/gif' }
    '.svg'  { return 'image/svg+xml' }
    '.ico'  { return 'image/x-icon' }
    '.mp4'  { return 'video/mp4' }
    '.webm' { return 'video/webm' }
    '.wav'  { return 'audio/wav' }
    '.mp3'  { return 'audio/mpeg' }
    '.ogg'  { return 'audio/ogg' }
    default { return 'application/octet-stream' }
  }
}

function Get-ProjectResponse {
  try {
    $request = [Net.HttpWebRequest]::Create($url)
    $request.Method = 'GET'
    $request.Timeout = 1800
    $response = $request.GetResponse()
    try {
      $reader = [IO.StreamReader]::new($response.GetResponseStream())
      $html = $reader.ReadToEnd()
    } finally { $response.Close() }

    if ($html -notmatch '<title>CATastrophe</title>' -or $html -notmatch 'src="game\.js"') {
      return $false
    }

    $scriptRequest = [Net.HttpWebRequest]::Create("http://127.0.0.1:$port/game.js")
    $scriptRequest.Method = 'GET'
    $scriptRequest.Timeout = 1800
    $scriptResponse = $scriptRequest.GetResponse()
    try {
      $stream = $scriptResponse.GetResponseStream()
      $buffer = [IO.MemoryStream]::new()
      $stream.CopyTo($buffer)
      $hasher = [Security.Cryptography.SHA256]::Create()
      $remoteHash = [Convert]::ToBase64String($hasher.ComputeHash($buffer.ToArray()))
      $hasher.Dispose()
    } finally { $scriptResponse.Close(); if ($buffer) { $buffer.Dispose() } }

    $hasher = [Security.Cryptography.SHA256]::Create()
    $localHash = [Convert]::ToBase64String($hasher.ComputeHash([IO.File]::ReadAllBytes((Join-Path $root 'game.js'))))
    $hasher.Dispose()
    return $remoteHash -eq $localHash
  } catch { return $false }
}

function Test-PortBusy {
  $client = [Net.Sockets.TcpClient]::new()
  try {
    $task = $client.ConnectAsync([Net.IPAddress]::Loopback, $port)
    return $task.Wait(400) -and $client.Connected
  } catch { return $false }
  finally { $client.Close() }
}

function Open-GameInChrome {
  $chromeCandidates = @(
    (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
    (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

  $chromeCommand = Get-Command 'chrome.exe' -ErrorAction SilentlyContinue
  if ($chromeCommand) { Start-Process -FilePath $chromeCommand.Source -ArgumentList $url; return }
  if ($chromeCandidates) {
    $chromePath = [string]($chromeCandidates | Select-Object -First 1)
    Start-Process -FilePath $chromePath -ArgumentList $url
    return
  }
  throw 'Google Chrome was not found. Install Chrome or add chrome.exe to PATH, then run this launcher again.'
}

function Write-HttpResponse($stream, [int] $status, [string] $reason, [string] $contentType, [byte[]] $body, [bool] $headOnly = $false) {
  $header = "HTTP/1.1 $status $reason`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nConnection: close`r`nCache-Control: no-cache`r`nX-Content-Type-Options: nosniff`r`n`r`n"
  $headerBytes = [Text.Encoding]::ASCII.GetBytes($header)
  $stream.Write($headerBytes, 0, $headerBytes.Length)
  if (-not $headOnly -and $body.Length -gt 0) { $stream.Write($body, 0, $body.Length) }
  $stream.Flush()
}

if (-not (Test-Path -LiteralPath (Join-Path $root 'index.html')) -or -not (Test-Path -LiteralPath (Join-Path $root 'game.js'))) {
  throw "Project root is missing index.html or game.js: $root"
}

switch ($Action) {
  'Start' {
    if (Get-ProjectResponse) {
      Write-Host "CATastrophe is already being served from this project at $url."
      Open-GameInChrome
      exit 0
    }

    if (Test-PortBusy) {
      throw "Port $port is already in use by another server. Close that server, then run Start_CATastrophe.bat again. No other process was stopped."
    }

    $stateDirectory = Split-Path -Parent $StatePath
    New-Item -ItemType Directory -Path $stateDirectory -Force | Out-Null
    if (-not $LogPath) { $LogPath = Join-Path $stateDirectory 'server.log' }
    $errorLog = Join-Path $stateDirectory 'server-error.log'
    $powershell = Join-Path $PSHOME 'powershell.exe'
    $arguments = @(
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"{0}"' -f $PSCommandPath),
      '-Action', 'Serve', '-ProjectRoot', ('"{0}"' -f $root),
      '-StatePath', ('"{0}"' -f $StatePath), '-LogPath', ('"{0}"' -f $LogPath)
    )
    $serverProcess = Start-Process -FilePath $powershell -ArgumentList $arguments -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $LogPath -RedirectStandardError $errorLog -PassThru

    $ready = $false
    for ($attempt = 0; $attempt -lt 32; $attempt++) {
      Start-Sleep -Milliseconds 250
      if (Get-ProjectResponse) { $ready = $true; break }
      if ($serverProcess.HasExited) { break }
    }

    if (-not $ready) {
      if (-not $serverProcess.HasExited) { Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue }
      $details = if (Test-Path -LiteralPath $errorLog) { (Get-Content -LiteralPath $errorLog -Raw) } else { '' }
      if (-not $details) { $details = if (Test-Path -LiteralPath $LogPath) { (Get-Content -LiteralPath $LogPath -Raw) } }
      throw "The local server did not become ready on port $port. $details"
    }

    Write-Host "CATastrophe server started from:`n$root`n"
    Write-Host "Opening $url in Chrome..."
    Open-GameInChrome
    exit 0
  }

  'Stop' {
    if (-not (Test-PortBusy)) {
      Write-Host 'The CATastrophe server is not running.'
      exit 0
    }

    try {
      $stopRequest = [Net.HttpWebRequest]::Create("http://127.0.0.1:$port/__catastrophe_stop")
      $stopRequest.Method = 'POST'
      $stopRequest.Timeout = 1500
      $stopResponse = $stopRequest.GetResponse()
      try {
        if ($stopResponse.StatusCode -ne [Net.HttpStatusCode]::OK) { throw 'Stop endpoint did not confirm shutdown.' }
      } finally { $stopResponse.Close() }
      Write-Host 'CATastrophe standalone server stopped.'
    } catch {
      throw 'Port 5500 is occupied, but it is not the CATastrophe standalone server. No other process was stopped.'
    }
    exit 0
  }

  'Serve' {
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $port)
    $listener.Start()
    [IO.File]::WriteAllText($StatePath, [string]$PID)
    Write-Output "Serving $root at http://127.0.0.1:$port/"

    try {
      while ($listener.Server.IsBound) {
        $client = $listener.AcceptTcpClient()
        try {
          $client.ReceiveTimeout = 5000
          $client.SendTimeout = 5000
          $stream = $client.GetStream()
          $reader = [IO.StreamReader]::new($stream, [Text.Encoding]::ASCII, $false, 4096, $true)
          $requestLine = $reader.ReadLine()
          if (-not $requestLine) { continue }
          $parts = $requestLine.Split(' ')
          $method = $parts[0].ToUpperInvariant()
          $requestPath = if ($parts.Length -gt 1) { [Uri]::UnescapeDataString(([string]$parts[1]).Split('?')[0]) } else { '/' }
          while (($line = $reader.ReadLine()) -and $line.Length -gt 0) { }

          if ($requestPath -eq '/__catastrophe_stop' -and $method -eq 'POST') {
            $body = [Text.Encoding]::UTF8.GetBytes('CATastrophe server stopping.')
            Write-HttpResponse $stream 200 'OK' 'text/plain; charset=utf-8' $body
            $listener.Stop()
            break
          }

          if ($method -ne 'GET' -and $method -ne 'HEAD') {
            $body = [Text.Encoding]::UTF8.GetBytes('Method not allowed')
            Write-HttpResponse $stream 405 'Method Not Allowed' 'text/plain; charset=utf-8' $body
            continue
          }

          $relative = $requestPath.TrimStart('/') -replace '/', [IO.Path]::DirectorySeparatorChar
          if (-not $relative) { $relative = 'index.html' }
          $filePath = [IO.Path]::GetFullPath((Join-Path $root $relative))
          if (-not ($filePath.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase) -or $filePath.Equals($root, [StringComparison]::OrdinalIgnoreCase))) {
            $body = [Text.Encoding]::UTF8.GetBytes('Forbidden')
            Write-HttpResponse $stream 403 'Forbidden' 'text/plain; charset=utf-8' $body
            continue
          }
          if (Test-Path -LiteralPath $filePath -PathType Container) { $filePath = Join-Path $filePath 'index.html' }
          if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
            $body = [Text.Encoding]::UTF8.GetBytes('Not found')
            Write-HttpResponse $stream 404 'Not Found' 'text/plain; charset=utf-8' $body
            continue
          }

          $body = [IO.File]::ReadAllBytes($filePath)
          Write-HttpResponse $stream 200 'OK' (Get-ContentType $filePath) $body ($method -eq 'HEAD')
        } catch {
          try {
            $body = [Text.Encoding]::UTF8.GetBytes('Bad request')
            Write-HttpResponse $stream 400 'Bad Request' 'text/plain; charset=utf-8' $body
          } catch { }
        } finally { $client.Close() }
      }
    } finally {
      $listener.Stop()
      if (Test-Path -LiteralPath $StatePath) { Remove-Item -LiteralPath $StatePath -Force }
    }
    exit 0
  }
}
