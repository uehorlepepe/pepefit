import { useMemo, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Flame, Minus, Pencil, Plus, Search, SlidersHorizontal,
  Sparkles, Trash2, Utensils, X,
} from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { api } from '../lib/api';
import { EmptyState, PageLoading, SectionHead, Sheet, Skeleton } from '../components/ui';
import { WeeklyBars } from '../components/charts';
import {
  addDays, formatDate, formatNumber, MEAL_ICONS, MEAL_LABELS, shortDay, toLocalISO,
} from '../lib/utils';
import type { DayNutrition, Food, MealItem, Targets, User } from '../types';

const FOOD_EMOJI: Record<string, string> = {
  Protein: '🍗', Dairy: '🥛', Grains: '🍚', Produce: '🥦', Fats: '🥑',
  Snacks: '🍫', Drinks: '🥤', Meals: '🍽️', Custom: '✨', Fruit: '🍎',
};

const MEAL_TYPES: (keyof typeof MEAL_LABELS)[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

type WeekData = {
  days: { date: string; calories: number; protein: number; carbs: number; fat: number; fiber: number; sodium: number; iron: number; calcium: number }[];
  targets: Targets;
  average: { calories: number; protein: number; carbs: number; fat: number; fiber: number; sodium: number; iron: number; calcium: number } | null;
  loggedDays: number;
};

const round = (n: number) => Math.round(n * 10) / 10;
const foodEmoji = (f?: { category?: string; name?: string } | null) =>
  FOOD_EMOJI[f?.category || ''] || (/yogurt|milk/i.test(f?.name || '') ? '🥛' : /egg/i.test(f?.name || '') ? '🥚' : '🍽️');

export function Nutrition() {
  const { setUser } = useAuth();
  const { toast } = useUI();
  const today = toLocalISO();
  const [date, setDate] = useState(today);
  const [addOpen, setAddOpen] = useState(false);
  const [addMeal, setAddMeal] = useState<(typeof MEAL_TYPES)[number]>('breakfast');
  const [tab, setTab] = useState<'search' | 'custom'>('search');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Food | null>(null);
  const [servings, setServings] = useState(1);
  const [editItem, setEditItem] = useState<MealItem | null>(null);
  const [editServings, setEditServings] = useState(1);
  const [targetsOpen, setTargetsOpen] = useState(false);
  const [targetForm, setTargetForm] = useState<Targets | null>(null);
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState({
    name: '', brand: '', servingLabel: '1 serving', calories: '', protein: '', carbs: '', fat: '', fiber: '', sodium: '',
  });

  const { data, loading, refetch } = useApi<DayNutrition>(`/nutrition/meals?date=${date}`);
  const { data: week, refetch: refetchWeek } = useApi<WeekData>(`/nutrition/week?end=${date}`);
  const { data: foodsData, loading: foodsLoading } = useApi<{ foods: Food[] }>(addOpen ? '/nutrition/foods?limit=200' : null);
  const { data: recentData } = useApi<{ foods: Food[] }>(addOpen ? '/nutrition/foods/recent' : null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(date, i - 6)), [date]);
  const weekMap = useMemo(() => new Map((week?.days || []).map(d => [d.date, d])), [week]);

  const refreshAll = async () => {
    await Promise.all([refetch(), refetchWeek()]);
  };

  const openAdd = (meal: (typeof MEAL_TYPES)[number]) => {
    setAddMeal(meal);
    setAddOpen(true);
    setTab('search');
    setQuery('');
    setSelected(null);
    setServings(1);
    setCustom({ name: '', brand: '', servingLabel: '1 serving', calories: '', protein: '', carbs: '', fat: '', fiber: '', sodium: '' });
  };

  const openEdit = (item: MealItem) => {
    setEditItem(item);
    setEditServings(item.servings);
  };

  const filteredFoods = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const all = foodsData?.foods || [];
    if (!needle) return all.slice(0, 40);
    return all.filter(f => f.name.toLowerCase().includes(needle) || (f.brand || '').toLowerCase().includes(needle)).slice(0, 50);
  }, [foodsData, query]);

  const logFood = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await api('/nutrition/meals', {
        method: 'POST',
        body: { date, mealType: addMeal, foodId: selected.id, servings },
      });
      await refreshAll();
      toast('Meal logged', 'success', `${selected.name} · ${Math.round(selected.calories * servings)} kcal`);
      setAddOpen(false);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const logCustom = async () => {
    if (!custom.name.trim()) return toast('Give your food a name', 'error');
    const nums = [custom.calories, custom.protein, custom.carbs, custom.fat].map(v => Number(v) || 0);
    if (nums.every(v => v === 0)) return toast('Add some nutrition information', 'error');
    setBusy(true);
    try {
      const res = await api<{ food: Food }>('/nutrition/foods', {
        method: 'POST',
        body: {
          name: custom.name.trim(), brand: custom.brand.trim() || null, servingLabel: custom.servingLabel.trim() || '1 serving',
          calories: Number(custom.calories) || 0, protein: Number(custom.protein) || 0, carbs: Number(custom.carbs) || 0,
          fat: Number(custom.fat) || 0, fiber: Number(custom.fiber) || 0, sodium: Number(custom.sodium) || 0,
        },
      });
      await api('/nutrition/meals', {
        method: 'POST',
        body: { date, mealType: addMeal, foodId: res.food.id, servings },
      });
      await refreshAll();
      toast('Custom food saved & logged', 'success', `${res.food.name} · ${Math.round(res.food.calories * servings)} kcal`);
      setAddOpen(false);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editItem) return;
    setBusy(true);
    try {
      await api(`/nutrition/meals/${editItem.id}`, { method: 'PUT', body: { servings: editServings } });
      await refreshAll();
      toast('Serving updated', 'success');
      setEditItem(null);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const deleteItem = async () => {
    if (!editItem) return;
    setBusy(true);
    try {
      await api(`/nutrition/meals/${editItem.id}`, { method: 'DELETE' });
      await refreshAll();
      toast('Removed from your log', 'info');
      setEditItem(null);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const openTargets = () => {
    if (!data) return;
    setTargetForm({ ...data.targets });
    setTargetsOpen(true);
  };

  const suggestTargets = async () => {
    try {
      const res = await api<{ suggestion: Targets | null }>('/profile/suggestion');
      if (!res.suggestion) return toast('Add your height, weight and age in your profile first', 'info');
      setTargetForm(res.suggestion);
      toast('Targets recalculated', 'info', 'Adjust anything before saving.');
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
      await refreshAll();
      toast('Targets updated', 'success');
      setTargetsOpen(false);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading || !data) return <PageLoading />;

  const totals = data.totals;
  const targets = data.targets;
  const calRatio = targets.calories ? totals.calories / targets.calories : 0;
  const remaining = Math.round(targets.calories - totals.calories);

  const targetFields: { key: keyof Targets; label: string; suffix: string; color?: string }[] = [
    { key: 'calories', label: 'Calories', suffix: 'kcal' },
    { key: 'protein', label: 'Protein', suffix: 'g', color: 'var(--sky)' },
    { key: 'carbs', label: 'Carbs', suffix: 'g', color: 'var(--amber)' },
    { key: 'fat', label: 'Fat', suffix: 'g', color: 'var(--rose)' },
    { key: 'fiber', label: 'Fiber', suffix: 'g', color: 'var(--mint)' },
    { key: 'sodium', label: 'Sodium', suffix: 'mg', color: 'var(--violet)' },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Nutrition</h1>
        </div>
        <button className="btn-circle" onClick={openTargets} aria-label="Edit nutrition targets" style={{ marginTop: 4 }}>
          <SlidersHorizontal size={16} />
        </button>
      </div>

      <div className="date-strip">
        <button className="date-nav" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day"><ChevronLeft size={15} /></button>
        {days.map(d => {
          const w = weekMap.get(d);
          return (
            <button
              key={d}
              className={`date-chip ${d === date ? 'active' : ''}`}
              onClick={() => setDate(d)}
              aria-label={formatDate(d, { weekday: 'long', month: 'long', day: 'numeric' })}
            >
              <span className="dw">{shortDay(d)}</span>
              <span className="dn" style={{ position: 'relative' }}>
                {Number(d.slice(-2))}
                {d !== date && (w?.calories || 0) > 0 && (
                  <i style={{ position: 'absolute', bottom: -3, width: 3, height: 3, borderRadius: 99, background: 'var(--accent)' }} />
                )}
              </span>
            </button>
          );
        })}
        <button className="date-nav" onClick={() => setDate(addDays(date, 1))} disabled={date >= today} style={{ opacity: date >= today ? 0.3 : 1 }} aria-label="Next day"><ChevronRight size={15} /></button>
      </div>

      {date !== today && (
        <div className="row-between" style={{ marginTop: -8, marginBottom: 14 }}>
          <span className="tiny faint">Viewing {formatDate(date, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
          <button className="chip" style={{ height: 26, fontSize: 10 }} onClick={() => setDate(today)}>Jump to today</button>
        </div>
      )}

      <div className="card nutrition-hero">
        <div className="row-between" style={{ marginBottom: 14 }}>
          <div className="card-title"><Flame size={13} style={{ color: 'var(--accent)' }} /> Today's food</div>
          <span className={`pill ${remaining < 0 ? 'pill-amber' : 'pill-volt'}`}>{remaining < 0 ? `${Math.abs(remaining)} over` : `${remaining} left`}</span>
        </div>
        <div className="hero-main" style={{ gap: 18 }}>
          <div style={{ position: 'relative', width: 136, height: 136, flexShrink: 0 }}>
            <svg width="136" height="136" viewBox="0 0 136 136" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="68" cy="68" r="60" fill="none" stroke="var(--ring-track)" strokeWidth="10" />
              <circle
                cx="68" cy="68" r="60" fill="none" stroke={remaining < 0 ? 'var(--amber)' : 'var(--accent)'} strokeWidth="10"
                strokeLinecap="round" strokeDasharray={2 * Math.PI * 60}
                strokeDashoffset={2 * Math.PI * 60 * (1 - Math.min(1, calRatio))}
                style={{ transition: 'stroke-dashoffset .7s var(--ease)' }}
              />
              <defs>
                <linearGradient id="nutri-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" />
                  <stop offset="100%" stopColor="var(--accent)" />
                </linearGradient>
              </defs>
            </svg>
            <div className="ring-center">
              <span className="big" style={{ fontSize: 33 }}>{formatNumber(totals.calories)}</span>
              <span className="lbl">kcal eaten</span>
              <span className="sub">of {formatNumber(targets.calories)}</span>
            </div>
          </div>
          <div className="hero-macros" style={{ gap: 11 }}>
            {[
              { label: 'Protein', value: totals.protein, target: targets.protein, color: 'var(--sky)' },
              { label: 'Carbs', value: totals.carbs, target: targets.carbs, color: 'var(--amber)' },
              { label: 'Fat', value: totals.fat, target: targets.fat, color: 'var(--rose)' },
            ].map(m => (
              <div className="macro-row" key={m.label}>
                <div className="top"><b>{m.label}</b><span><b style={{ color: 'var(--text-2)' }}>{Math.round(m.value)}</b> / {m.target}g</span></div>
                <div className="bar"><i style={{ width: `${Math.min(100, (m.value / (m.target || 1)) * 100)}%`, background: m.color }} /></div>
              </div>
            ))}
            <div className="tiny faint">{Math.round(totals.protein * 4 + totals.carbs * 4 + totals.fat * 9)} kcal from macros</div>
          </div>
        </div>
      </div>

      {MEAL_TYPES.map(type => {
        const group = data.meals.find(m => m.type === type);
        const items = group?.items || [];
        return (
          <div className="card meal-section" key={type}>
            <div className="meal-head">
              <span className="meal-emoji">{MEAL_ICONS[type]}</span>
              <div className="grow">
                <b>{MEAL_LABELS[type]}</b>
                <span>{items.length ? `${items.length} item${items.length > 1 ? 's' : ''} · ${formatNumber(group?.calories || 0)} kcal` : ''}</span>
              </div>
              <button className="meal-add" onClick={() => openAdd(type)} aria-label={`Add to ${MEAL_LABELS[type]}`}><Plus size={15} /></button>
            </div>
            {items.length === 0 ? (
              <div className="meal-empty">Nothing logged yet — tap the plus to add food.</div>
            ) : items.map(item => (
              <button key={item.id} className="meal-item" style={{ width: '100%', textAlign: 'left' }} onClick={() => openEdit(item)}>
                <span className="food-dot" />
                <div className="mi-main">
                  <b>{item.name}</b>
                  <span>{item.servings} × {item.servingLabel} · P {Math.round(item.protein)} · C {Math.round(item.carbs)} · F {Math.round(item.fat)}</span>
                </div>
                <span className="mi-kcal">{Math.round(item.calories)}</span>
              </button>
            ))}
          </div>
        );
      })}

      <SectionHead title="This week" />
      <div className="card activity-card">
        <div className="row-between mb-14">
          <div>
            <div className="card-title">Calories</div>
            <div className="card-value" style={{ fontSize: 22 }}>{formatNumber(week?.average?.calories || 0)}<span className="small faint" style={{ fontFamily: 'var(--font-sans)', fontWeight: 500 }}> avg / day</span></div>
          </div>
          <span className="pill pill-muted">{week?.loggedDays || 0}/7 logged</span>
        </div>
        <WeeklyBars
          data={(week?.days || []).map((d, i) => ({
            value: d.calories, label: shortDay(d.date), highlight: d.date === date,
          }))}
          target={targets.calories}
          height={100}
          suffix=" kcal"
        />
        <div className="grid-3 mt-14">
          {[
            { label: 'Protein', value: week?.average?.protein || 0, color: 'var(--sky)' },
            { label: 'Carbs', value: week?.average?.carbs || 0, color: 'var(--amber)' },
            { label: 'Fat', value: week?.average?.fat || 0, color: 'var(--rose)' },
          ].map(m => (
            <div key={m.label} style={{ textAlign: 'center', padding: '9px 4px', borderRadius: 10, background: 'var(--surface-2)' }}>
              <div className="num" style={{ fontSize: 17, color: m.color }}>{Math.round(m.value)}<span className="tiny faint" style={{ fontFamily: 'var(--font-sans)' }}>g</span></div>
              <div className="tiny faint" style={{ marginTop: 2 }}>{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      <SectionHead title="Micronutrients" />
      <div className="nutrient-grid">
        {[
          { label: 'Fiber', value: totals.fiber, target: targets.fiber || 30, unit: 'g', color: 'var(--mint)' },
          { label: 'Sodium', value: totals.sodium, target: targets.sodium || 2300, unit: 'mg', color: 'var(--violet)', limit: true },
          { label: 'Iron', value: totals.iron, target: 18, unit: 'mg', color: 'var(--rose)' },
          { label: 'Calcium', value: totals.calcium, target: 1000, unit: 'mg', color: 'var(--cyan)' },
        ].map(n => {
          const ratio = n.target ? Math.min(1, n.value / n.target) : 0;
          const over = n.limit && n.value > n.target;
          return (
            <div className="nutrient-tile" key={n.label}>
              <div className="nt-top">
                <span className="lbl">{n.label}{n.limit ? ' · limit' : ''}</span>
                <span>{Math.round(n.value)} / {formatNumber(n.target)}{n.unit}</span>
              </div>
              <div className="bar bar-xs"><i style={{ width: `${ratio * 100}%`, background: over ? 'var(--amber)' : n.color }} /></div>
              <div className="tiny faint" style={{ marginTop: 6 }}>
                {over ? `${Math.round(n.value - n.target)} ${n.unit} above target` : `${Math.round(ratio * 100)}% of daily target`}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add food sheet */}
      <Sheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={selected ? 'How much?' : `Add to ${MEAL_LABELS[addMeal]}`}
        footer={selected ? (
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => setSelected(null)} style={{ flex: '0 0 auto' }}>Back</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={logFood} disabled={busy}>
              {busy ? <span className="spinner" /> : <><Plus size={15} /> Log {Math.round(selected.calories * servings)} kcal</>}
            </button>
          </div>
        ) : tab === 'custom' ? (
          <button className="btn btn-primary btn-block" onClick={logCustom} disabled={busy}>
            {busy ? <span className="spinner" /> : <><Plus size={15} /> Save & log food</>}
          </button>
        ) : undefined}
      >
        {selected ? (
          <div className="stack" style={{ gap: 14 }}>
            <div className="card" style={{ padding: 15, boxShadow: 'none' }}>
              <div className="row" style={{ gap: 12 }}>
                <span className="food-result" style={{ border: 0, padding: 0, width: 'auto' }}>
                  <span className="fr-emoji">{foodEmoji(selected)}</span>
                </span>
                <div className="grow">
                  <b style={{ fontSize: 14 }}>{selected.name}</b>
                  <div className="tiny faint">{selected.brand || selected.category} · {selected.serving_label}</div>
                </div>
              </div>
              <div className="divider" />
              <div className="row-between">
                <span className="label" style={{ margin: 0 }}>Servings</span>
                <div className="stepper">
                  <button onClick={() => setServings(s => Math.max(0.25, Math.round((s - 0.25) * 100) / 100))} aria-label="Decrease"><Minus size={13} /></button>
                  <span className="val">{servings}</span>
                  <button onClick={() => setServings(s => Math.min(20, Math.round((s + 0.25) * 100) / 100))} aria-label="Increase"><Plus size={13} /></button>
                </div>
              </div>
              <div className="row-between mt-10">
                <span className="tiny faint">{selected.serving_label} · {selected.serving_grams ? `${selected.serving_grams}g` : 'per serving'}</span>
                <span className="tiny faint">{Math.round(selected.calories * servings)} kcal</span>
              </div>
            </div>
            <div className="macro-preview">
              {[
                { l: 'Protein', v: selected.protein * servings },
                { l: 'Carbs', v: selected.carbs * servings },
                { l: 'Fat', v: selected.fat * servings },
                { l: 'Fiber', v: selected.fiber * servings },
              ].map(m => (
                <div key={m.l}><b>{Math.round(m.v)}g</b><span>{m.l}</span></div>
              ))}
            </div>
            <div className="field">
              <label className="label">Meal</label>
              <div className="segmented tiny">
                {MEAL_TYPES.map(m => (
                  <button key={m} className={addMeal === m ? 'active' : ''} onClick={() => setAddMeal(m)}>{MEAL_LABELS[m]}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <label className="label">Logged to</label>
              <div className="hint">{formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
            </div>
          </div>
        ) : (
          <>
            <div className="segmented" style={{ marginBottom: 14 }}>
              <button className={tab === 'search' ? 'active' : ''} onClick={() => setTab('search')}><Search size={12} /> Food library</button>
              <button className={tab === 'custom' ? 'active' : ''} onClick={() => setTab('custom')}><Sparkles size={12} /> Custom food</button>
            </div>
            {tab === 'search' ? (
              <>
                <div className="input-suffix" style={{ marginBottom: 12 }}>
                  <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)' }} />
                  <input className="input" style={{ paddingLeft: 38 }} placeholder="Search 85 foods…" value={query} onChange={e => setQuery(e.target.value)} autoFocus />
                  {query && <button className="pw-toggle" onClick={() => setQuery('')} aria-label="Clear"><X size={14} /></button>}
                </div>

                {!query && (recentData?.foods?.length || 0) > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div className="label" style={{ marginBottom: 4 }}>Recent</div>
                    <div className="chip-row wrap">
                      {(recentData?.foods || []).slice(0, 6).map(f => (
                        <button key={f.id} className="chip" onClick={() => { setSelected(f); setServings(1); }}>
                          {foodEmoji(f)} {f.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {foodsLoading && !foodsData ? (
                  <div className="stack" style={{ gap: 6 }}>{[1, 2, 3, 4].map(i => <Skeleton key={i} height={56} />)}</div>
                ) : filteredFoods.length === 0 ? (
                  <EmptyState icon={<Search size={20} />} title="No foods found" text="Try a different search, or create a custom food." action={<button className="btn btn-sm btn-soft" onClick={() => setTab('custom')}>Create custom food</button>} />
                ) : (
                  <div>
                    {filteredFoods.map(f => (
                      <button key={f.id} className="food-result" onClick={() => { setSelected(f); setServings(1); }}>
                        <span className="fr-emoji">{foodEmoji(f)}</span>
                        <span className="grow">
                          <span className="fr-name">{f.name}</span>
                          <span className="fr-meta">{f.brand ? `${f.brand} · ` : ''}{f.serving_label} · P {Math.round(f.protein)}g · C {Math.round(f.carbs)}g</span>
                        </span>
                        <span className="fr-kcal">{Math.round(f.calories)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="stack" style={{ gap: 12 }}>
                <div className="field">
                  <label className="label">Food name</label>
                  <input className="input" value={custom.name} onChange={e => setCustom({ ...custom, name: e.target.value })} placeholder="e.g. Mom's lentil soup" />
                </div>
                <div className="field-row">
                  <div className="field"><label className="label">Brand (optional)</label><input className="input" value={custom.brand} onChange={e => setCustom({ ...custom, brand: e.target.value })} placeholder="Homemade" /></div>
                  <div className="field"><label className="label">Serving</label><input className="input" value={custom.servingLabel} onChange={e => setCustom({ ...custom, servingLabel: e.target.value })} placeholder="1 bowl" /></div>
                </div>
                <div className="field-row">
                  <div className="field"><label className="label">Calories</label><div className="input-suffix"><input className="input" type="number" inputMode="numeric" value={custom.calories} onChange={e => setCustom({ ...custom, calories: e.target.value })} placeholder="0" /><span>kcal</span></div></div>
                  <div className="field"><label className="label">Protein</label><div className="input-suffix"><input className="input" type="number" inputMode="decimal" value={custom.protein} onChange={e => setCustom({ ...custom, protein: e.target.value })} placeholder="0" /><span>g</span></div></div>
                </div>
                <div className="grid-3">
                  {[
                    { k: 'carbs', label: 'Carbs' }, { k: 'fat', label: 'Fat' }, { k: 'fiber', label: 'Fiber' },
                  ].map(f => (
                    <div className="field" key={f.k}>
                      <label className="label">{f.label}</label>
                      <div className="input-suffix"><input className="input" type="number" inputMode="decimal" value={(custom as any)[f.k]} onChange={e => setCustom({ ...custom, [f.k]: e.target.value })} placeholder="0" /><span>g</span></div>
                    </div>
                  ))}
                </div>
                <div className="field">
                  <label className="label">Sodium (optional)</label>
                  <div className="input-suffix"><input className="input" type="number" inputMode="numeric" value={custom.sodium} onChange={e => setCustom({ ...custom, sodium: e.target.value })} placeholder="0" /><span>mg</span></div>
                </div>
                <div className="field">
                  <label className="label">Servings to log</label>
                  <div className="stepper" style={{ alignSelf: 'flex-start' }}>
                    <button onClick={() => setServings(s => Math.max(0.25, Math.round((s - 0.25) * 100) / 100))} aria-label="Decrease"><Minus size={13} /></button>
                    <span className="val">{servings}</span>
                    <button onClick={() => setServings(s => Math.min(20, Math.round((s + 0.25) * 100) / 100))} aria-label="Increase"><Plus size={13} /></button>
                  </div>
                </div>
                <div className="field">
                  <label className="label">Meal</label>
                  <div className="segmented tiny">
                    {MEAL_TYPES.map(m => <button key={m} className={addMeal === m ? 'active' : ''} onClick={() => setAddMeal(m)}>{MEAL_LABELS[m]}</button>)}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </Sheet>

      {/* Edit meal sheet */}
      <Sheet
        open={!!editItem}
        onClose={() => setEditItem(null)}
        title="Edit entry"
        footer={editItem ? (
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-danger" onClick={deleteItem} disabled={busy} style={{ flex: '0 0 auto' }}><Trash2 size={15} /> Remove</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveEdit} disabled={busy}>
              {busy ? <span className="spinner" /> : <><Pencil size={14} /> Save serving</>}
            </button>
          </div>
        ) : undefined}
      >
        {editItem && (
          <div className="stack" style={{ gap: 14 }}>
            <div className="card" style={{ padding: 15, boxShadow: 'none' }}>
              <div className="row" style={{ gap: 11 }}>
                <span className="fr-emoji">{foodEmoji({ name: editItem.name })}</span>
                <div className="grow">
                  <b style={{ fontSize: 13.5 }}>{editItem.name}</b>
                  <div className="tiny faint">{editItem.servingLabel} · {Math.round(editItem.calories / Math.max(0.01, editItem.servings))} kcal per serving</div>
                </div>
              </div>
              <div className="divider" />
              <div className="row-between">
                <span className="label" style={{ margin: 0 }}>Servings</span>
                <div className="stepper">
                  <button onClick={() => setEditServings(s => Math.max(0.25, Math.round((s - 0.25) * 100) / 100))} aria-label="Decrease"><Minus size={13} /></button>
                  <span className="val">{editServings}</span>
                  <button onClick={() => setEditServings(s => Math.min(20, Math.round((s + 0.25) * 100) / 100))} aria-label="Increase"><Plus size={13} /></button>
                </div>
              </div>
            </div>
            <div className="macro-preview">
              {[
                { l: 'Calories', v: Math.round((editItem.calories / Math.max(0.01, editItem.servings)) * editServings), u: '' },
                { l: 'Protein', v: round((editItem.protein / Math.max(0.01, editItem.servings)) * editServings), u: 'g' },
                { l: 'Carbs', v: round((editItem.carbs / Math.max(0.01, editItem.servings)) * editServings), u: 'g' },
                { l: 'Fat', v: round((editItem.fat / Math.max(0.01, editItem.servings)) * editServings), u: 'g' },
              ].map(m => (
                <div key={m.l}><b>{m.v}{m.u}</b><span>{m.l}</span></div>
              ))}
            </div>
          </div>
        )}
      </Sheet>

      {/* Targets sheet */}
      <Sheet
        open={targetsOpen}
        onClose={() => setTargetsOpen(false)}
        title="Daily targets"
        footer={<button className="btn btn-primary btn-block" onClick={saveTargets} disabled={busy}>{busy ? <span className="spinner" /> : 'Save targets'}</button>}
      >
        {targetForm && (
          <div className="stack" style={{ gap: 13 }}>
            <div className="row-between">
              <p className="hint" style={{ margin: 0 }}>These drive your rings and recipe matches.</p>
              <button className="chip" style={{ height: 28, fontSize: 10.5 }} onClick={suggestTargets}><Sparkles size={11} /> Suggest</button>
            </div>
            {targetFields.map(f => (
              <div className="field" key={f.key}>
                <label className="label" style={{ color: f.color || 'var(--muted)' }}>{f.label}</label>
                <div className="input-suffix">
                  <input
                    className="input" type="number" inputMode="numeric"
                    value={targetForm[f.key]}
                    onChange={e => setTargetForm({ ...targetForm, [f.key]: Number(e.target.value) })}
                  />
                  <span>{f.suffix}</span>
                </div>
              </div>
            ))}
            <div className="hint">Macros currently add up to {Math.round(targetForm.protein * 4 + targetForm.carbs * 4 + targetForm.fat * 9)} kcal.</div>
          </div>
        )}
      </Sheet>
    </div>
  );
}