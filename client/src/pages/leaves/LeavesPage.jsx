import React, { useState, useEffect } from 'react';
import {
  CalendarDays,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  FileText,
  Calendar,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { leaveAPI } from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Pagination } from '../../components/common/Pagination';
import { LoadingSpinner, TableSkeleton } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';

export const LeavesPage = () => {
  const { user, isHR, isManager, canReviewLeaves } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const [activeTab, setActiveTab] = useState('me'); // 'me' | 'review'
  const [balance, setBalance] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');

  // Apply Modal
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [applyForm, setApplyForm] = useState({
    leaveType: 'CASUAL',
    startDate: '',
    endDate: '',
    reason: '',
  });

  // Review Modal
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState(null);
  const [reviewAction, setReviewAction] = useState('APPROVED'); // 'APPROVED' | 'REJECTED'
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Fetch Leave Balance
  const fetchBalance = async () => {
    try {
      const res = await leaveAPI.getBalanceMe();
      if (res.data?.success) {
        setBalance(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch leave balance:', err);
    }
  };

  // Fetch Leave Records
  const fetchLeaves = async () => {
    try {
      setLoading(true);

      const params = {
        page,
        limit: 10,
        ...(statusFilter ? { status: statusFilter } : {}),
      };

      let res;
      if (activeTab === 'me' || !canReviewLeaves) {
        res = await leaveAPI.getMe(params);
      } else {
        res = await leaveAPI.getAll(params);
      }

      if (res.data?.success) {
        setLeaves(res.data.data || []);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to load leave records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, []);

  useEffect(() => {
    fetchLeaves();
  }, [activeTab, page, statusFilter]);

  // Handle Apply Leave Submit
  const handleApplySubmit = async (e) => {
    e.preventDefault();

    if (!applyForm.startDate || !applyForm.endDate || !applyForm.reason.trim()) {
      toastError('Please fill out all required fields.');
      return;
    }

    try {
      setApplySubmitting(true);
      const res = await leaveAPI.apply({
        ...applyForm,
        reason: applyForm.reason.trim(),
      });

      if (res.data?.success) {
        toastSuccess('Leave application submitted successfully!');
        setApplyModalOpen(false);
        setApplyForm({
          leaveType: 'CASUAL',
          startDate: '',
          endDate: '',
          reason: '',
        });
        fetchLeaves();
        fetchBalance();
      }
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to apply for leave');
    } finally {
      setApplySubmitting(false);
    }
  };

  // Handle Cancel Leave
  const handleCancelLeave = async (leaveId) => {
    if (!window.confirm('Are you sure you want to cancel this leave request?')) {
      return;
    }

    try {
      const res = await leaveAPI.cancel(leaveId);
      if (res.data?.success) {
        toastSuccess('Leave request cancelled');
        fetchLeaves();
        fetchBalance();
      }
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to cancel leave');
    }
  };

  // Open Review Modal
  const openReviewModal = (leave, action) => {
    setSelectedLeave(leave);
    setReviewAction(action);
    setReviewComment('');
    setReviewModalOpen(true);
  };

  // Handle Review Submit
  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLeave) return;

    try {
      setReviewSubmitting(true);
      const res = await leaveAPI.review(selectedLeave._id, {
        status: reviewAction,
        reviewComment: reviewComment.trim(),
      });

      if (res.data?.success) {
        toastSuccess(`Leave request ${reviewAction.toLowerCase()} successfully`);
        setReviewModalOpen(false);
        fetchLeaves();
      }
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to review leave request');
    } finally {
      setReviewSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Leave Management
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Track annual allowances, request time off, and manage approval workflows
          </p>
        </div>

        <button
          onClick={() => setApplyModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Apply for Leave</span>
        </button>
      </div>

      {/* Balance Cards */}
      {balance && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-500">
              <span>Casual Leave</span>
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {balance.CASUAL?.remaining} Days Left
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">
                {balance.CASUAL?.remaining}
              </span>
              <span className="text-xs text-slate-400">/ {balance.CASUAL?.allowance} days</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{balance.CASUAL?.used} days used this year</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-500">
              <span>Sick Leave</span>
              <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                {balance.SICK?.remaining} Days Left
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">
                {balance.SICK?.remaining}
              </span>
              <span className="text-xs text-slate-400">/ {balance.SICK?.allowance} days</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{balance.SICK?.used} days used this year</p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-500">
              <span>Earned Leave</span>
              <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                {balance.EARNED?.remaining} Days Left
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">
                {balance.EARNED?.remaining}
              </span>
              <span className="text-xs text-slate-400">/ {balance.EARNED?.allowance} days</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{balance.EARNED?.used} days used this year</p>
          </div>
        </div>
      )}

      {/* Tabs & Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {canReviewLeaves ? (
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => {
                setActiveTab('me');
                setPage(1);
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'me'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              My Leave Requests
            </button>
            <button
              onClick={() => {
                setActiveTab('review');
                setPage(1);
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'review'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {isHR ? 'All Company Requests' : 'Team Requests to Review'}
            </button>
          </div>
        ) : (
          <div className="text-xs font-semibold text-slate-700">My Leave Applications</div>
        )}

        <div className="flex items-center gap-2.5">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Leaves Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <TableSkeleton rows={5} cols={6} />
        ) : leaves.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No leave requests found"
            description="You currently have no leave requests under this view."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  {activeTab === 'review' && <th className="px-6 py-3.5">Employee</th>}
                  <th className="px-6 py-3.5">Type</th>
                  <th className="px-6 py-3.5">Period</th>
                  <th className="px-6 py-3.5">Days</th>
                  <th className="px-6 py-3.5">Reason</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {leaves.map((item) => {
                  const isOwner = item.employee?._id === user?._id || item.employee === user?._id;
                  const canReviewItem =
                    canReviewLeaves &&
                    activeTab === 'review' &&
                    item.status === 'PENDING' &&
                    !isOwner;

                  return (
                    <tr key={item._id} className="hover:bg-slate-50/60 transition-colors">
                      {activeTab === 'review' && (
                        <td className="px-6 py-4 font-semibold text-slate-900">
                          {item.employee?.name || 'Employee'}
                          <span className="block text-[11px] text-slate-400 font-normal">
                            {item.employee?.department}
                          </span>
                        </td>
                      )}

                      <td className="px-6 py-4 font-semibold text-slate-800">{item.leaveType}</td>

                      <td className="px-6 py-4 text-slate-600">
                        {new Date(item.startDate).toLocaleDateString()} &rarr;{' '}
                        {new Date(item.endDate).toLocaleDateString()}
                      </td>

                      <td className="px-6 py-4 font-bold text-slate-800">{item.days}d</td>

                      <td className="px-6 py-4 text-slate-600 max-w-xs truncate" title={item.reason}>
                        {item.reason}
                        {item.reviewComment && (
                          <span className="block text-[10px] text-purple-600 font-medium mt-0.5">
                            Reviewer note: {item.reviewComment}
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <Badge variant={item.status} size="sm">
                          {item.status}
                        </Badge>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Cancel button if owner and eligible */}
                          {isOwner && ['PENDING', 'APPROVED'].includes(item.status) && (
                            <button
                              onClick={() => handleCancelLeave(item._id)}
                              className="px-2.5 py-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-medium transition-colors"
                            >
                              Cancel
                            </button>
                          )}

                          {/* Review Action Buttons (Approve / Reject) */}
                          {canReviewItem && (
                            <>
                              <button
                                onClick={() => openReviewModal(item, 'APPROVED')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-xs font-semibold border border-emerald-200 transition-colors"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => openReviewModal(item, 'REJECTED')}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-semibold border border-rose-200 transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pagination pagination={pagination} onPageChange={(p) => setPage(p)} />
      </div>

      {/* Modal: Apply for Leave */}
      <Modal
        isOpen={applyModalOpen}
        onClose={() => setApplyModalOpen(false)}
        title="Apply for Leave"
      >
        <form onSubmit={handleApplySubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Leave Type</label>
            <select
              value={applyForm.leaveType}
              onChange={(e) => setApplyForm({ ...applyForm, leaveType: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="CASUAL">Casual Leave ({balance?.CASUAL?.remaining || 0}d left)</option>
              <option value="SICK">Sick Leave ({balance?.SICK?.remaining || 0}d left)</option>
              <option value="EARNED">Earned Leave ({balance?.EARNED?.remaining || 0}d left)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date</label>
              <input
                type="date"
                required
                value={applyForm.startDate}
                onChange={(e) => setApplyForm({ ...applyForm, startDate: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">End Date</label>
              <input
                type="date"
                required
                value={applyForm.endDate}
                onChange={(e) => setApplyForm({ ...applyForm, endDate: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reason for Leave <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={applyForm.reason}
              onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
              placeholder="Provide context for your leave request (min. 3 characters)"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setApplyModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={applySubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50"
            >
              {applySubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Submit Request</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Review Leave Request (Manager / HR) */}
      <Modal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        title={`Review Request: ${reviewAction === 'APPROVED' ? 'Approve' : 'Reject'}`}
      >
        <form onSubmit={handleReviewSubmit} className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            You are about to <strong className="text-slate-900">{reviewAction.toLowerCase()}</strong> the{' '}
            {selectedLeave?.leaveType} leave application for{' '}
            <strong>{selectedLeave?.employee?.name}</strong> ({selectedLeave?.days} working days).
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Review Comment (optional)
            </label>
            <textarea
              rows={3}
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="e.g. Approved. Project tasks handed over to Alex."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setReviewModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={reviewSubmitting}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-xl disabled:opacity-50 ${
                reviewAction === 'APPROVED'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {reviewSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>Confirm {reviewAction === 'APPROVED' ? 'Approval' : 'Rejection'}</span>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default LeavesPage;
