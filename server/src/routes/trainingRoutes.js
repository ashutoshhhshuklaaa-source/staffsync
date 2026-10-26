const express = require('express');
const router = express.Router();
const {
  createTraining,
  getTrainings,
  getTrainingById,
  updateTraining,
  publishTraining,
  archiveTraining,
  enrollInTraining,
  getMyEnrollments,
  getTrainingEnrollments,
  updateProgress,
} = require('../controllers/trainingController');
const { protect } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const validateObjectId = require('../middleware/validateObjectId');

/**
 * @route   POST /api/trainings
 * @desc    HR creates a draft training
 * @access  Private (HR only)
 */
router.post('/', protect, requireRole('HR'), createTraining);

/**
 * @route   GET /api/trainings
 * @desc    List authorized training records (HR: all; Non-HR: published)
 * @access  Private
 */
router.get('/', protect, getTrainings);

/**
 * @route   GET /api/trainings/me/enrollments
 * @desc    Employee views their own training enrollments
 * @access  Private (All authenticated employees)
 * NOTE: Placed before dynamic /:id to prevent route shadowing
 */
router.get('/me/enrollments', protect, getMyEnrollments);

/**
 * @route   GET /api/trainings/:id
 * @desc    Get training by ID
 * @access  Private (HR: all; Non-HR: published only)
 */
router.get('/:id', protect, validateObjectId('id'), getTrainingById);

/**
 * @route   PATCH /api/trainings/:id
 * @desc    HR updates training details
 * @access  Private (HR only)
 */
router.patch(
  '/:id',
  protect,
  requireRole('HR'),
  validateObjectId('id'),
  updateTraining
);

/**
 * @route   PATCH /api/trainings/:id/publish
 * @desc    HR publishes a draft training
 * @access  Private (HR only)
 */
router.patch(
  '/:id/publish',
  protect,
  requireRole('HR'),
  validateObjectId('id'),
  publishTraining
);

/**
 * @route   PATCH /api/trainings/:id/archive
 * @desc    HR archives a training
 * @access  Private (HR only)
 */
router.patch(
  '/:id/archive',
  protect,
  requireRole('HR'),
  validateObjectId('id'),
  archiveTraining
);

/**
 * @route   POST /api/trainings/:id/enroll
 * @desc    Employee enrolls in a published training
 * @access  Private (All authenticated employees)
 */
router.post('/:id/enroll', protect, validateObjectId('id'), enrollInTraining);

/**
 * @route   GET /api/trainings/:id/enrollments
 * @desc    HR views all enrollments; Managers view direct reports
 * @access  Private (HR or authorized MANAGER)
 */
router.get(
  '/:id/enrollments',
  protect,
  validateObjectId('id'),
  getTrainingEnrollments
);

/**
 * @route   PATCH /api/trainings/:id/enrollments/:enrollmentId/progress
 * @desc    Employee updates their own enrollment progress status
 * @access  Private (Enrolled employee only)
 */
router.patch(
  '/:id/enrollments/:enrollmentId/progress',
  protect,
  validateObjectId('id'),
  validateObjectId('enrollmentId'),
  updateProgress
);

module.exports = router;
