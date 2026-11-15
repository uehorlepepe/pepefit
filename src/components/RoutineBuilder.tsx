import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Dumbbell, Plus, Trash2, X } from 'lucide-react';
import { Sheet } from './ui';
import { ExercisePicker } from './ExercisePicker';
import { api } from '../lib/api';
import { useUI } from '../context/UIContext';
import type { Routine } from '../types';
import { MUSCLE_LABELS } from '../lib/utils';

interface DraftExercise {
  exerciseId: number;
  name: string;
  primaryMuscles: string[];
  targetSets: number;
  targetReps: string;
}

export function RoutineBuilder({ open, onClose, routine, onSaved }: {
  open: boolean; onClose: () => void; routine?: Routine | null; onSaved: () => void;
}) {
  const { toast } = useUI();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<DraftExercise[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(routine?.name || '');
    setDescription(routine?.description || '');
    setItems((routine?.exercises || []).map(e => ({
      exerciseId: e.exerciseId, name: e.name, primaryMuscles: e.primaryMuscles,
      targetSets: e.targetSets, targetReps: e.targetReps,
    })));
    setError(null);
  }, [open, routine]);

  const addExercise = (ex: any) => {
    setItems(prev => [...prev, {
      exerciseId: ex.id, name: ex.name, primaryMuscles: ex.primaryMuscles,
      targetSets: 3, targetReps: '8-12',
    }]);
  };

  const update = (id: number, patch: Partial<DraftExercise>) => setItems(prev => prev.map(i => i.exerciseId === id ? { ...i, ...patch } : i));
  const remove = (id: number) => setItems(prev => prev.filter(i => i.exerciseId !== id));
  const move = (idx: number, dir: number) => {
    setItems(prev => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  };

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError('Give your routine a name.');
    if (!items.length) return setError('Add at least one exercise.');
    setSaving(true);
    try {
      const body = { name: name.trim(), description: description.trim(), exercises: items };
      if (routine) await api(`/workouts/routines/${routine.id}`, { method: 'PUT', body });
      else await api('/workouts/routines', { method: 'POST', body });
      toast(routine ? 'Routine updated' : 'Routine created', 'success', routine ? name.trim() : 'Ready whenever you are.');
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const destroy = async () => {
    if (!routine) return;
    if (!confirm(`Delete "${routine.name}"? Past workouts will stay in your history.`)) return;
    try {
      await api(`/workouts/routines/${routine.id}`, { method: 'DELETE' });
      toast('Routine deleted', 'info');
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={routine ? 'Edit routine' : 'New routine'}
        footer={<button className="btn btn-primary btn-block" onClick={save} disabled={saving}>{saving ? <span className="spinner" /> : routine ? 'Save changes' : 'Create routine'}</button>}
      >
        <div className="stack" style={{ gap: 14 }}>
          <div className="field">
            <label className="label">Routine name</label>
            <input className="input" placeholder="e.g. Push Day" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Description <span className="faint">(optional)</span></label>
            <input className="input" placeholder="Chest, shoulders & triceps" value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          <div className="row-between" style={{ marginTop: 4 }}>
            <span className="label">{items.length} exercise{items.length === 1 ? '' : 's'}</span>
            <button className="btn btn-soft btn-sm" onClick={() => setPickerOpen(true)}><Plus size={13} /> Add exercise</button>
          </div>

          {items.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 10px' }}>
              <div className="es-ico"><Dumbbell size={20} /></div>
              <b>No exercises yet</b>
              <p>Build your session from the exercise library.</p>
            </div>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              {items.map((item, idx) => (
                <div key={item.exerciseId} className="card" style={{ padding: 12, borderRadius: 15, boxShadow: 'none' }}>
                  <div className="row" style={{ gap: 9 }}>
                    <span className="ex-num" style={{ fontSize: 10, color: 'var(--faint)', width: 16 }}>{idx + 1}</span>
                    <div className="grow">
                      <b style={{ fontSize: 12.5 }}>{item.name}</b>
                      <div className="tiny faint">{item.primaryMuscles.map(m => MUSCLE_LABELS[m]).join(' · ')}</div>
                    </div>
                    <div className="row" style={{ gap: 2 }}>
                      <button className="btn-circle" style={{ width: 26, height: 26 }} onClick={() => move(idx, -1)} aria-label="Move up"><ArrowUp size={11} /></button>
                      <button className="btn-circle" style={{ width: 26, height: 26 }} onClick={() => move(idx, 1)} aria-label="Move down"><ArrowDown size={11} /></button>
                      <button className="btn-circle" style={{ width: 26, height: 26 }} onClick={() => remove(item.exerciseId)} aria-label="Remove"><X size={11} /></button>
                    </div>
                  </div>
                  <div className="row mt-10" style={{ gap: 8 }}>
                    <div className="field" style={{ flex: 1, gap: 4 }}>
                      <span className="tiny faint">Sets</span>
                      <input className="input" style={{ height: 34, padding: '0 10px', fontSize: 12 }} type="number" min={1} max={10} value={item.targetSets} onChange={e => update(item.exerciseId, { targetSets: Math.max(1, Math.min(10, Number(e.target.value))) })} />
                    </div>
                    <div className="field" style={{ flex: 1.4, gap: 4 }}>
                      <span className="tiny faint">Reps</span>
                      <input className="input" style={{ height: 34, padding: '0 10px', fontSize: 12 }} value={item.targetReps} onChange={e => update(item.exerciseId, { targetReps: e.target.value })} placeholder="8-12" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && <div className="form-error">{error}</div>}
          {routine && (
            <button className="btn btn-danger btn-sm" style={{ alignSelf: 'flex-start' }} onClick={destroy}><Trash2 size={13} /> Delete routine</button>
          )}
        </div>
      </Sheet>
      <ExercisePicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={addExercise} excludeIds={items.map(i => i.exerciseId)} />
    </>
  );
}