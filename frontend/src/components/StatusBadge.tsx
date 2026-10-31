import React from 'react';

export type StatusVariant =
  | 'ACTIVE'
  | 'PAID'
  | 'CONFIRMED'
  | 'DRAFT'
  | 'QUOTATION'
  | 'PENDING'
  | 'PAUSED'
  | 'CLOSED'
  | 'CANCELLED'
  | 'DEACTIVATED'
  | 'OVERDUE'
  | string;

export interface StatusBadgeProps {
  status: StatusVariant;
  label?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const STATUS_COLOR_MAP: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  // Positive / Active / Paid
  ACTIVE: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-emerald-200' },
  PAID: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', border: 'border-emerald-200' },
  CONFIRMED: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', border: 'border-blue-200' },
  
  // Neutral / Draft / Pending / In-progress
  DRAFT: { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-400', border: 'border-slate-200' },
  QUOTATION: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', border: 'border-amber-200' },
  PENDING: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', border: 'border-amber-200' },
  PAUSED: { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500', border: 'border-yellow-200' },

  // Negative / Closed / Cancelled / Deactivated / Overdue
  CLOSED: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', border: 'border-rose-200' },
  CANCELLED: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', border: 'border-rose-200' },
  DEACTIVATED: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400', border: 'border-gray-200' },
  OVERDUE: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', border: 'border-red-200' },
  UNPAID: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500', border: 'border-rose-200' },
};

const DEFAULT_STYLE = {
  bg: 'bg-slate-100',
  text: 'text-slate-700',
  dot: 'bg-slate-400',
  border: 'border-slate-200',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  className = '',
  size = 'md',
}) => {
  const normalizedKey = (status || '').toUpperCase();
  const config = STATUS_COLOR_MAP[normalizedKey] || DEFAULT_STYLE;

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 space-x-1',
    md: 'text-xs px-2.5 py-0.5 space-x-1.5',
    lg: 'text-sm px-3 py-1 space-x-2',
  }[size];

  const dotSize = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-2.5 h-2.5',
  }[size];

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${config.bg} ${config.text} ${config.border} ${sizeStyles} ${className}`}
    >
      <span className={`rounded-full shrink-0 ${config.dot} ${dotSize}`} />
      <span>{label || status}</span>
    </span>
  );
};

export default StatusBadge;
