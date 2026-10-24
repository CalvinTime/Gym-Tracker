import React, { useState, useEffect } from 'react';
import type { Exercise, EquipmentType, MovementType, Laterality, TrackingType } from '../../core/models/types.ts';
import { db } from '../../core/db/database.ts';
import { Search, Plus, Trophy, Edit2, X } from 'lucide-react';

const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  barbell: 'Langhantel',
  dumbbell: 'Kurzhantel',
  cable_stack: 'Kabelzug',
  machine_stack: 'Maschine',
  plate_loaded: 'Plate-Loaded',
  bodyweight: 'Eigengewicht',
};

export const ExercisesTab: React.FC = () => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEquipment, setSelectedEquipment] = useState<string>('Alle');

  // Modal State für neue Übung
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newEquipment, setNewEquipment] = useState<EquipmentType>('cable_stack');
  const [newMovement, setNewMovement] = useState<MovementType>('compound');
  const [newLaterality, setNewLaterality] = useState<Laterality>('bilateral');
  const [newTracking, setNewTracking] = useState<TrackingType>('weight_reps');
  const [newPulleyRatio, setNewPulleyRatio] = useState<number>(0.5);
  const [newDefaultWeight, setNewDefaultWeight] = useState<number>(0);
  const [newSetupNote, setNewSetupNote] = useState<string>('');

  // Inline Note Edit
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [inlineNote, setInlineNote] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const exList = await db.exercises.toArray();
    exList.sort((a, b) => a.name.localeCompare(b.name));
    setExercises(exList);
  };

  const handleSaveInlineNote = async (exerciseId: string) => {
    await db.exercises.update(exerciseId, { pinned_setup_note: inlineNote });
    setExercises((prev) =>
      prev.map((e) => (e.id === exerciseId ? { ...e, pinned_setup_note: inlineNote } : e))
    );
    setEditingNoteId(null);
  };

  const handleCreateExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const now = new Date().toISOString();
    const newEx: Exercise = {
      id: crypto.randomUUID ? crypto.randomUUID() : `ex-${Date.now()}`,
      name: newName.trim(),
      tracking_type: newTracking,
      equipment_type: newEquipment,
      movement_type: newMovement,
      laterality: newLaterality,
      pulley_ratio: newEquipment === 'cable_stack' ? newPulleyRatio : 1.0,
      default_bar_or_sled_weight_kg: newDefaultWeight,
      bodyweight_factor: newTracking === 'bodyweight_reps' ? 1.0 : 0,
      pinned_setup_note: newSetupNote.trim(),
      custom_rest_seconds: newMovement === 'compound' ? 180 : 90,
      best_1rm: null,
      best_10rm: null,
      max_volume_set: null,
      created_at: now,
      updated_at: now,
    };

    await db.exercises.add(newEx);
    setExercises((prev) => [...prev, newEx].sort((a, b) => a.name.localeCompare(b.name)));
    setCreateModalOpen(false);

    // Reset Form
    setNewName('');
    setNewSetupNote('');
    setNewDefaultWeight(0);
  };

  // Filter Logik
  const filteredExercises = exercises.filter((ex) => {
    const matchesSearch = ex.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesEquipment =
      selectedEquipment === 'Alle' ||
      EQUIPMENT_LABELS[ex.equipment_type] === selectedEquipment;
    return matchesSearch && matchesEquipment;
  });

  return (
    <div style={{ padding: '16px 14px', maxWidth: 600, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#22c55e', textTransform: 'uppercase', letterSpacing: 1.5 }}>
            Übungskatalog
          </span>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#ffffff' }}>Übungen ({exercises.length})</h1>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          style={{
            backgroundColor: '#22c55e',
            color: '#000000',
            border: 'none',
            borderRadius: 12,
            padding: '8px 14px',
            fontWeight: 800,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            minHeight: 44,
          }}
        >
          <Plus size={18} />
          + Übung
        </button>
      </div>

      {/* Suchfeld */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          backgroundColor: '#101016',
          border: '1px solid #232330',
          borderRadius: 12,
          padding: '10px 14px',
          marginBottom: 12,
        }}
      >
        <Search size={18} color="#6b7280" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Übung suchen (z.B. Brustpresse, Latzug...)"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#f3f4f6',
            fontSize: 15,
            width: '100%',
            outline: 'none',
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{ background: 'none', border: 'none', color: '#6b7280', minHeight: 'auto' }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Equipment Filter Chips */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          paddingBottom: 10,
          marginBottom: 12,
          scrollbarWidth: 'none',
        }}
      >
        {['Alle', 'Kabelzug', 'Maschine', 'Langhantel', 'Kurzhantel', 'Plate-Loaded', 'Eigengewicht'].map((eq) => (
          <button
            key={eq}
            onClick={() => setSelectedEquipment(eq)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              border: `1px solid ${selectedEquipment === eq ? '#22c55e' : '#232330'}`,
              backgroundColor: selectedEquipment === eq ? 'rgba(34, 197, 94, 0.15)' : '#101016',
              color: selectedEquipment === eq ? '#22c55e' : '#9ca3af',
              fontSize: 13,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              minHeight: 36,
            }}
          >
            {eq}
          </button>
        ))}
      </div>

      {/* Übungs-Karten Liste */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filteredExercises.map((ex) => {
          const isCable = ex.equipment_type === 'cable_stack';

          return (
            <div
              key={ex.id}
              style={{
                backgroundColor: '#0d0d12',
                border: '1px solid #1e1e28',
                borderRadius: 14,
                padding: '14px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#f3f4f6' }}>
                    {ex.name}
                  </h3>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 11,
                        padding: '2px 6px',
                        borderRadius: 4,
                        backgroundColor: '#1a1a24',
                        color: '#9ca3af',
                        fontWeight: 600,
                      }}
                    >
                      {EQUIPMENT_LABELS[ex.equipment_type]}
                    </span>

                    {/* Pulley Ratio Badge */}
                    {isCable && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          backgroundColor: ex.pulley_ratio === 0.5 ? 'rgba(6, 182, 212, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                          color: ex.pulley_ratio === 0.5 ? '#06b6d4' : '#a855f7',
                          border: `1px solid ${ex.pulley_ratio === 0.5 ? '#06b6d4' : '#a855f7'}`,
                        }}
                      >
                        {ex.pulley_ratio === 0.5 ? '1:2 Flaschenzug' : '1:1 Direktzug'}
                      </span>
                    )}

                    {ex.default_bar_or_sled_weight_kg > 0 && (
                      <span
                        style={{
                          fontSize: 11,
                          padding: '2px 6px',
                          borderRadius: 4,
                          backgroundColor: '#1f241f',
                          color: '#86efac',
                          fontWeight: 700,
                        }}
                      >
                        +{ex.default_bar_or_sled_weight_kg}kg Eigengewicht
                      </span>
                    )}
                  </div>
                </div>

                {/* PR Records Trophy */}
                {ex.best_1rm && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      backgroundColor: 'rgba(234, 179, 8, 0.15)',
                      border: '1px solid #ca8a04',
                      padding: '3px 8px',
                      borderRadius: 6,
                    }}
                  >
                    <Trophy size={13} color="#facc15" />
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#facc15' }}>
                      {ex.best_1rm} kg 1RM
                    </span>
                  </div>
                )}
              </div>

              {/* Pinned Setup Note */}
              <div style={{ marginTop: 8 }}>
                {editingNoteId === ex.id ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="text"
                      value={inlineNote}
                      onChange={(e) => setInlineNote(e.target.value)}
                      placeholder="z.B. Sitz 4, Rolle 2"
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
                      onClick={() => handleSaveInlineNote(ex.id)}
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
                      Speichern
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => {
                      setEditingNoteId(ex.id);
                      setInlineNote(ex.pinned_setup_note || '');
                    }}
                    style={{
                      fontSize: 12,
                      color: ex.pinned_setup_note ? '#a7f3d0' : '#6b7280',
                      backgroundColor: ex.pinned_setup_note ? 'rgba(34, 197, 94, 0.08)' : '#14141c',
                      padding: '6px 10px',
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                    }}
                  >
                    <span>
                      {ex.pinned_setup_note ? `Geräte-Setup: ${ex.pinned_setup_note}` : '+ Sitz- / Hebeleinstellung notieren'}
                    </span>
                    <Edit2 size={12} color="#6b7280" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: NEUE EIGENE ÜBUNG ANLEGEN */}
      {createModalOpen && (
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
              borderTop: '2px solid #22c55e',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: '20px',
              paddingBottom: 'calc(var(--safe-bottom) + 20px)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 900, color: '#f3f4f6' }}>Neue Übung anlegen</h2>
              <button
                onClick={() => setCreateModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#9ca3af', minHeight: 'auto' }}
              >
                <X size={22} />
              </button>
            </div>

            <form onSubmit={handleCreateExercise} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af' }}>Name der Übung *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="z.B. gym80 Schrägbankdrücken"
                  required
                  style={inputModalStyle}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af' }}>Gerätetyp</label>
                <select
                  value={newEquipment}
                  onChange={(e) => setNewEquipment(e.target.value as EquipmentType)}
                  style={inputModalStyle}
                >
                  <option value="cable_stack">Kabelzug (Steckblock)</option>
                  <option value="machine_stack">Maschine (Steckblock)</option>
                  <option value="barbell">Langhantel</option>
                  <option value="dumbbell">Kurzhantel</option>
                  <option value="plate_loaded">Plate-Loaded (Scheiben)</option>
                  <option value="bodyweight">Eigengewicht</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af' }}>Bewegungstyp</label>
                  <select
                    value={newMovement}
                    onChange={(e) => setNewMovement(e.target.value as MovementType)}
                    style={inputModalStyle}
                  >
                    <option value="compound">Grundübung</option>
                    <option value="isolation">Isolation</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af' }}>Ausführung</label>
                  <select
                    value={newLaterality}
                    onChange={(e) => setNewLaterality(e.target.value as Laterality)}
                    style={inputModalStyle}
                  >
                    <option value="bilateral">Beidseitig</option>
                    <option value="unilateral">Einseitig</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af' }}>Tracking-Modus</label>
                <select
                  value={newTracking}
                  onChange={(e) => setNewTracking(e.target.value as TrackingType)}
                  style={inputModalStyle}
                >
                  <option value="weight_reps">Gewicht & Wdh.</option>
                  <option value="bodyweight_reps">Körpergewicht + Zusatzgewicht</option>
                  <option value="assisted_bodyweight">Assistiertes Körpergewicht</option>
                  <option value="duration_seconds">Zeit / Sekunden</option>
                </select>
              </div>

              {/* Seilzug Übersetzung bei Kabelzug */}
              {newEquipment === 'cable_stack' && (
                <div style={{ backgroundColor: '#181824', padding: '10px 12px', borderRadius: 10, border: '1px solid #29293e' }}>
                  <label style={{ fontSize: 12, fontWeight: 800, color: '#06b6d4', display: 'block', marginBottom: 6 }}>
                    Kabelturm-Übersetzung (Pulley Ratio)
                  </label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#f3f4f6', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        checked={newPulleyRatio === 0.5}
                        onChange={() => setNewPulleyRatio(0.5)}
                      />
                      1:2 Flaschenzug (verstellbarer gym80 Kabelturm)
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#f3f4f6', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        checked={newPulleyRatio === 1.0}
                        onChange={() => setNewPulleyRatio(1.0)}
                      />
                      1:1 Direktzug (Latzug / Rudern)
                    </label>
                  </div>
                </div>
              )}

              {/* Startgewicht bei Langhantel / Plate Loaded */}
              {(newEquipment === 'barbell' || newEquipment === 'plate_loaded') && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af' }}>
                    Stangen- oder Schlittengewicht (kg)
                  </label>
                  <input
                    type="number"
                    value={newDefaultWeight}
                    onChange={(e) => setNewDefaultWeight(parseFloat(e.target.value) || 0)}
                    placeholder="20 für Olympia-Stange, 50 für Beinpresse"
                    style={inputModalStyle}
                  />
                </div>
              )}

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af' }}>Dauerhafte Sitz- / Geräteeinstellung</label>
                <input
                  type="text"
                  value={newSetupNote}
                  onChange={(e) => setNewSetupNote(e.target.value)}
                  placeholder="z.B. Sitz auf 4, Polster auf 2"
                  style={inputModalStyle}
                />
              </div>

              <button
                type="submit"
                style={{
                  backgroundColor: '#22c55e',
                  color: '#000000',
                  border: 'none',
                  borderRadius: 12,
                  padding: '14px',
                  fontWeight: 900,
                  fontSize: 16,
                  marginTop: 10,
                  minHeight: 52,
                }}
              >
                Übung speichern
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const inputModalStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#181822',
  border: '1px solid #28283a',
  borderRadius: 10,
  padding: '10px 12px',
  color: '#f3f4f6',
  fontSize: 14,
  marginTop: 4,
  outline: 'none',
};
