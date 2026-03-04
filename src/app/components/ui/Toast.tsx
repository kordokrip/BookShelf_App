import { useEffect, useState, createContext, useContext, useCallback, type ReactNode } from "react";
import { CheckCircle, XCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  let counter = 0;

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Date.now() + counter++;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none w-full px-4 max-w-sm">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const configs: Record<ToastType, { icon: ReactNode; bg: string; text: string; border: string }> = {
    success: {
      icon: <CheckCircle size={18} />,
      bg: "#ECFDF5",
      text: "#065F46",
      border: "#A7F3D0",
    },
    error: {
      icon: <XCircle size={18} />,
      bg: "#FEF2F2",
      text: "#991B1B",
      border: "#FECACA",
    },
    info: {
      icon: <Info size={18} />,
      bg: "#EEF2FF",
      text: "#3730A3",
      border: "#C7D2FE",
    },
  };

  const c = configs[toast.type];

  return (
    <div
      className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg border w-full transition-all duration-300"
      style={{
        backgroundColor: c.bg,
        color: c.text,
        borderColor: c.border,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
      }}
    >
      {c.icon}
      <span className="flex-1" style={{ fontSize: 14, fontWeight: 500 }}>
        {toast.message}
      </span>
      <button onClick={onDismiss} className="opacity-60 hover:opacity-100 transition-opacity">
        <X size={16} />
      </button>
    </div>
  );
}
