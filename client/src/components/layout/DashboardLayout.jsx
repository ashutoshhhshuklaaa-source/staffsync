import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';

export const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  // Map route to friendly title
  const getPageTitle = (pathname) => {
    if (pathname.startsWith('/dashboard')) return 'Dashboard Overview';
    if (pathname.startsWith('/employees')) return 'Employee Directory';
    if (pathname.startsWith('/attendance')) return 'Attendance & Time Tracking';
    if (pathname.startsWith('/leaves')) return 'Leave Management';
    if (pathname.startsWith('/announcements')) return 'Company Announcements';
    if (pathname.startsWith('/trainings')) return 'Training & Development';
    if (pathname.startsWith('/profile')) return 'My Profile & Account';
    return 'StaffSync HRMS';
  };

  const title = getPageTitle(location.pathname);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar Navigation */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Top Navbar */}
        <Navbar onOpenSidebar={() => setSidebarOpen(true)} pageTitle={title} />

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
