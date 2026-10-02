export function waitText(wait: { low: number; high: number } | null, waiting: number): string {
  if (waiting === 0) return "No wait";
  if (!wait) return "Almost no wait";
  return `About ${wait.low}–${wait.high} min`;
}
