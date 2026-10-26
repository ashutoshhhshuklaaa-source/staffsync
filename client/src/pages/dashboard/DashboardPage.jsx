import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Clock,
  CalendarDays,
  Megaphone,
  GraduationCap,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  LogIn,
  LogOut,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  leaveAPI,
  attendanceAPI,
  announcementAPI,
  trainingAPI,
  employeeAPI,
} from '../../services/api';
import { StatCard } from '../../components/common/StatCard';
import { Badge } from '../../components/common/Badge';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const DashboardPage = () => {
  const { user, isHR, isManager } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const [loading, setLoading] = useState(true);
  const [clockLoading, setClockLoading] = useState(false);

  // Real backend metrics
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [recentAnnouncements, setRecentAnnouncements] = useState([]);
  const [myTrainings, setMyTrainings] = useState([]);
  const [totalEmployees, setTotalEmployees] = useState(null);
  const [pendingLeavesCount, setPendingLeavesCount] = useState(null);
  const [attendanceSummary, setAttendanceSummary] = useState(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Common employee queries
      const [leaveBalRes, attMeRes, annRes, trainRes] = await Promise.allSettled([
        leaveAPI.getBalanceMe(),
        attendanceAPI.getMe({ limit: 1 }),
        announcementAPI.getMe({ limit: 3 }),
        trainingAPI.getMyEnrollments({ limit: 3 }),
      ]);

      if (leaveBalRes.status === 'fulfilled' && leaveBalRes.value.data?.success) {
        const balData = leaveBalRes.value.data.data;
        const balances = balData?.balances || balData;
        const casualAvail = balances?.CASUAL?.available ?? balances?.CASUAL?.remaining ?? 0;
        const sickAvail = balances?.SICK?.available ?? balances?.SICK?.remaining ?? 0;
        const earnedAvail = balances?.EARNED?.available ?? balances?.EARNED?.remaining ?? 0;
        setLeaveBalance({
          ...balData,
          balances,
          casualAvail,
          sickAvail,
          earnedAvail,
          totalRemaining: casualAvail + sickAvail + earnedAvail,
        });
      }

      if (attMeRes.status === 'fulfilled' && attMeRes.value.data?.success) {
        const records = attMeRes.value.data.data;
        if (records && records.length > 0) {
          const latest = records[0];
          // Check if latest record matches today
          const recordDate = new Date(latest.date).toISOString().split('T')[0];
          const todayDate = new Date().toISOString().split('T')[0];
          if (recordDate === todayDate) {
            setTodayAttendance(latest);
          } else {
            setTodayAttendance(null);
          }
        }
      }

      if (annRes.status === 'fulfilled' && annRes.value.data?.success) {
        setRecentAnnouncements(annRes.value.data.data || []);
      }

      if (trainRes.status === 'fulfilled' && trainRes.value.data?.success) {
        setMyTrainings(trainRes.value.data.data || []);
      }

      // HR / Manager elevated queries
      if (isHR || isManager) {
        const [empRes, pendingLeaveRes, attSumRes] = await Promise.allSettled([
          employeeAPI.getAll({ limit: 1 }),
          leaveAPI.getAll({ status: 'PENDING', limit: 1 }),
          attendanceAPI.getSummaryReport(),
        ]);

        if (empRes.status === 'fulfilled' && empRes.value.data?.success) {
          setTotalEmployees(empRes.value.data.pagination?.total ?? null);
        }

        if (pendingLeaveRes.status === 'fulfilled' && pendingLeaveRes.value.data?.success) {
          setPendingLeavesCount(pendingLeaveRes.value.data.pagination?.total ?? 0);
        }

        if (attSumRes.status === 'fulfilled' && attSumRes.value.data?.success) {
          setAttendanceSummary(attSumRes.value.data.data);
        }
      }
    } catch (err) {
      console.error('Dashboard data error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  // Clock In Action
  const handleCheckIn = async () => {
    try {
      setClockLoading(true);
      const res = await attendanceAPI.checkIn({ notes: 'Web Dashboard Check-in' });
      if (res.data?.success) {
        toastSuccess('Checked in successfully!');
        setTodayAttendance(res.data.data);
      }
    } catch (err) {
      toastError(err.response?.data?.message || 'Check-in failed');
    } finally {
      setClockLoading(false);
    }
  };

  // Clock Out Action
  const handleCheckOut = async () => {
    try {
      setClockLoading(true);
      const res = await attendanceAPI.checkOut();
      if (res.data?.success) {
        toastSuccess('Checked out successfully!');
        setTodayAttendance(res.data.data);
      }
    } catch (err) {
      toastError(err.response?.data?.message || 'Check-out failed');
    } finally {
      setClockLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading dashboard metrics..." size="lg" />;
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-3 border border-blue-400/20">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>StaffSync Enterprise HRMS</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Welcome back, {user?.name}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-300">
            {user?.designation || 'Team Member'} &bull; {user?.department || 'StaffSync'} &bull;{' '}
            <span className="text-blue-300">{user?.role} Portal</span>
          </p>
        </div>

        {/* Quick Attendance Widget */}
        <div className="relative z-10 w-full md:w-auto bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex items-center justify-between md:justify-start gap-4">
          <div>
            <span className="text-[11px] font-medium text-slate-300 block">Today's Attendance</span>
            <div className="mt-1">
              {todayAttendance ? (
                <div className="flex items-center gap-2">
                  <Badge variant={todayAttendance.status} size="sm">
                    {todayAttendance.status}
                  </Badge>
                  {todayAttendance.checkOutAt && (
                    <span className="text-[11px] text-slate-300">
                      ({todayAttendance.totalWorkedMinutes} mins worked)
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-xs text-slate-400 italic">Not checked in today</span>
              )}
            </div>
          </div>

          <div className="pl-4 border-l border-white/10">
            {!todayAttendance ? (
              <button
                onClick={handleCheckIn}
                disabled={clockLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                <span>Clock In</span>
              </button>
            ) : !todayAttendance.checkOutAt ? (
              <button
                onClick={handleCheckOut}
                disabled={clockLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                <span>Clock Out</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-semibold px-3 py-1.5 bg-emerald-500/20 rounded-xl border border-emerald-500/30">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Shift Completed</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Primary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Leave Remaining */}
        <StatCard
          title="Available Leave Days"
          value={leaveBalance ? `${leaveBalance.totalRemaining} Days` : '0 Days'}
          icon={CalendarDays}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
          subtext={
            leaveBalance
              ? `Casual: ${leaveBalance.casualAvail}d | Sick: ${leaveBalance.sickAvail}d`
              : 'Yearly balance'
          }
        />

        {/* HR / Manager: Team or Organization Headcount */}
        {(isHR || isManager) && totalEmployees !== null ? (
          <StatCard
            title={isHR ? 'Total Workforce' : 'My Direct Reports'}
            value={totalEmployees}
            icon={Users}
            iconColor="text-blue-600"
            iconBg="bg-blue-50"
            subtext="Active organization profiles"
          />
        ) : (
          <StatCard
            title="My Department"
            value={user?.department || 'General'}
            icon={Users}
            iconColor="text-blue-600"
            iconBg="bg-blue-50"
            subtext={user?.designation || 'Staff'}
          />
        )}

        {/* Pending Requests for HR/Managers OR Active Courses for Employees */}
        {(isHR || isManager) && pendingLeavesCount !== null ? (
          <StatCard
            title="Leaves Awaiting Review"
            value={pendingLeavesCount}
            icon={Calendar}
            iconColor="text-amber-600"
            iconBg="bg-amber-50"
            subtext={pendingLeavesCount > 0 ? 'Requires attention' : 'All caught up'}
          />
        ) : (
          <StatCard
            title="Enrolled Courses"
            value={myTrainings.length}
            icon={GraduationCap}
            iconColor="text-purple-600"
            iconBg="bg-purple-50"
            subtext="Skill development programs"
          />
        )}

        {/* Attendance Summary */}
        {attendanceSummary ? (
          <StatCard
            title="Present Today"
            value={attendanceSummary.presentCount || 0}
            icon={Clock}
            iconColor="text-indigo-600"
            iconBg="bg-indigo-50"
            subtext={`${attendanceSummary.lateCount || 0} marked late`}
          />
        ) : (
          <StatCard
            title="Active Notices"
            value={recentAnnouncements.length}
            icon={Megaphone}
            iconColor="text-amber-600"
            iconBg="bg-amber-50"
            subtext="Company broadcast updates"
          />
        )}
      </div>

      {/* Two-Column Activity Feeds */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Announcements */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                <Megaphone className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Company Announcements</h3>
            </div>
            <Link
              to="/announcements"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentAnnouncements.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center italic">
              No recent announcements posted.
            </p>
          ) : (
            <div className="space-y-3">
              {recentAnnouncements.map((ann) => (
                <div
                  key={ann._id}
                  className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 hover:border-slate-200 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-slate-900 truncate">{ann.title}</h4>
                    <Badge variant={ann.audience} size="sm">
                      {ann.audience}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {ann.content}
                  </p>
                  <div className="mt-2 text-[10px] text-slate-400">
                    Posted by {ann.createdBy?.name || 'HR Team'} &bull;{' '}
                    {ann.publishedAt ? new Date(ann.publishedAt).toLocaleDateString() : 'Recent'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My Training & Development Courses */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-purple-50 rounded-xl text-purple-600">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">My Learning & Development</h3>
            </div>
            <Link
              to="/trainings"
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
            >
              <span>Browse Catalog</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {myTrainings.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-xs text-slate-500 italic mb-3">
                You are not currently enrolled in any courses.
              </p>
              <Link
                to="/trainings"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-semibold transition-colors"
              >
                <span>Explore Catalog</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {myTrainings.map((enrollment) => (
                <div
                  key={enrollment._id}
                  className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 truncate">
                      {enrollment.training?.title || 'Training Course'}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {enrollment.training?.category} &bull; {enrollment.training?.durationMinutes} mins
                    </p>
                  </div>
                  <Badge variant={enrollment.status} size="sm">
                    {enrollment.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
