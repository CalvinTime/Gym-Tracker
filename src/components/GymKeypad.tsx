import React from 'react';
import type { Exercise, GymProfile } from '../core/models/types.ts';
import { Delete, CheckCircle2, ChevronDown } from 'lucide-react';

export type KeypadField = 'weight' | 'reps' | 'rir';

interface GymKeypadProps {
  isOpen: boolean;
  activeField: KeypadField | null;
  currentValue: string;
  exercise?: Exercise | null;
  gymProfile?: GymProfile | null;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onStep: (delta: number) => void;
  onNextOrComplete: () => void;
  onClose: () => void;
}

export const GymKeypad: React.FC<GymKeypadProps> = ({
  isOpen,
  activeField,
  currentValue,
  exercise,
  onDigit,
  onBackspace,
  onClear,
  onStep,
  onNextOrComplete,
  onClose,
}) => {
  if (!isOpen || !activeField) return null;

  const isDumbbell = exercise?.equipment_type === 'dumbbell';
  const weightStep = isDumbbell ? 2 : 2.5;

  const getTitle = () => {
    switch (activeField) {
      case 'weight':
        return 'Gewicht eingeben (kg)';
      case 'reps':
        return 'Wiederholungen eingeben';
      case 'rir':
        return 'Reps in Reserve (RIR)';
    }
  };

  const getActionLabel = () => {
    switch (activeField) {
      case 'weight':
        return 'Weiter zu Wdh. →';
      case 'reps':
        return 'Weiter zu RIR →';
      case 'rir':
        return 'Satz abhaken ✓';
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        backgroundColor: '#0a0a0c',
        borderTop: '2px solid #22c55e',
        boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.85)',
        padding: '10px 12px',
        paddingBottom: 'calc(var(--safe-bottom) + 8px)',
      }}
      className="animate-slide-up"
    >
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
          padding: '0 4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 600 }}>
            {getTitle()}
          </span>
          {exercise && (
            <span
              style={{
                fontSize: 11,
                padding: '2px 6px',
                borderRadius: 4,
                backgroundColor: '#1f1f27',
                color: '#22c55e',
                fontWeight: 700,
              }}
            >
              {exercise.name.length > 20 ? exercise.name.slice(0, 20) + '…' : exercise.name}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: '#22c55e',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {currentValue || '0'} {activeField === 'weight' ? 'kg' : ''}
          </div>
          <button
            onClick={onClose}
            aria-label="Tastatur schließen"
            style={{
              background: '#1a1a22',
              border: '1px solid #2a2a35',
              borderRadius: 8,
              padding: '6px 10px',
              color: '#9ca3af',
              display: 'flex',
              alignItems: 'center',
              minHeight: 36,
            }}
          >
            <ChevronDown size={18} />
          </button>
        </div>
      </div>

      {/* Quick Increments / RIR Bar */}
      {activeField === 'rir' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6, marginBottom: 8 }}>
          {[0, 1, 2, 3, 4].map((rir) => (
            <button
              key={rir}
              onClick={() => {
                onClear();
                onDigit(rir.toString());
              }}
              style={{
                background: currentValue === rir.toString() ? '#22c55e' : '#181820',
                color: currentValue === rir.toString() ? '#000000' : '#f3f4f6',
                border: '1px solid #2e2e3a',
                borderRadius: 8,
                fontWeight: 800,
                fontSize: 15,
                minHeight: 44,
              }}
            >
              {rir === 0 ? '0 (Fail)' : `${rir} RIR`}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 8 }}>
          {activeField === 'weight' ? (
            <>
              <button
                onClick={() => onStep(-5)}
                style={quickStepBtnStyle}
              >
                -5 kg
              </button>
              <button
                onClick={() => onStep(-weightStep)}
                style={quickStepBtnStyle}
              >
                -{weightStep} kg
              </button>
              <button
                onClick={() => onStep(weightStep)}
                style={quickStepBtnStyle}
              >
                +{weightStep} kg
              </button>
              <button
                onClick={() => onStep(5)}
                style={quickStepBtnStyle}
              >
                +5 kg
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onStep(-2)}
                style={quickStepBtnStyle}
              >
                -2 Wdh.
              </button>
              <button
                onClick={() => onStep(-1)}
                style={quickStepBtnStyle}
              >
                -1 Wdh.
              </button>
              <button
                onClick={() => onStep(1)}
                style={quickStepBtnStyle}
              >
                +1 Wdh.
              </button>
              <button
                onClick={() => onStep(2)}
                style={quickStepBtnStyle}
              >
                +2 Wdh.
              </button>
            </>
          )}
        </div>
      )}

      {/* Main Numpad + Big Action Button */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1.3fr', gap: 8 }}>
        {/* 3x4 Digits Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'].map((item) => {
            if (item === '⌫') {
              return (
                <button
                  key={item}
                  onClick={onBackspace}
                  style={digitBtnStyle}
                  aria-label="Löschen"
                >
                  <Delete size={20} color="#f87171" />
                </button>
              );
            }
            if (item === ',') {
              return (
                <button
                  key={item}
                  onClick={() => onDigit('.')}
                  style={digitBtnStyle}
                  disabled={activeField !== 'weight'}
                >
                  ,
                </button>
              );
            }
            return (
              <button
                key={item}
                onClick={() => onDigit(item)}
                style={digitBtnStyle}
              >
                {item}
              </button>
            );
          })}
        </div>

        {/* Big Action Button (Full Height) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            onClick={onClear}
            style={{
              background: '#20161a',
              border: '1px solid #3d2429',
              borderRadius: 10,
              color: '#f87171',
              fontWeight: 700,
              fontSize: 13,
              minHeight: 44,
            }}
          >
            C (Reset)
          </button>

          <button
            onClick={onNextOrComplete}
            style={{
              flex: 1,
              background: '#22c55e',
              border: 'none',
              borderRadius: 12,
              color: '#000000',
              fontWeight: 900,
              fontSize: 16,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              boxShadow: '0 4px 16px rgba(34, 197, 94, 0.4)',
              minHeight: 140,
            }}
          >
            <CheckCircle2 size={28} />
            <span style={{ textAlign: 'center', lineHeight: 1.2 }}>
              {getActionLabel()}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

const quickStepBtnStyle: React.CSSProperties = {
  background: '#181822',
  border: '1px solid #2e2e3e',
  borderRadius: 8,
  color: '#e2e8f0',
  fontWeight: 700,
  fontSize: 13,
  minHeight: 44,
};

const digitBtnStyle: React.CSSProperties = {
  background: '#15151c',
  border: '1px solid #262632',
  borderRadius: 10,
  color: '#ffffff',
  fontWeight: 800,
  fontSize: 22,
  minHeight: 52,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
