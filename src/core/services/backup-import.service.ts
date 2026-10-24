import type { GymTrackerDB } from '../db/database.ts';
import { generateUUID, currentISO } from '../utils/uuid.ts';

// ── Interfaces ─────────────────────────────────────────────────────────

export interface BackupData {
  version: number;
  exported_at: string;
  tables: {
    gym_profiles: unknown[];
    muscles: unknown[];
    exercises: unknown[];
    exercise_muscles: unknown[];
    routine_templates: unknown[];
    routine_exercises: unknown[];
    routine_set_templates: unknown[];
    workouts: unknown[];
    workout_exercises: unknown[];
    workout_sets: unknown[];
    body_measurements: unknown[];
  };
}

export interface ImportResult {
  success: boolean;
  message: string;
  counts: Record<string, number>;
}

export interface CsvImportResult {
  success: boolean;
  message: string;
  exercisesCreated: number;
  workoutsCreated: number;
  setsImported: number;
  warnings: string[];
}

// ── CSV-Spalten-Mappings für verschiedene Apps ──────────────────────────

/**
 * Bekannte Spalten-Header aus verschiedenen Gym-Tracker-Apps.
 * Wir matchen case-insensitive und mit deutschen Varianten.
 */
const DATE_HEADERS = ['date', 'datum', 'day', 'tag', 'workout date', 'training datum'];
const EXERCISE_HEADERS = ['exercise', 'exercise name', 'übung', 'übungsname', 'exercise_name'];
const WEIGHT_HEADERS = ['weight', 'weight (kg)', 'gewicht', 'gewicht (kg)', 'weight_kg'];
const REPS_HEADERS = ['reps', 'repetitions', 'wiederholungen', 'wdh', 'reps_count'];
const SET_HEADERS = ['set order', 'set', 'satz', 'set_number', 'satznummer'];
const NOTES_HEADERS = ['notes', 'workout notes', 'notizen', 'anmerkung', 'note'];

// ── Service ────────────────────────────────────────────────────────────

/**
 * BackupImportService
 *
 * 1-Klick Komplett-Backup & Restore sowie CSV-Import.
 * Damit auf dem Samsung-Handy niemals Daten verloren gehen.
 */
export class BackupImportService {

  // ──────────────────────── Lokalisierte Zahl-Konversion ────────────────

