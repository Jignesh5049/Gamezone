import * as React from 'react';
import { cn } from '@/lib/utils';

type BadgeTone = 'green' | 'red' | 'amber' | 'grey' | 'charcoal' | 'outline';

const toneClasses: Record<BadgeTone, string> = {
  green: 'bg-[#285943]/12 text-[#285943] border-[#285943]/25',
  red: 'bg-[#C65D50]/12 text-[#A74438] border-[#C65D50]/30',
  amber: 'bg-[#D89B45]/16 text-[#8E5B13] border-[#D89B45]/35',
  grey: 'bg-[#202723]/8 text-[#5A635D] border-[#202723]/15',
  charcoal: 'bg-[#202723] text-[#F5F2E9] border-[#202723]',
  outline: 'bg-[#FCFBF7] text-[#202723] border-[#D4CEBC]',
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
        'inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold tracking-tight whitespace-nowrap',
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
