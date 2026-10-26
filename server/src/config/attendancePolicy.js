/**
 * StaffSync HRMS - Attendance Policy Configuration
 *
 * Configurable business rules for workday schedule, late threshold,
 * half-day thresholds, and normalized calendar date timezone.
 */

module.exports = {
  // Configured organization timezone for calendar date boundaries
  TIMEZONE: process.env.ATTENDANCE_TIMEZONE || 'UTC',

  // Workday expected start time (09:00 AM)
  WORKDAY_START_HOUR: parseInt(process.env.WORKDAY_START_HOUR, 10) || 9,
  WORKDAY_START_MINUTE: parseInt(process.env.WORKDAY_START_MINUTE, 10) || 0,

  // Late arrival grace threshold in minutes (e.g., 15 mins -> check-in after 09:15 is LATE)
  LATE_THRESHOLD_MINUTES: parseInt(process.env.LATE_THRESHOLD_MINUTES, 10) || 15,

  // Minimum worked minutes required to be counted as a full working day (240 mins = 4 hours)
  // Work duration less than 240 minutes is designated as HALF_DAY
  HALF_DAY_MINUTES: parseInt(process.env.HALF_DAY_MINUTES, 10) || 240,

  // Standard full workday working minutes (480 mins = 8 hours)
  FULL_DAY_MINUTES: parseInt(process.env.FULL_DAY_MINUTES, 10) || 480,

  // Permitted attendance statuses
  ATTENDANCE_STATUSES: ['PRESENT', 'LATE', 'HALF_DAY', 'ABSENT'],
};
