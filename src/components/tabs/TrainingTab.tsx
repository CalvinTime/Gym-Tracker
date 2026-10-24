import React, { useState, useEffect } from 'react';
import type { RoutineTemplate, Workout } from '../../core/models/types.ts';
import { db } from '../../core/db/database.ts';
import { seedDatabase } from '../../core/db/seed.ts';
import { WorkoutLifecycleService } from '../../core/services/workout-lifecycle.service.ts';
import { SEED_GYM_PROFILE_ID } from '../../core/db/seed-data.ts';
import { Play, Plus, Clock, ChevronRight, Flame } from 'lucide-react';

interface TrainingTabProps {
  onStartWorkout: (workoutId: string) => void;
  activeWorkoutId: string | null;
}

export const TrainingTab: React.FC<TrainingTabProps> = ({
  onStartWorkout,
  activeWorkoutId,
}) => {
  const [routines, setRoutines] = useState<RoutineTemplate[]>([]);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [recentFinishedWorkouts, setRecentFinishedWorkouts] = useState<Workout[]>([]);

  useEffect(() => {
    loadData();
  }, [activeWorkoutId]);

  const loadData = async () => {
    // Routinen laden
    const rList = await db.routine_templates.filter((r) => !r.is_archived).sortBy('order_index');
    setRoutines(rList);

    // Aktives Workout laden falls vorhanden
    if (activeWorkoutId) {
      const w = await db.workouts.get(activeWorkoutId);
      if (w && !w.finished_at) {
        setActiveWorkout(w);
      } else {
        setActiveWorkout(null);
      }
    } else {
      // Prüfe ob ein nicht beendetes Workout in DB liegt
      const openWorkouts = await db.workouts.filter((w) => !w.finished_at).toArray();
      if (openWorkouts.length > 0) {
        setActiveWorkout(openWorkouts[openWorkouts.length - 1]);
      } else {
        setActiveWorkout(null);
      }
    }

    // Kürzlich abgeschlossene Workouts
    const finished = await db.workouts
      .filter((w) => Boolean(w.finished_at))
      .toArray();
    finished.sort((a, b) => (b.finished_at || '').localeCompare(a.finished_at || ''));
    setRecentFinishedWorkouts(finished.slice(0, 5));
  };

  const handleStartRoutine = async (routineId: string) => {
    const { workout } = await WorkoutLifecycleService.startWorkout(
      db,
      routineId,
      SEED_GYM_PROFILE_ID
    );
    onStartWorkout(workout.id);
  };

  const handleStartEmptyWorkout = async () => {
    const now = new Date().toISOString();
    const workoutId = crypto.randomUUID ? crypto.randomUUID() : `w-${Date.now()}`;
    const newWorkout: Workout = {
      id: workoutId,
      routine_id: null,
      gym_profile_id: SEED_GYM_PROFILE_ID,
      title: 'Freies Workout',
      top_note: '',
      started_at: null,
      finished_at: null,
      is_deload_session: false,
      created_at: now,
      updated_at: now,
    };
    await db.workouts.add(newWorkout);
    onStartWorkout(workoutId);
  };

  return (
    <div style={{ padding: '16px 14px', maxWidth: 600, margin: '0 auto' }}>
      {/* Top Banner / Studio Badge */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <div>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#22c55e', textTransform: 'uppercase', letterSpacing: 1.5 }}>
            Offline-First Tracker
          </span>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#ffffff' }}>Training</h1>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            backgroundColor: '#121218',
            border: '1px solid #252532',
            borderRadius: 20,
            padding: '6px 12px',
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#22c55e' }} />
          <span style={{ fontSize: 12, fontWeight: 800, color: '#e5e7eb' }}>McFit gym80</span>
        </div>
      </div>

      {/* Aktives Workout Banner (falls vorhanden) */}
      {activeWorkout && (
        <div
          onClick={() => onStartWorkout(activeWorkout.id)}
          className="pulse-green"
          style={{
            backgroundColor: '#0c1a10',
            border: '2px solid #22c55e',
            borderRadius: 16,
            padding: '16px 18px',
            marginBottom: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Flame size={16} color="#22c55e" />
              <span style={{ fontSize: 12, fontWeight: 800, color: '#22c55e', textTransform: 'uppercase' }}>
                Laufendes Training
              </span>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#ffffff' }}>
              {activeWorkout.title}
            </h3>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>
              Tippen zum Fortsetzen
            </span>
          </div>

          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              backgroundColor: '#22c55e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#000000',
            }}
          >
            <Play size={20} fill="#000" />
          </div>
        </div>
      )}

      {/* Schnell-Start: Freies Workout */}
      <button
        onClick={handleStartEmptyWorkout}
        style={{
          width: '100%',
          backgroundColor: '#161620',
          border: '1px dashed #303042',
          borderRadius: 14,
          padding: '14px 16px',
          color: '#e2e8f0',
          fontWeight: 800,
          fontSize: 15,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          marginBottom: 24,
          minHeight: 52,
        }}
      >
        <Plus size={20} color="#22c55e" />
        Freies Workout starten (ohne Vorlage)
      </button>

      {/* McFit gym80 Vorlagen */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>
            McFit gym80 Vorlagen
          </h2>
          <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 700 }}>
            {routines.length} Pläne
          </span>
        </div>

        {routines.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '24px 16px',
              backgroundColor: '#101016',
              borderRadius: 14,
              border: '1px dashed #22c55e',
            }}
          >
            <p style={{ color: '#9ca3af', fontSize: 13, marginBottom: 12 }}>
              Keine Vorlagen gefunden. Tippe hier, um die 3 McFit gym80 Vorlagen (Push, Pull, Legs) zu laden:
            </p>
            <button
              onClick={async () => {
                await seedDatabase(db, { force: true });
                await loadData();
              }}
              style={{
                backgroundColor: '#22c55e',
                color: '#000000',
                border: 'none',
                borderRadius: 12,
                padding: '12px 20px',
                fontWeight: 800,
                fontSize: 14,
                cursor: 'pointer',
                minHeight: 46,
              }}
            >
              ⚡ McFit gym80 Vorlagen laden
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {routines.map((routine) => (
              <div
                key={routine.id}
                style={{
                  backgroundColor: '#101016',
                  border: '1px solid #20202d',
                  borderRadius: 14,
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
                }}
              >
                <div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 4,
                      backgroundColor: 'rgba(34, 197, 94, 0.15)',
                      color: '#22c55e',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {routine.split_category}
                  </span>
                  <h3 style={{ fontSize: 17, fontWeight: 800, color: '#f3f4f6', marginTop: 6 }}>
                    {routine.name}
                  </h3>
                </div>

                <button
                  onClick={() => handleStartRoutine(routine.id)}
                  style={{
                    backgroundColor: '#22c55e',
                    color: '#000000',
                    border: 'none',
                    borderRadius: 12,
                    padding: '10px 16px',
                    fontWeight: 900,
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    minHeight: 46,
                  }}
                >
                  <Play size={16} fill="#000" />
                  Starten
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Letzte Trainings */}
      {recentFinishedWorkouts.length > 0 && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
            Vergangene Einheiten
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentFinishedWorkouts.map((w) => (
              <div
                key={w.id}
                style={{
                  backgroundColor: '#0c0c10',
                  border: '1px solid #1c1c26',
                  borderRadius: 12,
                  padding: '12px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <h4 style={{ fontSize: 15, fontWeight: 700, color: '#e5e7eb' }}>
                    {w.title}
                  </h4>
                  <div style={{ fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <Clock size={12} />
                    <span>{w.started_at ? new Date(w.started_at).toLocaleDateString('de-DE') : 'Vor kurzem'}</span>
                  </div>
                </div>
                <ChevronRight size={18} color="#4b5563" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
