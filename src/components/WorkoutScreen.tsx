import React, { useState, useEffect, useCallback } from 'react';
import type {
  Workout,
  WorkoutExercise,
  WorkoutSet,
  Exercise,
  GymProfile,
} from '../core/models/types.ts';
import { db } from '../core/db/database.ts';
import { WorkoutLifecycleService } from '../core/services/workout-lifecycle.service.ts';
import { RestTimerBar } from './RestTimerBar.tsx';
import { GymKeypad, type KeypadField } from './GymKeypad.tsx';
import { PlateCalculatorModal } from './PlateCalculatorModal.tsx';
import {
  Check,
  Disc,
  PauseCircle,
  PlayCircle,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';

interface WorkoutScreenProps {
  workoutId: string;
  onFinishWorkout: () => void;
  onBack: () => void;
}

export const WorkoutScreen: React.FC<WorkoutScreenProps> = ({
  workoutId,
  onFinishWorkout,
  onBack,
}) => {
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [workoutExercises, setWorkoutExercises] = useState<WorkoutExercise[]>([]);
  const [workoutSets, setWorkoutSets] = useState<WorkoutSet[]>([]);
  const [exercisesMap, setExercisesMap] = useState<Map<string, Exercise>>(new Map());
  const [gymProfile, setGymProfile] = useState<GymProfile | null>(null);

  // Keypad State
  const [keypadOpen, setKeypadOpen] = useState<boolean>(false);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [activeField, setActiveField] = useState<KeypadField | null>(null);
  const [keypadInput, setKeypadInput] = useState<string>('');

  // Plate Calculator Modal State
  const [plateCalcOpen, setPlateCalcOpen] = useState<boolean>(false);
  const [plateCalcExercise, setPlateCalcExercise] = useState<Exercise | null>(null);
  const [plateCalcInitialWeight, setPlateCalcInitialWeight] = useState<number>(60);
  const [plateCalcTargetSetId, setPlateCalcTargetSetId] = useState<string | null>(null);

  // Editable setup note state
  const [editingNoteExId, setEditingNoteExId] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState<string>('');

  // Top note editing
  const [editingTopNote, setEditingTopNote] = useState<boolean>(false);
  const [topNoteInput, setTopNoteInput] = useState<string>('');

  // Letzter abgeschlossener Satz für Rest-Timer
  const [lastCompletedSet, setLastCompletedSet] = useState<WorkoutSet | null>(null);

  // Lade Workout-Daten
  const loadWorkoutData = useCallback(async () => {
    const w = await db.workouts.get(workoutId);
    if (!w) return;
    setWorkout(w);
    setTopNoteInput(w.top_note || '');

    const profile = await db.gym_profiles.get(w.gym_profile_id);
    if (profile) setGymProfile(profile);

    const weList = await db.workout_exercises
      .where('workout_id').equals(workoutId)
      .sortBy('order_index');
    setWorkoutExercises(weList);

    const exIds = weList.map((we) => we.exercise_id);
    const exList = await db.exercises.where('id').anyOf(exIds).toArray();
    const map = new Map<string, Exercise>();
    exList.forEach((e) => map.set(e.id, e));
    setExercisesMap(map);

    const weIds = weList.map((we) => we.id);
    const sets = await db.workout_sets
      .where('workout_exercise_id').anyOf(weIds)
      .sortBy('set_number');
    setWorkoutSets(sets);

    // Letzten Satz mit completed_at finden
    const completed = sets.filter((s) => s.is_completed && s.completed_at);
    if (completed.length > 0) {
      completed.sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || ''));
      setLastCompletedSet(completed[0]);
    }
  }, [workoutId]);

  useEffect(() => {
    loadWorkoutData();
  }, [loadWorkoutData]);

  // Speichere Top-Note
  const handleSaveTopNote = async () => {
    if (!workout) return;
    await db.workouts.update(workout.id, { top_note: topNoteInput });
    setWorkout({ ...workout, top_note: topNoteInput });
    setEditingTopNote(false);
  };

  // Toggle Pause Progression (Tagesform-Schutz)
  const handleTogglePauseProgression = async (weId: string, currentVal: boolean) => {
    await db.workout_exercises.update(weId, { pause_progression: !currentVal });
    setWorkoutExercises((prev) =>
      prev.map((we) => (we.id === weId ? { ...we, pause_progression: !currentVal } : we))
    );
  };

  // Setup-Notiz für Übung speichern
  const handleSaveSetupNote = async (exerciseId: string) => {
    await db.exercises.update(exerciseId, { pinned_setup_note: noteInput });
    setExercisesMap((prev) => {
      const next = new Map(prev);
      const ex = next.get(exerciseId);
      if (ex) {
        next.set(exerciseId, { ...ex, pinned_setup_note: noteInput });
      }
      return next;
    });
    setEditingNoteExId(null);
  };

  // Satz abhaken / abschließen
  const handleCompleteSet = async (set: WorkoutSet, weightInput?: number, repsInput?: number, rirInput?: number | null) => {
    const actual_weight = weightInput ?? set.actual_weight ?? set.target_weight_snapshot ?? 0;
    const actual_reps = repsInput ?? set.actual_reps ?? set.target_reps_min_snapshot ?? 10;
    const actual_rir = rirInput !== undefined ? rirInput : (set.actual_rir ?? set.target_rir_snapshot ?? 1);

    const { updatedSet } = await WorkoutLifecycleService.completeSet(db, set.id, {
      actual_weight,
      actual_reps,
      actual_rir,
      used_micro_addon: set.used_micro_addon,
    });

    setWorkoutSets((prev) => prev.map((s) => (s.id === set.id ? updatedSet : s)));
    setLastCompletedSet(updatedSet);
    await loadWorkoutData();
  };

  // Satz-Eingabefeld anklicken -> Keypad öffnen
  const handleOpenKeypad = (set: WorkoutSet, field: KeypadField) => {
    setActiveSetId(set.id);
    setActiveField(field);

    let val = '';
    if (field === 'weight') {
      val = (set.actual_weight ?? set.target_weight_snapshot ?? '').toString();
    } else if (field === 'reps') {
      val = (set.actual_reps ?? set.target_reps_min_snapshot ?? '').toString();
    } else if (field === 'rir') {
      val = (set.actual_rir ?? set.target_rir_snapshot ?? '').toString();
    }
    setKeypadInput(val);
    setKeypadOpen(true);
  };

  // Keypad Eingabe-Handler
  const handleKeypadDigit = (digit: string) => {
    setKeypadInput((prev) => {
      if (digit === '.' && prev.includes('.')) return prev;
      if (prev === '0' && digit !== '.') return digit;
      return prev + digit;
    });
  };

  const handleKeypadBackspace = () => {
    setKeypadInput((prev) => prev.slice(0, -1));
  };

  const handleKeypadClear = () => {
    setKeypadInput('');
  };

  const handleKeypadStep = (delta: number) => {
    const num = parseFloat(keypadInput) || 0;
    const nextVal = Math.max(0, Number((num + delta).toFixed(2)));
    setKeypadInput(nextVal.toString());
  };

  // Nahtloses Weiterspringen: Gewicht -> Wdh. -> RIR -> Satz abhaken
  const handleKeypadNextOrComplete = async () => {
    if (!activeSetId || !activeField) return;
    const currentSet = workoutSets.find((s) => s.id === activeSetId);
    if (!currentSet) return;

    const numVal = parseFloat(keypadInput) || 0;

    if (activeField === 'weight') {
      // Speichere Gewicht, springe zu Wdh
      await db.workout_sets.update(activeSetId, { actual_weight: numVal });
      setWorkoutSets((prev) => prev.map((s) => (s.id === activeSetId ? { ...s, actual_weight: numVal } : s)));
      setActiveField('reps');
      setKeypadInput((currentSet.actual_reps ?? currentSet.target_reps_min_snapshot ?? 10).toString());
    } else if (activeField === 'reps') {
      // Speichere Wdh, springe zu RIR
      const repsVal = Math.round(numVal);
      await db.workout_sets.update(activeSetId, { actual_reps: repsVal });
      setWorkoutSets((prev) => prev.map((s) => (s.id === activeSetId ? { ...s, actual_reps: repsVal } : s)));
      setActiveField('rir');
      setKeypadInput((currentSet.actual_rir ?? currentSet.target_rir_snapshot ?? 1).toString());
    } else if (activeField === 'rir') {
      // Schließe den Satz ab!
      const rirVal = Math.round(numVal);
      await handleCompleteSet(currentSet, currentSet.actual_weight ?? undefined, currentSet.actual_reps ?? undefined, rirVal);
      setKeypadOpen(false);
      setActiveSetId(null);
      setActiveField(null);
    }
  };

  // Satz hinzufügen
  const handleAddSet = async (weId: string) => {
    const existingSets = workoutSets.filter((s) => s.workout_exercise_id === weId);
    const nextNumber = existingSets.length + 1;
    const lastSet = existingSets[existingSets.length - 1];

    const newSet: WorkoutSet = {
      id: crypto.randomUUID ? crypto.randomUUID() : `set-${Date.now()}`,
      workout_exercise_id: weId,
      set_number: nextNumber,
      side: lastSet?.side || 'both',
      set_type: 'working',
      target_weight_snapshot: lastSet?.target_weight_snapshot || 50,
      target_reps_min_snapshot: lastSet?.target_reps_min_snapshot || 8,
      target_reps_max_snapshot: lastSet?.target_reps_max_snapshot || 12,
      target_rir_snapshot: lastSet?.target_rir_snapshot || 1,
      actual_weight: null,
      effective_weight_kg: null,
      actual_reps: null,
      actual_rir: null,
      used_micro_addon: false,
      is_completed: false,
      completed_at: null,
      pr_flags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await db.workout_sets.add(newSet);
    setWorkoutSets((prev) => [...prev, newSet]);
  };

  // Satz löschen
  const handleDeleteSet = async (setId: string) => {
    await db.workout_sets.delete(setId);
    setWorkoutSets((prev) => prev.filter((s) => s.id !== setId));
  };

  // Satz-Typ umschalten (W -> Working -> D -> F)
  const handleCycleSetType = async (set: WorkoutSet) => {
    const cycleMap: Record<WorkoutSet['set_type'], WorkoutSet['set_type']> = {
      warmup: 'working',
      working: 'drop',
      drop: 'failure',
      failure: 'warmup',
    };
    const nextType = cycleMap[set.set_type];
    await db.workout_sets.update(set.id, { set_type: nextType });
    setWorkoutSets((prev) => prev.map((s) => (s.id === set.id ? { ...s, set_type: nextType } : s)));
  };

  // +2.5 kg Micro-Addon Toggle für gym80 Block
  const handleToggleMicroAddon = async (set: WorkoutSet) => {
    const nextVal = !set.used_micro_addon;
    await db.workout_sets.update(set.id, { used_micro_addon: nextVal });
    setWorkoutSets((prev) => prev.map((s) => (s.id === set.id ? { ...s, used_micro_addon: nextVal } : s)));
  };

  // Scheibenrechner öffnen
  const handleOpenPlateCalc = (exercise: Exercise, set: WorkoutSet) => {
    setPlateCalcExercise(exercise);
    setPlateCalcInitialWeight(set.actual_weight || set.target_weight_snapshot || 60);
    setPlateCalcTargetSetId(set.id);
    setPlateCalcOpen(true);
  };

  if (!workout) return null;

  const currentExercise = activeSetId
    ? exercisesMap.get(
        workoutExercises.find(
          (we) => we.id === workoutSets.find((s) => s.id === activeSetId)?.workout_exercise_id
        )?.exercise_id || ''
      )
    : null;

  return (
    <div
      style={{
        padding: '12px 14px',
        paddingBottom: keypadOpen ? 340 : 'calc(var(--safe-bottom) + 80px)',
        minHeight: '100vh',
        backgroundColor: '#000000',
      }}
    >
      {/* Top Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onBack}
            aria-label="Zurück zur Übersicht"
            style={{
              background: '#16161e',
              border: '1px solid #282836',
              borderRadius: 10,
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f3f4f6',
            }}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#f3f4f6', lineHeight: 1.1 }}>
              {workout.title}
            </h1>
            <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 700 }}>
              ● Aktives Workout
            </span>
          </div>
        </div>

        {/* Workout Beenden Button */}
        <button
          onClick={onFinishWorkout}
          style={{
            background: '#22c55e',
            color: '#000000',
            border: 'none',
            borderRadius: 12,
            padding: '8px 14px',
            fontWeight: 800,
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            minHeight: 44,
          }}
        >
          <CheckCircle size={18} />
          Beenden
        </button>
      </div>

      {/* Globale Workout Notiz */}
      <div style={{ marginBottom: 12 }}>
        {editingTopNote ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              value={topNoteInput}
              onChange={(e) => setTopNoteInput(e.target.value)}
              placeholder="Fokus heute (z.B. Saubere Exzentrik, Deload...)"
              style={{
                flex: 1,
                background: '#121218',
                border: '1px solid #3b82f6',
                borderRadius: 8,
                padding: '8px 12px',
                color: '#f3f4f6',
                fontSize: 13,
              }}
              autoFocus
            />
            <button
              onClick={handleSaveTopNote}
              style={{
                background: '#3b82f6',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                padding: '0 12px',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              OK
            </button>
          </div>
        ) : (
          <div
            onClick={() => setEditingTopNote(true)}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              backgroundColor: '#0d0d12',
              border: '1px dashed #282836',
              fontSize: 12,
              color: workout.top_note ? '#e2e8f0' : '#6b7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
          >
            <span>{workout.top_note ? `Notiz: ${workout.top_note}` : '+ Workout-Notiz hinzufügen...'}</span>
            <Edit2 size={12} color="#6b7280" />
          </div>
        )}
      </div>

      {/* LIVE-RUHETIMER & STOPPUHR */}
      <RestTimerBar
        lastSetCompletedAt={lastCompletedSet?.completed_at || null}
        recommendedRestSeconds={120}
        workoutStartedAt={workout.started_at}
      />

      {/* ÜBUNGSLISTE */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {workoutExercises.map((we, exIndex) => {
          const exercise = exercisesMap.get(we.exercise_id);
          if (!exercise) return null;

          const exSets = workoutSets.filter((s) => s.workout_exercise_id === we.id);
          const isCable = exercise.equipment_type === 'cable_stack';
          const isStack = isCable || exercise.equipment_type === 'machine_stack';
          const isPlateOrBar = exercise.equipment_type === 'barbell' || exercise.equipment_type === 'plate_loaded';

          return (
            <div
              key={we.id}
              style={{
                backgroundColor: '#0e0e12',
                border: we.pause_progression ? '1px solid #d97706' : '1px solid #202029',
                borderRadius: 16,
                padding: '14px 12px',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
              }}
            >
              {/* Exercise Header */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af' }}>
                        #{exIndex + 1}
                      </span>
                      <h2 style={{ fontSize: 16, fontWeight: 900, color: '#ffffff' }}>
                        {exercise.name}
                      </h2>

                      {/* Pulley Ratio Badge */}
                      {isCable && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: 4,
                            backgroundColor: exercise.pulley_ratio === 0.5 ? 'rgba(6, 182, 212, 0.2)' : 'rgba(168, 85, 247, 0.2)',
                            color: exercise.pulley_ratio === 0.5 ? '#06b6d4' : '#a855f7',
                            border: `1px solid ${exercise.pulley_ratio === 0.5 ? '#06b6d4' : '#a855f7'}`,
                          }}
                        >
                          {exercise.pulley_ratio === 0.5 ? '1:2 Flaschenzug' : '1:1 Direktzug'}
                        </span>
                      )}
                    </div>

                    {/* Pinned Setup Note (1-Tap Editable) */}
                    <div style={{ marginTop: 4 }}>
                      {editingNoteExId === exercise.id ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            type="text"
                            value={noteInput}
                            onChange={(e) => setNoteInput(e.target.value)}
                            placeholder="z.B. Sitz 4, Polster 2"
                            style={{
                              flex: 1,
                              background: '#161622',
                              border: '1px solid #22c55e',
                              borderRadius: 6,
                              padding: '4px 8px',
                              color: '#fff',
                              fontSize: 12,
                            }}
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveSetupNote(exercise.id)}
                            style={{
                              background: '#22c55e',
                              border: 'none',
                              borderRadius: 6,
                              color: '#000',
                              padding: '0 8px',
                              fontWeight: 800,
                              fontSize: 11,
                            }}
                          >
                            OK
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => {
                            setEditingNoteExId(exercise.id);
                            setNoteInput(exercise.pinned_setup_note || '');
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 11,
                            color: exercise.pinned_setup_note ? '#a7f3d0' : '#6b7280',
                            backgroundColor: exercise.pinned_setup_note ? 'rgba(34, 197, 94, 0.1)' : 'transparent',
                            padding: exercise.pinned_setup_note ? '2px 6px' : '0',
                            borderRadius: 4,
                            cursor: 'pointer',
                          }}
                        >
                          <span>{exercise.pinned_setup_note || '+ Sitz-/Geräte-Einstellung notieren'}</span>
                          <Edit2 size={10} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions: Pause Progression & Scheibenrechner */}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {/* Scheibenrechner Button bei Langhantel / Plate Loaded */}
                    {isPlateOrBar && exSets.length > 0 && (
                      <button
                        onClick={() => handleOpenPlateCalc(exercise, exSets[0])}
                        aria-label="Scheibenrechner öffnen"
                        style={{
                          background: '#1a1f2c',
                          border: '1px solid #2e3e5c',
                          borderRadius: 8,
                          padding: '6px 8px',
                          color: '#60a5fa',
                          fontSize: 11,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          minHeight: 36,
                        }}
                      >
                        <Disc size={14} />
                        Scheiben
                      </button>
                    )}

                    {/* Tagesform / Pause Progression Toggle */}
                    <button
                      onClick={() => handleTogglePauseProgression(we.id, we.pause_progression)}
                      aria-label="Tagesform-Schutz umschalten"
                      style={{
                        background: we.pause_progression ? 'rgba(217, 119, 6, 0.25)' : '#181822',
                        border: `1px solid ${we.pause_progression ? '#d97706' : '#282836'}`,
                        borderRadius: 8,
                        padding: '6px 8px',
                        color: we.pause_progression ? '#fbbf24' : '#9ca3af',
                        fontSize: 11,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        minHeight: 36,
                      }}
                    >
                      {we.pause_progression ? (
                        <>
                          <PauseCircle size={14} color="#fbbf24" />
                          Progression pausiert
                        </>
                      ) : (
                        <>
                          <PlayCircle size={14} />
                          Tagesform OK
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Sets Table Header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1.4fr 1fr 1fr 48px',
                  gap: 6,
                  padding: '6px 4px',
                  borderBottom: '1px solid #1f1f28',
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  textAlign: 'center',
                }}
              >
                <div>Satz</div>
                <div style={{ textAlign: 'left' }}>Ziel (Snapshot)</div>
                <div>Gewicht</div>
                <div>Wdh.</div>
                <div>✓</div>
              </div>

              {/* Sets Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                {exSets.map((set) => {
                  const isCompleted = set.is_completed;
                  const hasPr = set.pr_flags && set.pr_flags.length > 0;

                  return (
                    <div
                      key={set.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '40px 1.4fr 1fr 1fr 48px',
                        gap: 6,
                        alignItems: 'center',
                        padding: '6px 4px',
                        backgroundColor: isCompleted ? 'rgba(34, 197, 94, 0.08)' : '#121218',
                        borderRadius: 10,
                        border: isCompleted
                          ? hasPr
                            ? '1px solid rgba(234, 179, 8, 0.6)'
                            : '1px solid rgba(34, 197, 94, 0.3)'
                          : '1px solid #1f1f2a',
                        transition: 'background-color 0.2s',
                      }}
                    >
                      {/* Set Number / Badge Button */}
                      <button
                        onClick={() => handleCycleSetType(set)}
                        aria-label={`Satztyp ändern (aktuell: ${set.set_type})`}
                        style={{
                          width: 36,
                          height: 36,
                          minHeight: 36,
                          borderRadius: 8,
                          backgroundColor:
                            set.set_type === 'warmup'
                              ? '#374151'
                              : set.set_type === 'drop'
                              ? '#7c3aed'
                              : set.set_type === 'failure'
                              ? '#dc2626'
                              : '#1f2937',
                          color: '#ffffff',
                          fontWeight: 900,
                          fontSize: 12,
                          border: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {set.set_type === 'warmup'
                          ? 'W'
                          : set.set_type === 'drop'
                          ? 'D'
                          : set.set_type === 'failure'
                          ? 'F'
                          : set.set_number}
                      </button>

                      {/* Ziel-Snapshot Spalte */}
                      <div style={{ fontSize: 12, color: '#9ca3af', textAlign: 'left', lineHeight: 1.2 }}>
                        <div style={{ fontWeight: 800, color: '#38bdf8' }}>
                          {set.target_weight_snapshot ?? '--'} kg × {set.target_reps_min_snapshot ?? '--'}
                        </div>
                        <div style={{ fontSize: 10, color: '#6b7280' }}>
                          @ {set.target_rir_snapshot ?? 1} RIR
                          {set.side !== 'both' && (
                            <span style={{ color: '#f59e0b', marginLeft: 4 }}>
                              ({set.side === 'left' ? 'Links' : 'Rechts'})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Gewicht Input Field (Opens Keypad) */}
                      <div
                        onClick={() => handleOpenKeypad(set, 'weight')}
                        style={{
                          background: activeSetId === set.id && activeField === 'weight' ? '#1f2a1f' : '#181822',
                          border: activeSetId === set.id && activeField === 'weight' ? '1px solid #22c55e' : '1px solid #282838',
                          borderRadius: 8,
                          padding: '6px 4px',
                          textAlign: 'center',
                          cursor: 'pointer',
                          minHeight: 40,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 15,
                            fontWeight: 800,
                            color: set.actual_weight !== null ? '#f3f4f6' : '#6b7280',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {set.actual_weight !== null ? set.actual_weight : set.target_weight_snapshot ?? '--'}
                        </span>
                        {/* 2.5kg Micro-Addon Chip bei Steckblock */}
                        {isStack && (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleMicroAddon(set);
                            }}
                            style={{
                              fontSize: 9,
                              fontWeight: 800,
                              color: set.used_micro_addon ? '#22c55e' : '#6b7280',
                              backgroundColor: set.used_micro_addon ? 'rgba(34, 197, 94, 0.2)' : 'transparent',
                              borderRadius: 3,
                              padding: '1px 3px',
                              marginTop: 2,
                            }}
                          >
                            +2.5
                          </span>
                        )}
                      </div>

                      {/* Wdh. Input Field (Opens Keypad) */}
                      <div
                        onClick={() => handleOpenKeypad(set, 'reps')}
                        style={{
                          background: activeSetId === set.id && activeField === 'reps' ? '#1f2a1f' : '#181822',
                          border: activeSetId === set.id && activeField === 'reps' ? '1px solid #22c55e' : '1px solid #282838',
                          borderRadius: 8,
                          padding: '6px 4px',
                          textAlign: 'center',
                          cursor: 'pointer',
                          minHeight: 40,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 16,
                            fontWeight: 800,
                            color: set.actual_reps !== null ? '#f3f4f6' : '#6b7280',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {set.actual_reps !== null ? set.actual_reps : set.target_reps_min_snapshot ?? '--'}
                        </span>
                      </div>

                      {/* Checkmark Button */}
                      <button
                        onClick={() => handleCompleteSet(set)}
                        aria-label={isCompleted ? 'Satz abgeschlossen' : 'Satz abhaken'}
                        style={{
                          width: 44,
                          height: 44,
                          minHeight: 44,
                          borderRadius: 10,
                          backgroundColor: isCompleted ? '#22c55e' : '#1e1e28',
                          border: isCompleted ? 'none' : '1px solid #2f2f3e',
                          color: isCompleted ? '#000000' : '#6b7280',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <Check size={22} strokeWidth={isCompleted ? 3 : 2} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* PR Badges Footer */}
              {exSets.some((s) => s.pr_flags && s.pr_flags.length > 0) && (
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Array.from(new Set(exSets.flatMap((s) => s.pr_flags))).map((flag) => (
                    <span
                      key={flag}
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 6,
                        backgroundColor: 'rgba(234, 179, 8, 0.2)',
                        color: '#facc15',
                        border: '1px solid #ca8a04',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Sparkles size={11} /> {flag.replace('PR_', '')} REKORD!
                    </span>
                  ))}
                </div>
              )}

              {/* Add Set Button */}
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between' }}>
                <button
                  onClick={() => handleAddSet(we.id)}
                  style={{
                    background: 'transparent',
                    border: '1px dashed #2f2f3f',
                    borderRadius: 8,
                    color: '#9ca3af',
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '6px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    minHeight: 38,
                  }}
                >
                  <Plus size={14} /> + Satz hinzufügen
                </button>

                {exSets.length > 1 && (
                  <button
                    onClick={() => handleDeleteSet(exSets[exSets.length - 1].id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ef4444',
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '4px 8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      minHeight: 36,
                    }}
                  >
                    <Trash2 size={13} /> Letzten Satz entfernen
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* DOCKED CUSTOM GYM KEYPAD */}
      <GymKeypad
        isOpen={keypadOpen}
        activeField={activeField}
        currentValue={keypadInput}
        exercise={currentExercise}
        gymProfile={gymProfile}
        onDigit={handleKeypadDigit}
        onBackspace={handleKeypadBackspace}
        onClear={handleKeypadClear}
        onStep={handleKeypadStep}
        onNextOrComplete={handleKeypadNextOrComplete}
        onClose={() => {
          setKeypadOpen(false);
          setActiveSetId(null);
          setActiveField(null);
        }}
      />

      {/* PLATE CALCULATOR MODAL */}
      {plateCalcExercise && gymProfile && (
        <PlateCalculatorModal
          isOpen={plateCalcOpen}
          initialWeightKg={plateCalcInitialWeight}
          exercise={plateCalcExercise}
          gymProfile={gymProfile}
          onClose={() => setPlateCalcOpen(false)}
          onApplyWeight={async (weightKg) => {
            if (plateCalcTargetSetId) {
              await db.workout_sets.update(plateCalcTargetSetId, { actual_weight: weightKg });
              setWorkoutSets((prev) =>
                prev.map((s) => (s.id === plateCalcTargetSetId ? { ...s, actual_weight: weightKg } : s))
              );
            }
          }}
        />
      )}
    </div>
  );
};
