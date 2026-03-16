import { create } from 'zustand';

interface AdminUser {
  id: string;
  email: string;
  username: string;
  isAdmin: boolean;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AdminUser | null;
  setAuth: (accessToken: string, refreshToken: string, user: AdminUser) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: localStorage.getItem('admin_accessToken'),
  refreshToken: localStorage.getItem('admin_refreshToken'),
  user: JSON.parse(localStorage.getItem('admin_user') ?? 'null'),

  setAuth: (accessToken, refreshToken, user) => {
    localStorage.setItem('admin_accessToken', accessToken);
    localStorage.setItem('admin_refreshToken', refreshToken);
    localStorage.setItem('admin_user', JSON.stringify(user));
    set({ accessToken, refreshToken, user });
  },

  clearAuth: () => {
    localStorage.removeItem('admin_accessToken');
    localStorage.removeItem('admin_refreshToken');
    localStorage.removeItem('admin_user');
    set({ accessToken: null, refreshToken: null, user: null });
  },
}));
