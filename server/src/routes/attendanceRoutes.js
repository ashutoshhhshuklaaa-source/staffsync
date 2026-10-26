const express = require('express');
const router = express.Router();
const {
  checkIn,
  checkOut,
  getAttendanceMe,
  getAttendance,
  getAttendanceSummaryReport,
  getAttendanceById,
  correctAttendance,
} = require('../controllers/attendanceController');
const { protect } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const validateObjectId = require('../middleware/validateObjectId');

/**
 * @route   POST /api/attendance/check-in
 * @desc    Employee daily check-in
 * @access  Private (All authenticated employees)
 */
router.post('/check-in', protect, checkIn);

/**
 * @route   PATCH /api/attendance/check-out
 * @desc    Employee daily check-out
 * @access  Private (All authenticated employees)
 */
router.patch('/check-out', protect, checkOut);

/**
 * @route   GET /api/attendance/me
 * @desc    Get authenticated employee's own attendance history
 * @access  Private (All authenticated employees)
 * NOTE: Placed before dynamic /:id to prevent route capturing
 */
router.get('/me', protect, getAttendanceMe);

/**
 * @route   GET /api/attendance/reports/summary
 * @desc    Get aggregate attendance statistics and summary report
 * @access  Private (Scoped: HR all; MANAGER direct reports; EMPLOYEE self)
 * NOTE: Placed before dynamic /:id to prevent route capturing
 */
router.get('/reports/summary', protect, getAttendanceSummaryReport);

/**
 * @route   GET /api/attendance
 * @desc    Authorized administrative attendance listing
 * @access  Private (HR or MANAGER only)
 */
router.get('/', protect, getAttendance);

/**
 * @route   GET /api/attendance/:id
 * @desc    Retrieve a single attendance record by ID
 * @access  Private (HR: all; MANAGER: direct report; EMPLOYEE: self)
 */
router.get('/:id', protect, validateObjectId('id'), getAttendanceById);

/**
 * @route   PATCH /api/attendance/:id/correct
 * @desc    HR administrative correction of an attendance record
 * @access  Private (HR only)
 */
router.patch(
  '/:id/correct',
  protect,
  requireRole('HR'),
  validateObjectId('id'),
  correctAttendance
);

module.exports = router;
