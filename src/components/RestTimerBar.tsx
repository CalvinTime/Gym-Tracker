import React, { useState, useEffect } from 'react';
import { Play, Pause, Plus, Minus, RotateCcw, Volume2, Clock, FastForward, CheckCircle2 } from 'lucide-react';

interface RestTimerBarProps {
  lastSetCompletedAt: string | null;
  recommendedRestSeconds: number;
  workoutStartedAt: string | null;
  onTimerFinished?: () => void;
}

export const RestTimerBar: React.FC<RestTimerBarProps> = ({
  lastSetCompletedAt,
  recommendedRestSeconds,
  workoutStartedAt,
}) => {
  const [countdownRemaining, setCountdownRemaining] = useState<number>(recommendedRestSeconds);
  const [timeSinceLastSetSeconds, setTimeSinceLastSetSeconds] = useState<number>(0);
  const [workoutElapsedSeconds, setWorkoutElapsedSeconds] = useState<number>(0);
  const [isTimerPaused, setIsTimerPaused] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Synchronisiere Countdown, wenn ein neuer Satz abgehakt wird
  useEffect(() => {
    if (lastSetCompletedAt) {
      setCountdownRemaining(recommendedRestSeconds);
      setIsTimerPaused(false);
    }
  }, [lastSetCompletedAt, recommendedRestSeconds]);

  // Sekundentakt für Countdown und Stoppuhren
  useEffect(() => {
    const interval = setInterval(() => {
      // 1. Gesamte Workout-Dauer
      if (workoutStartedAt) {
        const startMs = new Date(workoutStartedAt).getTime();
        const diffSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
        setWorkoutElapsedSeconds(diffSec);
      }

      // 2. Zeit seit letztem Satz (permanente Stoppuhr)
      if (lastSetCompletedAt) {
        const lastMs = new Date(lastSetCompletedAt).getTime();
        const diffSec = Math.max(0, Math.floor((Date.now() - lastMs) / 1000));
        setTimeSinceLastSetSeconds(diffSec);
      }

      // 3. Countdown herunterzählen
      if (!isTimerPaused && countdownRemaining > 0) {
        setCountdownRemaining((prev) => {
          if (prev <= 1) {
            // Signal abspielen
            triggerRestCompleteAlert(soundEnabled);
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [workoutStartedAt, lastSetCompletedAt, isTimerPaused, countdownRemaining, soundEnabled]);

  const adjustCountdown = (delta: number) => {
    setCountdownRemaining((prev) => Math.max(0, prev + delta));
  };

  const formatSeconds = (sec: number): string => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatWorkoutDuration = (sec: number): string => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPct = recommendedRestSeconds > 0
    ? Math.min(100, Math.max(0, (countdownRemaining / recommendedRestSeconds) * 100))
    : 0;

  return (
    <div
      style={{
        backgroundColor: '#101014',
        border: '1px solid #23232c',
        borderRadius: 16,
        padding: '12px 14px',
        marginBottom: 14,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
      }}
    >
      {/* Oberste Zeile: Gesamtdauer & Permanente Stoppuhr seit letztem Satz */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock size={15} color="#9ca3af" />
          <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 600 }}>Dauer:</span>
          <span style={{ fontSize: 14, color: '#f3f4f6', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
            {formatWorkoutDuration(workoutElapsedSeconds)}
          </span>
        </div>

        {/* PERMANENTE ANZEIGE: Zeit seit letztem Satz */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            backgroundColor: '#181822',
            padding: '3px 8px',
            borderRadius: 8,
            border: '1px solid #282836',
          }}
        >
          <span style={{ fontSize: 11, color: '#06b6d4', fontWeight: 700, textTransform: 'uppercase' }}>
            Seit letztem Satz:
          </span>
          <span
            style={{
              fontSize: 14,
              fontWeight: 900,
              color: '#06b6d4',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {lastSetCompletedAt ? formatSeconds(timeSinceLastSetSeconds) : '--:--'}
          </span>
        </div>
      </div>

      {/* Hauptbereich: Countdown Balken + Steuerung */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        {/* +15s / -15s Stepper */}
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => adjustCountdown(-15)}
            aria-label="15 Sekunden abziehen"
            style={timerStepBtnStyle}
          >
            <Minus size={13} /> 15s
          </button>
          <button
            onClick={() => adjustCountdown(15)}
            aria-label="15 Sekunden hinzufügen"
            style={timerStepBtnStyle}
          >
            <Plus size={13} /> 15s
          </button>
        </div>

        {/* Live Countdown Display */}
        <div
          onClick={() => {
            if (countdownRemaining > 0) setCountdownRemaining(0);
          }}
          title={countdownRemaining > 0 ? "Tippen zum Überspringen" : undefined}
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 6,
            cursor: countdownRemaining > 0 ? 'pointer' : 'default',
          }}
        >
          <span style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 700 }}>
            Pause:
          </span>
          {countdownRemaining > 0 ? (
            <span
              style={{
                fontSize: 26,
                fontWeight: 900,
                fontVariantNumeric: 'tabular-nums',
                color: countdownRemaining < 15 ? '#ef4444' : '#f3f4f6',
              }}
            >
              {formatSeconds(countdownRemaining)}
            </span>
          ) : (
            <span
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: '#22c55e',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <CheckCircle2 size={16} /> Bereit!
            </span>
          )}
        </div>

        {/* Play/Pause & Skip & Sound */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {countdownRemaining > 0 && (
            <button
              onClick={() => setCountdownRemaining(0)}
              aria-label="Pause sofort beenden / überspringen"
              title="Pause überspringen (Wegmachen)"
              style={{
                background: '#142a18',
                border: '1px solid #22c55e',
                borderRadius: 8,
                padding: '0 8px',
                height: 38,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                color: '#22c55e',
                fontWeight: 800,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              <FastForward size={14} fill="#22c55e" />
              <span>Weg</span>
            </button>
          )}

          <button
            onClick={() => setIsTimerPaused(!isTimerPaused)}
            aria-label={isTimerPaused ? 'Fortsetzen' : 'Pausieren'}
            style={{
              background: isTimerPaused ? '#22c55e' : '#1f1f2a',
              border: 'none',
              borderRadius: 8,
              width: 38,
              height: 38,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isTimerPaused ? '#000000' : '#f3f4f6',
            }}
          >
            {isTimerPaused ? <Play size={18} fill="#000" /> : <Pause size={18} />}
          </button>

          <button
            onClick={() => setCountdownRemaining(recommendedRestSeconds)}
            aria-label="Timer zurücksetzen"
            style={{
              background: '#1f1f2a',
              border: 'none',
              borderRadius: 8,
              width: 38,
              height: 38,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9ca3af',
            }}
          >
            <RotateCcw size={16} />
          </button>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            aria-label="Ton an/aus"
            style={{
              background: soundEnabled ? '#1a261a' : '#1f1f2a',
              border: `1px solid ${soundEnabled ? '#22c55e' : '#2a2a38'}`,
              borderRadius: 8,
              width: 38,
              height: 38,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: soundEnabled ? '#22c55e' : '#6b7280',
            }}
          >
            <Volume2 size={16} />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div
        style={{
          width: '100%',
          height: 4,
          backgroundColor: '#20202c',
          borderRadius: 2,
          marginTop: 10,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progressPct}%`,
            backgroundColor: countdownRemaining === 0 ? '#22c55e' : countdownRemaining < 15 ? '#ef4444' : '#06b6d4',
            transition: 'width 1s linear',
          }}
        />
      </div>
    </div>
  );
};

const timerStepBtnStyle: React.CSSProperties = {
  background: '#1a1a24',
  border: '1px solid #2a2a3a',
  borderRadius: 8,
  color: '#e2e8f0',
  fontWeight: 700,
  fontSize: 12,
  padding: '6px 8px',
  minHeight: 38,
  display: 'flex',
  alignItems: 'center',
  gap: 2,
};

function triggerRestCompleteAlert(soundEnabled: boolean) {
  // Vibration für Smartphones
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([200, 100, 200]);
    } catch {
      // Ignore vibration error on unsupported platforms
    }
  }

  // Akustischer Ton via Web Audio API
  if (soundEnabled && typeof window !== 'undefined' && 'AudioContext' in window) {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 Ton
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // Audio playback restrictions fallback
    }
  }
}
