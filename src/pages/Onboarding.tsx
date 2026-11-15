import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Dumbbell, LogOut, Sparkles, Utensils } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { api } from '../lib/api';
import { DIET_OPTIONS, EXPERIENCE_OPTIONS, GOAL_OPTIONS, RESTRICTION_OPTIONS } from '../lib/utils';
import type { Targets, User } from '../types';

const calcTargets = (age: number, sex: string, heightCm: number, weightKg: number, goal: string): Targets => {
  const sexAdj = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexAdj;
  let calories = bmr * 1.5;
  if (goal === 'fat_loss') calories -= 400;
  if (goal === 'muscle_gain') calories += 250;
  if (goal === 'strength') calories += 150;
  calories = Math.round(calories / 10) * 10;
  const protein = Math.round(weightKg * (goal === 'muscle_gain' || goal === 'strength' ? 2 : 1.8));
  const fat = Math.round((calories * 0.27) / 9);
  const carbs = Math.max(60, Math.round((calories - protein * 4 - fat * 9) / 4));
  return { calories, protein, carbs, fat, fiber: 30, sodium: 2300 };
};

const STEPS = ['Basics', 'Focus', 'Training', 'Targets'];

export function Onboarding() {
  const { user, logout, setUser } = useAuth();
  const { toast } = useUI();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: user?.name || '',
    age: 28 as number | '',
    sex: 'male',
    heightCm: 175 as number | '',
    weightKg: 75 as number | '',
    goal: 'muscle_gain',
    experience: 'intermediate',
    weeklyFrequency: 4,
    diet: ['High protein'] as string[],
    restrictions: [] as string[],
  });
  const [targets, setTargets] = useState<Targets | null>(null);
  const [targetsTouched, setTargetsTouched] = useState(false);

  useEffect(() => {
    if (step === 3 && !targets && form.age && form.heightCm && form.weightKg) {
      setTargets(calcTargets(Number(form.age), form.sex, Number(form.heightCm), Number(form.weightKg), form.goal));
    }
  }, [step]);

  if (!user) return <Navigate to="/login" replace />;

  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }));
  const toggle = (key: 'diet' | 'restrictions', value: string) => setForm(f => ({
    ...f, [key]: f[key].includes(value) ? f[key].filter(v => v !== value) : [...f[key], value],
  }));

  const next = async () => {
    setError(null);
    if (step === 0) {
      if (form.name.trim().length < 2) return setError('What should we call you?');
      if (!form.age || Number(form.age) < 13 || Number(form.age) > 100) return setError('Enter an age between 13 and 100.');
      if (!form.heightCm || Number(form.heightCm) < 120 || Number(form.heightCm) > 230) return setError('Enter a height between 120 and 230 cm.');
      if (!form.weightKg || Number(form.weightKg) < 35 || Number(form.weightKg) > 300) return setError('Enter a weight between 35 and 300 kg.');
    }
    if (step === 1) {
      if (!form.goal) return setError('Choose your primary goal.');
    }
    if (step === 3) {
      if (!targets) return;
      if (targets.calories < 1000 || targets.protein < 40 || targets.carbs < 20 || targets.fat < 20) return setError('Those targets look too low. Try recalculating.');
      setSaving(true);
      try {
        const profileRes = await api<{ user: User }>('/profile', {
          method: 'PUT',
          body: {
            age: Number(form.age), sex: form.sex, heightCm: Number(form.heightCm), weightKg: Number(form.weightKg),
            experience: form.experience, goal: form.goal, weeklyFrequency: form.weeklyFrequency,
            diet: form.diet, restrictions: form.restrictions, activityLevel: 'moderate',
          },
        });
        await api('/targets', { method: 'PUT', body: targets });
        const res = await api<{ user: User }>('/onboarding-complete', { method: 'POST' });
        setUser(res.user);
        setStep(4);
        toast('You\'re all set', 'success', 'Your daily targets are ready to edit anytime.');
      } catch (err: any) {
        setError(err.message);
      } finally {
        setSaving(false);
      }
      return;
    }
    setStep(s => Math.min(4, s + 1));
  };

  const back = () => {
    setError(null);
    if (step === 0) return;
    setStep(s => s - 1);
  };

  return (
    <div className="onboarding">
      <div className="ob-top">
        {step > 0 && step < 4 ? (
          <button className="btn-circle" onClick={back} aria-label="Back"><ArrowLeft size={16} /></button>
        ) : (
          <button className="btn-circle" onClick={() => { logout(); navigate('/login'); }} aria-label="Sign out"><LogOut size={15} /></button>
        )}
        <div className="ob-progress">
          {STEPS.map((s, i) => <i key={s} className={i <= Math.min(step, 3) ? 'on' : ''} />)}
        </div>
        <span className="tiny faint" style={{ minWidth: 44, textAlign: 'right' }}>{step < 4 ? `${step + 1} / 4` : 'Done'}</span>
      </div>

      {step === 0 && (
        <div className="ob-step">
          <span className="eyebrow">Let's get personal</span>
          <h1>Tell us about<br />the basics.</h1>
          <p className="lead">We use this to estimate your energy needs. You can change any of it later.</p>
          <div className="ob-body">
            <div className="field">
              <label className="label">Name</label>
              <input className="input" value={form.name} onChange={e => set({ name: e.target.value })} placeholder="Your name" />
            </div>
            <div className="field-row">
              <div className="field">
                <label className="label">Age</label>
                <input className="input" type="number" inputMode="numeric" value={form.age} onChange={e => set({ age: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="28" />
              </div>
              <div className="field">
                <label className="label">Sex</label>
                <select className="select" value={form.sex} onChange={e => set({ sex: e.target.value })}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other / prefer not to say</option>
                </select>
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label className="label">Height</label>
                <div className="input-suffix"><input className="input" type="number" inputMode="decimal" value={form.heightCm} onChange={e => set({ heightCm: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="175" /><span>cm</span></div>
              </div>
              <div className="field">
                <label className="label">Weight</label>
                <div className="input-suffix"><input className="input" type="number" inputMode="decimal" value={form.weightKg} onChange={e => set({ weightKg: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="75" /><span>kg</span></div>
              </div>
            </div>
            <div className="hint">Your weight is saved to your progress history, so you can watch the trend from day one.</div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="ob-step">
          <span className="eyebrow">Direction</span>
          <h1>What are you<br />working toward?</h1>
          <p className="lead">Your focus shapes your calorie targets, workout suggestions and recipe picks.</p>
          <div className="ob-body" style={{ gap: 9 }}>
            {GOAL_OPTIONS.map(g => (
              <button key={g.value} className={`option-card ${form.goal === g.value ? 'selected' : ''}`} onClick={() => set({ goal: g.value })}>
                <span className="opt-emoji">{g.icon}</span>
                <span className="grow"><b>{g.label}</b><span>{g.desc}</span></span>
                <span className="check">{form.goal === g.value && <Check size={12} strokeWidth={3} />}</span>
              </button>
            ))}
          </div>
          <div className="ob-body" style={{ marginTop: 22 }}>
            <div className="field">
              <label className="label">Training experience</label>
              <div className="segmented">
                {EXPERIENCE_OPTIONS.map(e => (
                  <button key={e.value} type="button" className={form.experience === e.value ? 'active' : ''} onClick={() => set({ experience: e.value })}>{e.label}</button>
                ))}
              </div>
              <div className="hint">{EXPERIENCE_OPTIONS.find(e => e.value === form.experience)?.desc}</div>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="ob-step">
          <span className="eyebrow">Training & fuel</span>
          <h1>Build your<br />weekly rhythm.</h1>
          <p className="lead">Consistency beats intensity. Pick a frequency you can genuinely keep.</p>
          <div className="ob-body">
            <div className="field">
              <label className="label">Workouts per week</label>
              <div className="freq-grid">
                {[2, 3, 4, 5, 6].map(n => (
                  <button key={n} className={`freq-opt ${form.weeklyFrequency === n ? 'active' : ''}`} onClick={() => set({ weeklyFrequency: n })}>
                    {n}<span>per week</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label className="label">How do you like to eat?</label>
              <div className="chip-row wrap">
                {DIET_OPTIONS.map(d => (
                  <button key={d} className={`chip ${form.diet.includes(d) ? 'active' : ''}`} onClick={() => toggle('diet', d)}>{d}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <label className="label">Anything to avoid?</label>
              <div className="chip-row wrap">
                {RESTRICTION_OPTIONS.map(d => (
                  <button key={d} className={`chip ${form.restrictions.includes(d) ? 'soft-active' : ''}`} onClick={() => toggle('restrictions', d)}>{d}</button>
                ))}
              </div>
              <div className="hint">We'll use these to filter recipes. Optional.</div>
            </div>
          </div>
        </div>
      )}

      {step === 3 && targets && (
        <div className="ob-step">
          <span className="eyebrow">Your daily numbers</span>
          <h1>Set your<br />targets.</h1>
          <p className="lead">A starting point based on your details and focus. Adjust anything — nothing here is permanent.</p>
          <div className="ob-body">
            <div className="card" style={{ padding: 16 }}>
              <div className="row-between">
                <div>
                  <div className="card-title">Daily calories</div>
                  <div className="row" style={{ gap: 6, marginTop: 6 }}>
                    <input className="input" style={{ width: 110, height: 44, fontSize: 20, fontFamily: 'var(--font-display)', fontWeight: 600 }} type="number" value={targets.calories} onChange={e => { setTargets({ ...targets, calories: Number(e.target.value) }); setTargetsTouched(true); }} />
                    <span className="small faint">kcal</span>
                  </div>
                </div>
                <button className="btn btn-soft btn-sm" onClick={() => { setTargets(calcTargets(Number(form.age), form.sex, Number(form.heightCm), Number(form.weightKg), form.goal)); setTargetsTouched(false); }}>
                  <Sparkles size={13} /> Recalculate
                </button>
              </div>
              <div className="divider" />
              <div className="grid-3">
                {[
                  { k: 'protein', label: 'Protein', color: 'var(--sky)' },
                  { k: 'carbs', label: 'Carbs', color: 'var(--amber)' },
                  { k: 'fat', label: 'Fat', color: 'var(--rose)' },
                ].map(m => (
                  <div className="field" key={m.k}>
                    <label className="label" style={{ color: m.color }}>{m.label}</label>
                    <div className="input-suffix">
                      <input className="input" style={{ height: 44 }} type="number" value={targets[m.k as keyof Targets] as number} onChange={e => { setTargets({ ...targets, [m.k]: Number(e.target.value) }); setTargetsTouched(true); }} />
                      <span>g</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="hint mt-10">
                {Math.round(targets.protein * 4 + targets.carbs * 4 + targets.fat * 9)} kcal from macros · {targets.calories} kcal target
              </div>
            </div>

            <div className="card" style={{ padding: 16 }}>
              <div className="row-between">
                <div className="row" style={{ gap: 10 }}>
                  <span className="icon-box amber"><Utensils size={16} /></span>
                  <div><b style={{ fontSize: 12.5 }}>Macro split</b><div className="tiny faint">{Math.round((targets.protein * 4 / Math.max(1, targets.calories)) * 100)}% protein · {Math.round((targets.fat * 9 / Math.max(1, targets.calories)) * 100)}% fat</div></div>
                </div>
              </div>
            </div>

            <p className="hint">You can fine-tune these targets anytime from your profile.</p>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="ob-done">
          <div className="badge-big"><Dumbbell size={40} /></div>
          <span className="eyebrow">Ready to move</span>
          <h1 style={{ marginTop: 10 }}>You're set,<br />{form.name.split(' ')[0]}.</h1>
          <p className="auth-sub" style={{ textAlign: 'center' }}>
            Your dashboard is ready. Log a meal, start a session, or scan your fridge — every small action counts.
          </p>
          <div className="row mt-24" style={{ gap: 10 }}>
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/home', { replace: true })}>Enter Pepefit <ArrowRight size={16} /></button>
          </div>
          <div className="tiny faint mt-18">Daily targets: {targets?.calories} kcal · {targets?.protein}g protein</div>
        </div>
      )}

      {step < 4 && (
        <>
          {error && <div className="form-error" style={{ marginTop: 18 }}>{error}</div>}
          <div className="ob-foot">
            <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={next} disabled={saving}>
              {saving ? <span className="spinner" /> : <>{step === 3 ? 'Finish setup' : 'Continue'} <ArrowRight size={16} /></>}
            </button>
          </div>
        </>
      )}
    </div>
  );
}