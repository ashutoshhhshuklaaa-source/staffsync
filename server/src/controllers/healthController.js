const mongoose = require('mongoose');

/**
 * Controller to check server and database health status
 * @route GET /api/health
 */
const getHealthStatus = (req, res) => {
  // Mongoose readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  const dbStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const readyState = mongoose.connection.readyState;
  const isDbConnected = readyState === 1;

  res.status(isDbConnected ? 200 : 503).json({
    status: isDbConnected ? 'ok' : 'degraded',
    server: 'running',
    database: {
      status: dbStates[readyState] || 'unknown',
      readyState: readyState,
      name: mongoose.connection.name || null,
      host: process.env.NODE_ENV === 'production' ? 'protected' : (mongoose.connection.host || null),
    },
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime())
  });
};

module.exports = {
  getHealthStatus
};
