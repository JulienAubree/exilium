import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  createdAt: number;
  link?: string;
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, variant?: ToastVariant, link?: string) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, variant = 'info', link) => {
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    set((s) => ({ toasts: [...s.toasts, { id, message, variant, createdAt, link }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 5000);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
