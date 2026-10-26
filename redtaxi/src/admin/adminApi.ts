import { request } from '../services/api';

export const adminApi = {
  getDashboard: () =>
    request<any>('/admin/dashboard', { method: 'GET' }, 'admin'),

  getCustomers: (params?: { limit?: number; offset?: number; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    if (params?.search) q.set('search', params.search);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<{ customers: any[]; total: number; limit: number; offset: number }>(
      `/admin/customers${qs}`,
      { method: 'GET' },
      'admin'
    );
  },

  updateCustomerStatus: (id: string, status: 'ACTIVE' | 'BLOCKED') =>
    request<any>(
      `/admin/customers/${id}/status`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
      'admin'
    ),

  deleteCustomer: (id: string) =>
    request<any>(`/admin/customers/${id}`, { method: 'DELETE' }, 'admin'),

  deleteDriver: (id: string) =>
    request<any>(`/admin/drivers/${id}`, { method: 'DELETE' }, 'admin'),

  getDrivers: (params?: { limit?: number; offset?: number; approval_status?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    if (params?.approval_status) q.set('approval_status', params.approval_status);
    if (params?.search) q.set('search', params.search);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<{ drivers: any[]; total: number; limit: number; offset: number }>(
      `/admin/drivers${qs}`,
      { method: 'GET' },
      'admin'
    );
  },

  updateDriverApproval: (id: string, approval_status: 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'PENDING') =>
    request<any>(
      `/admin/drivers/${id}/approval`,
      { method: 'PATCH', body: JSON.stringify({ approval_status }) },
      'admin'
    ),

  updateDriverStatus: (id: string, is_online: boolean) =>
    request<any>(
      `/admin/drivers/${id}/status`,
      { method: 'PATCH', body: JSON.stringify({ is_online }) },
      'admin'
    ),

  getDriverDocuments: (id: string) =>
    request<{ success: boolean; driver_id: number; documents: any[]; driver: any }>(
      `/admin/drivers/${id}/documents`,
      { method: 'GET' },
      'admin'
    ),

  getVehicles: () =>
    request<{ categories: any[] }>('/admin/vehicles', { method: 'GET' }, 'admin'),

  getPartnerVehicles: (params?: { limit?: number; offset?: number; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    if (params?.search) q.set('search', params.search);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<{ vehicles: any[]; total: number; limit: number; offset: number }>(
      `/admin/partner-vehicles${qs}`,
      { method: 'GET' },
      'admin'
    );
  },

  updateVehicleCategory: (id: string, data: any) =>
    request<any>(
      `/admin/vehicles/${id}`,
      { method: 'PUT', body: JSON.stringify(data) },
      'admin'
    ),

  toggleVehicleCategory: (id: string) =>
    request<any>(
      `/admin/vehicles/${id}/toggle`,
      { method: 'PATCH' },
      'admin'
    ),

  getBookings: (params?: { limit?: number; offset?: number; status?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    if (params?.status) q.set('status', params.status);
    if (params?.search) q.set('search', params.search);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<{ bookings: any[]; total: number; limit: number; offset: number }>(
      `/admin/bookings${qs}`,
      { method: 'GET' },
      'admin'
    );
  },

  getBookingDetail: (id: string) =>
    request<any>(`/admin/bookings/${id}`, { method: 'GET' }, 'admin'),

  assignDriver: (bookingId: string, driverId: string) =>
    request<any>(
      `/admin/bookings/${bookingId}/assign`,
      { method: 'POST', body: JSON.stringify({ driver_id: driverId }) },
      'admin'
    ),

  updateBookingStatus: (id: string, status: string) =>
    request<any>(
      `/admin/bookings/${id}/status`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
      'admin'
    ),

  getFareRules: () =>
    request<{ fare_rules: any[] }>('/admin/fare-rules', { method: 'GET' }, 'admin'),

  updateFareRule: (id: string, data: any) =>
    request<any>(
      `/admin/fare-rules/${id}`,
      { method: 'PUT', body: JSON.stringify(data) },
      'admin'
    ),

  getCoupons: (params?: { limit?: number; offset?: number; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    if (params?.search) q.set('search', params.search);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<{ coupons: any[]; total: number }>(`/admin/coupons${qs}`, { method: 'GET' }, 'admin');
  },

  createCoupon: (data: any) =>
    request<any>('/admin/coupons', { method: 'POST', body: JSON.stringify(data) }, 'admin'),

  toggleCoupon: (id: string) =>
    request<any>(`/admin/coupons/${id}/toggle`, { method: 'PATCH' }, 'admin'),

  deleteCoupon: (id: string) =>
    request<any>(`/admin/coupons/${id}`, { method: 'DELETE' }, 'admin'),

  getOffers: () =>
    request<{ offers: any[] }>('/admin/offers', { method: 'GET' }, 'admin'),

  createOffer: (data: any) =>
    request<any>('/admin/offers', { method: 'POST', body: JSON.stringify(data) }, 'admin'),

  toggleOffer: (id: string) =>
    request<any>(`/admin/offers/${id}/toggle`, { method: 'PATCH' }, 'admin'),

  deleteOffer: (id: string) =>
    request<any>(`/admin/offers/${id}`, { method: 'DELETE' }, 'admin'),

  getWalletAudit: () =>
    request<any>('/admin/wallets', { method: 'GET' }, 'admin'),

  getPayments: (params?: { limit?: number; offset?: number; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.offset) q.set('offset', String(params.offset));
    if (params?.search) q.set('search', params.search);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<{ payments: any[]; total: number }>(`/admin/payments${qs}`, { method: 'GET' }, 'admin');
  },

  getSosAlerts: (params?: { status?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<any[]>(`/admin/sos-alerts${qs}`, { method: 'GET' }, 'admin');
  },

  resolveSos: (id: string, status: 'RESOLVED' | 'FALSE_ALARM', notes?: string) =>
    request<any>(
      `/admin/sos-alerts/${id}/resolve`,
      { method: 'PATCH', body: JSON.stringify({ status, notes }) },
      'admin'
    ),

  getSupportTickets: (params?: { status?: string; search?: string; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.search) q.set('search', params.search);
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString() ? `?${q.toString()}` : '';
    return request<{ tickets: any[]; total: number }>(`/admin/support-tickets${qs}`, { method: 'GET' }, 'admin');
  },

  getSupportTicketMessages: (id: string) =>
    request<{ messages: any[] }>(`/admin/support-tickets/${id}/messages`, { method: 'GET' }, 'admin'),

  updateSupportTicketStatus: (id: string, status: string) =>
    request<any>(
      `/admin/support-tickets/${id}/status`,
      { method: 'PATCH', body: JSON.stringify({ status }) },
      'admin'
    ),

  replySupportTicket: (id: string, message: string) =>
    request<any>(
      `/admin/support-tickets/${id}/reply`,
      { method: 'POST', body: JSON.stringify({ message }) },
      'admin'
    ),

  getNotifications: (limit?: number) =>
    request<{ notifications: any[] }>(
      `/admin/notifications${limit ? `?limit=${limit}` : ''}`,
      { method: 'GET' },
      'admin'
    ),

  broadcastNotification: (data: { title: string; message: string; audience: string }) =>
    request<any>('/admin/notifications/broadcast', { method: 'POST', body: JSON.stringify(data) }, 'admin'),

  getSettings: () =>
    request<any>('/admin/settings', { method: 'GET' }, 'admin'),

  saveSettings: (data: any) =>
    request<any>('/admin/settings', { method: 'PUT', body: JSON.stringify(data) }, 'admin'),
};