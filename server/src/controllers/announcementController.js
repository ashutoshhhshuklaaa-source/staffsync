const mongoose = require('mongoose');
const Announcement = require('../models/Announcement');

const VALID_AUDIENCES = ['ALL', 'HR', 'MANAGER', 'EMPLOYEE'];
const VALID_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

/**
 * @route   POST /api/announcements
 * @desc    Create an announcement draft
 * @access  Private (HR only)
 */
const createAnnouncement = async (req, res) => {
  try {
    const { title, content, audience, expiresAt } = req.body;

    // Validate title
    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Title is required and must be at least 3 characters long.',
      });
    }

    if (title.trim().length > 150) {
      return res.status(400).json({
        success: false,
        message: 'Title cannot exceed 150 characters.',
      });
    }

    // Validate content
    if (!content || typeof content !== 'string' || content.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Content is required and must be at least 5 characters long.',
      });
    }

    if (content.trim().length > 5000) {
      return res.status(400).json({
        success: false,
        message: 'Content cannot exceed 5000 characters.',
      });
    }

    // Validate audience target
    let targetAudience = 'ALL';
    if (audience) {
      const upperAudience = audience.toString().toUpperCase().trim();
      if (!VALID_AUDIENCES.includes(upperAudience)) {
        return res.status(400).json({
          success: false,
          message: `Invalid audience. Must be one of: ${VALID_AUDIENCES.join(', ')}.`,
        });
      }
      targetAudience = upperAudience;
    }

    // Validate expiresAt if provided
    let parsedExpiry = null;
    if (expiresAt) {
      parsedExpiry = new Date(expiresAt);
      if (isNaN(parsedExpiry.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid expiresAt date format.',
        });
      }
      if (parsedExpiry <= new Date()) {
        return res.status(400).json({
          success: false,
          message: 'expiresAt must be a date in the future.',
        });
      }
    }

    // SECURITY: Always set createdBy to authenticated user and status to DRAFT
    const announcement = await Announcement.create({
      title: title.trim(),
      content: content.trim(),
      createdBy: req.user._id,
      audience: targetAudience,
      status: 'DRAFT',
      publishedAt: null,
      expiresAt: parsedExpiry,
    });

    const populated = await Announcement.findById(announcement._id).populate(
      'createdBy',
      'name email role'
    );

    return res.status(201).json({
      success: true,
      message: 'Announcement draft created successfully.',
      data: populated,
    });
  } catch (error) {
    console.error('Error in createAnnouncement:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating announcement.',
    });
  }
};

/**
 * @route   GET /api/announcements
 * @desc    List announcements visible to the authenticated user
 * @access  Private (HR: all statuses; Non-HR: published and non-expired for their audience)
 */
const getAnnouncements = async (req, res) => {
  try {
    const { page, limit, search, status, audience } = req.query;
    const now = new Date();
    const filter = {};

    if (req.user.role === 'HR') {
      // HR can view all statuses (DRAFT, PUBLISHED, ARCHIVED)
      if (status && VALID_STATUSES.includes(status.toUpperCase())) {
        filter.status = status.toUpperCase();
      }
      if (audience && VALID_AUDIENCES.includes(audience.toUpperCase())) {
        filter.audience = audience.toUpperCase();
      }
    } else {
      // Non-HR users can strictly view PUBLISHED announcements for ALL or their specific role
      filter.status = 'PUBLISHED';
      filter.audience = { $in: ['ALL', req.user.role] };
      // Exclude expired announcements from the active feed
      filter.$or = [{ expiresAt: null }, { expiresAt: { $gt: now } }];
    }

    // Optional keyword search across title and content
    if (search && typeof search === 'string' && search.trim()) {
      const sanitizedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchCondition = [
        { title: { $regex: sanitizedSearch, $options: 'i' } },
        { content: { $regex: sanitizedSearch, $options: 'i' } },
      ];

      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchCondition }];
        delete filter.$or;
      } else {
        filter.$or = searchCondition;
      }
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [total, announcements] = await Promise.all([
      Announcement.countDocuments(filter),
      Announcement.find(filter)
        .populate('createdBy', 'name email role')
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
    ]);

    const totalPages = Math.ceil(total / limitNum) || 1;

    return res.status(200).json({
      success: true,
      data: announcements,
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
    console.error('Error in getAnnouncements:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving announcements.',
    });
  }
};

/**
 * @route   GET /api/announcements/me
 * @desc    Get published announcements relevant to current user
 * @access  Private (All authenticated roles)
 */
const getAnnouncementsMe = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const now = new Date();

    const filter = {
      status: 'PUBLISHED',
      audience: { $in: ['ALL', req.user.role] },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    };

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [total, announcements] = await Promise.all([
      Announcement.countDocuments(filter),
      Announcement.find(filter)
        .populate('createdBy', 'name email role')
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
    ]);

    const totalPages = Math.ceil(total / limitNum) || 1;

    return res.status(200).json({
      success: true,
      data: announcements,
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
    console.error('Error in getAnnouncementsMe:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving announcements for current user.',
    });
  }
};

/**
 * @route   GET /api/announcements/:id
 * @desc    View an authorized announcement
 * @access  Private (HR: all; Non-HR: published and non-expired for their audience)
 */
