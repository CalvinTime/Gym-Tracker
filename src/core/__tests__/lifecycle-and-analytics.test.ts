import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GymTrackerDB } from '../db/database.ts';
import { seedDatabase } from '../db/seed.ts';
import { SEED_GYM_PROFILE_ID } from '../db/seed-data.ts';
import { WorkoutLifecycleService, estimateE1RM, estimateE10RM, PR_WEIGHT, PR_REPS, PR_VOLUME_SET, PR_E1RM, PR_E10RM } from '../services/workout-lifecycle.service.ts';
import { AnalyticsService } from '../services/analytics.service.ts';
import { BackupImportService } from '../services/backup-import.service.ts';
import { currentISO } from '../utils/uuid.ts';
import type {
  Exercise,
  GymProfile,
  RoutineTemplate,
  RoutineExercise,
  RoutineSetTemplate,
} from '../models/types.ts';

/**
 * Vollständiger Durchlauf-Test:
 * McFit-Studio betreten → Workout starten → Sätze abhaken → PRs erkennen
 * → Timer → Abschluss → Analytics → Backup & Restore
 */
describe('WorkoutLifecycleService, AnalyticsService & BackupImportService (Schritt 3)', () => {
  let db: GymTrackerDB;
  let gymProfile: GymProfile;

  // Testdaten: Routine + Templates
  let routine: RoutineTemplate;
  let routineExBenchPress: RoutineExercise;
  let routineExCableSeitheben: RoutineExercise;
  let benchPress: Exercise;
  let cableLateralRaise: Exercise;
  let setTemplates_BP: RoutineSetTemplate[];
  let setTemplates_CLR: RoutineSetTemplate[];

  beforeEach(async () => {
    db = new GymTrackerDB(`test_lifecycle_${Date.now()}_${Math.random()}`);
    await seedDatabase(db);

    const profile = await db.gym_profiles.get(SEED_GYM_PROFILE_ID);
    if (!profile) throw new Error('GymProfile missing');
    gymProfile = profile;

    const exercises = await db.exercises.toArray();
    benchPress = exercises.find((e) => e.name.includes('gym80 Brustpresse Sitzend'))!;
    cableLateralRaise = exercises.find((e) => e.name.includes('Kabelturm Seitheben Unilateral'))!;

    // Routine mit 2 Übungen anlegen
    const now = currentISO();
    routine = {
      id: 'routine-test-1',
      name: 'Push A (Test)',
      split_category: 'Push/Pull/Legs',
      order_index: 0,
      is_archived: false,
      created_at: now,
      updated_at: now,
    };
    await db.routine_templates.add(routine);

    routineExBenchPress = {
      id: 're-bp-1',
      routine_id: routine.id,
      exercise_id: benchPress.id,
      order_index: 0,
      superset_group_id: null,
      rest_seconds: 120,
      progression_rule: {
        type: 'double_progression',
        rep_range: [8, 12],
        target_rir: 1,
        deload_after_fails: 3,
      },
      created_at: now,
      updated_at: now,
    };

    routineExCableSeitheben = {
      id: 're-clr-1',
      routine_id: routine.id,
      exercise_id: cableLateralRaise.id,
      order_index: 1,
      superset_group_id: null,
      rest_seconds: 60,
      progression_rule: {
        type: 'double_progression',
        rep_range: [12, 15],
        target_rir: 1,
        deload_after_fails: 3,
      },
      created_at: now,
      updated_at: now,
    };

    await db.routine_exercises.bulkAdd([routineExBenchPress, routineExCableSeitheben]);

    // Set Templates für Brustpresse: 3 Arbeitssätze
    setTemplates_BP = [
      { id: 'st-bp-1', routine_exercise_id: 're-bp-1', set_index: 0, set_type: 'working', target_reps_min: 8, target_reps_max: 12, target_weight_stack: 50, target_rir: 1, created_at: now, updated_at: now },
      { id: 'st-bp-2', routine_exercise_id: 're-bp-1', set_index: 1, set_type: 'working', target_reps_min: 8, target_reps_max: 12, target_weight_stack: 50, target_rir: 1, created_at: now, updated_at: now },
      { id: 'st-bp-3', routine_exercise_id: 're-bp-1', set_index: 2, set_type: 'working', target_reps_min: 8, target_reps_max: 12, target_weight_stack: 50, target_rir: 1, created_at: now, updated_at: now },
    ];
    // Set Templates für Kabel-Seitheben: 2 Arbeitssätze
    setTemplates_CLR = [
      { id: 'st-clr-1', routine_exercise_id: 're-clr-1', set_index: 0, set_type: 'working', target_reps_min: 12, target_reps_max: 15, target_weight_stack: 15, target_rir: 1, created_at: now, updated_at: now },
      { id: 'st-clr-2', routine_exercise_id: 're-clr-1', set_index: 1, set_type: 'working', target_reps_min: 12, target_reps_max: 15, target_weight_stack: 15, target_rir: 1, created_at: now, updated_at: now },
    ];

    await db.routine_set_templates.bulkAdd([...setTemplates_BP, ...setTemplates_CLR]);
  });

  afterEach(async () => {
    if (db.isOpen()) await db.delete();
  });

  // ────────────── 1. WorkoutLifecycleService.startWorkout ──────────────

  describe('1. startWorkout', () => {

    it('erstellt ein Workout mit started_at === null (kein Zeitstempel beim Anschauen)', async () => {
      const result = await WorkoutLifecycleService.startWorkout(db, routine.id, gymProfile.id);

      expect(result.workout.started_at).toBeNull();
      expect(result.workout.finished_at).toBeNull();
      expect(result.workout.routine_id).toBe(routine.id);
      expect(result.workout.title).toBe('Push A (Test)');
    });

    it('kopiert Zielwerte als Snapshot für jeden Satz', async () => {
      const result = await WorkoutLifecycleService.startWorkout(db, routine.id, gymProfile.id);

      // Brustpresse: 3 Arbeitssätze (bilateral) = 3 Sets
      const bpSets = result.workoutSets.filter((s) => {
        const we = result.workoutExercises.find((we) => we.id === s.workout_exercise_id);
        return we?.exercise_id === benchPress.id;
      });
      expect(bpSets.length).toBe(3);
      expect(bpSets[0].target_weight_snapshot).toBe(50);
      expect(bpSets[0].target_reps_min_snapshot).toBeGreaterThanOrEqual(8);
      expect(bpSets[0].target_reps_max_snapshot).toBe(12);
      expect(bpSets[0].is_completed).toBe(false);
      expect(bpSets[0].actual_weight).toBeNull();
    });

    it('erzeugt bei unilateraler Übung (Seitheben) automatisch left + right Sätze', async () => {
      const result = await WorkoutLifecycleService.startWorkout(db, routine.id, gymProfile.id);

      const clrSets = result.workoutSets.filter((s) => {
        const we = result.workoutExercises.find((we) => we.id === s.workout_exercise_id);
        return we?.exercise_id === cableLateralRaise.id;
      });

      // 2 Template-Sätze × 2 Seiten (left/right) = 4 Sätze
      expect(clrSets.length).toBe(4);

      const leftSets = clrSets.filter((s) => s.side === 'left');
      const rightSets = clrSets.filter((s) => s.side === 'right');
      expect(leftSets.length).toBe(2);
      expect(rightSets.length).toBe(2);
    });
  });

  // ──────────── 2. WorkoutLifecycleService.completeSet ─────────────────

  describe('2. completeSet & PR-Erkennung', () => {

    it('setzt started_at erst beim allerersten abhaken, nicht beim Anlegen', async () => {
      const { workout, workoutSets } = await WorkoutLifecycleService.startWorkout(
        db, routine.id, gymProfile.id
      );

      // Vor completeSet: started_at ist null
      const freshWorkout = await db.workouts.get(workout.id);
      expect(freshWorkout!.started_at).toBeNull();

      // Ersten Satz abhaken
      await WorkoutLifecycleService.completeSet(db, workoutSets[0].id, {
        actual_weight: 50,
        actual_reps: 10,
        actual_rir: 2,
        used_micro_addon: false,
      });

      // Nach completeSet: started_at gesetzt
      const updatedWorkout = await db.workouts.get(workout.id);
      expect(updatedWorkout!.started_at).not.toBeNull();
    });

    it('berechnet effective_weight_kg über den Gym80EquipmentService', async () => {
      const { workoutSets } = await WorkoutLifecycleService.startWorkout(
        db, routine.id, gymProfile.id
      );

      // Brustpresse Sitzend (machine_stack, pulley_ratio 1.0)
      const bpSet = workoutSets.find((s) => s.side === 'both')!;
      const { updatedSet } = await WorkoutLifecycleService.completeSet(db, bpSet.id, {
        actual_weight: 50,
        actual_reps: 10,
        actual_rir: 1,
        used_micro_addon: false,
      });

      // machine_stack + pulley_ratio 1.0 → effective = 50
      expect(updatedSet.effective_weight_kg).toBe(50);
      expect(updatedSet.actual_reps).toBe(10);
      expect(updatedSet.is_completed).toBe(true);
    });

    it('überschreibt NIEMALS die Soll-Snapshots beim Abhaken (Soll-vs-Ist-Trennung)', async () => {
      const { workoutSets } = await WorkoutLifecycleService.startWorkout(
        db, routine.id, gymProfile.id
      );

      const bpSet = workoutSets.find((s) => s.side === 'both')!;
      // Der Nutzer macht 55 kg statt der geplanten 50 kg:
      const { updatedSet } = await WorkoutLifecycleService.completeSet(db, bpSet.id, {
        actual_weight: 55,
        actual_reps: 8,
        actual_rir: 1,
        used_micro_addon: true,
      });

      // Die Soll-Werte im Snapshot dürfen unverändert sein:
      expect(updatedSet.target_weight_snapshot).toBe(50);
      // Die Ist-Werte wurden gespeichert:
      expect(updatedSet.actual_weight).toBe(55);
    });

    it('erkennt PRs (PR_WEIGHT, PR_REPS, PR_VOLUME_SET, PR_E1RM, PR_E10RM) bei erstem Arbeitssatz', async () => {
      const { workoutSets } = await WorkoutLifecycleService.startWorkout(
        db, routine.id, gymProfile.id
      );

      const bpSet = workoutSets.find((s) => s.side === 'both' && s.set_type === 'working')!;
      const { prFlags } = await WorkoutLifecycleService.completeSet(db, bpSet.id, {
        actual_weight: 50,
        actual_reps: 10,
        actual_rir: 1,
        used_micro_addon: false,
      });

      // Erster Satz ever → alle PRs!
      expect(prFlags).toContain(PR_WEIGHT);
      expect(prFlags).toContain(PR_REPS);
      expect(prFlags).toContain(PR_VOLUME_SET);
      expect(prFlags).toContain(PR_E1RM);
      expect(prFlags).toContain(PR_E10RM);
    });

    it('speichert PR-Records in exercise.best_1rm, best_10rm, max_volume_set', async () => {
      const { workoutSets } = await WorkoutLifecycleService.startWorkout(
        db, routine.id, gymProfile.id
      );

      const bpSet = workoutSets.find((s) => s.side === 'both' && s.set_type === 'working')!;
      await WorkoutLifecycleService.completeSet(db, bpSet.id, {
        actual_weight: 60,
        actual_reps: 8,
        actual_rir: 1,
        used_micro_addon: false,
      });

      const updatedEx = await db.exercises.get(benchPress.id);
      const expected1RM = estimateE1RM(60, 8);
      const expected10RM = estimateE10RM(60, 8);
      expect(updatedEx!.best_1rm).toBe(expected1RM);
      expect(updatedEx!.best_10rm).toBe(expected10RM);
      expect(updatedEx!.max_volume_set).toBe(60 * 8);
    });

    it('erkennt beim zweiten Workout keinen PR_WEIGHT wenn Gewicht gleich, aber PR_REPS bei mehr Wdh.', async () => {
      // === Workout 1: 50 kg × 10 ===
      const w1 = await WorkoutLifecycleService.startWorkout(db, routine.id, gymProfile.id);
      const w1Set = w1.workoutSets.find((s) => s.side === 'both' && s.set_type === 'working')!;
      await WorkoutLifecycleService.completeSet(db, w1Set.id, {
        actual_weight: 50, actual_reps: 10, actual_rir: 1, used_micro_addon: false,
      });
      await WorkoutLifecycleService.finishWorkout(db, w1.workout.id);

      // === Workout 2: 50 kg × 12 (mehr Reps, gleiches Gewicht) ===
      const w2 = await WorkoutLifecycleService.startWorkout(db, routine.id, gymProfile.id);
      const w2Set = w2.workoutSets.find((s) => s.side === 'both' && s.set_type === 'working')!;
      const { prFlags } = await WorkoutLifecycleService.completeSet(db, w2Set.id, {
        actual_weight: 50, actual_reps: 12, actual_rir: 1, used_micro_addon: false,
      });

      expect(prFlags).not.toContain(PR_WEIGHT); // gleiches Gewicht = kein Weight-PR
      expect(prFlags).toContain(PR_REPS);        // 12 > 10 bei gleichem Gewicht
      expect(prFlags).toContain(PR_VOLUME_SET);   // 600 > 500
    });
  });

  // ────────────── 3. WorkoutLifecycleService.getRestTimerInfo ──────────

  describe('3. getRestTimerInfo', () => {

    it('gibt die korrekte Pause für compound (120s custom) und isolation (60s custom) zurück', async () => {
      const result = await WorkoutLifecycleService.startWorkout(db, routine.id, gymProfile.id);

      // Brustpresse Sitzend: custom_rest_seconds = 120
      const bpSet = result.workoutSets.find((s) => s.side === 'both')!;
      await WorkoutLifecycleService.completeSet(db, bpSet.id, {
        actual_weight: 50, actual_reps: 10, actual_rir: 1, used_micro_addon: false,
      });

      const bpTimer = await WorkoutLifecycleService.getRestTimerInfo(
        db, result.workout.id, bpSet.id
      );
      expect(bpTimer).not.toBeNull();
      expect(bpTimer!.recommendedRestSeconds).toBe(120);
      expect(bpTimer!.lastSetCompletedAt).toBeTruthy();
      expect(bpTimer!.timeSinceLastSetSeconds).toBeGreaterThanOrEqual(0);
      expect(bpTimer!.remainingCountdownSeconds).toBeLessThanOrEqual(120);

      // Mit simulierter Zeit: 45 Sekunden nach Satzabschluss
      const completedTimeMs = new Date(bpTimer!.lastSetCompletedAt).getTime();
      const simulatedNow = new Date(completedTimeMs + 45 * 1000);
      const simulatedTimer = await WorkoutLifecycleService.getRestTimerInfo(
        db, result.workout.id, bpSet.id, simulatedNow
      );
      expect(simulatedTimer!.timeSinceLastSetSeconds).toBe(45);
      expect(simulatedTimer!.remainingCountdownSeconds).toBe(75); // 120s - 45s = 75s Countdown

      // Kabel-Seitheben: custom_rest_seconds = null, routine_exercise.rest_seconds = 60
      const clrSets = result.workoutSets.filter((s) => s.side === 'left');
      const clrSet = clrSets[0];
      await WorkoutLifecycleService.completeSet(db, clrSet.id, {
        actual_weight: 15, actual_reps: 12, actual_rir: 1, used_micro_addon: false,
      });

      const clrTimer = await WorkoutLifecycleService.getRestTimerInfo(
        db, result.workout.id, clrSet.id
      );
      expect(clrTimer).not.toBeNull();
      // Seitheben hat custom_rest_seconds = 60 (gesetzt im Seed), routine sagt auch 60
      expect(clrTimer!.recommendedRestSeconds).toBe(60);
    });
  });

  // ──────────── 4. WorkoutLifecycleService.finishWorkout ───────────────

  describe('4. finishWorkout', () => {

    it('setzt finished_at korrekt', async () => {
      const { workout } = await WorkoutLifecycleService.startWorkout(
        db, routine.id, gymProfile.id
      );

      const finished = await WorkoutLifecycleService.finishWorkout(db, workout.id);
      expect(finished.finished_at).not.toBeNull();

      const saved = await db.workouts.get(workout.id);
      expect(saved!.finished_at).toBe(finished.finished_at);
    });
  });

  // ──────────── 5. AnalyticsService ────────────────────────────────────

  describe('5. AnalyticsService', () => {

    it('berechnet wöchentliches Muskelvolumen (direct-Modus: nur Primärmuskel)', async () => {
      // Erstelle ein abgeschlossenes Workout mit Brustpresse (3 Sätze)
      const w = await WorkoutLifecycleService.startWorkout(db, routine.id, gymProfile.id);

      // Alle Brustpresse-Sätze abhaken
      const bpSets = w.workoutSets.filter((s) => {
        const we = w.workoutExercises.find((we) => we.id === s.workout_exercise_id);
        return we?.exercise_id === benchPress.id;
      });

      for (const set of bpSets) {
        await WorkoutLifecycleService.completeSet(db, set.id, {
          actual_weight: 50, actual_reps: 10, actual_rir: 1, used_micro_addon: false,
        });
      }

      await WorkoutLifecycleService.finishWorkout(db, w.workout.id);

      // Volumen abfragen
      const startDate = '2020-01-01';
      const endDate = '2030-12-31';

      const directVolume = await AnalyticsService.getWeeklyMuscleVolume(
        db, startDate, endDate, 'direct'
      );

      // Brustpresse → Primärmuskel = chest_mid → 3 Arbeitssätze × 1.0 = 3.0
      const chestEntry = directVolume.find((e) => e.muscle_id === 'chest_mid');
      expect(chestEntry).toBeDefined();
      expect(chestEntry!.weighted_sets).toBe(3);
    });

    it('berechnet fraktionales Volumen (Primär 1.0, Sekundär 0.5, Tertiär 0.25)', async () => {
      const w = await WorkoutLifecycleService.startWorkout(db, routine.id, gymProfile.id);
      const bpSets = w.workoutSets.filter((s) => {
        const we = w.workoutExercises.find((we) => we.id === s.workout_exercise_id);
        return we?.exercise_id === benchPress.id;
      });

      for (const set of bpSets) {
        await WorkoutLifecycleService.completeSet(db, set.id, {
          actual_weight: 50, actual_reps: 10, actual_rir: 1, used_micro_addon: false,
        });
      }
      await WorkoutLifecycleService.finishWorkout(db, w.workout.id);

      const fractional = await AnalyticsService.getWeeklyMuscleVolume(
        db, '2020-01-01', '2030-12-31', 'fractional'
      );

      // Brustpresse: chest_mid = 3 × 1.0 = 3.0
      const chest = fractional.find((e) => e.muscle_id === 'chest_mid');
      expect(chest!.weighted_sets).toBe(3);

      // Brustpresse: delts_front = 3 × 0.5 = 1.5
      const deltsFront = fractional.find((e) => e.muscle_id === 'delts_front');
      expect(deltsFront!.weighted_sets).toBe(1.5);

      // Brustpresse: triceps = 3 × 0.5 = 1.5
      const triceps = fractional.find((e) => e.muscle_id === 'triceps');
      expect(triceps!.weighted_sets).toBe(1.5);
    });

    it('gibt Zeitreihendaten für getExerciseHistoryChart zurück', async () => {
      const w = await WorkoutLifecycleService.startWorkout(db, routine.id, gymProfile.id);
      const bpSets = w.workoutSets.filter((s) => {
        const we = w.workoutExercises.find((we) => we.id === s.workout_exercise_id);
        return we?.exercise_id === benchPress.id;
      });

      for (const set of bpSets) {
        await WorkoutLifecycleService.completeSet(db, set.id, {
          actual_weight: 50, actual_reps: 10, actual_rir: 1, used_micro_addon: false,
        });
      }
      await WorkoutLifecycleService.finishWorkout(db, w.workout.id);

      const history = await AnalyticsService.getExerciseHistoryChart(
        db, benchPress.id, 'e1rm'
      );

      expect(history.length).toBeGreaterThanOrEqual(1);
      const expectedE1RM = estimateE1RM(50, 10);
      expect(history[0].value).toBe(expectedE1RM);
    });
  });

  // ──────────── 6. BackupImportService ─────────────────────────────────

  describe('6. BackupImportService', () => {

    describe('parseLocalizedNumber', () => {
      it('parst deutsche Dezimalkommas korrekt', () => {
        expect(BackupImportService.parseLocalizedNumber('27,5')).toBe(27.5);
        expect(BackupImportService.parseLocalizedNumber('27.5')).toBe(27.5);
        expect(BackupImportService.parseLocalizedNumber('100')).toBe(100);
        expect(BackupImportService.parseLocalizedNumber('2,5')).toBe(2.5);
        expect(BackupImportService.parseLocalizedNumber('1.250,5')).toBe(1250.5);
      });

      it('gibt NaN für ungültige Eingaben zurück', () => {
        expect(BackupImportService.parseLocalizedNumber('')).toBeNaN();
        expect(BackupImportService.parseLocalizedNumber('abc')).toBeNaN();
      });
    });

    describe('normalizeDate', () => {
      it('normalisiert verschiedene Datumsformate nach YYYY-MM-DD', () => {
        expect(BackupImportService.normalizeDate('2026-10-24')).toBe('2026-10-24');
        expect(BackupImportService.normalizeDate('24.10.2026')).toBe('2026-10-24');
        expect(BackupImportService.normalizeDate('10/24/2026')).toBe('2026-10-24');
        expect(BackupImportService.normalizeDate('1.5.2026')).toBe('2026-05-01');
      });
    });

    describe('JSON Backup & Restore', () => {

      it('exportiert die komplette Datenbank als JSON und importiert sie zurück', async () => {
        // Workout erzeugen damit Daten vorhanden sind
        const w = await WorkoutLifecycleService.startWorkout(db, routine.id, gymProfile.id);
        const bpSet = w.workoutSets.find((s) => s.side === 'both')!;
        await WorkoutLifecycleService.completeSet(db, bpSet.id, {
          actual_weight: 50, actual_reps: 10, actual_rir: 1, used_micro_addon: false,
        });
        await WorkoutLifecycleService.finishWorkout(db, w.workout.id);

        // Export
        const json = await BackupImportService.exportFullDatabaseJson(db);
        expect(json).toBeTruthy();

        const parsed = JSON.parse(json);
        expect(parsed.version).toBe(1);
        expect(parsed.exported_at).toBeTruthy();
        expect(parsed.tables.exercises.length).toBe(25);
        expect(parsed.tables.workouts.length).toBeGreaterThanOrEqual(1);
        expect(parsed.tables.workout_sets.length).toBeGreaterThanOrEqual(1);

        // Komplett neue DB erstellen, Backup importieren
        const db2 = new GymTrackerDB(`test_import_${Date.now()}_${Math.random()}`);
        try {
          const importResult = await BackupImportService.importFullDatabaseJson(db2, json);

          expect(importResult.success).toBe(true);
          expect(importResult.counts.exercises).toBe(25);
          expect(importResult.counts.workouts).toBeGreaterThanOrEqual(1);
          expect(importResult.counts.muscles).toBe(17);

          // Daten verifizieren
          const restoredProfile = await db2.gym_profiles.get(SEED_GYM_PROFILE_ID);
          expect(restoredProfile).toBeDefined();
          expect(restoredProfile!.name).toBe('McFit Bruchsal (gym80)');

          const restoredEx = await db2.exercises.count();
          expect(restoredEx).toBe(25);
        } finally {
          await db2.delete();
        }
      });

      it('lehnt ungültiges JSON ab', async () => {
        const result = await BackupImportService.importFullDatabaseJson(db, 'das ist kein json {{{');
        expect(result.success).toBe(false);
        expect(result.message).toContain('Ungültig');
      });

      it('lehnt JSON ohne tables-Objekt ab', async () => {
        const result = await BackupImportService.importFullDatabaseJson(
          db,
          JSON.stringify({ version: 1 })
        );
        expect(result.success).toBe(false);
        expect(result.message).toContain('Tabellendaten');
      });
    });

    describe('CSV Import', () => {

      it('importiert Strong-Format CSV mit englischen Headers', async () => {
        const csv = [
          'Date,Exercise Name,Set Order,Weight (kg),Reps',
          '2026-10-20,Bench Press,1,80,10',
          '2026-10-20,Bench Press,2,80,8',
          '2026-10-20,Bench Press,3,80,6',
          '2026-10-20,Lat Pulldown,1,60,12',
          '2026-10-20,Lat Pulldown,2,60,10',
          '2026-10-21,Squat,1,100,8',
          '2026-10-21,Squat,2,100,6',
        ].join('\n');

        const result = await BackupImportService.importFromCsv(db, csv, gymProfile.id);

        expect(result.success).toBe(true);
        expect(result.workoutsCreated).toBe(2);    // 2 Tage
        expect(result.setsImported).toBe(7);
        expect(result.exercisesCreated).toBe(3);   // 3 neue Übungen

        // Verify Workouts in DB
        const workouts = await db.workouts.filter(
          (w) => w.title.startsWith('Import')
        ).toArray();
        expect(workouts.length).toBe(2);
      });

      it('importiert CSV mit deutschen Spaltennnamen und Dezimalkomma', async () => {
        const csv = [
          'Datum;Übung;Satz;Gewicht (kg);Wiederholungen',
          '24.10.2026;Bankdrücken;1;82,5;10',
          '24.10.2026;Bankdrücken;2;82,5;8',
        ].join('\n');

        const result = await BackupImportService.importFromCsv(db, csv, gymProfile.id);
        expect(result.success).toBe(true);
        expect(result.setsImported).toBe(2);

        // Gewicht mit Dezimalkomma korrekt geparst?
        const sets = await db.workout_sets
          .filter((s) => s.actual_weight === 82.5)
          .toArray();
        expect(sets.length).toBe(2);
      });

      it('gibt Warning bei fehlendem Datum zurück, importiert aber Rest', async () => {
        const csv = [
          'Date,Exercise Name,Weight (kg),Reps',
          ',Missing Date Exercise,50,10',
          '2026-10-22,Valid Exercise,60,12',
        ].join('\n');

        const result = await BackupImportService.importFromCsv(db, csv, gymProfile.id);
        expect(result.success).toBe(true);
        expect(result.warnings.length).toBeGreaterThanOrEqual(1);
        expect(result.setsImported).toBe(1); // nur die gültige Zeile
      });
    });

    describe('parseCsvLine', () => {
      it('parst quoted Felder mit Komma korrekt', () => {
        const result = BackupImportService.parseCsvLine('"Bench Press, Flat",80,10');
        expect(result[0]).toBe('Bench Press, Flat');
        expect(result[1]).toBe('80');
        expect(result[2]).toBe('10');
      });
    });
  });

  // ──────────── 7. Epley-Formeln ───────────────────────────────────────

  describe('7. Epley e1RM / e10RM Formeln', () => {
    it('berechnet e1RM korrekt (Epley: weight × (1 + reps/30))', () => {
      // 100 kg × (1 + 10/30) = 100 × 1.333… = 133.33
      expect(estimateE1RM(100, 10)).toBeCloseTo(133.33, 1);
      // 1 Rep = Gewicht selbst
      expect(estimateE1RM(100, 1)).toBe(100);
      // Edge cases
      expect(estimateE1RM(0, 10)).toBe(0);
      expect(estimateE1RM(50, 0)).toBe(0);
    });

    it('berechnet e10RM korrekt (e1RM / 1.333…)', () => {
      // e1RM für 100×10 = 133.33 → e10RM = 133.33 / 1.333… = 100
      expect(estimateE10RM(100, 10)).toBeCloseTo(100, 0);
    });
  });

  // ──────────── 8. Full Lifecycle Smoke Test ───────────────────────────

  describe('8. Kompletter McFit-Durchlauf: Ankommen → Training → Analytics → Backup', () => {

    it('simuliert einen vollen McFit-Besuch mit 2 Übungen, PRs, Analytics und Backup', async () => {
      // 1. Im McFit angekommen: Workout starten
      const { workout, workoutSets, workoutExercises } =
        await WorkoutLifecycleService.startWorkout(db, routine.id, gymProfile.id);
      expect(workout.started_at).toBeNull();

      // 2. Brustpresse: 3 Sätze abhaken (50 kg × 10, 50 × 9, 50 × 8)
      const bpExId = workoutExercises.find((we) => we.exercise_id === benchPress.id)!.id;
      const bpSets = workoutSets.filter((s) => s.workout_exercise_id === bpExId);
      expect(bpSets.length).toBe(3);

      const reps = [10, 9, 8];
      for (let i = 0; i < bpSets.length; i++) {
        const { prFlags } = await WorkoutLifecycleService.completeSet(db, bpSets[i].id, {
          actual_weight: 50,
          actual_reps: reps[i],
          actual_rir: 1,
          used_micro_addon: false,
        });

        if (i === 0) {
          // Erster Satz ever → volle PRs
          expect(prFlags).toContain(PR_WEIGHT);
          expect(prFlags).toContain(PR_E1RM);
        }

        // Timer checken nach jedem Satz
        const timer = await WorkoutLifecycleService.getRestTimerInfo(
          db, workout.id, bpSets[i].id
        );
        expect(timer).not.toBeNull();
        expect(timer!.recommendedRestSeconds).toBe(120); // custom_rest_seconds der Brustpresse
      }

      // 3. Kabel-Seitheben: 4 Sätze (L/R/L/R) mit 15 kg am Block
      const clrExId = workoutExercises.find((we) => we.exercise_id === cableLateralRaise.id)!.id;
      const clrSets = workoutSets.filter((s) => s.workout_exercise_id === clrExId);
      expect(clrSets.length).toBe(4); // 2 templates × 2 sides

      for (const set of clrSets) {
        await WorkoutLifecycleService.completeSet(db, set.id, {
          actual_weight: 15,
          actual_reps: 12,
          actual_rir: 1,
          used_micro_addon: false,
        });
      }

      // 4. Workout abschließen
      const finished = await WorkoutLifecycleService.finishWorkout(db, workout.id);
      expect(finished.finished_at).not.toBeNull();

      // started_at muss jetzt auch gesetzt sein (wurde beim 1. Satz gesetzt)
      const savedWorkout = await db.workouts.get(workout.id);
      expect(savedWorkout!.started_at).not.toBeNull();

      // 5. Analytics: Wöchentliches Muskelvolumen prüfen
      const volume = await AnalyticsService.getWeeklyMuscleVolume(
        db, '2020-01-01', '2030-12-31', 'fractional'
      );
      expect(volume.length).toBeGreaterThan(0);

      // chest_mid: 3 Sätze × 1.0 = 3.0
      const chest = volume.find((v) => v.muscle_id === 'chest_mid');
      expect(chest).toBeDefined();
      expect(chest!.weighted_sets).toBe(3);

      // delts_side: 4 Sätze (L+R Seitheben) × 1.0 = 4.0
      const deltsSide = volume.find((v) => v.muscle_id === 'delts_side');
      expect(deltsSide).toBeDefined();
      expect(deltsSide!.weighted_sets).toBe(4);

      // 6. Exercise History Chart
      const chart = await AnalyticsService.getExerciseHistoryChart(
        db, benchPress.id, 'e1rm'
      );
      expect(chart.length).toBe(1);
      expect(chart[0].value).toBeCloseTo(estimateE1RM(50, 10), 1);

      // 7. Komplett-Backup exportieren
      const backupJson = await BackupImportService.exportFullDatabaseJson(db);
      const parsed = JSON.parse(backupJson);
      expect(parsed.version).toBe(1);
      expect(parsed.tables.workouts.length).toBeGreaterThanOrEqual(1);
      expect(parsed.tables.workout_sets.length).toBeGreaterThanOrEqual(7); // 3 + 4

      // 8. In frische DB importieren und verifizieren
      const freshDb = new GymTrackerDB(`test_fresh_${Date.now()}_${Math.random()}`);
      try {
        const importResult = await BackupImportService.importFullDatabaseJson(freshDb, backupJson);
        expect(importResult.success).toBe(true);

        // Restored exercises sollten best_1rm beibehalten haben
        const restoredBP = await freshDb.exercises.get(benchPress.id);
        expect(restoredBP!.best_1rm).not.toBeNull();
        expect(restoredBP!.best_1rm).toBeCloseTo(estimateE1RM(50, 10), 1);
      } finally {
        await freshDb.delete();
      }
    });
  });
});
