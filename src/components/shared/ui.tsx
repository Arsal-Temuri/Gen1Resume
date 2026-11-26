import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  HelpCircle,
  XCircle,
} from 'lucide-react';
import type { VerificationStatus } from '../../types/audit';
import type { ApprovalStatus } from '../../types/profile';
import type { RequirementMatchStatus } from '../../types/resume';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  className = '',
  type = 'button',
  children,
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-100 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#09090B] disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer';

  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-9 px-4 text-sm',
  };

  const variants = {
    primary:
      'bg-[#09090B] text-white hover:bg-zinc-800 dark:bg-[#FAFAFA] dark:text-[#09090B] dark:hover:bg-zinc-200',
    secondary:
      'bg-white text-[#09090B] border border-[#E4E4E7] hover:bg-[#FAFAFA] dark:bg-[#18181B] dark:text-[#FAFAFA] dark:border-[#27272A] dark:hover:bg-zinc-800',
    ghost:
      'bg-transparent text-[#52525B] hover:text-[#09090B] hover:bg-zinc-100 dark:text-[#A1A1AA] dark:hover:text-[#FAFAFA] dark:hover:bg-zinc-800/70',
    danger:
      'bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA] hover:bg-red-100 dark:bg-red-950/60 dark:text-red-400 dark:border-red-900/70 dark:hover:bg-red-950',
  };

  return (
    <button
      type={type}
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: 'sm' | 'md';
  variant?: 'ghost' | 'secondary' | 'danger';
}

