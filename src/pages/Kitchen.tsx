import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera, ChevronRight, Flame, Heart, ImagePlus, Info, Plus, ScanLine, Search, Sparkles,
  Upload, Utensils, X,
} from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useUI } from '../context/UIContext';
import { api } from '../lib/api';
import { EmptyState, SectionHead, Sheet, Skeleton } from '../components/ui';
import { RecipeDetail } from '../components/RecipeDetail';
import { formatNumber, goalLabel, toLocalISO } from '../lib/utils';
import type { DashboardData, KitchenScan, Recipe } from '../types';

type Ingredient = { key: string; name: string; emoji: string; category: string; confidence?: number };
type ScanHistory = { id: number; createdAt: string; source: 'ai' | 'demo'; ingredients: { key: string; name: string; emoji: string }[]; imageUrl: string | null };

const CATEGORY_ORDER = ['Protein', 'Produce', 'Dairy', 'Grains', 'Pantry'];

async function extractColors(file: File): Promise<string[]> {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = 28;
    canvas.height = 28;
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];
    ctx.drawImage(bitmap, 0, 0, 28, 28);
    bitmap.close?.();
    const { data } = ctx.getImageData(0, 0, 28, 28);
    const buckets = new Map<string, number>();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      const q = (v: number) => Math.min(255, Math.round(v / 32) * 32);
      const hex = '#' + [q(data[i]), q(data[i + 1]), q(data[i + 2])].map(v => v.toString(16).padStart(2, '0')).join('');
      buckets.set(hex, (buckets.get(hex) || 0) + 1);
    }
    return [...buckets.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([hex]) => hex);
  } catch {
    return [];
  }
}

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export function Kitchen() {
  const { toast } = useUI();
  const today = toLocalISO();
  const [tab, setTab] = useState<'scan' | 'saved'>('scan');
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [scan, setScan] = useState<KitchenScan | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [busyRecommend, setBusyRecommend] = useState(false);
  const [active, setActive] = useState<Recipe | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [ingQuery, setIngQuery] = useState('');
  const [ingCategory, setIngCategory] = useState('All');

  const previewRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const { data: status } = useApi<{ visionEnabled: boolean; mode: 'ai' | 'demo' }>('/kitchen/status');
  const { data: scansData, refetch: refetchScans } = useApi<{ scans: ScanHistory[] }>('/kitchen/scans');
  const { data: savedData, refetch: refetchSaved } = useApi<{ recipes: Recipe[] }>('/kitchen/recipes?saved=1');
  const { data: ingredientData } = useApi<{ ingredients: { key: string; name: string; emoji: string; category: string }[] }>('/kitchen/ingredients');
  const { data: dash, refetch: refetchDash } = useApi<DashboardData>(`/dashboard?date=${today}`);

  const savedIds = useMemo(() => new Set((savedData?.recipes || []).map(r => r.id)), [savedData]);
  const remaining = dash?.remaining;

  const setPreviewUrl = (url: string | null) => {
    if (previewRef.current?.startsWith('blob:')) URL.revokeObjectURL(previewRef.current);
    previewRef.current = url;
    setPreview(url);
  };

  useEffect(() => () => {
    if (previewRef.current?.startsWith('blob:')) URL.revokeObjectURL(previewRef.current);
  }, []);

  useEffect(() => {
    if (!scanning) return;
    setScanStep(0);
    const t = setInterval(() => setScanStep(s => Math.min(2, s + 1)), 800);
    return () => clearInterval(t);
  }, [scanning]);

  const recommend = async (keys: string[]) => {
    setBusyRecommend(true);
    try {
      const res = await api<{ recipes: Recipe[] }>('/kitchen/recommend', {
        method: 'POST',
        body: {
          ingredients: keys,
          remaining: {
            protein: remaining?.protein || 0,
            calories: remaining?.calories || 0,
            carbs: remaining?.carbs || 0,
          },
        },
      });
      setScan(prev => (prev ? { ...prev, recipes: res.recipes } : prev));
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setBusyRecommend(false);
    }
  };

  const runScan = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast('Choose an image file', 'error');
      return;
    }
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
    setScanning(true);
    setScan(null);
    setIngredients([]);
    try {
      const colors = await extractColors(file);
      const form = new FormData();
      form.append('image', file);
      form.append('colors', JSON.stringify(colors));
      form.append('remainingProtein', String(Math.max(0, remaining?.protein || 0)));
      form.append('remainingCalories', String(Math.max(0, remaining?.calories || 0)));
      form.append('remainingCarbs', String(Math.max(0, remaining?.carbs || 0)));
      const [res] = await Promise.all([
        api<KitchenScan>('/kitchen/analyze', { method: 'POST', form }),
        delay(1800),
      ]);
      setScan(res);
      setIngredients(res.ingredients);
      setPreviewUrl(res.imageUrl || localUrl);
      refetchScans();
      toast(
        res.source === 'ai' ? 'Fridge scanned' : 'Demo scan complete',
        'success',
        `${res.ingredients.length} ingredients found · ${res.recipes.length} recipes matched`,
      );
    } catch (err: any) {
      toast(err.message, 'error');
      setPreviewUrl(null);
    } finally {
      setScanning(false);
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) runScan(file);
  };

  const removeIngredient = (key: string) => {
    const next = ingredients.filter(i => i.key !== key);
    setIngredients(next);
    recommend(next.map(i => i.key));
  };

  const addIngredient = (ing: { key: string; name: string; emoji: string; category: string }) => {
    if (ingredients.some(i => i.key === ing.key)) return;
    const next: Ingredient[] = [...ingredients, { ...ing, confidence: 1 }];
    setIngredients(next);
    setPickerOpen(false);
    setIngQuery('');
    recommend(next.map(i => i.key));
  };

  const reuseScan = (s: ScanHistory) => {
    setTab('scan');
    setPreviewUrl(s.imageUrl);
    setIngredients(s.ingredients.map(i => ({ ...i, category: '', confidence: 1 })));
    setScan({
      scanId: s.id,
      source: s.source,
      note: '',
      imageUrl: s.imageUrl,
      ingredients: s.ingredients.map(i => ({ ...i, category: '', confidence: 1 })),
      recipes: [],
      goal: dash?.user.profile?.goal || 'general_fitness',
      remaining: { protein: remaining?.protein || 0, calories: remaining?.calories || 0, carbs: remaining?.carbs || 0 },
    });
    recommend(s.ingredients.map(i => i.key));
  };

  const startOver = () => {
    setScan(null);
    setIngredients([]);
    setPreviewUrl(null);
  };

  const ingredientsForPicker = useMemo(() => {
    const needle = ingQuery.trim().toLowerCase();
    return (ingredientData?.ingredients || [])
      .filter(i => !ingredients.some(x => x.key === i.key))
      .filter(i => ingCategory === 'All' || i.category === ingCategory)
      .filter(i => !needle || i.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [ingredientData, ingQuery, ingCategory, ingredients]);

  const history = scansData?.scans || [];
  const saved = savedData?.recipes || [];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Kitchen</h1>
        </div>
        <span className="icon-box volt" style={{ marginTop: 4 }}><Sparkles size={17} /></span>
      </div>

      <div className="segmented" style={{ marginBottom: 16 }}>
        <button className={tab === 'scan' ? 'active' : ''} onClick={() => setTab('scan')}><ScanLine size={13} /> Scan</button>
        <button className={tab === 'saved' ? 'active' : ''} onClick={() => setTab('saved')}><Heart size={13} /> Saved {saved.length > 0 ? `(${saved.length})` : ''}</button>
      </div>

      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFile} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onFile} />

      {tab === 'scan' ? (
        <>
          {scanning ? (
            <div className="scan-loading">
              {preview && <img src={preview} alt="Fridge being scanned" />}
              <div className="scan-line" />
              <div className="scan-overlay">
                <div className="eyebrow" style={{ color: '#f2a184' }}>One moment</div>
                <b style={{ fontSize: 17, color: '#fff', marginTop: 4 }}>Reading your fridge…</b>
                <div className="scan-steps">
                  {['Detecting ingredients', 'Checking your remaining macros', 'Matching recipes you can cook'].map((s, i) => (
                    <div key={s} className={`scan-step ${scanStep >= i ? 'on' : ''}`}><span className="sd" />{s}</div>
                  ))}
                </div>
              </div>
            </div>
          ) : scan ? (
            <>
              <div className="card" style={{ padding: 14 }}>
                <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
                  {preview ? (
                    <img src={preview} alt="Fridge scan" style={{ width: 62, height: 62, borderRadius: 14, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <span className="icon-box volt" style={{ width: 62, height: 62, borderRadius: 16 }}><Sparkles size={22} /></span>
                  )}
                  <div className="grow">
                    <div className="row" style={{ gap: 6 }}>
                      <b style={{ fontSize: 13.5 }}>Fridge scan</b>
                      <span className={`pill ${scan.source === 'ai' ? 'pill-mint' : 'pill-muted'}`} style={{ fontSize: 9 }}>
                        {scan.source === 'ai' ? 'AI vision' : 'Demo vision'}
                      </span>
                    </div>
                    <div className="tiny faint" style={{ marginTop: 3, lineHeight: 1.45 }}>
                      {scan.note || (scan.source === 'ai'
                        ? 'Ingredients identified from your photo.'
                        : 'Demo mode uses local heuristics. Set OPENAI_API_KEY for real photo analysis.')}
                    </div>
                  </div>
                  <button className="chip" style={{ height: 28, fontSize: 10, flexShrink: 0 }} onClick={startOver}><Camera size={11} /> New</button>
                </div>

                <div className="divider" />

                <div className="row-between" style={{ marginBottom: 8 }}>
                  <span className="label" style={{ margin: 0 }}>{ingredients.length} ingredients detected</span>
                  {busyRecommend && <span className="tiny faint">Updating recipes…</span>}
                </div>
                <div className="ingredient-chips">
                  {ingredients.map(ing => (
                    <span className="ing-chip" key={ing.key} title={ing.confidence ? `${Math.round(ing.confidence * 100)}% confidence` : undefined}>
                      {ing.emoji} {ing.name}
                      <button className="rm" onClick={() => removeIngredient(ing.key)} aria-label={`Remove ${ing.name}`}><X size={10} /></button>
                    </span>
                  ))}
                  <button className="ing-chip add" onClick={() => setPickerOpen(true)}><Plus size={11} /> Add</button>
                </div>

                {remaining && (
                  <div className="tiny faint mt-14" style={{ lineHeight: 1.5 }}>
                    Matched to {goalLabel(dash?.user.profile?.goal)} · {Math.max(0, Math.round(remaining.protein))}g protein and {Math.max(0, Math.round(remaining.calories))} kcal left today.
                  </div>
                )}
              </div>

              <SectionHead title={busyRecommend ? 'Finding matches…' : 'Recipes for you'} action={scan.recipes.length ? `${scan.recipes.length} matches` : undefined} />
              {busyRecommend && scan.recipes.length === 0 ? (
                <div className="stack" style={{ gap: 10 }}><Skeleton height={102} /><Skeleton height={102} /><Skeleton height={102} /></div>
              ) : scan.recipes.length === 0 ? (
                <div className="card">
                  <EmptyState
                    icon={<Utensils size={21} />} title="No recipes match yet"
                    text="Add a few more ingredients from your fridge and we'll find something you can cook."
                    action={<button className="btn btn-sm btn-soft" onClick={() => setPickerOpen(true)}><Plus size={13} /> Add ingredients</button>}
                  />
                </div>
              ) : (
                <div className="stack" style={{ gap: 10 }}>
                  {scan.recipes.map(r => (
                    <button key={r.id} className="card recipe-card card-press" style={{ width: '100%', textAlign: 'left' }} onClick={() => setActive(r)}>
                      <span className="recipe-thumb">
                        {r.emoji}
                        <span className="match-badge">{r.matchPercent}% match</span>
                      </span>
                      <div className="recipe-card-main">
                        <div className="row-between" style={{ gap: 6 }}>
                          <b>{r.name}</b>
                          {savedIds.has(r.id) && <Heart size={12} fill="var(--rose)" color="var(--rose)" style={{ flexShrink: 0 }} />}
                        </div>
                        <p>{r.totalMin} min · {r.cuisine}</p>
                        <div className="recipe-macros">
                          <span><b>{r.calories}</b> kcal</span>
                          <span><b>{r.protein}g</b> protein</span>
                          <span style={{ color: r.canMakeNow ? 'var(--mint)' : 'var(--amber)' }}>{r.canMakeNow ? 'Ready to cook' : `${r.missing?.length} missing`}</span>
                        </div>
                      </div>
                      <ChevronRight size={15} style={{ color: 'var(--faint)', flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="kitchen-hero">
                <div className="hero-mesh" />
                <div className="row-between" style={{ position: 'relative', zIndex: 2 }}>
                  <span className="eyebrow">Scan your fridge</span>
                  <span className="pill pill-muted">
                    <Sparkles size={10} /> {status?.mode === 'ai' ? 'Vision ready' : 'Demo vision'}
                  </span>
                </div>
                <h2>What's in<br />your fridge?</h2>
                <p>Take a photo and we'll turn what you have into meals built around your remaining macros — not random recipes.</p>
                <div className="scan-cta">
                  <button className="upload-tile" style={{ flex: 1 }} onClick={() => cameraRef.current?.click()}>
                    <span className="up-ico"><Camera size={21} /></span>
                    <b>Take a photo</b>
                    <span>Use your camera</span>
                  </button>
                  <button className="upload-tile" style={{ flex: 1 }} onClick={() => fileRef.current?.click()}>
                    <span className="up-ico" style={{ background: 'var(--surface-3)', color: 'var(--text)' }}><Upload size={21} /></span>
                    <b>Upload</b>
                    <span>JPG, PNG, WEBP</span>
                  </button>
                </div>
                {status?.mode === 'demo' && (
                  <div className="row mt-14" style={{ gap: 6, position: 'relative', zIndex: 2, color: 'var(--muted)' }}>
                    <Info size={12} style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 9.5, lineHeight: 1.5 }}>Demo mode infers ingredients locally from the image. Set OPENAI_API_KEY to enable real vision analysis.</span>
                  </div>
                )}
              </div>

              {dash && (
                <div className="insight-card mt-14">
                  <span className="ins-icon"><Flame size={16} /></span>
                  <div className="grow">
                    <b>{goalLabel(dash.user.profile?.goal)} · {Math.max(0, Math.round(remaining?.calories || 0))} kcal left</b>
                    <p>{Math.max(0, Math.round(remaining?.protein || 0))}g protein still to hit today. We'll prioritise recipes that close those gaps.</p>
                  </div>
                </div>
              )}

              {history.length > 0 && (
                <>
                  <SectionHead title="Recent scans" />
                  <div className="card" style={{ padding: '4px 16px' }}>
                    {history.map(s => (
                      <div className="saved-scan" key={s.id}>
                        {s.imageUrl ? <img src={s.imageUrl} alt="Previous fridge scan" /> : <span className="icon-box" style={{ width: 38, height: 38, borderRadius: 10 }}><ImagePlus size={15} /></span>}
                        <div className="grow" style={{ minWidth: 0 }}>
                          <b style={{ fontSize: 11.5, display: 'block' }}>{s.ingredients.slice(0, 3).map(i => i.name).join(', ')}{s.ingredients.length > 3 ? ` +${s.ingredients.length - 3}` : ''}</b>
                          <span className="tiny faint">{new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {s.source === 'ai' ? 'AI vision' : 'Demo'}</span>
                        </div>
                        <button className="btn btn-xs btn-ghost" onClick={() => reuseScan(s)}>Use again</button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {saved.length > 0 && (
                <>
                  <SectionHead title="Saved for later" action="See all" onAction={() => setTab('saved')} />
                  <div className="scroll-x">
                    {saved.slice(0, 4).map(r => (
                      <button key={r.id} className="card" style={{ width: 166, padding: 12, textAlign: 'left', flexShrink: 0 }} onClick={() => setActive(r)}>
                        <span className="recipe-thumb" style={{ width: '100%', height: 84, marginBottom: 9, fontSize: 34 }}>{r.emoji}</span>
                        <b style={{ fontSize: 11.5, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</b>
                        <div className="tiny faint mt-6">{r.protein}g protein · {r.totalMin} min</div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <SectionHead title="Your saved recipes" action={saved.length > 0 ? `${saved.length} saved` : undefined} />
          {saved.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<Heart size={21} />} title="Nothing saved yet"
                text="When a recipe looks good, tap the heart and it will live here for later."
                action={<button className="btn btn-sm btn-primary" onClick={() => setTab('scan')}><Camera size={13} /> Scan your fridge</button>}
              />
            </div>
          ) : (
            <div className="stack" style={{ gap: 10 }}>
              {saved.map(r => (
                <button key={r.id} className="card recipe-card card-press" style={{ width: '100%', textAlign: 'left' }} onClick={() => setActive(r)}>
                  <span className="recipe-thumb">{r.emoji}</span>
                  <div className="recipe-card-main">
                    <div className="row-between" style={{ gap: 6 }}>
                      <b>{r.name}</b>
                      <Heart size={12} fill="var(--rose)" color="var(--rose)" style={{ flexShrink: 0 }} />
                    </div>
                    <p>{r.totalMin} min · {r.cuisine}</p>
                    <div className="recipe-macros">
                      <span><b>{r.calories}</b> kcal</span>
                      <span><b>{r.protein}g</b> protein</span>
                      <span><b>{r.carbs}g</b> carbs</span>
                    </div>
                  </div>
                  <ChevronRight size={15} style={{ color: 'var(--faint)', flexShrink: 0 }} />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <RecipeDetail
        recipe={active}
        open={!!active}
        onClose={() => setActive(null)}
        onChanged={() => { refetchSaved(); refetchDash(); }}
      />

      <Sheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="Add ingredients">
        <div className="input-suffix" style={{ marginBottom: 10 }}>
          <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--faint)' }} />
          <input className="input" style={{ paddingLeft: 38 }} placeholder="Search ingredients…" value={ingQuery} onChange={e => setIngQuery(e.target.value)} />
          {ingQuery && <button className="pw-toggle" onClick={() => setIngQuery('')} aria-label="Clear"><X size={14} /></button>}
        </div>
        <div className="chip-row" style={{ marginBottom: 10 }}>
          {['All', ...CATEGORY_ORDER].map(c => (
            <button key={c} className={`chip ${ingCategory === c ? 'active' : ''}`} style={{ height: 28, fontSize: 10.5 }} onClick={() => setIngCategory(c)}>{c}</button>
          ))}
        </div>
        <div className="picker-list">
          {ingredientsForPicker.map(ing => (
            <button key={ing.key} className="picker-item" onClick={() => addIngredient(ing)}>
              <span style={{ fontSize: 18, width: 26, textAlign: 'center' }}>{ing.emoji}</span>
              <span className="grow"><b>{ing.name}</b><span>{ing.category}</span></span>
              <span className="picker-add"><Plus size={14} /></span>
            </button>
          ))}
          {ingredientsForPicker.length === 0 && <div className="hint" style={{ padding: '16px 0' }}>No more ingredients to add. Try another category.</div>}
        </div>
      </Sheet>
    </div>
  );
}