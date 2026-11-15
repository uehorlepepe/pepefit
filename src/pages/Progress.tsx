import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Award, CalendarDays, Dumbbell, Flame, LineChart, Plus, Ruler, Scale, Target,
  TrendingDown, TrendingUp, Trophy, Utensils,
} from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useUI } from '../context/UIContext';
import { api } from '../lib/api';
import { EmptyState, PageLoading, SectionHead, Sheet, Stat } from '../components/ui';
import { TrendChart, WeeklyBars, MacroSplitBar } from '../components/charts';
import { formatDate, formatNumber, goalLabel, MUSCLE_LABELS, toLocalISO } from '../lib/utils';
import type { ProgressOverview } from '../types';

type PR = { exerciseId: number; name: string; muscles: string[]; weight: number; reps: number; date: string };
type NutritionDay = { date: string; calories: number; protein: number; carbs: number; fat: number };

const MEASURE_FIELDS = [
  { key: 'waist', label: 'Waist', unit: 'cm' },
  { key: 'chest', label: 'Chest', unit: 'cm' },
  { key: 'arms', label: 'Arms', unit: 'cm' },
  { key: 'thighs', label: 'Thighs', unit: 'cm' },
  { key: 'hips', label: 'Hips', unit: 'cm' },
  { key: 'bodyfat', label: 'Body fat', unit: '%' },
] as const;

