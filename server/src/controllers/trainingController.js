const mongoose = require('mongoose');
const Training = require('../models/Training');
const TrainingEnrollment = require('../models/TrainingEnrollment');
const User = require('../models/User');

const VALID_DIFFICULTIES = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const VALID_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

// Valid progress state transitions for employee enrollments
const ALLOWED_PROGRESS_TRANSITIONS = {
  ENROLLED: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

/**
 * @route   POST /api/trainings
 * @desc    HR creates a draft training
 * @access  Private (HR only)
 */
const createTraining = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      instructor,
      durationMinutes,
      difficulty,
      enrollmentDeadline,
      startDate,
      endDate,
    } = req.body;

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

    // Validate description
    if (!description || typeof description !== 'string' || description.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Description is required and must be at least 5 characters long.',
      });
    }
    if (description.trim().length > 5000) {
      return res.status(400).json({
        success: false,
        message: 'Description cannot exceed 5000 characters.',
      });
    }

    // Validate category & instructor
    if (!category || typeof category !== 'string' || category.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Category is required (at least 2 characters).',
      });
    }
    if (!instructor || typeof instructor !== 'string' || instructor.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Instructor name is required (at least 2 characters).',
      });
    }

    // Validate durationMinutes
    const durationNum = parseInt(durationMinutes, 10);
    if (isNaN(durationNum) || durationNum <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Duration in minutes must be a positive integer.',
      });
    }

    // Validate difficulty
    let diff = 'BEGINNER';
    if (difficulty) {
      const upperDiff = difficulty.toString().toUpperCase().trim();
      if (!VALID_DIFFICULTIES.includes(upperDiff)) {
        return res.status(400).json({
          success: false,
          message: `Invalid difficulty. Must be one of: ${VALID_DIFFICULTIES.join(', ')}.`,
        });
      }
      diff = upperDiff;
    }

    // Validate date ranges if provided
    let parsedDeadline = null;
    if (enrollmentDeadline) {
      parsedDeadline = new Date(enrollmentDeadline);
      if (isNaN(parsedDeadline.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid enrollmentDeadline date format.',
        });
      }
    }

    let parsedStart = null;
    let parsedEnd = null;
    if (startDate) {
      parsedStart = new Date(startDate);
      if (isNaN(parsedStart.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid startDate format.',
        });
      }
    }
    if (endDate) {
      parsedEnd = new Date(endDate);
      if (isNaN(parsedEnd.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid endDate format.',
        });
      }
    }

    if (parsedStart && parsedEnd && parsedStart > parsedEnd) {
      return res.status(400).json({
        success: false,
        message: 'startDate must be earlier than or equal to endDate.',
      });
    }

    const training = await Training.create({
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      instructor: instructor.trim(),
      durationMinutes: durationNum,
      difficulty: diff,
      status: 'DRAFT',
      createdBy: req.user._id,
      enrollmentDeadline: parsedDeadline,
      startDate: parsedStart,
      endDate: parsedEnd,
    });

    const populated = await Training.findById(training._id).populate(
      'createdBy',
      'name email role'
    );

    return res.status(201).json({
      success: true,
      message: 'Training draft created successfully.',
      data: populated,
    });
  } catch (error) {
    console.error('Error in createTraining:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating training.',
    });
  }
};

/**
 * @route   GET /api/trainings
 * @desc    List authorized trainings with search, category, difficulty, status filters
 * @access  Private (HR: all statuses; Non-HR: published only)
 */
