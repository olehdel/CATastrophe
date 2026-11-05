export function circleIntersectsRect(centerX, centerY, radius, rect) {
  const closestX = Math.max(rect.x, Math.min(centerX, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(centerY, rect.y + rect.height));
  const deltaX = centerX - closestX;
  const deltaY = centerY - closestY;
  return deltaX * deltaX + deltaY * deltaY < radius * radius;
}

export function segmentIntersectsRect(startX, startY, endX, endY, rect) {
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  let minTime = 0;
  let maxTime = 1;

  for (const [origin, delta, lower, upper] of [
    [startX, deltaX, rect.x, rect.x + rect.width],
    [startY, deltaY, rect.y, rect.y + rect.height],
  ]) {
    if (Math.abs(delta) < Number.EPSILON) {
      if (origin < lower || origin > upper) return false;
      continue;
    }

    let enter = (lower - origin) / delta;
    let exit = (upper - origin) / delta;
    if (enter > exit) [enter, exit] = [exit, enter];
    minTime = Math.max(minTime, enter);
    maxTime = Math.min(maxTime, exit);
    if (minTime > maxTime) return false;
  }

  return maxTime >= 0 && minTime <= 1;
}

export function moveCircleWithCollision(x, y, radius, deltaX, deltaY, house) {
  const largestDelta = Math.max(Math.abs(deltaX), Math.abs(deltaY));
  const stepSize = Math.max(4, radius * 0.45);
  const stepCount = Math.max(1, Math.ceil(largestDelta / stepSize));
  const stepX = deltaX / stepCount;
  const stepY = deltaY / stepCount;
  let collidedX = false;
  let collidedY = false;

  for (let step = 0; step < stepCount; step += 1) {
    const nextX = x + stepX;
    if (house.canOccupyCircle(nextX, y, radius)) x = nextX;
    else collidedX = true;

    const nextY = y + stepY;
    if (house.canOccupyCircle(x, nextY, radius)) y = nextY;
    else collidedY = true;
  }

  return { x, y, collidedX, collidedY };
}