  /**
   * Wandelt deutsche Dezimalkomma-Eingaben ("27,5") zuverlässig in Zahlen um.
   * Unterstützt:
   * - "27,5"   → 27.5
   * - "27.5"   → 27.5
   * - "1.250"  → 1250 (Tausender-Punkt ohne Komma = Tausendertrennzeichen)
   * - "1.250,5"→ 1250.5
   * - ""       → NaN
   * - "abc"    → NaN
   */
  static parseLocalizedNumber(input: string): number {
    if (!input || typeof input !== 'string') return NaN;

    let cleaned = input.trim();
    if (cleaned === '') return NaN;

    // Enthält sowohl Punkt als auch Komma?
    const hasDot = cleaned.includes('.');
    const hasComma = cleaned.includes(',');

    if (hasDot && hasComma) {
      // Deutsches Format: 1.250,5 → Punkte sind Tausender, Komma ist Dezimal
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (hasComma) {
      // Nur Komma: 27,5 → Dezimalkomma
      cleaned = cleaned.replace(',', '.');
    } else if (hasDot) {
      // Nur Punkt: Prüfe ob es ein Tausenderpunkt ist (genau 3 Ziffern nach dem Punkt ohne weitere Dezimalstelle)
      const parts = cleaned.split('.');
      if (parts.length === 2 && parts[1].length === 3 && !parts[1].includes('.')) {
        // Heuristik: z.B. "1.250" → könnte 1250 sein (Tausenderpunkt)
        // Aber in der Gym-Tracker-Welt sind Gewichte selten >999 kg,
        // also nur >100 als Tausenderpunkt interpretieren
        const asDecimal = parseFloat(cleaned);
        const asThousand = parseFloat(cleaned.replace('.', ''));
        // Bei Fitness-Gewichten: wenn asDecimal < 100, ist es wahrscheinlich eine Dezimalzahl
        if (asDecimal > 100) {
          return asThousand;
        }
        return asDecimal;
      }
      // Sonst: normaler Dezimalpunkt (z.B. "27.5")
    }

    return parseFloat(cleaned);
  }

  // ────────────────────────── JSON EXPORT ──────────────────────────────

  /**
   * Exportiert die gesamte Datenbank als JSON-String (1-Klick Komplett-Backup).
   */
  static async exportFullDatabaseJson(db: GymTrackerDB): Promise<string> {
    const data: BackupData = {
      version: 1,
      exported_at: new Date().toISOString(),
      tables: {
        gym_profiles: await db.gym_profiles.toArray(),
        muscles: await db.muscles.toArray(),
        exercises: await db.exercises.toArray(),
        exercise_muscles: await db.exercise_muscles.toArray(),
        routine_templates: await db.routine_templates.toArray(),
        routine_exercises: await db.routine_exercises.toArray(),
        routine_set_templates: await db.routine_set_templates.toArray(),
        workouts: await db.workouts.toArray(),
        workout_exercises: await db.workout_exercises.toArray(),
        workout_sets: await db.workout_sets.toArray(),
        body_measurements: await db.body_measurements.toArray(),
      },
    };
    return JSON.stringify(data, null, 2);
  }

  // ────────────────────────── JSON IMPORT ──────────────────────────────

  /**
   * Importiert ein zuvor exportiertes JSON-Backup.
   * Löscht die bestehenden Daten und ersetzt sie vollständig.
   */
  static async importFullDatabaseJson(
    db: GymTrackerDB,
    jsonString: string
  ): Promise<ImportResult> {

    let data: BackupData;
    try {
      data = JSON.parse(jsonString) as BackupData;
    } catch {
      return { success: false, message: 'Ungültiges JSON-Format.', counts: {} };
    }

    if (!data.tables) {
      return { success: false, message: 'Backup enthält keine Tabellendaten.', counts: {} };
    }

    if (typeof data.version !== 'number') {
      return { success: false, message: 'Backup-Version fehlt oder ungültig.', counts: {} };
    }

    const counts: Record<string, number> = {};

    await db.transaction(
      'rw',
      [
        db.gym_profiles,
        db.muscles,
        db.exercises,
        db.exercise_muscles,
        db.routine_templates,
        db.routine_exercises,
        db.routine_set_templates,
        db.workouts,
        db.workout_exercises,
        db.workout_sets,
        db.body_measurements,
      ],
      async () => {
        // Alle Tabellen leeren
        await db.gym_profiles.clear();
        await db.muscles.clear();
        await db.exercises.clear();
        await db.exercise_muscles.clear();
        await db.routine_templates.clear();
        await db.routine_exercises.clear();
        await db.routine_set_templates.clear();
        await db.workouts.clear();
        await db.workout_exercises.clear();
        await db.workout_sets.clear();
        await db.body_measurements.clear();

        // Daten importieren
        const tables = data.tables;
        if (tables.gym_profiles && tables.gym_profiles.length > 0) {
          await db.gym_profiles.bulkPut(tables.gym_profiles as any);
          counts.gym_profiles = tables.gym_profiles.length;
        } else {
          counts.gym_profiles = 0;
        }

        if (tables.muscles && tables.muscles.length > 0) {
          await db.muscles.bulkPut(tables.muscles as any);
          counts.muscles = tables.muscles.length;
        } else {
          counts.muscles = 0;
        }

        if (tables.exercises && tables.exercises.length > 0) {
          await db.exercises.bulkPut(tables.exercises as any);
          counts.exercises = tables.exercises.length;
        } else {
          counts.exercises = 0;
        }

        if (tables.exercise_muscles && tables.exercise_muscles.length > 0) {
          await db.exercise_muscles.bulkPut(tables.exercise_muscles as any);
          counts.exercise_muscles = tables.exercise_muscles.length;
        } else {
          counts.exercise_muscles = 0;
        }

        if (tables.routine_templates && tables.routine_templates.length > 0) {
          await db.routine_templates.bulkPut(tables.routine_templates as any);
          counts.routine_templates = tables.routine_templates.length;
        } else {
          counts.routine_templates = 0;
        }

        if (tables.routine_exercises && tables.routine_exercises.length > 0) {
          await db.routine_exercises.bulkPut(tables.routine_exercises as any);
          counts.routine_exercises = tables.routine_exercises.length;
        } else {
          counts.routine_exercises = 0;
        }

        if (tables.routine_set_templates && tables.routine_set_templates.length > 0) {
          await db.routine_set_templates.bulkPut(tables.routine_set_templates as any);
          counts.routine_set_templates = tables.routine_set_templates.length;
        } else {
          counts.routine_set_templates = 0;
        }

        if (tables.workouts && tables.workouts.length > 0) {
          await db.workouts.bulkPut(tables.workouts as any);
          counts.workouts = tables.workouts.length;
        } else {
          counts.workouts = 0;
        }

        if (tables.workout_exercises && tables.workout_exercises.length > 0) {
          await db.workout_exercises.bulkPut(tables.workout_exercises as any);
          counts.workout_exercises = tables.workout_exercises.length;
        } else {
          counts.workout_exercises = 0;
        }

        if (tables.workout_sets && tables.workout_sets.length > 0) {
          await db.workout_sets.bulkPut(tables.workout_sets as any);
          counts.workout_sets = tables.workout_sets.length;
        } else {
          counts.workout_sets = 0;
        }

        if (tables.body_measurements && tables.body_measurements.length > 0) {
          await db.body_measurements.bulkPut(tables.body_measurements as any);
          counts.body_measurements = tables.body_measurements.length;
        } else {
          counts.body_measurements = 0;
        }
      }
    );

    return {
      success: true,
      message: `Backup erfolgreich importiert (${Object.values(counts).reduce((a, b) => a + b, 0)} Einträge).`,
      counts,
    };
  }

  // ──────────────────────────── CSV IMPORT ─────────────────────────────

  /**
   * Automatischer CSV-Importer für bestehende Trainingsdaten
   * aus Strong, Hevy, FitNotes und ähnlichen Apps (inkl. deutscher Spaltennamen).
   *
   * Erstellt fehlende Übungen als `weight_reps` / `machine_stack` und importiert
   * Workouts + Sets. Gibt Warnungen für nicht zuordenbare Zeilen aus.
   */
  static async importFromCsv(
    db: GymTrackerDB,
    csvText: string,
    gymProfileId: string
  ): Promise<CsvImportResult> {
    const warnings: string[] = [];

    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      return {
        success: false,
        message: 'CSV enthält keine Datenzeilen.',
        exercisesCreated: 0,
        workoutsCreated: 0,
        setsImported: 0,
        warnings,
      };
    }

    // Header parsen
    const headerLine = lines[0];
    const delimiter = headerLine.includes(';') ? ';' : ',';
    const headers = this.parseCsvLine(headerLine, delimiter).map((h) => h.toLowerCase().trim());

    const dateIndex = headers.findIndex((h) => DATE_HEADERS.includes(h));
    const exerciseIndex = headers.findIndex((h) => EXERCISE_HEADERS.includes(h));
    const weightIndex = headers.findIndex((h) => WEIGHT_HEADERS.includes(h));
    const repsIndex = headers.findIndex((h) => REPS_HEADERS.includes(h));
    const setIndex = headers.findIndex((h) => SET_HEADERS.includes(h));
    const notesIndex = headers.findIndex((h) => NOTES_HEADERS.includes(h));

    if (dateIndex === -1 || exerciseIndex === -1) {
      return {
        success: false,
        message: `CSV-Header unvollständig. Benötigt mindestens Spalten für Datum und Übungsname. Gefundene Header: [${headers.join(', ')}]`,
        exercisesCreated: 0,
        workoutsCreated: 0,
        setsImported: 0,
        warnings,
      };
    }

    // Datenzeilen parsen und gruppieren
    interface CsvRow {
      date: string;
      exerciseName: string;
      weight: number;
      reps: number;
      setOrder: number;
      notes: string;
    }

    const rows: CsvRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = this.parseCsvLine(lines[i], delimiter);
      const dateRaw = cols[dateIndex]?.trim() || '';
      const exerciseName = cols[exerciseIndex]?.trim() || '';
      if (!dateRaw || !exerciseName) {
        warnings.push(`Zeile ${i + 1}: Datum oder Übungsname fehlt, übersprungen.`);
        continue;
      }

      // Datum normalisieren (verschiedene Formate unterstützen)
      const normalizedDate = this.normalizeDate(dateRaw);
      if (!normalizedDate) {
        warnings.push(`Zeile ${i + 1}: Datum '${dateRaw}' nicht erkannt, übersprungen.`);
        continue;
      }

      rows.push({
        date: normalizedDate,
        exerciseName,
        weight: weightIndex >= 0 ? this.parseLocalizedNumber(cols[weightIndex] || '0') || 0 : 0,
        reps: repsIndex >= 0 ? Math.round(this.parseLocalizedNumber(cols[repsIndex] || '0') || 0) : 0,
        setOrder: setIndex >= 0 ? Math.round(this.parseLocalizedNumber(cols[setIndex] || '1') || 1) : 1,
        notes: notesIndex >= 0 ? (cols[notesIndex]?.trim() || '') : '',
      });
    }

