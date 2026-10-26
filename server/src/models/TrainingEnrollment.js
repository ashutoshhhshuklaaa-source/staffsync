const mongoose = require('mongoose');

const trainingEnrollmentSchema = new mongoose.Schema(
  {
    training: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Training',
      required: [true, 'Training reference is required'],
      index: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Employee reference is required'],
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ['ENROLLED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
        message: '{VALUE} is not a valid enrollment status',
      },
      default: 'ENROLLED',
      index: true,
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// CRITICAL CONSTRAINT: Exactly one enrollment per employee per training
trainingEnrollmentSchema.index({ training: 1, employee: 1 }, { unique: true });

trainingEnrollmentSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

trainingEnrollmentSchema.set('toObject', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('TrainingEnrollment', trainingEnrollmentSchema);
