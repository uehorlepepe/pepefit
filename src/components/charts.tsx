import React, { useId, useMemo, useRef, useState } from 'react';

export interface ChartPoint { label: string; value: number | null; sub?: string }

export function WeeklyBars({ data, target, height = 108, suffix = '', formatValue }: {
  data: { value: number; label: string; highlight?: boolean; sub?: string }[];
  target?: number;
  height?: number;
  suffix?: string;
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(1, target || 0, ...data.map(d => d.value)) * 1.06;
  const targetPct = target ? (target / max) * 100 : null;
  return (
    <div className="chart-wrap">
      <div className="chart-bars" style={{ height }}>
        {data.map((d, i) => {
          const h = d.value > 0 ? Math.max(2, (d.value / max) * 100) : 0;
          const over = target ? d.value > target * 1.05 : false;
          return (
            <div className="chart-bar-col" key={i} title={`${d.label}: ${formatValue ? formatValue(d.value) : Math.round(d.value)}${suffix}`}>
              <div className="chart-bar-track">
                {targetPct !== null && <div className="chart-target-line" style={{ bottom: `${targetPct}%` }} />}
                <div className={`chart-bar-fill ${over ? 'over' : ''} ${d.highlight ? 'today' : d.value === 0 ? 'dim' : ''}`} style={{ height: `${h}%` }} />
              </div>
              <span className={`chart-bar-label ${d.highlight ? 'today' : ''}`}>{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function TrendChart({ data, color = 'var(--volt)', height = 150, suffix = '', unit = '', showArea = true, formatValue, showLast = true, grid = true }: {
  data: ChartPoint[]; color?: string; height?: number; suffix?: string; unit?: string;
  showArea?: boolean; formatValue?: (v: number) => string; showLast?: boolean; grid?: boolean;
}) {
  const uid = useId().replace(/:/g, '');
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const W = 320, H = height;
  const padT = 14, padB = 22, padX = 8;
  const valid = data.filter(d => d.value !== null && Number.isFinite(d.value)) as { label: string; value: number }[];
  const values = valid.map(d => d.value);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const span = max - min || 1;
  const lo = min - span * 0.18;
  const hi = max + span * 0.18;
  const xFor = (i: number) => padX + (data.length <= 1 ? (W - padX * 2) / 2 : (i / (data.length - 1)) * (W - padX * 2));
  const yFor = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  const pts = data.map((d, i) => ({ x: xFor(i), y: d.value === null ? null : yFor(d.value) })).filter(p => p.y !== null) as { x: number; y: number }[];
  const line = smoothPath(pts);
  const area = pts.length ? `${line} L ${pts[pts.length - 1].x} ${H - padB} L ${pts[0].x} ${H - padB} Z` : '';
  const lastIdx = data.map((d, i) => d.value !== null ? i : -1).filter(i => i >= 0).pop();
  const active = hover !== null && data[hover]?.value !== null ? hover : null;
  const activeValue = active !== null ? data[active].value : data[lastIdx ?? 0]?.value;

  const onMove = (e: React.PointerEvent) => {
    if (!wrapRef.current || data.length < 2) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((x - padX) / (W - padX * 2)) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, idx)));
  };

  if (!data.length) return <div className="empty-chart" style={{ height, display: 'grid', placeItems: 'center', color: 'var(--faint)', fontSize: 11 }}>No data yet</div>;

  return (
    <div style={{ position: 'relative' }} ref={wrapRef}>
      <div style={{ position: 'absolute', top: 0, right: 2, fontSize: 10, color: 'var(--faint)', zIndex: 2 }}>
        {activeValue !== null && activeValue !== undefined ? `${formatValue ? formatValue(activeValue) : activeValue}${unit}` : ''}
      </div>
      <svg className="line-chart" viewBox={`0 0 ${W} ${H}`} style={{ height }} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`line-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={color} stopOpacity="0.55" />
            <stop offset="100%" stopColor={color} stopOpacity="1" />
          </linearGradient>
        </defs>
        {grid && [0.25, 0.5, 0.75].map(p => (
          <line key={p} className="grid-line" x1={padX} x2={W - padX} y1={padT + p * (H - padT - padB)} y2={padT + p * (H - padT - padB)} />
        ))}
        {showArea && pts.length > 1 && <path d={area} fill={`url(#area-${uid})`} />}
        {pts.length > 1 && <path d={line} fill="none" stroke={`url(#line-${uid})`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
        {pts.length === 1 && <circle cx={pts[0].x} cy={pts[0].y} r="4" fill={color} />}
        {pts.length > 0 && (
          <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="4.2" fill={color} stroke="var(--bg)" strokeWidth="2.5" />
        )}
        {active !== null && data[active].value !== null && (
          <>
            <line x1={xFor(active)} x2={xFor(active)} y1={padT} y2={H - padB} stroke="var(--line-strong)" strokeDasharray="3 4" />
            <circle cx={xFor(active)} cy={yFor(data[active].value as number)} r="5" fill={color} stroke="var(--bg)" strokeWidth="2.5" />
          </>
        )}
        {data.length > 1 && (
          <>
            <text className="axis-text" x={padX} y={H - 4}>{data[0].label}</text>
            <text className="axis-text" x={W - padX} y={H - 4} textAnchor="end">{data[data.length - 1].label}</text>
          </>
        )}
      </svg>
      {active !== null && (
        <div style={{
          position: 'absolute', left: `${(xFor(active) / W) * 100}%`, top: 18, transform: 'translateX(-50%)',
          background: 'var(--surface-3)', border: '1px solid var(--line)', borderRadius: 8, padding: '3px 8px',
          fontSize: 10, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 3,
        }}>
          {data[active].label} · {formatValue ? formatValue(data[active].value as number) : data[active].value}{unit}
        </div>
      )}
    </div>
  );
}

export function Sparkline({ values, color = 'var(--volt)', width = 90, height = 30 }: { values: number[]; color?: string; width?: number; height?: number }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => ({
    x: 2 + (i / Math.max(1, values.length - 1)) * (width - 4),
    y: 3 + (1 - (v - min) / span) * (height - 6),
  }));
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={smoothPath(pts)} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      {pts.length > 0 && <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="2.2" fill={color} />}
    </svg>
  );
}

export function WeekPips({ days, labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] }: { days: { completed: boolean; date: string }[]; labels?: string[] }) {
  return (
    <div className="week-pips">
      {days.map((d, i) => (
        <div key={d.date} className={`week-pip ${d.completed ? 'on' : ''}`} title={d.date}>
          {d.completed ? <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 4l2 2 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg> : labels[i]}
        </div>
      ))}
    </div>
  );
}

export function MacroSplitBar({ protein, carbs, fat }: { protein: number; carbs: number; fat: number }) {
  const pCal = protein * 4, cCal = carbs * 4, fCal = fat * 9;
  const total = pCal + cCal + fCal || 1;
  return (
    <div style={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', gap: 2 }}>
      <div style={{ width: `${(pCal / total) * 100}%`, background: 'var(--sky)' }} />
      <div style={{ width: `${(cCal / total) * 100}%`, background: 'var(--amber)' }} />
      <div style={{ width: `${(fCal / total) * 100}%`, background: 'var(--rose)' }} />
    </div>
  );
}

export function DonutRing({ segments, size = 110, stroke = 12, children }: {
  segments: { value: number; color: string }[]; size?: number; stroke?: number; children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let offset = 0;
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={stroke} />
        {segments.map((s, i) => {
          const len = (s.value / total) * c;
          const el = (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={stroke}
              strokeDasharray={`${Math.max(0, len - 3)} ${c}`} strokeDashoffset={-offset} strokeLinecap="round" />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}