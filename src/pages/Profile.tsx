import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award, ChevronRight, LogOut, Moon, Pencil, Settings, Shield, Sparkles, Sun,
  Trash2, Trophy, UserRound, Utensils,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { useApi } from '../hooks/useApi';
import { api } from '../lib/api';
import { SectionHead, Sheet } from '../components/ui';
import { Sparkline } from '../components/charts';
import {
  DIET_OPTIONS, EXPERIENCE_OPTIONS, GOAL_ICONS, GOAL_OPTIONS, RESTRICTION_OPTIONS,
  formatDate, formatNumber, goalLabel,
} from '../lib/utils';
import type { ProgressOverview, Targets, User } from '../types';

type PR = { exerciseId: number; name: string; muscles: string[]; weight: number; reps: number; date: string };

const titleCase = (s?: string | null) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '—');

export function Profile() {
  const { user, setUser, logout } = useAuth();
  const { theme, setTheme, toast } = useUI();
  const navigate = useNavigate();

  const { data: summary } = useApi<{ weekSessions: number; totalWorkouts: number; totalVolume: number; avgDuration: number }>('/workouts/summary');
  const { data: overview } = useApi<ProgressOverview>('/progress/overview?days=30');
  const { data: prData } = useApi<{ records: PR[] }>('/workouts/personal-records');

  const [editOpen, setEditOpen] = useState(false);
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '', age: '' as number | '', sex: 'male', heightCm: '' as number | '', weightKg: '' as number | '',
    experience: 'beginner', goal: 'general_fitness', weeklyFrequency: 4, diet: [] as string[],
    restrictions: [] as string[], activityLevel: 'moderate',
  });
  const [targetForm, setTargetForm] = useState<Targets | null>(null);
  const [accountForm, setAccountForm] = useState({ name: '', email: '', currentPassword: '', newPassword: '' });

  if (!user) return null;

  const p = user.profile;
  const t = user.targets;
  const initials = user.name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();
  const prs = prData?.records || [];
  const stats = overview?.stats;
  const weights = overview?.weights || [];

  const openEdit = () => {
    setForm({
      name: user.name,
      age: p?.age ?? '',
      sex: p?.sex || 'male',
      heightCm: p?.heightCm ?? '',
      weightKg: p?.weightKg ?? '',
      experience: p?.experience || 'beginner',
      goal: p?.goal || 'general_fitness',
      weeklyFrequency: p?.weeklyFrequency || 4,
      diet: p?.diet || [],
      restrictions: p?.restrictions || [],
      activityLevel: p?.activityLevel || 'moderate',
    });
    setEditOpen(true);
  };

  const toggleFormList = (key: 'diet' | 'restrictions', value: string) => {
    setForm(f => ({ ...f, [key]: f[key].includes(value) ? f[key].filter(v => v !== value) : [...f[key], value] }));
  };

  const saveProfile = async () => {
    if (form.name.trim().length < 2) return toast('Enter your name', 'error');
    setBusy(true);
    try {
      await api('/profile', {
        method: 'PUT',
        body: {
          age: form.age === '' ? null : Number(form.age), sex: form.sex,
          heightCm: form.heightCm === '' ? null : Number(form.heightCm),
          weightKg: form.weightKg === '' ? null : Number(form.weightKg),
          experience: form.experience, goal: form.goal, weeklyFrequency: form.weeklyFrequency,
          diet: form.diet, restrictions: form.restrictions, activityLevel: form.activityLevel,
        },
      });
      const res = await api<{ user: User; message: string }>('/auth/account', { method: 'PATCH', body: { name: form.name.trim() } });
      setUser(res.user);
      toast('Profile saved', 'success');
      setEditOpen(false);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const openTargets = () => {
    if (!t) return toast('Targets are not set up yet', 'info');
    setTargetForm({ ...t });
    setTargetsOpen(true);
  };

  const suggestTargets = async () => {
    try {
      const res = await api<{ suggestion: Targets | null }>('/profile/suggestion');
      if (!res.suggestion) return toast('Add your height, weight and age first', 'info');
      setTargetForm(res.suggestion);
      toast('Recalculated from your details', 'info');
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const saveTargets = async () => {
    if (!targetForm) return;
    setBusy(true);
    try {
      const res = await api<{ user: User; message: string }>('/targets', { method: 'PUT', body: targetForm });
      setUser(res.user);
      toast('Targets updated', 'success');
      setTargetsOpen(false);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const openAccount = () => {
    setAccountForm({ name: user.name, email: user.email, currentPassword: '', newPassword: '' });
    setAccountOpen(true);
  };

  const saveAccount = async () => {
    setBusy(true);
    try {
      const body: Record<string, any> = { name: accountForm.name.trim(), email: accountForm.email.trim() };
      if (accountForm.newPassword) {
        body.currentPassword = accountForm.currentPassword;
        body.newPassword = accountForm.newPassword;
      }
      const res = await api<{ user: User; message: string }>('/auth/account', { method: 'PATCH', body });
      setUser(res.user);
      await api('/profile', { method: 'PUT', body: { age: p?.age ?? null, sex: p?.sex ?? null, heightCm: p?.heightCm ?? null, weightKg: p?.weightKg ?? null, experience: p?.experience ?? null, goal: p?.goal ?? null, weeklyFrequency: p?.weeklyFrequency ?? null, diet: p?.diet ?? [], restrictions: p?.restrictions ?? [], activityLevel: p?.activityLevel ?? 'moderate' } }).catch(() => {});
      toast('Account updated', 'success');
      setAccountOpen(false);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async () => {
    if (!confirm('Delete your account and all of your data? This cannot be undone.')) return;
    if (!confirm('Last check — really delete everything?')) return;
    try {
      await api('/account', { method: 'DELETE' });
      logout();
      navigate('/login', { replace: true });
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const targetSummary = t ? [
    { label: 'Calories', value: formatNumber(t.calories), unit: 'kcal', color: 'var(--volt)' },
    { label: 'Protein', value: t.protein, unit: 'g', color: 'var(--sky)' },
    { label: 'Carbs', value: t.carbs, unit: 'g', color: 'var(--amber)' },
    { label: 'Fat', value: t.fat, unit: 'g', color: 'var(--rose)' },
  ] : [];

  return (
    <div className="page">
      <div className="page-head" style={{ marginBottom: 16 }}>
        <div>
          <span className="eyebrow">Your space</span>
          <h1>Profile<span style={{ color: 'var(--volt)' }}>.</span></h1>
        </div>
        <button className="btn-circle" style={{ marginTop: 4 }} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      <div className="card profile-head" style={{ padding: 18 }}>
        <span className="avatar lg">{initials || 'P'}</span>
        <div className="grow" style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 23, fontWeight: 600, letterSpacing: '-.035em' }}>{user.name}</div>
          <div className="small faint" style={{ marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
          <div className="row mt-6" style={{ gap: 6, flexWrap: 'wrap' }}>
            <span className="pill pill-volt">{GOAL_ICONS[p?.goal || 'general_fitness']} {goalLabel(p?.goal)}</span>
            <span className="pill pill-muted">{titleCase(p?.experience)}</span>
          </div>
        </div>
        <button className="btn-circle" onClick={openEdit} aria-label="Edit profile"><Pencil size={15} /></button>
      </div>

      <div className="profile-stats">
        <div className="ps"><b>{summary?.totalWorkouts ?? 0}</b><span>Workouts</span></div>
        <div className="ps"><b>{prs.length}</b><span>PR lifts</span></div>
        <div className="ps"><b>{overview?.stats?.loggedDays ?? 0}</b><span>Days logged</span></div>
        <div className="ps"><b>{stats?.currentWeight ?? p?.weightKg ?? '—'}<span className="tiny faint">kg</span></b><span>Weight</span></div>
      </div>

      {weights.length > 1 && (
        <div className="card mt-10" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="card-title" style={{ flexShrink: 0 }}>30D</span>
          <div className="grow"><Sparkline values={weights.map(w => w.weight)} color="var(--volt)" width={200} height={34} /></div>
          <button className="link" style={{ fontSize: 11, color: 'var(--muted)' }} onClick={() => navigate('/progress')}>Details <ChevronRight size={11} /></button>
        </div>
      )}

      <SectionHead title="About you" action="Edit" onAction={openEdit} />
      <div className="card" style={{ padding: '4px 16px' }}>
        <div className="settings-row">
          <span className="icon-box" style={{ width: 34, height: 34, borderRadius: 10 }}><UserRound size={15} /></span>
          <div className="sr-body"><b>{p?.age ?? '—'} years · {p?.heightCm ?? '—'} cm · {p?.weightKg ?? '—'} kg</b><span>{titleCase(p?.sex)} · {titleCase(p?.activityLevel)} activity</span></div>
          <button className="btn-circle" style={{ width: 28, height: 28 }} onClick={openEdit} aria-label="Edit personal details"><Pencil size={12} /></button>
        </div>
        <div className="settings-row">
          <span className="icon-box volt" style={{ width: 34, height: 34, borderRadius: 10 }}><Sparkles size={15} /></span>
          <div className="sr-body"><b>{goalLabel(p?.goal)}</b><span>{p?.weeklyFrequency || 4} sessions per week · {titleCase(p?.experience)}</span></div>
          <ChevronRight size={14} className="faint" />
        </div>
        <div className="settings-row">
          <span className="icon-box amber" style={{ width: 34, height: 34, borderRadius: 10 }}><Utensils size={15} /></span>
          <div className="sr-body">
            <b>{(p?.diet?.length ? p.diet.join(' · ') : 'Balanced eating')}</b>
            <span>{p?.restrictions?.length ? `Avoiding ${p.restrictions.map(r => /^No /i.test(r) ? r.replace(/^No /i, '').toLowerCase() : r).join(', ')}` : 'No restrictions set'}</span>
          </div>
          <button className="btn-circle" style={{ width: 28, height: 28 }} onClick={openEdit} aria-label="Edit diet"><Pencil size={12} /></button>
        </div>
      </div>

      <SectionHead title="Daily targets" action="Edit" onAction={openTargets} />
      <div className="card">
        <div className="grid-2" style={{ gap: 9 }}>
          {targetSummary.map(m => (
            <div className="nutrient-tile" key={m.label} style={{ padding: '11px 12px' }}>
              <span className="lbl">{m.label}</span>
              <div className="row-between">
                <b style={{ fontSize: 17, color: m.color }}>{m.value}<span className="tiny faint" style={{ fontFamily: 'var(--font-sans)', fontWeight: 500 }}> {m.unit}</span></b>
              </div>
            </div>
          ))}
        </div>
        <div className="row-between mt-10">
          <div className="row" style={{ gap: 7 }}>
            <Utensils size={14} style={{ color: 'var(--amber)' }} />
            <span className="tiny faint">Macros split</span>
          </div>
          <span className="small strong">
            {Math.round(((Number(t?.protein || 0) * 4) / Math.max(1, Number(t?.calories || 1))) * 100)}% protein
          </span>
        </div>
        <button className="btn btn-ghost btn-block btn-sm mt-14" onClick={openTargets}><Settings size={14} /> Fine-tune targets</button>
      </div>

      <SectionHead title="Recent PRs" action="All progress" onAction={() => navigate('/progress')} />
      {prs.length === 0 ? (
        <div className="card" style={{ padding: 16 }}>
          <div className="row" style={{ gap: 12 }}>
            <span className="icon-box amber" style={{ width: 38, height: 38, borderRadius: 11 }}><Trophy size={16} /></span>
            <div className="grow"><b style={{ fontSize: 12.5 }}>No PRs yet</b><div className="tiny faint">Log weighted sets and your best lifts will appear here.</div></div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: '4px 16px' }}>
          {prs.slice(0, 3).map(pr => (
            <div className="pr-row" key={pr.exerciseId}>
              <span className="pr-medal"><Award size={14} /></span>
              <div className="grow"><b style={{ fontSize: 12.5 }}>{pr.name}</b><div className="tiny faint">{formatDate(pr.date.slice(0, 10))}</div></div>
              <div className="num" style={{ fontSize: 14 }}>{pr.weight}<span className="tiny faint">kg × {pr.reps}</span></div>
            </div>
          ))}
        </div>
      )}

      <SectionHead title="Settings" />
      <div className="settings-group">
        <div className="card">
          <div className="settings-row">
            <span className="icon-box" style={{ width: 34, height: 34, borderRadius: 10 }}>{theme === 'dark' ? <Moon size={15} /> : <Sun size={15} />}</span>
            <div className="sr-body"><b>Appearance</b><span>{theme === 'dark' ? 'Dark — easy on the eyes' : 'Light — bright and clean'}</span></div>
            <div className="segmented tiny" style={{ width: 118 }}>
              <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>Dark</button>
              <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>Light</button>
            </div>
          </div>

          <button className="settings-row" onClick={openAccount}>
            <span className="icon-box" style={{ width: 34, height: 34, borderRadius: 10 }}><Shield size={15} /></span>
            <div className="sr-body"><b>Account & security</b><span>Name, email and password</span></div>
            <ChevronRight size={14} className="faint" />
          </button>

          <button className="settings-row" onClick={handleLogout}>
            <span className="icon-box rose" style={{ width: 34, height: 34, borderRadius: 10 }}><LogOut size={15} /></span>
            <div className="sr-body"><b>Sign out</b><span>Sign out of this device</span></div>
            <ChevronRight size={14} className="faint" />
          </button>
        </div>
      </div>

      <div className="center mt-24 tiny faint" style={{ lineHeight: 1.7, paddingBottom: 10 }}>
        Pepefit · Train. Fuel. Evolve.<br />
        {formatNumber(summary?.totalVolume || 0)} kg lifted all time
      </div>

      {/* Edit profile */}
      <Sheet
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit profile"
        footer={<button className="btn btn-primary btn-block" onClick={saveProfile} disabled={busy}>{busy ? <span className="spinner" /> : 'Save profile'}</button>}
      >
        <div className="stack" style={{ gap: 13 }}>
          <div className="field"><label className="label">Name</label><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div className="field-row">
            <div className="field"><label className="label">Age</label><input className="input" type="number" value={form.age} onChange={e => setForm({ ...form, age: e.target.value === '' ? '' : Number(e.target.value) })} /></div>
            <div className="field"><label className="label">Sex</label><select className="select" value={form.sex} onChange={e => setForm({ ...form, sex: e.target.value })}><option value="male">Male</option><option value="female">Female</option><option value="other">Other / prefer not to say</option></select></div>
          </div>
          <div className="field-row">
            <div className="field"><label className="label">Height</label><div className="input-suffix"><input className="input" type="number" value={form.heightCm} onChange={e => setForm({ ...form, heightCm: e.target.value === '' ? '' : Number(e.target.value) })} /><span>cm</span></div></div>
            <div className="field"><label className="label">Weight</label><div className="input-suffix"><input className="input" type="number" step="0.1" value={form.weightKg} onChange={e => setForm({ ...form, weightKg: e.target.value === '' ? '' : Number(e.target.value) })} /><span>kg</span></div></div>
          </div>
          <div className="field">
            <label className="label">Primary goal</label>
            <div className="stack" style={{ gap: 7 }}>
              {GOAL_OPTIONS.map(g => (
                <button key={g.value} className={`option-card ${form.goal === g.value ? 'selected' : ''}`} style={{ padding: '11px 12px', borderRadius: 14 }} onClick={() => setForm({ ...form, goal: g.value })}>
                  <span className="opt-emoji" style={{ width: 36, height: 36, borderRadius: 10, fontSize: 16 }}>{g.icon}</span>
                  <span className="grow"><b style={{ fontSize: 12.5 }}>{g.label}</b><span style={{ fontSize: 10.5 }}>{g.desc}</span></span>
                  <span className="check" style={{ width: 19, height: 19 }}>{form.goal === g.value && <span style={{ width: 7, height: 7, borderRadius: 99, background: 'currentColor' }} />}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="field"><label className="label">Experience</label><div className="segmented">{EXPERIENCE_OPTIONS.map(e => <button key={e.value} className={form.experience === e.value ? 'active' : ''} onClick={() => setForm({ ...form, experience: e.value })}>{e.label}</button>)}</div></div>
          <div className="field">
            <label className="label">Workouts per week</label>
            <div className="freq-grid">{[2, 3, 4, 5, 6].map(n => <button key={n} className={`freq-opt ${form.weeklyFrequency === n ? 'active' : ''}`} style={{ fontSize: 16, padding: '10px 6px' }} onClick={() => setForm({ ...form, weeklyFrequency: n })}>{n}<span>per week</span></button>)}</div>
          </div>
          <div className="field">
            <label className="label">How do you eat?</label>
            <div className="chip-row wrap">{DIET_OPTIONS.map(d => <button key={d} className={`chip ${form.diet.includes(d) ? 'active' : ''}`} onClick={() => toggleFormList('diet', d)}>{d}</button>)}</div>
          </div>
          <div className="field">
            <label className="label">Anything to avoid?</label>
            <div className="chip-row wrap">{RESTRICTION_OPTIONS.map(d => <button key={d} className={`chip ${form.restrictions.includes(d) ? 'soft-active' : ''}`} onClick={() => toggleFormList('restrictions', d)}>{d}</button>)}</div>
          </div>
          <div className="field">
            <label className="label">Activity level</label>
            <select className="select" value={form.activityLevel} onChange={e => setForm({ ...form, activityLevel: e.target.value })}>
              <option value="sedentary">Sedentary</option><option value="light">Lightly active</option><option value="moderate">Moderately active</option><option value="high">Very active</option><option value="athlete">Athlete</option>
            </select>
          </div>
        </div>
      </Sheet>

      {/* Targets */}
      <Sheet
        open={targetsOpen}
        onClose={() => setTargetsOpen(false)}
        title="Daily targets"
        footer={<button className="btn btn-primary btn-block" onClick={saveTargets} disabled={busy}>{busy ? <span className="spinner" /> : 'Save targets'}</button>}
      >
        {targetForm && (
          <div className="stack" style={{ gap: 13 }}>
            <div className="row-between">
              <p className="hint" style={{ margin: 0 }}>Used across your rings and recipes.</p>
              <button className="chip" style={{ height: 28, fontSize: 10.5 }} onClick={suggestTargets}><Sparkles size={11} /> Suggest</button>
            </div>
            {([
              { key: 'calories', label: 'Calories', suffix: 'kcal', color: 'var(--volt)' },
              { key: 'protein', label: 'Protein', suffix: 'g', color: 'var(--sky)' },
              { key: 'carbs', label: 'Carbs', suffix: 'g', color: 'var(--amber)' },
              { key: 'fat', label: 'Fat', suffix: 'g', color: 'var(--rose)' },
              { key: 'fiber', label: 'Fiber', suffix: 'g', color: 'var(--mint)' },
              { key: 'sodium', label: 'Sodium', suffix: 'mg', color: 'var(--violet)' },
            ] as { key: keyof Targets; label: string; suffix: string; color: string }[]).map(f => (
              <div className="field" key={f.key}>
                <label className="label" style={{ color: f.color }}>{f.label}</label>
                <div className="input-suffix"><input className="input" type="number" value={targetForm[f.key]} onChange={e => setTargetForm({ ...targetForm, [f.key]: Number(e.target.value) })} /><span>{f.suffix}</span></div>
              </div>
            ))}
            <div className="hint">Macros total {Math.round(targetForm.protein * 4 + targetForm.carbs * 4 + targetForm.fat * 9)} kcal.</div>
          </div>
        )}
      </Sheet>

      {/* Account */}
      <Sheet
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        title="Account & security"
        footer={<button className="btn btn-primary btn-block" onClick={saveAccount} disabled={busy}>{busy ? <span className="spinner" /> : 'Save account'}</button>}
      >
        <div className="stack" style={{ gap: 13 }}>
          <div className="field"><label className="label">Name</label><input className="input" value={accountForm.name} onChange={e => setAccountForm({ ...accountForm, name: e.target.value })} /></div>
          <div className="field"><label className="label">Email</label><input className="input" type="email" value={accountForm.email} onChange={e => setAccountForm({ ...accountForm, email: e.target.value })} /></div>
          <div className="divider" style={{ margin: '4px 0' }} />
          <div className="label">Change password</div>
          <div className="field"><label className="label">Current password</label><input className="input" type="password" value={accountForm.currentPassword} onChange={e => setAccountForm({ ...accountForm, currentPassword: e.target.value })} placeholder="Required to set a new password" autoComplete="current-password" /></div>
          <div className="field"><label className="label">New password</label><input className="input" type="password" value={accountForm.newPassword} onChange={e => setAccountForm({ ...accountForm, newPassword: e.target.value })} placeholder="At least 8 characters" autoComplete="new-password" /></div>
          <div className="divider" style={{ margin: '4px 0' }} />
          <button className="btn btn-danger btn-sm" onClick={deleteAccount}><Trash2 size={14} /> Delete account & data</button>
          <div className="hint">Deleting removes your workouts, meals and photos. There is no undo.</div>
        </div>
      </Sheet>
    </div>
  );
}