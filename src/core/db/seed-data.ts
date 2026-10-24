import type {
  GymProfile,
  Muscle,
  Exercise,
  RoutineTemplate,
  ProgressionRule,
} from '../models/types.ts';

const SEED_TIMESTAMP = '2026-01-01T00:00:00.000Z';

export const SEED_GYM_PROFILE_ID = '10000000-0000-4000-8000-000000000001';

export const SEED_GYM_PROFILE: GymProfile = {
  id: SEED_GYM_PROFILE_ID,
  name: 'McFit Bruchsal (gym80)',
  is_default: true,
  dumbbell_list_kg: [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    12, 14, 16, 18, 20, 22, 24, 26, 28, 30,
    32, 34, 36, 38, 40, 42, 44, 46, 48, 50,
  ],
  available_plates_kg: [20, 15, 10, 5, 2.5, 1.25],
  barbell_options_kg: [20, 15, 10], // Olympia (20kg), kurz (15kg), SZ (10kg)
  stack_increment_kg: 5.0,
  stack_micro_addon_kg: 2.5,
  created_at: SEED_TIMESTAMP,
  updated_at: SEED_TIMESTAMP,
};

export const SEED_MUSCLES: Muscle[] = [
  // Brust
  { id: 'chest_upper', name_de: 'Obere Brust (Klavikular)', muscle_group: 'Brust', created_at: SEED_TIMESTAMP, updated_at: SEED_TIMESTAMP },
  { id: 'chest_mid', name_de: 'Mittlere Brust (Sternal)', muscle_group: 'Brust', created_at: SEED_TIMESTAMP, updated_at: SEED_TIMESTAMP },
  { id: 'chest_lower', name_de: 'Untere Brust (Abdominal)', muscle_group: 'Brust', created_at: SEED_TIMESTAMP, updated_at: SEED_TIMESTAMP },
  // Schultern (getrennte Köpfe)
  { id: 'delts_front', name_de: 'Vordere Schulter', muscle_group: 'Schultern', created_at: SEED_TIMESTAMP, updated_at: SEED_TIMESTAMP },
  { id: 'delts_side', name_de: 'Seitliche Schulter', muscle_group: 'Schultern', created_at: SEED_TIMESTAMP, updated_at: SEED_TIMESTAMP },
  { id: 'delts_rear', name_de: 'Hintere Schulter', muscle_group: 'Schultern', created_at: SEED_TIMESTAMP, updated_at: SEED_TIMESTAMP },
  // Rücken
  { id: 'lats', name_de: 'Breiter Rücken (Latissimus)', muscle_group: 'Rücken', created_at: SEED_TIMESTAMP, updated_at: SEED_TIMESTAMP },
  { id: 'upper_back', name_de: 'Oberer Rücken / Trapez', muscle_group: 'Rücken', created_at: SEED_TIMESTAMP, updated_at: SEED_TIMESTAMP },
  { id: 'lower_back', name_de: 'Unterer Rücken (Rückenstrecker)', muscle_group: 'Rücken', created_at: SEED_TIMESTAMP, updated_at: SEED_TIMESTAMP },
  // Arme
  { id: 'biceps', name_de: 'Bizeps', muscle_group: 'Arme', created_at: SEED_TIMESTAMP, updated_at: SEED_TIMESTAMP },
  { id: 'triceps', name_de: 'Trizeps', muscle_group: 'Arme', created_at: SEED_TIMESTAMP, updated_at: SEED_TIMESTAMP },
  { id: 'forearms', name_de: 'Unterarme', muscle_group: 'Arme', created_at: SEED_TIMESTAMP, updated_at: SEED_TIMESTAMP },
  // Beine
  { id: 'quads', name_de: 'Quadrizeps (Beinstrecker)', muscle_group: 'Beine', created_at: SEED_TIMESTAMP, updated_at: SEED_TIMESTAMP },
  { id: 'hamstrings', name_de: 'Beinbeuger (Ischiocrural)', muscle_group: 'Beine', created_at: SEED_TIMESTAMP, updated_at: SEED_TIMESTAMP },
  { id: 'glutes', name_de: 'Gesäßmuskulatur (Gluteus)', muscle_group: 'Beine', created_at: SEED_TIMESTAMP, updated_at: SEED_TIMESTAMP },
  { id: 'calves', name_de: 'Waden (Gastrocnemius & Soleus)', muscle_group: 'Beine', created_at: SEED_TIMESTAMP, updated_at: SEED_TIMESTAMP },
  // Core
  { id: 'abs', name_de: 'Bauchmuskeln (Abs)', muscle_group: 'Core', created_at: SEED_TIMESTAMP, updated_at: SEED_TIMESTAMP },
];

export interface SeedExerciseDefinition {
  exercise: Exercise;
  muscles: Array<{
    muscle_id: string;
    role: 'primary' | 'secondary' | 'tertiary';
    volume_weight: 1.0 | 0.5 | 0.25;
  }>;
}

