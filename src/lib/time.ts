/** YYYY-MM-DD for "today" in the given IANA timezone */
export function serviceDate(timezone: string, at = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

export function formatTicket(prefix: string, n: number): string {
  return `${prefix}-${String(n).padStart(3, "0")}`;
}
