import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GymTrackerDB } from '../db/database.ts';
import { seedDatabase } from '../db/seed.ts';
import { calculateEffectiveWeight } from '../calculations/effective-weight.ts';
import { SEED_GYM_PROFILE_ID } from '../db/seed-data.ts';

describe('Database Schema & McFit-gym80-Preset (Schritt 1)', () => {
  let db: GymTrackerDB;

  beforeEach(() => {
    // Erstelle für jeden Test eine isolierte In-Memory-Instanz
    db = new GymTrackerDB(`test_db_${Date.now()}_${Math.random()}`);
  });

  afterEach(async () => {
    if (db.isOpen()) {
      await db.delete();
    }
  });

  it('initialisiert alle 11 Tabellen erfolgreich', async () => {
    await db.open();
    expect(db.tables.length).toBe(11);

    const tableNames = db.tables.map((t) => t.name).sort();
    expect(tableNames).toEqual([
      'body_measurements',
      'exercise_muscles',
      'exercises',
      'gym_profiles',
      'muscles',
      'routine_exercises',
      'routine_set_templates',
      'routine_templates',
      'workout_exercises',
      'workout_sets',
      'workouts',
    ]);
  });

  it('führt den Database-Seeder aus und legt das McFit-gym80 Profil exakt an', async () => {
    const result = await seedDatabase(db);
    expect(result.seeded).toBe(true);
    expect(result.profileCreated).toBe(true);
    expect(result.exercisesCount).toBe(25);
    expect(result.musclesCount).toBeGreaterThanOrEqual(17);

    // Profil abfragen
    const profile = await db.gym_profiles.get(SEED_GYM_PROFILE_ID);
    expect(profile).toBeDefined();
    expect(profile?.name).toBe('McFit Bruchsal (gym80)');
    expect(profile?.is_default).toBe(true);

    // Hanteln: 1-10kg (1er-Schritte) und 12-50kg (2er-Schritte)
    expect(profile?.dumbbell_list_kg).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
      12, 14, 16, 18, 20, 22, 24, 26, 28, 30,
      32, 34, 36, 38, 40, 42, 44, 46, 48, 50,
    ]);

    // Hantelscheiben
    expect(profile?.available_plates_kg).toEqual([20, 15, 10, 5, 2.5, 1.25]);

    // Stangen (Olympia 20kg, kurz 15kg, SZ 10kg)
    expect(profile?.barbell_options_kg).toEqual([20, 15, 10]);

    // Gewichtsblock-Abstufung & Micro-Addon
    expect(profile?.stack_increment_kg).toBe(5.0);
    expect(profile?.stack_micro_addon_kg).toBe(2.5);
  });

  it('legt alle anatomischen Muskelgruppen inkl. getrennter Schulterköpfe an', async () => {
    await seedDatabase(db);

    const muscles = await db.muscles.toArray();
    const muscleIds = muscles.map((m) => m.id);

    // Schulterköpfe müssen separat vorhanden sein
    expect(muscleIds).toContain('delts_front');
    expect(muscleIds).toContain('delts_side');
    expect(muscleIds).toContain('delts_rear');

    // Weitere Hauptmuskelgruppen
    expect(muscleIds).toContain('chest_upper');
    expect(muscleIds).toContain('chest_mid');
    expect(muscleIds).toContain('chest_lower');
    expect(muscleIds).toContain('lats');
    expect(muscleIds).toContain('upper_back');
    expect(muscleIds).toContain('lower_back');
    expect(muscleIds).toContain('biceps');
    expect(muscleIds).toContain('triceps');
    expect(muscleIds).toContain('quads');
    expect(muscleIds).toContain('hamstrings');
    expect(muscleIds).toContain('glutes');
    expect(muscleIds).toContain('calves');
    expect(muscleIds).toContain('abs');

    // Überprüfung der deutschen Bezeichnungen
    const deltsSide = await db.muscles.get('delts_side');
    expect(deltsSide?.name_de).toBe('Seitliche Schulter');
    expect(deltsSide?.muscle_group).toBe('Schultern');
  });

  it('installiert 25 McFit/gym80 Übungen mit korrekter Physik & Seilzugübersetzung', async () => {
    await seedDatabase(db);

    const exercises = await db.exercises.toArray();
    expect(exercises.length).toBe(25);

    // 1. Kabelturm mit 1:2 Flaschenzug (pulley_ratio = 0.5)
    const cableTriceps = exercises.find((e) => e.name.includes('Kabelturm Trizepsdrücken (Seil)'));
    expect(cableTriceps).toBeDefined();
    expect(cableTriceps?.pulley_ratio).toBe(0.5);
    expect(cableTriceps?.equipment_type).toBe('cable_stack');

    const cableLateralRaise = exercises.find((e) => e.name.includes('Kabelturm Seitheben Unilateral'));
    expect(cableLateralRaise).toBeDefined();
    expect(cableLateralRaise?.pulley_ratio).toBe(0.5);
    expect(cableLateralRaise?.laterality).toBe('unilateral');

    // 2. Latzug / Rudern mit Direktzug 1:1 (pulley_ratio = 1.0)
    const latPulldown = exercises.find((e) => e.name.includes('Latzug Turm (Breiter Obergriff)'));
    expect(latPulldown).toBeDefined();
    expect(latPulldown?.pulley_ratio).toBe(1.0);

    const seatedRow = exercises.find((e) => e.name.includes('Rudern Sitzend (Kabelzug)'));
    expect(seatedRow).toBeDefined();
    expect(seatedRow?.pulley_ratio).toBe(1.0);

    // 3. Plate-Loaded Eigengewichte
    const legPress = exercises.find((e) => e.name.includes('Beinpresse 45 Grad'));
    expect(legPress).toBeDefined();
    expect(legPress?.equipment_type).toBe('plate_loaded');
    expect(legPress?.default_bar_or_sled_weight_kg).toBe(50); // 50kg Schlitten

    const benchPress = exercises.find((e) => e.name.includes('Langhantel-Bankdrücken Flach'));
    expect(benchPress).toBeDefined();
    expect(benchPress?.equipment_type).toBe('barbell');
    expect(benchPress?.default_bar_or_sled_weight_kg).toBe(20); // 20kg Olympia-Stange

    const inclineMachine = exercises.find((e) => e.name.includes('Pure Kraft Schrägbankmaschine'));
    expect(inclineMachine).toBeDefined();
    expect(inclineMachine?.default_bar_or_sled_weight_kg).toBe(15);
  });

  it('verknüpft jede Übung mit Exercise-Muscles inklusive Rollen und Volumen-Gewichtung', async () => {
    await seedDatabase(db);

    const exerciseMuscles = await db.exercise_muscles.toArray();
    expect(exerciseMuscles.length).toBeGreaterThanOrEqual(25);

    // Prüfe, dass jede der 25 Übungen mindestens einen Primärmuskel besitzt
    const exercises = await db.exercises.toArray();
    for (const ex of exercises) {
      const relations = await db.exercise_muscles.where('exercise_id').equals(ex.id).toArray();
      expect(relations.length).toBeGreaterThan(0);

      const hasPrimary = relations.some((r) => r.role === 'primary' && r.volume_weight === 1.0);
      expect(hasPrimary).toBe(true);
    }
  });

  it('verhält sich idempotent beim wiederholten Seeden', async () => {
    const firstRun = await seedDatabase(db);
    expect(firstRun.seeded).toBe(true);

    const secondRun = await seedDatabase(db);
    expect(secondRun.seeded).toBe(false);
    expect(secondRun.profileCreated).toBe(false);

    // Zählungen dürfen sich nicht verdoppelt haben
    const exCount = await db.exercises.count();
    expect(exCount).toBe(25);

    const profileCount = await db.gym_profiles.count();
    expect(profileCount).toBe(1);
  });

  it('berechnet das effective_weight_kg präzise für gym80 Kabelturm und Micro-Addon', () => {
    // 1. Kabelturm mit 1:2 Flaschenzug (pulley_ratio = 0.5)
    // 50 kg gesteckt -> 25 kg effektive Zugkraft
    const eff1 = calculateEffectiveWeight({
      equipmentType: 'cable_stack',
      trackingType: 'weight_reps',
      actualWeight: 50,
      pulleyRatio: 0.5,
      usedMicroAddon: false,
    });
    expect(eff1).toBe(25.0);

    // 2. Kabelturm mit 50 kg + 2.5 kg Micro-Addon -> (50 + 2.5) * 0.5 = 26.25 kg
    const eff2 = calculateEffectiveWeight({
      equipmentType: 'cable_stack',
      trackingType: 'weight_reps',
      actualWeight: 50,
      pulleyRatio: 0.5,
      usedMicroAddon: true,
      stackMicroAddonKg: 2.5,
    });
    expect(eff2).toBe(26.25);

    // 3. Latzug Turm mit 1:1 Direktzug -> 70 kg + 2.5 kg = 72.5 kg
    const eff3 = calculateEffectiveWeight({
      equipmentType: 'cable_stack',
      trackingType: 'weight_reps',
      actualWeight: 70,
      pulleyRatio: 1.0,
      usedMicroAddon: true,
      stackMicroAddonKg: 2.5,
    });
    expect(eff3).toBe(72.5);

    // 4. Plate-Loaded 45° Beinpresse -> 120 kg Scheiben + 50 kg Schlitten = 170 kg
    const eff4 = calculateEffectiveWeight({
      equipmentType: 'plate_loaded',
      trackingType: 'weight_reps',
      actualWeight: 120,
      defaultBarOrSledWeightKg: 50,
    });
    expect(eff4).toBe(170.0);

    // 5. Bodyweight Klimmzüge -> 82 kg Körpergewicht * 1.0 + 15 kg Zusatzgewicht = 97 kg
    const eff5 = calculateEffectiveWeight({
      equipmentType: 'bodyweight',
      trackingType: 'bodyweight_reps',
      actualWeight: 15,
      userBodyweightKg: 82,
      bodyweightFactor: 1.0,
    });
    expect(eff5).toBe(97.0);

    // 6. Assisted Bodyweight Klimmzüge -> 80 kg Körpergewicht - 25 kg Unterstützung = 55 kg
    const eff6 = calculateEffectiveWeight({
      equipmentType: 'machine_stack',
      trackingType: 'assisted_bodyweight',
      actualWeight: 25,
      userBodyweightKg: 80,
      bodyweightFactor: 1.0,
    });
    expect(eff6).toBe(55.0);
  });

  it('erlaubt fehlerfreies Anlegen und Verknüpfen von Workout- und Set-Einträgen', async () => {
    await seedDatabase(db);

    const now = new Date().toISOString();

    // Workout anlegen
    const workoutId = '30000000-0000-4000-8000-000000000001';
    await db.workouts.add({
      id: workoutId,
      routine_id: null,
      gym_profile_id: SEED_GYM_PROFILE_ID,
      title: 'Oberkörper Hypertrophie (Test)',
      top_note: 'Fokus auf saubere Exzentrik',
      started_at: now,
      finished_at: null,
      is_deload_session: false,
      created_at: now,
      updated_at: now,
    });

    // Erste Übung im Workout verknüpfen (gym80 Brustpresse)
    const workoutExId = '40000000-0000-4000-8000-000000000001';
    await db.workout_exercises.add({
      id: workoutExId,
      workout_id: workoutId,
      exercise_id: '20000000-0000-4000-8000-000000000001',
      order_index: 0,
      superset_group_id: null,
      session_note: 'Sitz auf 4 eingestellt',
      pause_progression: false,
      created_at: now,
      updated_at: now,
    });

    // Arbeitssatz mit Micro-Addon anlegen
    const setId = '50000000-0000-4000-8000-000000000001';
    const effectiveWeight = calculateEffectiveWeight({
      equipmentType: 'machine_stack',
      trackingType: 'weight_reps',
      actualWeight: 75,
      usedMicroAddon: true,
      stackMicroAddonKg: 2.5,
      pulleyRatio: 1.0,
    });

    await db.workout_sets.add({
      id: setId,
      workout_exercise_id: workoutExId,
      set_number: 1,
      side: 'both',
      set_type: 'working',
      target_weight_snapshot: 75,
      target_reps_min_snapshot: 8,
      target_reps_max_snapshot: 12,
      target_rir_snapshot: 1,
      actual_weight: 75,
      effective_weight_kg: effectiveWeight,
      actual_reps: 10,
      actual_rir: 1,
      used_micro_addon: true,
      is_completed: true,
      completed_at: now,
      pr_flags: ['PR_WEIGHT'],
      created_at: now,
      updated_at: now,
    });

    // Abfragen und Verifizieren
    const savedWorkout = await db.workouts.get(workoutId);
    expect(savedWorkout).toBeDefined();
    expect(savedWorkout?.title).toBe('Oberkörper Hypertrophie (Test)');

    const savedSet = await db.workout_sets.get(setId);
    expect(savedSet).toBeDefined();
    expect(savedSet?.effective_weight_kg).toBe(77.5);
    expect(savedSet?.used_micro_addon).toBe(true);
    expect(savedSet?.actual_reps).toBe(10);
  });
});
