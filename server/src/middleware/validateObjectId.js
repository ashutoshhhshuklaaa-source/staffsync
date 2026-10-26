const mongoose = require('mongoose');

/**
 * Middleware to validate MongoDB ObjectId parameter format.
 * Rejects invalid ObjectId strings with 400 Bad Request before database queries.
 *
 * @param {string} paramName - Name of the route parameter (defaults to 'id')
 */
const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];

    if (
      !id ||
      !mongoose.Types.ObjectId.isValid(id) ||
      new mongoose.Types.ObjectId(id).toString() !== id
    ) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${paramName} format. Must be a valid 24-character hexadecimal ID.`,
      });
    }

    next();
  };
};

module.exports = validateObjectId;
