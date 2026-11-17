import { useNavigate } from 'react-router-dom';
import { ChevronRight, Database, Dumbbell, ShieldCheck, Users, Utensils } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { SectionHead } from '../components/ui';
import { formatDate, formatNumber } from '../lib/utils';
import type { AdminOverview } from '../types';

const initials = (name: string) =>
  name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase() || 'P';

export function Admin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data } = useApi<AdminOverview>('/admin/overview');

  if (!user?.isAdmin) return null;

  const totals = data?.totals;
  const library = data?.library;
  const accounts = data?.users || [];

  return (
    <div className="page">
      <div className="page-head" style={{ marginBottom: 16 }}>
        <div>
          <h1>Admin</h1>
        </div>
        <button className="btn-circle" style={{ marginTop: 4 }} onClick={() => navigate('/profile')} aria-label="Back to profile">
          <ShieldCheck size={16} />
        </button>
      </div>

      <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="icon-box volt" style={{ width: 40, height: 40, borderRadius: 12 }}><ShieldCheck size={17} /></span>
        <div className="grow">
          <b style={{ fontSize: 13 }}>Signed in as admin</b>
          <div className="tiny faint">{user.email}</div>
        </div>
      </div>

      <div className="profile-stats">
        <div className="ps"><b>{formatNumber(totals?.users ?? 0)}</b><span>Accounts</span></div>
        <div className="ps"><b>{formatNumber(totals?.workouts ?? 0)}</b><span>Workouts</span></div>
        <div className="ps"><b>{formatNumber(totals?.sets ?? 0)}</b><span>Sets logged</span></div>
        <div className="ps"><b>{formatNumber(totals?.meals ?? 0)}</b><span>Meals logged</span></div>
      </div>

      <SectionHead title="Library" />
      <div className="card" style={{ padding: '4px 16px' }}>
        <div className="settings-row">
          <span className="icon-box" style={{ width: 34, height: 34, borderRadius: 10 }}><Dumbbell size={15} /></span>
          <div className="sr-body"><b>{formatNumber(library?.exercises ?? 0)} exercises</b><span>Movement database</span></div>
        </div>
        <div className="settings-row">
          <span className="icon-box amber" style={{ width: 34, height: 34, borderRadius: 10 }}><Utensils size={15} /></span>
          <div className="sr-body"><b>{formatNumber(library?.foods ?? 0)} foods</b><span>Nutrition database</span></div>
        </div>
        <div className="settings-row">
          <span className="icon-box rose" style={{ width: 34, height: 34, borderRadius: 10 }}><Database size={15} /></span>
          <div className="sr-body"><b>{formatNumber(library?.recipes ?? 0)} recipes</b><span>Kitchen library</span></div>
        </div>
      </div>

      <SectionHead title={`Accounts · ${formatNumber(accounts.length)}`} />
      {accounts.length === 0 ? (
        <div className="card" style={{ padding: 16 }}>
          <div className="row" style={{ gap: 12 }}>
            <span className="icon-box" style={{ width: 38, height: 38, borderRadius: 11 }}><Users size={16} /></span>
            <div className="grow"><b style={{ fontSize: 12.5 }}>No accounts yet</b><div className="tiny faint">New sign-ups will show up here.</div></div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: '4px 16px' }}>
          {accounts.map((account) => (
            <div className="settings-row" key={account.id}>
              <span className="avatar">{initials(account.name)}</span>
              <div className="sr-body">
                <b style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {account.name}
                  {account.isAdmin && <span className="pill pill-volt">admin</span>}
                </b>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{account.email}</span>
                <span className="tiny faint">
                  {formatNumber(account.workouts)} workouts · {formatNumber(account.meals)} meals logged
                  {account.lastWorkout ? ` · last ${formatDate(account.lastWorkout.slice(0, 10))}` : ' · never trained'}
                </span>
              </div>
              <ChevronRight size={14} className="faint" />
            </div>
          ))}
        </div>
      )}

      <div className="center mt-24 tiny faint" style={{ lineHeight: 1.7, paddingBottom: 10 }}>
        Pepefit admin · read-only view
      </div>
    </div>
  );
}
