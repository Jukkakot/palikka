/** Local date and time in the UI language, e.g. "26.9.2026" and "18.40" in Finnish. */
export function formatDateTime(date: Date, lng: string): { date: string; time: string } {
  return {
    date: new Intl.DateTimeFormat(lng, { day: "numeric", month: "numeric", year: "numeric" }).format(date),
    time: new Intl.DateTimeFormat(lng, { hour: "2-digit", minute: "2-digit" }).format(date),
  };
}
