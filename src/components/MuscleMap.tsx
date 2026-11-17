import React, { useMemo, useState } from 'react';
import type { MuscleData } from '../types';
import { MUSCLE_LABELS } from '../lib/utils';
import { timeAgo } from '../lib/utils';

const BODY = {
  head: <ellipse className="body-base" cx="130" cy="38" rx="19" ry="23" />,
  neck: <path className="body-base" d="M117 57 L143 57 L145 77 L115 77 Z" />,
  torso: <path className="body-base" d="M116 62 C108 64 100 68 94 74 C84 82 80 94 80 108 C80 124 78 140 82 156 C85 170 88 180 90 194 C92 210 90 226 86 238 C98 246 114 250 130 250 C146 250 162 246 174 238 C170 226 168 210 170 194 C172 180 175 170 178 156 C182 140 180 124 180 108 C180 94 176 82 166 74 C160 68 152 64 144 62 C144 72 140 78 130 78 C120 78 116 72 116 62 Z" />,
  armL: <path className="body-base" d="M92 74 C80 82 72 96 68 114 C63 136 59 162 56 190 C53 216 51 242 51 262 C51 272 57 278 63 276 C69 274 72 266 74 254 C78 230 82 204 87 178 C92 152 96 124 100 100 C101 90 100 80 98 74 Z" />,
  handL: <ellipse className="body-base" cx="59" cy="283" rx="9" ry="12" />,
  legL: <path className="body-base" d="M88 242 C82 270 82 304 88 334 C84 354 84 384 88 412 C91 436 94 456 95 470 L110 470 C110 450 112 430 112 410 C112 382 114 354 112 332 C116 300 118 270 120 242 C110 246 98 246 88 242 Z" />,
  footL: <path className="body-base" d="M95 466 C88 470 80 480 82 490 C84 498 96 500 106 498 C112 496 112 488 110 478 L110 468 Z" />,
};

function BaseBody() {
  return (
    <>
      {BODY.head}
      {BODY.neck}
      <g>{BODY.armL}<g transform="translate(260 0) scale(-1 1)">{BODY.armL}</g></g>
      <g>{BODY.handL}<g transform="translate(260 0) scale(-1 1)">{BODY.handL}</g></g>
      <g>{BODY.legL}<g transform="translate(260 0) scale(-1 1)">{BODY.legL}</g></g>
      <g>{BODY.footL}<g transform="translate(260 0) scale(-1 1)">{BODY.footL}</g></g>
      {BODY.torso}
    </>
  );
}

const FRONT = {
  chest: 'M128 96 C114 92 100 98 94 112 C89 124 94 136 104 142 C114 147 125 142 128 132 Z',
  front_delts: 'M92 82 C82 86 78 98 83 110 C88 120 97 118 100 108 C103 97 100 86 92 82 Z',
  side_delts: 'M80 96 C74 104 73 118 78 129 C82 137 88 135 89 127 C90 116 89 104 86 94 Z',
  biceps: 'M78 112 C70 124 66 144 64 162 C63 172 70 176 76 168 C82 154 85 132 86 116 C86 108 82 106 78 112 Z',
  forearms: 'M60 176 C55 196 52 222 52 244 C52 256 58 262 63 254 C67 246 69 228 72 208 C75 190 78 178 76 172 C72 166 64 168 60 176 Z',
  quads: 'M98 250 C90 274 88 304 94 330 C97 340 105 340 108 331 C114 306 116 276 118 252 C112 248 104 248 98 250 Z',
  calves: 'M93 356 C90 378 89 402 92 426 C94 440 100 442 103 430 C106 408 108 382 107 360 C103 352 97 350 93 356 Z',
  obliques: 'M104 152 C100 166 100 184 104 200 C108 210 114 212 115 202 C117 186 116 166 113 152 Z',
  traps: 'M116 70 C106 70 98 76 92 84 C99 84 108 80 118 78 Z',
};

