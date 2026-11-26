import * as React from 'react';
import { cn } from '@/lib/utils';

type BadgeTone = 'green' | 'red' | 'amber' | 'grey' | 'charcoal' | 'outline';

const toneClasses: Record<BadgeTone, string> = {
  green: 'bg-[#285943]/10 text-[#285943] border-[#285943]/20',
  red: 'bg-[#C65D50]/10 text-[#A74438] border-[#C65D50]/25',
  amber: 'bg-[#B77922]/12 text-[#8E5B13] border-[#B77922]/25',
  grey: 'bg-[#1E2420]/6 text-[#525B55] border-[#1E2420]/12',
  charcoal: 'bg-[#1E2420] text-[#F2EFE7] border-[#1E2420]',
  outline: 'bg-[#FCFBF7] text-[#1E2420] border-[#1E2420]/15',
};

export function Badge({
  children,
  tone = 'outline',
  className,
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-[6px] border px-2 py-0.5 text-xs leading-4 font-medium whitespace-nowrap',
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