    if (rows.length === 0) {
      return {
        success: false,
        message: 'Keine gültigen Datenzeilen gefunden.',
        exercisesCreated: 0,
        workoutsCreated: 0,
        setsImported: 0,
        warnings,
      };
    }

    // 1. Übungs-Lookup / Auto-Create
    const existingExercises = await db.exercises.toArray();
    const exerciseByName = new Map(existingExercises.map((e) => [e.name.toLowerCase(), e]));
    let exercisesCreated = 0;

    const uniqueExNames = [...new Set(rows.map((r) => r.exerciseName))];
    for (const name of uniqueExNames) {
      if (!exerciseByName.has(name.toLowerCase())) {
        const now = currentISO();
        const newEx = {
          id: generateUUID(),
          name,
          tracking_type: 'weight_reps' as const,
          equipment_type: 'machine_stack' as const,
          movement_type: 'compound' as const,
          laterality: 'bilateral' as const,
          pulley_ratio: 1.0,
          default_bar_or_sled_weight_kg: 0,
          bodyweight_factor: 0,
          pinned_setup_note: '',
          custom_rest_seconds: null,
          best_1rm: null,
          best_10rm: null,
          max_volume_set: null,
          created_at: now,
          updated_at: now,
        };
        await db.exercises.add(newEx);
        exerciseByName.set(name.toLowerCase(), newEx);
        exercisesCreated++;
      }
    }

