const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const User = require('../models/User');
const {
  HALF_DAY_MINUTES,
  ATTENDANCE_STATUSES,
} = require('../config/attendancePolicy');
const {
  getNormalizedBusinessDate,
  isLateCheckIn,
  calculateWorkedMinutes,
} = require('../utils/attendanceUtils');

/**
 * @route   POST /api/attendance/check-in
 * @desc    Employee daily check-in
 * @access  Private (All authenticated employees)
 */
const checkIn = async (req, res) => {
  try {
    const now = new Date();
    const today = getNormalizedBusinessDate(now);

    // Check if attendance record already exists for today
    const existing = await Attendance.findOne({
      employee: req.user._id,
      date: today,
    });

    if (existing) {
      if (existing.checkOutAt) {
        return res.status(409).json({
          success: false,
          message: 'You have already checked out for today. Multiple check-ins on the same day are not permitted.',
        });
      }
      return res.status(409).json({
        success: false,
        message: 'Duplicate check-in rejected: You have already checked in for today.',
      });
    }

    const { notes } = req.body;
    const late = isLateCheckIn(now);
    const status = late ? 'LATE' : 'PRESENT';

    const attendance = await Attendance.create({
      employee: req.user._id,
      date: today,
      checkInAt: now,
      status,
      notes: notes && typeof notes === 'string' ? notes.trim() : '',
    });

    return res.status(201).json({
      success: true,
      message: `Checked in successfully${late ? ' (marked as LATE)' : ''}.`,
      data: attendance,
    });
  } catch (error) {
    // Handle database-level duplicate key conflict (unique employee + date)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate check-in rejected: Daily attendance record already exists.',
      });
    }

    console.error('Error in checkIn:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error during check-in.',
    });
  }
};

/**
 * @route   PATCH /api/attendance/check-out
 * @desc    Employee daily check-out
 * @access  Private (All authenticated employees)
 */
const checkOut = async (req, res) => {
  try {
    const now = new Date();
    const today = getNormalizedBusinessDate(now);

    // Find active check-in record for today
    const attendance = await Attendance.findOne({
      employee: req.user._id,
      date: today,
    });

    if (!attendance) {
      return res.status(400).json({
        success: false,
        message: 'No active check-in record found for today. You must check in before checking out.',
      });
    }

    if (attendance.checkOutAt) {
      return res.status(409).json({
        success: false,
        message: 'You have already checked out for today.',
      });
    }

    let checkOutTime = now;
    if (req.body.checkOutAt) {
      const parsedTime = new Date(req.body.checkOutAt);
      if (isNaN(parsedTime.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid checkOutAt timestamp format.',
        });
      }
      if (parsedTime < attendance.checkInAt) {
        return res.status(400).json({
          success: false,
          message: 'Check-out time cannot be earlier than check-in time.',
        });
      }
      checkOutTime = parsedTime;
    } else {
      if (checkOutTime < attendance.checkInAt) {
        return res.status(400).json({
          success: false,
          message: 'Check-out time cannot be earlier than check-in time.',
        });
      }
    }

    // Server-calculated worked minutes
    const totalWorkedMinutes = calculateWorkedMinutes(
      attendance.checkInAt,
      checkOutTime
    );

    // Business rule: working less than half-day threshold results in HALF_DAY status
    const finalStatus =
      totalWorkedMinutes < HALF_DAY_MINUTES ? 'HALF_DAY' : attendance.status;

    // Atomic update preventing race condition on double checkout
    const updated = await Attendance.findOneAndUpdate(
      {
        _id: attendance._id,
        checkOutAt: null,
      },
      {
        $set: {
          checkOutAt: checkOutTime,
          totalWorkedMinutes,
          status: finalStatus,
        },
      },
      { new: true }
    ).populate('employee', 'name email department designation');

    if (!updated) {
      return res.status(409).json({
        success: false,
        message: 'Attendance record has already been checked out.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Checked out successfully.',
      data: updated,
    });
  } catch (error) {
    console.error('Error in checkOut:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error during check-out.',
    });
  }
};

/**
 * @route   GET /api/attendance/me
 * @desc    Get authenticated employee's attendance records
 * @access  Private (All authenticated employees)
 */
