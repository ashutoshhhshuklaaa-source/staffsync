import React from 'react';

export const Badge = ({ children, variant, size = 'md' }) => {
  const normalized = (children || variant || '').toString().toUpperCase();

  let styles = 'bg-slate-100 text-slate-700 border-slate-200';

  // Attendance
  if (normalized === 'PRESENT') {
    styles = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (normalized === 'LATE') {
    styles = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (normalized === 'HALF_DAY') {
    styles = 'bg-orange-50 text-orange-700 border-orange-200';
  } else if (normalized === 'ABSENT') {
    styles = 'bg-rose-50 text-rose-700 border-rose-200';
  }

  // Leave & Request statuses
  else if (normalized === 'APPROVED') {
    styles = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (normalized === 'PENDING') {
    styles = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (normalized === 'REJECTED') {
    styles = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (normalized === 'CANCELLED') {
    styles = 'bg-slate-100 text-slate-600 border-slate-200';
  }

  // Lifecycle
  else if (normalized === 'PUBLISHED') {
    styles = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (normalized === 'DRAFT') {
    styles = 'bg-slate-100 text-slate-700 border-slate-300';
  } else if (normalized === 'ARCHIVED') {
    styles = 'bg-zinc-100 text-zinc-600 border-zinc-300';
  }

  // Roles
  else if (normalized === 'HR') {
    styles = 'bg-purple-50 text-purple-700 border-purple-200';
  } else if (normalized === 'MANAGER') {
    styles = 'bg-indigo-50 text-indigo-700 border-indigo-200';
  } else if (normalized === 'EMPLOYEE') {
    styles = 'bg-blue-50 text-blue-700 border-blue-200';
  }

  // Training progress
  else if (normalized === 'ENROLLED') {
    styles = 'bg-sky-50 text-sky-700 border-sky-200';
  } else if (normalized === 'IN_PROGRESS') {
    styles = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (normalized === 'COMPLETED') {
    styles = 'bg-teal-50 text-teal-700 border-teal-200';
  }

  // Difficulty
  else if (normalized === 'BEGINNER') {
    styles = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (normalized === 'INTERMEDIATE') {
    styles = 'bg-amber-50 text-amber-700 border-amber-200';
  } else if (normalized === 'ADVANCED') {
    styles = 'bg-rose-50 text-rose-700 border-rose-200';
  }

  // Account status
  else if (normalized === 'ACTIVE' || children === true) {
    styles = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (normalized === 'INACTIVE' || children === false) {
    styles = 'bg-rose-50 text-rose-700 border-rose-200';
  }

  const sizeClasses =
    size === 'sm'
      ? 'text-[11px] px-2 py-0.5'
      : size === 'lg'
      ? 'text-sm px-3 py-1'
      : 'text-xs px-2.5 py-0.5';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border shadow-xs tracking-wide ${sizeClasses} ${styles}`}
    >
      {typeof children === 'boolean' ? (children ? 'Active' : 'Inactive') : children}
    </span>
  );
};

export default Badge;