    // 2. Gruppierung nach Datum (= 1 Workout pro Tag)
    const workoutsByDate = new Map<string, CsvRow[]>();
    for (const row of rows) {
      if (!workoutsByDate.has(row.date)) {
        workoutsByDate.set(row.date, []);
      }
      workoutsByDate.get(row.date)!.push(row);
    }

    let workoutsCreated = 0;
    let setsImported = 0;

    for (const [date, dayRows] of workoutsByDate) {
      const now = currentISO();
      const startedAt = `${date}T10:00:00.000Z`;

      const workoutId = generateUUID();
      await db.workouts.add({
        id: workoutId,
        routine_id: null,
        gym_profile_id: gymProfileId,
        title: `Import ${date}`,
        top_note: dayRows[0].notes || '',
        started_at: startedAt,
        finished_at: startedAt,
        is_deload_session: false,
        created_at: now,
        updated_at: now,
      });
      workoutsCreated++;

      // Gruppiere innerhalb eines Tages nach Übungsname (Reihenfolge des Auftretens)
      const exercisesInOrder: string[] = [];
      for (const r of dayRows) {
        if (!exercisesInOrder.includes(r.exerciseName)) {
          exercisesInOrder.push(r.exerciseName);
        }
      }

      for (let orderIdx = 0; orderIdx < exercisesInOrder.length; orderIdx++) {
        const exName = exercisesInOrder[orderIdx];
        const exercise = exerciseByName.get(exName.toLowerCase());
        if (!exercise) continue;

        const weId = generateUUID();
        await db.workout_exercises.add({
          id: weId,
          workout_id: workoutId,
          exercise_id: exercise.id,
          order_index: orderIdx,
          superset_group_id: null,
          session_note: '',
          pause_progression: false,
          created_at: now,
          updated_at: now,
        });

        const exRows = dayRows.filter((r) => r.exerciseName === exName);
        for (let setIdx = 0; setIdx < exRows.length; setIdx++) {
          const row = exRows[setIdx];
          await db.workout_sets.add({
            id: generateUUID(),
            workout_exercise_id: weId,
            set_number: setIdx + 1,
            side: 'both',
            set_type: 'working',
            target_weight_snapshot: null,
            target_reps_min_snapshot: null,
            target_reps_max_snapshot: null,
            target_rir_snapshot: null,
            actual_weight: row.weight,
            effective_weight_kg: row.weight, // keine Pulley-Info aus CSV
            actual_reps: row.reps,
            actual_rir: null,
            used_micro_addon: false,
            is_completed: true,
            completed_at: startedAt,
            pr_flags: [],
            created_at: now,
            updated_at: now,
          });
          setsImported++;
        }
      }
    }

    return {
      success: true,
      message: `Import abgeschlossen: ${workoutsCreated} Workouts, ${setsImported} Sätze, ${exercisesCreated} neue Übungen.`,
      exercisesCreated,
      workoutsCreated,
      setsImported,
      warnings,
    };
  }

  // ──────────────────────────── HELPERS ─────────────────────────────────

  /**
   * Parst eine CSV-Zeile und berücksichtigt doppelte Anführungszeichen mit Komma-Inhalt.
   */
  static parseCsvLine(line: string, delimiter?: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    const sep = delimiter || (line.includes(';') ? ';' : ',');

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === sep && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  /**
   * Normalisiert verschiedene Datumsformate nach YYYY-MM-DD.
   */
  static normalizeDate(input: string): string | null {
    const trimmed = input.trim();

    // ISO-Format (2026-10-24 oder 2026-10-24T10:00:00)
    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
    }

    // Deutsches Format (24.10.2026 oder 24.10.26)
    const deMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
    if (deMatch) {
      let year = deMatch[3];
      if (year.length === 2) {
        year = (parseInt(year) > 50 ? '19' : '20') + year;
      }
      return `${year}-${deMatch[2].padStart(2, '0')}-${deMatch[1].padStart(2, '0')}`;
    }

    // US-Format (10/24/2026)
    const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (usMatch) {
      let year = usMatch[3];
      if (year.length === 2) {
        year = (parseInt(year) > 50 ? '19' : '20') + year;
      }
      return `${year}-${usMatch[1].padStart(2, '0')}-${usMatch[2].padStart(2, '0')}`;
    }

    return null;
  }
}
