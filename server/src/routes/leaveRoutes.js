const express = require('express');
const router = express.Router();
const {
  applyLeave,
  getLeaves,
  getLeavesMe,
  getLeaveBalanceMe,
  getLeaveById,
  reviewLeave,
  cancelLeave,
} = require('../controllers/leaveController');
const { protect } = require('../middleware/authMiddleware');
const validateObjectId = require('../middleware/validateObjectId');

/**
 * @route   POST /api/leaves
 * @desc    Apply for a new leave
 * @access  Private (All authenticated employees)
 */
router.post('/', protect, applyLeave);

/**
 * @route   GET /api/leaves
 * @desc    List authorized leave records (HR: all; MANAGER: team; EMPLOYEE: self)
 * @access  Private
 */
router.get('/', protect, getLeaves);

/**
 * @route   GET /api/leaves/me
 * @desc    Retrieve authenticated employee's own leave history
 * @access  Private (All authenticated employees)
 * NOTE: Placed before /:id to prevent route shadowing
 */
router.get('/me', protect, getLeavesMe);

/**
 * @route   GET /api/leaves/balance/me
 * @desc    Retrieve authenticated employee's current year leave balance
 * @access  Private (All authenticated employees)
 * NOTE: Placed before /:id to prevent route shadowing
 */
router.get('/balance/me', protect, getLeaveBalanceMe);

/**
 * @route   GET /api/leaves/:id
 * @desc    Retrieve a single authorized leave record
 * @access  Private (HR: any; MANAGER: team; EMPLOYEE: self)
 */
router.get('/:id', protect, validateObjectId('id'), getLeaveById);

/**
 * @route   PATCH /api/leaves/:id/review
 * @desc    Approve or reject a leave request
 * @access  Private (HR or authorized MANAGER; self-approval forbidden)
 */
router.patch('/:id/review', protect, validateObjectId('id'), reviewLeave);

/**
 * @route   PATCH /api/leaves/:id/cancel
 * @desc    Cancel an eligible leave request
 * @access  Private (Leave owner or HR)
 */
router.patch('/:id/cancel', protect, validateObjectId('id'), cancelLeave);

module.exports = router;
