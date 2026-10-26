const mongoose = require('mongoose');

/**
 * Connect to MongoDB Community Server or MongoDB Atlas using Mongoose.
 * Exits the process with a non-zero exit code if connection fails.
 */
const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!mongoUri) {
    console.error('Fatal Error: MONGO_URI (or MONGODB_URI) is not defined in environment variables.');
    process.exit(1);
  }

  // Register connection event listeners once
  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB connection lost. Attempting reconnection...');
  });

  mongoose.connection.on('error', (err) => {
    console.error(`MongoDB runtime connection error: ${err.message}`);
  });

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    // Exit process with failure code
    process.exit(1);
  }
};

module.exports = connectDB;
