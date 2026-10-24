import React, { useState, useEffect } from 'react';
import { db } from './core/db/database.ts';
import { seedDatabase } from './core/db/seed.ts';
import { TrainingTab } from './components/tabs/TrainingTab.tsx';
import { ExercisesTab } from './components/tabs/ExercisesTab.tsx';
import { AnalyticsTab } from './components/tabs/AnalyticsTab.tsx';
import { ProfileTab } from './components/tabs/ProfileTab.tsx';
import { WorkoutScreen } from './components/WorkoutScreen.tsx';
import type { Workout } from './core/models/types.ts';
import {
  Dumbbell,
  BookOpen,
  TrendingUp,
  User,
  Play,
  Activity,
  CheckCircle2,
} from 'lucide-react';

export type TabType = 'training' | 'exercises' | 'analytics' | 'profile';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('training');
  const [activeWorkoutId, setActiveWorkoutId] = useState<string | null>(null);
  const [isWorkoutViewOpen, setIsWorkoutViewOpen] = useState<boolean>(false);
  const [activeWorkoutDetails, setActiveWorkoutDetails] = useState<Workout | null>(null);
  const [isDbReady, setIsDbReady] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Initialisiere Datenbank & Seed
  useEffect(() => {
    const initApp = async () => {
      try {
        await seedDatabase(db);
        // Sicherstellen, dass Vorlagen & Übungen vorhanden sind (Auto-Repair)
        const routineCount = await db.routine_templates.count();
        if (routineCount === 0) {
          await seedDatabase(db, { force: true });
        }
        // Prüfe ob ein offenes Workout existiert
        const openWorkouts = await db.workouts
          .filter((w) => !w.finished_at)
          .toArray();
        if (openWorkouts.length > 0) {
          const latest = openWorkouts[openWorkouts.length - 1];
          setActiveWorkoutId(latest.id);
          setActiveWorkoutDetails(latest);
        }
      } catch (err) {
        console.error('Fehler bei der Initialisierung:', err);
      } finally {
        setIsDbReady(true);
      }
    };

    initApp();
  }, []);

  // Sync active workout details wenn activeWorkoutId sich ändert
  useEffect(() => {
    if (!activeWorkoutId) {
      setActiveWorkoutDetails(null);
      return;
    }

    const loadWorkout = async () => {
      const w = await db.workouts.get(activeWorkoutId);
      if (w && !w.finished_at) {
        setActiveWorkoutDetails(w);
      } else {
        setActiveWorkoutDetails(null);
        setActiveWorkoutId(null);
      }
    };

    loadWorkout();
  }, [activeWorkoutId, isWorkoutViewOpen]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleStartWorkout = (workoutId: string) => {
    setActiveWorkoutId(workoutId);
    setIsWorkoutViewOpen(true);
  };

  const handleFinishWorkout = () => {
    setActiveWorkoutId(null);
    setActiveWorkoutDetails(null);
    setIsWorkoutViewOpen(false);
    showToast('Training erfolgreich beendet & gespeichert! 🎉');
  };

  const handleBackFromWorkout = () => {
    setIsWorkoutViewOpen(false);
  };

  if (!isDbReady) {
    return (
      <div
        style={{
          height: '100vh',
          backgroundColor: '#000000',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#f3f4f6',
          fontFamily: 'sans-serif',
        }}
      >
        <Dumbbell
          size={56}
          style={{
            color: '#10b981',
            marginBottom: '1rem',
            animation: 'pulse 1.5s infinite',
          }}
        />
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
          GymTracker (McFit & gym80)
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
          Lade lokale IndexedDB & McFit-Geräte...
        </p>
      </div>
    );
  }

  // Wenn WorkoutScreen geöffnet ist
  if (isWorkoutViewOpen && activeWorkoutId) {
    return (
      <WorkoutScreen
        workoutId={activeWorkoutId}
        onFinishWorkout={handleFinishWorkout}
        onBack={handleBackFromWorkout}
      />
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: '#000000',
        color: '#f3f4f6',
        maxWidth: '640px',
        margin: '0 auto',
        position: 'relative',
        paddingBottom: activeWorkoutDetails ? '128px' : '72px',
      }}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#064e3b',
            border: '1px solid #059669',
            color: '#d1fae5',
            padding: '10px 18px',
            borderRadius: '9999px',
            fontSize: '0.875rem',
            fontWeight: 600,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.8)',
          }}
        >
          <CheckCircle2 size={18} color="#34d399" />
          {toastMessage}
        </div>
      )}

      {/* Main Content Area */}
      <main style={{ flex: 1 }}>
        {activeTab === 'training' && (
          <TrainingTab
            onStartWorkout={handleStartWorkout}
            activeWorkoutId={activeWorkoutId}
          />
        )}
        {activeTab === 'exercises' && <ExercisesTab />}
        {activeTab === 'analytics' && <AnalyticsTab />}
        {activeTab === 'profile' && <ProfileTab />}
      </main>

      {/* Bottom Floating Bar: Active Workout Resume (wenn aktiv, aber minimiert) */}
      {activeWorkoutDetails && !isWorkoutViewOpen && (
        <div
          onClick={() => setIsWorkoutViewOpen(true)}
          style={{
            position: 'fixed',
            bottom: '68px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'calc(100% - 24px)',
            maxWidth: '616px',
            backgroundColor: '#064e3b',
            border: '1px solid #10b981',
            borderRadius: '12px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            zIndex: 40,
            boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#000000',
              }}
            >
              <Activity size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6ee7b7', fontWeight: 600 }}>
                Laufendes Training
              </div>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#f3f4f6' }}>
                {activeWorkoutDetails.title || 'Aktives Training'}
              </div>
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#10b981',
              color: '#000000',
              padding: '6px 12px',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '0.8125rem',
            }}
          >
            <Play size={14} fill="#000000" />
            Fortsetzen
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          height: '64px',
          backgroundColor: '#0a0a0a',
          borderTop: '1px solid #262626',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          zIndex: 50,
          maxWidth: '640px',
          margin: '0 auto',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <button
          onClick={() => setActiveTab('training')}
          style={{
            flex: 1,
            height: '100%',
            background: 'none',
            border: 'none',
            color: activeTab === 'training' ? '#10b981' : '#737373',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontWeight: activeTab === 'training' ? 700 : 500,
            minHeight: '48px',
          }}
        >
          <Dumbbell size={22} />
          <span>Training</span>
        </button>

        <button
          onClick={() => setActiveTab('exercises')}
          style={{
            flex: 1,
            height: '100%',
            background: 'none',
            border: 'none',
            color: activeTab === 'exercises' ? '#10b981' : '#737373',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontWeight: activeTab === 'exercises' ? 700 : 500,
            minHeight: '48px',
          }}
        >
          <BookOpen size={22} />
          <span>Übungen</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          style={{
            flex: 1,
            height: '100%',
            background: 'none',
            border: 'none',
            color: activeTab === 'analytics' ? '#10b981' : '#737373',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontWeight: activeTab === 'analytics' ? 700 : 500,
            minHeight: '48px',
          }}
        >
          <TrendingUp size={22} />
          <span>Statistik</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          style={{
            flex: 1,
            height: '100%',
            background: 'none',
            border: 'none',
            color: activeTab === 'profile' ? '#10b981' : '#737373',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            cursor: 'pointer',
            fontSize: '0.75rem',
            fontWeight: activeTab === 'profile' ? 700 : 500,
            minHeight: '48px',
          }}
        >
          <User size={22} />
          <span>Profil</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
