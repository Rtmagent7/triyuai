/**
 * Converts between timestamps and fractional bar indexes ("logical" positions in
 * Lightweight Charts). Times between bars are interpolated and times outside the
 * loaded data are extrapolated by the bar interval, so drawings can sit in empty
 * space to the right of the last candle or before the oldest one.
 */

/** Index of the last bar whose time is ≤ t (binary search); -1 if t is before the first bar. */
function floorIndex(times: number[], t: number) {
  let lo = 0;
  let hi = times.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid]! <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

export function timeToLogical(times: number[], t: number, step: number): number {
  if (!times.length) return 0;
  const i = floorIndex(times, t);
  if (i < 0) return (t - times[0]!) / step;
  const next = times[i + 1];
  const span = next != null ? next - times[i]! : step;
  return i + (t - times[i]!) / span;
}

export function logicalToTime(times: number[], logical: number, step: number): number {
  if (!times.length) return 0;
  const last = times.length - 1;
  if (logical <= 0) return Math.round(times[0]! + logical * step);
  if (logical >= last) return Math.round(times[last]! + (logical - last) * step);
  const i = Math.floor(logical);
  return Math.round(times[i]! + (logical - i) * (times[i + 1]! - times[i]!));
}
