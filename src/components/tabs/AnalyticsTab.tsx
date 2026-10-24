import React, { useState, useEffect } from 'react';
import type { Exercise } from '../../core/models/types.ts';
import { db } from '../../core/db/database.ts';
import {
  AnalyticsService,
  type MuscleVolumeEntry,
  type VolumeMode,
  type ExerciseHistoryPoint,
  type HistoryMetric,
} from '../../core/services/analytics.service.ts';
import { BarChart3, TrendingUp } from 'lucide-react';

export const AnalyticsTab: React.FC = () => {
  const [volumeMode, setVolumeMode] = useState<VolumeMode>('direct');
  const [muscleVolumes, setMuscleVolumes] = useState<MuscleVolumeEntry[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('');
  const [selectedMetric, setSelectedMetric] = useState<HistoryMetric>('e1rm');
  const [historyPoints, setHistoryPoints] = useState<ExerciseHistoryPoint[]>([]);

  useEffect(() => {
    loadVolumeData();
  }, [volumeMode]);

  useEffect(() => {
    loadExercisesAndHistory();
  }, [selectedExerciseId, selectedMetric]);

  const loadVolumeData = async () => {
    // Letzte 7 Tage berechnen
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    const startDate = sevenDaysAgo.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];

    const vol = await AnalyticsService.getWeeklyMuscleVolume(db, startDate, endDate, volumeMode);
    setMuscleVolumes(vol);
  };

  const loadExercisesAndHistory = async () => {
    const exList = await db.exercises.toArray();
    exList.sort((a, b) => a.name.localeCompare(b.name));
    setExercises(exList);

    const targetExId = selectedExerciseId || (exList.length > 0 ? exList[0].id : '');
    if (!selectedExerciseId && exList.length > 0) {
      setSelectedExerciseId(exList[0].id);
    }

    if (targetExId) {
      const points = await AnalyticsService.getExerciseHistoryChart(db, targetExId, selectedMetric);
      setHistoryPoints(points);
    }
  };

  return (
    <div style={{ padding: '16px 14px', maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#22c55e', textTransform: 'uppercase', letterSpacing: 1.5 }}>
          Progress & Hypertrophie
        </span>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#ffffff' }}>Statistik</h1>
      </div>

      {/* 1. WOCHENVOLUMEN PRO MUSKELGRUPPE */}
      <div
        style={{
          backgroundColor: '#0d0d12',
          border: '1px solid #20202c',
          borderRadius: 16,
          padding: '16px',
          marginBottom: 20,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart3 size={18} color="#22c55e" />
            <h2 style={{ fontSize: 16, fontWeight: 800, color: '#f3f4f6' }}>
              Wochenvolumen (7 Tage)
            </h2>
          </div>

          {/* Toggle: Direkt vs. Fraktional */}
          <div style={{ display: 'flex', backgroundColor: '#181822', borderRadius: 8, padding: 2 }}>
            <button
              onClick={() => setVolumeMode('direct')}
              style={{
                background: volumeMode === 'direct' ? '#22c55e' : 'transparent',
                color: volumeMode === 'direct' ? '#000000' : '#9ca3af',
                border: 'none',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 800,
                minHeight: 30,
              }}
            >
              Direkt (1.0)
            </button>
            <button
              onClick={() => setVolumeMode('fractional')}
              style={{
                background: volumeMode === 'fractional' ? '#22c55e' : 'transparent',
                color: volumeMode === 'fractional' ? '#000000' : '#9ca3af',
                border: 'none',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 800,
                minHeight: 30,
              }}
            >
              Fraktional
            </button>
          </div>
        </div>

        {/* MEV / MAV Orientierungs-Hinweis */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11,
            color: '#9ca3af',
            marginBottom: 14,
            padding: '6px 10px',
            backgroundColor: '#13131c',
            borderRadius: 8,
          }}
        >
          <span>MEV: 10 Sätze</span>
          <span style={{ color: '#22c55e', fontWeight: 700 }}>Optimal: 12–18 Sätze (MAV)</span>
          <span>MRV: 20 Sätze</span>
        </div>

        {/* Volumen Balken-Liste */}
        {muscleVolumes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#6b7280', fontSize: 13 }}>
            Noch keine absolvierten Arbeitssätze in den letzten 7 Tagen.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {muscleVolumes.map((entry) => {
              const sets = entry.weighted_sets;
              // Maximal-Skala 22 Sätze für den Balken
              const pct = Math.min(100, (sets / 22) * 100);

              // Farbkodierung nach Hypertrophie-Zonen
              let barColor = '#38bdf8'; // Unter MEV (< 10)
              let zoneText = 'Unter MEV';
              if (sets >= 10 && sets <= 20) {
                barColor = '#22c55e'; // MAV Hypertrophie-Zone (10-20)
                zoneText = 'Optimal (MAV)';
              } else if (sets > 20) {
                barColor = '#f59e0b'; // Hohe Belastung (> 20)
                zoneText = 'MRV erreicht';
              }

              return (
                <div key={entry.muscle_id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#e5e7eb' }}>
                      {entry.muscle_name_de}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, color: barColor, fontWeight: 700 }}>
                        {zoneText}
                      </span>
                      <span style={{ fontSize: 14, fontWeight: 900, color: '#ffffff', fontVariantNumeric: 'tabular-nums' }}>
                        {sets} <span style={{ fontSize: 11, color: '#9ca3af' }}>Sätze</span>
                      </span>
                    </div>
                  </div>

                  {/* Visual Bar mit MEV/MAV Markern */}
                  <div
                    style={{
                      height: 8,
                      width: '100%',
                      backgroundColor: '#1b1b26',
                      borderRadius: 4,
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${pct}%`,
                        backgroundColor: barColor,
                        borderRadius: 4,
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. KRAFTVERLAUF & REKORDE PRO ÜBUNG */}
      <div
        style={{
          backgroundColor: '#0d0d12',
          border: '1px solid #20202c',
          borderRadius: 16,
          padding: '16px',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <TrendingUp size={18} color="#38bdf8" />
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#f3f4f6' }}>
            Kraftverlauf & 1RM Progression
          </h2>
        </div>

        {/* Übungsauswahl */}
        <div style={{ marginBottom: 12 }}>
          <select
            value={selectedExerciseId}
            onChange={(e) => setSelectedExerciseId(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: '#14141e',
              border: '1px solid #28283a',
              borderRadius: 10,
              padding: '10px 12px',
              color: '#f3f4f6',
              fontSize: 14,
              fontWeight: 700,
              outline: 'none',
            }}
          >
            {exercises.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
        </div>

        {/* Metrik-Auswahl: e1RM / e10RM / Stack Weight */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 16 }}>
          {[
            { id: 'e1rm' as HistoryMetric, label: 'e1RM (Epley)' },
            { id: 'e10rm' as HistoryMetric, label: 'e10RM' },
            { id: 'stack_weight' as HistoryMetric, label: 'Gewicht (kg)' },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedMetric(m.id)}
              style={{
                backgroundColor: selectedMetric === m.id ? '#38bdf8' : '#14141e',
                color: selectedMetric === m.id ? '#000000' : '#9ca3af',
                border: `1px solid ${selectedMetric === m.id ? '#38bdf8' : '#222232'}`,
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 800,
                padding: '6px 4px',
                minHeight: 36,
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* SVG Time-Series Chart */}
        {historyPoints.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 0', color: '#6b7280', fontSize: 13 }}>
            Keine absolvierten Einheiten für diese Übung gefunden.
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
              <span style={{ color: '#9ca3af' }}>Letzter Bestwert:</span>
              <span style={{ color: '#38bdf8', fontWeight: 900, fontSize: 16 }}>
                {historyPoints[historyPoints.length - 1].value} kg
              </span>
            </div>

            {/* SVG Trendline */}
            <div
              style={{
                width: '100%',
                height: 160,
                backgroundColor: '#07070a',
                borderRadius: 12,
                border: '1px solid #1c1c28',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="100%" height="100%" viewBox="0 0 320 140" preserveAspectRatio="none">
                {/* Grid Lines */}
                <line x1="0" y1="35" x2="320" y2="35" stroke="#1f1f2e" strokeDasharray="4 4" />
                <line x1="0" y1="70" x2="320" y2="70" stroke="#1f1f2e" strokeDasharray="4 4" />
                <line x1="0" y1="105" x2="320" y2="105" stroke="#1f1f2e" strokeDasharray="4 4" />

                {/* Plot Data Points */}
                {(() => {
                  const vals = historyPoints.map((p) => p.value);
                  const min = Math.min(...vals) * 0.9;
                  const max = Math.max(...vals) * 1.1 || 100;
                  const range = max - min || 1;

                  const coords = historyPoints.map((p, i) => {
                    const x = historyPoints.length > 1 ? (i / (historyPoints.length - 1)) * 300 + 10 : 160;
                    const y = 130 - ((p.value - min) / range) * 110;
                    return { x, y, point: p };
                  });

                  const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');

                  return (
                    <>
                      {/* Trendline */}
                      {coords.length > 1 && (
                        <path
                          d={pathD}
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      )}

                      {/* Circles on Points */}
                      {coords.map((c, i) => (
                        <g key={i}>
                          <circle cx={c.x} cy={c.y} r="5" fill="#38bdf8" stroke="#000" strokeWidth="2" />
                          <text
                            x={c.x}
                            y={c.y - 8}
                            fill="#f3f4f6"
                            fontSize="10"
                            fontWeight="800"
                            textAnchor="middle"
                          >
                            {c.point.value}
                          </text>
                        </g>
                      ))}
                    </>
                  );
                })()}
              </svg>
            </div>

            {/* Datum Labels Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: '#6b7280' }}>
              <span>{historyPoints[0].date}</span>
              <span>{historyPoints[historyPoints.length - 1].date}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