const getAnnouncementById = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id).populate(
      'createdBy',
      'name email role'
    );

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found.',
      });
    }

    // Role-based visibility enforcement
    if (req.user.role !== 'HR') {
      const now = new Date();

      // DRAFT or ARCHIVED announcements must never leak to non-HR users
      if (announcement.status !== 'PUBLISHED') {
        return res.status(404).json({
          success: false,
          message: 'Announcement not found.',
        });
      }

      // Check audience permission
      if (
        announcement.audience !== 'ALL' &&
        announcement.audience !== req.user.role
      ) {
        return res.status(404).json({
          success: false,
          message: 'Announcement not found.',
        });
      }

      // Check expiration
      if (announcement.expiresAt && announcement.expiresAt <= now) {
        return res.status(404).json({
          success: false,
          message: 'Announcement has expired.',
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: announcement,
    });
  } catch (error) {
    console.error('Error in getAnnouncementById:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving announcement.',
    });
  }
};

/**
 * @route   PATCH /api/announcements/:id
 * @desc    Edit an announcement
 * @access  Private (HR only)
 */
const updateAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found.',
      });
    }

    if (announcement.status === 'ARCHIVED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit an archived announcement.',
      });
    }

    const { title, content, audience, expiresAt } = req.body;

    if (typeof title !== 'undefined') {
      if (!title || typeof title !== 'string' || title.trim().length < 3) {
        return res.status(400).json({
          success: false,
          message: 'Title must be at least 3 characters long.',
        });
      }
      if (title.trim().length > 150) {
        return res.status(400).json({
          success: false,
          message: 'Title cannot exceed 150 characters.',
        });
      }
      announcement.title = title.trim();
    }

    if (typeof content !== 'undefined') {
      if (!content || typeof content !== 'string' || content.trim().length < 5) {
        return res.status(400).json({
          success: false,
          message: 'Content must be at least 5 characters long.',
        });
      }
      if (content.trim().length > 5000) {
        return res.status(400).json({
          success: false,
          message: 'Content cannot exceed 5000 characters.',
        });
      }
      announcement.content = content.trim();
    }

    if (typeof audience !== 'undefined') {
      const upperAudience = audience.toString().toUpperCase().trim();
      if (!VALID_AUDIENCES.includes(upperAudience)) {
        return res.status(400).json({
          success: false,
          message: `Invalid audience. Must be one of: ${VALID_AUDIENCES.join(', ')}.`,
        });
      }
      announcement.audience = upperAudience;
    }

    if (typeof expiresAt !== 'undefined') {
      if (expiresAt === null || expiresAt === '') {
        announcement.expiresAt = null;
      } else {
        const parsed = new Date(expiresAt);
        if (isNaN(parsed.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid expiresAt date format.',
          });
        }
        if (parsed <= new Date()) {
          return res.status(400).json({
            success: false,
            message: 'expiresAt must be a date in the future.',
          });
        }
        announcement.expiresAt = parsed;
      }
    }

    await announcement.save();

    const populated = await Announcement.findById(announcement._id).populate(
      'createdBy',
      'name email role'
    );

    return res.status(200).json({
      success: true,
      message: 'Announcement updated successfully.',
      data: populated,
    });
  } catch (error) {
    console.error('Error in updateAnnouncement:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error updating announcement.',
    });
  }
};

/**
 * @route   PATCH /api/announcements/:id/publish
 * @desc    Publish an announcement draft
 * @access  Private (HR only)
 */
const publishAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found.',
      });
    }

    if (announcement.status === 'PUBLISHED') {
      return res.status(400).json({
        success: false,
        message: 'Announcement is already published.',
      });
    }

    if (announcement.status === 'ARCHIVED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot publish an archived announcement.',
      });
    }

    if (announcement.expiresAt && announcement.expiresAt <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot publish an announcement whose expiration date has passed.',
      });
    }

    // Atomic transition: strictly transitions from DRAFT to PUBLISHED with server timestamp
    const published = await Announcement.findOneAndUpdate(
      { _id: req.params.id, status: 'DRAFT' },
      {
        $set: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
        },
      },
      { new: true }
    ).populate('createdBy', 'name email role');

    if (!published) {
      return res.status(409).json({
        success: false,
        message: 'Conflict: Announcement is no longer in DRAFT status.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Announcement published successfully.',
      data: published,
    });
  } catch (error) {
    console.error('Error in publishAnnouncement:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error publishing announcement.',
    });
  }
};

/**
 * @route   PATCH /api/announcements/:id/archive
 * @desc    Archive an announcement
 * @access  Private (HR only)
 */
const archiveAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found.',
      });
    }

    if (announcement.status === 'ARCHIVED') {
      return res.status(400).json({
        success: false,
        message: 'Announcement is already archived.',
      });
    }

    // Atomic transition to ARCHIVED
    const archived = await Announcement.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: 'ARCHIVED' } },
      {
        $set: {
          status: 'ARCHIVED',
        },
      },
      { new: true }
    ).populate('createdBy', 'name email role');

    if (!archived) {
      return res.status(409).json({
        success: false,
        message: 'Announcement has already been archived.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Announcement archived successfully.',
      data: archived,
    });
  } catch (error) {
    console.error('Error in archiveAnnouncement:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error archiving announcement.',
    });
  }
};

module.exports = {
  createAnnouncement,
  getAnnouncements,
  getAnnouncementsMe,
  getAnnouncementById,
  updateAnnouncement,
  publishAnnouncement,
  archiveAnnouncement,
};
