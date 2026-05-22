const MINUTE_MS = 60_000;

export function toEpochMs(value: string): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid ISO timestamp: ${value}`);
  }
  return parsed;
}

export function compareIso(left: string, right: string): number {
  return toEpochMs(left) - toEpochMs(right);
}

export function rangesOverlap(
  leftStart: string,
  leftEnd: string,
  rightStart: string,
  rightEnd: string,
): boolean {
  const leftStartMs = toEpochMs(leftStart);
  const leftEndMs = toEpochMs(leftEnd);
  const rightStartMs = toEpochMs(rightStart);
  const rightEndMs = toEpochMs(rightEnd);

  return leftStartMs < rightEndMs && rightStartMs < leftEndMs;
}

export function addMinutes(value: string, minutes: number): string {
  return new Date(toEpochMs(value) + minutes * MINUTE_MS).toISOString();
}

export function subtractMinutes(value: string, minutes: number): string {
  return new Date(toEpochMs(value) - minutes * MINUTE_MS).toISOString();
}

export function minutesBetween(start: string, end: string): number {
  return Math.max(0, Math.floor((toEpochMs(end) - toEpochMs(start)) / MINUTE_MS));
}

export function minIso(left: string, right: string): string {
  return compareIso(left, right) <= 0 ? left : right;
}

export function maxIso(left: string, right: string): string {
  return compareIso(left, right) >= 0 ? left : right;
}