const BACK = {
  rear_delts: 'M88 82 C78 88 76 100 82 111 C88 120 96 117 98 107 C100 96 96 84 88 82 Z',
  side_delts: 'M80 94 C74 102 73 116 78 127 C82 135 88 133 89 125 C90 114 89 102 86 92 Z',
  triceps: 'M80 110 C71 124 66 146 64 166 C63 176 70 180 76 170 C83 152 88 130 88 114 C88 106 84 104 80 110 Z',
  forearms: 'M60 176 C55 196 52 222 52 244 C52 256 58 262 63 254 C67 246 69 228 72 208 C75 190 78 178 76 172 C72 166 64 168 60 176 Z',
  lats: 'M94 124 C86 142 86 166 94 188 C100 202 112 208 120 200 C124 188 122 162 116 140 C111 128 102 120 94 124 Z',
  upper_back: 'M124 116 C114 112 104 116 100 126 C96 140 100 152 108 160 C114 165 120 161 122 153 C124 142 125 128 124 116 Z',
  lower_back: 'M114 176 C112 194 112 214 116 232 C120 240 126 238 126 228 C125 210 124 190 122 176 Z',
  glutes: 'M94 228 C86 234 84 248 88 260 C92 270 104 272 114 266 C122 260 124 248 120 238 C114 228 103 224 94 228 Z',
  hamstrings: 'M96 274 C90 296 88 322 92 344 C95 354 104 354 107 344 C111 322 114 296 116 276 C109 270 102 270 96 274 Z',
  calves: 'M92 354 C89 378 88 404 92 430 C95 444 102 446 105 432 C108 408 109 382 107 358 C102 350 96 348 92 354 Z',
};

const ABS_ROWS = [
  { y: 146, h: 15 }, { y: 164, h: 15 }, { y: 182, h: 15 },
];

