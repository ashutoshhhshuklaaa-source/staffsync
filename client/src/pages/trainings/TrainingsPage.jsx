import React, { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap,
  BookOpen,
  Plus,
  Search,
  Filter,
  Clock,
  User,
  Calendar,
  CheckCircle2,
  PlayCircle,
  XCircle,
  Users,
  Award,
  Layers,
  Sparkles,
  ArrowRight,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { trainingAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import Pagination from '../../components/common/Pagination';
import LoadingSpinner, { TableSkeleton } from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';

const DIFFICULTIES = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const ENROLLMENT_STATUSES = ['ENROLLED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

export default function TrainingsPage() {
  const { user, isHR, isManager } = useAuth();
  const { showSuccess, showError } = useToast();

  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'my-learning'
  const [trainings, setTrainings] = useState([]);
  const [myEnrollments, setMyEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Catalog filters & pagination
  const [search, setSearch] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // My enrollments filters & pagination
  const [enrollmentStatusFilter, setEnrollmentStatusFilter] = useState('');
  const [enrollmentPage, setEnrollmentPage] = useState(1);
  const [enrollmentTotalPages, setEnrollmentTotalPages] = useState(1);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTraining, setSelectedTraining] = useState(null);
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [rosterData, setRosterData] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);

  // Form state
  const initialForm = {
    title: '',
    description: '',
    category: '',
    instructor: '',
    durationMinutes: 60,
    difficulty: 'BEGINNER',
    enrollmentDeadline: '',
    startDate: '',
    endDate: '',
  };
  const [formData, setFormData] = useState(initialForm);

  // Fetch catalog
  const fetchTrainings = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: 9,
      };
      if (search.trim()) params.search = search.trim();
      if (selectedDifficulty) params.difficulty = selectedDifficulty;
      if (selectedCategory) params.category = selectedCategory;
      if (isHR && selectedStatus) params.status = selectedStatus;

      const res = await trainingAPI.getAll(params);
      if (res.data.success) {
        setTrainings(res.data.data.trainings || res.data.data || []);
        if (res.data.data.pagination) {
          setTotalPages(res.data.data.pagination.pages || 1);
          setTotalCount(res.data.data.pagination.total || 0);
        }
      }
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to load trainings catalog.');
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedDifficulty, selectedCategory, selectedStatus, isHR, showError]);

  // Fetch my enrollments
  const fetchMyEnrollments = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: enrollmentPage,
        limit: 10,
      };
      if (enrollmentStatusFilter) params.status = enrollmentStatusFilter;

      const res = await trainingAPI.getMyEnrollments(params);
      if (res.data.success) {
        setMyEnrollments(res.data.data.enrollments || res.data.data || []);
        if (res.data.data.pagination) {
          setEnrollmentTotalPages(res.data.data.pagination.pages || 1);
        }
      }
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to load your enrollments.');
    } finally {
      setLoading(false);
    }
  }, [enrollmentPage, enrollmentStatusFilter, showError]);

  useEffect(() => {
    if (activeTab === 'catalog') {
      fetchTrainings();
    } else {
      fetchMyEnrollments();
    }
  }, [activeTab, fetchTrainings, fetchMyEnrollments]);

  // Handle Enrollment
  const handleEnroll = async (trainingId) => {
    try {
      setSubmitting(true);
      const res = await trainingAPI.enroll(trainingId);
      if (res.data.success) {
        showSuccess(res.data.message || 'Successfully enrolled in course!');
        fetchTrainings();
        fetchMyEnrollments();
      }
    } catch (err) {
      showError(err.response?.data?.message || 'Enrollment failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Progress Update
  const handleUpdateProgress = async (trainingId, enrollmentId, nextStatus) => {
    try {
      setSubmitting(true);
      const res = await trainingAPI.updateProgress(trainingId, enrollmentId, { status: nextStatus });
      if (res.data.success) {
        showSuccess(`Progress updated to ${nextStatus}!`);
        fetchMyEnrollments();
      }
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to update course progress.');
    } finally {
      setSubmitting(false);
    }
  };

  // HR Create Training
  const handleCreateTraining = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const payload = {
        ...formData,
        durationMinutes: parseInt(formData.durationMinutes, 10),
      };
      if (!payload.enrollmentDeadline) delete payload.enrollmentDeadline;
      if (!payload.startDate) delete payload.startDate;
      if (!payload.endDate) delete payload.endDate;

      const res = await trainingAPI.create(payload);
      if (res.data.success) {
        showSuccess('Training created successfully as DRAFT.');
        setShowCreateModal(false);
        setFormData(initialForm);
        fetchTrainings();
      }
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to create training.');
    } finally {
      setSubmitting(false);
    }
  };

  // HR Edit Training
  const handleEditTraining = async (e) => {
    e.preventDefault();
    if (!selectedTraining) return;
    try {
      setSubmitting(true);
      const payload = {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        instructor: formData.instructor,
        durationMinutes: parseInt(formData.durationMinutes, 10),
        difficulty: formData.difficulty,
        enrollmentDeadline: formData.enrollmentDeadline || null,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
      };

      const res = await trainingAPI.update(selectedTraining._id, payload);
      if (res.data.success) {
        showSuccess('Training updated successfully.');
        setShowEditModal(false);
        setSelectedTraining(null);
        fetchTrainings();
      }
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to update training.');
    } finally {
      setSubmitting(false);
    }
  };

  // HR Publish
  const handlePublish = async (trainingId) => {
    try {
      setSubmitting(true);
      const res = await trainingAPI.publish(trainingId);
      if (res.data.success) {
        showSuccess('Training published to employee catalog.');
        fetchTrainings();
      }
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to publish training.');
    } finally {
      setSubmitting(false);
    }
  };

  // HR Archive
  const handleArchive = async (trainingId) => {
    try {
      setSubmitting(true);
      const res = await trainingAPI.archive(trainingId);
      if (res.data.success) {
        showSuccess('Training archived successfully.');
        fetchTrainings();
      }
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to archive training.');
    } finally {
      setSubmitting(false);
    }
  };

  // View Roster
  const handleOpenRoster = async (training) => {
    setSelectedTraining(training);
    setShowRosterModal(true);
    setRosterLoading(true);
    try {
      const res = await trainingAPI.getEnrollments(training._id, { limit: 100 });
      if (res.data.success) {
        setRosterData(res.data.data.enrollments || res.data.data || []);
      }
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to load enrollment roster.');
    } finally {
      setRosterLoading(false);
    }
  };

  const openEditModal = (t) => {
    setSelectedTraining(t);
    setFormData({
      title: t.title || '',
      description: t.description || '',
      category: t.category || '',
      instructor: t.instructor || '',
      durationMinutes: t.durationMinutes || 60,
      difficulty: t.difficulty || 'BEGINNER',
      enrollmentDeadline: t.enrollmentDeadline ? t.enrollmentDeadline.substring(0, 10) : '',
      startDate: t.startDate ? t.startDate.substring(0, 10) : '',
      endDate: t.endDate ? t.endDate.substring(0, 10) : '',
    });
    setShowEditModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <GraduationCap className="w-7 h-7 text-brand-600" />
            Training & Development
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Explore corporate courses, build skills, and track continuous learning milestones.
          </p>
        </div>
        {isHR && (
          <button
            onClick={() => {
              setFormData(initialForm);
              setShowCreateModal(true);
            }}
            className="btn btn-primary inline-flex items-center gap-2 self-start sm:self-auto shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add New Course
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => {
            setActiveTab('catalog');
            setPage(1);
          }}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'catalog'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Course Catalog
        </button>
        <button
          onClick={() => {
            setActiveTab('my-learning');
            setEnrollmentPage(1);
          }}
          className={`pb-3 px-4 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === 'my-learning'
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Award className="w-4 h-4" />
          My Learning
        </button>
      </div>

      {/* =====================================================================
          TAB 1: COURSE CATALOG
          ===================================================================== */}
      {activeTab === 'catalog' && (
        <div className="space-y-6">
          {/* Search & Filters */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search courses, instructors, or topics..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="input pl-10"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedDifficulty}
                onChange={(e) => {
                  setSelectedDifficulty(e.target.value);
                  setPage(1);
                }}
                className="select"
              >
                <option value="">All Difficulties</option>
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              {isHR && (
                <select
                  value={selectedStatus}
                  onChange={(e) => {
                    setSelectedStatus(e.target.value);
                    setPage(1);
                  }}
                  className="select"
                >
                  <option value="">All Statuses</option>
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              )}
            </div>
          </div>

          {/* Cards Grid */}
          {loading ? (
            <div className="py-12 flex justify-center">
              <LoadingSpinner size="lg" text="Loading course catalog..." />
            </div>
          ) : trainings.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="No courses found"
              description="There are currently no training courses matching your search criteria."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trainings.map((t) => (
                <div
                  key={t._id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between overflow-hidden group"
                >
                  <div className="p-6">
                    {/* Top Row: Category + Badges */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 uppercase tracking-wide">
                        {t.category}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={t.difficulty}>{t.difficulty}</Badge>
                        {isHR && <Badge variant={t.status}>{t.status}</Badge>}
                      </div>
                    </div>

                    {/* Course Title */}
                    <h3 className="font-bold text-slate-900 text-lg group-hover:text-brand-600 transition line-clamp-2 mb-2">
                      {t.title}
                    </h3>

                    {/* Description */}
                    <p className="text-sm text-slate-600 line-clamp-3 mb-4">
                      {t.description}
                    </p>

                    {/* Metadata details */}
                    <div className="space-y-1.5 pt-3 border-t border-slate-100 text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>Instructor: <strong className="text-slate-700">{t.instructor}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Duration: <strong className="text-slate-700">{t.durationMinutes} mins ({Math.round(t.durationMinutes / 60 * 10) / 10} hrs)</strong></span>
                      </div>
                      {t.enrollmentDeadline && (
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>Deadline: {new Date(t.enrollmentDeadline).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                    {/* Employee Enroll Button */}
                    {t.status === 'PUBLISHED' && (
                      <button
                        onClick={() => handleEnroll(t._id)}
                        disabled={submitting}
                        className="btn btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-sm"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Enroll Now
                      </button>
                    )}

                    {/* HR & Manager Actions */}
                    <div className="flex items-center gap-1.5 ml-auto">
                      {(isHR || isManager) && (
                        <button
                          onClick={() => handleOpenRoster(t)}
                          title="View Enrolled Roster"
                          className="btn btn-secondary text-xs py-2 px-2.5 text-slate-700"
                        >
                          <Users className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {isHR && (
                        <>
                          <button
                            onClick={() => openEditModal(t)}
                            title="Edit Training"
                            className="btn btn-secondary text-xs py-2 px-2.5 text-slate-700"
                          >
                            Edit
                          </button>
                          {t.status === 'DRAFT' && (
                            <button
                              onClick={() => handlePublish(t._id)}
                              disabled={submitting}
                              className="btn btn-secondary text-xs py-2 px-2.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                            >
                              Publish
                            </button>
                          )}
                          {t.status !== 'ARCHIVED' && (
                            <button
                              onClick={() => handleArchive(t._id)}
                              disabled={submitting}
                              className="btn btn-secondary text-xs py-2 px-2.5 text-rose-700 border-rose-300 hover:bg-rose-50"
                            >
                              Archive
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(p) => setPage(p)}
            />
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 2: MY LEARNING
          ===================================================================== */}
      {activeTab === 'my-learning' && (
        <div className="space-y-6">
          {/* Status Filter */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Filter by Status:
              </span>
              <select
                value={enrollmentStatusFilter}
                onChange={(e) => {
                  setEnrollmentStatusFilter(e.target.value);
                  setEnrollmentPage(1);
                }}
                className="select py-1.5 text-xs"
              >
                <option value="">All Statuses</option>
                {ENROLLMENT_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="py-12 flex justify-center">
              <LoadingSpinner size="lg" text="Loading your enrolled courses..." />
            </div>
          ) : myEnrollments.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No courses enrolled yet"
              description="Browse the Course Catalog to find skill-building courses and start your journey."
              actionLabel="Explore Catalog"
              onAction={() => setActiveTab('catalog')}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myEnrollments.map((enr) => {
                const tr = enr.training || {};
                return (
                  <div
                    key={enr._id}
                    className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <span className="text-xs font-semibold text-brand-600 uppercase tracking-wide">
                            {tr.category || 'General'}
                          </span>
                          <h4 className="font-bold text-slate-900 text-base mt-0.5">
                            {tr.title || 'Course Details'}
                          </h4>
                        </div>
                        <Badge variant={enr.status}>{enr.status}</Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 my-3 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <div>
                          <span className="text-slate-400 block">Enrolled Date:</span>
                          <span className="font-medium text-slate-700">
                            {new Date(enr.enrolledAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Difficulty:</span>
                          <span className="font-medium text-slate-700">
                            {tr.difficulty || 'BEGINNER'}
                          </span>
                        </div>
                        {enr.completedAt && (
                          <div className="col-span-2">
                            <span className="text-slate-400 block">Completed On:</span>
                            <span className="font-medium text-emerald-700 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {new Date(enr.completedAt).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Progress action buttons */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                      {enr.status === 'ENROLLED' && (
                        <>
                          <button
                            onClick={() => handleUpdateProgress(tr._id, enr._id, 'IN_PROGRESS')}
                            disabled={submitting}
                            className="btn btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                            Start Learning
                          </button>
                          <button
                            onClick={() => handleUpdateProgress(tr._id, enr._id, 'CANCELLED')}
                            disabled={submitting}
                            className="btn btn-secondary text-xs py-1.5 px-3 text-rose-600 hover:bg-rose-50 border-rose-200"
                          >
                            Cancel
                          </button>
                        </>
                      )}

                      {enr.status === 'IN_PROGRESS' && (
                        <>
                          <button
                            onClick={() => handleUpdateProgress(tr._id, enr._id, 'COMPLETED')}
                            disabled={submitting}
                            className="btn btn-primary bg-emerald-600 hover:bg-emerald-700 text-xs py-1.5 px-3 flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Mark Complete
                          </button>
                          <button
                            onClick={() => handleUpdateProgress(tr._id, enr._id, 'CANCELLED')}
                            disabled={submitting}
                            className="btn btn-secondary text-xs py-1.5 px-3 text-rose-600 hover:bg-rose-50 border-rose-200"
                          >
                            Drop
                          </button>
                        </>
                      )}

                      {enr.status === 'COMPLETED' && (
                        <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Finished
                        </span>
                      )}

                      {enr.status === 'CANCELLED' && (
                        <span className="text-xs text-slate-400">Cancelled</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && enrollmentTotalPages > 1 && (
            <Pagination
              currentPage={enrollmentPage}
              totalPages={enrollmentTotalPages}
              onPageChange={(p) => setEnrollmentPage(p)}
            />
          )}
        </div>
      )}

      {/* =====================================================================
          MODAL: CREATE TRAINING (HR ONLY)
          ===================================================================== */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Training Course"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateTraining} className="space-y-4">
          <div>
            <label className="label">Course Title *</label>
            <input
              type="text"
              required
              minLength={3}
              maxLength={150}
              placeholder="e.g. Advanced TypeScript Patterns"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="input"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Category *</label>
              <input
                type="text"
                required
                minLength={2}
                placeholder="e.g. Engineering, Sales, Compliance"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Instructor *</label>
              <input
                type="text"
                required
                minLength={2}
                placeholder="Instructor or Academy name"
                value={formData.instructor}
                onChange={(e) => setFormData({ ...formData, instructor: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Duration (Minutes) *</label>
              <input
                type="number"
                required
                min={1}
                value={formData.durationMinutes}
                onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Difficulty *</label>
              <select
                value={formData.difficulty}
                onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                className="select"
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Description *</label>
            <textarea
              required
              minLength={5}
              maxLength={5000}
              rows={4}
              placeholder="Detailed syllabus, prerequisites, and learning outcomes..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="label">Enrollment Deadline</label>
              <input
                type="date"
                value={formData.enrollmentDeadline}
                onChange={(e) => setFormData({ ...formData, enrollmentDeadline: e.target.value })}
                className="input text-xs"
              />
            </div>
            <div>
              <label className="label">Start Date</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="input text-xs"
              />
            </div>
            <div>
              <label className="label">End Date</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="input text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary flex items-center gap-2"
            >
              {submitting ? <LoadingSpinner size="sm" /> : <Plus className="w-4 h-4" />}
              Create Draft Course
            </button>
          </div>
        </form>
      </Modal>

      {/* =====================================================================
          MODAL: EDIT TRAINING (HR ONLY)
          ===================================================================== */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedTraining(null);
        }}
        title="Edit Course Details"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleEditTraining} className="space-y-4">
          <div>
            <label className="label">Course Title *</label>
            <input
              type="text"
              required
              minLength={3}
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="input"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Category *</label>
              <input
                type="text"
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Instructor *</label>
              <input
                type="text"
                required
                value={formData.instructor}
                onChange={(e) => setFormData({ ...formData, instructor: e.target.value })}
                className="input"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Duration (Minutes) *</label>
              <input
                type="number"
                required
                min={1}
                value={formData.durationMinutes}
                onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Difficulty *</label>
              <select
                value={formData.difficulty}
                onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                className="select"
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Description *</label>
            <textarea
              required
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="label">Enrollment Deadline</label>
              <input
                type="date"
                value={formData.enrollmentDeadline}
                onChange={(e) => setFormData({ ...formData, enrollmentDeadline: e.target.value })}
                className="input text-xs"
              />
            </div>
            <div>
              <label className="label">Start Date</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="input text-xs"
              />
            </div>
            <div>
              <label className="label">End Date</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="input text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                setShowEditModal(false);
                setSelectedTraining(null);
              }}
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
              Save Changes
            </button>
          </div>
        </form>
      </Modal>

      {/* =====================================================================
          MODAL: ENROLLMENT ROSTER (HR / MANAGER)
          ===================================================================== */}
      <Modal
        isOpen={showRosterModal}
        onClose={() => {
          setShowRosterModal(false);
          setSelectedTraining(null);
          setRosterData([]);
        }}
        title={`Course Enrollees: ${selectedTraining?.title || ''}`}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          {rosterLoading ? (
            <div className="py-8 flex justify-center">
              <LoadingSpinner size="md" text="Loading enrollees..." />
            </div>
          ) : rosterData.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              No employees are currently enrolled in this course.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-96">
              <table className="table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Enrolled Date</th>
                    <th>Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rosterData.map((r) => {
                    const emp = r.employee || {};
                    return (
                      <tr key={r._id}>
                        <td className="font-medium text-slate-900">
                          <div>{emp.name || 'Unknown'}</div>
                          <div className="text-xs text-slate-400 font-normal">{emp.email}</div>
                        </td>
                        <td className="text-slate-600">{emp.department || '—'}</td>
                        <td className="text-slate-600">
                          {new Date(r.enrolledAt).toLocaleDateString()}
                        </td>
                        <td>
                          <Badge variant={r.status}>{r.status}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                setShowRosterModal(false);
                setSelectedTraining(null);
                setRosterData([]);
              }}
              className="btn btn-secondary"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