export const SEED_EXERCISES_DATA: SeedExerciseDefinition[] = [
  // 1. gym80 Brustpresse Sitzend
  {
    exercise: {
      id: '20000000-0000-4000-8000-000000000001',
      name: 'gym80 Brustpresse Sitzend',
      tracking_type: 'weight_reps',
      equipment_type: 'machine_stack',
      movement_type: 'compound',
      laterality: 'bilateral',
      pulley_ratio: 1.0,
      default_bar_or_sled_weight_kg: 0,
      bodyweight_factor: 0,
      pinned_setup_note: 'Sitzhöhe so einstellen, dass Griffe auf Brustmitte liegen.',
      custom_rest_seconds: 120,
      best_1rm: null,
      best_10rm: null,
      max_volume_set: null,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP,
    },
    muscles: [
      { muscle_id: 'chest_mid', role: 'primary', volume_weight: 1.0 },
      { muscle_id: 'delts_front', role: 'secondary', volume_weight: 0.5 },
      { muscle_id: 'triceps', role: 'secondary', volume_weight: 0.5 },
    ],
  },
  // 2. gym80 Pure Kraft Schrägbankmaschine
  {
    exercise: {
      id: '20000000-0000-4000-8000-000000000002',
      name: 'gym80 Pure Kraft Schrägbankmaschine',
      tracking_type: 'weight_reps',
      equipment_type: 'plate_loaded',
      movement_type: 'compound',
      laterality: 'bilateral',
      pulley_ratio: 1.0,
      default_bar_or_sled_weight_kg: 15,
      bodyweight_factor: 0,
      pinned_setup_note: 'Sitz auf 3, Hebel auf obere Brusthöhe.',
      custom_rest_seconds: 150,
      best_1rm: null,
      best_10rm: null,
      max_volume_set: null,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP,
    },
    muscles: [
      { muscle_id: 'chest_upper', role: 'primary', volume_weight: 1.0 },
      { muscle_id: 'delts_front', role: 'secondary', volume_weight: 0.5 },
      { muscle_id: 'triceps', role: 'secondary', volume_weight: 0.5 },
    ],
  },
  // 3. Langhantel-Bankdrücken Flach
  {
    exercise: {
      id: '20000000-0000-4000-8000-000000000003',
      name: 'Langhantel-Bankdrücken Flach',
      tracking_type: 'weight_reps',
      equipment_type: 'barbell',
      movement_type: 'compound',
      laterality: 'bilateral',
      pulley_ratio: 1.0,
      default_bar_or_sled_weight_kg: 20, // 20kg Olympia-Stange
      bodyweight_factor: 0,
      pinned_setup_note: 'Olympia-Stange (20kg), Sicherheitsbügel auf Stufe 3.',
      custom_rest_seconds: 180,
      best_1rm: null,
      best_10rm: null,
      max_volume_set: null,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP,
    },
    muscles: [
      { muscle_id: 'chest_mid', role: 'primary', volume_weight: 1.0 },
      { muscle_id: 'triceps', role: 'secondary', volume_weight: 0.5 },
      { muscle_id: 'delts_front', role: 'secondary', volume_weight: 0.5 },
    ],
  },
  // 4. Kurzhantel-Schrägbankdrücken (30 Grad)
  {
    exercise: {
      id: '20000000-0000-4000-8000-000000000004',
      name: 'Kurzhantel-Schrägbankdrücken (30 Grad)',
      tracking_type: 'weight_reps',
      equipment_type: 'dumbbell',
      movement_type: 'compound',
      laterality: 'bilateral',
      pulley_ratio: 1.0,
      default_bar_or_sled_weight_kg: 0,
      bodyweight_factor: 0,
      pinned_setup_note: 'Bankwinkel 30 Grad (Raster 2).',
      custom_rest_seconds: 120,
      best_1rm: null,
      best_10rm: null,
      max_volume_set: null,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP,
    },
    muscles: [
      { muscle_id: 'chest_upper', role: 'primary', volume_weight: 1.0 },
      { muscle_id: 'delts_front', role: 'secondary', volume_weight: 0.5 },
      { muscle_id: 'triceps', role: 'secondary', volume_weight: 0.5 },
    ],
  },
  // 5. gym80 Butterfly (Pec Deck)
  {
    exercise: {
      id: '20000000-0000-4000-8000-000000000005',
      name: 'gym80 Butterfly (Pec Deck)',
      tracking_type: 'weight_reps',
      equipment_type: 'machine_stack',
      movement_type: 'isolation',
      laterality: 'bilateral',
      pulley_ratio: 1.0,
      default_bar_or_sled_weight_kg: 0,
      bodyweight_factor: 0,
      pinned_setup_note: 'Sitzhöhe 4, Armpolster im 90-Grad-Winkel.',
      custom_rest_seconds: 90,
      best_1rm: null,
      best_10rm: null,
      max_volume_set: null,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP,
    },
    muscles: [
      { muscle_id: 'chest_mid', role: 'primary', volume_weight: 1.0 },
      { muscle_id: 'delts_front', role: 'tertiary', volume_weight: 0.25 },
    ],
  },
  // 6. gym80 Latzug Turm (Breiter Obergriff)
  {
    exercise: {
      id: '20000000-0000-4000-8000-000000000006',
      name: 'gym80 Latzug Turm (Breiter Obergriff)',
      tracking_type: 'weight_reps',
      equipment_type: 'cable_stack',
      movement_type: 'compound',
      laterality: 'bilateral',
      pulley_ratio: 1.0, // 1:1 am Latzugturm
      default_bar_or_sled_weight_kg: 0,
      bodyweight_factor: 0,
      pinned_setup_note: 'Beinpolster fest fixieren, breite Latzugstange.',
      custom_rest_seconds: 120,
      best_1rm: null,
      best_10rm: null,
      max_volume_set: null,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP,
    },
    muscles: [
      { muscle_id: 'lats', role: 'primary', volume_weight: 1.0 },
      { muscle_id: 'biceps', role: 'secondary', volume_weight: 0.5 },
      { muscle_id: 'upper_back', role: 'secondary', volume_weight: 0.5 },
    ],
  },
  // 7. gym80 Rudern Sitzend (Kabelzug Parallelgriff)
  {
    exercise: {
      id: '20000000-0000-4000-8000-000000000007',
      name: 'gym80 Rudern Sitzend (Kabelzug)',
      tracking_type: 'weight_reps',
      equipment_type: 'cable_stack',
      movement_type: 'compound',
      laterality: 'bilateral',
      pulley_ratio: 1.0, // 1:1 am Ruderzug
      default_bar_or_sled_weight_kg: 0,
      bodyweight_factor: 0,
      pinned_setup_note: 'Enger Parallel-V-Griff, Knie minimal gebeugt.',
      custom_rest_seconds: 120,
      best_1rm: null,
      best_10rm: null,
      max_volume_set: null,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP,
    },
    muscles: [
      { muscle_id: 'upper_back', role: 'primary', volume_weight: 1.0 },
      { muscle_id: 'lats', role: 'secondary', volume_weight: 0.5 },
      { muscle_id: 'biceps', role: 'secondary', volume_weight: 0.5 },
    ],
  },
  // 8. gym80 Pure Kraft Rudermaschine Unilateral
  {
    exercise: {
      id: '20000000-0000-4000-8000-000000000008',
      name: 'gym80 Pure Kraft Rudermaschine Unilateral',
      tracking_type: 'weight_reps',
      equipment_type: 'plate_loaded',
      movement_type: 'compound',
      laterality: 'unilateral',
      pulley_ratio: 1.0,
      default_bar_or_sled_weight_kg: 10,
      bodyweight_factor: 0,
      pinned_setup_note: 'Brustpolster auf 3, neutraler Einhand-Griff.',
      custom_rest_seconds: 90,
      best_1rm: null,
      best_10rm: null,
      max_volume_set: null,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP,
    },
    muscles: [
      { muscle_id: 'lats', role: 'primary', volume_weight: 1.0 },
      { muscle_id: 'upper_back', role: 'secondary', volume_weight: 0.5 },
      { muscle_id: 'biceps', role: 'secondary', volume_weight: 0.5 },
    ],
  },
  // 9. gym80 Latzug Enger Untergriff (Kabelturm)
  {
    exercise: {
      id: '20000000-0000-4000-8000-000000000009',
      name: 'gym80 Latzug Enger Untergriff (Kabelturm)',
      tracking_type: 'weight_reps',
      equipment_type: 'cable_stack',
      movement_type: 'compound',
      laterality: 'bilateral',
      pulley_ratio: 1.0,
      default_bar_or_sled_weight_kg: 0,
      bodyweight_factor: 0,
      pinned_setup_note: 'Enge SZ-Stange im Untergriff.',
      custom_rest_seconds: 120,
      best_1rm: null,
      best_10rm: null,
      max_volume_set: null,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP,
    },
    muscles: [
      { muscle_id: 'lats', role: 'primary', volume_weight: 1.0 },
      { muscle_id: 'biceps', role: 'secondary', volume_weight: 0.5 },
    ],
  },
  // 10. gym80 Kabelturm Trizepsdrücken (Seil)
  {
    exercise: {
      id: '20000000-0000-4000-8000-000000000010',
      name: 'gym80 Kabelturm Trizepsdrücken (Seil)',
      tracking_type: 'weight_reps',
      equipment_type: 'cable_stack',
      movement_type: 'isolation',
      laterality: 'bilateral',
      pulley_ratio: 0.5, // 1:2 Flaschenzug am verstellbaren Turm!
      default_bar_or_sled_weight_kg: 0,
      bodyweight_factor: 0,
      pinned_setup_note: 'Höhenverstellung ganz oben, Seil am Ende spreizen.',
      custom_rest_seconds: 90,
      best_1rm: null,
      best_10rm: null,
      max_volume_set: null,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP,
    },
    muscles: [
      { muscle_id: 'triceps', role: 'primary', volume_weight: 1.0 },
    ],
  },
  // 11. gym80 Kabelturm Trizepsdrücken (Gerade Stange)
  {
    exercise: {
      id: '20000000-0000-4000-8000-000000000011',
      name: 'gym80 Kabelturm Trizepsdrücken (Gerade Stange)',
      tracking_type: 'weight_reps',
      equipment_type: 'cable_stack',
      movement_type: 'isolation',
      laterality: 'bilateral',
      pulley_ratio: 0.5, // 1:2 Flaschenzug
      default_bar_or_sled_weight_kg: 0,
      bodyweight_factor: 0,
      pinned_setup_note: 'Rolle ganz oben, kurze Drehgelenk-Stange.',
      custom_rest_seconds: 90,
      best_1rm: null,
      best_10rm: null,
      max_volume_set: null,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP,
    },
    muscles: [
      { muscle_id: 'triceps', role: 'primary', volume_weight: 1.0 },
    ],
  },
  // 12. gym80 Kabelturm Seitheben Unilateral
  {
    exercise: {
      id: '20000000-0000-4000-8000-000000000012',
      name: 'gym80 Kabelturm Seitheben Unilateral',
      tracking_type: 'weight_reps',
      equipment_type: 'cable_stack',
      movement_type: 'isolation',
      laterality: 'unilateral',
      pulley_ratio: 0.5, // 1:2 Flaschenzug
      default_bar_or_sled_weight_kg: 0,
      bodyweight_factor: 0,
      pinned_setup_note: 'Rolle auf Kniehöhe einrasten, Handgelenkschlaufe.',
      custom_rest_seconds: 60,
      best_1rm: null,
      best_10rm: null,
      max_volume_set: null,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP,
    },
    muscles: [
      { muscle_id: 'delts_side', role: 'primary', volume_weight: 1.0 },
    ],
  },
  // 13. gym80 Schulterpresse Sitzend (Steckgewicht)
  {
    exercise: {
      id: '20000000-0000-4000-8000-000000000013',
      name: 'gym80 Schulterpresse Sitzend',
      tracking_type: 'weight_reps',
      equipment_type: 'machine_stack',
      movement_type: 'compound',
      laterality: 'bilateral',
      pulley_ratio: 1.0,
      default_bar_or_sled_weight_kg: 0,
      bodyweight_factor: 0,
      pinned_setup_note: 'Sitz auf 5, Griffe auf Kinnhöhe.',
      custom_rest_seconds: 120,
      best_1rm: null,
      best_10rm: null,
      max_volume_set: null,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP,
    },
    muscles: [
      { muscle_id: 'delts_front', role: 'primary', volume_weight: 1.0 },
      { muscle_id: 'delts_side', role: 'secondary', volume_weight: 0.5 },
      { muscle_id: 'triceps', role: 'secondary', volume_weight: 0.5 },
    ],
  },
  // 14. gym80 Reverse Butterfly (Hintere Schulter)
  {
    exercise: {
      id: '20000000-0000-4000-8000-000000000014',
      name: 'gym80 Reverse Butterfly (Hintere Schulter)',
      tracking_type: 'weight_reps',
      equipment_type: 'machine_stack',
      movement_type: 'isolation',
      laterality: 'bilateral',
      pulley_ratio: 1.0,
      default_bar_or_sled_weight_kg: 0,
      bodyweight_factor: 0,
      pinned_setup_note: 'Sitz auf 4, Hebel ganz nach hinten gerastert.',
      custom_rest_seconds: 90,
      best_1rm: null,
      best_10rm: null,
      max_volume_set: null,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP,
    },
    muscles: [
      { muscle_id: 'delts_rear', role: 'primary', volume_weight: 1.0 },
      { muscle_id: 'upper_back', role: 'secondary', volume_weight: 0.5 },
    ],
  },
  // 15. Kurzhantel-Seitheben Stehend
  {
    exercise: {
      id: '20000000-0000-4000-8000-000000000015',
      name: 'Kurzhantel-Seitheben Stehend',
      tracking_type: 'weight_reps',
      equipment_type: 'dumbbell',
      movement_type: 'isolation',
      laterality: 'bilateral',
      pulley_ratio: 1.0,
      default_bar_or_sled_weight_kg: 0,
      bodyweight_factor: 0,
      pinned_setup_note: 'Leichte Vorneige, Ellenbogen führen die Bewegung.',
      custom_rest_seconds: 75,
      best_1rm: null,
      best_10rm: null,
      max_volume_set: null,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP,
    },
    muscles: [
      { muscle_id: 'delts_side', role: 'primary', volume_weight: 1.0 },
    ],
  },
  // 16. gym80 Kabelturm Bizepscurls (Stange)
  {
    exercise: {
      id: '20000000-0000-4000-8000-000000000016',
      name: 'gym80 Kabelturm Bizepscurls (Stange)',
      tracking_type: 'weight_reps',
      equipment_type: 'cable_stack',
      movement_type: 'isolation',
      laterality: 'bilateral',
      pulley_ratio: 0.5, // 1:2 Flaschenzug
      default_bar_or_sled_weight_kg: 0,
      bodyweight_factor: 0,
      pinned_setup_note: 'Rolle ganz unten eingerastet, kurze Drehstange.',
      custom_rest_seconds: 90,
      best_1rm: null,
      best_10rm: null,
      max_volume_set: null,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP,
    },
    muscles: [
      { muscle_id: 'biceps', role: 'primary', volume_weight: 1.0 },
      { muscle_id: 'forearms', role: 'tertiary', volume_weight: 0.25 },
    ],
  },
  // 17. Kurzhantel-Schrägbank-Bizepscurls
  {
    exercise: {
      id: '20000000-0000-4000-8000-000000000017',
      name: 'Kurzhantel-Schrägbank-Bizepscurls',
      tracking_type: 'weight_reps',
      equipment_type: 'dumbbell',
      movement_type: 'isolation',
      laterality: 'bilateral',
      pulley_ratio: 1.0,
      default_bar_or_sled_weight_kg: 0,
      bodyweight_factor: 0,
      pinned_setup_note: 'Bankwinkel ca. 60 Grad (Raster 4), voller Dehnungsfokus.',
      custom_rest_seconds: 90,
      best_1rm: null,
      best_10rm: null,
      max_volume_set: null,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP,
    },
    muscles: [
      { muscle_id: 'biceps', role: 'primary', volume_weight: 1.0 },
    ],
  },
  // 18. gym80 Beinpresse 45 Grad (Pure Kraft Plate-Loaded)
  {
    exercise: {
      id: '20000000-0000-4000-8000-000000000018',
      name: 'gym80 Beinpresse 45 Grad',
      tracking_type: 'weight_reps',
      equipment_type: 'plate_loaded',
      movement_type: 'compound',
      laterality: 'bilateral',
      pulley_ratio: 1.0,
      default_bar_or_sled_weight_kg: 50, // Schlitteneigengewicht 50 kg
      bodyweight_factor: 0,
      pinned_setup_note: 'Schlittengewicht 50 kg, Rückenlehne Raster 3.',
      custom_rest_seconds: 180,
      best_1rm: null,
      best_10rm: null,
      max_volume_set: null,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP,
    },
    muscles: [
      { muscle_id: 'quads', role: 'primary', volume_weight: 1.0 },
      { muscle_id: 'glutes', role: 'secondary', volume_weight: 0.5 },
    ],
  },
  // 19. gym80 Beinstrecker Sitzend (Leg Extension)
  {
    exercise: {
      id: '20000000-0000-4000-8000-000000000019',
      name: 'gym80 Beinstrecker Sitzend',
      tracking_type: 'weight_reps',
      equipment_type: 'machine_stack',
      movement_type: 'isolation',
      laterality: 'bilateral',
      pulley_ratio: 1.0,
      default_bar_or_sled_weight_kg: 0,
      bodyweight_factor: 0,
      pinned_setup_note: 'Drehachse auf Kniegelenk, Schienbeinpolster auf 3.',
      custom_rest_seconds: 90,
      best_1rm: null,
      best_10rm: null,
      max_volume_set: null,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP,
    },
    muscles: [
      { muscle_id: 'quads', role: 'primary', volume_weight: 1.0 },
    ],
  },
  // 20. gym80 Beinbeuger Liegend (Leg Curl)
  {
    exercise: {
      id: '20000000-0000-4000-8000-000000000020',
      name: 'gym80 Beinbeuger Liegend',
      tracking_type: 'weight_reps',
      equipment_type: 'machine_stack',
      movement_type: 'isolation',
      laterality: 'bilateral',
      pulley_ratio: 1.0,
      default_bar_or_sled_weight_kg: 0,
      bodyweight_factor: 0,
      pinned_setup_note: 'Knie knapp unter Polsterkante, Fersenpolster an Achillessehne.',
      custom_rest_seconds: 90,
      best_1rm: null,
      best_10rm: null,
      max_volume_set: null,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP,
    },
    muscles: [
      { muscle_id: 'hamstrings', role: 'primary', volume_weight: 1.0 },
      { muscle_id: 'calves', role: 'tertiary', volume_weight: 0.25 },
    ],
  },
  // 21. gym80 Beinbeuger Sitzend (Seated Leg Curl)
  {
    exercise: {
      id: '20000000-0000-4000-8000-000000000021',
      name: 'gym80 Beinbeuger Sitzend',
      tracking_type: 'weight_reps',
      equipment_type: 'machine_stack',
      movement_type: 'isolation',
      laterality: 'bilateral',
      pulley_ratio: 1.0,
      default_bar_or_sled_weight_kg: 0,
      bodyweight_factor: 0,
      pinned_setup_note: 'Oberschenkelpolster fest arretieren.',
      custom_rest_seconds: 90,
      best_1rm: null,
      best_10rm: null,
      max_volume_set: null,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP,
    },
    muscles: [
      { muscle_id: 'hamstrings', role: 'primary', volume_weight: 1.0 },
    ],
  },
  // 22. gym80 Wadenheben Sitzend (Plate-Loaded)
  {
    exercise: {
      id: '20000000-0000-4000-8000-000000000022',
      name: 'gym80 Wadenheben Sitzend',
      tracking_type: 'weight_reps',
      equipment_type: 'plate_loaded',
      movement_type: 'isolation',
      laterality: 'bilateral',
      pulley_ratio: 1.0,
      default_bar_or_sled_weight_kg: 10,
      bodyweight_factor: 0,
      pinned_setup_note: 'Kniepolster auf 3, voller Dehnungsradius nach unten.',
      custom_rest_seconds: 75,
      best_1rm: null,
      best_10rm: null,
      max_volume_set: null,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP,
    },
    muscles: [
      { muscle_id: 'calves', role: 'primary', volume_weight: 1.0 },
    ],
  },
  // 23. gym80 Wadenheben Stehend (Steckgewicht)
  {
    exercise: {
      id: '20000000-0000-4000-8000-000000000023',
      name: 'gym80 Wadenheben Stehend',
      tracking_type: 'weight_reps',
      equipment_type: 'machine_stack',
      movement_type: 'isolation',
      laterality: 'bilateral',
      pulley_ratio: 1.0,
      default_bar_or_sled_weight_kg: 0,
      bodyweight_factor: 0,
      pinned_setup_note: 'Schulterpolster passend einstellen, 2 Sek Haltepause am Tiefpunkt.',
      custom_rest_seconds: 75,
      best_1rm: null,
      best_10rm: null,
      max_volume_set: null,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP,
    },
    muscles: [
      { muscle_id: 'calves', role: 'primary', volume_weight: 1.0 },
    ],
  },
  // 24. Klimmzüge am Turm (Eigengewicht / Zusatzgewicht)
  {
    exercise: {
      id: '20000000-0000-4000-8000-000000000024',
      name: 'Klimmzüge am Turm (Obergriff)',
      tracking_type: 'bodyweight_reps',
      equipment_type: 'bodyweight',
      movement_type: 'compound',
      laterality: 'bilateral',
      pulley_ratio: 1.0,
      default_bar_or_sled_weight_kg: 0,
      bodyweight_factor: 1.0, // 100% Körpergewicht als Basis
      pinned_setup_note: 'Breiter Obergriff am gym80 Turm, volle Streckung im Hang.',
      custom_rest_seconds: 150,
      best_1rm: null,
      best_10rm: null,
      max_volume_set: null,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP,
    },
    muscles: [
      { muscle_id: 'lats', role: 'primary', volume_weight: 1.0 },
      { muscle_id: 'biceps', role: 'secondary', volume_weight: 0.5 },
      { muscle_id: 'upper_back', role: 'secondary', volume_weight: 0.5 },
    ],
  },
  // 25. Dips am Barren (Eigengewicht / Zusatzgewicht)
  {
    exercise: {
      id: '20000000-0000-4000-8000-000000000025',
      name: 'Dips am Barren',
      tracking_type: 'bodyweight_reps',
      equipment_type: 'bodyweight',
      movement_type: 'compound',
      laterality: 'bilateral',
      pulley_ratio: 1.0,
      default_bar_or_sled_weight_kg: 0,
      bodyweight_factor: 1.0, // 100% Körpergewicht als Basis
      pinned_setup_note: 'Leichte Vorneige für Brustfokus, Dip-Gürtel für Zusatzgewicht.',
      custom_rest_seconds: 150,
      best_1rm: null,
      best_10rm: null,
      max_volume_set: null,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP,
    },
    muscles: [
      { muscle_id: 'chest_lower', role: 'primary', volume_weight: 1.0 },
      { muscle_id: 'triceps', role: 'secondary', volume_weight: 0.5 },
      { muscle_id: 'delts_front', role: 'secondary', volume_weight: 0.5 },
    ],
  },
];

