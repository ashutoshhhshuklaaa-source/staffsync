const path = require('path');

// Load environment variables from .env file located in server directory
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Validate required environment variables before starting
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('Fatal Startup Error: Missing required environment variable: MONGO_URI (or MONGODB_URI)');
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error('Fatal Startup Error: Missing required environment variable: JWT_SECRET');
  process.exit(1);
}

const mongoose = require('mongoose');
const app = require('./src/app');
const connectDB = require('./src/config/db');

// Configure port with fallback to 5000
const PORT = process.env.PORT || 5000;

/**
 * Start the backend server.
 * Connects to MongoDB first, and only begins listening if connection succeeds.
 */
const startServer = async () => {
  try {
    // Connect to MongoDB (exits process with code 1 if connection fails)
    await connectDB();

    // Start Express server after successful DB connection
    const server = app.listen(PORT, () => {
      console.log(`==============================================`);
      console.log(` StaffSync API running on: http://localhost:${PORT}`);
      console.log(` Health check endpoint:   http://localhost:${PORT}/api/health`);
      console.log(` Auth endpoints base:     http://localhost:${PORT}/api/auth`);
      console.log(`==============================================`);
    });

    // Handle graceful shutdown
    const handleShutdown = (signal) => {
      console.log(`\nReceived ${signal}. Closing server gracefully...`);
      // Force exit after 10s if graceful shutdown hangs
      setTimeout(() => {
        console.error('Shutdown timed out. Terminating forcefully.');
        process.exit(1);
      }, 10000).unref();

      server.close(async () => {
        try {
          await mongoose.connection.close();
          console.log('MongoDB connection closed.');
        } catch (err) {
          console.error('Error closing MongoDB connection:', err.message);
        }
        console.log('Server terminated cleanly.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

startServer();
