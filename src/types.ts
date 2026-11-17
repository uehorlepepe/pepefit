export type GoalType = 'muscle_gain' | 'fat_loss' | 'strength' | 'endurance' | 'general_fitness';

export interface Profile {
  age: number | null;
  sex: string | null;
  heightCm: number | null;
  weightKg: number | null;
  experience: string | null;
  goal: GoalType | null;
  weeklyFrequency: number | null;
  diet: string[];
  restrictions: string[];
  activityLevel: string | null;
  unitSystem: string | null;
}

export interface Targets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
}

export interface User {
  id: number;
  email: string;
  name: string;
  avatarColor: string;
  onboarded: boolean;
  isAdmin?: boolean;
  createdAt: string;
  profile: Profile | null;
  targets: Targets | null;
}

export interface AdminUserRow {
  id: number;
  name: string;
  email: string;
  createdAt: string;
  isAdmin: boolean;
  workouts: number;
  sets: number;
  meals: number;
  mealDays: number;
  lastWorkout: string | null;
}

export interface AdminOverview {
  totals: { users: number; admins: number; workouts: number; sets: number; meals: number };
  library: { exercises: number; foods: number; recipes: number };
  users: AdminUserRow[];
}

export interface Exercise {
  id: number;
  name: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string;
  category: string;
  instructions: string;
  isCustom?: boolean;
}

export interface RoutineExercise {
  id: number;
  exerciseId: number;
  name: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  equipment: string;
  category: string;
  targetSets: number;
  targetReps: string;
}

export interface Routine {
  id: number;
  name: string;
  description: string;
  color: string;
  lastPerformed: string | null;
  exercises: RoutineExercise[];
}

export interface WorkoutSet {
  id: number;
  setNumber: number;
  weight: number;
  reps: number;
  rpe?: number | null;
  completed: boolean;
}

export interface SessionExercise {
  exerciseId: number;
  name: string;
  muscles: string[];
  equipment?: string;
  targetSets?: number;
  targetReps?: string;
  last?: { date: string; sets: WorkoutSet[] } | null;
  sets: WorkoutSet[];
}

export interface Session {
  id: number;
  name: string;
  routineId: number | null;
  startedAt: string;
  completedAt: string | null;
  durationSec: number;
  notes: string | null;
  feeling: number | null;
  volume: number;
  totalSets: number;
  exercises: SessionExercise[];
}

export interface MuscleData {
  key: string;
  label: string;
  sets: number;
  volume: number;
  intensity: number;
  status: 'untrained' | 'light' | 'moderate' | 'high';
  recovery: 'resting' | 'recovering' | 'ready' | 'neglected';
  lastTrained: string | null;
  exerciseCount: number;
}

export interface MuscleMapData {
  days: number;
  daysLabel: string;
  muscles: MuscleData[];
  top: MuscleData[];
  neglected: string[];
  totalSets: number;
  lastWorkout: string | null;
}

export interface Food {
  id: number;
  name: string;
  brand: string | null;
  category: string;
  serving_label: string;
  serving_grams: number | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  iron: number;
  calcium: number;
  is_custom?: number;
}

export interface MealItem {
  id: number;
  name: string;
  servings: number;
  servingLabel: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
  iron: number;
  calcium: number;
  foodId: number | null;
}

export interface MealGroup {
  type: 'breakfast' | 'lunch' | 'dinner' | 'snacks';
  items: MealItem[];
  calories: number;
}

export interface DayNutrition {
  date: string;
  totals: {
    calories: number; protein: number; carbs: number; fat: number;
    fiber: number; sodium: number; iron: number; calcium: number;
  };
  meals: MealGroup[];
  targets: Targets;
}

export interface RecipeIngredient {
  key: string;
  name: string;
  emoji: string;
  amount: number;
  unit: string;
  optional?: boolean;
  substitutes: { key: string; name: string; emoji: string }[];
}

export interface MissingIngredient {
  key: string;
  name: string;
  emoji: string;
  substitutes: { key: string; name: string; emoji: string }[];
}

export interface Recipe {
  id: number;
  slug: string;
  name: string;
  description: string;
  emoji: string;
  gradient: string;
  cuisine: string;
  prepMin: number;
  cookMin: number;
  totalMin: number;
  servings: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  tags: string[];
  goalAffinity: string[];
  saved?: boolean;
  matchPercent?: number;
  canMakeNow?: boolean;
  missing?: MissingIngredient[];
  ingredients: RecipeIngredient[];
  steps: string[];
  highProtein?: boolean;
  fitsCalories?: boolean;
}

export interface KitchenScan {
  scanId: number;
  source: 'ai' | 'demo';
  note: string;
  imageUrl: string | null;
  ingredients: { key: string; name: string; emoji: string; category: string; confidence: number }[];
  recipes: Recipe[];
  goal: GoalType;
  remaining: { protein: number; calories: number; carbs: number };
}

export interface DashboardData {
  date: string;
  user: User;
  targets: Targets;
  totals: { calories: number; protein: number; carbs: number; fat: number; fiber: number };
  remaining: { calories: number; protein: number; carbs: number; fat: number };
  todaySessions: { id: number; name: string; completedAt: string | null; durationSec: number; sets: number; volume: number }[];
  activeSession: { id: number; name: string; startedAt: string } | null;
  week: { date: string; calories: number; protein: number; workouts: number; minutes: number }[];
  weeklyWorkouts: number;
  weeklyGoal: number;
  streak: number;
  weightChange: number;
  muscleFocus: { key: string; label: string; sets: number } | null;
  daysSinceWorkout: number | null;
  routineSuggestion: { id: number; name: string; last: string | null; exerciseCount: number; estimatedMin: number } | null;
  headline: string;
  subline: string;
  insights: { kind: string; title: string; body: string }[];
}

export interface Measurement {
  id: number;
  date: string;
  waist: number | null;
  chest: number | null;
  arms: number | null;
  thighs: number | null;
  hips: number | null;
  bodyfat: number | null;
}

export interface ProgressOverview {
  weights: { date: string; weight: number }[];
  measurements: Measurement[];
  stats: {
    currentWeight: number | null;
    startWeight: number | null;
    weightChange: number;
    totalWorkouts: number;
    avgDuration: number;
    personalRecords: number;
    avgCalories: number;
    avgProtein: number;
    loggedDays: number;
    goal: GoalType;
    weeklyFrequency: number;
    heightCm: number | null;
  };
  weeks: { start: string; count: number }[];
  rangeDays: number;
}