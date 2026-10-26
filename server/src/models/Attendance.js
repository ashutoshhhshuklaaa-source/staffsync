const mongoose = require('mongoose');
const { ATTENDANCE_STATUSES } = require('../config/attendancePolicy');

const attendanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Employee reference is required'],
      index: true,
    },
    // Normalized calendar date in UTC (e.g. YYYY-MM-DDT00:00:00.000Z)
    date: {
      type: Date,
      required: [true, 'Normalized attendance date is required'],
    },
    checkInAt: {
      type: Date,
      required: [true, 'Check-in timestamp is required'],
    },
    checkOutAt: {
      type: Date,
      default: null,
    },
    totalWorkedMinutes: {
      type: Number,
      default: 0,
      min: [0, 'Total worked minutes cannot be negative'],
    },
    status: {
      type: String,
      enum: {
        values: ATTENDANCE_STATUSES,
        message: '{VALUE} is not a valid attendance status',
      },
      default: 'PRESENT',
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
    // Audit fields for administrative corrections
    correctedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    correctedAt: {
      type: Date,
      default: null,
    },
    correctionReason: {
      type: String,
      trim: true,
      default: '',
      maxlength: [500, 'Correction reason cannot exceed 500 characters'],
    },
  },
  {
    timestamps: true,
  }
);

// CRITICAL UNIQUE CONSTRAINT: Exactly one attendance record per employee per calendar date
attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

// Compound index for date-range and reporting queries
attendanceSchema.index({ date: 1, status: 1 });

attendanceSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

attendanceSchema.set('toObject', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('Attendance', attendanceSchema);
