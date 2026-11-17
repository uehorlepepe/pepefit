import React from 'react';
import { Link } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
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
