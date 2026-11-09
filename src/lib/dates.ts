export const isPast = (iso: string | null | undefined) => Boolean(iso && Date.parse(iso) < Date.now());

export function fmtDateLong(iso: string | Date) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
}
