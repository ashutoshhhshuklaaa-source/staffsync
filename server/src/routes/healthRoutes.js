const express = require('express');
const router = express.Router();
const { getHealthStatus } = require('../controllers/healthController');

/**
 * @route   GET /api/health
 * @desc    Check server and database connectivity status
 * @access  Public
 */
router.get('/', getHealthStatus);

module.exports = router;
