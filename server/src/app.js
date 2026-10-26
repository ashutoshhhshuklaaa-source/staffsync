const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const trainingRoutes = require('./routes/trainingRoutes');

const app = express();

// ==========================================
// Security & Middleware Configuration
// ==========================================

// HTTP Security Headers using Helmet
app.use(helmet());

// Enable CORS for frontend clients (supporting single, wildcard, or comma-separated origins)
const clientUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
const allowedOrigins = clientUrl.split(',').map((url) => url.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (such as server-to-server, curl, or Postman)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes('*') ||
        allowedOrigins.indexOf(origin) !== -1 ||
        allowedOrigins.includes(origin)
      ) {
        return callback(null, true);
      }
      return callback(new Error('Blocked by CORS policy: Origin not allowed.'));
    },
    credentials: true,
  })
);

// Rate limiting for sensitive authentication endpoints (brute-force defense)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 300, // Limit each IP to 300 requests per 15 minutes (generous for tests, effective in production)
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.',
  },
  skip: () => process.env.NODE_ENV === 'test',
});

// JSON request parsing middleware with 1mb body limit against payload DoS
app.use(express.json({ limit: '1mb' }));

// URL-encoded data parsing middleware with 1mb limit
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Apply rate limiting specifically on auth endpoints
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Handle malformed JSON request bodies safely
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Malformed JSON payload in request body.',
    });
  }
  next(err);
});

// ==========================================
// API Routes
// ==========================================

// Health check route: GET /api/health
app.use('/api/health', healthRoutes);

// Authentication routes: /api/auth
app.use('/api/auth', authRoutes);

// Employee management routes: /api/employees
app.use('/api/employees', employeeRoutes);

// Leave management routes: /api/leaves
app.use('/api/leaves', leaveRoutes);

// Attendance management routes: /api/attendance
app.use('/api/attendance', attendanceRoutes);

// Announcements routes: /api/announcements
app.use('/api/announcements', announcementRoutes);

// Training & Development routes: /api/trainings
app.use('/api/trainings', trainingRoutes);

// Root fallback route
app.get('/', (req, res) => {
  res.json({
    message: 'StaffSync HRMS API is running',
    healthCheck: '/api/health',
    authEndpoints: '/api/auth',
    employeeEndpoints: '/api/employees',
    leaveEndpoints: '/api/leaves',
    attendanceEndpoints: '/api/attendance',
    announcementEndpoints: '/api/announcements',
    trainingEndpoints: '/api/trainings'
  });
});

// 404 Not Found Handler
app.use((req, res) => {
  res.status(404).json({
    status: 'fail',
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  if (err.message && err.message.startsWith('Blocked by CORS policy')) {
    return res.status(403).json({
      success: false,
      message: err.message,
    });
  }

  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({
      status: 'error',
      success: false,
      message: 'Payload Too Large: Request body exceeds the allowed limit (1MB).',
    });
  }

  console.error('Server error:', err.stack || err.message);
  res.status(err.status || 500).json({
    status: 'error',
    success: false,
    message: 'Internal server error'
  });
});

module.exports = app;
