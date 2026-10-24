export type TrackingType =
  | 'weight_reps'
  | 'bodyweight_reps'
  | 'assisted_bodyweight'
  | 'duration_seconds';

export type EquipmentType =
  | 'barbell'
  | 'dumbbell'
  | 'cable_stack'
  | 'machine_stack'
  | 'plate_loaded'
  | 'bodyweight';

export type MovementType = 'compound' | 'isolation';

export type Laterality = 'bilateral' | 'unilateral';

export type MuscleRole = 'primary' | 'secondary' | 'tertiary';

export type VolumeWeight = 1.0 | 0.5 | 0.25;

export type ProgressionType = 'double_progression' | 'linear' | 'none';

export interface ProgressionRule {
  type: ProgressionType;
  rep_range: [number, number];
  target_rir: number;
  deload_after_fails: number;
}

export type SetType = 'warmup' | 'working' | 'drop' | 'failure';

export type SetSide = 'both' | 'left' | 'right';

export interface GymProfile {
  id: string;
  name: string;
  is_default: boolean;
  available_plates_kg: number[];
  barbell_options_kg: number[];
  dumbbell_list_kg: number[];
  stack_increment_kg: number;
  stack_micro_addon_kg: number;
  created_at: string;
  updated_at: string;
}

export interface Muscle {
  id: string; // e.g. 'chest_upper', 'delts_side'
  name_de: string;
  muscle_group: string;
  created_at: string;
  updated_at: string;
}

export interface Exercise {
  id: string;
  name: string;
  tracking_type: TrackingType;
  equipment_type: EquipmentType;
  movement_type: MovementType;
  laterality: Laterality;
  pulley_ratio: number; // e.g. 0.5 for 1:2 pulley tower, 1.0 for 1:1 lat pulldown
  default_bar_or_sled_weight_kg: number; // e.g. 20 for barbell, 50 for 45 deg leg press
  bodyweight_factor: number; // e.g. 1.0 for pullups
  pinned_setup_note: string; // e.g. "Sitzhöhe auf 4, Rolle auf 8"
  custom_rest_seconds: number | null;
  best_1rm: number | null;
  best_10rm: number | null;
  max_volume_set: number | null;
  created_at: string;
  updated_at: string;
}

export interface ExerciseMuscle {
  id: string;
  exercise_id: string;
  muscle_id: string;
  role: MuscleRole;
  volume_weight: VolumeWeight;
  created_at: string;
  updated_at: string;
}

export interface RoutineTemplate {
  id: string;
  name: string;
  split_category: string;
  order_index: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoutineExercise {
  id: string;
  routine_id: string;
  exercise_id: string;
  order_index: number;
  superset_group_id: number | null;
  rest_seconds: number;
  progression_rule: ProgressionRule;
  created_at: string;
  updated_at: string;
}

export interface RoutineSetTemplate {
  id: string;
  routine_exercise_id: string;
  set_index: number;
  set_type: 'warmup' | 'working' | 'drop';
  target_reps_min: number;
  target_reps_max: number;
  target_weight_stack: number | null;
  target_rir: number | null;
  created_at: string;
  updated_at: string;
}

export interface Workout {
  id: string;
  routine_id: string | null;
  gym_profile_id: string;
  title: string;
  top_note: string;
  started_at: string | null;
  finished_at: string | null;
  is_deload_session: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkoutExercise {
  id: string;
  workout_id: string;
  exercise_id: string;
  order_index: number;
  superset_group_id: number | null;
  session_note: string;
  pause_progression: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkoutSet {
  id: string;
  workout_exercise_id: string;
  set_number: number;
  side: SetSide;
  set_type: SetType;
  target_weight_snapshot: number | null;
  target_reps_min_snapshot: number | null;
  target_reps_max_snapshot: number | null;
  target_rir_snapshot: number | null;
  actual_weight: number | null; // gestecktes/abgelesenes Gewicht
  effective_weight_kg: number | null; // berechnetes tatsächliches Lastgewicht
  actual_reps: number | null;
  actual_rir: number | null;
  used_micro_addon: boolean;
  is_completed: boolean;
  completed_at: string | null;
  pr_flags: string[];
  created_at: string;
  updated_at: string;
}

export interface BodyMeasurement {
  id: string;
  recorded_at: string; // YYYY-MM-DD
  bodyweight_kg: number;
  bodyfat_pct: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
