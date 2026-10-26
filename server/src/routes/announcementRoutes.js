const express = require('express');
const router = express.Router();
const {
  createAnnouncement,
  getAnnouncements,
  getAnnouncementsMe,
  getAnnouncementById,
  updateAnnouncement,
  publishAnnouncement,
  archiveAnnouncement,
} = require('../controllers/announcementController');
const { protect } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const validateObjectId = require('../middleware/validateObjectId');

/**
 * @route   POST /api/announcements
 * @desc    Create a draft announcement
 * @access  Private (HR only)
 */
router.post('/', protect, requireRole('HR'), createAnnouncement);

/**
 * @route   GET /api/announcements
 * @desc    List announcements visible to current authenticated user
 * @access  Private (HR: all; MANAGER/EMPLOYEE: published & unexpired for their role)
 */
router.get('/', protect, getAnnouncements);

/**
 * @route   GET /api/announcements/me
 * @desc    Get published announcements relevant to current user
 * @access  Private (All authenticated users)
 * NOTE: Placed before dynamic /:id to prevent route capturing
 */
router.get('/me', protect, getAnnouncementsMe);

/**
 * @route   GET /api/announcements/:id
 * @desc    Retrieve a single authorized announcement
 * @access  Private (HR: all; MANAGER/EMPLOYEE: published for their audience)
 */
router.get('/:id', protect, validateObjectId('id'), getAnnouncementById);

/**
 * @route   PATCH /api/announcements/:id
 * @desc    Edit announcement details (title, content, audience, expiresAt)
 * @access  Private (HR only)
 */
router.patch(
  '/:id',
  protect,
  requireRole('HR'),
  validateObjectId('id'),
  updateAnnouncement
);

/**
 * @route   PATCH /api/announcements/:id/publish
 * @desc    Publish a draft announcement
 * @access  Private (HR only)
 */
router.patch(
  '/:id/publish',
  protect,
  requireRole('HR'),
  validateObjectId('id'),
  publishAnnouncement
);

/**
 * @route   PATCH /api/announcements/:id/archive
 * @desc    Archive an announcement
 * @access  Private (HR only)
 */
router.patch(
  '/:id/archive',
  protect,
  requireRole('HR'),
  validateObjectId('id'),
  archiveAnnouncement
);

module.exports = router;
