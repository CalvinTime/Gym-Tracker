import type { GymTrackerDB } from './database.ts';
import {
  SEED_GYM_PROFILE,
  SEED_MUSCLES,
  SEED_EXERCISES_DATA,
  SEED_GYM_PROFILE_ID,
  SEED_SAMPLE_ROUTINES,
} from './seed-data.ts';
import type { ExerciseMuscle } from '../models/types.ts';
import { currentISO } from '../utils/uuid.ts';

export interface SeedOptions {
  force?: boolean;
}

export interface SeedResult {
  seeded: boolean;
  profileCreated: boolean;
  musclesCount: number;
  exercisesCount: number;
  exerciseMusclesCount: number;
}

/**
 * Initialisiert die Datenbank mit dem McFit gym80 Profil, allen Muskelgruppen
 * und den 25 Standardübungen.
 * Verhält sich standardmäßig idempotent (führt keine Duplikate ein).
 */
export async function seedDatabase(
  db: GymTrackerDB,
  options: SeedOptions = {}
): Promise<SeedResult> {
  const { force = false } = options;

  return await db.transaction(
    'rw',
    [
      db.gym_profiles,
      db.muscles,
      db.exercises,
      db.exercise_muscles,
      db.routine_templates,
      db.routine_exercises,
      db.routine_set_templates,
    ],
    async () => {
      let profileCreated = false;
      const existingProfile = await db.gym_profiles.get(SEED_GYM_PROFILE_ID);
      const hasDefault = existingProfile || (await db.gym_profiles.filter((p) => Boolean(p.is_default)).first());

      // 1. Gym Profile einfügen / aktualisieren falls fehlt
      if (!hasDefault || force) {
        await db.gym_profiles.put({
          ...SEED_GYM_PROFILE,
          updated_at: currentISO(),
        });
        profileCreated = true;
      }

      // 2. Muskelgruppen einfügen falls fehlen
      const musclesCountInitial = await db.muscles.count();
      if (musclesCountInitial === 0 || force) {
        await db.muscles.bulkPut(SEED_MUSCLES);
      }

      // 3. Übungen & Muskel-Beziehungen einfügen falls fehlen
      const exercisesCountInitial = await db.exercises.count();
      if (exercisesCountInitial === 0 || force) {
        const exercisesToPut = SEED_EXERCISES_DATA.map((item) => item.exercise);
        await db.exercises.bulkPut(exercisesToPut);

        const exerciseMusclesToPut: ExerciseMuscle[] = [];
        for (const item of SEED_EXERCISES_DATA) {
          for (const m of item.muscles) {
            const relationId = `rel-${item.exercise.id.slice(-8)}-${m.muscle_id}`;
            exerciseMusclesToPut.push({
              id: relationId,
              exercise_id: item.exercise.id,
              muscle_id: m.muscle_id,
              role: m.role,
              volume_weight: m.volume_weight,
              created_at: item.exercise.created_at,
              updated_at: currentISO(),
            });
          }
        }
        await db.exercise_muscles.bulkPut(exerciseMusclesToPut);
      }

      // 4. Vordefinierte McFit gym80 Beispiel-Routinen (Push / Pull / Legs) falls fehlen
      const existingRoutinesCount = await db.routine_templates.count();
      if (existingRoutinesCount === 0 || force) {
        for (const sample of SEED_SAMPLE_ROUTINES) {
          await db.routine_templates.put(sample.routine);
          for (const ex of sample.exercises) {
            const reId = `re-${sample.routine.id}-${ex.order_index}`;
            await db.routine_exercises.put({
              id: reId,
              routine_id: sample.routine.id,
              exercise_id: ex.exercise_id,
              order_index: ex.order_index,
              superset_group_id: null,
              rest_seconds: ex.rest_seconds,
              progression_rule: ex.progression_rule,
              created_at: sample.routine.created_at,
              updated_at: currentISO(),
            });
            for (const st of ex.sets) {
              const stId = `st-${reId}-${st.set_index}`;
              await db.routine_set_templates.put({
                id: stId,
                routine_exercise_id: reId,
                set_index: st.set_index,
                set_type: st.set_type,
                target_reps_min: st.target_reps_min,
                target_reps_max: st.target_reps_max,
                target_weight_stack: st.target_weight_stack,
                target_rir: st.target_rir,
                created_at: sample.routine.created_at,
                updated_at: currentISO(),
              });
            }
          }
        }
      }

      const musclesCount = await db.muscles.count();
      const exercisesCount = await db.exercises.count();
      const exerciseMusclesCount = await db.exercise_muscles.count();

      return {
        seeded: profileCreated || existingRoutinesCount === 0,
        profileCreated,
        musclesCount,
        exercisesCount,
        exerciseMusclesCount,
      };
    }
  );
}