const getTrainings = async (req, res) => {
  try {
    const { page, limit, search, category, difficulty, status } = req.query;
    const filter = {};

    if (req.user.role === 'HR') {
      if (status && VALID_STATUSES.includes(status.toUpperCase())) {
        filter.status = status.toUpperCase();
      }
    } else {
      // Non-HR users strictly view published catalog entries
      filter.status = 'PUBLISHED';
    }

    if (category && typeof category === 'string' && category.trim()) {
      filter.category = { $regex: `^${category.trim()}$`, $options: 'i' };
    }

    if (difficulty && VALID_DIFFICULTIES.includes(difficulty.toUpperCase())) {
      filter.difficulty = difficulty.toUpperCase();
    }

    if (search && typeof search === 'string' && search.trim()) {
      const sanitized = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { title: { $regex: sanitized, $options: 'i' } },
        { description: { $regex: sanitized, $options: 'i' } },
        { instructor: { $regex: sanitized, $options: 'i' } },
        { category: { $regex: sanitized, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [total, trainings] = await Promise.all([
      Training.countDocuments(filter),
      Training.find(filter)
        .populate('createdBy', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
    ]);

    const totalPages = Math.ceil(total / limitNum) || 1;

    return res.status(200).json({
      success: true,
      data: trainings,
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
    console.error('Error in getTrainings:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving trainings.',
    });
  }
};

/**
 * @route   GET /api/trainings/:id
 * @desc    Get training details by ID
 * @access  Private (HR: all; Non-HR: published only)
 */
const getTrainingById = async (req, res) => {
  try {
    const training = await Training.findById(req.params.id).populate(
      'createdBy',
      'name email role'
    );

    if (!training) {
      return res.status(404).json({
        success: false,
        message: 'Training not found.',
      });
    }

    if (req.user.role !== 'HR' && training.status !== 'PUBLISHED') {
      return res.status(404).json({
        success: false,
        message: 'Training not found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: training,
    });
  } catch (error) {
    console.error('Error in getTrainingById:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving training.',
    });
  }
};

/**
 * @route   PATCH /api/trainings/:id
 * @desc    HR updates training details
 * @access  Private (HR only)
 */
const updateTraining = async (req, res) => {
  try {
    const training = await Training.findById(req.params.id);
    if (!training) {
      return res.status(404).json({
        success: false,
        message: 'Training not found.',
      });
    }

    if (training.status === 'ARCHIVED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot edit an archived training.',
      });
    }

    const {
      title,
      description,
      category,
      instructor,
      durationMinutes,
      difficulty,
      enrollmentDeadline,
      startDate,
      endDate,
    } = req.body;

    if (typeof title !== 'undefined') {
      if (!title || typeof title !== 'string' || title.trim().length < 3) {
        return res.status(400).json({
          success: false,
          message: 'Title must be at least 3 characters long.',
        });
      }
      training.title = title.trim();
    }

    if (typeof description !== 'undefined') {
      if (!description || typeof description !== 'string' || description.trim().length < 5) {
        return res.status(400).json({
          success: false,
          message: 'Description must be at least 5 characters long.',
        });
      }
      training.description = description.trim();
    }

    if (typeof category !== 'undefined') {
      if (!category || typeof category !== 'string' || category.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Category must be at least 2 characters long.',
        });
      }
      training.category = category.trim();
    }

    if (typeof instructor !== 'undefined') {
      if (!instructor || typeof instructor !== 'string' || instructor.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'Instructor must be at least 2 characters long.',
        });
      }
      training.instructor = instructor.trim();
    }

    if (typeof durationMinutes !== 'undefined') {
      const durationNum = parseInt(durationMinutes, 10);
      if (isNaN(durationNum) || durationNum <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Duration in minutes must be a positive integer.',
        });
      }
      training.durationMinutes = durationNum;
    }

    if (typeof difficulty !== 'undefined') {
      const upperDiff = difficulty.toString().toUpperCase().trim();
      if (!VALID_DIFFICULTIES.includes(upperDiff)) {
        return res.status(400).json({
          success: false,
          message: `Invalid difficulty. Must be one of: ${VALID_DIFFICULTIES.join(', ')}.`,
        });
      }
      training.difficulty = upperDiff;
    }

    if (typeof enrollmentDeadline !== 'undefined') {
      if (enrollmentDeadline === null || enrollmentDeadline === '') {
        training.enrollmentDeadline = null;
      } else {
        const parsed = new Date(enrollmentDeadline);
        if (isNaN(parsed.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid enrollmentDeadline date format.',
          });
        }
        training.enrollmentDeadline = parsed;
      }
    }

    if (typeof startDate !== 'undefined') {
      if (startDate === null || startDate === '') {
        training.startDate = null;
      } else {
        const parsed = new Date(startDate);
        if (isNaN(parsed.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid startDate format.',
          });
        }
        training.startDate = parsed;
      }
    }

    if (typeof endDate !== 'undefined') {
      if (endDate === null || endDate === '') {
        training.endDate = null;
      } else {
        const parsed = new Date(endDate);
        if (isNaN(parsed.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid endDate format.',
          });
        }
        training.endDate = parsed;
      }
    }

    if (training.startDate && training.endDate && training.startDate > training.endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate must be earlier than or equal to endDate.',
      });
    }

    await training.save();

    const populated = await Training.findById(training._id).populate(
      'createdBy',
      'name email role'
    );

    return res.status(200).json({
      success: true,
      message: 'Training updated successfully.',
      data: populated,
    });
  } catch (error) {
    console.error('Error in updateTraining:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error updating training.',
    });
  }
};

