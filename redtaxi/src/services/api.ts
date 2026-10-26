/**
 * JittaDrives Admin Frontend - API Client & Services Layer
 * Integrates the Admin React UI with the PHP REST backend (/api/v1)
 */

export interface ApiResponse<T = any> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  meta?: any;
  errors?: any;
  timestamp: string;
}

export function resolveApiBase(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1';

    if (isLocal && window.location.port === '8000') {
      return '/api/v1';
    }

    // In production (e.g. xiadot.com/jittadrivers/admin), ALWAYS dynamically derive the API base from window.location
    if (!isLocal) {
      const knownRoutes = ['admin', 'user', 'customer', 'driver'];
      const segments = window.location.pathname.split('/').filter(Boolean);
      if (segments.length > 0 && !knownRoutes.includes(segments[0].toLowerCase())) {
        return '/' + segments[0] + '/api/v1';
      }
      return '/api/v1';
    }
  }

  if (import.meta.env.VITE_API_BASE_URL) {
    const raw = (import.meta.env.VITE_API_BASE_URL as string).trim().replace(/\/$/, '');
    if (raw.endsWith('/api/v1')) return raw;
    if (raw.endsWith('/api')) return raw + '/v1';
    return raw + '/api/v1';
  }

  const knownRoutes = ['admin', 'user', 'customer', 'driver'];
  const segments = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean) : [];
  if (segments.length > 0 && !knownRoutes.includes(segments[0].toLowerCase())) {
    return '/' + segments[0] + '/api/v1';
  }
  return '/api/v1';
}

const API_BASE = resolveApiBase();

// Token Storage Key
const ADMIN_TOKEN_KEY = 'redtaxi_admin_token';

export const tokenStorage = {
  getAdminToken: (): string | null => localStorage.getItem(ADMIN_TOKEN_KEY),
  setAdminToken: (token: string): void => localStorage.setItem(ADMIN_TOKEN_KEY, token),
  clearAdminToken: (): void => localStorage.removeItem(ADMIN_TOKEN_KEY),
};

/**
 * Generic API request wrapper with Bearer token injection
 */
export async function request<T = any>(
  endpoint: string,
  options: RequestInit = {},
  tokenType: 'admin' | 'none' = 'none'
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (tokenType === 'admin') {
    const token = tokenStorage.getAdminToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      headers['X-Auth-Token'] = token;
      headers['X-Admin-Token'] = token;
    }
  }

  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const text = await response.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (json && typeof json === 'object') {
      return json as ApiResponse<T>;
    }

    return {
      success: false,
      statusCode: response.status || 500,
      message: response.status === 503 || response.status === 500
        ? 'Database connection error: Please verify server database credentials in api/.env or open api/setup.php to configure.'
        : (response.statusText || 'Server unavailable'),
      data: null as unknown as T,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      success: false,
      statusCode: 500,
      message: err?.message || 'Network error or server unavailable',
      data: null as unknown as T,
      timestamp: new Date().toISOString(),
    };
  }
}

// =============================================================================
// Authentication Service (Admin only)
// =============================================================================
export const authApi = {
  adminLogin: (data: { email: string; password: string }) =>
    request<{ token: string; tokenType: string; admin: any }>(
      '/auth/admin/login',
      { method: 'POST', body: JSON.stringify(data) }
    ),

  logout: () =>
    request('/auth/logout', { method: 'POST' }),

  getMe: (role: 'admin') =>
    request<any>('/auth/me', { method: 'GET' }, role),
};