const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

/**
 * @route   POST /api/auth/register
 * @desc    Public employee registration
 * @access  Public
 */
router.post('/register', register);

/**
 * @route   POST /api/auth/login
 * @desc    User login with email & password, returns JWT
 * @access  Public
 */
router.post('/login', login);

/**
 * @route   GET /api/auth/me
 * @desc    Retrieve profile of the currently logged-in user
 * @access  Private (JWT protected)
 */
router.get('/me', protect, getMe);

/**
 * @route   GET /api/auth/hr-only
 * @desc    Demonstration route for RBAC (HR role required)
 * @access  Private (JWT protected + HR role required)
 */
router.get('/hr-only', protect, requireRole('HR'), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Access granted: HR administrative area.',
    user: req.user,
  });
});

module.exports = router;
