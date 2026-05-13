import { format, parseISO, startOfDay } from "date-fns";

export function toDateKey(date: Date) {
  return format(startOfDay(date), "yyyy-MM-dd");
}

export function formatHeading(dateKey: string) {
  return format(parseISO(dateKey), "MMMM d, yyyy");
}

export function formatShortDate(dateKey: string) {
  return format(parseISO(dateKey), "EEE, MMM d");
}
