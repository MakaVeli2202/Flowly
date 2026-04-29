import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

/**
 * ProtectedRoute — UX convenience gate only.
 *
 * The role checks below (requireAdmin, requireCustomer) prevent unauthorised
 * users from seeing admin/worker page layouts, but they are NOT a security
 * boundary. Any user who manipulates client-side state can bypass this gate
 * and see the page shell.  This is acceptable because every admin/worker API
 * endpoint is independently protected with [Authorize(Roles = "Admin")] or
 * [Authorize(Roles = "Admin,Employee")] on the server, so no actual data or
 * action is exposed even if the page renders.
 *
 * IMPORTANT: Never add server calls to admin endpoints without a corresponding
 * [Authorize(Roles = "Admin")] attribute on the backend controller action.
 */
function ProtectedRoute({ children, requireAdmin = false, requireCustomer = false }) {
  const { isAuthenticated, isAdmin, isEmployee, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (requireCustomer && !isAdmin && isEmployee) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;