# StaffSync HRMS — Enterprise Workforce Management

StaffSync is an enterprise Human Resource Management System (HRMS) built with an Express/MongoDB backend and a modern React/Vite/Tailwind CSS frontend. It provides role-based access control (RBAC) across HR, Managers, and Employees.

---

## 🌐 Live Deployments & Repository

- **Live Backend API**: `https://staffsync-ipyu.onrender.com`
- **Backend Health Check**: `https://staffsync-ipyu.onrender.com/api/health`
- **GitHub Repository**: `https://github.com/ashutoshhhshuklaaa-source/staffsync`

---

## 🏗️ System Architecture

```
staffsync/
├── client/                     # React 19 + Vite 8 + Tailwind CSS Frontend
│   ├── src/
│   │   ├── components/         # Reusable UI (Modals, Badges, StatCards, Layout)
│   │   ├── context/            # AuthContext (JWT & RBAC) & ToastContext
│   │   ├── pages/              # Role-aware dashboard, employees, leaves, etc.
│   │   ├── routes/             # ProtectedRoute route guards
│   │   ├── services/           # Axios API instance with auth interceptor
│   │   ├── App.jsx             # React Router routing configuration
│   │   └── main.jsx            # Entry point
│   ├── .env.example            # Frontend environment variable documentation
│   └── package.json
└── server/                     # Node.js + Express + Mongoose Backend
    ├── src/
    │   ├── config/             # MongoDB connection & configurations
    │   ├── controllers/        # Auth, Employee, Leave, Attendance, Training, Announcement
    │   ├── middleware/         # JWT auth, RBAC permissions, error handling
    │   ├── models/             # Mongoose schemas & indexes
    │   └── routes/             # REST API routes
    ├── tests/                  # 79/79 Jest backend integration & unit tests
    ├── server.js               # Server entry point
    └── package.json
```

---

## 🚀 Quick Start & Local Setup

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Git**

### 2. Clone the Repository
```bash
git clone https://github.com/ashutoshhhshuklaaa-source/staffsync.git
cd staffsync
```

### 3. Frontend Setup (`client/`)
```bash
cd client

# Install dependencies (React 19, Vite 8, Tailwind CSS, Axios, Lucide React, etc.)
npm install

# Configure environment variables
cp .env.example .env
```

Edit `client/.env`:
```env
# Point to live production backend or local development backend
VITE_API_BASE_URL=https://staffsync-ipyu.onrender.com
# For local server: VITE_API_BASE_URL=http://localhost:5000
```

Start the frontend development server:
```bash
npm run dev
```
The application will be accessible at `http://localhost:5173/`.

To build the production bundle:
```bash
npm run build
npm run preview
```

### 4. Backend Setup (`server/`) [Optional if connecting to live backend]
```bash
cd ../server

# Install backend dependencies
npm install

# Configure environment variables
cp .env.example .env
```

Run tests to verify backend integrity:
```bash
npm test
```
All 79 tests should pass.

Start backend locally:
```bash
npm run dev
# Or production mode
npm start
```

---

## 🔐 Core Modules & Role-Based Permissions

StaffSync supports three distinct organizational roles:

| Module | HR | MANAGER | EMPLOYEE |
|---|---|---|---|
| **Authentication** | Login, Self-profile | Login, Self-profile | Login, Register, Self-profile |
| **Employee Directory** | Full CRUD, activate/deactivate, role assignment | View department & direct reports | Self profile only |
| **Attendance** | View organization logs, manual correction | View team attendance | Daily clock-in, clock-out, view personal history |
| **Leave Management** | View all, approve/reject, adjust policies | Approve/reject direct reports' leaves | View balance (Casual, Sick, Earned), apply, cancel pending |
| **Announcements** | Create draft, publish, archive notices | Read targeted/company notices | Read company announcements |
| **Training & Learning**| Create courses, publish, archive, view rosters | View enrolled direct reports | Browse catalog, enroll, update learning progress |

---

## 🛡️ Security & Best Practices

1. **Zero Secret Leakage**: No API keys, database URIs, or JWT secrets are exposed to the client bundle. Only `VITE_API_BASE_URL` is configured.
2. **JWT Authentication**: Automatically attached via Axios request interceptors; 401 token expiration cleanly clears the session and routes to `/login`.
3. **Route Guards**: Client routes are gated using `<ProtectedRoute>` with `allowedRoles` checks, complementing backend RBAC enforcement.
4. **Tailwind CSS Design System**: Custom enterprise color palette (`brand-50` through `brand-900`), responsive sidebar layouts, glassmorphic accents, and micro-interactions.
