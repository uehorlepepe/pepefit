import { useEffect, useMemo, useState } from 'react';
import { Check, Clock, Flame, Heart, Minus, Plus, Repeat, ShoppingBasket, Sparkles, Utensils, X } from 'lucide-react';
import { Sheet } from './ui';
import { api } from '../lib/api';
import { useUI } from '../context/UIContext';
import { toLocalISO, MEAL_LABELS } from '../lib/utils';
import type { Recipe } from '../types';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
const round1 = (n: number) => Math.round(n * 10) / 10;

export function RecipeDetail({ recipe, open, onClose, onChanged, onLogged }: {
  recipe: Recipe | null;
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
  onLogged?: (info: { name: string; servings: number; calories: number }) => void;
}) {
  const { toast } = useUI();
  const [tab, setTab] = useState<'ingredients' | 'steps'>('ingredients');
  const [servings, setServings] = useState(1);
  const [mealType, setMealType] = useState<(typeof MEAL_TYPES)[number]>('dinner');
  const [done, setDone] = useState<Set<number>>(new Set());
  const [subs, setSubs] = useState<Record<string, { key: string; name: string; emoji: string }>>({});
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState<'save' | 'log' | null>(null);

  useEffect(() => {
    if (!recipe) return;
    setTab('ingredients');
    setServings(1);
    setDone(new Set());
    setSubs({});
    setSwapFor(null);
    setSaved(!!recipe.saved);
    setMealType('dinner');
  }, [recipe?.id]);

  const ingredients = useMemo(() => recipe?.ingredients || [], [recipe]);
  const steps = recipe?.steps || [];
  const scale = recipe ? servings / (recipe.servings || 1) : 1;

  if (!recipe) return null;

  const handleSave = async () => {
    setBusy('save');
    try {
      const res = await api<{ saved: boolean }>(`/kitchen/recipes/${recipe.id}/save`, { method: 'POST' });
      setSaved(res.saved);
      toast(res.saved ? 'Saved to your kitchen' : 'Removed from saved', 'success', recipe.name);
      onChanged?.();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleLog = async () => {
    setBusy('log');
    try {
      const res = await api<{ name: string; servings: number; calories: number }>(`/kitchen/recipes/${recipe.id}/log`, {
        method: 'POST',
        body: { servings, mealType, date: toLocalISO() },
      });
      toast('Meal logged', 'success', `${res.name} · ${Math.round(res.calories)} kcal added to ${MEAL_LABELS[mealType]}`);
      onLogged?.(res);
      onChanged?.();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const setSub = (key: string, sub?: { key: string; name: string; emoji: string }) => {
    setSubs(prev => {
      const next = { ...prev };
      if (sub) next[key] = sub; else delete next[key];
      return next;
    });
    setSwapFor(null);
  };

  const toggleStep = (i: number) => {
    setDone(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const totalCalories = Math.round(recipe.calories * servings);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      className="recipe-sheet"
      footer={
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost" style={{ flex: '0 0 auto', padding: '0 16px' }} onClick={handleSave} disabled={busy === 'save'} aria-label={saved ? 'Remove from favourites' : 'Save recipe'}>
            {busy === 'save' ? <span className="spinner" /> : <Heart size={17} fill={saved ? 'var(--rose)' : 'none'} color={saved ? 'var(--rose)' : 'currentColor'} />}
          </button>
          <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleLog} disabled={busy === 'log'}>
            {busy === 'log' ? <span className="spinner" /> : <><Utensils size={16} /> Log {totalCalories} kcal</>}
          </button>
        </div>
      }
    >
      <div className="recipe-hero">
        <div className="rh-actions">
          <button className="btn-circle" onClick={handleSave} disabled={busy === 'save'} aria-label={saved ? 'Remove from favourites' : 'Save recipe'}>
            <Heart size={16} fill={saved ? 'var(--rose)' : 'none'} color={saved ? 'var(--rose)' : 'currentColor'} />
          </button>
          <button className="btn-circle" onClick={onClose} aria-label="Close recipe">
            <X size={16} />
          </button>
        </div>
        <div className="rh-content">
          <div className="rh-pills">
            <span className="pill">{recipe.cuisine}</span>
            {recipe.highProtein && <span className="pill pill-sky"><Sparkles size={10} /> High protein</span>}
          </div>
          <h2>{recipe.name}</h2>
          <div className="rh-meta">
            <span><Clock size={12} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />{recipe.totalMin} min</span>
            <span><Flame size={12} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />{recipe.calories} kcal / serving</span>
            <span>Serves {recipe.servings}</span>
          </div>
        </div>
      </div>

      <p className="small muted" style={{ lineHeight: 1.6, marginBottom: 14 }}>{recipe.description}</p>

      <div className="card" style={{ padding: 15, boxShadow: 'none' }}>
        <div className="row-between">
          <div>
            <div className="label">You're having</div>
            <div className="tiny faint" style={{ marginTop: 2 }}>{servings} of {recipe.servings} servings</div>
          </div>
          <div className="stepper">
            <button onClick={() => setServings(s => Math.max(0.5, Math.round((s - 0.5) * 10) / 10))} aria-label="Fewer servings"><Minus size={13} /></button>
            <span className="val">{servings}</span>
            <button onClick={() => setServings(s => Math.min(8, Math.round((s + 0.5) * 10) / 10))} aria-label="More servings"><Plus size={13} /></button>
          </div>
        </div>
        <div className="macro-preview mt-14">
          {[
            { l: 'Calories', v: Math.round(recipe.calories * servings), u: '' },
            { l: 'Protein', v: Math.round(recipe.protein * servings), u: 'g' },
            { l: 'Carbs', v: Math.round(recipe.carbs * servings), u: 'g' },
            { l: 'Fat', v: Math.round(recipe.fat * servings), u: 'g' },
          ].map(m => (
            <div key={m.l}><b>{m.v}{m.u}</b><span>{m.l}</span></div>
          ))}
        </div>
        <div className="field mt-14">
          <label className="label">Add to</label>
          <div className="segmented tiny">
            {MEAL_TYPES.map(m => <button key={m} className={mealType === m ? 'active' : ''} onClick={() => setMealType(m)}>{MEAL_LABELS[m]}</button>)}
          </div>
        </div>
      </div>

      <div className="recipe-tabs mt-14">
        <button className={tab === 'ingredients' ? 'active' : ''} onClick={() => setTab('ingredients')}>Ingredients</button>
        <button className={tab === 'steps' ? 'active' : ''} onClick={() => setTab('steps')}>Steps</button>
      </div>

      {tab === 'ingredients' ? (
        <>
          {(recipe.missing?.length || 0) > 0 && (
            <div className="insight-card mb-14" style={{ background: 'rgba(255,196,102,.06)', borderColor: 'rgba(255,196,102,.2)' }}>
              <span className="ins-icon" style={{ background: 'rgba(255,196,102,.14)', color: 'var(--amber)' }}><ShoppingBasket size={16} /></span>
              <div className="grow">
                <b>You may need to grab {recipe.missing!.length} thing{recipe.missing!.length > 1 ? 's' : ''}</b>
                <p>{recipe.missing!.map(m => m.name).join(' · ')}</p>
              </div>
            </div>
          )}
          <div className="tiny faint" style={{ marginBottom: 4 }}>Quantities shown for {servings} serving{servings === 1 ? '' : 's'}.</div>
          {ingredients.map(ing => {
            const sub = subs[ing.key];
            const name = sub?.name || ing.name;
            const emoji = sub?.emoji || ing.emoji;
            return (
              <div key={ing.key}>
                <div className="recipe-ingredient">
                  <span className="ri-emoji">{emoji}</span>
                  <div className="grow">
                    <b>{name}{ing.optional ? <span className="faint" style={{ fontWeight: 400 }}> · optional</span> : null}</b>
                    <span>{sub ? `swapped for ${ing.name}` : ing.substitutes.length ? 'Tap swap for alternatives' : `${ing.amount} ${ing.unit}`.trim()}</span>
                  </div>
                  <span className="ing-amount">{round1(ing.amount * scale)} {ing.unit}</span>
                  {ing.substitutes.length > 0 && (
                    <button
                      className="btn-circle" style={{ width: 28, height: 28, flexShrink: 0 }}
                      onClick={() => setSwapFor(swapFor === ing.key ? null : ing.key)}
                      aria-label={`Swap ${ing.name}`}
                    >
                      <Repeat size={12} />
                    </button>
                  )}
                </div>
                {swapFor === ing.key && (
                  <div className="chip-row wrap" style={{ padding: '8px 0 10px' }}>
                    <button className={`chip ${!sub ? 'active' : ''}`} onClick={() => setSub(ing.key)}>{ing.emoji} Original</button>
                    {ing.substitutes.map(s => (
                      <button key={s.key} className={`chip ${sub?.key === s.key ? 'active' : ''}`} onClick={() => setSub(ing.key, s)}>{s.emoji} {s.name}</button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </>
      ) : (
        <>
          <div className="tiny faint" style={{ marginBottom: 4 }}>Tap a step to mark it done.</div>
          {steps.map((step, i) => (
            <button key={i} className={`recipe-step ${done.has(i) ? 'done' : ''}`} onClick={() => toggleStep(i)} style={{ width: '100%', textAlign: 'left', background: 'none' }}>
              <span className="step-n">{done.has(i) ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
              <p className="grow">{step}</p>
            </button>
          ))}
          {steps.length === 0 && <div className="hint">No steps saved for this recipe yet.</div>}
          {done.size === steps.length && steps.length > 0 && (
            <div className="form-success mt-14" style={{ textAlign: 'center' }}>Dinner is served. Enjoy it — you earned it.</div>
          )}
        </>
      )}
    </Sheet>
  );
}