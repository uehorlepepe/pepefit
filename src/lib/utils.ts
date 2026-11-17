export const MUSCLE_LABELS: Record<string, string> = {
  chest: 'Chest',
  front_delts: 'Front delts',
  side_delts: 'Side delts',
  rear_delts: 'Rear delts',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  upper_back: 'Upper back',
  lats: 'Lats',
  traps: 'Traps',
  lower_back: 'Lower back',
  abs: 'Abs',
  obliques: 'Obliques',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
};

export const GOAL_LABELS: Record<string, string> = {
  muscle_gain: 'Build muscle',
  fat_loss: 'Lose fat',
  strength: 'Get stronger',
  endurance: 'Endurance',
  general_fitness: 'General fitness',
};

export const GOAL_ICONS: Record<string, string> = {
  muscle_gain: '💪',
  fat_loss: '🔥',
  strength: '⚡',
  endurance: '🏃',
  general_fitness: '🌿',
};

export const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

export const MEAL_ICONS: Record<string, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snacks: '🍎',
};

export const MACRO_COLORS = {
  calories: 'var(--volt)',
  protein: 'var(--sky)',
  carbs: 'var(--amber)',
  fat: 'var(--rose)',
  fiber: 'var(--mint)',
};

export const clamp = (v: number, min = 0, max = 1) => Math.max(min, Math.min(max, v));
export const pct = (value: number, target: number) => (target > 0 ? clamp(value / target) * 100 : 0);

export function toLocalISO(d: Date = new Date()) {
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
}

export function parseLocalDate(date: string) {
  return new Date(date + 'T12:00:00');
}

export function addDays(date: string, delta: number) {
  const d = parseLocalDate(date);
  d.setDate(d.getDate() + delta);
  return toLocalISO(d);
}

export function shortDay(date: string) {
  return parseLocalDate(date).toLocaleDateString(undefined, { weekday: 'short' });
}

export function formatDate(date: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }) {
  return parseLocalDate(date).toLocaleDateString(undefined, opts);
}

export function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Late night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function timeAgo(iso: string | null) {
  if (!iso) return 'never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function relativeDay(date: string) {
  const today = toLocalISO();
  if (date === today) return 'Today';
  if (date === addDays(today, -1)) return 'Yesterday';
  if (date === addDays(today, 1)) return 'Tomorrow';
  return formatDate(date, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatClock(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export function formatNumber(n: number) {
  if (!Number.isFinite(n)) return '0';
  return Math.round(n).toLocaleString();
}

export function formatVolume(kg: number) {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${Math.round(kg)} kg`;
}

export const DIET_OPTIONS = ['High protein', 'Balanced', 'Vegetarian', 'Vegan', 'Pescatarian', 'Low carb', 'Keto', 'Mediterranean', 'Gluten-free', 'Dairy-free'];
export const RESTRICTION_OPTIONS = ['No dairy', 'No gluten', 'No nuts', 'No shellfish', 'No eggs', 'No soy', 'No pork', 'No beef', 'Halal', 'Kosher'];
export const EXPERIENCE_OPTIONS = [
  { value: 'beginner', label: 'Beginner', desc: 'New to training or returning after a break' },
  { value: 'intermediate', label: 'Intermediate', desc: '6+ months of consistent training' },
  { value: 'advanced', label: 'Advanced', desc: '2+ years, confident with progression' },
];
export const GOAL_OPTIONS = [
  { value: 'muscle_gain', label: 'Build muscle', desc: 'Surplus, progressive overload', icon: '💪' },
  { value: 'fat_loss', label: 'Lose fat', desc: 'Sustainable deficit, keep strength', icon: '🔥' },
  { value: 'strength', label: 'Get stronger', desc: 'Heavy compounds, low reps', icon: '⚡' },
  { value: 'endurance', label: 'Endurance', desc: 'Conditioning and stamina', icon: '🏃' },
  { value: 'general_fitness', label: 'General fitness', desc: 'Feel good, move well', icon: '🌿' },
];

export function goalLabel(goal?: string | null) {
  return GOAL_LABELS[goal || ''] || 'General fitness';
}

export function muscleNames(keys: string[] = []) {
  return keys.map(k => MUSCLE_LABELS[k] || k);
}