const getAttendanceMe = async (req, res) => {
  try {
    const { page, limit, startDate, endDate, status } = req.query;

    const filter = { employee: req.user._id };

    if (status && ATTENDANCE_STATUSES.includes(status.toUpperCase())) {
      filter.status = status.toUpperCase();
    }

    if (startDate || endDate) {
      filter.date = {};
      if (startDate && !isNaN(new Date(startDate).getTime())) {
        filter.date.$gte = getNormalizedBusinessDate(new Date(startDate));
      }
      if (endDate && !isNaN(new Date(endDate).getTime())) {
        filter.date.$lte = getNormalizedBusinessDate(new Date(endDate));
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [total, records] = await Promise.all([
      Attendance.countDocuments(filter),
      Attendance.find(filter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limitNum),
    ]);

    const totalPages = Math.ceil(total / limitNum) || 1;

    return res.status(200).json({
      success: true,
      data: records,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error('Error in getAttendanceMe:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving attendance history.',
    });
  }
};

/**
 * @route   GET /api/attendance
 * @desc    List authorized attendance records (HR: all; MANAGER: direct reports)
 * @access  Private (HR or MANAGER only)
 */
const getAttendance = async (req, res) => {
  try {
    // Standard employees are forbidden from administrative listing
    if (req.user.role === 'EMPLOYEE') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Employees cannot access administrative attendance listings. Use /api/attendance/me.',
      });
    }

    const { page, limit, employee, startDate, endDate, status } = req.query;
    const filter = {};

    // Authorization scope enforcement
    if (req.user.role === 'HR') {
      if (employee) {
        if (!mongoose.Types.ObjectId.isValid(employee)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid employee ID format.',
          });
        }
        filter.employee = employee;
      }
    } else if (req.user.role === 'MANAGER') {
      // Find direct reports for this manager
      const directReports = await User.find({ manager: req.user._id }).select('_id');
      const reportIds = directReports.map((d) => d._id.toString());

      if (employee) {
        if (!mongoose.Types.ObjectId.isValid(employee)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid employee ID format.',
          });
        }
        // Verify target employee is within reporting scope
        if (!reportIds.includes(employee) && employee !== req.user._id.toString()) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: You can only view attendance for employees in your direct reporting line.',
          });
        }
        filter.employee = employee;
      } else {
        filter.employee = { $in: [...directReports.map((d) => d._id), req.user._id] };
      }
    }

    if (status && ATTENDANCE_STATUSES.includes(status.toUpperCase())) {
      filter.status = status.toUpperCase();
    }

    if (startDate || endDate) {
      filter.date = {};
      if (startDate && !isNaN(new Date(startDate).getTime())) {
        filter.date.$gte = getNormalizedBusinessDate(new Date(startDate));
      }
      if (endDate && !isNaN(new Date(endDate).getTime())) {
        filter.date.$lte = getNormalizedBusinessDate(new Date(endDate));
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [total, records] = await Promise.all([
      Attendance.countDocuments(filter),
      Attendance.find(filter)
        .populate('employee', 'name email department designation')
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
    ]);

    const totalPages = Math.ceil(total / limitNum) || 1;

    return res.status(200).json({
      success: true,
      data: records,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (error) {
    console.error('Error in getAttendance:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving attendance records.',
    });
  }
};

/**
 * @route   GET /api/attendance/reports/summary
 * @desc    Get aggregate attendance statistics within authorized scope
 * @access  Private (All authenticated roles; scoped accordingly)
 */
const getAttendanceSummaryReport = async (req, res) => {
  try {
    const { startDate, endDate, employee } = req.query;

    const filter = {};

    // Determine authorized employee scope
    if (req.user.role === 'HR') {
      if (employee) {
        if (!mongoose.Types.ObjectId.isValid(employee)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid employee ID format.',
          });
        }
        filter.employee = new mongoose.Types.ObjectId(employee);
      }
    } else if (req.user.role === 'MANAGER') {
      const reports = await User.find({ manager: req.user._id }).select('_id');
      const reportIds = reports.map((r) => r._id);
      const authorizedIds = [...reportIds, req.user._id];

      if (employee) {
        if (!mongoose.Types.ObjectId.isValid(employee)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid employee ID format.',
          });
        }
        if (!authorizedIds.some((id) => id.toString() === employee)) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: You cannot view reports for employees outside your reporting line.',
          });
        }
        filter.employee = new mongoose.Types.ObjectId(employee);
      } else {
        filter.employee = { $in: authorizedIds };
      }
    } else {
      // Standard employee can only see their own summary
      filter.employee = req.user._id;
    }

    // Date range filter
    if (startDate || endDate) {
      filter.date = {};
      if (startDate && !isNaN(new Date(startDate).getTime())) {
        filter.date.$gte = getNormalizedBusinessDate(new Date(startDate));
      }
      if (endDate && !isNaN(new Date(endDate).getTime())) {
        filter.date.$lte = getNormalizedBusinessDate(new Date(endDate));
      }
    }

    // Aggregate summary statistics
    const aggregation = await Attendance.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          presentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'PRESENT'] }, 1, 0] },
          },
          lateCount: {
            $sum: { $cond: [{ $eq: ['$status', 'LATE'] }, 1, 0] },
          },
          halfDayCount: {
            $sum: { $cond: [{ $eq: ['$status', 'HALF_DAY'] }, 1, 0] },
          },
          absentCount: {
            $sum: { $cond: [{ $eq: ['$status', 'ABSENT'] }, 1, 0] },
          },
          totalWorkedMinutes: { $sum: '$totalWorkedMinutes' },
        },
      },
    ]);

    const stats = aggregation[0] || {
      totalRecords: 0,
      presentCount: 0,
      lateCount: 0,
      halfDayCount: 0,
      absentCount: 0,
      totalWorkedMinutes: 0,
    };

    const totalWorkedHours = (stats.totalWorkedMinutes / 60).toFixed(1);
    const averageWorkedMinutes =
      stats.totalRecords > 0
        ? Math.round(stats.totalWorkedMinutes / stats.totalRecords)
        : 0;

    return res.status(200).json({
      success: true,
      data: {
        totalRecords: stats.totalRecords,
        presentCount: stats.presentCount,
        lateCount: stats.lateCount,
        halfDayCount: stats.halfDayCount,
        absentCount: stats.absentCount,
        totalWorkedMinutes: stats.totalWorkedMinutes,
        totalWorkedHours: parseFloat(totalWorkedHours),
        averageWorkedMinutesPerDay: averageWorkedMinutes,
      },
    });
  } catch (error) {
    console.error('Error in getAttendanceSummaryReport:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error generating attendance summary report.',
    });
  }
};

