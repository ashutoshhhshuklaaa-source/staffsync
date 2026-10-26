import React, { useState, useEffect } from 'react';
import {
  Megaphone,
  Plus,
  Search,
  Filter,
  Calendar,
  Send,
  Archive,
  Edit2,
  Clock,
  User,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { announcementAPI } from '../../services/api';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { Pagination } from '../../components/common/Pagination';
import { LoadingSpinner, TableSkeleton } from '../../components/common/LoadingSpinner';
import { EmptyState } from '../../components/common/EmptyState';

export const AnnouncementsPage = () => {
  const { user, isHR } = useAuth();
  const { toastSuccess, toastError } = useToast();

  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [audienceFilter, setAudienceFilter] = useState('');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    audience: 'ALL',
    expiresAt: '',
  });

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);

      const params = {
        page,
        limit: 10,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(audienceFilter ? { audience: audienceFilter } : {}),
      };

      let res;
      if (isHR) {
        res = await announcementAPI.getAll(params);
      } else {
        res = await announcementAPI.getMe(params);
      }

      if (res.data?.success) {
        setAnnouncements(res.data.data || []);
        setPagination(res.data.pagination);
      }
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, [page, statusFilter, audienceFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchAnnouncements();
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // Handle Create Draft (HR only)
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) {
      toastError('Title and content are required');
      return;
    }

    try {
      setFormSubmitting(true);
      const res = await announcementAPI.create({
        title: formData.title.trim(),
        content: formData.content.trim(),
        audience: formData.audience,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : undefined,
      });

      if (res.data?.success) {
        toastSuccess('Announcement draft created successfully!');
        setCreateModalOpen(false);
        setFormData({ title: '', content: '', audience: 'ALL', expiresAt: '' });
        fetchAnnouncements();
      }
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to create announcement');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (item) => {
    setSelectedAnnouncement(item);
    setFormData({
      title: item.title,
      content: item.content,
      audience: item.audience || 'ALL',
      expiresAt: item.expiresAt ? new Date(item.expiresAt).toISOString().split('T')[0] : '',
    });
    setEditModalOpen(true);
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAnnouncement) return;

    try {
      setFormSubmitting(true);
      const res = await announcementAPI.update(selectedAnnouncement._id, {
        title: formData.title.trim(),
        content: formData.content.trim(),
        audience: formData.audience,
        expiresAt: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null,
      });

      if (res.data?.success) {
        toastSuccess('Announcement updated successfully!');
        setEditModalOpen(false);
        fetchAnnouncements();
      }
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to update announcement');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle Publish Draft (HR only)
  const handlePublish = async (id) => {
    try {
      const res = await announcementAPI.publish(id);
      if (res.data?.success) {
        toastSuccess('Announcement published to organization feed!');
        fetchAnnouncements();
      }
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to publish announcement');
    }
  };

  // Handle Archive (HR only)
  const handleArchive = async (id) => {
    if (!window.confirm('Are you sure you want to archive this announcement?')) return;

    try {
      const res = await announcementAPI.archive(id);
      if (res.data?.success) {
        toastSuccess('Announcement archived');
        fetchAnnouncements();
      }
    } catch (err) {
      toastError(err.response?.data?.message || 'Failed to archive announcement');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Company Announcements
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Stay informed with important updates, corporate guidelines, and organizational memos
          </p>
        </div>

        {isHR && (
          <button
            onClick={() => {
              setFormData({ title: '', content: '', audience: 'ALL', expiresAt: '' });
              setCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-md shadow-blue-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Announcement</span>
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search notices by keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>

        {isHR && (
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="PUBLISHED">Published</option>
              <option value="DRAFT">Draft</option>
              <option value="ARCHIVED">Archived</option>
            </select>

            <select
              value={audienceFilter}
              onChange={(e) => {
                setAudienceFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Audiences</option>
              <option value="ALL">Everyone (ALL)</option>
              <option value="EMPLOYEE">Employees Only</option>
              <option value="MANAGER">Managers Only</option>
              <option value="HR">HR Only</option>
            </select>
          </div>
        )}
      </div>

      {/* Announcements Feed / Grid */}
      {loading ? (
        <div className="space-y-4">
          <div className="h-32 bg-slate-100 rounded-3xl animate-pulse" />
          <div className="h-32 bg-slate-100 rounded-3xl animate-pulse" />
        </div>
      ) : announcements.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No announcements posted"
          description="There are currently no announcements matching your filters."
        />
      ) : (
        <div className="space-y-4">
          {announcements.map((item) => (
            <div
              key={item._id}
              className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs hover:border-slate-300 transition-all"
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h3 className="text-base font-bold text-slate-900">{item.title}</h3>
                  <Badge variant={item.audience} size="sm">
                    {item.audience === 'ALL' ? 'All Staff' : `${item.audience} Only`}
                  </Badge>
                  {isHR && (
                    <Badge variant={item.status} size="sm">
                      {item.status}
                    </Badge>
                  )}
                </div>

                {/* HR Lifecycle Controls */}
                {isHR && (
                  <div className="flex items-center gap-2">
                    {item.status === 'DRAFT' && (
                      <button
                        onClick={() => handlePublish(item._id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-semibold border border-emerald-200 transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Publish</span>
                      </button>
                    )}

                    {item.status !== 'ARCHIVED' && (
                      <button
                        onClick={() => openEditModal(item)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit notice"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}

                    {item.status !== 'ARCHIVED' && (
                      <button
                        onClick={() => handleArchive(item._id)}
                        className="p-1.5 text-slate-500 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
                        title="Archive notice"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Notice Content */}
              <p className="text-xs sm:text-sm text-slate-600 whitespace-pre-line leading-relaxed">
                {item.content}
              </p>

              {/* Metadata Footer */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{item.createdBy?.name || 'HR Department'}</span>
                  </span>
                  <span>&bull;</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {item.publishedAt
                        ? `Published ${new Date(item.publishedAt).toLocaleDateString()}`
                        : `Drafted ${new Date(item.createdAt).toLocaleDateString()}`}
                    </span>
                  </span>
                </div>

                {item.expiresAt && (
                  <span className="text-amber-600 font-medium flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Expires {new Date(item.expiresAt).toLocaleDateString()}</span>
                  </span>
                )}
              </div>
            </div>
          ))}

          <Pagination pagination={pagination} onPageChange={(p) => setPage(p)} />
        </div>
      )}

      {/* Modal: Create Announcement */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create Company Announcement"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. Annual Company Offsite 2026 Announcement"
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Content <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={5}
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Provide complete notice details (min. 5 characters)..."
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Audience</label>
              <select
                value={formData.audience}
                onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Everyone (ALL)</option>
                <option value="EMPLOYEE">Employees Only</option>
                <option value="MANAGER">Managers Only</option>
                <option value="HR">HR Only</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Expiration Date (optional)
              </label>
              <input
                type="date"
                value={formData.expiresAt}
                onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setCreateModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50"
            >
              {formSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Draft</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Announcement */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Announcement"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Content</label>
            <textarea
              required
              rows={5}
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Audience</label>
              <select
                value={formData.audience}
                onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Everyone (ALL)</option>
                <option value="EMPLOYEE">Employees Only</option>
                <option value="MANAGER">Managers Only</option>
                <option value="HR">HR Only</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Expiration Date (optional)
              </label>
              <input
                type="date"
                value={formData.expiresAt}
                onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl disabled:opacity-50"
            >
              {formSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <span>Update Notice</span>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AnnouncementsPage;
