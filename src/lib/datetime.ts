import { DEFAULT_TIMEZONE } from "@/lib/domain-constants";

const DATE_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeZone: DEFAULT_TIMEZONE,
});

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  timeZone: DEFAULT_TIMEZONE,
});

export function todayIsoDate(now = new Date()) {
  return toIsoDate(now);
}

export function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function formatDateLabel(dateLike: string | Date) {
  const date = typeof dateLike === "string" ? new Date(dateLike) : dateLike;
  return DATE_FORMATTER.format(date);
}

export function formatWeekday(dateLike: string | Date) {
  const date = typeof dateLike === "string" ? new Date(dateLike) : dateLike;
  return WEEKDAY_FORMATTER.format(date);
}

export function getWeekRange(date = new Date()) {
  const weekday = (date.getDay() + 6) % 7;
  const start = new Date(date);
  start.setDate(date.getDate() - weekday);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

export function getMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}
