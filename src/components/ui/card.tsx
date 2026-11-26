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
        'rounded-xl border border-[#1E2420]/10 bg-[#FCFBF7] shadow-[0_1px_2px_rgba(30,36,32,0.04)]',
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
        'flex items-center justify-between gap-4 border-b border-[#1E2420]/8 px-5 py-4',
        className
      )}
    >
      <div>
        <h3 className="text-sm font-medium text-[#1E2420]">{title}</h3>
        {subtitle && <p className="text-xs text-[#707973] mt-1">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
