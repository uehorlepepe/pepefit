import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Check, ChevronDown, Clock, Dumbbell, Flame, MoreHorizontal, Plus, RotateCcw,
  Timer, Trash2, Trophy, X, Save, Play,
} from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useUI } from '../context/UIContext';
import { api } from '../lib/api';
import { ExercisePicker } from '../components/ExercisePicker';
import { EmptyState, PageLoading, Sheet } from '../components/ui';
import { formatClock, formatDate, formatDuration, formatVolume, timeAgo, MUSCLE_LABELS } from '../lib/utils';
import type { Exercise, Session } from '../types';

const REST_KEY = 'pepefit.restSeconds';
const FEELINGS = ['😮‍💨', '😐', '🙂', '💪', '🔥'];

export function SessionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useUI();
  const { data, loading, refetch } = useApi<{ session: Session }>(id ? `/workouts/sessions/${id}` : null);
  const session = data?.session;
  const [elapsed, setElapsed] = useState(0);
  const [draft, setDraft] = useState<Record<number, { weight: string; reps: string }>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [feeling, setFeeling] = useState(4);
  const [notes, setNotes] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [restTotal, setRestTotal] = useState(90);
  const [restDefault, setRestDefault] = useState(() => Number(localStorage.getItem(REST_KEY)) || 90);
  const [busy, setBusy] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [prCount, setPrCount] = useState(0);

  const active = !!session && !session.completedAt;

  useEffect(() => {
    if (!session) return;
    setNotes(session.notes || '');
    setFeeling(session.feeling || 4);
    setDraft(prev => {
      const next = { ...prev };
      const lastLogged = session.exercises.flatMap(e => e.sets).sort((a, b) => b.id - a.id)[0];
      for (const ex of session.exercises) {
        if (!next[ex.exerciseId]) {
          const lastSet = ex.sets[ex.sets.length - 1];
          const prevSet = (ex as any).last?.sets?.[0];
          next[ex.exerciseId] = {
            weight: String(lastSet?.weight ?? prevSet?.weight ?? ''),
            reps: String(lastSet?.reps ?? prevSet?.reps ?? ''),
          };
        }
      }
      return next;
    });
  }, [session?.id, session?.exercises?.length]);

  useEffect(() => {
    if (!session || !active) return;
    const tick = () => setElapsed(Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [session?.id, active]);

  useEffect(() => {
    if (!restEnd) return;
    const tick = () => {
      if (Date.now() >= restEnd) {
        setRestEnd(null);
        if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
        toast('Rest complete', 'info', 'Next set when you\'re ready.');
      }
    };
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [restEnd, toast]);

  const remainingRest = restEnd ? Math.max(0, Math.ceil((restEnd - Date.now()) / 1000)) : 0;

  if (loading || !session) return <PageLoading />;

  const setDraftValue = (exId: number, key: 'weight' | 'reps', value: string) => {
    setDraft(prev => ({ ...prev, [exId]: { ...(prev[exId] || { weight: '', reps: '' }), [key]: value } }));
  };

  const startRest = () => {
    setRestTotal(restDefault);
    setRestEnd(Date.now() + restDefault * 1000);
  };

  const logSet = async (ex: any) => {
    const d = draft[ex.exerciseId] || { weight: '', reps: '' };
    const reps = Number(d.reps);
    if (!Number.isFinite(reps) || reps < 1) {
      toast('Add your reps first', 'error', 'Enter how many reps you completed.');
      return;
    }
    setBusy(`log-${ex.exerciseId}`);
    try {
      const res = await api<{ isPR: boolean; set: any }>(`/workouts/sessions/${session.id}/sets`, {
        method: 'POST',
        body: { exerciseId: ex.exerciseId, weight: Number(d.weight) || 0, reps, rpe: null },
      });
      if (res.isPR) {
        setPrCount(c => c + 1);
        toast('New personal record', 'pr', `${ex.name} · ${d.weight || 0} kg × ${reps}`);
      } else {
        toast('Set logged', 'success', `${ex.name} · ${d.weight || 0} kg × ${reps}`);
      }
      setDraft(prev => ({ ...prev, [ex.exerciseId]: { weight: d.weight, reps: d.reps } }));
      await refetch();
      startRest();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const toggleSet = async (set: any, completed: boolean) => {
    try {
      await api(`/workouts/sets/${set.id}`, { method: 'PUT', body: { completed } });
      refetch();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const updateSet = async (set: any, patch: { weight?: number; reps?: number }) => {
    try {
      await api(`/workouts/sets/${set.id}`, { method: 'PUT', body: patch });
      refetch();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const deleteSet = async (set: any) => {
    try {
      await api(`/workouts/sets/${set.id}`, { method: 'DELETE' });
      refetch();
      toast('Set removed', 'info');
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const addExercise = async (ex: Exercise) => {
    try {
      await api(`/workouts/sessions/${session.id}/exercises`, { method: 'POST', body: { exerciseId: ex.id } });
      await refetch();
      toast(`${ex.name} added`, 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const removeExercise = async (ex: any) => {
    if (ex.sets.length) return;
    try {
      await api(`/workouts/sessions/${session.id}/exercises/${ex.exerciseId}`, { method: 'DELETE' });
      await refetch();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const finish = async () => {
    setFinishing(true);
    try {
      await api(`/workouts/sessions/${session.id}`, {
        method: 'PATCH',
        body: { finished: true, feeling, notes, durationSec: elapsed },
      });
      toast('Workout complete', 'success', `${session.totalSets} sets · ${formatVolume(session.volume)}${prCount ? ` · ${prCount} PR${prCount > 1 ? 's' : ''}` : ''}`);
      navigate('/workout');
    } catch (err: any) {
      toast(err.message, 'error');
      setFinishing(false);
    }
  };

  const repeat = async () => {
    try {
      const res = await api<{ session: { id: number } }>('/workouts/sessions', { method: 'POST', body: { name: session.name, routineId: session.routineId } });
      for (const ex of session.exercises) {
        await api(`/workouts/sessions/${res.session.id}/exercises`, { method: 'POST', body: { exerciseId: ex.exerciseId, targetSets: ex.targetSets } }).catch(() => {});
      }
      navigate(`/workout/session/${res.session.id}`);
    } catch (err: any) {
      if (err.status === 409) navigate(`/workout/session/${err.sessionId}`);
      else toast(err.message, 'error');
    }
  };

  const destroy = async () => {
    if (!confirm('Delete this workout? This cannot be undone.')) return;
    try {
      await api(`/workouts/sessions/${session.id}`, { method: 'DELETE' });
      toast('Workout deleted', 'info');
      navigate('/workout');
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const totalVolume = session.volume;
  const duration = active ? elapsed : session.durationSec;

  return (
    <div className="page" style={{ paddingBottom: active ? 168 : 96 }}>
      <div className="session-head">
        <button className="btn-circle" onClick={() => navigate('/workout')} aria-label="Back to workouts"><ArrowLeft size={17} /></button>
        <div style={{ textAlign: 'center', flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.name}</div>
          <div className="tiny faint">{active ? 'In progress' : formatDate(session.startedAt.slice(0, 10), { weekday: 'short', month: 'short', day: 'numeric' })}</div>
        </div>
        {active ? (
          <div className="session-timer"><Clock size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />{formatClock(elapsed)}</div>
        ) : (
          <button className="btn-circle" onClick={() => setMenuOpen(true)} aria-label="Session options"><MoreHorizontal size={17} /></button>
        )}
      </div>

      <div className="card" style={{ background: 'var(--surface)' }}>
        <div className="row-between">
          <div>
            <div className="card-title">{active ? 'In progress' : 'Summary'}</div>
            <div className="num" style={{ fontSize: 26, marginTop: 5 }}>{formatVolume(totalVolume)}<span className="small faint" style={{ fontFamily: 'var(--font-sans)', fontWeight: 500, marginLeft: 6 }}>volume</span></div>
          </div>
          {active && <span className="pill pill-volt"><span className="live-dot" style={{ width: 5, height: 5 }} /> Recording</span>}
        </div>
        <div className="grid-3 mt-14">
          <div><div className="num" style={{ fontSize: 19 }}>{session.totalSets}</div><div className="tiny faint">Sets</div></div>
          <div><div className="num" style={{ fontSize: 19 }}>{formatDuration(duration)}</div><div className="tiny faint">Duration</div></div>
          <div><div className="num" style={{ fontSize: 19 }}>{session.exercises.length}</div><div className="tiny faint">Exercises</div></div>
        </div>
      </div>

      <div className="row-between mt-18 mb-10">
        <span className="label" style={{ fontSize: 11 }}>{active ? 'Log your sets' : 'Exercises'}</span>
        {active && (
          <button className="chip" style={{ height: 26, fontSize: 10 }} onClick={() => { const next = restDefault === 60 ? 90 : restDefault === 90 ? 120 : restDefault === 120 ? 180 : 60; setRestDefault(next); localStorage.setItem(REST_KEY, String(next)); toast(`Rest timer set to ${next}s`, 'info'); }}>
            <Timer size={11} /> Rest {restDefault}s
          </button>
        )}
      </div>

      {session.exercises.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Dumbbell size={22} />} title="No exercises yet" text="Add your first exercise to start logging sets." action={active ? <button className="btn btn-primary btn-sm" onClick={() => setPickerOpen(true)}><Plus size={14} /> Add exercise</button> : undefined} />
        </div>
      ) : session.exercises.map((ex: any, idx) => (
        <div className="card exercise-block" key={ex.exerciseId}>
          <div className="exercise-block-head">
            <span className="ex-ico"><Dumbbell size={16} /></span>
            <div className="grow">
              <b>{ex.name}</b>
              <span>{ex.muscles.map((m: string) => MUSCLE_LABELS[m]).join(' · ')}{ex.equipment ? ` · ${ex.equipment}` : ''}</span>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div className="tiny faint">{ex.sets.length}/{ex.targetSets || 3} sets</div>
              {active && ex.sets.length === 0 && <button className="tiny" style={{ color: 'var(--faint)' }} onClick={() => removeExercise(ex)}>remove</button>}
            </div>
          </div>

          {ex.last?.sets?.length > 0 && (
            <div className="set-prev" style={{ marginBottom: 8 }}>Last time: {ex.last.sets.map((s: any) => `${s.weight}×${s.reps}`).join('  ·  ')}</div>
          )}

          <table className="set-table">
            <thead><tr><th>Set</th><th>kg</th><th>Reps</th><th style={{ width: 46 }}><Check size={10} style={{ margin: '0 auto' }} /></th>{active && <th style={{ width: 22 }} />}</tr></thead>
            <tbody>
              {ex.sets.map((set: any) => (
                <tr key={set.id} className={`set-row ${set.completed ? 'done' : ''}`}>
                  <td><span className="small faint">{set.setNumber}</span></td>
                  <td>
                    {active ? (
                      <input className="set-input" type="number" inputMode="decimal" defaultValue={set.weight} key={`w-${set.id}-${set.weight}`} onBlur={e => { const v = Number(e.target.value); if (v !== set.weight) updateSet(set, { weight: v }); }} />
                    ) : <span style={{ fontSize: 13, fontWeight: 550 }}>{set.weight === 0 ? 'BW' : set.weight}</span>}
                  </td>
                  <td>
                    {active ? (
                      <input className="set-input" type="number" inputMode="numeric" defaultValue={set.reps} key={`r-${set.id}-${set.reps}`} onBlur={e => { const v = Number(e.target.value); if (v !== set.reps) updateSet(set, { reps: v }); }} />
                    ) : <span style={{ fontSize: 13, fontWeight: 550 }}>{set.reps}</span>}
                  </td>
                  <td>
                    <button className={`set-check ${set.completed ? 'done' : ''}`} onClick={() => active && toggleSet(set, !set.completed)} disabled={!active} aria-label="Toggle set complete">
                      <Check size={13} strokeWidth={3} />
                    </button>
                  </td>
                  {active && <td><button className="set-del" onClick={() => deleteSet(set)} aria-label="Delete set"><X size={12} /></button></td>}
                </tr>
              ))}
              {active && (
                <tr>
                  <td><span className="small faint">{ex.sets.length + 1}</span></td>
                  <td><input className="set-input" type="number" inputMode="decimal" placeholder="0" value={draft[ex.exerciseId]?.weight ?? ''} onChange={e => setDraftValue(ex.exerciseId, 'weight', e.target.value)} /></td>
                  <td><input className="set-input" type="number" inputMode="numeric" placeholder="reps" value={draft[ex.exerciseId]?.reps ?? ''} onChange={e => setDraftValue(ex.exerciseId, 'reps', e.target.value)} onKeyDown={e => { if (e.key === 'Enter') logSet(ex); }} /></td>
                  <td>
                    <button className="set-check" onClick={() => logSet(ex)} disabled={busy === `log-${ex.exerciseId}`} aria-label="Log set" style={{ borderColor: 'color-mix(in srgb, var(--accent) 40%, transparent)', color: 'var(--accent)' }}>
                      {busy === `log-${ex.exerciseId}` ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <Plus size={15} strokeWidth={2.5} />}
                    </button>
                  </td>
                  <td />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ))}

      {active && (
        <button className="btn btn-ghost btn-block" style={{ height: 44, fontSize: 12, borderStyle: 'dashed' }} onClick={() => setPickerOpen(true)}>
          <Plus size={14} /> Add exercise
        </button>
      )}

      <div className="card mt-14" style={{ padding: 16 }}>
        <div className="row-between mb-10">
          <span className="label" style={{ margin: 0 }}>Session notes</span>
          {active && <span className="tiny faint">Saved when you finish</span>}
        </div>
        <textarea className="textarea" style={{ minHeight: 74, fontSize: 12.5 }} placeholder="How did it feel? Anything to remember for next time?" value={notes} onChange={e => setNotes(e.target.value)} readOnly={!active} />
        {active && (
          <div className="row-between mt-14">
            <span className="label" style={{ margin: 0 }}>Energy</span>
            <div className="row" style={{ gap: 5 }}>
              {FEELINGS.map((f, i) => (
                <button key={i} onClick={() => setFeeling(i + 1)} style={{
                  width: 34, height: 34, borderRadius: 10, fontSize: 15,
                  background: feeling === i + 1 ? 'var(--accent-dim)' : 'var(--tint)',
                  border: `1px solid ${feeling === i + 1 ? 'color-mix(in srgb, var(--accent) 45%, transparent)' : 'var(--line)'}`, transition: '.18s',
                }} aria-label={`Energy ${i + 1}`}>{f}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {!active && (
        <div className="grid-2 mt-14">
          <button className="btn btn-primary" onClick={repeat}><RotateCcw size={15} /> Repeat</button>
          <button className="btn btn-ghost" onClick={destroy}><Trash2 size={14} /> Delete</button>
        </div>
      )}

      {active && (
        <div className="session-finish-bar">
          <button className="btn btn-primary btn-lg btn-block" onClick={() => setFinishOpen(true)} disabled={session.totalSets === 0}>
            <Check size={17} /> Finish workout
          </button>
        </div>
      )}

      {restEnd && (
        <div className="rest-timer">
          <span className="rt-time">{formatClock(remainingRest)}</span>
          <div className="grow">
            <div className="tiny faint" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Timer size={10} /> Rest</div>
            <div className="rt-bar"><i style={{ width: `${(remainingRest / restTotal) * 100}%` }} /></div>
          </div>
          <button className="btn btn-sm" style={{ height: 32, padding: '0 10px', background: 'var(--accent-dim)', color: 'var(--accent)', fontSize: 11 }} onClick={() => { setRestTotal(t => t + 15); setRestEnd(e => (e || Date.now()) + 15000); }}>+15s</button>
          <button className="btn-circle" style={{ width: 30, height: 30 }} onClick={() => setRestEnd(null)} aria-label="Skip rest"><X size={13} /></button>
        </div>
      )}

      <ExercisePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={addExercise} excludeIds={session.exercises.map(e => e.exerciseId)} />

      <Sheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        title="Finish this workout?"
        footer={<button className="btn btn-primary btn-block" onClick={finish} disabled={finishing}>{finishing ? <span className="spinner" /> : <><Flame size={16} /> Complete session</>}</button>}
      >
        <div className="card" style={{ padding: 16, boxShadow: 'none' }}>
          <div className="grid-3">
            <div><div className="num" style={{ fontSize: 20 }}>{formatDuration(elapsed)}</div><div className="tiny faint">Duration</div></div>
            <div><div className="num" style={{ fontSize: 20 }}>{session.totalSets}</div><div className="tiny faint">Sets</div></div>
            <div><div className="num" style={{ fontSize: 20 }}>{formatVolume(session.volume)}</div><div className="tiny faint">Volume</div></div>
          </div>
        </div>
        <div className="field mt-14">
          <label className="label">How did it feel?</label>
          <div className="row" style={{ gap: 6 }}>
            {FEELINGS.map((f, i) => (
              <button key={i} onClick={() => setFeeling(i + 1)} style={{
                flex: 1, height: 42, borderRadius: 12, fontSize: 18,
                background: feeling === i + 1 ? 'var(--accent-dim)' : 'var(--tint)',
                border: `1px solid ${feeling === i + 1 ? 'color-mix(in srgb, var(--accent) 45%, transparent)' : 'var(--line)'}`,
              }} aria-label={`Energy ${i + 1}`}>{f}</button>
            ))}
          </div>
        </div>
        <div className="field mt-14">
          <label className="label">Notes</label>
          <textarea className="textarea" style={{ minHeight: 80, fontSize: 12.5 }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="What went well? What will you progress next time?" />
        </div>
        {prCount > 0 && <div className="form-success mt-14"><Trophy size={13} style={{ display: 'inline', verticalAlign: -2, marginRight: 5 }} />{prCount} new personal record{prCount > 1 ? 's' : ''} today. Strong work.</div>}
      </Sheet>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Session options">
        <button className="settings-row" onClick={() => { setMenuOpen(false); repeat(); }}>
          <span className="icon-box volt"><RotateCcw size={16} /></span>
          <span className="sr-body"><b>Repeat this workout</b><span>Start a new session with the same exercises</span></span>
          <Play size={14} className="faint" />
        </button>
        <button className="settings-row" onClick={() => { setMenuOpen(false); destroy(); }}>
          <span className="icon-box" style={{ color: 'var(--danger)' }}><Trash2 size={16} /></span>
          <span className="sr-body"><b style={{ color: 'var(--danger)' }}>Delete session</b><span>Remove it from your history</span></span>
        </button>
      </Sheet>
    </div>
  );
}