export interface SeedRoutineDefinition {
  routine: RoutineTemplate;
  exercises: Array<{
    exercise_id: string;
    order_index: number;
    rest_seconds: number;
    progression_rule: ProgressionRule;
    sets: Array<{
      set_index: number;
      set_type: 'warmup' | 'working' | 'drop';
      target_reps_min: number;
      target_reps_max: number;
      target_weight_stack: number | null;
      target_rir: number | null;
    }>;
  }>;
}

export const SEED_SAMPLE_ROUTINES: SeedRoutineDefinition[] = [
  // 1. Push A (Brust / Vordere & Seitliche Schulter / Trizeps)
  {
    routine: {
      id: 'routine-sample-push-a',
      name: 'Push A (gym80 Brust / Schulter / Trizeps)',
      split_category: 'Push/Pull/Legs',
      order_index: 0,
      is_archived: false,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP,
    },
    exercises: [
      {
        exercise_id: '20000000-0000-4000-8000-000000000001', // gym80 Brustpresse Sitzend
        order_index: 0,
        rest_seconds: 120,
        progression_rule: { type: 'double_progression', rep_range: [8, 12], target_rir: 1, deload_after_fails: 3 },
        sets: [
          { set_index: 0, set_type: 'warmup', target_reps_min: 12, target_reps_max: 15, target_weight_stack: 30, target_rir: 3 },
          { set_index: 1, set_type: 'working', target_reps_min: 8, target_reps_max: 12, target_weight_stack: 50, target_rir: 1 },
          { set_index: 2, set_type: 'working', target_reps_min: 8, target_reps_max: 12, target_weight_stack: 50, target_rir: 1 },
          { set_index: 3, set_type: 'working', target_reps_min: 8, target_reps_max: 12, target_weight_stack: 50, target_rir: 1 },
        ],
      },
      {
        exercise_id: '20000000-0000-4000-8000-000000000002', // gym80 Pure Kraft Schrägbankmaschine
        order_index: 1,
        rest_seconds: 150,
        progression_rule: { type: 'double_progression', rep_range: [8, 12], target_rir: 1, deload_after_fails: 3 },
        sets: [
          { set_index: 0, set_type: 'working', target_reps_min: 8, target_reps_max: 12, target_weight_stack: 40, target_rir: 1 },
          { set_index: 1, set_type: 'working', target_reps_min: 8, target_reps_max: 12, target_weight_stack: 40, target_rir: 1 },
          { set_index: 2, set_type: 'working', target_reps_min: 8, target_reps_max: 12, target_weight_stack: 40, target_rir: 1 },
        ],
      },
      {
        exercise_id: '20000000-0000-4000-8000-000000000012', // gym80 Kabelturm Seitheben Unilateral
        order_index: 2,
        rest_seconds: 60,
        progression_rule: { type: 'double_progression', rep_range: [12, 15], target_rir: 1, deload_after_fails: 3 },
        sets: [
          { set_index: 0, set_type: 'working', target_reps_min: 12, target_reps_max: 15, target_weight_stack: 15, target_rir: 1 },
          { set_index: 1, set_type: 'working', target_reps_min: 12, target_reps_max: 15, target_weight_stack: 15, target_rir: 1 },
          { set_index: 2, set_type: 'working', target_reps_min: 12, target_reps_max: 15, target_weight_stack: 15, target_rir: 1 },
        ],
      },
      {
        exercise_id: '20000000-0000-4000-8000-000000000010', // gym80 Kabelturm Trizepsdrücken (Seil)
        order_index: 3,
        rest_seconds: 90,
        progression_rule: { type: 'double_progression', rep_range: [10, 12], target_rir: 1, deload_after_fails: 3 },
        sets: [
          { set_index: 0, set_type: 'working', target_reps_min: 10, target_reps_max: 12, target_weight_stack: 25, target_rir: 1 },
          { set_index: 1, set_type: 'working', target_reps_min: 10, target_reps_max: 12, target_weight_stack: 25, target_rir: 1 },
          { set_index: 2, set_type: 'drop', target_reps_min: 10, target_reps_max: 12, target_weight_stack: null, target_rir: 0 },
        ],
      },
    ],
  },
  // 2. Pull A (Lats / Oberer Rücken / Hintere Schulter / Bizeps)
  {
    routine: {
      id: 'routine-sample-pull-a',
      name: 'Pull A (gym80 Rücken / Hintere Schulter / Bizeps)',
      split_category: 'Push/Pull/Legs',
      order_index: 1,
      is_archived: false,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP,
    },
    exercises: [
      {
        exercise_id: '20000000-0000-4000-8000-000000000006', // gym80 Latzug Turm (Breiter Obergriff)
        order_index: 0,
        rest_seconds: 120,
        progression_rule: { type: 'double_progression', rep_range: [8, 12], target_rir: 1, deload_after_fails: 3 },
        sets: [
          { set_index: 0, set_type: 'warmup', target_reps_min: 12, target_reps_max: 15, target_weight_stack: 35, target_rir: 3 },
          { set_index: 1, set_type: 'working', target_reps_min: 8, target_reps_max: 12, target_weight_stack: 60, target_rir: 1 },
          { set_index: 2, set_type: 'working', target_reps_min: 8, target_reps_max: 12, target_weight_stack: 60, target_rir: 1 },
          { set_index: 3, set_type: 'working', target_reps_min: 8, target_reps_max: 12, target_weight_stack: 60, target_rir: 1 },
        ],
      },
      {
        exercise_id: '20000000-0000-4000-8000-000000000007', // gym80 Rudern Sitzend (Kabelzug)
        order_index: 1,
        rest_seconds: 120,
        progression_rule: { type: 'double_progression', rep_range: [8, 12], target_rir: 1, deload_after_fails: 3 },
        sets: [
          { set_index: 0, set_type: 'working', target_reps_min: 8, target_reps_max: 12, target_weight_stack: 55, target_rir: 1 },
          { set_index: 1, set_type: 'working', target_reps_min: 8, target_reps_max: 12, target_weight_stack: 55, target_rir: 1 },
          { set_index: 2, set_type: 'working', target_reps_min: 8, target_reps_max: 12, target_weight_stack: 55, target_rir: 1 },
        ],
      },
      {
        exercise_id: '20000000-0000-4000-8000-000000000014', // gym80 Reverse Butterfly (Hintere Schulter)
        order_index: 2,
        rest_seconds: 90,
        progression_rule: { type: 'double_progression', rep_range: [12, 15], target_rir: 1, deload_after_fails: 3 },
        sets: [
          { set_index: 0, set_type: 'working', target_reps_min: 12, target_reps_max: 15, target_weight_stack: 30, target_rir: 1 },
          { set_index: 1, set_type: 'working', target_reps_min: 12, target_reps_max: 15, target_weight_stack: 30, target_rir: 1 },
          { set_index: 2, set_type: 'working', target_reps_min: 12, target_reps_max: 15, target_weight_stack: 30, target_rir: 1 },
        ],
      },
      {
        exercise_id: '20000000-0000-4000-8000-000000000016', // gym80 Kabelturm Bizepscurls (Stange)
        order_index: 3,
        rest_seconds: 90,
        progression_rule: { type: 'double_progression', rep_range: [10, 12], target_rir: 1, deload_after_fails: 3 },
        sets: [
          { set_index: 0, set_type: 'working', target_reps_min: 10, target_reps_max: 12, target_weight_stack: 25, target_rir: 1 },
          { set_index: 1, set_type: 'working', target_reps_min: 10, target_reps_max: 12, target_weight_stack: 25, target_rir: 1 },
          { set_index: 2, set_type: 'working', target_reps_min: 10, target_reps_max: 12, target_weight_stack: 25, target_rir: 1 },
        ],
      },
    ],
  },
  // 3. Legs A (Quadrizeps / Beinbeuger / Waden)
  {
    routine: {
      id: 'routine-sample-legs-a',
      name: 'Legs A (gym80 Quads / Hamstrings / Waden)',
      split_category: 'Push/Pull/Legs',
      order_index: 2,
      is_archived: false,
      created_at: SEED_TIMESTAMP,
      updated_at: SEED_TIMESTAMP,
    },
    exercises: [
      {
        exercise_id: '20000000-0000-4000-8000-000000000018', // gym80 Beinpresse 45 Grad
        order_index: 0,
        rest_seconds: 180,
        progression_rule: { type: 'double_progression', rep_range: [8, 12], target_rir: 1, deload_after_fails: 3 },
        sets: [
          { set_index: 0, set_type: 'warmup', target_reps_min: 12, target_reps_max: 15, target_weight_stack: 60, target_rir: 3 },
          { set_index: 1, set_type: 'working', target_reps_min: 8, target_reps_max: 12, target_weight_stack: 120, target_rir: 1 },
          { set_index: 2, set_type: 'working', target_reps_min: 8, target_reps_max: 12, target_weight_stack: 120, target_rir: 1 },
          { set_index: 3, set_type: 'working', target_reps_min: 8, target_reps_max: 12, target_weight_stack: 120, target_rir: 1 },
        ],
      },
      {
        exercise_id: '20000000-0000-4000-8000-000000000019', // gym80 Beinstrecker Sitzend
        order_index: 1,
        rest_seconds: 90,
        progression_rule: { type: 'double_progression', rep_range: [10, 15], target_rir: 1, deload_after_fails: 3 },
        sets: [
          { set_index: 0, set_type: 'working', target_reps_min: 10, target_reps_max: 15, target_weight_stack: 45, target_rir: 1 },
          { set_index: 1, set_type: 'working', target_reps_min: 10, target_reps_max: 15, target_weight_stack: 45, target_rir: 1 },
          { set_index: 2, set_type: 'working', target_reps_min: 10, target_reps_max: 15, target_weight_stack: 45, target_rir: 1 },
        ],
      },
      {
        exercise_id: '20000000-0000-4000-8000-000000000020', // gym80 Beinbeuger Liegend
        order_index: 2,
        rest_seconds: 90,
        progression_rule: { type: 'double_progression', rep_range: [10, 12], target_rir: 1, deload_after_fails: 3 },
        sets: [
          { set_index: 0, set_type: 'working', target_reps_min: 10, target_reps_max: 12, target_weight_stack: 35, target_rir: 1 },
          { set_index: 1, set_type: 'working', target_reps_min: 10, target_reps_max: 12, target_weight_stack: 35, target_rir: 1 },
          { set_index: 2, set_type: 'working', target_reps_min: 10, target_reps_max: 12, target_weight_stack: 35, target_rir: 1 },
        ],
      },
      {
        exercise_id: '20000000-0000-4000-8000-000000000023', // gym80 Wadenheben Stehend
        order_index: 3,
        rest_seconds: 75,
        progression_rule: { type: 'double_progression', rep_range: [10, 15], target_rir: 1, deload_after_fails: 3 },
        sets: [
          { set_index: 0, set_type: 'working', target_reps_min: 10, target_reps_max: 15, target_weight_stack: 60, target_rir: 1 },
          { set_index: 1, set_type: 'working', target_reps_min: 10, target_reps_max: 15, target_weight_stack: 60, target_rir: 1 },
          { set_index: 2, set_type: 'working', target_reps_min: 10, target_reps_max: 15, target_weight_stack: 60, target_rir: 1 },
          { set_index: 3, set_type: 'working', target_reps_min: 10, target_reps_max: 15, target_weight_stack: 60, target_rir: 1 },
        ],
      },
    ],
  },
];
