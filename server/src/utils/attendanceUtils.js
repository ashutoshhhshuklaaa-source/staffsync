const {
  TIMEZONE,
  WORKDAY_START_HOUR,
  WORKDAY_START_MINUTE,
  LATE_THRESHOLD_MINUTES,
} = require('../config/attendancePolicy');

/**
 * Returns a normalized UTC Date representing the start of the business day (00:00:00.000Z)
 * in the configured organizational timezone.
 *
 * @param {Date|string|number} date
 * @param {string} timeZone
 * @returns {Date} Normalized UTC midnight Date
 */
const getNormalizedBusinessDate = (date = new Date(), timeZone = TIMEZONE) => {
  const d = new Date(date);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const [year, month, day] = formatter.format(d).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
};

/**
 * Determines whether a check-in timestamp qualifies as late based on
 * the configured workday start time and grace threshold.
 *
 * @param {Date} checkInTime
 * @param {string} timeZone
 * @param {number} startHour
 * @param {number} startMinute
 * @param {number} graceMinutes
 * @returns {boolean} True if arrival is past the late threshold
 */
const isLateCheckIn = (
  checkInTime = new Date(),
  timeZone = TIMEZONE,
  startHour = WORKDAY_START_HOUR,
  startMinute = WORKDAY_START_MINUTE,
  graceMinutes = LATE_THRESHOLD_MINUTES
) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(checkInTime);
  const hour = parseInt(parts.find((p) => p.type === 'hour').value, 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute').value, 10);

  const checkInMinutesOfDay = hour * 60 + minute;
  const lateCutoffMinutesOfDay = startHour * 60 + startMinute + graceMinutes;

  return checkInMinutesOfDay > lateCutoffMinutesOfDay;
};

/**
 * Computes difference in minutes between checkIn and checkOut timestamps.
 *
 * @param {Date|string} checkInAt
 * @param {Date|string} checkOutAt
 * @returns {number} Non-negative integer of minutes worked
 */
const calculateWorkedMinutes = (checkInAt, checkOutAt) => {
  const checkIn = new Date(checkInAt).getTime();
  const checkOut = new Date(checkOutAt).getTime();
  const diffMs = checkOut - checkIn;
  return Math.max(0, Math.round(diffMs / (1000 * 60)));
};

module.exports = {
  getNormalizedBusinessDate,
  isLateCheckIn,
  calculateWorkedMinutes,
};
