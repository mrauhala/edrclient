const BYTE_UNITS = ['KB', 'MB', 'GB'];

// 189 B, 7.6 KB, 100 KB, 1.2 MB, in decimal units
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  let value = bytes / 1000;
  let unit = 0;
  while (value >= 999.5 && unit < BYTE_UNITS.length - 1) {
    value /= 1000;
    unit++;
  }
  return `${value < 99.95 ? value.toFixed(1) : Math.round(value)} ${BYTE_UNITS[unit]}`;
}

// 94 ms, 2.23 s, 12.9 s
export function formatDuration(ms: number): string {
  const rounded = Math.round(ms);
  if (rounded < 1000) return `${rounded} ms`;
  const seconds = ms / 1000;
  return `${seconds < 9.995 ? seconds.toFixed(2) : seconds.toFixed(1)} s`;
}
