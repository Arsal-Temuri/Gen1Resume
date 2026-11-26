import React from 'react';
import { AlertCircle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import type { ToastMessage } from '../../hooks/useToast';

export const ToastContainer: React.FC<{
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none no-print"
    >
      {toasts.map((toast) => {
        const icon =
          toast.tone === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#059669] dark:text-emerald-400 shrink-0 mt-0.5" />
          ) : toast.tone === 'warning' ? (
            <AlertCircle className="w-4 h-4 text-[#D97706] dark:text-amber-400 shrink-0 mt-0.5" />
          ) : toast.tone === 'error' ? (
            <XCircle className="w-4 h-4 text-[#DC2626] dark:text-red-400 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-4 h-4 text-[#52525B] dark:text-[#A1A1AA] shrink-0 mt-0.5" />
          );

        return (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] shadow-md text-sm"
          >
            {icon}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-[#09090B] dark:text-[#FAFAFA]">{toast.title}</p>
              {toast.description && (
                <p className="mt-0.5 text-xs text-[#52525B] dark:text-[#A1A1AA]">
                  {toast.description}
                </p>
              )}
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => onDismiss(toast.id)}
              className="text-[#71717A] hover:text-[#09090B] dark:hover:text-[#FAFAFA] p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
