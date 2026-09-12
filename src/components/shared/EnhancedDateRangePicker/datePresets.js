import {
  startOfDay, endOfDay, addDays,
  startOfWeek, endOfWeek, addWeeks,
  startOfMonth, endOfMonth, addMonths,
  isSameDay, format
} from 'date-fns';

export const DATE_PRESETS = [
  {
    label: 'Today',
    range: () => [startOfDay(new Date()), endOfDay(new Date())],
  },
  {
    label: 'Yesterday',
    range: () => [startOfDay(addDays(new Date(), -1)), endOfDay(addDays(new Date(), -1))],
  },
  {
    label: 'Last 7 days',
    range: () => [startOfDay(addDays(new Date(), -6)), endOfDay(new Date())],
  },
  {
    label: 'Last 30 days',
    range: () => [startOfDay(addDays(new Date(), -29)), endOfDay(new Date())],
  },
  {
    label: 'This Week',
    range: () => [startOfWeek(new Date()), endOfWeek(new Date())],
  },
  {
    label: 'Last Week',
    range: () => [startOfWeek(addWeeks(new Date(), -1)), endOfWeek(addWeeks(new Date(), -1))],
  },
  {
    label: 'This Month',
    range: () => [startOfMonth(new Date()), endOfMonth(new Date())],
  },
  {
    label: 'Last Month',
    range: () => [startOfMonth(addMonths(new Date(), -1)), endOfMonth(addMonths(new Date(), -1))],
  },
];

/**
 * Find matching preset label for a given date range
 */
export const getMatchingPresetLabel = (dateRange) => {
  if (!dateRange || !dateRange[0] || !dateRange[1]) return null;

  const start = new Date(dateRange[0]);
  const end = new Date(dateRange[1]);

  for (const preset of DATE_PRESETS) {
    const [presetStart, presetEnd] = preset.range();
    if (isSameDay(start, presetStart) && isSameDay(end, presetEnd)) {
      return preset.label;
    }
  }
  return null;
};

/**
 * Format a date range for display
 */
export const formatDateRangeDisplay = (dateRange) => {
  if (!dateRange || !dateRange[0] || !dateRange[1]) return 'Select dates';

  const presetLabel = getMatchingPresetLabel(dateRange);
  if (presetLabel) return presetLabel;

  const start = new Date(dateRange[0]);
  const end = new Date(dateRange[1]);

  if (isSameDay(start, end)) {
    return format(start, 'MMM d, yyyy');
  }

  const sameYear = start.getFullYear() === end.getFullYear();
  if (sameYear) {
    return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
  }
  return `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`;
};
