import { useEffect } from "react";
import { CheckCircle, XCircle, AlertTriangle, X } from "lucide-react";

export type ToastVariant = "success" | "error" | "warning";

export interface ToastMessage {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface Props {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const icons = {
  success: <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />,
  error: <XCircle size={16} className="text-red-500 flex-shrink-0" />,
  warning: <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />,
};

const AUTO_DISMISS_MS = 4000;

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="flex items-center gap-2.5 bg-white rounded-lg shadow-lg border border-slate-200 px-4 py-3 max-w-sm w-full animate-in">
      {icons[toast.variant]}
      <span className="text-sm text-slate-700 flex-1">{toast.message}</span>
      <button onClick={onDismiss} className="text-slate-400 hover:text-slate-600 transition-colors ml-1">
        <X size={14} />
      </button>
    </div>
  );
}

export default function Toast({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 items-end">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}
