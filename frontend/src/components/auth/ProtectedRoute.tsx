import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { UserRole, User } from '../../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const location = useLocation();
  const token = localStorage.getItem('brightloop_token');
  const userJson = localStorage.getItem('brightloop_user');

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  let user: User | null = null;
  try {
    user = userJson ? JSON.parse(userJson) : null;
  } catch {
    user = null;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!user || !allowedRoles.includes(user.role)) {
      // If customer tries to access admin routes, redirect to customer portal
      if (user?.role === 'CUSTOMER') {
        return <Navigate to="/portal" replace />;
      }
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
