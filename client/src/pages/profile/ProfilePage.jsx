import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  Briefcase,
  Calendar,
  ShieldCheck,
  Building2,
  UserCheck,
  Edit3,
  CheckCircle2,
  Lock,
  Globe,
  Clock,
  Layers,
} from 'lucide-react';
import { employeeAPI, leaveAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import LoadingSpinner from '../../components/common/LoadingSpinner';

export default function ProfilePage() {
  const { user, updateCurrentUser } = useAuth();
  const { showSuccess, showError } = useToast();

  const [profile, setProfile] = useState(null);
  const [balances, setBalances] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Edit form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
  });

  const fetchProfileAndBalances = async () => {
    try {
      setLoading(true);
      const [profileRes, balanceRes] = await Promise.allSettled([
        employeeAPI.getMe(),
        leaveAPI.getMyBalance(),
      ]);

      if (profileRes.status === 'fulfilled' && profileRes.value.data.success) {
        const p = profileRes.value.data.data;
        setProfile(p);
        setFormData({
          name: p.name || '',
          phone: p.phone || '',
        });
      }

      if (balanceRes.status === 'fulfilled' && balanceRes.value.data.success) {
        const balObj = balanceRes.value.data.data?.balances || balanceRes.value.data.data;
        setBalances(balObj);
      }
    } catch (err) {
      showError('Failed to load profile details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileAndBalances();
  }, []);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!profile) return;
    try {
      setSubmitting(true);
      const res = await employeeAPI.update(profile._id, {
        name: formData.name,
        phone: formData.phone || undefined,
      });

      if (res.data.success) {
        showSuccess('Profile updated successfully!');
        setProfile(res.data.data);
        setShowEditModal(false);
        updateCurrentUser(res.data.data);
      }
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <LoadingSpinner size="lg" text="Loading employee profile..." />
      </div>
    );
  }

  const p = profile || user || {};

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner / Hero Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Cover gradient */}
        <div className="h-32 bg-gradient-to-r from-brand-700 via-brand-600 to-indigo-700 relative" />

        <div className="px-6 pb-6 pt-0 relative flex flex-col sm:flex-row items-center sm:items-end justify-between gap-4 -mt-12">
          {/* Avatar and Main Info */}
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 text-center sm:text-left">
            <div className="w-24 h-24 rounded-2xl bg-white p-1 shadow-md">
              <div className="w-full h-full rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white text-3xl font-extrabold uppercase shadow-inner">
                {p.name?.charAt(0) || 'U'}
              </div>
            </div>
            <div className="mb-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h1 className="text-2xl font-bold text-slate-900">{p.name}</h1>
                <Badge variant={p.role}>{p.role}</Badge>
                <Badge variant={p.isActive ? 'ACTIVE' : 'INACTIVE'}>
                  {p.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <p className="text-sm text-slate-500 mt-0.5">
                {p.designation || 'Staff Member'} &bull; {p.department || 'General'}
              </p>
            </div>
          </div>

          {/* Edit Profile button */}
          <button
            onClick={() => setShowEditModal(true)}
            className="btn btn-secondary inline-flex items-center gap-2 text-xs shadow-sm"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit Profile
          </button>
        </div>
      </div>

      {/* Main Grid: Details & Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Personal & Employment Details (2 cols on md) */}
        <div className="md:col-span-2 space-y-6">
          {/* Contact & Personal Information */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
              <User className="w-4 h-4 text-brand-600" />
              Personal & Contact Information
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs text-slate-400 block mb-1">Full Legal Name</span>
                <span className="font-medium text-slate-800">{p.name || '—'}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block mb-1">Email Address</span>
                <span className="font-medium text-slate-800 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {p.email || '—'}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block mb-1">Contact Phone</span>
                <span className="font-medium text-slate-800 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {p.phone || 'Not provided'}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block mb-1">System User ID</span>
                <span className="font-mono text-xs text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-200 inline-block">
                  {p._id || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Organization & Employment Details */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-brand-600" />
              Organizational Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs text-slate-400 block mb-1">Department</span>
                <span className="font-medium text-slate-800 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  {p.department || '—'}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block mb-1">Designation</span>
                <span className="font-medium text-slate-800">{p.designation || '—'}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block mb-1">Date Joined</span>
                <span className="font-medium text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {p.joiningDate ? new Date(p.joiningDate).toLocaleDateString() : '—'}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block mb-1">Reporting Manager</span>
                <span className="font-medium text-slate-800 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                  {p.manager ? (
                    typeof p.manager === 'object' ? (
                      <span>
                        {p.manager.name}{' '}
                        <span className="text-xs text-slate-400">({p.manager.email})</span>
                      </span>
                    ) : (
                      'Assigned'
                    )
                  ) : (
                    'None / Top-level'
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Leave Balances & Security info */}
        <div className="space-y-6">
          {/* Leave Balances Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h4 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand-600" />
              Annual Leave Allowances
            </h4>
            {balances ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-2.5 bg-blue-50/60 rounded-lg border border-blue-100">
                  <span className="text-xs font-medium text-blue-900">Casual Leave</span>
                  <span className="text-sm font-bold text-blue-700">
                    {balances.CASUAL?.available ?? balances.casual?.remaining ?? 0}{' '}
                    <span className="text-xs font-normal text-blue-500">
                      / {balances.CASUAL?.allowance ?? balances.casual?.total ?? 12}
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-amber-50/60 rounded-lg border border-amber-100">
                  <span className="text-xs font-medium text-amber-900">Sick Leave</span>
                  <span className="text-sm font-bold text-amber-700">
                    {balances.SICK?.available ?? balances.sick?.remaining ?? 0}{' '}
                    <span className="text-xs font-normal text-amber-500">
                      / {balances.SICK?.allowance ?? balances.sick?.total ?? 10}
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 bg-emerald-50/60 rounded-lg border border-emerald-100">
                  <span className="text-xs font-medium text-emerald-900">Earned Leave</span>
                  <span className="text-sm font-bold text-emerald-700">
                    {balances.EARNED?.available ?? balances.earned?.remaining ?? 0}{' '}
                    <span className="text-xs font-normal text-emerald-500">
                      / {balances.EARNED?.allowance ?? balances.earned?.total ?? 15}
                    </span>
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Leave balance data unavailable.</p>
            )}
          </div>

          {/* System & Connection Environment */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 text-xs text-slate-600 space-y-2.5">
            <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Security & Environment
            </h4>
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between">
                <span className="text-slate-400">Access Scope:</span>
                <span className="font-semibold text-slate-800">{p.role} Role</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Account Status:</span>
                <span className="font-semibold text-emerald-600">Verified Active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Backend API:</span>
                <span className="font-mono text-slate-600 truncate max-w-[150px]">
                  {import.meta.env.VITE_API_BASE_URL || 'Live Cloud'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================================
          MODAL: EDIT SELF PROFILE
          ===================================================================== */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Update Personal Details"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div>
            <label className="label">Full Name *</label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={100}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
            />
          </div>

          <div>
            <label className="label">Contact Phone Number</label>
            <input
              type="text"
              placeholder="+1 (555) 000-0000"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="input"
            />
            <span className="text-xs text-slate-400 mt-1 block">
              Organizational fields like Role, Department, and Designation are managed by HR.
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary flex items-center gap-2"
            >
              {submitting ? <LoadingSpinner size="sm" /> : <CheckCircle2 className="w-4 h-4" />}
              Save Profile
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
