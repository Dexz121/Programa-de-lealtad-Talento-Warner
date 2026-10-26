export const CUTOFF = "2026-04-30";

const BIRTHDAY_FROM = "04-30";
const BIRTHDAY_TO = "05-07";

export function birthdayOnCutoff(dob: string): string | null {
  const date = dob.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }

  const monthDay = date.slice(5);
  if (monthDay >= BIRTHDAY_FROM && monthDay <= BIRTHDAY_TO) {
    return `${CUTOFF.slice(0, 4)}-${monthDay}`;
  }

  return null;
}

export function mexicoDate(now = new Date()): string {
  const shifted = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}
