import React, { useState, useEffect } from 'react';
import type { Exercise, GymProfile } from '../core/models/types.ts';
import { Gym80EquipmentService, type PlateCalculationResult } from '../core/services/gym80-equipment.service.ts';
import { X, Layers, Minus, Plus, Check } from 'lucide-react';

interface PlateCalculatorModalProps {
  isOpen: boolean;
  initialWeightKg: number;
  exercise: Exercise;
  gymProfile: GymProfile;
  onClose: () => void;
  onApplyWeight?: (newWeightKg: number) => void;
}

const PLATE_COLORS: Record<number, { bg: string; text: string; height: number }> = {
  25: { bg: '#dc2626', text: '#ffffff', height: 120 }, // Rot
  20: { bg: '#2563eb', text: '#ffffff', height: 110 }, // Blau
  15: { bg: '#eab308', text: '#000000', height: 95 },  // Gelb
  10: { bg: '#16a34a', text: '#ffffff', height: 80 },  // Grün
  5:  { bg: '#f3f4f6', text: '#111827', height: 65 },  // Weiß
  2.5:{ bg: '#374151', text: '#f3f4f6', height: 50 },  // Schwarz
  1.25:{ bg: '#94a3b8', text: '#000000', height: 40 }, // Chrom/Silber
};

