import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export default function NotificationToast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const isError = toast.type === 'error';

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-200">
      <div
        className={`flex items-center gap-3 px-5 py-3.5 rounded-full shadow-aura-hover text-xs font-medium border ${
          isError
            ? 'bg-[#4c1d1d] text-white border-red-500/30'
            : 'bg-aura-espresso text-aura-ivory border-aura-espresso/20'
        }`}
      >
        {isError ? (
          <AlertCircle className="w-4 h-4 text-red-300" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-aura-champagne" />
        )}
        <span className="font-sans">{toast.message}</span>
        <button
          onClick={onDismiss}
          className="ml-2 w-5 h-5 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
