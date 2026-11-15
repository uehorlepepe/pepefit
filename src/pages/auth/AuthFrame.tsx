import React from 'react';
import { Link } from 'react-router-dom';
import { Moon, Sun, Zap, Flame, Timer } from 'lucide-react';
import { Logo } from '../../components/ui';
import { useUI } from '../../context/UIContext';

export function AuthFrame({ title, subtitle, children, footer }: {
  title: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode;
}) {
  const { theme, toggleTheme } = useUI();
  return (
    <div className="auth">
      <div className="auth-top">
        <Link to="/" aria-label="Pepefit home"><Logo size={30} /></Link>
        <button className="btn-circle" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      <div className="auth-art" aria-hidden="true">
        <span className="auth-ring r3" />
        <span className="auth-ring r2" />
        <span className="auth-ring r1" />
        <span className="auth-orb" />
        <span className="float-chip fc1"><Flame size={12} style={{ color: 'var(--amber)' }} /> 12-day streak</span>
        <span className="float-chip fc2"><Zap size={12} style={{ color: 'var(--volt)' }} /> 170 g protein hit</span>
        <svg className="auth-line" viewBox="0 0 300 60" fill="none">
          <path d="M0 32h54l12-22 18 42 16-30 12 10h188" stroke="var(--volt)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      <h1 className="auth-title">{title}</h1>
      {subtitle && <p className="auth-sub">{subtitle}</p>}
      {children}
      {footer && <div className="auth-switch">{footer}</div>}
    </div>
  );
}

export function StatChip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <span className="float-chip" style={{ position: 'static' }}>{icon}{text}</span>;
}