export const PlateCalculatorModal: React.FC<PlateCalculatorModalProps> = ({
  isOpen,
  initialWeightKg,
  exercise,
  gymProfile,
  onClose,
  onApplyWeight,
}) => {
  const [targetWeight, setTargetWeight] = useState<number>(initialWeightKg || 60);

  useEffect(() => {
    if (initialWeightKg > 0) {
      setTargetWeight(initialWeightKg);
    }
  }, [initialWeightKg]);

  if (!isOpen) return null;

  const barWeight = exercise.default_bar_or_sled_weight_kg || 20;
  const result: PlateCalculationResult = Gym80EquipmentService.calculatePlatesPerSide(
    targetWeight,
    barWeight,
    gymProfile.available_plates_kg
  );

  const isLegPress = exercise.default_bar_or_sled_weight_kg >= 50;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}
    >
      <div
        className="animate-slide-up"
        style={{
          width: '100%',
          maxWidth: 500,
          backgroundColor: '#121216',
          borderTop: '2px solid #3b82f6',
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: '16px 20px',
          paddingBottom: 'calc(var(--safe-bottom) + 16px)',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.9)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#3b82f6',
              }}
            >
              <Layers size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: '#f3f4f6' }}>Scheibenrechner</h3>
              <p style={{ fontSize: 12, color: '#9ca3af' }}>{exercise.name}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#1f1f28',
              border: 'none',
              borderRadius: '50%',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9ca3af',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Stepper Display */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#0a0a0d',
            border: '1px solid #272732',
            borderRadius: 14,
            padding: '10px 14px',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setTargetWeight((w) => Math.max(barWeight, Number((w - 5).toFixed(2))))}
              style={stepperBtnStyle}
            >
              -5
            </button>
            <button
              onClick={() => setTargetWeight((w) => Math.max(barWeight, Number((w - 2.5).toFixed(2))))}
              style={stepperBtnStyle}
            >
              <Minus size={16} />
            </button>
          </div>

          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1 }}>
              Gesamtgewicht
            </span>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#3b82f6', lineHeight: 1.1 }}>
              {targetWeight} <span style={{ fontSize: 18, color: '#9ca3af' }}>kg</span>
            </div>
            <span style={{ fontSize: 11, color: '#6b7280' }}>
              ({barWeight} kg {isLegPress ? 'Schlitten' : 'Stange'} + {result.weightToLoadTotalKg} kg Scheiben)
            </span>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setTargetWeight((w) => Number((w + 2.5).toFixed(2)))}
              style={stepperBtnStyle}
            >
              <Plus size={16} />
            </button>
            <button
              onClick={() => setTargetWeight((w) => Number((w + 5).toFixed(2)))}
              style={stepperBtnStyle}
            >
              +5
            </button>
          </div>
        </div>

        {/* Visual Barbell Representation */}
        <div
          style={{
            backgroundColor: '#08080a',
            border: '1px solid #20202a',
            borderRadius: 14,
            padding: '24px 12px',
            marginBottom: 16,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 12, color: '#22c55e', fontWeight: 800, marginBottom: 12 }}>
            PRO SEITE: {result.weightPerSideKg} kg
          </span>

          {/* Barbell Sleeve + Stack of Plates */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              minHeight: 120,
              position: 'relative',
            }}
          >
            {/* The Barbell Collar / Sleeve */}
            <div
              style={{
                width: 32,
                height: 50,
                backgroundColor: '#4b5563',
                borderRadius: '6px 0 0 6px',
                border: '1px solid #6b7280',
              }}
            />
            <div
              style={{
                width: 14,
                height: 70,
                backgroundColor: '#374151',
                borderRadius: 2,
              }}
            />

            {/* Plates Rendered side by side */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 4 }}>
              {result.platesPerSide.length === 0 ? (
                <span style={{ color: '#6b7280', fontSize: 13, padding: '0 16px' }}>
                  Keine Scheiben (nur Eigengewicht)
                </span>
              ) : (
                result.platesPerSide.map((group) => {
                  const styleConfig = PLATE_COLORS[group.plateKg] || {
                    bg: '#3b82f6',
                    text: '#ffffff',
                    height: 70,
                  };
                  return Array.from({ length: group.count }).map((_, i) => (
                    <div
                      key={`${group.plateKg}-${i}`}
                      style={{
                        width: 22,
                        height: styleConfig.height,
                        backgroundColor: styleConfig.bg,
                        color: styleConfig.text,
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        fontWeight: 900,
                        writingMode: 'vertical-rl',
                        textOrientation: 'mixed',
                        border: '1px solid rgba(0,0,0,0.3)',
                        boxShadow: '2px 0 6px rgba(0,0,0,0.5)',
                      }}
                    >
                      {group.plateKg}
                    </div>
                  ));
                })
              )}
            </div>

            {/* Empty Sleeve End */}
            <div
              style={{
                flex: 1,
                maxWidth: 80,
                height: 20,
                backgroundColor: '#6b7280',
                borderRadius: '0 4px 4px 0',
              }}
            />
          </div>
        </div>

        {/* Detailed Breakdown List */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {result.platesPerSide.map((p) => (
              <span
                key={p.plateKg}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  backgroundColor: '#1b1b24',
                  border: '1px solid #2e2e3d',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#f3f4f6',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: PLATE_COLORS[p.plateKg]?.bg || '#3b82f6',
                  }}
                />
                {p.count}× {p.plateKg} kg Scheibe
              </span>
            ))}
          </div>
        </div>

        {/* Apply / Close Button */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              background: '#1b1b24',
              border: '1px solid #2e2e3d',
              borderRadius: 12,
              color: '#e2e8f0',
              fontWeight: 700,
              fontSize: 15,
              minHeight: 50,
            }}
          >
            Schließen
          </button>
          {onApplyWeight && (
            <button
              onClick={() => {
                onApplyWeight(targetWeight);
                onClose();
              }}
              style={{
                flex: 1.5,
                background: '#22c55e',
                border: 'none',
                borderRadius: 12,
                color: '#000000',
                fontWeight: 900,
                fontSize: 15,
                minHeight: 50,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <Check size={20} />
              Als Ist-Gewicht setzen
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const stepperBtnStyle: React.CSSProperties = {
  background: '#1b1b26',
  border: '1px solid #2e2e3e',
  borderRadius: 10,
  color: '#f3f4f6',
  fontWeight: 800,
  fontSize: 15,
  width: 44,
  height: 44,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
