const mongoose = require('mongoose');
const User = require('../models/User');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @route   GET /api/employees
 * @desc    List employees with pagination, search, and filtering
 * @access  Private (HR: all employees; MANAGER: authorized reporting scope)
 */
const getEmployees = async (req, res) => {
  try {
    const { page, limit, search, department, role, isActive } = req.query;

    const filter = {};

    // RBAC Scope Enforcement
    if (req.user.role === 'HR') {
      // HR can view all employees
    } else if (req.user.role === 'MANAGER') {
      // Managers can only view employees in their direct reporting line
      filter.manager = req.user._id;
    } else {
      // Employees cannot view general employee listings
      return res.status(403).json({
        success: false,
        message: 'Access denied: Employees cannot list all employees. Use /api/employees/me.',
      });
    }

    // Search by name or email (case-insensitive)
    if (search && typeof search === 'string' && search.trim()) {
      const sanitizedSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { name: { $regex: sanitizedSearch, $options: 'i' } },
        { email: { $regex: sanitizedSearch, $options: 'i' } },
      ];
    }

    // Filter by department (case-insensitive exact match)
    if (department && typeof department === 'string' && department.trim()) {
      filter.department = { $regex: `^${department.trim()}$`, $options: 'i' };
    }

    // Filter by role
    if (role && typeof role === 'string') {
      const upperRole = role.toUpperCase().trim();
      if (['HR', 'MANAGER', 'EMPLOYEE'].includes(upperRole)) {
        filter.role = upperRole;
      }
    }

    // Filter by active status
    if (typeof isActive !== 'undefined') {
      if (isActive === 'true' || isActive === true) {
        filter.isActive = true;
      } else if (isActive === 'false' || isActive === false) {
        filter.isActive = false;
      }
    }

    // Pagination setup
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [total, employees] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .populate('manager', 'name email designation department')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
    ]);

    const totalPages = Math.ceil(total / limitNum) || 1;

    return res.status(200).json({
      success: true,
      data: employees,
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
    console.error('Error in getEmployees:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving employees.',
    });
  }
};

/**
 * @route   GET /api/employees/me
 * @desc    Get current employee self profile
 * @access  Private (All authenticated roles)
 */
const getEmployeeMe = async (req, res) => {
  try {
    const employee = await User.findById(req.user._id).populate(
      'manager',
      'name email designation department'
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee record not found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: employee,
    });
  } catch (error) {
    console.error('Error in getEmployeeMe:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving current employee profile.',
    });
  }
};

/**
 * @route   GET /api/employees/:id
 * @desc    Get employee by ID
 * @access  Private (HR: any; MANAGER: within team or self; EMPLOYEE: self only)
 */
const getEmployeeById = async (req, res) => {
  try {
    const employee = await User.findById(req.params.id).populate(
      'manager',
      'name email designation department'
    );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found.',
      });
    }

    // Permission check
    const isSelf = employee._id.toString() === req.user._id.toString();

    if (req.user.role === 'HR') {
      // HR can view any employee
    } else if (req.user.role === 'MANAGER') {
      // Manager can view self or their direct reports
      const isDirectReport =
        employee.manager &&
        employee.manager._id.toString() === req.user._id.toString();

      if (!isSelf && !isDirectReport) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You are not authorized to view employees outside your team.',
        });
      }
    } else {
      // Employee can view only their own record
      if (!isSelf) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You can only view your own employee profile.',
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: employee,
    });
  } catch (error) {
    console.error('Error in getEmployeeById:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error retrieving employee.',
    });
  }
};

/**
 * @route   POST /api/employees
 * @desc    Create a new employee record
 * @access  Private (HR only)
 */
