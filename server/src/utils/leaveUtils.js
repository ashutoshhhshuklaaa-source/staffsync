const LeaveBalance = require('../models/LeaveBalance');
const { WORKING_DAYS, DEFAULT_ALLOWANCES } = require('../config/leavePolicy');

/**
 * Calculates number of business/working days between startDate and endDate inclusive.
 * Excludes weekends (Saturday & Sunday) per company policy.
 *
 * @param {Date|string} startDate
 * @param {Date|string} endDate
 * @returns {number} Count of working days
 */
const calculateLeaveDays = (startDate, endDate) => {
  let count = 0;
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (WORKING_DAYS.includes(dayOfWeek)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
};

/**
 * Retrieves or initializes an annual leave balance document for an employee.
 * Safe against concurrent initialization races.
 *
 * @param {string|ObjectId} employeeId
 * @param {number} year
 * @returns {Promise<Document>}
 */
const getOrCreateLeaveBalance = async (
  employeeId,
  year = new Date().getFullYear()
) => {
  let balance = await LeaveBalance.findOne({ employee: employeeId, year });

  if (!balance) {
    try {
      balance = await LeaveBalance.create({
        employee: employeeId,
        year,
        CASUAL: { allowance: DEFAULT_ALLOWANCES.CASUAL, used: 0 },
        SICK: { allowance: DEFAULT_ALLOWANCES.SICK, used: 0 },
        EARNED: { allowance: DEFAULT_ALLOWANCES.EARNED, used: 0 },
      });
    } catch (err) {
      if (err.code === 11000) {
        balance = await LeaveBalance.findOne({ employee: employeeId, year });
      } else {
        throw err;
      }
    }
  }

  return balance;
};

/**
 * Formats a LeaveBalance document into a clean, client-friendly structure.
 *
 * @param {Document} balanceDoc
 * @returns {Object}
 */
const formatLeaveBalanceResponse = (balanceDoc) => {
  return {
    year: balanceDoc.year,
    balances: {
      CASUAL: {
        allowance: balanceDoc.CASUAL.allowance,
        used: balanceDoc.CASUAL.used,
        available: Math.max(
          0,
          balanceDoc.CASUAL.allowance - balanceDoc.CASUAL.used
        ),
      },
      SICK: {
        allowance: balanceDoc.SICK.allowance,
        used: balanceDoc.SICK.used,
        available: Math.max(0, balanceDoc.SICK.allowance - balanceDoc.SICK.used),
      },
      EARNED: {
        allowance: balanceDoc.EARNED.allowance,
        used: balanceDoc.EARNED.used,
        available: Math.max(
          0,
          balanceDoc.EARNED.allowance - balanceDoc.EARNED.used
        ),
      },
    },
  };
};

module.exports = {
  calculateLeaveDays,
  getOrCreateLeaveBalance,
  formatLeaveBalanceResponse,
};
