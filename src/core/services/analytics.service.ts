import type {
  WorkoutSet,
} from '../models/types.ts';
import type { GymTrackerDB } from '../db/database.ts';
import { estimateE1RM, estimateE10RM } from './workout-lifecycle.service.ts';

// ── Interfaces ─────────────────────────────────────────────────────────

export interface MuscleVolumeEntry {
  muscle_id: string;
  muscle_name_de: string;
  muscle_group: string;
  /** Anzahl gewichteter Arbeitssätze (z.B. 12.0 direkt oder 8.5 fraktional). */
  weighted_sets: number;
}

export type VolumeMode = 'direct' | 'fractional';

export interface ExerciseHistoryPoint {
  date: string;         // ISO date (YYYY-MM-DD)
  value: number;
  reps?: number;
  weight?: number;
}

export type HistoryMetric = 'e10rm' | 'e1rm' | 'stack_weight' | 'effective_weight';

// ── Service ────────────────────────────────────────────────────────────

/**
 * AnalyticsService
 *
 * Berechnet Trainings-Analysen und Volumen-Aggregationen
 * ausschließlich auf Basis der lokalen IndexedDB-Daten.
 */
export class AnalyticsService {

  /**
   * Aggregiert die absolvierten Arbeitssätze (ohne Warm-up!) pro Muskelgruppe
   * innerhalb eines Zeitraums.
   *
   * Modi:
   * - `direct`:     Nur der Primärmuskel (volume_weight = 1.0) wird gezählt.
   *                 Sinnvoll für "harte Sätze pro Muskel".
   * - `fractional`: Alle Muskeln werden gewichtet gezählt
   *                 (Primär 1.0, Sekundär 0.5, Tertiär 0.25).
   *                 Sinnvoll für die Gesamtbelastungsanalyse.
   */
  static async getWeeklyMuscleVolume(
    db: GymTrackerDB,
    startDate: string,
    endDate: string,
    mode: VolumeMode = 'direct'
  ): Promise<MuscleVolumeEntry[]> {

    // 1. Alle Workouts im Zeitraum finden (abgeschlossen, mit started_at / created_at)
    const startISO = startDate.includes('T') ? startDate : `${startDate}T00:00:00.000Z`;
    const endISO = endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`;

    const workouts = await db.workouts
      .filter((w) => {
        if (!w.finished_at) return false;
        const d = w.started_at || w.created_at;
        return Boolean(d && d >= startISO && d <= endISO);
      })
      .toArray();

    if (workouts.length === 0) return [];

    const workoutIds = workouts.map((w) => w.id);

    // 2. Alle WorkoutExercises dieser Workouts
    const workoutExercises = await db.workout_exercises
      .where('workout_id').anyOf(workoutIds)
      .toArray();

    const workoutExIds = workoutExercises.map((we) => we.id);

    // 3. Alle abgeschlossenen Arbeitssätze (NICHT warmup!)
    const workingSets = await db.workout_sets
      .where('workout_exercise_id').anyOf(workoutExIds)
      .filter((s) => s.is_completed && s.set_type !== 'warmup')
      .toArray();

    // 4. Gruppiere Sets nach exercise_id
    const weIdToExerciseId = new Map(workoutExercises.map((we) => [we.id, we.exercise_id]));
    const exerciseSetCounts = new Map<string, number>();

    for (const set of workingSets) {
      const exerciseId = weIdToExerciseId.get(set.workout_exercise_id);
      if (!exerciseId) continue;
      exerciseSetCounts.set(exerciseId, (exerciseSetCounts.get(exerciseId) || 0) + 1);
    }

    // 5. Alle beteiligten exercise_muscles laden
    const exerciseIds = [...exerciseSetCounts.keys()];
    const exerciseMuscles = await db.exercise_muscles
      .where('exercise_id').anyOf(exerciseIds)
      .toArray();

    // 6. Muskel-Volumen berechnen
    const muscleVolumes = new Map<string, number>();

    for (const em of exerciseMuscles) {
      const setCount = exerciseSetCounts.get(em.exercise_id) || 0;
      if (setCount === 0) continue;

      let contribution: number;
      if (mode === 'direct') {
        // Nur Primärmuskel zählt
        if (em.role !== 'primary') continue;
        contribution = setCount * 1.0;
      } else {
        // Fraktional: gewichtet nach volume_weight
        contribution = setCount * em.volume_weight;
      }

      muscleVolumes.set(em.muscle_id, (muscleVolumes.get(em.muscle_id) || 0) + contribution);
    }

    // 7. Muskeldaten anreichern
    const muscleIds = [...muscleVolumes.keys()];
    const muscles = await db.muscles.bulkGet(muscleIds);

    const result: MuscleVolumeEntry[] = [];
    for (const [muscleId, weightedSets] of muscleVolumes.entries()) {
      const muscle = muscles.find((m) => m?.id === muscleId);
      result.push({
        muscle_id: muscleId,
        muscle_name_de: muscle?.name_de || muscleId,
        muscle_group: muscle?.muscle_group || 'Unbekannt',
        weighted_sets: Number(weightedSets.toFixed(2)),
      });
    }

    // Nach weighted_sets absteigend sortieren
    result.sort((a, b) => b.weighted_sets - a.weighted_sets);
    return result;
  }

  /**
   * Gibt eine kalenderproportionale Zeitreihe für eine Übung zurück.
   *
   * Metriken:
   * - `e1rm`:             Geschätzter 1-Rep-Max pro Session (bester Arbeitssatz).
   * - `e10rm`:            Geschätzter 10-Rep-Max pro Session.
   * - `stack_weight`:     Höchstes gestecktes/abgelesenes Gewicht (actual_weight) pro Session.
   * - `effective_weight`: Höchstes effektives Gewicht pro Session.
   */
  static async getExerciseHistoryChart(
    db: GymTrackerDB,
    exerciseId: string,
    metric: HistoryMetric = 'e1rm'
  ): Promise<ExerciseHistoryPoint[]> {

    // 1. Alle WorkoutExercises für diese Übung
    const workoutExercises = await db.workout_exercises
      .where('exercise_id').equals(exerciseId)
      .toArray();

    if (workoutExercises.length === 0) return [];

    // 2. Zugehörige Workouts laden (nur abgeschlossene)
    const workoutIds = [...new Set(workoutExercises.map((we) => we.workout_id))];
    const workouts = await db.workouts.bulkGet(workoutIds);

    const validWorkoutMap = new Map(
      workouts
        .filter((w) => w !== undefined && Boolean(w.finished_at))
        .map((w) => [w!.id, w!])
    );

    // 3. Alle abgeschlossenen Arbeitssätze der gefundenen WorkoutExercises
    const weIds = workoutExercises
      .filter((we) => validWorkoutMap.has(we.workout_id))
      .map((we) => we.id);

    const allSets = await db.workout_sets
      .where('workout_exercise_id').anyOf(weIds)
      .filter((s) => s.is_completed && s.set_type !== 'warmup')
      .toArray();

    // 4. Sets nach Workout-Datum gruppieren
    const weIdToWorkoutId = new Map(workoutExercises.map((we) => [we.id, we.workout_id]));

    interface SessionData {
      date: string;
      sets: WorkoutSet[];
    }
    const sessionMap = new Map<string, SessionData>();

    for (const set of allSets) {
      const workoutId = weIdToWorkoutId.get(set.workout_exercise_id);
      if (!workoutId) continue;
      const workout = validWorkoutMap.get(workoutId);
      if (!workout) continue;

      const dateStr = (workout.started_at || workout.created_at).slice(0, 10); // YYYY-MM-DD
      if (!sessionMap.has(workoutId)) {
        sessionMap.set(workoutId, { date: dateStr, sets: [] });
      }
      sessionMap.get(workoutId)!.sets.push(set);
    }

    // 5. Pro Session den besten Wert berechnen
    const points: ExerciseHistoryPoint[] = [];

    for (const [, session] of sessionMap) {
      let bestValue = 0;
      let bestReps = 0;
      let bestWeight = 0;

      for (const set of session.sets) {
        const ew = set.effective_weight_kg ?? 0;
        const reps = set.actual_reps ?? 0;
        const aw = set.actual_weight ?? 0;
        if (ew <= 0 || reps <= 0) continue;

        let value: number;
        switch (metric) {
          case 'e1rm':
            value = estimateE1RM(ew, reps);
            break;
          case 'e10rm':
            value = estimateE10RM(ew, reps);
            break;
          case 'stack_weight':
            value = aw;
            break;
          case 'effective_weight':
            value = ew;
            break;
        }

        if (value > bestValue) {
          bestValue = value;
          bestReps = reps;
          bestWeight = aw;
        }
      }

      if (bestValue > 0) {
        points.push({
          date: session.date,
          value: Number(bestValue.toFixed(2)),
          reps: bestReps,
          weight: bestWeight,
        });
      }
    }

    // Chronologisch sortieren
    points.sort((a, b) => a.date.localeCompare(b.date));
    return points;
  }
}
