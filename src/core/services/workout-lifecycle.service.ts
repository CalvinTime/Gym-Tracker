import type {
  Exercise,
  Workout,
  WorkoutExercise,
  WorkoutSet,
  SetSide,
} from '../models/types.ts';
import type { GymTrackerDB } from '../db/database.ts';
import { Gym80EquipmentService } from './gym80-equipment.service.ts';
import { ProgressionEngine } from './progression-engine.service.ts';
import { generateUUID, currentISO } from '../utils/uuid.ts';

// ── PR flag constants ──────────────────────────────────────────────────

export const PR_WEIGHT     = 'PR_WEIGHT';     // höchstes Gewicht je bei dieser Übung
export const PR_REPS       = 'PR_REPS';       // meiste Reps bei diesem oder höherem Gewicht
export const PR_VOLUME_SET = 'PR_VOLUME_SET'; // höchstes Einzelsatz-Volumen (weight * reps)
export const PR_E1RM       = 'PR_E1RM';       // höchster geschätzter 1RM (Epley)
export const PR_E10RM      = 'PR_E10RM';      // höchster geschätzter 10RM

// ── Interfaces ─────────────────────────────────────────────────────────

export interface CompleteSetInput {
  actual_weight: number;
  actual_reps: number;
  actual_rir: number | null;
  used_micro_addon: boolean;
}

export interface RestTimerInfo {
  /** Übungsspezifische oder typbasierte Soll-Pause in Sekunden. */
  recommendedRestSeconds: number;
  /** ISO-Zeitstempel des letzten abgeschlossenen Satzes (Startpunkt). */
  lastSetCompletedAt: string;
  /** Laufende Stoppuhr: Verstrichene Sekunden seit dem Satz-Abschluss. */
  timeSinceLastSetSeconds: number;
  /** Verbleibender Countdown in Sekunden (recommendedRestSeconds - timeSinceLastSetSeconds). */
  remainingCountdownSeconds: number;
}

export interface StartWorkoutResult {
  workout: Workout;
  workoutExercises: WorkoutExercise[];
  workoutSets: WorkoutSet[];
}

// ── Epley-Formeln ──────────────────────────────────────────────────────

/**
 * Berechnet den geschätzten 1-Rep-Max nach der Epley-Formel.
 * e1RM = weight × (1 + reps / 30)
 * Für reps === 1 wird das Gewicht direkt zurückgegeben.
 */
export function estimateE1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Number((weight * (1 + reps / 30)).toFixed(2));
}

/**
 * Berechnet den geschätzten 10-Rep-Max aus dem e1RM.
 * e10RM = e1RM / (1 + 10/30) = e1RM / 1.3333
 */
export function estimateE10RM(weight: number, reps: number): number {
  const e1rm = estimateE1RM(weight, reps);
  if (e1rm <= 0) return 0;
  return Number((e1rm / (1 + 10 / 30)).toFixed(2));
}

// ── Service ────────────────────────────────────────────────────────────

/**
 * WorkoutLifecycleService
 *
 * Steuert den vollständigen Lebenszyklus eines Workouts:
 * Start → Sätze abhaken (inkl. automatischer PR-Erkennung) → Rest Timer → Abschluss.
 */
export class WorkoutLifecycleService {

  // ───────────────────────────── START WORKOUT ──────────────────────────

