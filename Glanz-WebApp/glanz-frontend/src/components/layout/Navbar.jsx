import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { CustomerNavbar } from './CustomerNavbar';
import { AdminHeader } from './AdminHeader';

function Navbar({ theme, onToggleTheme }) {
  const { isAdmin } = useAuth();
  const location = useLocation();
  const isAdminPath = location.pathname.startsWith('/admin');

  // Admin users always see admin header, customer pages get transparent navbar
  if (isAdmin || isAdminPath) {
    return <AdminHeader theme={theme} onToggleTheme={onToggleTheme} />;
  }

  return <CustomerNavbar theme={theme} onToggleTheme={onToggleTheme} />;
}

export default Navbar;
