import React, { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, AlertCircle, Info, Trophy, Plus, Minus, ChevronRight, Sparkles } from 'lucide-react';
import { useUI } from '../context/UIContext';

export function Logo({ size = 28, wordmark = true }: { size?: number; wordmark?: boolean }) {
  return (
    <span className="brand" style={{ fontSize: size * 0.68 }}>
      <span className="brand-mark" style={{ width: size, height: size, borderRadius: size * 0.32 }}>
        <BrandGlyph />
      </span>
      {wordmark && <span>pepefit</span>}
    </span>
  );
}

export function BrandGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2 13h4l2.2-6.2L12 19l2.6-8.2L16.5 14H22" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Toaster() {
  const { toasts, dismissToast } = useUI();
  if (!toasts.length) return null;
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <span className="t-icon">
            {t.kind === 'error' ? <AlertCircle size={15} /> : t.kind === 'info' ? <Info size={15} /> : t.kind === 'pr' ? <Trophy size={15} /> : <Check size={15} strokeWidth={3} />}
          </span>
          <div className="grow">
            <div style={{ fontWeight: 600 }}>{t.message}</div>
            {t.detail && <div className="t-detail">{t.detail}</div>}
          </div>
          <button className="t-close" onClick={() => dismissToast(t.id)} aria-label="Dismiss"><X size={13} /></button>
        </div>
      ))}
    </div>
  );
}

export function Sheet({ open, onClose, title, children, footer, center = false, className = '' }: {
  open: boolean; onClose: () => void; title?: React.ReactNode; children: React.ReactNode;
  footer?: React.ReactNode; center?: boolean; className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className={`sheet-backdrop ${center ? 'modal-center' : ''}`} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`sheet ${className}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : 'Dialog'}>
        {!center && <div className="sheet-grip" />}
        {title && (
          <div className="sheet-head">
            <h2>{title}</h2>
            <button className="btn-circle" onClick={onClose} aria-label="Close"><X size={16} /></button>
          </div>
        )}
        {children}
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Ring({ value, size = 160, stroke = 11, color = 'var(--volt)', track, children, glow = true }: {
  value: number; size?: number; stroke?: number; color?: string; track?: string;
  children?: React.ReactNode; glow?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  const clamped = Math.max(0, Math.min(1.2, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
        <defs>
          <linearGradient id={`ring-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color} stopOpacity={0.55} />
          </linearGradient>
          {glow && <filter id={`glow-${id}`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>}
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track || 'rgba(255,255,255,.075)'} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#ring-${id})`}
          strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, clamped))}
          filter={glow ? `url(#glow-${id})` : undefined}
          style={{ transition: 'stroke-dashoffset 1s var(--ease)' }}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

export function MacroBar({ label, value, target, color, unit = 'g', showValues = true }: {
  label: string; value: number; target: number; color: string; unit?: string; showValues?: boolean;
}) {
  const ratio = target > 0 ? Math.min(1, value / target) : 0;
  return (
    <div className="macro-row">
      <div className="top">
        <b>{label}</b>
        {showValues && <span><b style={{ color: 'var(--text-2)' }}>{Math.round(value)}</b> / {Math.round(target)}{unit}</span>}
      </div>
      <div className="bar"><i style={{ width: `${ratio * 100}%`, background: color }} /></div>
    </div>
  );
}

export function Stepper({ value, onChange, step = 1, min = 0, max = 100, format }: {
  value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; format?: (v: number) => string;
}) {
  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(Math.max(min, Math.round((value - step) * 100) / 100))} aria-label="Decrease"><Minus size={13} /></button>
      <span className="val">{format ? format(value) : value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, Math.round((value + step) * 100) / 100))} aria-label="Increase"><Plus size={13} /></button>
    </div>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />;
}

export function EmptyState({ icon, title, text, action }: { icon?: React.ReactNode; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <div className="es-ico">{icon || <Sparkles size={22} />}</div>
      <b>{title}</b>
      {text && <p>{text}</p>}
      {action && <div className="mt-14">{action}</div>}
    </div>
  );
}

export function Skeleton({ height = 80, radius = 16, style }: { height?: number; radius?: number; style?: React.CSSProperties }) {
  return <div className="skeleton" style={{ height, borderRadius: radius, ...style }} />;
}

export function PageLoading() {
  return (
    <div className="page">
      <Skeleton height={30} style={{ width: '55%', marginBottom: 18 }} />
      <Skeleton height={190} style={{ marginBottom: 14 }} />
      <div className="grid-2" style={{ marginBottom: 14 }}><Skeleton height={130} /><Skeleton height={130} /></div>
      <Skeleton height={110} />
    </div>
  );
}

export function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {action && <button className="link" onClick={onAction}>{action} <ChevronRight size={12} /></button>}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return <div className="form-error">{message}</div>;
}

export function Stat({ value, label, sub }: { value: React.ReactNode; label: string; sub?: string }) {
  return (
    <div>
      <div className="num" style={{ fontSize: 19 }}>{value}</div>
      <div className="tiny faint" style={{ textTransform: 'uppercase', letterSpacing: '.08em', marginTop: 2 }}>{label}</div>
      {sub && <div className="tiny faint mt-6">{sub}</div>}
    </div>
  );
}

export function useAutoClearError() {
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(t);
  }, [error]);
  return [error, setError] as const;
}