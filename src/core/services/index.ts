export {
  Gym80EquipmentService,
  type PlateCalculationResult,
  type PlateCount,
} from './gym80-equipment.service.ts';

export {
  ProgressionEngine,
  type SetTargetSnapshot,
  type ValidExerciseHistory,
} from './progression-engine.service.ts';

export {
  WorkoutLifecycleService,
  estimateE1RM,
  estimateE10RM,
  PR_WEIGHT,
  PR_REPS,
  PR_VOLUME_SET,
  PR_E1RM,
  PR_E10RM,
  type CompleteSetInput,
  type RestTimerInfo,
  type StartWorkoutResult,
} from './workout-lifecycle.service.ts';

export {
  AnalyticsService,
  type MuscleVolumeEntry,
  type VolumeMode,
  type ExerciseHistoryPoint,
  type HistoryMetric,
} from './analytics.service.ts';

export {
  BackupImportService,
  type BackupData,
  type ImportResult,
  type CsvImportResult,
} from './backup-import.service.ts';
