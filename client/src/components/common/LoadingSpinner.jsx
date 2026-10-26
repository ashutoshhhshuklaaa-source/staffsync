import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingSpinner = ({ text = 'Loading...', size = 'md' }) => {
  const sizeClass = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-8 h-8' : 'w-6 h-6';

  return (
    <div className="flex flex-col items-center justify-center p-8 text-slate-500">
      <Loader2 className={`${sizeClass} animate-spin text-blue-600 mb-2`} />
      {text && <span className="text-xs font-medium text-slate-500">{text}</span>}
    </div>
  );
};

export const TableSkeleton = ({ rows = 5, cols = 4 }) => {
  return (
    <div className="w-full animate-pulse space-y-3 p-4">
      <div className="h-8 bg-slate-200/80 rounded-lg w-full" />
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="flex gap-4">
          {[...Array(cols)].map((_, j) => (
            <div key={j} className="h-6 bg-slate-100 rounded-md flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
};

export default LoadingSpinner;