/**
 * @route   GET /api/attendance/:id
 * @desc    Retrieve a single attendance record by ID
 * @access  Private (HR: any; MANAGER: direct report or self; EMPLOYEE: self only)
 */
const getAttendanceById = async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id)
      .populate('employee', 'name email department designation manager')
      .populate('correctedBy', 'name email');

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found.',
      });
    }

    const isSelf = attendance.employee._id.toString() === req.user._id.toString();

    if (req.user.role === 'HR') {
      // HR can view any
    } else if (req.user.role === 'MANAGER') {
      const isReport =
        attendance.employee.manager &&
        attendance.employee.manager.toString() === req.user._id.toString();

      if (!isSelf && !isReport) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You are not authorized to view attendance outside your reporting scope.',
        });
      }
    } else {
      if (!isSelf) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You can only view your own attendance records.',
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: attendance,
    });
  } catch (error) {
    console.error('Error in getAttendanceById:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving attendance record.',
    });
  }
};

/**
 * @route   PATCH /api/attendance/:id/correct
 * @desc    HR administrative correction of attendance record
 * @access  Private (HR only)
 */
const correctAttendance = async (req, res) => {
  try {
    const { status, checkInAt, checkOutAt, correctionReason, notes } = req.body;

    const attendance = await Attendance.findById(req.params.id);
    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: 'Attendance record not found.',
      });
    }

    if (!correctionReason || typeof correctionReason !== 'string' || correctionReason.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'A valid correctionReason of at least 3 characters is required for auditing.',
      });
    }

    if (status) {
      const upperStatus = status.toUpperCase().trim();
      if (!ATTENDANCE_STATUSES.includes(upperStatus)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${ATTENDANCE_STATUSES.join(', ')}.`,
        });
      }
      attendance.status = upperStatus;
    }

    if (checkInAt) {
      const parsedIn = new Date(checkInAt);
      if (isNaN(parsedIn.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid checkInAt timestamp format.',
        });
      }
      attendance.checkInAt = parsedIn;
    }

    if (checkOutAt) {
      const parsedOut = new Date(checkOutAt);
      if (isNaN(parsedOut.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid checkOutAt timestamp format.',
        });
      }
      if (parsedOut < attendance.checkInAt) {
        return res.status(400).json({
          success: false,
          message: 'Check-out time cannot be earlier than check-in time.',
        });
      }
      attendance.checkOutAt = parsedOut;
      attendance.totalWorkedMinutes = calculateWorkedMinutes(
        attendance.checkInAt,
        parsedOut
      );
    }

    if (typeof notes === 'string') {
      attendance.notes = notes.trim();
    }

    attendance.correctedBy = req.user._id;
    attendance.correctedAt = new Date();
    attendance.correctionReason = correctionReason.trim();

    await attendance.save();

    const populated = await Attendance.findById(attendance._id)
      .populate('employee', 'name email department designation')
      .populate('correctedBy', 'name email');

    return res.status(200).json({
      success: true,
      message: 'Attendance record corrected successfully.',
      data: populated,
    });
  } catch (error) {
    console.error('Error in correctAttendance:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error correcting attendance record.',
    });
  }
};

module.exports = {
  checkIn,
  checkOut,
  getAttendanceMe,
  getAttendance,
  getAttendanceSummaryReport,
  getAttendanceById,
  correctAttendance,
};
