import { AlertTriangle } from "lucide-react";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmContextValue = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmContextValue | undefined>(undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | undefined>(undefined);

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  function handle(result: boolean) {
    setOptions(null);
    resolver.current?.(result);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[110]">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-[scaleIn_0.15s_ease-out]">
            <div className="flex items-start gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  options.danger ? "bg-status-critical/10 text-status-critical" : "bg-primary-50 text-primary-500"
                }`}
              >
                <AlertTriangle size={20} />
              </div>
              <div>
                <h2 className="font-semibold text-ink">{options.title}</h2>
                {options.description && (
                  <p className="text-sm text-ink-secondary mt-1">{options.description}</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => handle(false)} className="btn-secondary">
                {options.cancelLabel || "Cancelar"}
              </button>
              <button
                onClick={() => handle(true)}
                className={options.danger ? "btn-danger" : "btn-primary"}
              >
                {options.confirmLabel || "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm deve ser usado dentro de ConfirmProvider");
  return ctx;
}
