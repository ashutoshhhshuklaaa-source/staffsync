import React from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion, Home, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
      <div className="w-20 h-20 bg-brand-50 text-brand-600 rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-brand-100">
        <FileQuestion className="w-10 h-10" />
      </div>
      <span className="text-sm font-bold text-brand-600 uppercase tracking-widest mb-1">
        Error 404
      </span>
      <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl mb-3">
        Page Not Found
      </h1>
      <p className="text-slate-500 max-w-md mb-8 text-sm">
        The page you are looking for doesn't exist, has been removed, or you don't have access to view it.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <button
          onClick={() => window.history.back()}
          className="btn btn-secondary inline-flex items-center gap-2 text-sm w-full sm:w-auto"
        >
          <ArrowLeft className="w-4 h-4" />
          Go Back
        </button>
        <Link
          to="/dashboard"
          className="btn btn-primary inline-flex items-center gap-2 text-sm w-full sm:w-auto shadow-sm"
        >
          <Home className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