  /**
   * Startet ein neues Workout basierend auf einer Routine-Vorlage.
   *
   * - `started_at` bleibt `null` bis der erste Satz tatsächlich abgehakt wird
   *   (verhindert falsche Datumsstempel beim bloßen Anschauen).
   * - Für jede Übung mit `laterality === 'unilateral'` wird pro Satz-Template
   *   automatisch ein Satz für `left` und ein Satz für `right` erzeugt.
   * - Die Zielwerte werden von der ProgressionEngine berechnet und als Snapshot
   *   in `workout_sets` gespeichert.
   */
  static async startWorkout(
    db: GymTrackerDB,
    routineId: string,
    gymProfileId?: string
  ): Promise<StartWorkoutResult> {
    const routine = await db.routine_templates.get(routineId);
    if (!routine) throw new Error(`Routine ${routineId} nicht gefunden.`);

    let profileId = gymProfileId;
    if (!profileId) {
      const defaultProfile = await db.gym_profiles.filter((p) => Boolean(p.is_default)).first();
      profileId = defaultProfile?.id ?? (await db.gym_profiles.toCollection().first())?.id;
    }
    if (!profileId) throw new Error('Kein GymProfile in der Datenbank gefunden.');

    const gymProfile = await db.gym_profiles.get(profileId);
    if (!gymProfile) throw new Error(`GymProfile ${profileId} nicht gefunden.`);

    const routineExercises = await db.routine_exercises
      .where('routine_id').equals(routineId)
      .sortBy('order_index');

    const now = currentISO();
    const workoutId = generateUUID();

    const workout: Workout = {
      id: workoutId,
      routine_id: routineId,
      gym_profile_id: profileId,
      title: routine.name,
      top_note: '',
      started_at: null,       // ← wird erst beim ersten completeSet gesetzt!
      finished_at: null,
      is_deload_session: false,
      created_at: now,
      updated_at: now,
    };

    const workoutExercises: WorkoutExercise[] = [];
    const workoutSets: WorkoutSet[] = [];

    for (const routineEx of routineExercises) {
      const exercise = await db.exercises.get(routineEx.exercise_id);
      if (!exercise) continue;

      const setTemplates = await db.routine_set_templates
        .where('routine_exercise_id').equals(routineEx.id)
        .sortBy('set_index');

      // Berechne Zielwerte über die ProgressionEngine
      const targets = await ProgressionEngine.calculateExerciseSessionTargets({
        db,
        exercise,
        routineExercise: routineEx,
        setTemplates,
        gymProfile,
      });

      const workoutExId = generateUUID();
      const workoutEx: WorkoutExercise = {
        id: workoutExId,
        workout_id: workoutId,
        exercise_id: routineEx.exercise_id,
        order_index: routineEx.order_index,
        superset_group_id: routineEx.superset_group_id,
        session_note: '',
        pause_progression: false,
        created_at: now,
        updated_at: now,
      };
      workoutExercises.push(workoutEx);

      // Sätze erzeugen
      let setNumber = 1;
      for (const target of targets) {
        if (exercise.laterality === 'unilateral') {
          // Pro Template-Satz: einen left und einen right Satz erzeugen
          for (const side of ['left', 'right'] as SetSide[]) {
            workoutSets.push(this.createWorkoutSet({
              workoutExId,
              setNumber: setNumber++,
              side,
              target,
              now,
            }));
          }
        } else {
          workoutSets.push(this.createWorkoutSet({
            workoutExId,
            setNumber: setNumber++,
            side: 'both',
            target,
            now,
          }));
        }
      }
    }

    // Alles in einer Transaktion persistieren
    await db.transaction(
      'rw',
      [db.workouts, db.workout_exercises, db.workout_sets],
      async () => {
        await db.workouts.add(workout);
        await db.workout_exercises.bulkAdd(workoutExercises);
        await db.workout_sets.bulkAdd(workoutSets);
      }
    );

    return { workout, workoutExercises, workoutSets };
  }

  // ──────────────────────────── COMPLETE SET ────────────────────────────

