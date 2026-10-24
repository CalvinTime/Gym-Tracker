import type {
  Exercise,
  GymProfile,
  RoutineExercise,
  RoutineSetTemplate,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '../models/types.ts';
import type { GymTrackerDB } from '../db/database.ts';
import { Gym80EquipmentService } from './gym80-equipment.service.ts';

export interface SetTargetSnapshot {
  set_index: number;
  set_type: 'warmup' | 'working' | 'drop';
  target_weight_snapshot: number | null;
  target_reps_min_snapshot: number | null;
  target_reps_max_snapshot: number | null;
  target_rir_snapshot: number | null;
  progression_note?: string;
}

export interface ValidExerciseHistory {
  workout: Workout;
  workoutExercise: WorkoutExercise;
  workingSets: WorkoutSet[];
}

/**
 * ProgressionEngine:
 * Berechnet automatisierte Sollwerte für jedes Workout basierend auf
 * Double Progression, Recovery-Schutz (Tagesform-Filter) und Dropset-Automatik.
 */
export class ProgressionEngine {
  /**
   * Sucht in der Dexie-Datenbank nach der letzten gültigen abgeschlossenen Trainingseinheit
   * für die übergebene Übung.
   *
   * Recovery- & Tagesform-Schutz:
   * Einheiten werden ignoriert, wenn:
   * - workout_exercise.pause_progression === true (Nutzer war müde/angeschlagen)
   * - workout.is_deload_session === true (Regenerations-Woche)
   * - workout.finished_at === null (nicht beendete Sessions)
   */
  static async findLastValidSession(
    db: GymTrackerDB,
    exerciseId: string
  ): Promise<ValidExerciseHistory | null> {
    // 1. Alle WorkoutExercises für diese Übung finden, bei denen pause_progression false war
    const matchingWorkoutExercises = await db.workout_exercises
      .where('exercise_id')
      .equals(exerciseId)
      .filter((we) => !we.pause_progression)
      .toArray();

    if (matchingWorkoutExercises.length === 0) {
      return null;
    }

    // 2. Zugehörige Workouts laden
    const workoutIds = [...new Set(matchingWorkoutExercises.map((we) => we.workout_id))];
    const workouts = await db.workouts.bulkGet(workoutIds);

    // 3. Filtern nach: abgeschlossen (finished_at !== null) und KEIN Deload
    const validWorkouts = workouts
      .filter((w): w is Workout => w !== undefined && Boolean(w.finished_at) && !w.is_deload_session)
      .sort((a, b) => {
        const timeA = new Date(a.finished_at || a.started_at || 0).getTime();
        const timeB = new Date(b.finished_at || b.started_at || 0).getTime();
        return timeB - timeA; // Neueste Session zuerst
      });

    if (validWorkouts.length === 0) {
      return null;
    }

    const latestWorkout = validWorkouts[0];
    const latestWorkoutEx = matchingWorkoutExercises.find((we) => we.workout_id === latestWorkout.id);
    if (!latestWorkoutEx) return null;

    // 4. Abgeschlossene Arbeitssätze laden
    const sets = await db.workout_sets
      .where('workout_exercise_id')
      .equals(latestWorkoutEx.id)
      .filter((s) => s.is_completed && s.set_type === 'working')
      .sortBy('set_number');

    return {
      workout: latestWorkout,
      workoutExercise: latestWorkoutEx,
      workingSets: sets,
    };
  }

  /**
   * Berechnet die heutigen Zielwerte für alle Satz-Templates einer Routine-Übung.
   */
  static calculateTargetsForSets(params: {
    exercise: Exercise;
    routineExercise: RoutineExercise;
    setTemplates: RoutineSetTemplate[];
    gymProfile: GymProfile;
    lastValidSession: ValidExerciseHistory | null;
  }): SetTargetSnapshot[] {
    const { exercise, routineExercise, setTemplates, gymProfile, lastValidSession } = params;

    const repRange = routineExercise.progression_rule?.rep_range || [8, 12];
    const minReps = repRange[0];
    const maxReps = repRange[1];
    const targetRir = routineExercise.progression_rule?.target_rir ?? 1;

    const prevWorkingSets = lastValidSession?.workingSets || [];

    // Prüfe Double-Progression-Kriterium:
    // Wurde in ALLEN Arbeitssätzen die Obergrenze (maxReps) erreicht und war actual_rir >= targetRir?
    const hasPreviousWorkingSets = prevWorkingSets.length > 0;
    const allSetsHitMaxReps =
      hasPreviousWorkingSets &&
      prevWorkingSets.every((s) => {
        const repsHit = (s.actual_reps ?? 0) >= maxReps;
        const rirSatisfied = s.actual_rir === null || s.actual_rir === undefined || s.actual_rir >= targetRir;
        return repsHit && rirSatisfied;
      });

    // Bisheriges Arbeitsgewicht
    const lastWorkingWeight =
      prevWorkingSets[0]?.actual_weight ??
      prevWorkingSets[0]?.target_weight_snapshot ??
      null;

    let targetWorkingWeight: number | null = null;
    let isWeightIncreased = false;

    if (allSetsHitMaxReps && lastWorkingWeight !== null) {
      // Steigerung auf nächsthöhere McFit-Stufe!
      targetWorkingWeight = Gym80EquipmentService.getNextAvailableWeight(
        lastWorkingWeight,
        exercise,
        gymProfile,
        'up'
      );
      isWeightIncreased = true;
    } else if (lastWorkingWeight !== null) {
      // Gewicht bleibt gleich
      targetWorkingWeight = lastWorkingWeight;
    }

    // Sortiere Templates nach set_index
    const sortedTemplates = [...setTemplates].sort((a, b) => a.set_index - b.set_index);
    const snapshots: SetTargetSnapshot[] = [];

    let workingSetCounter = 0;
    let latestWorkingWeight: number | null = targetWorkingWeight;

    for (const template of sortedTemplates) {
      if (template.set_type === 'working') {
        const currentWorkingIndex = workingSetCounter++;

        if (targetWorkingWeight === null) {
          const fallbackWeight = template.target_weight_stack;
          if (fallbackWeight !== null && fallbackWeight !== undefined) {
            latestWorkingWeight = fallbackWeight;
          }

          // Keine Historie vorhanden -> Template-Werte nutzen
          snapshots.push({
            set_index: template.set_index,
            set_type: 'working',
            target_weight_snapshot: fallbackWeight,
            target_reps_min_snapshot: template.target_reps_min || minReps,
            target_reps_max_snapshot: template.target_reps_max || maxReps,
            target_rir_snapshot: template.target_rir ?? targetRir,
            progression_note: 'Basis-Einstieg aus Routine-Vorlage',
          });
          continue;
        }

        if (isWeightIncreased) {
          latestWorkingWeight = targetWorkingWeight;
          // Gewicht erhöht -> Reps werden auf minReps zurückgesetzt
          snapshots.push({
            set_index: template.set_index,
            set_type: 'working',
            target_weight_snapshot: targetWorkingWeight,
            target_reps_min_snapshot: minReps,
            target_reps_max_snapshot: maxReps,
            target_rir_snapshot: targetRir,
            progression_note: `Gewicht gesteigert (+${Number((targetWorkingWeight - (lastWorkingWeight || 0)).toFixed(2))} kg)! Neues Rep-Ziel: ${minReps}`,
          });
        } else {
          latestWorkingWeight = targetWorkingWeight;
          // Gewicht bleibt gleich -> Reps um +1 über letzter Leistung
          const prevSet = prevWorkingSets[currentWorkingIndex];
          let nextTargetReps: number;

          if (prevSet && prevSet.actual_reps != null) {
            nextTargetReps = Math.min(maxReps, prevSet.actual_reps + 1);
          } else {
            nextTargetReps = minReps;
          }

          snapshots.push({
            set_index: template.set_index,
            set_type: 'working',
            target_weight_snapshot: targetWorkingWeight,
            target_reps_min_snapshot: nextTargetReps,
            target_reps_max_snapshot: maxReps,
            target_rir_snapshot: targetRir,
            progression_note: prevSet?.actual_reps != null
              ? `Letztes Mal ${prevSet.actual_reps} Wdh. -> Heute Ziel: ${nextTargetReps} Wdh.`
              : `Ziel: ${nextTargetReps} Wdh.`,
          });
        }
      } else if (template.set_type === 'drop') {
        // Dropset-Automatik: ~20-25% reduziertes Gewicht bezogen auf das vorangegangene Arbeitsgewicht
        const baseWeight = latestWorkingWeight ?? template.target_weight_stack ?? 20;
        const dropWeight = Gym80EquipmentService.calculateDropSetWeight(
          baseWeight,
          exercise,
          gymProfile
        );

        snapshots.push({
          set_index: template.set_index,
          set_type: 'drop',
          target_weight_snapshot: dropWeight,
          target_reps_min_snapshot: template.target_reps_min || minReps,
          target_reps_max_snapshot: template.target_reps_max || maxReps,
          target_rir_snapshot: 0, // Dropsatz wird bis zum Muskelversagen ausgeführt
          progression_note: `Dropset: ca. 20-25% Reduktion auf ${dropWeight} kg`,
        });
      } else if (template.set_type === 'warmup') {
        // Aufwärmsatz
        let warmupWeight = template.target_weight_stack;
        if (warmupWeight === null && targetWorkingWeight !== null) {
          // Progressiver Warmup-Vorschlag: ca. 50-60% des Arbeitsgewichts
          const rawWarmup = targetWorkingWeight * 0.55;
          warmupWeight = Gym80EquipmentService.snapToValidWeight(rawWarmup, exercise, gymProfile);
        }

        snapshots.push({
          set_index: template.set_index,
          set_type: 'warmup',
          target_weight_snapshot: warmupWeight,
          target_reps_min_snapshot: template.target_reps_min || 10,
          target_reps_max_snapshot: template.target_reps_max || 15,
          target_rir_snapshot: 3,
          progression_note: 'Aufwärmsatz (Fokus auf Gelenke & Bewegungsbahn)',
        });
      }
    }

    return snapshots;
  }

  /**
   * Bequeme End-to-End-Methode zur direkten Berechnung der Satz-Sollwerte
   * unter Auslesung der IndexedDB-Historie.
   */
  static async calculateExerciseSessionTargets(params: {
    db: GymTrackerDB;
    exercise: Exercise;
    routineExercise: RoutineExercise;
    setTemplates: RoutineSetTemplate[];
    gymProfile: GymProfile;
  }): Promise<SetTargetSnapshot[]> {
    const { db, exercise, routineExercise, setTemplates, gymProfile } = params;

    const lastValidSession = await this.findLastValidSession(db, exercise.id);

    return this.calculateTargetsForSets({
      exercise,
      routineExercise,
      setTemplates,
      gymProfile,
      lastValidSession,
    });
  }
}