export function Progress() {
  const navigate = useNavigate();
  const { toast } = useUI();
  const today = toLocalISO();
  const [range, setRange] = useState(90);
  const { data, loading, refetch } = useApi<ProgressOverview>(`/progress/overview?days=${range}`, [range]);
  const { data: prData } = useApi<{ records: PR[] }>('/workouts/personal-records');
  const { data: nutritionData } = useApi<{ days: NutritionDay[] }>('/progress/nutrition/history?days=30');
  const [weightOpen, setWeightOpen] = useState(false);
  const [weightForm, setWeightForm] = useState({ weight: '', date: today });
  const [measureOpen, setMeasureOpen] = useState(false);
  const [measureForm, setMeasureForm] = useState<Record<string, string>>({ date: today });
  const [busy, setBusy] = useState(false);

  if (loading || !data) return <PageLoading />;

  const stats = data.stats;
  const latestMeasure = data.measurements[data.measurements.length - 1];
  const prs = prData?.records || [];
  const nutritionDays = nutritionData?.days || [];
  const avgMacros = nutritionDays.length ? {
    protein: Math.round(nutritionDays.reduce((s, d) => s + d.protein, 0) / nutritionDays.length),
    carbs: Math.round(nutritionDays.reduce((s, d) => s + d.carbs, 0) / nutritionDays.length),
    fat: Math.round(nutritionDays.reduce((s, d) => s + d.fat, 0) / nutritionDays.length),
  } : { protein: 0, carbs: 0, fat: 0 };
  const weightChange = stats.weightChange;
  const changeGood = stats.goal === 'fat_loss' ? weightChange < 0 : stats.goal === 'muscle_gain' ? weightChange > 0 : false;

  const openWeight = () => {
    setWeightForm({ weight: String(stats.currentWeight || ''), date: today });
    setWeightOpen(true);
  };

  const saveWeight = async () => {
    const weight = Number(weightForm.weight);
    if (!Number.isFinite(weight) || weight < 30 || weight > 350) return toast('Enter a weight between 30 and 350 kg', 'error');
    setBusy(true);
    try {
      await api('/weight', { method: 'POST', body: { weightKg: weight, date: weightForm.date } });
      await refetch();
      toast('Weight logged', 'success', `${weight} kg · ${formatDate(weightForm.date)}`);
      setWeightOpen(false);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const openMeasure = () => {
    const base: Record<string, string> = { date: today };
    for (const f of MEASURE_FIELDS) base[f.key] = latestMeasure?.[f.key] != null ? String(latestMeasure[f.key]) : '';
    setMeasureForm(base);
    setMeasureOpen(true);
  };

  const saveMeasure = async () => {
    const body: Record<string, any> = { date: measureForm.date };
    let count = 0;
    for (const f of MEASURE_FIELDS) {
      if (measureForm[f.key] !== '' && measureForm[f.key] != null) {
        body[f.key] = Number(measureForm[f.key]);
        count++;
      }
    }
    if (!count) return toast('Add at least one measurement', 'error');
    setBusy(true);
    try {
      await api('/measurements', { method: 'POST', body });
      await refetch();
      toast('Measurements saved', 'success');
      setMeasureOpen(false);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <button className="back-link" onClick={() => navigate(-1)}><ArrowLeft size={14} /> Back</button>
      <div className="page-head" style={{ marginTop: 14 }}>
        <div>
          <span className="eyebrow">The long game</span>
          <h1>Progress<span style={{ color: 'var(--volt)' }}>.</span></h1>
        </div>
        <div className="range-tabs" style={{ marginTop: 4 }}>
          {[30, 90, 365].map(d => (
            <button key={d} className={range === d ? 'active' : ''} onClick={() => setRange(d)}>{d === 365 ? '1y' : `${d}d`}</button>
          ))}
        </div>
      </div>

      <div className="card" style={{ background: 'var(--surface)' }}>
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="card-title"><Scale size={13} style={{ color: 'var(--volt)' }} /> WEIGHT</div>
            <div className="row" style={{ gap: 8, alignItems: 'baseline', marginTop: 5 }}>
              <span className="num" style={{ fontSize: 38 }}>{stats.currentWeight ?? '—'}</span>
              <span className="small faint">kg</span>
            </div>
            <div className="row" style={{ gap: 5, marginTop: 2 }}>
              {weightChange === 0 ? <span className="tiny faint">Steady over {range} days</span> : weightChange < 0
                ? <><TrendingDown size={13} style={{ color: changeGood ? 'var(--mint)' : 'var(--amber)' }} /><span className="tiny" style={{ color: changeGood ? 'var(--mint)' : 'var(--amber)' }}>{Math.abs(weightChange)} kg down · {range}d</span></>
                : <><TrendingUp size={13} style={{ color: changeGood ? 'var(--mint)' : 'var(--amber)' }} /><span className="tiny" style={{ color: changeGood ? 'var(--mint)' : 'var(--amber)' }}>{weightChange} kg up · {range}d</span></>}
            </div>
          </div>
          <button className="btn btn-sm btn-soft" onClick={openWeight}><Plus size={13} /> Log weight</button>
        </div>
        <div className="mt-14">
          {data.weights.length > 1 ? (
            <TrendChart
              data={data.weights.map(w => ({ label: formatDate(w.date), value: w.weight }))}
              color="var(--volt)"
              height={150}
              unit=" kg"
              formatValue={v => v.toFixed(1)}
            />
          ) : data.weights.length === 1 ? (
            <div className="center" style={{ padding: '24px 0' }}>
              <div className="num" style={{ fontSize: 28 }}>{data.weights[0].weight}<span className="small faint"> kg</span></div>
              <div className="tiny faint mt-6">One entry so far. Log again in a few days to see the trend.</div>
            </div>
          ) : (
            <div className="center" style={{ padding: '22px 0 8px' }}>
              <div className="tiny faint" style={{ marginBottom: 10 }}>No weight entries yet.</div>
              <button className="btn btn-sm btn-primary" onClick={openWeight}><Plus size={13} /> Log your first weight</button>
            </div>
          )}
        </div>
      </div>

      <div className="profile-stats mt-14">
        <div className="ps"><b>{stats.totalWorkouts}</b><span>Workouts</span></div>
        <div className="ps"><b>{stats.avgDuration}<span className="tiny faint">m</span></b><span>Avg time</span></div>
        <div className="ps"><b>{stats.personalRecords}</b><span>PR lifts</span></div>
        <div className="ps"><b>{stats.loggedDays}</b><span>Days logged</span></div>
      </div>

      <SectionHead title="Measurements" action="Log" onAction={openMeasure} />
      {latestMeasure ? (
        <>
          <div className="measure-grid">
            {MEASURE_FIELDS.map(f => (
              <div className="measure-tile" key={f.key}>
                <span>{f.label}</span>
                <b>{latestMeasure[f.key] ?? '—'}<small> {f.unit}</small></b>
              </div>
            ))}
          </div>
          <div className="tiny faint mt-10">Last updated {formatDate(latestMeasure.date, { month: 'long', day: 'numeric' })} · {data.measurements.length} check-in{data.measurements.length === 1 ? '' : 's'}</div>
        </>
      ) : (
        <div className="card">
          <EmptyState
            icon={<Ruler size={21} />} title="No measurements yet"
            text="Measurements tell a fuller story than the scale. Log waist, arms or body fat whenever you like."
            action={<button className="btn btn-sm btn-soft" onClick={openMeasure}><Plus size={13} /> Add measurements</button>}
          />
        </div>
      )}

      <SectionHead title="Training consistency" action={`${stats.weeklyFrequency}/wk target`} />
      <div className="card activity-card">
        <WeeklyBars
          data={data.weeks.map((w, i) => ({
            value: w.count, label: i === data.weeks.length - 1 ? 'Now' : formatDate(w.start, { month: 'short', day: 'numeric' }),
            highlight: i === data.weeks.length - 1,
          }))}
          target={stats.weeklyFrequency}
          height={96}
          suffix=" sessions"
        />
        <div className="row-between mt-10">
          <span className="tiny faint">Sessions per week · last 8 weeks</span>
          <span className="tiny faint">{data.weeks.reduce((s, w) => s + w.count, 0)} total</span>
        </div>
      </div>

      <SectionHead title="Fuel average" action="30 days" />
      <div className="card">
        <div className="row-between">
          <div>
            <div className="card-title"><Utensils size={13} style={{ color: 'var(--amber)' }} /> NUTRITION</div>
            <div className="row" style={{ gap: 8, alignItems: 'baseline', marginTop: 5 }}>
              <span className="num" style={{ fontSize: 30 }}>{formatNumber(stats.avgCalories)}</span>
              <span className="small faint">kcal / logged day</span>
            </div>
          </div>
          <span className="pill pill-muted">{stats.loggedDays} days logged</span>
        </div>
        <div className="mt-14"><MacroSplitBar protein={avgMacros.protein} carbs={avgMacros.carbs} fat={avgMacros.fat} /></div>
        <div className="row-between mt-10">
          <div className="tiny faint">P {avgMacros.protein}g · C {avgMacros.carbs}g · F {avgMacros.fat}g</div>
          <div className="tiny faint">{goalLabel(stats.goal)}</div>
        </div>
        {nutritionDays.length > 1 && (
          <div className="mt-14">
            <TrendChart
              data={nutritionDays.slice(-14).map(d => ({ label: formatDate(d.date), value: d.calories }))}
              color="var(--amber)" height={92} suffix=" kcal"
            />
          </div>
        )}
      </div>

      <SectionHead title="Personal records" action={`${prs.length} lifts`} />
      {prs.length === 0 ? (
        <div className="card"><EmptyState icon={<Trophy size={21} />} title="PRs will show up here" text="Log working sets with weight and your best lifts will collect here automatically." /></div>
      ) : (
        <div className="card" style={{ padding: '4px 16px' }}>
          {prs.slice(0, 8).map(pr => (
            <div className="pr-row" key={pr.exerciseId}>
              <span className="pr-medal"><Award size={15} /></span>
              <div className="grow">
                <b style={{ fontSize: 12.5 }}>{pr.name}</b>
                <div className="tiny faint">{pr.muscles.map(m => MUSCLE_LABELS[m] || m).slice(0, 3).join(' · ')}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="num" style={{ fontSize: 14 }}>{pr.weight}<span className="tiny faint">kg × {pr.reps}</span></div>
                <div className="tiny faint">{formatDate(pr.date.slice(0, 10))}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid-2 mt-14">
        <button className="card card-press" style={{ textAlign: 'left', padding: 15 }} onClick={() => navigate('/workout')}>
          <Dumbbell size={17} style={{ color: 'var(--volt)' }} />
          <b style={{ display: 'block', fontSize: 12.5, marginTop: 9 }}>Workout history</b>
          <span className="tiny faint">Sessions, sets & volume</span>
        </button>
        <button className="card card-press" style={{ textAlign: 'left', padding: 15 }} onClick={() => navigate('/nutrition')}>
          <Flame size={17} style={{ color: 'var(--amber)' }} />
          <b style={{ display: 'block', fontSize: 12.5, marginTop: 9 }}>Nutrition log</b>
          <span className="tiny faint">Meals & macros</span>
        </button>
      </div>

      <Sheet
        open={weightOpen}
        onClose={() => setWeightOpen(false)}
        title="Log weight"
        footer={<button className="btn btn-primary btn-block" onClick={saveWeight} disabled={busy}>{busy ? <span className="spinner" /> : 'Save weight'}</button>}
      >
        <div className="stack" style={{ gap: 13 }}>
          <div className="field"><label className="label">Weight</label><div className="input-suffix"><input className="input" type="number" step="0.1" value={weightForm.weight} onChange={e => setWeightForm({ ...weightForm, weight: e.target.value })} autoFocus /><span>kg</span></div></div>
          <div className="field"><label className="label">Date</label><input className="input" type="date" value={weightForm.date} max={today} onChange={e => setWeightForm({ ...weightForm, date: e.target.value })} /></div>
          <div className="hint">Weighing at a similar time of day gives the cleanest trend. One number never defines progress.</div>
        </div>
      </Sheet>

      <Sheet
        open={measureOpen}
        onClose={() => setMeasureOpen(false)}
        title="Log measurements"
        footer={<button className="btn btn-primary btn-block" onClick={saveMeasure} disabled={busy}>{busy ? <span className="spinner" /> : 'Save measurements'}</button>}
      >
        <div className="stack" style={{ gap: 12 }}>
          <div className="field"><label className="label">Date</label><input className="input" type="date" value={measureForm.date} max={today} onChange={e => setMeasureForm({ ...measureForm, date: e.target.value })} /></div>
          <div className="grid-2">
            {MEASURE_FIELDS.map(f => (
              <div className="field" key={f.key}>
                <label className="label">{f.label}</label>
                <div className="input-suffix">
                  <input className="input" type="number" step="0.1" placeholder="—" value={measureForm[f.key] ?? ''} onChange={e => setMeasureForm({ ...measureForm, [f.key]: e.target.value })} />
                  <span>{f.unit}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="hint">Leave blank anything you don't want to track. Measurements are most useful every 2–4 weeks.</div>
        </div>
      </Sheet>
    </div>
  );
}