  /**
   * Hakt einen Satz als absolviert ab.
   *
   * - Berechnet `effective_weight_kg` über den `Gym80EquipmentService`.
   * - Überschreibt NIEMALS die Soll-Snapshots (Soll-vs-Ist-Trennung!).
   * - Erkennt sofort neue PRs für Arbeitssätze (nicht Warmup) und setzt `pr_flags`.
   * - Aktualisiert `exercise.best_1rm`, `exercise.best_10rm`, `exercise.max_volume_set`.
   * - Setzt `workout.started_at` beim allerersten abgehakten Satz eines Workouts.
   */
  static async completeSet(
    db: GymTrackerDB,
    setId: string,
    input: CompleteSetInput,
    bodyweightKg: number = 0
  ): Promise<{ updatedSet: WorkoutSet; prFlags: string[] }> {

    const existingSet = await db.workout_sets.get(setId);
    if (!existingSet) throw new Error(`WorkoutSet ${setId} nicht gefunden.`);

    const workoutExercise = await db.workout_exercises.get(existingSet.workout_exercise_id);
    if (!workoutExercise) throw new Error(`WorkoutExercise ${existingSet.workout_exercise_id} nicht gefunden.`);

    const exercise = await db.exercises.get(workoutExercise.exercise_id);
    if (!exercise) throw new Error(`Exercise ${workoutExercise.exercise_id} nicht gefunden.`);

    // effective_weight_kg berechnen
    const effectiveWeight = Gym80EquipmentService.calculateEffectiveLoad(
      input.actual_weight,
      exercise,
      bodyweightKg
    );

    const completedAt = currentISO();
    const prFlags: string[] = [];

    // PR-Erkennung nur für Arbeitssätze (nicht Warmup)
    if (existingSet.set_type !== 'warmup' && input.actual_reps > 0 && effectiveWeight > 0) {
      // Alle bisherigen abgeschlossenen Arbeitssätze dieser Übung laden
      const allExerciseWorkoutExIds = await db.workout_exercises
        .where('exercise_id').equals(workoutExercise.exercise_id)
        .primaryKeys();

      const allPreviousSets = await db.workout_sets
        .where('workout_exercise_id').anyOf(allExerciseWorkoutExIds)
        .filter((s) =>
          s.is_completed &&
          s.set_type !== 'warmup' &&
          s.id !== setId &&
          (s.effective_weight_kg ?? 0) > 0 &&
          (s.actual_reps ?? 0) > 0
        )
        .toArray();

      // 1. PR_WEIGHT: höchstes effektives Gewicht je
      const maxPrevEffWeight = Math.max(0, ...allPreviousSets.map((s) => s.effective_weight_kg ?? 0));
      if (effectiveWeight > maxPrevEffWeight) {
        prFlags.push(PR_WEIGHT);
      }

      // 2. PR_REPS: meiste Reps bei diesem oder höherem Gewicht
      const setsAtSameOrHigherWeight = allPreviousSets.filter(
        (s) => (s.effective_weight_kg ?? 0) >= effectiveWeight - 0.01
      );
      const maxPrevRepsAtWeight = Math.max(0, ...setsAtSameOrHigherWeight.map((s) => s.actual_reps ?? 0));
      if (input.actual_reps > maxPrevRepsAtWeight) {
        prFlags.push(PR_REPS);
      }

      // 3. PR_VOLUME_SET: höchstes Satzvolumen (effectiveWeight × reps)
      const currentVolume = effectiveWeight * input.actual_reps;
      const maxPrevVolume = Math.max(0, ...allPreviousSets.map(
        (s) => (s.effective_weight_kg ?? 0) * (s.actual_reps ?? 0)
      ));
      if (currentVolume > maxPrevVolume) {
        prFlags.push(PR_VOLUME_SET);
      }

      // 4. PR_E1RM
      const currentE1RM = estimateE1RM(effectiveWeight, input.actual_reps);
      const maxPrevE1RM = Math.max(0, ...allPreviousSets.map(
        (s) => estimateE1RM(s.effective_weight_kg ?? 0, s.actual_reps ?? 0)
      ));
      if (currentE1RM > maxPrevE1RM) {
        prFlags.push(PR_E1RM);
      }

      // 5. PR_E10RM
      const currentE10RM = estimateE10RM(effectiveWeight, input.actual_reps);
      const maxPrevE10RM = Math.max(0, ...allPreviousSets.map(
        (s) => estimateE10RM(s.effective_weight_kg ?? 0, s.actual_reps ?? 0)
      ));
      if (currentE10RM > maxPrevE10RM) {
        prFlags.push(PR_E10RM);
      }

      // Übungs-Metadaten aktualisieren
      const updatedExFields: Partial<Exercise> = { updated_at: completedAt };
      if (currentE1RM > (exercise.best_1rm ?? 0)) {
        updatedExFields.best_1rm = currentE1RM;
      }
      if (currentE10RM > (exercise.best_10rm ?? 0)) {
        updatedExFields.best_10rm = currentE10RM;
      }
      if (currentVolume > (exercise.max_volume_set ?? 0)) {
        updatedExFields.max_volume_set = currentVolume;
      }
      if (Object.keys(updatedExFields).length > 1) {
        await db.exercises.update(exercise.id, updatedExFields);
      }
    }

    // Set aktualisieren (Ist-Werte, NIEMALS Soll-Snapshots überschreiben!)
    const updatedSet: WorkoutSet = {
      ...existingSet,
      actual_weight: input.actual_weight,
      effective_weight_kg: effectiveWeight,
      actual_reps: input.actual_reps,
      actual_rir: input.actual_rir,
      used_micro_addon: input.used_micro_addon,
      is_completed: true,
      completed_at: completedAt,
      pr_flags: prFlags,
      updated_at: completedAt,
    };

    await db.workout_sets.put(updatedSet);

    // Beim allerersten abgehakten Satz: started_at auf dem Workout setzen
    const workout = await db.workouts.get(workoutExercise.workout_id);
    if (workout && !workout.started_at) {
      await db.workouts.update(workout.id, {
        started_at: completedAt,
        updated_at: completedAt,
      });
    }

    return { updatedSet, prFlags };
  }

