const express = require('express');
const router = express.Router();
const {
  getEmployees,
  getEmployeeMe,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  updateEmployeeStatus,
} = require('../controllers/employeeController');
const { protect } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const validateObjectId = require('../middleware/validateObjectId');

/**
 * @route   GET /api/employees
 * @desc    List employees with search, filter, and pagination (HR & MANAGER scoped)
 * @access  Private (HR or MANAGER)
 */
router.get('/', protect, getEmployees);

/**
 * @route   GET /api/employees/me
 * @desc    Get authenticated employee's own record
 * @access  Private (All authenticated roles)
 * NOTE: Must be mounted before /:id to prevent route shadowing
 */
router.get('/me', protect, getEmployeeMe);

/**
 * @route   GET /api/employees/:id
 * @desc    Get employee by ID
 * @access  Private (HR: all; MANAGER: team; EMPLOYEE: self)
 */
router.get('/:id', protect, validateObjectId('id'), getEmployeeById);

/**
 * @route   POST /api/employees
 * @desc    Create new employee record
 * @access  Private (HR only)
 */
router.post('/', protect, requireRole('HR'), createEmployee);

/**
 * @route   PATCH /api/employees/:id
 * @desc    Update employee details
 * @access  Private (HR: all; EMPLOYEE/MANAGER: self-service allowed fields)
 */
router.patch('/:id', protect, validateObjectId('id'), updateEmployee);

/**
 * @route   PATCH /api/employees/:id/status
 * @desc    Activate or deactivate employee
 * @access  Private (HR only)
 */
router.patch(
  '/:id/status',
  protect,
  requireRole('HR'),
  validateObjectId('id'),
  updateEmployeeStatus
);

module.exports = router;
