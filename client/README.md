# StaffSync HRMS — Client Application

Modern React 19 single-page application built with Vite 8, Tailwind CSS v3, React Router v7, Axios, and Lucide React.

## 🛠️ Tech Stack
- **Framework**: React 19
- **Build Tool**: Vite 8
- **Styling**: Tailwind CSS 3.4 with PostCSS & Autoprefixer
- **Routing**: React Router 7 (`react-router-dom`)
- **API Client**: Axios (with JWT interceptors and auto-logout on token expiration)
- **Icons**: Lucide React

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```
Ensure `VITE_API_BASE_URL` points to either the live backend or local backend:
```env
# Production Live Backend
VITE_API_BASE_URL=https://staffsync-ipyu.onrender.com

# Or Local Backend
# VITE_API_BASE_URL=http://localhost:5000
```

### 3. Run Development Server
```bash
npm run dev
```
Open `http://localhost:5173/` in your browser.

### 4. Build for Production
```bash
npm run build
npm run preview
```

## 📁 Project Structure
```
src/
├── assets/           # Static assets and icons
├── components/
│   ├── common/       # Badges, Modals, Pagination, StatCards, Spinners, Empty states
│   └── layout/       # Sidebar, Navbar, and DashboardLayout shell
├── context/
│   ├── AuthContext   # JWT authentication state, role helpers (isHR, isManager, isEmployee)
│   └── ToastContext  # Global notifications (success, error, warning, info)
├── pages/
│   ├── auth/         # LoginPage, RegisterPage
│   ├── dashboard/    # Executive Dashboard Overview
│   ├── employees/    # Employee Directory & Staff Management
│   ├── attendance/   # Clock-in/out, History, Team logs, HR Corrections
│   ├── leaves/       # Balances, Applications, Approvals/Rejections
│   ├── announcements/# Corporate notices & drafts
│   ├── trainings/    # Catalog, Course Enrollment, My Learning, Rosters
│   ├── profile/      # User Profile, Balance summary, Account details
│   └── NotFoundPage  # 404 Route
├── routes/
│   └── ProtectedRoute# Auth and role-gated route protection
└── services/
    └── api.js        # Centralized Axios API service with auth interceptors
```