const createEmployee = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      department,
      designation,
      joiningDate,
      phone,
      manager,
      role,
    } = req.body;

    // Validate name
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Name is required and must be at least 2 characters.',
      });
    }

    if (name.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Name cannot exceed 100 characters.',
      });
    }

    // Validate email
    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check duplicate email
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    // Validate role if supplied
    let assignedRole = 'EMPLOYEE';
    if (role) {
      const upperRole = role.toString().toUpperCase().trim();
      if (!['HR', 'MANAGER', 'EMPLOYEE'].includes(upperRole)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role specified. Must be HR, MANAGER, or EMPLOYEE.',
        });
      }
      assignedRole = upperRole;
    }

    // Validate password if supplied
    if (password && (typeof password !== 'string' || password.length < 6)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long if provided.',
      });
    }

    // Validate manager if supplied
    let managerId = null;
    if (manager) {
      if (
        !mongoose.Types.ObjectId.isValid(manager) ||
        new mongoose.Types.ObjectId(manager).toString() !== manager
      ) {
        return res.status(400).json({
          success: false,
          message: 'Invalid manager ID format.',
        });
      }

      const managerUser = await User.findById(manager);
      if (!managerUser) {
        return res.status(400).json({
          success: false,
          message: 'Designated manager does not exist.',
        });
      }
      managerId = manager;
    }

    const newEmployee = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: password || 'StaffSync@2026', // Secure default temporary password if omitted
      department: department && typeof department === 'string' ? department.trim() : '',
      designation: designation && typeof designation === 'string' ? designation.trim() : '',
      joiningDate: joiningDate ? new Date(joiningDate) : Date.now(),
      phone: phone && typeof phone === 'string' ? phone.trim() : '',
      manager: managerId,
      role: assignedRole,
      isActive: true,
    });

    // Populate manager reference before returning
    const populated = await User.findById(newEmployee._id).populate(
      'manager',
      'name email designation department'
    );

    return res.status(201).json({
      success: true,
      message: 'Employee created successfully.',
      data: populated,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join('. '),
      });
    }

    console.error('Error in createEmployee:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error creating employee record.',
    });
  }
};

/**
 * @route   PATCH /api/employees/:id
 * @desc    Update employee details
 * @access  Private (HR: full update; EMPLOYEE/MANAGER: self-service allowed fields only)
 */
