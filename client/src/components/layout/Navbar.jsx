import React, { useState, useEffect } from 'react';
import { Menu, Wifi, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../services/api';
import { Badge } from '../common/Badge';

export const Navbar = ({ onOpenSidebar, pageTitle }) => {
  const { user } = useAuth();
  const [backendStatus, setBackendStatus] = useState('checking'); // 'connected', 'error', 'checking'

  useEffect(() => {
    let isMounted = true;
    const checkBackend = async () => {
      try {
        const res = await authAPI.getHealth();
        if (isMounted && res.data?.status === 'ok') {
          setBackendStatus('connected');
        } else {
          setBackendStatus('error');
        }
      } catch (err) {
        if (isMounted) setBackendStatus('error');
      }
    };

    checkBackend();
    const interval = setInterval(checkBackend, 60000); // Check health every 60s

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 lg:px-8">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenSidebar}
          className="lg:hidden p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {pageTitle && (
          <h1 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
            {pageTitle}
          </h1>
        )}
      </div>

      {/* Right: Backend Live Connection Status & User Badge */}
      <div className="flex items-center gap-4">
        {/* Backend Status indicator */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-slate-50 border-slate-200 text-slate-600">
          <span
            className={`w-2 h-2 rounded-full ${
              backendStatus === 'connected'
                ? 'bg-emerald-500 animate-pulse'
                : backendStatus === 'checking'
                ? 'bg-amber-400'
                : 'bg-rose-500'
            }`}
          />
          <span className="text-[11px]">
            {backendStatus === 'connected'
              ? 'Backend Live'
              : backendStatus === 'checking'
              ? 'Connecting...'
              : 'Backend Offline'}
          </span>
        </div>

        {/* User Pill */}
        {user && (
          <div className="flex items-center gap-2.5 pl-2 sm:border-l sm:border-slate-200">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs border border-blue-200">
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="hidden md:block text-left">
              <span className="text-xs font-semibold text-slate-800 block leading-tight">
                {user.name}
              </span>
              <span className="text-[10px] text-slate-500 block leading-none mt-0.5">
                {user.department || user.role}
              </span>
            </div>
            <div className="hidden sm:block">
              <Badge variant={user.role} size="sm">
                {user.role}
              </Badge>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
