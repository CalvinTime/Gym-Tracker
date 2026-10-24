import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GymTrackerDB } from '../db/database.ts';
import { seedDatabase } from '../db/seed.ts';
import { Gym80EquipmentService } from '../services/gym80-equipment.service.ts';
import { ProgressionEngine } from '../services/progression-engine.service.ts';
import type {
  Exercise,
  GymProfile,
  RoutineExercise,
  RoutineSetTemplate,
} from '../models/types.ts';
import { SEED_GYM_PROFILE_ID } from '../db/seed-data.ts';

describe('Gym80EquipmentService & ProgressionEngine (Schritt 2)', () => {
  let db: GymTrackerDB;
  let gymProfile: GymProfile;
  let dumbbellInclinePress: Exercise;
  let cableLateralRaise: Exercise;
  let latPulldown: Exercise;
  let legPress: Exercise;
  let barbellBenchPress: Exercise;
  let weightedPullup: Exercise;

  beforeEach(async () => {
    db = new GymTrackerDB(`test_progression_${Date.now()}_${Math.random()}`);
    await seedDatabase(db);

    const profile = await db.gym_profiles.get(SEED_GYM_PROFILE_ID);
    if (!profile) throw new Error('GymProfile not found');
    gymProfile = profile;

    const exercises = await db.exercises.toArray();
    dumbbellInclinePress = exercises.find((e) => e.name.includes('Kurzhantel-Schrägbankdrücken'))!;
    cableLateralRaise = exercises.find((e) => e.name.includes('Kabelturm Seitheben Unilateral'))!;
    latPulldown = exercises.find((e) => e.name.includes('Latzug Turm (Breiter Obergriff)'))!;
    legPress = exercises.find((e) => e.name.includes('Beinpresse 45 Grad'))!;
    barbellBenchPress = exercises.find((e) => e.name.includes('Langhantel-Bankdrücken Flach'))!;
    weightedPullup = exercises.find((e) => e.name.includes('Klimmzüge am Turm'))!;
  });

  afterEach(async () => {
    if (db.isOpen()) {
      await db.delete();
    }
  });

  describe('1. Gym80EquipmentService.calculateEffectiveLoad', () => {
    it('berechnet Reallast am 1:2 gym80 Kabelturm (pulley_ratio = 0.5)', () => {
      // 40 kg am Block gesteckt -> 20.0 kg tatsächliche Kraft am Handgriff
      const load = Gym80EquipmentService.calculateEffectiveLoad(40, cableLateralRaise);
      expect(load).toBe(20.0);

      // 42.5 kg mit 2,5 kg Zusatzgewicht -> 21.25 kg
      const loadAddon = Gym80EquipmentService.calculateEffectiveLoad(42.5, cableLateralRaise);
      expect(loadAddon).toBe(21.25);
    });

    it('berechnet Reallast am 1:1 gym80 Latzug (pulley_ratio = 1.0)', () => {
      // 70 kg am Latzugturm -> 70.0 kg
      const load = Gym80EquipmentService.calculateEffectiveLoad(70, latPulldown);
      expect(load).toBe(70.0);

      // 72.5 kg mit 2,5 kg Zusatzgewicht -> 72.5 kg
      const loadAddon = Gym80EquipmentService.calculateEffectiveLoad(72.5, latPulldown);
      expect(loadAddon).toBe(72.5);
    });

    it('berechnet Reallast für Bodyweight-Übungen mit Zusatzgewicht', () => {
      // 80 kg Körpergewicht + 15 kg Zusatzgewicht am Gürtel = 95 kg Reallast
      const load = Gym80EquipmentService.calculateEffectiveLoad(15, weightedPullup, 80);
      expect(load).toBe(95.0);
    });

    it('übernimmt bei Kurzhantel und Langhantel das eingegebene Gewicht', () => {
      expect(Gym80EquipmentService.calculateEffectiveLoad(22, dumbbellInclinePress)).toBe(22.0);
      expect(Gym80EquipmentService.calculateEffectiveLoad(100, barbellBenchPress)).toBe(100.0);
    });
  });

  describe('2. Gym80EquipmentService.getNextAvailableWeight', () => {
    it('springt bei Kurzhanteln sauber: 1kg-Schritte bis 10kg, exakte 2kg-Schritte ab 10kg', () => {
      // Aufwärts in den 1-kg-Schritten
      expect(Gym80EquipmentService.getNextAvailableWeight(7, dumbbellInclinePress, gymProfile, 'up')).toBe(8);
      expect(Gym80EquipmentService.getNextAvailableWeight(9, dumbbellInclinePress, gymProfile, 'up')).toBe(10);

      // Übergang von 10 kg auf 12 kg (2-kg-Schritt!)
      expect(Gym80EquipmentService.getNextAvailableWeight(10, dumbbellInclinePress, gymProfile, 'up')).toBe(12);

      // Exakter 20 kg -> 22 kg Sprung (KEIN 22.5 kg!)
      expect(Gym80EquipmentService.getNextAvailableWeight(20, dumbbellInclinePress, gymProfile, 'up')).toBe(22);
      expect(Gym80EquipmentService.getNextAvailableWeight(22, dumbbellInclinePress, gymProfile, 'up')).toBe(24);

      // Abwärts
      expect(Gym80EquipmentService.getNextAvailableWeight(22, dumbbellInclinePress, gymProfile, 'down')).toBe(20);
      expect(Gym80EquipmentService.getNextAvailableWeight(12, dumbbellInclinePress, gymProfile, 'down')).toBe(10);
      expect(Gym80EquipmentService.getNextAvailableWeight(10, dumbbellInclinePress, gymProfile, 'down')).toBe(9);
    });

    it('nutzt beim 1:2 Kabelturm für Isolation 2,5-kg-Schritte (mit Zusatzgewicht: 15 -> 17,5 -> 20 kg)', () => {
      // Seitheben ist 'isolation' an 'cable_stack' mit pulley_ratio 0.5
      expect(Gym80EquipmentService.getNextAvailableWeight(15, cableLateralRaise, gymProfile, 'up')).toBe(17.5);
      expect(Gym80EquipmentService.getNextAvailableWeight(17.5, cableLateralRaise, gymProfile, 'up')).toBe(20.0);
      expect(Gym80EquipmentService.getNextAvailableWeight(20, cableLateralRaise, gymProfile, 'up')).toBe(22.5);

      // Abwärts
      expect(Gym80EquipmentService.getNextAvailableWeight(20, cableLateralRaise, gymProfile, 'down')).toBe(17.5);
      expect(Gym80EquipmentService.getNextAvailableWeight(17.5, cableLateralRaise, gymProfile, 'down')).toBe(15.0);
    });

    it('nutzt beim 1:1 Latzug 2,5-kg-Schritte dank gym80 Micro-Addon (50 -> 52,5 -> 55 kg)', () => {
      expect(Gym80EquipmentService.getNextAvailableWeight(50, latPulldown, gymProfile, 'up')).toBe(52.5);
      expect(Gym80EquipmentService.getNextAvailableWeight(52.5, latPulldown, gymProfile, 'up')).toBe(55.0);

      // Abwärts
      expect(Gym80EquipmentService.getNextAvailableWeight(55, latPulldown, gymProfile, 'down')).toBe(52.5);
      expect(Gym80EquipmentService.getNextAvailableWeight(52.5, latPulldown, gymProfile, 'down')).toBe(50.0);
    });

    it('steigert bei Langhantel und Plate-Loaded in 2,5-kg-Schritten (2x 1,25 kg Scheiben)', () => {
      expect(Gym80EquipmentService.getNextAvailableWeight(80, barbellBenchPress, gymProfile, 'up')).toBe(82.5);
      expect(Gym80EquipmentService.getNextAvailableWeight(82.5, barbellBenchPress, gymProfile, 'up')).toBe(85.0);
      expect(Gym80EquipmentService.getNextAvailableWeight(82.5, barbellBenchPress, gymProfile, 'down')).toBe(80.0);

      // 45° Beinpresse (Startgewicht 50 kg)
      expect(Gym80EquipmentService.getNextAvailableWeight(100, legPress, gymProfile, 'up')).toBe(102.5);
    });
  });

  describe('3. Gym80EquipmentService.calculatePlatesPerSide', () => {
    it('berechnet für Langhantel 100 kg mit 20 kg Olympia-Stange = 40 kg pro Seite (2x 20 kg)', () => {
      const result = Gym80EquipmentService.calculatePlatesPerSide(
        100,
        20,
        gymProfile.available_plates_kg
      );

      expect(result.targetTotalWeightKg).toBe(100);
      expect(result.barWeightKg).toBe(20);
      expect(result.weightToLoadTotalKg).toBe(80);
      expect(result.weightPerSideKg).toBe(40);
      expect(result.platesPerSide).toEqual([{ plateKg: 20, count: 2 }]);
      expect(result.isExactMatch).toBe(true);
      expect(result.remainingWeightKg).toBe(0);
    });

    it('berechnet krumme Lasten wie 92,5 kg mit 20 kg Stange exakt (1x 20kg, 1x 15kg, 1x 1,25kg)', () => {
      const result = Gym80EquipmentService.calculatePlatesPerSide(
        92.5,
        20,
        gymProfile.available_plates_kg
      );

      // Zu laden: 72.5 kg -> 36.25 kg pro Seite
      expect(result.weightPerSideKg).toBe(36.25);
      expect(result.platesPerSide).toEqual([
        { plateKg: 20, count: 1 },
        { plateKg: 15, count: 1 },
        { plateKg: 1.25, count: 1 },
      ]);
      expect(result.isExactMatch).toBe(true);
    });

    it('berechnet für gym80 45° Beinpresse mit 50 kg Schlitten 170 kg Gesamtlast (3x 20 kg pro Seite)', () => {
      const result = Gym80EquipmentService.calculatePlatesPerSide(
        170,
        50,
        gymProfile.available_plates_kg
      );

      expect(result.weightPerSideKg).toBe(60);
      expect(result.platesPerSide).toEqual([{ plateKg: 20, count: 3 }]);
      expect(result.isExactMatch).toBe(true);
    });

    it('gibt leere Scheibenliste zurück wenn Zielgewicht <= Stangengewicht ist', () => {
      const result = Gym80EquipmentService.calculatePlatesPerSide(
        20,
        20,
        gymProfile.available_plates_kg
      );
      expect(result.platesPerSide).toEqual([]);
      expect(result.isExactMatch).toBe(true);
    });
  });

  describe('4. Gym80EquipmentService.calculateDropSetWeight', () => {
    it('reduziert bei Steckgewichten um 2 Platten (bzw. ca. 20-25%)', () => {
      // 50 kg am Latzug -> 2 Platten tiefer = 40 kg (genau 20% Drop)
      const drop = Gym80EquipmentService.calculateDropSetWeight(50, latPulldown, gymProfile);
      expect(drop).toBe(40.0);
    });

    it('reduziert bei Kurzhanteln um ca. 20-25% und rundet auf echte McFit-Kurzhantel', () => {
      // 20 kg KH -> 77% ist 15.4 kg -> nächstgelegene Kurzhantel ist 16 kg
      const drop = Gym80EquipmentService.calculateDropSetWeight(20, dumbbellInclinePress, gymProfile);
      expect(drop).toBe(16);
    });
  });

  describe('5. ProgressionEngine (Double Progression & Recovery-Schutz)', () => {
    const routineEx: RoutineExercise = {
      id: 'routine-ex-1',
      routine_id: 'routine-1',
      exercise_id: '',
      order_index: 0,
      superset_group_id: null,
      rest_seconds: 120,
      progression_rule: {
        type: 'double_progression',
        rep_range: [8, 12],
        target_rir: 1,
        deload_after_fails: 3,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const setTemplates: RoutineSetTemplate[] = [
      {
        id: 'tmpl-1',
        routine_exercise_id: 'routine-ex-1',
        set_index: 0,
        set_type: 'working',
        target_reps_min: 8,
        target_reps_max: 12,
        target_weight_stack: 20,
        target_rir: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'tmpl-2',
        routine_exercise_id: 'routine-ex-1',
        set_index: 1,
        set_type: 'working',
        target_reps_min: 8,
        target_reps_max: 12,
        target_weight_stack: 20,
        target_rir: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'tmpl-3',
        routine_exercise_id: 'routine-ex-1',
        set_index: 2,
        set_type: 'working',
        target_reps_min: 8,
        target_reps_max: 12,
        target_weight_stack: 20,
        target_rir: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    it('erhöht bei 12/12/12 Wdh. das Kurzhantel-Gewicht von 20 auf 22 kg und setzt Reps auf 8 zurück', () => {
      routineEx.exercise_id = dumbbellInclinePress.id;

      // Letzte Einheit: Alle 3 Sätze haben 12 Reps mit RIR 1 geschafft
      const lastSession = {
        workout: {} as any,
        workoutExercise: {} as any,
        workingSets: [
          { actual_weight: 20, actual_reps: 12, actual_rir: 1, set_type: 'working', is_completed: true } as any,
          { actual_weight: 20, actual_reps: 12, actual_rir: 1, set_type: 'working', is_completed: true } as any,
          { actual_weight: 20, actual_reps: 12, actual_rir: 2, set_type: 'working', is_completed: true } as any,
        ],
      };

      const targets = ProgressionEngine.calculateTargetsForSets({
        exercise: dumbbellInclinePress,
        routineExercise: routineEx,
        setTemplates,
        gymProfile,
        lastValidSession: lastSession,
      });

      expect(targets.length).toBe(3);
      // Alle Sätze müssen auf 22 kg erhöht sein
      expect(targets[0].target_weight_snapshot).toBe(22);
      expect(targets[1].target_weight_snapshot).toBe(22);
      expect(targets[2].target_weight_snapshot).toBe(22);

      // Wiederholungsziel auf rep_range[0] (8 Wdh.) zurückgesetzt
      expect(targets[0].target_reps_min_snapshot).toBe(8);
      expect(targets[1].target_reps_min_snapshot).toBe(8);
      expect(targets[2].target_reps_min_snapshot).toBe(8);
    });

    it('lässt bei 12/11/10 Wdh. das Gewicht gleich und steigert das Rep-Ziel um +1', () => {
      routineEx.exercise_id = dumbbellInclinePress.id;

      // Letzte Einheit: 12, 11, 10 Reps (also noch nicht in allen 12)
      const lastSession = {
        workout: {} as any,
        workoutExercise: {} as any,
        workingSets: [
          { actual_weight: 20, actual_reps: 12, actual_rir: 1, set_type: 'working', is_completed: true } as any,
          { actual_weight: 20, actual_reps: 11, actual_rir: 1, set_type: 'working', is_completed: true } as any,
          { actual_weight: 20, actual_reps: 10, actual_rir: 1, set_type: 'working', is_completed: true } as any,
        ],
      };

      const targets = ProgressionEngine.calculateTargetsForSets({
        exercise: dumbbellInclinePress,
        routineExercise: routineEx,
        setTemplates,
        gymProfile,
        lastValidSession: lastSession,
      });

      // Gewicht bleibt fix bei 20 kg
      expect(targets[0].target_weight_snapshot).toBe(20);
      expect(targets[1].target_weight_snapshot).toBe(20);
      expect(targets[2].target_weight_snapshot).toBe(20);

      // Satz 1: 12 -> 12 (Obergrenze)
      expect(targets[0].target_reps_min_snapshot).toBe(12);
      // Satz 2: 11 -> 12 (+1)
      expect(targets[1].target_reps_min_snapshot).toBe(12);
      // Satz 3: 10 -> 11 (+1)
      expect(targets[2].target_reps_min_snapshot).toBe(11);
    });

    it('steigert das Gewicht NICHT, wenn actual_rir < target_rir war (Form- & Sicherheitsschutz)', () => {
      routineEx.exercise_id = dumbbellInclinePress.id;

      // Alle 12 Wdh., aber Satz 3 war RIR 0 (Muskelversagen ohne Reserve, obwohl target_rir 1 war)
      const lastSession = {
        workout: {} as any,
        workoutExercise: {} as any,
        workingSets: [
          { actual_weight: 20, actual_reps: 12, actual_rir: 1, set_type: 'working', is_completed: true } as any,
          { actual_weight: 20, actual_reps: 12, actual_rir: 1, set_type: 'working', is_completed: true } as any,
          { actual_weight: 20, actual_reps: 12, actual_rir: 0, set_type: 'working', is_completed: true } as any,
        ],
      };

      const targets = ProgressionEngine.calculateTargetsForSets({
        exercise: dumbbellInclinePress,
        routineExercise: routineEx,
        setTemplates,
        gymProfile,
        lastValidSession: lastSession,
      });

      // Darf nicht gesteigert werden!
      expect(targets[0].target_weight_snapshot).toBe(20);
    });

    it('ignoriert Einheiten mit pause_progression === true und greift auf die vorherige saubere Einheit zurück', async () => {
      routineEx.exercise_id = dumbbellInclinePress.id;

      const mondayTime = new Date('2026-10-19T10:00:00Z').toISOString();
      const wednesdayTime = new Date('2026-10-21T10:00:00Z').toISOString();

      // 1. Session am Montag (Gute Einheit: 12/12/12 bei 20 kg, pause_progression: false)
      const mondayWorkoutId = 'w-monday';
      await db.workouts.add({
        id: mondayWorkoutId,
        routine_id: null,
        gym_profile_id: SEED_GYM_PROFILE_ID,
        title: 'Montag Push',
        top_note: '',
        started_at: mondayTime,
        finished_at: mondayTime,
        is_deload_session: false,
        created_at: mondayTime,
        updated_at: mondayTime,
      });

      const mondayWeId = 'we-monday';
      await db.workout_exercises.add({
        id: mondayWeId,
        workout_id: mondayWorkoutId,
        exercise_id: dumbbellInclinePress.id,
        order_index: 0,
        superset_group_id: null,
        session_note: 'Sehr stark gefühlt',
        pause_progression: false, // SAUBERE EINHEIT!
        created_at: mondayTime,
        updated_at: mondayTime,
      });

      for (let i = 1; i <= 3; i++) {
        await db.workout_sets.add({
          id: `set-mon-${i}`,
          workout_exercise_id: mondayWeId,
          set_number: i,
          side: 'both',
          set_type: 'working',
          target_weight_snapshot: 20,
          target_reps_min_snapshot: 8,
          target_reps_max_snapshot: 12,
          target_rir_snapshot: 1,
          actual_weight: 20,
          effective_weight_kg: 20,
          actual_reps: 12, // Alle 12 geschafft!
          actual_rir: 1,
          used_micro_addon: false,
          is_completed: true,
          completed_at: mondayTime,
          pr_flags: [],
          created_at: mondayTime,
          updated_at: mondayTime,
        });
      }

      // 2. Session am Mittwoch (Schwacher Tag: Lifter war krank/müde, brach bei 6 Wdh ab, AKTIVIERTE pause_progression!)
      const wedWorkoutId = 'w-wednesday';
      await db.workouts.add({
        id: wedWorkoutId,
        routine_id: null,
        gym_profile_id: SEED_GYM_PROFILE_ID,
        title: 'Mittwoch Push (Schlecht gefühlt)',
        top_note: '',
        started_at: wednesdayTime,
        finished_at: wednesdayTime,
        is_deload_session: false,
        created_at: wednesdayTime,
        updated_at: wednesdayTime,
      });

      const wedWeId = 'we-wednesday';
      await db.workout_exercises.add({
        id: wedWeId,
        workout_id: wedWorkoutId,
        exercise_id: dumbbellInclinePress.id,
        order_index: 0,
        superset_group_id: null,
        session_note: 'Müde, Deload geschont',
        pause_progression: true, // PROGRESSION PAUSIERT!
        created_at: wednesdayTime,
        updated_at: wednesdayTime,
      });

      for (let i = 1; i <= 3; i++) {
        await db.workout_sets.add({
          id: `set-wed-${i}`,
          workout_exercise_id: wedWeId,
          set_number: i,
          side: 'both',
          set_type: 'working',
          target_weight_snapshot: 20,
          target_reps_min_snapshot: 8,
          target_reps_max_snapshot: 12,
          target_rir_snapshot: 1,
          actual_weight: 20,
          effective_weight_kg: 20,
          actual_reps: 6, // Nur 6 Wdh geschafft!
          actual_rir: 0,
          used_micro_addon: false,
          is_completed: true,
          completed_at: wednesdayTime,
          pr_flags: [],
          created_at: wednesdayTime,
          updated_at: wednesdayTime,
        });
      }

      // 3. Nun berechne Zielwerte für Freitag
      const fridayTargets = await ProgressionEngine.calculateExerciseSessionTargets({
        db,
        exercise: dumbbellInclinePress,
        routineExercise: routineEx,
        setTemplates,
        gymProfile,
      });

      // ERWARTUNG:
      // Der Mittwoch darf NICHT herangezogen werden!
      // Es muss der Montag gewertet werden (wo 12/12/12 bei 20 kg geschafft wurden),
      // sodass der Freitag auf 22 kg gesteigert wird und 8 Wdh als Ziel setzt!
      expect(fridayTargets[0].target_weight_snapshot).toBe(22);
      expect(fridayTargets[0].target_reps_min_snapshot).toBe(8);
      expect(fridayTargets[1].target_weight_snapshot).toBe(22);
      expect(fridayTargets[2].target_weight_snapshot).toBe(22);
    });

    it('berechnet für Dropsätze automatisch ein um ~20-25% reduziertes Zielgewicht mit Ziel-RIR 0', () => {
      routineEx.exercise_id = latPulldown.id;

      const templatesWithDrop: RoutineSetTemplate[] = [
        {
          id: 't-w1',
          routine_exercise_id: 'routine-ex-1',
          set_index: 0,
          set_type: 'working',
          target_reps_min: 8,
          target_reps_max: 12,
          target_weight_stack: 50,
          target_rir: 1,
          created_at: '',
          updated_at: '',
        },
        {
          id: 't-d1',
          routine_exercise_id: 'routine-ex-1',
          set_index: 1,
          set_type: 'drop',
          target_reps_min: 8,
          target_reps_max: 12,
          target_weight_stack: null,
          target_rir: null,
          created_at: '',
          updated_at: '',
        },
      ];

      const targets = ProgressionEngine.calculateTargetsForSets({
        exercise: latPulldown,
        routineExercise: routineEx,
        setTemplates: templatesWithDrop,
        gymProfile,
        lastValidSession: null,
      });

      expect(targets.length).toBe(2);
      expect(targets[0].set_type).toBe('working');
      expect(targets[0].target_weight_snapshot).toBe(50);

      // Dropsatz: Ausgehend von 50 kg -> 2 Platten weniger = 40 kg
      expect(targets[1].set_type).toBe('drop');
      expect(targets[1].target_weight_snapshot).toBe(40);
      expect(targets[1].target_rir_snapshot).toBe(0); // Muskelversagen!
    });
  });
});
