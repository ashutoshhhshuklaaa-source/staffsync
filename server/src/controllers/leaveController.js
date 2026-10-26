const mongoose = require('mongoose');
const Leave = require('../models/Leave');
const LeaveBalance = require('../models/LeaveBalance');
const User = require('../models/User');
const { LEAVE_TYPES } = require('../config/leavePolicy');
const {
  calculateLeaveDays,
  getOrCreateLeaveBalance,
  formatLeaveBalanceResponse,
} = require('../utils/leaveUtils');

/**
 * @route   POST /api/leaves
 * @desc    Apply for leave (authenticated employee)
 * @access  Private (All authenticated employees)
 */
const applyLeave = async (req, res) => {
  try {
    const { leaveType, startDate, endDate, reason } = req.body;

    // Validate leaveType
    if (!leaveType || !LEAVE_TYPES.includes(leaveType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid leave type. Must be one of: ${LEAVE_TYPES.join(', ')}.`,
      });
    }

    // Validate reason
    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'A reason of at least 3 characters is required.',
      });
    }

    if (reason.trim().length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Reason cannot exceed 500 characters.',
      });
    }

    // Validate dates
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Both startDate and endDate are required.',
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Please provide valid ISO date strings.',
      });
    }

    // Normalize start to beginning of day and end to end of day
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: 'startDate must be earlier than or equal to endDate.',
      });
    }

    // Past-date policy: planned leaves cannot start prior to today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (start < today) {
      return res.status(400).json({
        success: false,
        message: 'Leave cannot be requested for past dates. Start date must be today or a future date.',
      });
    }

    // Calculate working days excluding weekends
    const days = calculateLeaveDays(start, end);
    if (days <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Requested leave duration contains 0 working days (weekends are non-working days).',
      });
    }

    // Prevent overlapping active/pending leave requests for the same employee
    const overlapping = await Leave.findOne({
      employee: req.user._id,
      status: { $in: ['PENDING', 'APPROVED'] },
      startDate: { $lte: end },
      endDate: { $gte: start },
    });

    if (overlapping) {
      return res.status(409).json({
        success: false,
        message: 'Overlapping leave request detected: You already have a pending or approved leave request for this period.',
      });
    }

    // Verify employee has sufficient available leave balance before creating
    const leaveYear = start.getFullYear();
    const balance = await getOrCreateLeaveBalance(req.user._id, leaveYear);
    const available = balance[leaveType].allowance - balance[leaveType].used;

    if (days > available) {
      return res.status(400).json({
        success: false,
        message: `Insufficient leave balance: You have ${available} days available for ${leaveType} leave, but requested ${days} working days.`,
      });
    }

    // Create the leave request
    const leave = await Leave.create({
      employee: req.user._id,
      leaveType,
      startDate: start,
      endDate: end,
      days,
      reason: reason.trim(),
      status: 'PENDING',
    });

    return res.status(201).json({
      success: true,
      message: 'Leave application submitted successfully.',
      data: leave,
    });
  } catch (error) {
    console.error('Error in applyLeave:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while submitting leave application.',
    });
  }
};

/**
 * @route   GET /api/leaves
 * @desc    List authorized leave records with search/filter and pagination
 * @access  Private (HR: all; MANAGER: team reporting scope; EMPLOYEE: self only)
 */
const getLeaves = async (req, res) => {
  try {
    const { page, limit, status, leaveType, startDate, endDate } = req.query;

    const filter = {};

    // Scope enforcement by role
    if (req.user.role === 'HR') {
      // HR can view all company leave requests
    } else if (req.user.role === 'MANAGER') {
      // Managers can view requests from employees reporting to them or their own requests
      const directReports = await User.find({ manager: req.user._id }).select('_id');
      const reportIds = directReports.map((d) => d._id);
      filter.employee = { $in: [...reportIds, req.user._id] };
    } else {
      // Standard employees can view only their own requests
      filter.employee = req.user._id;
    }

    // Optional status filter
    if (status && typeof status === 'string') {
      const upperStatus = status.toUpperCase().trim();
      if (['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(upperStatus)) {
        filter.status = upperStatus;
      }
    }

    // Optional leaveType filter
    if (leaveType && typeof leaveType === 'string') {
      const upperType = leaveType.toUpperCase().trim();
      if (LEAVE_TYPES.includes(upperType)) {
        filter.leaveType = upperType;
      }
    }

    // Optional date range filter
    if (startDate || endDate) {
      filter.startDate = {};
      if (startDate && !isNaN(new Date(startDate).getTime())) {
        filter.startDate.$gte = new Date(startDate);
      }
      if (endDate && !isNaN(new Date(endDate).getTime())) {
        filter.startDate.$lte = new Date(endDate);
      }
    }

    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [total, leaves] = await Promise.all([
      Leave.countDocuments(filter),
      Leave.find(filter)
        .populate('employee', 'name email department designation manager')
        .populate('reviewedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
    ]);

    const totalPages = Math.ceil(total / limitNum) || 1;

    return res.status(200).json({
      success: true,
      data: leaves,
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
    console.error('Error in getLeaves:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving leave records.',
    });
  }
};

/**
 * @route   GET /api/leaves/me
 * @desc    Get current employee's own leave history
 * @access  Private (All authenticated users)
 */
const getLeavesMe = async (req, res) => {
  try {
    const { page, limit, status, leaveType } = req.query;

    const filter = { employee: req.user._id };

    if (status && typeof status === 'string') {
      const upperStatus = status.toUpperCase().trim();
      if (['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(upperStatus)) {
        filter.status = upperStatus;
      }
    }

    if (leaveType && typeof leaveType === 'string') {
      const upperType = leaveType.toUpperCase().trim();
      if (LEAVE_TYPES.includes(upperType)) {
        filter.leaveType = upperType;
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [total, leaves] = await Promise.all([
      Leave.countDocuments(filter),
      Leave.find(filter)
        .populate('reviewedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
    ]);

    const totalPages = Math.ceil(total / limitNum) || 1;

    return res.status(200).json({
      success: true,
      data: leaves,
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
    console.error('Error in getLeavesMe:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving your leave records.',
    });
  }
};

/**
 * @route   GET /api/leaves/balance/me
 * @desc    Get current employee's leave balance for the current year
 * @access  Private (All authenticated users)
 */
const getLeaveBalanceMe = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const balance = await getOrCreateLeaveBalance(req.user._id, currentYear);

    return res.status(200).json({
      success: true,
      data: formatLeaveBalanceResponse(balance),
    });
  } catch (error) {
    console.error('Error in getLeaveBalanceMe:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving leave balance.',
    });
  }
};

/**
 * @route   GET /api/leaves/:id
 * @desc    Retrieve one authorized leave record
 * @access  Private (HR: any; MANAGER: direct report or self; EMPLOYEE: self only)
 */
const getLeaveById = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id)
      .populate('employee', 'name email department designation manager')
      .populate('reviewedBy', 'name email');

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found.',
      });
    }

    const isSelf = leave.employee._id.toString() === req.user._id.toString();

    // Authorization checks
    if (req.user.role === 'HR') {
      // HR can view all
    } else if (req.user.role === 'MANAGER') {
      const isReport =
        leave.employee.manager &&
        leave.employee.manager.toString() === req.user._id.toString();

      if (!isSelf && !isReport) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You are not authorized to view this leave request.',
        });
      }
    } else {
      if (!isSelf) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You can only view your own leave requests.',
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: leave,
    });
  } catch (error) {
    console.error('Error in getLeaveById:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving leave request.',
    });
  }
};

/**
 * @route   PATCH /api/leaves/:id/review
 * @desc    Approve or reject a pending leave request
 * @access  Private (HR: all; MANAGER: direct reporting scope)
 */
const reviewLeave = async (req, res) => {
  try {
    // Standard employees are strictly forbidden from reviewing
    if (req.user.role === 'EMPLOYEE') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Employees cannot approve or reject leave requests.',
      });
    }

    const { status, comment, reviewComment } = req.body;

    // Validate requested status
    if (!status || !['APPROVED', 'REJECTED'].includes(status.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Status is required and must be either "APPROVED" or "REJECTED".',
      });
    }

    const targetStatus = status.toUpperCase();

    // Load leave document
    const leave = await Leave.findById(req.params.id).populate('employee');
    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found.',
      });
    }

    // CRITICAL SECURITY RULE: Users cannot approve their own leave requests
    if (leave.employee._id.toString() === req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Self-approval is forbidden: You cannot approve or reject your own leave request.',
      });
    }

    // Role reporting scope check for managers
    if (req.user.role === 'MANAGER') {
      const isDirectReport =
        leave.employee.manager &&
        leave.employee.manager.toString() === req.user._id.toString();

      if (!isDirectReport) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You can only review leave requests from employees within your direct reporting line.',
        });
      }
    }

    // State check: Only PENDING requests can be approved or rejected
    if (leave.status !== 'PENDING') {
      return res.status(409).json({
        success: false,
        message: `Cannot review request: Leave is already ${leave.status}.`,
      });
    }

    const leaveYear = leave.startDate.getFullYear();
    const finalComment = (reviewComment || comment || '').trim();

    // If approving, atomically verify & deduct balance to prevent race conditions & overspending
    if (targetStatus === 'APPROVED') {
      await getOrCreateLeaveBalance(leave.employee._id, leaveYear);

      // Single-document atomic increment with condition check
      const balanceDoc = await LeaveBalance.findOneAndUpdate(
        {
          employee: leave.employee._id,
          year: leaveYear,
          $expr: {
            $lte: [
              { $add: [`$${leave.leaveType}.used`, leave.days] },
              `$${leave.leaveType}.allowance`,
            ],
          },
        },
        {
          $inc: { [`${leave.leaveType}.used`]: leave.days },
        },
        { new: true }
      );

      if (!balanceDoc) {
        return res.status(409).json({
          success: false,
          message: `Insufficient leave balance: Approving this request would exceed the employee's available ${leave.leaveType} leave allowance.`,
        });
      }
    }

    // Atomic transition on Leave document (ensures duplicate concurrent reviews are rejected)
    const updatedLeave = await Leave.findOneAndUpdate(
      { _id: leave._id, status: 'PENDING' },
      {
        $set: {
          status: targetStatus,
          reviewedBy: req.user._id,
          reviewedAt: new Date(),
          reviewComment: finalComment,
        },
      },
      { new: true }
    )
      .populate('employee', 'name email department designation')
      .populate('reviewedBy', 'name email');

    // If leave was updated in a parallel race by another reviewer, rollback balance
    if (!updatedLeave) {
      if (targetStatus === 'APPROVED') {
        await LeaveBalance.updateOne(
          { employee: leave.employee._id, year: leaveYear },
          { $inc: { [`${leave.leaveType}.used`]: -leave.days } }
        );
      }
      return res.status(409).json({
        success: false,
        message: 'Conflict: Leave request has already been reviewed by another administrator.',
      });
    }

    return res.status(200).json({
      success: true,
      message: `Leave request ${targetStatus.toLowerCase()} successfully.`,
      data: updatedLeave,
    });
  } catch (error) {
    console.error('Error in reviewLeave:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while reviewing leave request.',
    });
  }
};

