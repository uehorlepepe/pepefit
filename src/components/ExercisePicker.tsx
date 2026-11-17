import { useMemo, useState } from 'react';
import { Search, Plus, ChevronRight, Dumbbell, Trophy, X } from 'lucide-react';
import { Sheet, Skeleton, EmptyState } from './ui';
import { useApi } from '../hooks/useApi';
import type { Exercise } from '../types';
import { MUSCLE_LABELS, formatDate } from '../lib/utils';
import { TrendChart } from './charts';

const GROUPS = [
  { label: 'All', keys: [] as string[] },
  { label: 'Chest', keys: ['chest'] },
  { label: 'Back', keys: ['lats', 'upper_back', 'traps', 'lower_back'] },
  { label: 'Shoulders', keys: ['front_delts', 'side_delts', 'rear_delts'] },
  { label: 'Arms', keys: ['biceps', 'triceps', 'forearms'] },
  { label: 'Legs', keys: ['quads', 'hamstrings', 'glutes', 'calves'] },
  { label: 'Core', keys: ['abs', 'obliques'] },
];

export function ExercisePicker({ open, onClose, onPick, title = 'Add exercise', excludeIds = [] }: {
  open: boolean; onClose: () => void; onPick: (ex: Exercise) => void; title?: string; excludeIds?: number[];
}) {
  const { data, loading } = useApi<{ exercises: Exercise[] }>(open ? '/workouts/exercises' : null);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('All');

  const filtered = useMemo(() => {
    const keys = GROUPS.find(g => g.label === group)?.keys || [];
    const needle = q.toLowerCase().trim();
    return (data?.exercises || []).filter(e => {
      if (needle && !e.name.toLowerCase().includes(needle) && !e.equipment.toLowerCase().includes(needle)) return false;
      if (keys.length && !e.primaryMuscles.some(m => keys.includes(m)) && !e.secondaryMuscles.some(m => keys.includes(m))) return false;
      return true;
    });
  }, [data, q, group]);

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="input-suffix" style={{ marginBottom: 12 }}>
        <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)' }} />
        <input className="input" style={{ paddingLeft: 38 }} placeholder="Search exercises or equipment" value={q} onChange={e => setQ(e.target.value)} />
        {q && <button className="pw-toggle" onClick={() => setQ('')} aria-label="Clear"><X size={14} /></button>}
      </div>
      <div className="chip-row" style={{ marginBottom: 12 }}>
        {GROUPS.map(g => (
          <button key={g.label} className={`chip ${group === g.label ? 'active' : ''}`} style={{ height: 30, fontSize: 11 }} onClick={() => setGroup(g.label)}>{g.label}</button>
        ))}
      </div>

      {loading ? (
        <div className="stack" style={{ gap: 10 }}>{[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} height={54} />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Dumbbell size={20} />} title="No exercises found" text="Try a different search or muscle group." />
      ) : (
        <div className="picker-list">
          {filtered.map(ex => {
            const added = excludeIds.includes(ex.id);
            return (
              <button key={ex.id} className="picker-item" onClick={() => { if (!added) { onPick(ex); onClose(); } }} disabled={added} style={{ opacity: added ? .45 : 1 }}>
                <span className="icon-box" style={{ width: 34, height: 34, borderRadius: 10 }}><Dumbbell size={14} /></span>
                <span className="grow">
                  <b>{ex.name}</b>
                  <span>{ex.primaryMuscles.map(m => MUSCLE_LABELS[m]).join(' · ')} · {ex.equipment}</span>
                </span>
                <span className="picker-add">{added ? <Trophy size={13} /> : <Plus size={14} />}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="tiny faint center" style={{ marginTop: 16 }}>{filtered.length} exercises · tap to add</div>
    </Sheet>
  );
}

export function ExerciseDetail({ exerciseId, onClose, onAdd }: { exerciseId: number | null; onClose: () => void; onAdd?: (ex: Exercise) => void }) {
  const { data, loading } = useApi<any>(exerciseId ? `/workouts/exercises/${exerciseId}` : null);
  const ex: Exercise | undefined = data?.exercise;
  return (
    <Sheet open={!!exerciseId} onClose={onClose} title={ex?.name || 'Exercise'}>
      {loading || !ex ? (
        <div className="stack" style={{ gap: 10 }}><Skeleton height={30} /><Skeleton height={90} /><Skeleton height={120} /></div>
      ) : (
        <>
          <div className="row wrap" style={{ gap: 6, marginBottom: 14 }}>
            <span className="pill pill-volt">{ex.equipment}</span>
            <span className="pill">{ex.category}</span>
            {ex.primaryMuscles.map(m => <span key={m} className="pill pill-muted">{MUSCLE_LABELS[m]}</span>)}
          </div>
          <p className="small" style={{ color: 'var(--text-2)', lineHeight: 1.65 }}>{ex.instructions}</p>

          {data.pr && (
            <div className="card mt-18" style={{ padding: 15 }}>
              <div className="row">
                <span className="icon-box amber" style={{ width: 36, height: 36, borderRadius: 10 }}><Trophy size={16} /></span>
                <div>
                  <div className="tiny faint" style={{ textTransform: 'uppercase', letterSpacing: '.08em' }}>Personal record</div>
                  <div className="row" style={{ gap: 4, marginTop: 2 }}>
                    <b className="num" style={{ fontSize: 20 }}>{data.pr.weight} kg</b>
                    <span className="small faint">× {data.pr.reps} reps</span>
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }} className="tiny faint">
                  est. 1RM<br /><b style={{ color: 'var(--text-2)', fontSize: 12 }}>{data.pr.e1rm} kg</b>
                </div>
              </div>
            </div>
          )}

          {data.history?.length > 1 && (
            <div className="mt-18">
              <div className="row-between mb-10">
                <span className="label">Top set over time</span>
                <span className="tiny faint">kg</span>
              </div>
              <TrendChart
                data={data.history.map((h: any) => ({ label: formatDate(h.date, { month: 'short', day: 'numeric' }), value: h.topWeight }))}
                color="var(--accent)" height={120} unit=" kg"
              />
            </div>
          )}

          {data.last && (
            <div className="mt-18">
              <div className="label mb-10">Last session</div>
              <div className="row wrap" style={{ gap: 6 }}>
                {data.last.sets.map((s: any, i: number) => (
                  <span key={i} className="pill">{s.weight} kg × {s.reps}</span>
                ))}
              </div>
            </div>
          )}
          {onAdd && (
            <div className="sheet-footer">
              <button className="btn btn-primary btn-block" onClick={() => onAdd(ex)}><Plus size={16} /> Add to routine</button>
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}