import React, { useState, useEffect } from 'react';
import type { GymProfile, BodyMeasurement } from '../../core/models/types.ts';
import { db } from '../../core/db/database.ts';
import { BackupImportService } from '../../core/services/backup-import.service.ts';
import { SEED_GYM_PROFILE_ID } from '../../core/db/seed-data.ts';
import {
  Download,
  Upload,
  FileSpreadsheet,
  Scale,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Plus,
} from 'lucide-react';

export const ProfileTab: React.FC = () => {
  const [gymProfile, setGymProfile] = useState<GymProfile | null>(null);
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [newWeightInput, setNewWeightInput] = useState<string>('');

  // Status-Meldungen
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // CSV Import State
  const [csvModalOpen, setCsvModalOpen] = useState<boolean>(false);
  const [csvText, setCsvText] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const profile = await db.gym_profiles.get(SEED_GYM_PROFILE_ID);
    if (profile) setGymProfile(profile);

    const mList = await db.body_measurements.orderBy('recorded_at').reverse().toArray();
    setMeasurements(mList);
    if (mList.length > 0 && !newWeightInput) {
      setNewWeightInput(mList[0].bodyweight_kg.toString());
    }
  };

  // Körpergewicht erfassen
  const handleAddWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    const weight = BackupImportService.parseLocalizedNumber(newWeightInput);
    if (isNaN(weight) || weight <= 0) return;

    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toISOString();

    const entry: BodyMeasurement = {
      id: crypto.randomUUID ? crypto.randomUUID() : `bm-${Date.now()}`,
      recorded_at: today,
      bodyweight_kg: Number(weight.toFixed(2)),
      bodyfat_pct: null,
      notes: null,
      created_at: now,
      updated_at: now,
    };

    await db.body_measurements.add(entry);
    await loadData();
    setStatusMessage({ type: 'success', text: `Körpergewicht ${weight} kg gespeichert!` });
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // 1-KLICK JSON BACKUP DOWNLOAD
  const handleExportJson = async () => {
    try {
      const json = await BackupImportService.exportFullDatabaseJson(db);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `gym80-tracker-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatusMessage({ type: 'success', text: '1-Klick Backup erfolgreich heruntergeladen!' });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch {
      setStatusMessage({ type: 'error', text: 'Fehler beim Erstellen des Backups.' });
    }
  };

  // 1-KLICK JSON BACKUP RESTORE (FILE INPUT)
  const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const result = await BackupImportService.importFullDatabaseJson(db, content);
        if (result.success) {
          await loadData();
          setStatusMessage({ type: 'success', text: result.message });
        } else {
          setStatusMessage({ type: 'error', text: result.message });
        }
      } catch {
        setStatusMessage({ type: 'error', text: 'Datei konnte nicht gelesen werden.' });
      }
      setTimeout(() => setStatusMessage(null), 5000);
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  // CSV IMPORT
  const handleImportCsv = async () => {
    if (!csvText.trim()) return;
    try {
      const result = await BackupImportService.importFromCsv(db, csvText, SEED_GYM_PROFILE_ID);
      if (result.success) {
        setCsvModalOpen(false);
        setCsvText('');
        setStatusMessage({ type: 'success', text: result.message });
      } else {
        setStatusMessage({ type: 'error', text: result.message });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Fehler beim CSV-Import.' });
    }
    setTimeout(() => setStatusMessage(null), 5000);
  };

  return (
    <div style={{ padding: '16px 14px', maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: '#22c55e', textTransform: 'uppercase', letterSpacing: 1.5 }}>
          Einstellungen & Datensicherheit
        </span>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#ffffff' }}>Profil & Daten</h1>
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          className="animate-slide-up"
          style={{
            backgroundColor: statusMessage.type === 'success' ? '#0f291e' : '#331215',
            border: `1px solid ${statusMessage.type === 'success' ? '#22c55e' : '#ef4444'}`,
            color: statusMessage.type === 'success' ? '#4ade80' : '#fca5a5',
            padding: '12px 14px',
            borderRadius: 12,
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {statusMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* 1. KÖRPERGEWICHT TRACKER */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Scale size={18} color="#22c55e" />
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#f3f4f6' }}>Körpergewicht</h2>
        </div>

        <form onSubmit={handleAddWeight} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input
            type="text"
            value={newWeightInput}
            onChange={(e) => setNewWeightInput(e.target.value)}
            placeholder="z.B. 82,5 kg"
            style={{
              flex: 1,
              backgroundColor: '#14141e',
              border: '1px solid #29293c',
              borderRadius: 10,
              padding: '10px 14px',
              color: '#f3f4f6',
              fontSize: 16,
              fontWeight: 800,
              outline: 'none',
            }}
          />
          <button
            type="submit"
            style={{
              backgroundColor: '#22c55e',
              color: '#000000',
              border: 'none',
              borderRadius: 10,
              padding: '0 18px',
              fontWeight: 900,
              fontSize: 14,
              minHeight: 46,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Plus size={18} /> Speichern
          </button>
        </form>

        {/* Letzte Wägungen */}
        {measurements.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {measurements.slice(0, 4).map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 10px',
                  backgroundColor: '#12121a',
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                <span style={{ color: '#9ca3af' }}>{m.recorded_at}</span>
                <span style={{ fontWeight: 800, color: '#f3f4f6' }}>
                  {m.bodyweight_kg} kg
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. 1-KLICK DATENSICHERUNG & RESTORE */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <ShieldCheck size={18} color="#3b82f6" />
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#f3f4f6' }}>1-Klick Backup & Restore</h2>
        </div>
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 14, lineHeight: 1.4 }}>
          Alle Daten liegen zu 100% lokal auf deinem Smartphone. Sichere regelmäßig dein Backup als JSON-Datei.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Export Button */}
          <button
            onClick={handleExportJson}
            style={{
              backgroundColor: '#181f2f',
              border: '1px solid #2d416b',
              borderRadius: 12,
              padding: '12px 16px',
              color: '#60a5fa',
              fontWeight: 800,
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              minHeight: 48,
            }}
          >
            <Download size={18} />
            Backup als JSON herunterladen
          </button>

          {/* Import File Button */}
          <label
            style={{
              backgroundColor: '#171720',
              border: '1px dashed #303042',
              borderRadius: 12,
              padding: '12px 16px',
              color: '#e2e8f0',
              fontWeight: 700,
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
              minHeight: 48,
            }}
          >
            <Upload size={18} color="#22c55e" />
            <span>JSON-Backup wiederherstellen</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportJsonFile}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      {/* 3. CSV-IMPORT (STRONG, HEVY, FITNOTES) */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <FileSpreadsheet size={18} color="#a855f7" />
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#f3f4f6' }}>CSV-Import</h2>
        </div>
        <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>
          Trainingshistorie aus Strong, Hevy oder FitNotes (inkl. deutscher Bezeichnungen) importieren.
        </p>

        <button
          onClick={() => setCsvModalOpen(true)}
          style={{
            width: '100%',
            backgroundColor: '#1b1424',
            border: '1px solid #4a296d',
            borderRadius: 12,
            padding: '12px',
            color: '#c084fc',
            fontWeight: 800,
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            minHeight: 48,
          }}
        >
          <FileSpreadsheet size={18} />
          CSV-Daten einfügen / importieren
        </button>
      </div>

      {/* 4. MCFIT GYM80 EQUIPMENT SETTINGS */}
      {gymProfile && (
        <div
          style={{
            backgroundColor: '#0d0d12',
            border: '1px solid #20202c',
            borderRadius: 16,
            padding: '16px',
          }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#e5e7eb', marginBottom: 10 }}>
            Aktives Studio-Profil
          </h3>
          <div style={{ fontSize: 13, color: '#22c55e', fontWeight: 800, marginBottom: 8 }}>
            {gymProfile.name}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#9ca3af' }}>
            <div>• Standard-Blockabstufung: <strong>{gymProfile.stack_increment_kg} kg</strong></div>
            <div>• gym80 Micro-Addon: <strong>+{gymProfile.stack_micro_addon_kg} kg</strong></div>
            <div>• Kurzhantelsatz: <strong>1–10 kg (1er), 12–50 kg (2er Schritte)</strong></div>
            <div>• Hantelscheiben: <strong>{gymProfile.available_plates_kg.join(', ')} kg</strong></div>
          </div>
        </div>
      )}

      {/* CSV MODAL */}
      {csvModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
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
              backgroundColor: '#121218',
              borderTop: '2px solid #a855f7',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: '20px',
              paddingBottom: 'calc(var(--safe-bottom) + 20px)',
            }}
          >
            <h2 style={{ fontSize: 18, fontWeight: 900, color: '#f3f4f6', marginBottom: 10 }}>
              CSV-Trainingsdaten importieren
            </h2>
            <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>
              Kopiere den Inhalt deiner Strong- oder Hevy-CSV-Datei hier hinein:
            </p>
            <textarea
              rows={8}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Date,Exercise Name,Set Order,Weight (kg),Reps&#10;2026-10-20,Bench Press,1,80,10..."
              style={{
                width: '100%',
                backgroundColor: '#181822',
                border: '1px solid #2e2e42',
                borderRadius: 10,
                padding: '10px',
                color: '#f3f4f6',
                fontSize: 12,
                fontFamily: 'monospace',
                outline: 'none',
                marginBottom: 14,
              }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setCsvModalOpen(false)}
                style={{
                  flex: 1,
                  background: '#1c1c28',
                  border: '1px solid #2c2c3e',
                  borderRadius: 10,
                  color: '#9ca3af',
                  fontWeight: 700,
                  fontSize: 14,
                  minHeight: 46,
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={handleImportCsv}
                style={{
                  flex: 1.5,
                  background: '#a855f7',
                  border: 'none',
                  borderRadius: 10,
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: 14,
                  minHeight: 46,
                }}
              >
                Import starten
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
