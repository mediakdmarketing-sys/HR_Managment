import {
  endOfMonth,
  endOfYear,
  format,
  isSameDay,
  startOfMonth,
  startOfYear,
  subDays,
  subMonths,
} from "date-fns";

export const DATE_PRESETS = [
  ["This month", () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) })],
  ["Last month", () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) })],
  ["Last 30 days", () => ({ from: subDays(new Date(), 29), to: new Date() })],
  ["This year", () => ({ from: startOfYear(new Date()), to: endOfYear(new Date()) })],
  ["All time", () => ({ from: undefined, to: undefined })],
];

export const formatRange = (range) => {
  if (!range?.from) return "All time";
  const to = range.to || range.from;
  if (isSameDay(range.from, to)) return format(range.from, "MMM d, yyyy");
  return `${format(range.from, "MMM d, yyyy")} – ${format(to, "MMM d, yyyy")}`;
};