const updateEmployee = async (req, res) => {
  try {
    const employee = await User.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found.',
      });
    }

    const isSelf = employee._id.toString() === req.user._id.toString();

    // Enforce role-based editing restrictions
    if (req.user.role !== 'HR') {
      // Non-HR can only edit their own profile
      if (!isSelf) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You can only update your own profile.',
        });
      }

      // Check if non-HR is attempting to modify restricted fields
      const restrictedFields = [
        'role',
        'isActive',
        'department',
        'designation',
        'email',
        'manager',
        'joiningDate',
        'password',
      ];

      const attemptedRestricted = restrictedFields.filter((field) =>
        Object.prototype.hasOwnProperty.call(req.body, field)
      );

      if (attemptedRestricted.length > 0) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: You do not have permission to modify restricted fields (${attemptedRestricted.join(
            ', '
          )}).`,
        });
      }

      // Allowed self-service updates
      if (req.body.name && typeof req.body.name === 'string') {
        if (req.body.name.trim().length < 2) {
          return res.status(400).json({
            success: false,
            message: 'Name must be at least 2 characters long.',
          });
        }
        employee.name = req.body.name.trim();
      }

      if (typeof req.body.phone !== 'undefined') {
        employee.phone =
          typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
      }
    } else {
      // HR can update all permitted employee fields
      const {
        name,
        email,
        department,
        designation,
        joiningDate,
        phone,
        manager,
        role,
      } = req.body;

      if (typeof name !== 'undefined') {
        if (!name || typeof name !== 'string' || name.trim().length < 2) {
          return res.status(400).json({
            success: false,
            message: 'Name must be at least 2 characters long.',
          });
        }
        employee.name = name.trim();
      }

      if (typeof email !== 'undefined') {
        if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
          return res.status(400).json({
            success: false,
            message: 'Please provide a valid email address.',
          });
        }

        const normalizedEmail = email.toLowerCase().trim();
        if (normalizedEmail !== employee.email) {
          const existing = await User.findOne({ email: normalizedEmail });
          if (existing && existing._id.toString() !== employee._id.toString()) {
            return res.status(409).json({
              success: false,
              message: 'An account with this email address already exists.',
            });
          }
          employee.email = normalizedEmail;
        }
      }

      if (typeof department !== 'undefined') {
        employee.department =
          typeof department === 'string' ? department.trim() : '';
      }

      if (typeof designation !== 'undefined') {
        employee.designation =
          typeof designation === 'string' ? designation.trim() : '';
      }

      if (typeof joiningDate !== 'undefined') {
        const parsedDate = new Date(joiningDate);
        if (isNaN(parsedDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'Invalid joiningDate format.',
          });
        }
        employee.joiningDate = parsedDate;
      }

      if (typeof phone !== 'undefined') {
        employee.phone = typeof phone === 'string' ? phone.trim() : '';
      }

      if (typeof role !== 'undefined') {
        const upperRole = role.toString().toUpperCase().trim();
        if (!['HR', 'MANAGER', 'EMPLOYEE'].includes(upperRole)) {
          return res.status(400).json({
            success: false,
            message: 'Invalid role specified. Must be HR, MANAGER, or EMPLOYEE.',
          });
        }
        employee.role = upperRole;
      }

      if (typeof manager !== 'undefined') {
        if (!manager || manager === null || manager === '') {
          employee.manager = null;
        } else {
          if (
            !mongoose.Types.ObjectId.isValid(manager) ||
            new mongoose.Types.ObjectId(manager).toString() !== manager
          ) {
            return res.status(400).json({
              success: false,
              message: 'Invalid manager ID format.',
            });
          }

          if (manager === employee._id.toString()) {
            return res.status(400).json({
              success: false,
              message: 'An employee cannot be assigned as their own manager.',
            });
          }

          const managerExists = await User.findById(manager);
          if (!managerExists) {
            return res.status(400).json({
              success: false,
              message: 'Assigned manager does not exist.',
            });
          }

          employee.manager = manager;
        }
      }
    }

    await employee.save();

    const updated = await User.findById(employee._id).populate(
      'manager',
      'name email designation department'
    );

    return res.status(200).json({
      success: true,
      message: 'Employee updated successfully.',
      data: updated,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    console.error('Error in updateEmployee:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error updating employee.',
    });
  }
};

/**
 * @route   PATCH /api/employees/:id/status
 * @desc    Activate or deactivate an employee record
 * @access  Private (HR only)
 */
const updateEmployeeStatus = async (req, res) => {
  try {
    const employee = await User.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found.',
      });
    }

    let newStatus;
    if (typeof req.body.isActive === 'boolean') {
      newStatus = req.body.isActive;
    } else if (typeof req.body.status === 'string') {
      const s = req.body.status.toLowerCase().trim();
      if (s === 'active') newStatus = true;
      else if (s === 'inactive') newStatus = false;
    }

    if (typeof newStatus !== 'boolean') {
      return res.status(400).json({
        success: false,
        message:
          'Please provide a valid status: isActive (boolean) or status ("active" | "inactive").',
      });
    }

    // Prevent HR from accidentally deactivating their own account
    if (employee._id.toString() === req.user._id.toString() && !newStatus) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own administrative account.',
      });
    }

    employee.isActive = newStatus;
    await employee.save();

    const updated = await User.findById(employee._id).populate(
      'manager',
      'name email designation department'
    );

    return res.status(200).json({
      success: true,
      message: `Employee successfully ${newStatus ? 'activated' : 'deactivated'}.`,
      data: updated,
    });
  } catch (error) {
    console.error('Error in updateEmployeeStatus:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error updating employee status.',
    });
  }
};

module.exports = {
  getEmployees,
  getEmployeeMe,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  updateEmployeeStatus,
};
