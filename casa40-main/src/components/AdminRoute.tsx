import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';

const ALLOWED_ROLES = ['ADMIN'] as const;

const AdminRoute = () => {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ role: string }>('/api/auth/me')
      .then((user) => {
        setAuthorized(ALLOWED_ROLES.includes(user.role as typeof ALLOWED_ROLES[number]));
      })
      .catch((_err: unknown) => {
        setAuthorized(false);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!authorized) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
};

export default AdminRoute;
