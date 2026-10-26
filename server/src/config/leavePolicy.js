/**
 * StaffSync HRMS - Leave Management Policy Configuration
 *
 * Defines configurable default annual allowances per leave type and business day rules.
 * Values can be configured via environment variables.
 */

module.exports = {
  // Default annual allowances per leave type (in days)
  DEFAULT_ALLOWANCES: {
    CASUAL: parseInt(process.env.DEFAULT_CASUAL_LEAVE, 10) || 12,
    SICK: parseInt(process.env.DEFAULT_SICK_LEAVE, 10) || 10,
    EARNED: parseInt(process.env.DEFAULT_EARNED_LEAVE, 10) || 15,
  },

  // Permitted leave types
  LEAVE_TYPES: ['CASUAL', 'SICK', 'EARNED'],

  // Permitted leave statuses
  LEAVE_STATUSES: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],

  // Standard working days (Monday = 1 through Friday = 5).
  // Weekends (Saturday = 6, Sunday = 0) are excluded from leave balance consumption.
  WORKING_DAYS: [1, 2, 3, 4, 5],
};
