import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { cn } from '../lib/utils';

type ToastVariant = 'success' | 'warning';

type SuccessToastProps = {
  message: string | null;
  onClose: () => void;
  /** Defaults to success (green). Warning uses amber styling. */
  variant?: ToastVariant;
};

export const SuccessToast = ({ message, onClose, variant = 'success' }: SuccessToastProps) => {
  if (!message) return null;

  const isWarning = variant === 'warning';

  return (
    <div
      className={cn(
        'fixed top-5 right-5 z-[1000] w-full max-w-md rounded-2xl border bg-white shadow-2xl',
        isWarning ? 'border-amber-200' : 'border-emerald-200',
      )}
    >
      <div className="flex items-start justify-between p-4 gap-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'rounded-xl p-2',
              isWarning ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-600',
            )}
          >
            {isWarning ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          </div>
          <div>
            <p className="text-sm font-bold text-zinc-900">{isWarning ? 'Warning' : 'Success'}</p>
            <p className="text-sm text-zinc-600 mt-1">{message}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          aria-label={isWarning ? 'Close warning notification' : 'Close success notification'}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
