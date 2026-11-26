'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print">
      <div
        className="fixed inset-0 bg-[#1E2420]/50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 w-full rounded-2xl border border-[#1E2420]/10 bg-[#FCFBF7] shadow-[0_8px_24px_rgba(30,36,32,0.10)] flex flex-col max-h-[90vh]',
          maxWidth
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#1E2420]/8 px-6 py-4 shrink-0">
          <div>
            <h2 className="text-base font-medium text-[#1E2420]">{title}</h2>
            {subtitle && <p className="text-xs text-[#707973] mt-1">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[8px] p-2 text-[#707973] transition-colors duration-150 hover:bg-[#EDE9DD] hover:text-[#1E2420] cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
