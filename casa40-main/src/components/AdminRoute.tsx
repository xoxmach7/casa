import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api, getAuthToken, setAuthToken, ApiError } from '@/lib/api-client';

// Only these backend roles may use the casa40 admin panel — mirrors the old
// Supabase RPC role check, now against the real CASA Pro user table.
const ALLOWED_ROLES = ['ADMIN'] as const;

const AdminRoute = () => {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get<{ role: string }>('/api/auth/me')
      .then((user) => {
        setAuthorized(ALLOWED_ROLES.includes(user.role as typeof ALLOWED_ROLES[number]));
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          setAuthToken(null);
        }
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

  if (!getAuthToken()) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!authorized) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default AdminRoute;
