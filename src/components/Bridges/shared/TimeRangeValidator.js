/**
 * TimeRangeValidator Utility
 * Validation utilities for time-based routing in Call Condition bridge type
 *
 * Based on legacy AngularJS patterns from call_conditions state configuration
 */

/**
 * Validate time range (HH:MM format)
 * @param {string} startsAt - Start time (HH:MM)
 * @param {string} endsAt - End time (HH:MM)
 * @returns {object} { valid: boolean, error: string|null }
 */
export const validateTimeRange = (startsAt, endsAt) => {
  if (!startsAt || !endsAt) {
    return { valid: true, error: null }; // Empty is valid (optional field)
  }

  // Parse time strings
  const [startHour, startMin] = startsAt.split(':').map(Number);
  const [endHour, endMin] = endsAt.split(':').map(Number);

  // Create comparable time values (minutes since midnight)
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  if (endMinutes <= startMinutes) {
    return {
      valid: false,
      error: 'End time must be after start time'
    };
  }

  return { valid: true, error: null };
};

/**
 * Validate week day value (0-6)
 * @param {string} value - Comma-separated week days
 * @returns {object} { valid: boolean, error: string|null }
 */
export const validateWeekDay = (value) => {
  if (!value || !value.trim()) {
    return { valid: true, error: null };
  }

  const days = value.split(',').map(d => parseInt(d.trim()));
  const invalid = days.some(d => isNaN(d) || d < 0 || d > 6);

  if (invalid) {
    return {
      valid: false,
      error: 'Invalid week day (must be 0-6)'
    };
  }

  return { valid: true, error: null };
};

/**
 * Validate month day value (1-31)
 * @param {string} value - Comma-separated month days
 * @returns {object} { valid: boolean, error: string|null }
 */
export const validateMonthDay = (value) => {
  if (!value || !value.trim()) {
    return { valid: true, error: null };
  }

  const days = value.split(',').map(d => parseInt(d.trim()));
  const invalid = days.some(d => isNaN(d) || d < 1 || d > 31);

  if (invalid) {
    return {
      valid: false,
      error: 'Invalid month day (must be 1-31)'
    };
  }

  return { valid: true, error: null };
};

/**
 * Validate month value (1-12)
 * @param {string} value - Comma-separated months
 * @returns {object} { valid: boolean, error: string|null }
 */
export const validateMonth = (value) => {
  if (!value || !value.trim()) {
    return { valid: true, error: null };
  }

  const months = value.split(',').map(m => parseInt(m.trim()));
  const invalid = months.some(m => isNaN(m) || m < 1 || m > 12);

  if (invalid) {
    return {
      valid: false,
      error: 'Invalid month (must be 1-12)'
    };
  }

  return { valid: true, error: null };
};

/**
 * Validate year value
 * @param {string} value - Year value
 * @returns {object} { valid: boolean, error: string|null }
 */
export const validateYear = (value) => {
  if (!value || !value.trim()) {
    return { valid: true, error: null };
  }

  const year = parseInt(value);
  const currentYear = new Date().getFullYear();

  if (isNaN(year) || year < currentYear || year > currentYear + 100) {
    return {
      valid: false,
      error: `Invalid year (must be ${currentYear}-${currentYear + 100})`
    };
  }

  return { valid: true, error: null };
};

/**
 * Auto-correct end time if it's before start time
 * Increments end time by 1 hour if invalid
 * @param {string} startsAt - Start time (HH:MM)
 * @param {string} endsAt - End time (HH:MM)
 * @returns {string} Corrected end time
 */
export const autoCorrectEndTime = (startsAt, endsAt) => {
  if (!startsAt || !endsAt) return endsAt;

  const validation = validateTimeRange(startsAt, endsAt);
  if (validation.valid) return endsAt;

  // Parse start time
  const [startHour, startMin] = startsAt.split(':').map(Number);

  // Add 1 hour to start time
  let newHour = startHour + 1;
  if (newHour > 23) newHour = 23;

  return `${String(newHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
};

/**
 * Validate complete time entry based on type
 * @param {object} entry - Time entry object
 * @returns {object} { valid: boolean, error: string|null }
 */
export const validateTimeEntry = (entry) => {
  if (!entry || !entry.type) {
    return { valid: false, error: 'Entry type is required' };
  }

  switch (entry.type) {
    case 'time':
      return validateTimeRange(entry.starts_at, entry.ends_at);
    case 'week_day':
      return validateWeekDay(entry.value);
    case 'month_day':
      return validateMonthDay(entry.value);
    case 'month':
      return validateMonth(entry.value);
    case 'year':
      return validateYear(entry.value);
    default:
      return { valid: false, error: 'Unknown entry type' };
  }
};

/**
 * Get week day names
 * @returns {array} Array of week day names
 */
export const getWeekDayNames = () => [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

/**
 * Get month names
 * @returns {array} Array of month names
 */
export const getMonthNames = () => [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
];

/**
 * Generate year options (current year + next 100 years)
 * @returns {array} Array of year values
 */
export const getYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = 0; i <= 100; i++) {
    years.push(currentYear + i);
  }
  return years;
};

export default {
  validateTimeRange,
  validateWeekDay,
  validateMonthDay,
  validateMonth,
  validateYear,
  autoCorrectEndTime,
  validateTimeEntry,
  getWeekDayNames,
  getMonthNames,
  getYearOptions
};
