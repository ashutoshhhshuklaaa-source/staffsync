const mongoose = require('mongoose');
const { DEFAULT_ALLOWANCES } = require('../config/leavePolicy');

const leaveBalanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Employee reference is required'],
      index: true,
    },
    year: {
      type: Number,
      required: [true, 'Calendar year is required'],
      default: () => new Date().getFullYear(),
    },
    CASUAL: {
      allowance: { type: Number, default: DEFAULT_ALLOWANCES.CASUAL },
      used: { type: Number, default: 0 },
    },
    SICK: {
      allowance: { type: Number, default: DEFAULT_ALLOWANCES.SICK },
      used: { type: Number, default: 0 },
    },
    EARNED: {
      allowance: { type: Number, default: DEFAULT_ALLOWANCES.EARNED },
      used: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

// Enforce single balance record per employee per calendar year
leaveBalanceSchema.index({ employee: 1, year: 1 }, { unique: true });

leaveBalanceSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

leaveBalanceSchema.set('toObject', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('LeaveBalance', leaveBalanceSchema);
