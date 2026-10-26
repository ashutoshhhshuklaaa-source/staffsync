import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const cached = localStorage.getItem('staffsync_user');
    return cached ? JSON.parse(cached) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('staffsync_token') || null);
  const [loading, setLoading] = useState(true);

  // Validate session on mount
  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      const storedToken = localStorage.getItem('staffsync_token');
      if (!storedToken) {
        if (isMounted) {
          setUser(null);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await authAPI.getMe();
        if (isMounted && response.data?.success && response.data?.user) {
          setUser(response.data.user);
          localStorage.setItem('staffsync_user', JSON.stringify(response.data.user));
        }
      } catch (err) {
        // Token expired or invalid
        if (isMounted) {
          localStorage.removeItem('staffsync_token');
          localStorage.removeItem('staffsync_user');
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email, password) => {
    const res = await authAPI.login({ email, password });
    if (res.data?.success && res.data?.token) {
      const authToken = res.data.token;
      const authUser = res.data.user;

      localStorage.setItem('staffsync_token', authToken);
      localStorage.setItem('staffsync_user', JSON.stringify(authUser));
      setToken(authToken);
      setUser(authUser);
      return authUser;
    }
    throw new Error(res.data?.message || 'Login failed');
  };

  const register = async (userData) => {
    const res = await authAPI.register(userData);
    if (res.data?.success && res.data?.token) {
      const authToken = res.data.token;
      const authUser = res.data.user;

      localStorage.setItem('staffsync_token', authToken);
      localStorage.setItem('staffsync_user', JSON.stringify(authUser));
      setToken(authToken);
      setUser(authUser);
      return authUser;
    }
    throw new Error(res.data?.message || 'Registration failed');
  };

  const logout = useCallback(() => {
    localStorage.removeItem('staffsync_token');
    localStorage.removeItem('staffsync_user');
    setUser(null);
    setToken(null);
  }, []);

  const updateCurrentUser = (updatedData) => {
    setUser((prev) => {
      const nextUser = { ...prev, ...updatedData };
      localStorage.setItem('staffsync_user', JSON.stringify(nextUser));
      return nextUser;
    });
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token && !!user,
    isHR: user?.role === 'HR',
    isManager: user?.role === 'MANAGER',
    isEmployee: user?.role === 'EMPLOYEE',
    canReviewLeaves: user?.role === 'HR' || user?.role === 'MANAGER',
    canManageEmployees: user?.role === 'HR',
    canManageAnnouncements: user?.role === 'HR',
    canManageTrainings: user?.role === 'HR',
    login,
    register,
    logout,
    updateCurrentUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