export const IconButton: React.FC<IconButtonProps> = ({
  label,
  size = 'md',
  variant = 'ghost',
  className = '',
  type = 'button',
  children,
  ...props
}) => {
  const sizes = {
    sm: 'h-8 w-8',
    md: 'h-9 w-9',
  };
  const variants = {
    ghost:
      'text-[#52525B] hover:text-[#09090B] hover:bg-zinc-100 dark:text-[#A1A1AA] dark:hover:text-[#FAFAFA] dark:hover:bg-zinc-800',
    secondary:
      'bg-white text-[#09090B] border border-[#E4E4E7] hover:bg-[#FAFAFA] dark:bg-[#18181B] dark:text-[#FAFAFA] dark:border-[#27272A] dark:hover:bg-zinc-800',
    danger:
      'text-[#52525B] hover:text-[#DC2626] hover:bg-[#FEF2F2] dark:text-[#A1A1AA] dark:hover:text-red-400 dark:hover:bg-red-950/50',
  };

  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center rounded-lg transition-colors duration-150 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-100 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  surface?: 'primary' | 'secondary';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  surface = 'primary',
  padding = 'md',
  className = '',
  children,
  ...props
}) => {
  const surfaces = {
    primary: 'bg-white dark:bg-[#121214]',
    secondary: 'bg-[#FAFAFA] dark:bg-[#18181B]',
  };
  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6',
  };
  return (
    <div
      className={`rounded-xl border border-[#E4E4E7] dark:border-[#27272A] ${surfaces[surface]} ${paddings[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

/**
 * Technical monospace reference badge strictly for Fact IDs (e.g. EXP-1-B1) and code identifiers.
 */
export const FactIdBadge: React.FC<{ id: string; className?: string }> = ({ id, className = '' }) => (
  <span
    className={`inline-flex items-center font-mono text-[11px] font-medium px-1.5 py-0.5 rounded border border-[#E4E4E7] bg-[#FAFAFA] text-[#52525B] dark:border-[#27272A] dark:bg-[#18181B] dark:text-[#A1A1AA] whitespace-nowrap shrink-0 ${className}`}
  >
    {id}
  </span>
);

type SemanticStatus =
  | VerificationStatus
  | ApprovalStatus
  | RequirementMatchStatus
  | 'USER_OVERRIDE';

const STATUS_META: Record<
  SemanticStatus,
  {
    label: string;
    classes: string;
    icon: React.FC<{ className?: string; 'aria-hidden'?: boolean }>;
  }
> = {
  VERIFIED: {
    label: 'Verified',
    classes:
      'text-[#059669] bg-[#ECFDF5] border-[#A7F3D0] dark:text-emerald-400 dark:bg-emerald-950/60 dark:border-emerald-800/70',
    icon: CheckCircle2,
  },
  APPROVED: {
    label: 'Approved',
    classes:
      'text-[#059669] bg-[#ECFDF5] border-[#A7F3D0] dark:text-emerald-400 dark:bg-emerald-950/60 dark:border-emerald-800/70',
    icon: CheckCircle2,
  },
  matched: {
    label: 'Matched',
    classes:
      'text-[#059669] bg-[#ECFDF5] border-[#A7F3D0] dark:text-emerald-400 dark:bg-emerald-950/60 dark:border-emerald-800/70',
    icon: CheckCircle2,
  },
  PARAPHRASED: {
    label: 'Paraphrased',
    classes:
      'text-[#D97706] bg-[#FFFBEB] border-[#FDE68A] dark:text-amber-400 dark:bg-amber-950/60 dark:border-amber-800/70',
    icon: AlertTriangle,
  },
  PENDING: {
    label: 'Pending Review',
    classes:
      'text-[#D97706] bg-[#FFFBEB] border-[#FDE68A] dark:text-amber-400 dark:bg-amber-950/60 dark:border-amber-800/70',
    icon: Clock,
  },
  partially_matched: {
    label: 'Partial Match',
    classes:
      'text-[#D97706] bg-[#FFFBEB] border-[#FDE68A] dark:text-amber-400 dark:bg-amber-950/60 dark:border-amber-800/70',
    icon: AlertTriangle,
  },
  UNSUPPORTED: {
    label: 'Unsupported',
    classes:
      'text-[#DC2626] bg-[#FEF2F2] border-[#FECACA] dark:text-red-400 dark:bg-red-950/60 dark:border-red-800/70',
    icon: XCircle,
  },
  REJECTED: {
    label: 'Rejected',
    classes:
      'text-[#DC2626] bg-[#FEF2F2] border-[#FECACA] dark:text-red-400 dark:bg-red-950/60 dark:border-red-800/70',
    icon: XCircle,
  },
  missing: {
    label: 'Missing',
    classes:
      'text-[#DC2626] bg-[#FEF2F2] border-[#FECACA] dark:text-red-400 dark:bg-red-950/60 dark:border-red-800/70',
    icon: XCircle,
  },
  NEEDS_REVIEW: {
    label: 'Needs Re-Audit',
    classes:
      'text-zinc-700 bg-zinc-100 border-zinc-300 dark:text-zinc-200 dark:bg-zinc-800 dark:border-zinc-600',
    icon: AlertCircle,
  },
  USER_OVERRIDE: {
    label: 'User Override (Not AI-Verified)',
    classes:
      'text-[#DC2626] bg-[#FEF2F2] border-[#FECACA] dark:text-red-300 dark:bg-red-950/70 dark:border-red-800',
    icon: HelpCircle,
  },
};

export const StatusPill: React.FC<{
  status: SemanticStatus;
  className?: string;
}> = ({ status, className = '' }) => {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md border whitespace-nowrap shrink-0 ${meta.classes} ${className}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden={true} />
      <span>{meta.label}</span>
    </span>
  );
};

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  helperText,
  error,
  id,
  className = '',
  ...props
}) => {
  const inputId = id ?? (label ? `input-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : undefined);
  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-medium text-[#09090B] dark:text-[#FAFAFA]"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full h-9 px-3 rounded-lg border text-sm bg-white text-[#09090B] placeholder:text-[#71717A] border-[#E4E4E7] focus:outline-none focus:ring-2 focus:ring-zinc-900/15 focus:border-zinc-900 dark:bg-[#121214] dark:text-[#FAFAFA] dark:placeholder:text-zinc-500 dark:border-[#27272A] dark:focus:ring-zinc-100/15 dark:focus:border-zinc-400 transition-colors ${
          error ? 'border-[#DC2626] dark:border-red-500' : ''
        } ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-[#DC2626] dark:text-red-400">{error}</p>}
      {!error && helperText && (
        <p className="text-xs text-[#71717A] dark:text-[#A1A1AA]">{helperText}</p>
      )}
    </div>
  );
};

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  helperText,
  error,
  id,
  className = '',
  ...props
}) => {
  const textareaId =
    id ?? (label ? `textarea-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : undefined);
  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={textareaId}
          className="block text-xs font-medium text-[#09090B] dark:text-[#FAFAFA]"
        >
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        className={`w-full px-3 py-2.5 rounded-lg border text-sm leading-relaxed bg-white text-[#09090B] placeholder:text-[#71717A] border-[#E4E4E7] focus:outline-none focus:ring-2 focus:ring-zinc-900/15 focus:border-zinc-900 dark:bg-[#121214] dark:text-[#FAFAFA] dark:placeholder:text-zinc-500 dark:border-[#27272A] dark:focus:ring-zinc-100/15 dark:focus:border-zinc-400 transition-colors ${
          error ? 'border-[#DC2626] dark:border-red-500' : ''
        } ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-[#DC2626] dark:text-red-400">{error}</p>}
      {!error && helperText && (
        <p className="text-xs text-[#71717A] dark:text-[#A1A1AA]">{helperText}</p>
      )}
    </div>
  );
};

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex items-center p-1 rounded-lg bg-[#FAFAFA] border border-[#E4E4E7] dark:bg-[#18181B] dark:border-[#27272A] ${className}`}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-100 ${
              active
                ? 'bg-white text-[#09090B] shadow-xs border border-[#E4E4E7] dark:bg-[#09090B] dark:text-[#FAFAFA] dark:border-[#27272A]'
                : 'text-[#52525B] hover:text-[#09090B] border border-transparent dark:text-[#A1A1AA] dark:hover:text-[#FAFAFA]'
            }`}
          >
            <span>{opt.label}</span>
            {typeof opt.count === 'number' && (
              <span className="ml-1.5 font-mono text-[11px] tabular-nums opacity-75">
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center text-center py-12 px-6 border border-dashed border-[#E4E4E7] dark:border-[#27272A] rounded-xl bg-[#FAFAFA]/60 dark:bg-[#121214]/60">
    {icon && (
      <div className="mb-3 text-[#71717A] dark:text-[#A1A1AA]" aria-hidden="true">
        {icon}
      </div>
    )}
    <h3 className="text-sm font-semibold text-[#09090B] dark:text-[#FAFAFA]">{title}</h3>
    <p className="mt-1.5 text-sm text-[#52525B] dark:text-[#A1A1AA] max-w-md">{description}</p>
    {action && <div className="mt-5 flex flex-wrap items-center justify-center gap-3">{action}</div>}
  </div>
);

export const ProgressBar: React.FC<{
  percent: number;
  label?: string;
  className?: string;
}> = ({ percent, label, className = '' }) => {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  return (
    <div
      role="progressbar"
      aria-label={label || 'Progress'}
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`w-full h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden ${className}`}
    >
      <div
        className="h-full bg-[#09090B] dark:bg-[#FAFAFA] transition-all duration-300"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
};
