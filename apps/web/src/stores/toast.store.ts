import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  createdAt: number;
  link?: string;
  planetId?: string;
}

interface ToastState {
  toasts: Toast[];
  addToast: (message: string, variant?: ToastVariant, link?: string, planetId?: string) => void;
  removeToast: (id: string) => void;
}

// Auto-dismiss is owned by the Toaster component so it can pause on hover/focus
// (WCAG 2.2.1 Timing Adjustable). The store only manages the list.
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, variant = 'info', link, planetId) => {
    const id = crypto.randomUUID();
    const createdAt = Date.now();
    set((s) => ({ toasts: [...s.toasts, { id, message, variant, createdAt, link, planetId }] }));
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
