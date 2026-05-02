import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/app/store/auth.store';
import { decodeToken } from '@/lib/auth/token';

// Only works on localhost — safe to hardcode dev creds here.
const DEV_CREDS = {
  email: 'rakesh@all-medical-tenants.dev',
  password: 'Local1234!',
  tenantSlug: 'all-medical-tenants',
};

export function DevAutoLogin() {
  const navigate = useNavigate();
  const { setTokens, setUser } = useAuthStore();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    if (window.location.hostname !== 'localhost') {
      navigate('/login', { replace: true });
      return;
    }

    apiClient.post('/api/auth/login', DEV_CREDS).then((res) => {
      const { accessToken, refreshToken, user } = res.data.data;
      const payload = decodeToken(accessToken);
      setTokens(accessToken, refreshToken);
      setUser({
        ...user,
        id: user.id ?? payload?.sub ?? '',
        tenantId: user.tenantId ?? payload?.tenantId ?? '',
        permissions: payload?.permissions ?? {},
      });
      navigate('/dashboard', { replace: true });
    }).catch(() => {
      navigate('/login?slug=all-medical-tenants', { replace: true });
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500 text-sm">Logging in...</p>
    </div>
  );
}
