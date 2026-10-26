/**
 * Role-based access control (RBAC) middleware.
 * Verifies that the authenticated user possesses one of the required roles.
 *
 * @param {...string|string[]} roles - Permitted roles (e.g. 'HR', 'MANAGER')
 */
const requireRole = (...roles) => {
  // Flatten if passed as an array e.g. requireRole(['HR', 'MANAGER'])
  const allowedRoles = roles.flat();

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required before role verification.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access requires one of the following roles: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
};

module.exports = {
  requireRole,
  authorize: requireRole, // Alias for convenience
};
