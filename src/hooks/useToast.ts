import { useState, useCallback } from "react";
import type { ToastMessage, ToastVariant } from "../components/shared/Toast";

function toastId() {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const show = useCallback((message: string, variant: ToastVariant = "success") => {
    const id = toastId();
    setToasts((prev) => [...prev, { id, message, variant }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, show, dismiss };
}
