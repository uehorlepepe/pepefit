import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronRight, Dumbbell, Flame, Play, Plus } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { api } from '../lib/api';
import { PageLoading, Ring } from '../components/ui';
import { WeeklyBars } from '../components/charts';
import { formatNumber, greeting, shortDay, toLocalISO, timeAgo } from '../lib/utils';
import type { DashboardData } from '../types';

const MACROS = [
  { key: 'protein', label: 'Protein', color: 'var(--sky)' },
  { key: 'carbs', label: 'Carbs', color: 'var(--amber)' },
  { key: 'fat', label: 'Fat', color: 'var(--rose)' },
] as const;

export function Home() {
  const { user } = useAuth();
  const { toast } = useUI();
  const navigate = useNavigate();
  const today = toLocalISO();
  const { data, loading } = useApi<DashboardData>(`/dashboard?date=${today}`);
  const [starting, setStarting] = useState(false);

  if (loading || !data) return <PageLoading />;

  const firstName = (data.user.name || user?.name || 'there').split(' ')[0];
  const initials = (data.user.name || 'P').split(' ').map(s => s[0]).slice(0, 2).join('');
  const targetCalories = data.targets.calories;
  const eaten = data.totals.calories;
  const remaining = targetCalories - eaten;
  const over = remaining < 0;
  const calRatio = targetCalories ? eaten / targetCalories : 0;
  const doneToday = data.todaySessions.find(s => s.completedAt);
  const weekMinutes = data.week.reduce((s, d) => s + d.minutes, 0);
  const activeDays = data.week.filter(d => d.workouts > 0).length;
  const suggestion = data.routineSuggestion;
  const focus = data.muscleFocus?.label;
  const workoutName = doneToday?.name || data.activeSession?.name || suggestion?.name || 'Open session';
  const workoutFocus = doneToday || data.activeSession ? null : focus;
  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();

  const startRoutine = async (routineId: number) => {
    setStarting(true);
    try {
      const res = await api<{ session: { id: number } }>('/workouts/sessions', { method: 'POST', body: { routineId } });
      navigate(`/workout/session/${res.session.id}`);
    } catch (err: any) {
      if (err.status === 409) {
        toast('Workout already in progress', 'info');
        navigate('/workout');
      } else toast(err.message, 'error');
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="page home-page">
      <header className="home-head">
        <div>
          <div className="home-meta">
            {dateLabel}
            <span className="dot-sep" />
            {data.streak}D STREAK
          </div>
          <h1 className="greet">{greeting()}, {firstName}</h1>
        </div>
        <Link to="/profile" className="avatar" aria-label="Open profile">{initials}</Link>
      </header>

      <section className="card energy-card">
        <div className="card-head">
          <span className="card-title"><Flame size={12} style={{ color: 'var(--accent)' }} /> Today's energy</span>
          <span className={`pill ${over ? 'pill-accent' : 'pill-muted'}`}>
            {over ? `${formatNumber(Math.abs(remaining))} over` : `${formatNumber(remaining)} left`}
          </span>
        </div>

        <div className="energy-body">
          <Ring value={calRatio} size={146} stroke={10} color="var(--accent)" track="rgba(255,255,255,.06)">
            <span className="big">{formatNumber(eaten)}</span>
            <span className="lbl">of {formatNumber(targetCalories)} kcal</span>
            <span className="sub">{Math.round(calRatio * 100)}%</span>
          </Ring>

          <div className="energy-macros">
            {MACROS.map(({ key, label, color }) => {
              const value = Math.round(data.totals[key]);
              const target = data.targets[key];
              const pct = target ? Math.min(100, (value / target) * 100) : 0;
              return (
                <div className="macro-row" key={key}>
                  <div className="macro-top">
                    <span className="macro-name">{label}</span>
                    <span className="macro-figure">
                      <b>{value}</b>
                      <em>of {target} g</em>
                    </span>
                  </div>
                  <div className="bar bar-xs">
                    <i style={{ width: value > 0 ? `${pct}%` : 0, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="energy-foot">
          <Link to="/nutrition" className="btn btn-ghost btn-block">
            <Plus size={14} /> Log a meal
          </Link>
        </div>
      </section>

      <section className="card workout-hero mt-14">
        <div className="card-head">
          <span className="card-title"><Dumbbell size={12} style={{ color: 'var(--accent)' }} /> {doneToday ? 'Today’s session' : data.activeSession ? 'In progress' : 'Next session'}</span>
          {!doneToday && !data.activeSession && <span className="pill pill-accent">Planned</span>}
        </div>

        <h2 className="workout-title">
          {workoutName}
          {workoutFocus && <span> — {workoutFocus}</span>}
        </h2>

        {doneToday ? (
          <>
            <div className="workout-done-stats">
              <div><b>{doneToday.sets}</b><span>Working sets</span></div>
              <div><b>{formatNumber(doneToday.volume)}</b><span>Volume kg</span></div>
              <div><b>{Math.round(doneToday.durationSec / 60)}</b><span>Minutes</span></div>
            </div>
            <button className="btn btn-ghost btn-block" onClick={() => navigate(`/workout/session/${doneToday.id}`)}>
              View session <ChevronRight size={14} />
            </button>
          </>
        ) : data.activeSession ? (
          <>
            <div className="workout-meta">Started {timeAgo(data.activeSession.startedAt)} · sets saved</div>
            <button className="btn btn-primary btn-block" onClick={() => navigate(`/workout/session/${data.activeSession!.id}`)}>
              Resume workout <ArrowRight size={15} />
            </button>
          </>
        ) : (
          <>
            <div className="workout-meta">
              {suggestion?.exerciseCount ? `${suggestion.exerciseCount} exercises` : 'Open plan'}
              {suggestion?.estimatedMin ? ` · ~${suggestion.estimatedMin} min` : ''}
            </div>
            <button
              className="btn btn-primary btn-block"
              disabled={starting}
              onClick={() => suggestion ? startRoutine(suggestion.id) : navigate('/workout')}
            >
              {starting ? <span className="spinner" /> : <>Start workout <Play size={14} fill="currentColor" /></>}
            </button>
          </>
        )}
      </section>

      <section className="card week-card mt-14">
        <div className="card-head">
          <span className="card-title">This week</span>
          <Link className="micro-btn" to="/workout">Workout log <ChevronRight size={10} /></Link>
        </div>

        <div className="week-stats">
          <div>
            <b>{data.weeklyWorkouts}<span className="den">/{data.weeklyGoal}</span></b>
            <span>Workouts</span>
          </div>
          <div>
            <b>{weekMinutes}<span className="den">m</span></b>
            <span>Active time</span>
          </div>
          <div className="align-right">
            <b className={data.weightChange < 0 ? 'good' : data.weightChange > 0 ? 'warn' : ''}>
              {data.weightChange === 0 ? '—' : `${data.weightChange > 0 ? '+' : ''}${data.weightChange}`}<span className="den">kg</span>
            </b>
            <span>30-day trend</span>
          </div>
        </div>

        <WeeklyBars
          data={data.week.map((d, i) => ({ value: d.calories, label: shortDay(d.date), highlight: i === data.week.length - 1 }))}
          target={data.targets.calories}
          height={82}
          suffix=" kcal"
        />
        <div className="week-foot">
          <span>7-day energy vs target</span>
          <span>{activeDays} active days</span>
        </div>
      </section>
    </div>
  );
}