/**
 * @route   PATCH /api/trainings/:id/publish
 * @desc    HR publishes a draft training
 * @access  Private (HR only)
 */
const publishTraining = async (req, res) => {
  try {
    const training = await Training.findById(req.params.id);
    if (!training) {
      return res.status(404).json({
        success: false,
        message: 'Training not found.',
      });
    }

    if (training.status === 'PUBLISHED') {
      return res.status(400).json({
        success: false,
        message: 'Training is already published.',
      });
    }

    if (training.status === 'ARCHIVED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot publish an archived training.',
      });
    }

    const published = await Training.findOneAndUpdate(
      { _id: req.params.id, status: 'DRAFT' },
      { $set: { status: 'PUBLISHED' } },
      { new: true }
    ).populate('createdBy', 'name email role');

    if (!published) {
      return res.status(409).json({
        success: false,
        message: 'Conflict: Training is no longer in DRAFT status.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Training published successfully.',
      data: published,
    });
  } catch (error) {
    console.error('Error in publishTraining:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error publishing training.',
    });
  }
};

/**
 * @route   PATCH /api/trainings/:id/archive
 * @desc    HR archives a training
 * @access  Private (HR only)
 */
const archiveTraining = async (req, res) => {
  try {
    const training = await Training.findById(req.params.id);
    if (!training) {
      return res.status(404).json({
        success: false,
        message: 'Training not found.',
      });
    }

    if (training.status === 'ARCHIVED') {
      return res.status(400).json({
        success: false,
        message: 'Training is already archived.',
      });
    }

    const archived = await Training.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: 'ARCHIVED' } },
      { $set: { status: 'ARCHIVED' } },
      { new: true }
    ).populate('createdBy', 'name email role');

    if (!archived) {
      return res.status(409).json({
        success: false,
        message: 'Training has already been archived.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Training archived successfully.',
      data: archived,
    });
  } catch (error) {
    console.error('Error in archiveTraining:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error archiving training.',
    });
  }
};

/**
 * @route   POST /api/trainings/:id/enroll
 * @desc    Employee enrolls in a published training
 * @access  Private (All authenticated employees)
 */
const enrollInTraining = async (req, res) => {
  try {
    const training = await Training.findById(req.params.id);
    if (!training) {
      return res.status(404).json({
        success: false,
        message: 'Training not found.',
      });
    }

    // Only PUBLISHED trainings can accept new enrollments
    if (training.status !== 'PUBLISHED') {
      return res.status(400).json({
        success: false,
        message: `Cannot enroll: Training is ${training.status.toLowerCase()}. Only published trainings accept enrollments.`,
      });
    }

    const now = new Date();

    // Check enrollment deadline if set
    if (training.enrollmentDeadline && now > training.enrollmentDeadline) {
      return res.status(400).json({
        success: false,
        message: 'Enrollment deadline has passed for this training.',
      });
    }

    // Check conclusion date if set
    if (training.endDate && now > training.endDate) {
      return res.status(400).json({
        success: false,
        message: 'This training has already concluded.',
      });
    }

    // Check for existing enrollment record
    const existing = await TrainingEnrollment.findOne({
      training: training._id,
      employee: req.user._id,
    });

    if (existing) {
      if (['ENROLLED', 'IN_PROGRESS', 'COMPLETED'].includes(existing.status)) {
        return res.status(409).json({
          success: false,
          message: `You are already enrolled in this training (status: ${existing.status}).`,
        });
      }

      // Re-enroll if previously cancelled
      if (existing.status === 'CANCELLED') {
        existing.status = 'ENROLLED';
        existing.enrolledAt = now;
        existing.completedAt = null;
        await existing.save();

        const populated = await TrainingEnrollment.findById(existing._id)
          .populate('training', 'title category durationMinutes difficulty')
          .populate('employee', 'name email department designation');

        return res.status(200).json({
          success: true,
          message: 'Re-enrolled in training successfully.',
          data: populated,
        });
      }
    }

    const enrollment = await TrainingEnrollment.create({
      training: training._id,
      employee: req.user._id,
      status: 'ENROLLED',
      enrolledAt: now,
      completedAt: null,
    });

    const populated = await TrainingEnrollment.findById(enrollment._id)
      .populate('training', 'title category durationMinutes difficulty')
      .populate('employee', 'name email department designation');

    return res.status(201).json({
      success: true,
      message: 'Enrolled in training successfully.',
      data: populated,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate enrollment: You are already enrolled in this training.',
      });
    }

    console.error('Error in enrollInTraining:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error while enrolling in training.',
    });
  }
};

