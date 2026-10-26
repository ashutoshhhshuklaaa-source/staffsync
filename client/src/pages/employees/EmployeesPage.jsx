import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  Plus,
  Edit2,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Mail,
  Phone,
  Briefcase,
  Building,
  UserCheck,
  UserX,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { employeeAPI } from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Pagination } from '../../components/common/Pagination';
import { LoadingSpinner, TableSkeleton } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';

export const EmployeesPage = () => {
  const { user, isHR, isManager } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Form states
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    password: '',
    department: 'Engineering',
    designation: '',
    role: 'EMPLOYEE',
    phone: '',
  });

  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    department: '',
    designation: '',
    role: '',
    phone: '',
  });

  const fetchEmployees = async () => {
    try {
      setLoading(true);

      // If user is Employee (non-HR, non-Manager), fetch own profile
      if (!isHR && !isManager) {
        const res = await employeeAPI.getMe();
        if (res.data?.success && res.data?.data) {
          setEmployees([res.data.data]);
          setPagination({ page: 1, pages: 1, total: 1, limit: 10, hasNextPage: false, hasPrevPage: false });
        }
        return;
      }

      // HR or Manager scoped search
      const params = {
        page,
        limit: 10,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(department ? { department } : {}),
        ...(roleFilter ? { role: roleFilter } : {}),
      };

      const res = await employeeAPI.getAll(params);
      if (res.data?.success) {
        setEmployees(res.data.data || []);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to load employee directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [page, department, roleFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchEmployees();
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Handle Add Employee (HR only)
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      setFormSubmitting(true);
      const res = await employeeAPI.create(newEmployee);
      if (res.data?.success) {
        toastSuccess('Employee created successfully!');
        setCreateModalOpen(false);
        setNewEmployee({
          name: '',
          email: '',
          password: '',
          department: 'Engineering',
          designation: '',
          role: 'EMPLOYEE',
          phone: '',
        });
        fetchEmployees();
      }
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to create employee');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (emp) => {
    setSelectedEmployee(emp);
    setEditForm({
      name: emp.name || '',
      email: emp.email || '',
      department: emp.department || '',
      designation: emp.designation || '',
      role: emp.role || 'EMPLOYEE',
      phone: emp.phone || '',
    });
    setEditModalOpen(true);
  };

  // Handle Update Employee
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedEmployee) return;

    try {
      setFormSubmitting(true);
      const res = await employeeAPI.update(selectedEmployee._id, editForm);
      if (res.data?.success) {
        toastSuccess('Employee profile updated!');
        setEditModalOpen(false);
        fetchEmployees();
      }
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to update employee');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Toggle Active/Inactive Status (HR only)
  const handleToggleStatus = async (emp) => {
    const nextStatus = !emp.isActive;
    const action = nextStatus ? 'activate' : 'deactivate';

    if (!window.confirm(`Are you sure you want to ${action} ${emp.name}?`)) {
      return;
    }

    try {
      const res = await employeeAPI.updateStatus(emp._id, { isActive: nextStatus });
      if (res.data?.success) {
        toastSuccess(`Employee ${action}d successfully`);
        fetchEmployees();
      }
    } catch (err) {
      toastError(err.response?.data?.message || `Failed to ${action} employee`);
    }
  };

  const departments = [
    'Engineering',
    'Product',
    'Design',
    'Human Resources',
    'Finance',
    'Marketing',
    'Sales',
    'Operations',
  ];

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Employee Directory
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {isHR
              ? 'Manage organization profiles, assignments, and account statuses'
              : isManager
              ? 'View direct reports and team member details'
              : 'Your employee profile details'}
          </p>
        </div>

        {isHR && (
          <button
            onClick={() => setCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Employee</span>
          </button>
        )}
      </div>

      {/* Filter bar (HR & Manager only) */}
      {(isHR || isManager) && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <select
              value={department}
              onChange={(e) => {
                setDepartment(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Roles</option>
              <option value="EMPLOYEE">Employee</option>
              <option value="MANAGER">Manager</option>
              <option value="HR">HR</option>
            </select>
          </div>
        </div>
      )}

      {/* Employee Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : employees.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No employees found"
            description="No profiles match the search parameters or filter criteria."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-3.5">Employee</th>
                  <th className="px-6 py-3.5">Department & Role</th>
                  <th className="px-6 py-3.5">Manager</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {employees.map((emp) => (
                  <tr key={emp._id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Employee Profile */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs border border-blue-200">
                          {emp.name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{emp.name}</div>
                          <div className="text-slate-500 text-[11px] flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3" />
                            <span>{emp.email}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Department & Role */}
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">
                        {emp.designation || 'Specialist'}
                      </div>
                      <div className="text-slate-500 text-[11px] mt-0.5">
                        {emp.department || 'General'} &bull;{' '}
                        <Badge variant={emp.role} size="sm">
                          {emp.role}
                        </Badge>
                      </div>
                    </td>

                    {/* Manager */}
                    <td className="px-6 py-4 text-slate-600">
                      {emp.manager ? (
                        <span>{emp.manager.name}</span>
                      ) : (
                        <span className="text-slate-400 italic">None assigned</span>
                      )}
                    </td>

                    {/* Account Status */}
                    <td className="px-6 py-4">
                      <Badge variant={emp.isActive ? 'ACTIVE' : 'INACTIVE'} size="sm">
                        {emp.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Edit Button (HR or Self) */}
                        {(isHR || emp._id === user?._id) && (
                          <button
                            onClick={() => openEditModal(emp)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Edit details"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Deactivate / Activate Button (HR only, cannot deactivate self) */}
                        {isHR && emp._id !== user?._id && (
                          <button
                            onClick={() => handleToggleStatus(emp)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              emp.isActive
                                ? 'text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                                : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={emp.isActive ? 'Deactivate account' : 'Activate account'}
                          >
                            {emp.isActive ? (
                              <UserX className="w-4 h-4" />
                            ) : (
                              <UserCheck className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <Pagination pagination={pagination} onPageChange={(p) => setPage(p)} />
      </div>

      {/* Modal: Add New Employee (HR Only) */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Add New Employee"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={newEmployee.name}
              onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
              placeholder="e.g. Rachel Adams"
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Work Email</label>
            <input
              type="email"
              required
              value={newEmployee.email}
              onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
              placeholder="rachel.adams@company.com"
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Temporary Password (optional)
            </label>
            <input
              type="password"
              value={newEmployee.password}
              onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
              placeholder="Leave empty for default"
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
              <select
                value={newEmployee.department}
                onChange={(e) => setNewEmployee({ ...newEmployee, department: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Designation</label>
              <input
                type="text"
                value={newEmployee.designation}
                onChange={(e) => setNewEmployee({ ...newEmployee, designation: e.target.value })}
                placeholder="e.g. Senior Specialist"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">System Role</label>
              <select
                value={newEmployee.role}
                onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="EMPLOYEE">Employee</option>
                <option value="MANAGER">Manager</option>
                <option value="HR">HR</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={newEmployee.phone}
                onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                placeholder="+1 555-0199"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50"
            >
              {formSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Employee</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Employee Profile */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title={`Edit Profile: ${selectedEmployee?.name}`}
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {isHR && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Work Email</label>
              <input
                type="email"
                required
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {isHR && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                <select
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Designation</label>
                <input
                  type="text"
                  value={editForm.designation}
                  onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {isHR && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
              <select
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="EMPLOYEE">Employee</option>
                <option value="MANAGER">Manager</option>
                <option value="HR">HR</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
            <input
              type="text"
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50"
            >
              {formSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <span>Update Profile</span>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default EmployeesPage;