export function MuscleMap({ muscles, initialView = 'front' }: { muscles: MuscleData[]; initialView?: 'front' | 'back' }) {
  const [view, setView] = useState<'front' | 'back'>(initialView);
  const [selected, setSelected] = useState<string | null>(null);
  const map = useMemo(() => Object.fromEntries(muscles.map(m => [m.key, m])), [muscles]);
  const status = (key: string) => map[key]?.status || 'untrained';

  const musclePath = (key: string, d: string, i = 0) => (
    <path
      key={`${key}-${i}`}
      d={d}
      className={`muscle ${selected === key ? 'selected' : ''}`}
      data-status={status(key)}
      onClick={() => setSelected(selected === key ? null : key)}
      role="button"
      tabIndex={0}
      aria-label={`${MUSCLE_LABELS[key]}: ${map[key]?.sets || 0} sets`}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setSelected(key); }}
    >
      <title>{`${MUSCLE_LABELS[key]} · ${map[key]?.sets || 0} sets`}</title>
    </path>
  );

  const mirrored = (key: string, d: string) => (
    <g key={key}>
      {musclePath(key, d)}
      <g transform="translate(260 0) scale(-1 1)">{musclePath(key, d, 1)}</g>
    </g>
  );

  const detail = selected ? map[selected] : null;
  const trained = muscles.filter(m => m.sets > 0).sort((a, b) => b.sets - a.sets);
  const neglected = muscles.filter(m => m.sets === 0).sort((a, b) => a.label.localeCompare(b.label));
  const top = trained[0];
  const focus = neglected.find(m => m.key !== 'forearms') || neglected[0];

  return (
    <>
      <div className="muscle-stage">
        <div className="segmented tiny muscle-view-toggle" style={{ width: 116 }}>
          <button className={view === 'front' ? 'active' : ''} onClick={() => setView('front')} type="button">Front</button>
          <button className={view === 'back' ? 'active' : ''} onClick={() => setView('back')} type="button">Back</button>
        </div>
        <svg key={view} className="muscle-figure slide-up" viewBox="0 0 260 515" aria-label={`${view} view muscle map`}>
          <BaseBody />
          {view === 'front' ? (
            <>
              {mirrored('chest', FRONT.chest)}
              {mirrored('front_delts', FRONT.front_delts)}
              {mirrored('side_delts', FRONT.side_delts)}
              {mirrored('biceps', FRONT.biceps)}
              {mirrored('forearms', FRONT.forearms)}
              {mirrored('traps', FRONT.traps)}
              {mirrored('obliques', FRONT.obliques)}
              {mirrored('quads', FRONT.quads)}
              {mirrored('calves', FRONT.calves)}
              {ABS_ROWS.map((row, r) => (
                <g key={`abs-${r}`}>
                  <rect key={`al-${r}`} x="112" y={row.y} width="13" height={row.h} rx="4" className={`muscle ${selected === 'abs' ? 'selected' : ''}`} data-status={status('abs')} onClick={() => setSelected(selected === 'abs' ? null : 'abs')} />
                  <rect key={`ar-${r}`} x="135" y={row.y} width="13" height={row.h} rx="4" className={`muscle ${selected === 'abs' ? 'selected' : ''}`} data-status={status('abs')} onClick={() => setSelected(selected === 'abs' ? null : 'abs')} />
                </g>
              ))}
            </>
          ) : (
            <>
              {musclePath('traps', 'M130 62 L146 66 C160 72 172 82 178 92 C166 98 154 108 147 122 L138 146 L130 158 L122 146 L113 122 C106 108 94 98 82 92 C88 82 100 72 114 66 Z')}
              {mirrored('rear_delts', BACK.rear_delts)}
              {mirrored('side_delts', BACK.side_delts)}
              {mirrored('triceps', BACK.triceps)}
              {mirrored('forearms', BACK.forearms)}
              {mirrored('upper_back', BACK.upper_back)}
              {mirrored('lats', BACK.lats)}
              {mirrored('lower_back', BACK.lower_back)}
              {mirrored('glutes', BACK.glutes)}
              {mirrored('hamstrings', BACK.hamstrings)}
              {mirrored('calves', BACK.calves)}
            </>
          )}
        </svg>
      </div>

      <div className="map-legend">
        {[
          ['Untrained', 'var(--ring-track)'],
          ['Light', 'color-mix(in srgb, var(--accent) 28%, var(--map-muscle))'],
          ['Moderate', 'color-mix(in srgb, var(--accent) 58%, var(--map-muscle))'],
          ['High', 'var(--accent)'],
        ].map(([label, color]) => (
          <span className="lg" key={label}><i className="sw" style={{ background: color }} />{label}</span>
        ))}
      </div>

      {detail ? (
        <div className="muscle-detail">
          <div className="icon-box volt" style={{ width: 34, height: 34, borderRadius: 10 }}>
            <span style={{ fontSize: 13 }}>{detail.sets > 0 ? '🔥' : '💤'}</span>
          </div>
          <div className="grow">
            <b>{detail.label}</b>
            <span>
              {detail.sets > 0 ? `${detail.sets} working sets · ${detail.volume.toLocaleString()} kg volume` : 'No direct work in this range'}
              {detail.lastTrained ? ` · ${timeAgo(detail.lastTrained)}` : ''}
            </span>
          </div>
          <span className={`pill ${detail.recovery === 'recovering' ? 'pill-amber' : detail.sets > 0 ? 'pill-mint' : 'pill-muted'}`} style={{ textTransform: 'capitalize' }}>{detail.recovery}</span>
        </div>
      ) : (
        <div className="muscle-summary">
          <div className="ms"><span>Most trained</span><b>{top ? top.label : '—'}</b></div>
          <div className="ms"><span>Needs attention</span><b>{focus ? focus.label : 'Balanced'}</b></div>
          <div className="ms"><span>Tap a muscle</span><b>View detail</b></div>
        </div>
      )}
    </>
  );
}