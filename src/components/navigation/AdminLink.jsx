import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

const AdminLink = ({ user }) => {
  // Check both metadata locations for the 'Admin' role
  const isAdmin = user?.app_metadata?.role === 'Admin' || user?.user_metadata?.role === 'Admin';

  if (!isAdmin) return null;

  return (
    <Link
      to="/admin"
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors border border-blue-100"
    >
      <ShieldCheck size={16} />
      <span>Admin Central</span>
    </Link>
  );
};

export default AdminLink;
