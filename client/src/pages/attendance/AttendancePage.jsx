import React, { useState, useEffect } from 'react';
import {
  Clock,
  LogIn,
  LogOut,
  Calendar,
  Filter,
  CheckCircle2,
  AlertCircle,
  FileEdit,
  BarChart3,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { attendanceAPI } from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { StatCard } from '../../components/common/StatCard';
import { Modal } from '../../components/common/Modal';
import { Pagination } from '../../components/common/Pagination';
import { LoadingSpinner, TableSkeleton } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';

export const AttendancePage = () => {
  const { user, isHR, isManager } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const [activeTab, setActiveTab] = useState('me'); // 'me' | 'org'
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState(null);
  const [summary, setSummary] = useState(null);
  const [page, setPage] = useState(1);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Clock Actions
  const [clockLoading, setClockLoading] = useState(false);
  const [clockNotes, setClockNotes] = useState('');
  const [todayRecord, setTodayRecord] = useState(null);

  // HR Correction Modal
  const [correctModalOpen, setCorrectModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [correctForm, setCorrectForm] = useState({
    status: 'PRESENT',
    checkInAt: '',
    checkOutAt: '',
    correctionReason: '',
    notes: '',
  });
  const [correctSubmitting, setCorrectSubmitting] = useState(false);

  // Fetch Attendance Records
  const fetchAttendance = async () => {
    try {
      setLoading(true);

      const params = {
        page,
        limit: 10,
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
      };

      let res;
      if (activeTab === 'me' || (!isHR && !isManager)) {
        res = await attendanceAPI.getMe(params);
      } else {
        res = await attendanceAPI.getAll(params);
      }

      if (res.data?.success) {
        setRecords(res.data.data || []);
        setPagination(res.data.pagination);

        // Check if there is a record for today in personal list
        if (activeTab === 'me' || (!isHR && !isManager)) {
          const list = res.data.data || [];
          const todayStr = new Date().toISOString().split('T')[0];
          const today = list.find(
            (r) => new Date(r.date).toISOString().split('T')[0] === todayStr
          );
          setTodayRecord(today || null);
        }
      }
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Summary Metrics
  const fetchSummary = async () => {
    try {
      const res = await attendanceAPI.getSummaryReport({
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
      });
      if (res.data?.success) {
        setSummary(res.data.data);
      }
    } catch (err) {
      console.error('Summary fetch error:', err);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, [activeTab, page, statusFilter, startDate, endDate]);

  useEffect(() => {
    fetchSummary();
  }, [startDate, endDate]);

  // Handle Daily Check In
  const handleCheckIn = async () => {
    try {
      setClockLoading(true);
      const res = await attendanceAPI.checkIn({ notes: clockNotes.trim() });
      if (res.data?.success) {
        toastSuccess('Checked in successfully!');
        setClockNotes('');
        setTodayRecord(res.data.data);
        fetchAttendance();
        fetchSummary();
      }
    } catch (err) {
      toastError(err.response?.data?.message || 'Check-in failed');
    } finally {
      setClockLoading(false);
    }
  };

  // Handle Daily Check Out
  const handleCheckOut = async () => {
    try {
      setClockLoading(true);
      const res = await attendanceAPI.checkOut();
      if (res.data?.success) {
        toastSuccess('Checked out successfully!');
        setTodayRecord(res.data.data);
        fetchAttendance();
        fetchSummary();
      }
    } catch (err) {
      toastError(err.response?.data?.message || 'Check-out failed');
    } finally {
      setClockLoading(false);
    }
  };

  // Open HR Correction
  const openCorrectModal = (record) => {
    setSelectedRecord(record);
    setCorrectForm({
      status: record.status || 'PRESENT',
      checkInAt: record.checkInAt ? new Date(record.checkInAt).toISOString().slice(0, 16) : '',
      checkOutAt: record.checkOutAt ? new Date(record.checkOutAt).toISOString().slice(0, 16) : '',
      correctionReason: '',
      notes: record.notes || '',
    });
    setCorrectModalOpen(true);
  };

  // Handle HR Correction Submit
  const handleCorrectSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRecord) return;

    if (!correctForm.correctionReason.trim()) {
      toastError('Correction audit reason is required');
      return;
    }

    try {
      setCorrectSubmitting(true);
      const res = await attendanceAPI.correct(selectedRecord._id, {
        status: correctForm.status,
        checkInAt: correctForm.checkInAt ? new Date(correctForm.checkInAt).toISOString() : undefined,
        checkOutAt: correctForm.checkOutAt ? new Date(correctForm.checkOutAt).toISOString() : undefined,
        correctionReason: correctForm.correctionReason.trim(),
        notes: correctForm.notes,
      });

      if (res.data?.success) {
        toastSuccess('Attendance record corrected successfully');
        setCorrectModalOpen(false);
        fetchAttendance();
        fetchSummary();
      }
    } catch (err) {
      toastError(err.response?.data?.message || 'Correction failed');
    } finally {
      setCorrectSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Clock-In Widget */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Attendance & Time Tracking
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Log your daily working hours, review punch records, and monitor punctuality metrics
          </p>
        </div>

        {/* Live Check-in / Check-out Panel */}
        <div className="w-full md:w-auto p-4 bg-slate-50 rounded-2xl border border-slate-200/70 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <span className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">
              Today's Status
            </span>
            <div className="mt-1 flex items-center gap-2">
              {todayRecord ? (
                <>
                  <Badge variant={todayRecord.status} size="sm">
                    {todayRecord.status}
                  </Badge>
                  <span className="text-xs text-slate-600 font-medium">
                    In: {new Date(todayRecord.checkInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {todayRecord.checkOutAt &&
                      ` | Out: ${new Date(todayRecord.checkOutAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                  </span>
                </>
              ) : (
                <span className="text-xs text-slate-500 italic">No check-in recorded today</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!todayRecord ? (
              <button
                onClick={handleCheckIn}
                disabled={clockLoading}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
              >
                {clockLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogIn className="w-4 h-4" />
                )}
                <span>Check In Now</span>
              </button>
            ) : !todayRecord.checkOutAt ? (
              <button
                onClick={handleCheckOut}
                disabled={clockLoading}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-amber-600/20 transition-all disabled:opacity-50"
              >
                {clockLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                <span>Check Out</span>
              </button>
            ) : (
              <div className="px-3.5 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Day Complete</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            title="Present Days"
            value={summary.presentCount || 0}
            icon={CheckCircle2}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-50"
          />
          <StatCard
            title="Late Check-ins"
            value={summary.lateCount || 0}
            icon={Clock}
            iconColor="text-amber-600"
            iconBg="bg-amber-50"
          />
          <StatCard
            title="Half Days"
            value={summary.halfDayCount || 0}
            icon={Calendar}
            iconColor="text-orange-600"
            iconBg="bg-orange-50"
          />
          <StatCard
            title="Total Worked"
            value={`${summary.totalWorkedHours || 0}h`}
            icon={BarChart3}
            iconColor="text-blue-600"
            iconBg="bg-blue-50"
            subtext={`Avg: ${summary.averageWorkedMinutesPerDay || 0} mins/day`}
          />
        </div>
      )}

      {/* Tabs & Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        {/* Role Tabs */}
        {(isHR || isManager) ? (
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
              My Attendance
            </button>
            <button
              onClick={() => {
                setActiveTab('org');
                setPage(1);
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'org'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {isHR ? 'All Workforce Attendance' : 'Team Attendance'}
            </button>
          </div>
        ) : (
          <div className="text-xs font-semibold text-slate-700">My Attendance History</div>
        )}

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="PRESENT">Present</option>
            <option value="LATE">Late</option>
            <option value="HALF_DAY">Half Day</option>
            <option value="ABSENT">Absent</option>
          </select>

          <input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <input
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Attendance Records Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : records.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No attendance records"
            description="No logs were found for the selected time range or criteria."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  {activeTab === 'org' && <th className="px-6 py-3.5">Employee</th>}
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5">Check In</th>
                  <th className="px-6 py-3.5">Check Out</th>
                  <th className="px-6 py-3.5">Worked</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Notes</th>
                  {isHR && <th className="px-6 py-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {records.map((r) => (
                  <tr key={r._id} className="hover:bg-slate-50/60 transition-colors">
                    {/* Employee info if team view */}
                    {activeTab === 'org' && (
                      <td className="px-6 py-4 font-semibold text-slate-900">
                        {r.employee?.name || 'Employee'}
                        <span className="block text-[11px] text-slate-400 font-normal">
                          {r.employee?.department}
                        </span>
                      </td>
                    )}

                    {/* Date */}
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {new Date(r.date).toLocaleDateString(undefined, {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>

                    {/* Check In */}
                    <td className="px-6 py-4 text-slate-600">
                      {r.checkInAt ? new Date(r.checkInAt).toLocaleTimeString() : '—'}
                    </td>

                    {/* Check Out */}
                    <td className="px-6 py-4 text-slate-600">
                      {r.checkOutAt ? (
                        new Date(r.checkOutAt).toLocaleTimeString()
                      ) : (
                        <span className="text-amber-600 font-medium italic">Active Shift</span>
                      )}
                    </td>

                    {/* Total Worked */}
                    <td className="px-6 py-4 font-semibold text-slate-800">
                      {r.totalWorkedMinutes ? (
                        `${Math.floor(r.totalWorkedMinutes / 60)}h ${r.totalWorkedMinutes % 60}m`
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="px-6 py-4">
                      <Badge variant={r.status} size="sm">
                        {r.status}
                      </Badge>
                    </td>

                    {/* Notes / Corrections */}
                    <td className="px-6 py-4 text-slate-500 max-w-xs truncate">
                      {r.correctionReason ? (
                        <span className="text-purple-600 font-medium">
                          [Corrected: {r.correctionReason}]
                        </span>
                      ) : (
                        r.notes || '—'
                      )}
                    </td>

                    {/* HR Correction button */}
                    {isHR && (
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => openCorrectModal(r)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Correct attendance record"
                        >
                          <FileEdit className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <Pagination pagination={pagination} onPageChange={(p) => setPage(p)} />
      </div>

      {/* HR Attendance Correction Modal */}
      <Modal
        isOpen={correctModalOpen}
        onClose={() => setCorrectModalOpen(false)}
        title="Administrative Attendance Correction"
      >
        <form onSubmit={handleCorrectSubmit} className="space-y-4">
          <div className="p-3 bg-purple-50 text-purple-700 rounded-xl text-xs flex items-center gap-2 border border-purple-200">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>All modifications are audited with timestamp and admin identity.</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
            <select
              value={correctForm.status}
              onChange={(e) => setCorrectForm({ ...correctForm, status: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="PRESENT">Present</option>
              <option value="LATE">Late</option>
              <option value="HALF_DAY">Half Day</option>
              <option value="ABSENT">Absent</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Check-in Time</label>
              <input
                type="datetime-local"
                value={correctForm.checkInAt}
                onChange={(e) => setCorrectForm({ ...correctForm, checkInAt: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Check-out Time</label>
              <input
                type="datetime-local"
                value={correctForm.checkOutAt}
                onChange={(e) => setCorrectForm({ ...correctForm, checkOutAt: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Audit Correction Reason <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={correctForm.correctionReason}
              onChange={(e) => setCorrectForm({ ...correctForm, correctionReason: e.target.value })}
              placeholder="e.g. Employee punch failed due to biometric outage at Reception"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCorrectModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={correctSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50"
            >
              {correctSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Correction</span>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AttendancePage;