  // ────────────────────────── FINISH WORKOUT ────────────────────────────

  /**
   * Beendet ein Workout und setzt `finished_at`.
   */
  static async finishWorkout(db: GymTrackerDB, workoutId: string): Promise<Workout> {
    const workout = await db.workouts.get(workoutId);
    if (!workout) throw new Error(`Workout ${workoutId} nicht gefunden.`);

    const now = currentISO();
    await db.workouts.update(workoutId, {
      finished_at: now,
      updated_at: now,
    });

    return { ...workout, finished_at: now, updated_at: now };
  }

  // ──────────────────────────── REST TIMER ──────────────────────────────

  /**
   * Berechnet die empfohlene Pause (Countdown) und den Zeitstempel des letzten
   * abgeschlossenen Satzes (Stoppuhr-Startpunkt).
   *
   * Pausenlogik:
   * - `exercise.custom_rest_seconds` hat höchste Priorität.
   * - Sonst: compound = 180s, isolation = 90s (Richtwerte).
   */
  static async getRestTimerInfo(
    db: GymTrackerDB,
    workoutId: string,
    lastCompletedSetId: string,
    currentTime: string | Date = new Date()
  ): Promise<RestTimerInfo | null> {

    const lastSet = await db.workout_sets.get(lastCompletedSetId);
    if (!lastSet || !lastSet.completed_at) return null;

    const workoutExercise = await db.workout_exercises.get(lastSet.workout_exercise_id);
    if (!workoutExercise) return null;

    const exercise = await db.exercises.get(workoutExercise.exercise_id);
    if (!exercise) return null;

    // Routine-Übung laden (falls vorhanden) für rest_seconds override
    const workout = await db.workouts.get(workoutId);
    let routineRestSeconds: number | null = null;
    if (workout?.routine_id) {
      const routineExercises = await db.routine_exercises
        .where('routine_id').equals(workout.routine_id)
        .filter((re) => re.exercise_id === exercise.id)
        .toArray();
      if (routineExercises.length > 0) {
        routineRestSeconds = routineExercises[0].rest_seconds;
      }
    }

    // Priorität: exercise.custom_rest_seconds > routine_exercise.rest_seconds > Typ-Default
    let recommendedRestSeconds: number;

    if (exercise.custom_rest_seconds != null && exercise.custom_rest_seconds > 0) {
      recommendedRestSeconds = exercise.custom_rest_seconds;
    } else if (routineRestSeconds != null && routineRestSeconds > 0) {
      recommendedRestSeconds = routineRestSeconds;
    } else {
      recommendedRestSeconds = exercise.movement_type === 'compound' ? 180 : 90;
    }

    const completedAtMs = new Date(lastSet.completed_at).getTime();
    const currentMs = (currentTime instanceof Date ? currentTime : new Date(currentTime)).getTime();
    const timeSinceLastSetSeconds = Math.max(0, Math.floor((currentMs - completedAtMs) / 1000));
    const remainingCountdownSeconds = recommendedRestSeconds - timeSinceLastSetSeconds;

    return {
      recommendedRestSeconds,
      lastSetCompletedAt: lastSet.completed_at,
      timeSinceLastSetSeconds,
      remainingCountdownSeconds,
    };
  }

  // ──────────────────────────── PRIVAT ──────────────────────────────────

  private static createWorkoutSet(params: {
    workoutExId: string;
    setNumber: number;
    side: SetSide;
    target: { set_type: string; target_weight_snapshot: number | null; target_reps_min_snapshot: number | null; target_reps_max_snapshot: number | null; target_rir_snapshot: number | null };
    now: string;
  }): WorkoutSet {
    const { workoutExId, setNumber, side, target, now } = params;
    return {
      id: generateUUID(),
      workout_exercise_id: workoutExId,
      set_number: setNumber,
      side,
      set_type: target.set_type as WorkoutSet['set_type'],
      target_weight_snapshot: target.target_weight_snapshot,
      target_reps_min_snapshot: target.target_reps_min_snapshot,
      target_reps_max_snapshot: target.target_reps_max_snapshot,
      target_rir_snapshot: target.target_rir_snapshot,
      actual_weight: null,
      effective_weight_kg: null,
      actual_reps: null,
      actual_rir: null,
      used_micro_addon: false,
      is_completed: false,
      completed_at: null,
      pr_flags: [],
      created_at: now,
      updated_at: now,
    };
  }
}
