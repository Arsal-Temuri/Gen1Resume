import { useCallback, useState } from 'react';

export type ToastTone = 'neutral' | 'success' | 'warning' | 'error';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (title: string, options: { description?: string; tone?: ToastTone; durationMs?: number } = {}) => {
      const id = `toast_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const tone = options.tone ?? 'neutral';
      setToasts((prev) => [...prev.slice(-3), { id, title, description: options.description, tone }]);

      const duration = options.durationMs ?? 4200;
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    []
  );

  return { toasts, pushToast, dismissToast };
}
