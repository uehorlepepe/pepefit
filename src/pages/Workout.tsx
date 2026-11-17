import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, CalendarDays, ChevronRight, Dumbbell, History, Pencil, Play, Plus,
  Search, Sparkles, Timer, TrendingUp, X,
} from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useUI } from '../context/UIContext';
import { api } from '../lib/api';
import { MuscleMap } from '../components/MuscleMap';
import { RoutineBuilder } from '../components/RoutineBuilder';
import { ExerciseDetail } from '../components/ExercisePicker';
import { EmptyState, PageLoading, SectionHead, Sheet, Skeleton } from '../components/ui';
import { MUSCLE_LABELS, formatDate, formatDuration, formatVolume, timeAgo } from '../lib/utils';
import type { Exercise, MuscleMapData, Routine, Session } from '../types';

const colorFor = (c: string) => c === 'sky' ? 'sky' : c === 'rose' ? 'rose' : c === 'amber' ? 'amber' : '';

export function Workout() {
  const navigate = useNavigate();
  const { toast } = useUI();
  const [tab, setTab] = useState<'train' | 'library'>('train');
  const [range, setRange] = useState(7);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [starting, setStarting] = useState<number | 'empty' | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('All');

  const { data: muscles, loading: mapLoading } = useApi<MuscleMapData>(`/workouts/muscle-map?days=${range}`, [range]);
  const { data: routinesData, loading: routinesLoading, refetch: refetchRoutines } = useApi<{ routines: Routine[] }>('/workouts/routines');
  const { data: sessionsData, refetch: refetchSessions } = useApi<{ sessions: Session[]; inProgress: Session | null }>('/workouts/sessions?limit=30');
  const { data: exerciseData, loading: exercisesLoading } = useApi<{ exercises: Exercise[] }>(tab === 'library' ? '/workouts/exercises' : null);

  const workouts = sessionsData?.sessions || [];
  const routines = routinesData?.routines || [];
  const inProgress = sessionsData?.inProgress;

  const groupKeys: Record<string, string[]> = {
    Chest: ['chest'], Back: ['lats', 'upper_back', 'traps', 'lower_back'],
    Shoulders: ['front_delts', 'side_delts', 'rear_delts'], Arms: ['biceps', 'triceps', 'forearms'],
    Legs: ['quads', 'hamstrings', 'glutes', 'calves'], Core: ['abs', 'obliques'],
  };
  const exercises = useMemo(() => {
    const needle = q.toLowerCase().trim();
    const keys = groupKeys[group] || [];
    return (exerciseData?.exercises || []).filter(e => {
      if (needle && !e.name.toLowerCase().includes(needle) && !e.equipment.toLowerCase().includes(needle)) return false;
      if (keys.length && !e.primaryMuscles.some(m => keys.includes(m))) return false;
      return true;
    });
  }, [exerciseData, q, group]);

  const startWorkout = async (routineId?: number) => {
    setStarting(routineId || 'empty');
    try {
      const res = await api<{ session: { id: number } }>('/workouts/sessions', {
        method: 'POST', body: routineId ? { routineId } : { name: 'Training session' },
      });
      navigate(`/workout/session/${res.session.id}`);
    } catch (err: any) {
      if (err.status === 409) {
        toast('Session already in progress', 'info', 'Taking you back to it.');
        navigate(`/workout/session/${err.sessionId || inProgress?.id}`);
      } else toast(err.message, 'error');
    } finally {
      setStarting(null);
    }
  };

  const openBuilder = (routine: Routine | null) => {
    setEditingRoutine(routine);
    setBuilderOpen(true);
  };

  if (mapLoading && !muscles) return <PageLoading />;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Workout</h1>
        </div>
        <div className="row" style={{ gap: 7, marginTop: 3 }}>
          <button className="btn-circle" onClick={() => setHistoryOpen(true)} aria-label="Workout history"><History size={16} /></button>
          <button className="btn-circle" onClick={() => openBuilder(null)} aria-label="New routine"><Plus size={16} /></button>
        </div>
      </div>

      <div className="segmented" style={{ marginBottom: 16 }}>
        <button className={tab === 'train' ? 'active' : ''} onClick={() => setTab('train')}><Dumbbell size={13} /> My training</button>
        <button className={tab === 'library' ? 'active' : ''} onClick={() => setTab('library')}><Search size={13} /> Exercise library</button>
      </div>

      {tab === 'train' ? (
        <>
          {inProgress && (
            <button className="session-live mb-14 btn-block" onClick={() => navigate(`/workout/session/${inProgress.id}`)}>
              <span className="live-dot" />
              <span className="grow" style={{ textAlign: 'left' }}>
                <b>{inProgress.name} in progress</b>
                <span>Started {timeAgo(inProgress.startedAt)} · tap to resume</span>
              </span>
              <ArrowRight size={16} style={{ color: 'var(--accent)' }} />
            </button>
          )}

          <div className="card muscle-hero">
            <div className="muscle-hero-top">
              <div>
                <div className="card-title"><Sparkles size={13} style={{ color: 'var(--accent)' }} /> Muscle map</div>
                <div className="tiny faint" style={{ marginTop: 4 }}>
                  {muscles?.totalSets || 0} working sets · {muscles?.lastWorkout ? `last ${timeAgo(muscles.lastWorkout)}` : 'no sessions yet'}
                </div>
              </div>
              <div className="segmented tiny" style={{ width: 164 }}>
                {[{ v: 1, l: 'Today' }, { v: 7, l: '7 days' }, { v: 30, l: '30 days' }].map(r => (
                  <button key={r.v} className={range === r.v ? 'active' : ''} onClick={() => setRange(r.v)}>{r.l}</button>
                ))}
              </div>
            </div>
            {mapLoading || !muscles ? <Skeleton height={360} /> : <MuscleMap muscles={muscles.muscles} />}
            {muscles && muscles.neglected.length > 0 && (
              <>
                <div className="divider" style={{ margin: '12px 0 10px' }} />
                <div className="row" style={{ alignItems: 'flex-start', gap: 8 }}>
                  <span className="pill pill-muted" style={{ flexShrink: 0 }}>Neglected</span>
                  <span className="small" style={{ color: 'var(--text-2)', lineHeight: 1.5 }}>{muscles.neglected.slice(0, 4).join(' · ')}</span>
                </div>
              </>
            )}
          </div>

          <div className="section-head">
            <h2>Your routines</h2>
            <button className="link" onClick={() => openBuilder(null)}><Plus size={12} /> New routine</button>
          </div>

          {routinesLoading ? (
            <div className="stack" style={{ gap: 10 }}><Skeleton height={132} /><Skeleton height={132} /></div>
          ) : routines.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<Dumbbell size={22} />} title="Build your first routine"
                text="Pick exercises, set targets and start training in seconds."
                action={<button className="btn btn-primary btn-sm" onClick={() => openBuilder(null)}><Plus size={14} /> Create routine</button>}
              />
            </div>
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              {routines.map(r => {
                const muscleSet = [...new Set(r.exercises.flatMap(e => e.primaryMuscles))].slice(0, 5);
                return (
                  <div className="card routine-card" key={r.id}>
                    <div className="r-head">
                      <span className={`routine-badge ${colorFor(r.color)}`}><Dumbbell size={19} /></span>
                      <div className="grow">
                        <div className="row" style={{ gap: 6 }}>
                          <b style={{ fontSize: 14, fontWeight: 600 }}>{r.name}</b>
                        </div>
                        <div className="tiny faint" style={{ marginTop: 2 }}>{r.description || `${r.exercises.length} exercises`}</div>
                      </div>
                      <button className="btn-circle" style={{ width: 32, height: 32 }} onClick={() => openBuilder(r)} aria-label={`Edit ${r.name}`}><Pencil size={13} /></button>
                    </div>
                    <div className="routine-muscles">
                      {muscleSet.map(m => <span key={m}>{MUSCLE_LABELS[m]}</span>)}
                    </div>
                    <div className="row-between">
                      <span className="tiny faint">{r.exercises.length} exercises · ~{Math.max(20, r.exercises.length * 8)} min{r.lastPerformed ? ` · ${timeAgo(r.lastPerformed)}` : ''}</span>
                      <button className="btn btn-sm btn-primary" disabled={starting === r.id} onClick={() => startWorkout(r.id)}>
                        {starting === r.id ? <span className="spinner" /> : <><Play size={12} /> Start</>}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button className="btn btn-ghost btn-block mt-10" style={{ height: 46, fontSize: 12.5, borderStyle: 'dashed' }} disabled={starting === 'empty'} onClick={() => startWorkout()}>
            {starting === 'empty' ? <span className="spinner" /> : <><Plus size={15} /> Start an empty session</>}
          </button>

          <SectionHead title="Recent sessions" action={workouts.length > 4 ? 'See all' : undefined} onAction={() => setHistoryOpen(true)} />
          {workouts.length === 0 ? (
            <div className="card"><EmptyState icon={<TrendingUp size={21} />} title="No sessions logged yet" text="Your completed workouts will build a timeline of progress here." /></div>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              {workouts.slice(0, 4).map(s => {
                const d = new Date(s.startedAt);
                return (
                  <button key={s.id} className="card history-card card-press" style={{ width: '100%', textAlign: 'left' }} onClick={() => navigate(`/workout/session/${s.id}`)}>
                    <div className="history-date">
                      <b>{d.getDate()}</b>
                      <span>{d.toLocaleDateString(undefined, { month: 'short' })}</span>
                    </div>
                    <div className="grow">
                      <div className="row-between" style={{ gap: 6 }}>
                        <b style={{ fontSize: 13 }}>{s.name}</b>
                        <ChevronRight size={14} style={{ color: 'var(--faint)' }} />
                      </div>
                      <div className="history-meta">
                        <span>{s.totalSets} sets</span>
                        <span className="dot" />
                        <span>{formatVolume(s.volume)}</span>
                        <span className="dot" />
                        <span>{formatDuration(s.durationSec)}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="input-suffix" style={{ marginBottom: 10 }}>
            <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)' }} />
            <input className="input" style={{ paddingLeft: 38 }} placeholder="Search 65 exercises" value={q} onChange={e => setQ(e.target.value)} />
            {q && <button className="pw-toggle" onClick={() => setQ('')} aria-label="Clear"><X size={14} /></button>}
          </div>
          <div className="chip-row" style={{ marginBottom: 10 }}>
            {['All', 'Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core'].map(g => (
              <button key={g} className={`chip ${group === g ? 'active' : ''}`} style={{ height: 30, fontSize: 11 }} onClick={() => setGroup(g)}>{g}</button>
            ))}
          </div>
          {exercisesLoading ? (
            <div className="stack" style={{ gap: 8 }}>{[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} height={58} />)}</div>
          ) : exercises.length === 0 ? (
            <EmptyState icon={<Search size={20} />} title="No matches" text="Try another search or muscle group." />
          ) : (
            <div className="card" style={{ padding: '4px 16px' }}>
              {exercises.map(ex => (
                <button key={ex.id} className="picker-item" onClick={() => setDetailId(ex.id)}>
                  <span className="icon-box" style={{ width: 34, height: 34, borderRadius: 10 }}><Dumbbell size={14} /></span>
                  <span className="grow">
                    <b>{ex.name}</b>
                    <span>{ex.primaryMuscles.map(m => MUSCLE_LABELS[m]).join(' · ')}</span>
                  </span>
                  <span className="exercise-tag">{ex.equipment}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <RoutineBuilder open={builderOpen} onClose={() => setBuilderOpen(false)} routine={editingRoutine} onSaved={refetchRoutines} />
      <ExerciseDetail exerciseId={detailId} onClose={() => setDetailId(null)} />

      <Sheet open={historyOpen} onClose={() => setHistoryOpen(false)} title="Workout history">
        {workouts.length === 0 ? <EmptyState icon={<History size={20} />} title="No sessions yet" /> : (
          <div className="stack" style={{ gap: 8 }}>
            {workouts.map(s => {
              const d = new Date(s.startedAt);
              return (
                <button key={s.id} className="card history-card" style={{ width: '100%', textAlign: 'left', padding: 12 }} onClick={() => { setHistoryOpen(false); navigate(`/workout/session/${s.id}`); }}>
                  <div className="history-date">
                    <b>{d.getDate()}</b><span>{d.toLocaleDateString(undefined, { month: 'short' })}</span>
                  </div>
                  <div className="grow">
                    <div className="row-between"><b style={{ fontSize: 13 }}>{s.name}</b><ChevronRight size={14} style={{ color: 'var(--faint)' }} /></div>
                    <div className="history-meta">
                      <span>{formatDate(s.startedAt.slice(0, 10))}</span><span className="dot" />
                      <span>{s.totalSets} sets</span><span className="dot" />
                      <span>{formatVolume(s.volume)}</span><span className="dot" />
                      <span>{formatDuration(s.durationSec)}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Sheet>
    </div>
  );
}