import Dexie, { type EntityTable } from 'dexie';
import type {
  GymProfile,
  Muscle,
  Exercise,
  ExerciseMuscle,
  RoutineTemplate,
  RoutineExercise,
  RoutineSetTemplate,
  Workout,
  WorkoutExercise,
  WorkoutSet,
  BodyMeasurement,
} from '../models/types.ts';

export class GymTrackerDB extends Dexie {
  gym_profiles!: EntityTable<GymProfile, 'id'>;
  muscles!: EntityTable<Muscle, 'id'>;
  exercises!: EntityTable<Exercise, 'id'>;
  exercise_muscles!: EntityTable<ExerciseMuscle, 'id'>;
  routine_templates!: EntityTable<RoutineTemplate, 'id'>;
  routine_exercises!: EntityTable<RoutineExercise, 'id'>;
  routine_set_templates!: EntityTable<RoutineSetTemplate, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  workout_exercises!: EntityTable<WorkoutExercise, 'id'>;
  workout_sets!: EntityTable<WorkoutSet, 'id'>;
  body_measurements!: EntityTable<BodyMeasurement, 'id'>;

  constructor(dbName = 'gym_tracker_db') {
    super(dbName);

    this.version(1).stores({
      gym_profiles: 'id, name, is_default, created_at',
      muscles: 'id, muscle_group, name_de',
      exercises: 'id, name, equipment_type, movement_type, tracking_type',
      exercise_muscles: 'id, exercise_id, muscle_id, role, [exercise_id+muscle_id]',
      routine_templates: 'id, name, split_category, order_index, is_archived',
      routine_exercises: 'id, routine_id, exercise_id, order_index',
      routine_set_templates: 'id, routine_exercise_id, set_index',
      workouts: 'id, routine_id, gym_profile_id, started_at, finished_at',
      workout_exercises: 'id, workout_id, exercise_id, order_index',
      workout_sets: 'id, workout_exercise_id, set_number, is_completed',
      body_measurements: 'id, recorded_at',
    });
  }
}

// Singleton-Instanz für die App-Laufzeit
export const db = new GymTrackerDB();