/**
 * @route   GET /api/trainings/me/enrollments
 * @desc    Employee views their own enrollments
 * @access  Private (All authenticated employees)
 */
const getMyEnrollments = async (req, res) => {
  try {
    const { page, limit, status } = req.query;
    const filter = { employee: req.user._id };

    if (status) {
      filter.status = status.toUpperCase().trim();
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [total, enrollments] = await Promise.all([
      TrainingEnrollment.countDocuments(filter),
      TrainingEnrollment.find(filter)
        .populate('training', 'title description category instructor durationMinutes difficulty status')
        .sort({ enrolledAt: -1 })
        .skip(skip)
        .limit(limitNum),
    ]);

    const totalPages = Math.ceil(total / limitNum) || 1;

    return res.status(200).json({
      success: true,
      data: enrollments,
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
    console.error('Error in getMyEnrollments:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving your enrollments.',
    });
  }
};

/**
 * @route   GET /api/trainings/:id/enrollments
 * @desc    HR views all enrollments; Managers only view direct reports
 * @access  Private (HR or authorized MANAGER)
 */
const getTrainingEnrollments = async (req, res) => {
  try {
    if (req.user.role === 'EMPLOYEE') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Employees cannot view training enrollment rosters. Use /api/trainings/me/enrollments.',
      });
    }

    const training = await Training.findById(req.params.id);
    if (!training) {
      return res.status(404).json({
        success: false,
        message: 'Training not found.',
      });
    }

    const { page, limit, status } = req.query;
    const filter = { training: training._id };

    if (req.user.role === 'MANAGER') {
      const directReports = await User.find({ manager: req.user._id }).select('_id');
      const reportIds = directReports.map((d) => d._id);
      filter.employee = { $in: reportIds };
    }

    if (status) {
      filter.status = status.toUpperCase().trim();
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [total, enrollments] = await Promise.all([
      TrainingEnrollment.countDocuments(filter),
      TrainingEnrollment.find(filter)
        .populate('employee', 'name email department designation manager')
        .populate('training', 'title category')
        .sort({ enrolledAt: -1 })
        .skip(skip)
        .limit(limitNum),
    ]);

    const totalPages = Math.ceil(total / limitNum) || 1;

    return res.status(200).json({
      success: true,
      data: enrollments,
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
    console.error('Error in getTrainingEnrollments:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving training enrollments.',
    });
  }
};

/**
 * @route   PATCH /api/trainings/:id/enrollments/:enrollmentId/progress
 * @desc    Employee updates their own progress status
 * @access  Private (Owner employee only)
 */
const updateProgress = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || typeof status !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Status is required to update progress.',
      });
    }

    const targetStatus = status.toUpperCase().trim();

    const enrollment = await TrainingEnrollment.findOne({
      _id: req.params.enrollmentId,
      training: req.params.id,
    });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        message: 'Training enrollment record not found.',
      });
    }

    // Must be the owner employee
    if (enrollment.employee.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You can only update your own enrollment progress.',
      });
    }

    // Validate state transition
    const allowedNext = ALLOWED_PROGRESS_TRANSITIONS[enrollment.status] || [];
    if (!allowedNext.includes(targetStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid progress transition from ${enrollment.status} to ${targetStatus}.`,
      });
    }

    enrollment.status = targetStatus;
    if (targetStatus === 'COMPLETED') {
      enrollment.completedAt = new Date();
    }

    await enrollment.save();

    const populated = await TrainingEnrollment.findById(enrollment._id)
      .populate('training', 'title category durationMinutes difficulty')
      .populate('employee', 'name email department designation');

    return res.status(200).json({
      success: true,
      message: `Training progress updated to ${targetStatus}.`,
      data: populated,
    });
  } catch (error) {
    console.error('Error in updateProgress:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error updating training progress.',
    });
  }
};

module.exports = {
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
};