/**
 * @route   PATCH /api/leaves/:id/cancel
 * @desc    Cancel an eligible leave request
 * @access  Private (Owner employee or HR)
 */
const cancelLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found.',
      });
    }

    const isOwner = leave.employee.toString() === req.user._id.toString();
    const isHR = req.user.role === 'HR';

    if (!isOwner && !isHR) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only cancel your own leave requests.',
      });
    }

    // Cancellation eligibility rules
    if (leave.status === 'CANCELLED') {
      return res.status(400).json({
        success: false,
        message: 'Leave request is already cancelled.',
      });
    }

    if (leave.status === 'REJECTED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a rejected leave request.',
      });
    }

    // If already approved, check that leave has not concluded
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (leave.status === 'APPROVED') {
      if (leave.endDate < today) {
        return res.status(400).json({
          success: false,
          message: 'Cannot cancel a leave request that has already passed in the past.',
        });
      }

      // Refund the used days in the employee's balance
      const leaveYear = leave.startDate.getFullYear();
      await LeaveBalance.updateOne(
        { employee: leave.employee, year: leaveYear },
        { $inc: { [`${leave.leaveType}.used`]: -leave.days } }
      );
    }

    leave.status = 'CANCELLED';
    await leave.save();

    const populated = await Leave.findById(leave._id)
      .populate('employee', 'name email department designation')
      .populate('reviewedBy', 'name email');

    return res.status(200).json({
      success: true,
      message: 'Leave request cancelled successfully.',
      data: populated,
    });
  } catch (error) {
    console.error('Error in cancelLeave:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while cancelling leave request.',
    });
  }
};

module.exports = {
  applyLeave,
  getLeaves,
  getLeavesMe,
  getLeaveBalanceMe,
  getLeaveById,
  reviewLeave,
  cancelLeave,
};
