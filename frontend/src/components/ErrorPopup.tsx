import { AlertTriangle, XCircle, X } from 'lucide-react';
import type { ApiError } from '../services/apiError';

type ErrorPopupProps = {
  error: ApiError | null;
  onClose: () => void;
};

function getErrorTitle(error: ApiError): string {
  if (error.code === 'BUSINESS_ERROR') return 'Business Rule Error';
  if (error.code === 'VALIDATION_ERROR') return 'Invalid Request';
  if (error.code === 'NOT_FOUND') return 'Data Not Found';
  if (error.code === 'SYSTEM_ERROR' || error.status >= 500) return 'System Error';
  return 'Request Error';
}

export const ErrorPopup = ({ error, onClose }: ErrorPopupProps) => {
  if (!error) return null;

  const isSystemError = error.code === 'SYSTEM_ERROR' || error.status >= 500;

  return (
    <div className="fixed inset-0 z-[1000] bg-black/30 backdrop-blur-[1px] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between p-5 border-b border-zinc-100">
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 rounded-xl p-2 ${isSystemError ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}
            >
              {isSystemError ? <XCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-900">{getErrorTitle(error)}</p>
              <p className="text-[11px] font-mono text-zinc-400 mt-1">{error.code}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
            aria-label="Close error popup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-zinc-700 leading-relaxed">{error.message}</p>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
