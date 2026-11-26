import * as React from 'react';
import { cn } from '@/lib/utils';

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-[#DFD9C8] bg-[#FCFBF7] shadow-[0_1px_2px_rgba(32,39,35,0.04)]',
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 border-b border-[#EAE5D7] px-5 py-3.5',
        className
      )}
    >
      <div>
        <h3 className="text-sm font-semibold text-[#202723]">{title}</h3>
        {subtitle && <p className="text-xs text-[#646D67] mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
