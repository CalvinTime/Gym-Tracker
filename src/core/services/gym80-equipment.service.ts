import type { Exercise, GymProfile } from '../models/types.ts';

export interface PlateCount {
  plateKg: number;
  count: number;
}

export interface PlateCalculationResult {
  targetTotalWeightKg: number;
  barWeightKg: number;
  weightToLoadTotalKg: number;
  weightPerSideKg: number;
  platesPerSide: PlateCount[];
  matchedWeightPerSideKg: number;
  matchedTotalWeightKg: number;
  remainingWeightKg: number;
  isExactMatch: boolean;
}

/**
 * Service für die gerätespezifische McFit- & gym80-Physik,
 * Reallast-Berechnungen, Hantelscheiben-Kombinatorik und Steckgewichts-Schritte.
 */
export class Gym80EquipmentService {
  /**
   * Berechnet die reale physikalische Last aus dem vom Nutzer im McFit
   * abgelesenen bzw. gesteckten Gewicht (enteredWeightKg).
   *
   * Praxis-Prinzip:
   * - Bei cable_stack oder machine_stack:
   *   effective_weight_kg = enteredWeightKg * exercise.pulley_ratio
   *   (z.B. am gym80 Kabelturm mit 1:2 Flaschenzug: 40 kg Pin = 20 kg Reallast).
   * - Bei bodyweight_reps (Dips/Klimmzüge):
   *   (bodyweightKg * exercise.bodyweight_factor) + enteredWeightKg
   * - Bei assisted_bodyweight (Klimmzug-/Dip-Maschine mit Gegengewicht):
   *   Math.max(0, (bodyweightKg * exercise.bodyweight_factor) - enteredWeightKg)
   * - Bei allen anderen Typen (barbell, dumbbell, plate_loaded):
   *   enteredWeightKg
   */
  static calculateEffectiveLoad(
    enteredWeightKg: number,
    exercise: Exercise,
    bodyweightKg: number = 0
  ): number {
    if (exercise.tracking_type === 'bodyweight_reps') {
      const factor = exercise.bodyweight_factor || 1.0;
      return Number(((bodyweightKg * factor) + enteredWeightKg).toFixed(2));
    }

    if (exercise.tracking_type === 'assisted_bodyweight') {
      const factor = exercise.bodyweight_factor || 1.0;
      return Number(Math.max(0, (bodyweightKg * factor) - enteredWeightKg).toFixed(2));
    }

    if (exercise.equipment_type === 'cable_stack' || exercise.equipment_type === 'machine_stack') {
      const ratio = exercise.pulley_ratio > 0 ? exercise.pulley_ratio : 1.0;
      return Number((enteredWeightKg * ratio).toFixed(2));
    }

    return Number(enteredWeightKg.toFixed(2));
  }

  /**
   * Bestimmt das nächste im McFit real steckbare bzw. greifbare Gewicht.
   *
   * Regeln:
   * 1. Dumbbell:
   *    Greift auf gymProfile.dumbbell_list_kg zu (1-10 kg in 1er-Schritten, ab 10 kg in 2er-Schritten).
   *    Springt z.B. von 20 kg -> 22 kg (up) oder 22 kg -> 20 kg (down).
   *
   * 2. Cable Stack:
   *    - Bei pulley_ratio === 0.5 (1:2 Flaschenzug am verstellbaren Turm):
   *      Für Isolationsübungen (movement_type === 'isolation', z.B. Seitheben, Trizepsdrücken):
   *      2,5-kg-Schritte am Block (unter Nutzung des 2,5kg-Zusatzgewichts, z.B. 15 -> 17,5 -> 20 kg; real +1,25 kg).
   *      Für Verbundübungen (movement_type === 'compound'):
   *      5,0-kg-Schritte am Block (real +2,5 kg).
   *    - Bei pulley_ratio === 1.0 (Latzug, Rudern) oder machine_stack:
   *      2,5-kg-Schritte (mittels gym80 2,5-kg-Micro-Addon: z.B. 50 -> 52,5 -> 55 kg).
   *
   * 3. Barbell & Plate Loaded:
   *    Steigert in 2,5-kg-Schritten (2x 1,25 kg kleinste Scheiben bilateral).
   *
   * 4. Bodyweight (Zusatzgewicht):
   *    Steigert in 2,5-kg-Schritten (oder 1,25 kg bei Einzelscheibe am Gürtel).
   */
  static getNextAvailableWeight(
    currentEnteredWeightKg: number,
    exercise: Exercise,
    gymProfile: GymProfile,
    direction: 'up' | 'down'
  ): number {
    const EPSILON = 0.001;

    // 1. Kurzhanteln (Dumbbell)
    if (exercise.equipment_type === 'dumbbell') {
      const list = [...gymProfile.dumbbell_list_kg].sort((a, b) => a - b);
      if (list.length === 0) return currentEnteredWeightKg;

      if (direction === 'up') {
        const next = list.find((w) => w > currentEnteredWeightKg + EPSILON);
        return next !== undefined ? next : list[list.length - 1];
      } else {
        const smaller = list.filter((w) => w < currentEnteredWeightKg - EPSILON);
        return smaller.length > 0 ? smaller[smaller.length - 1] : list[0];
      }
    }

    // 2. Kabelzug (Cable Stack)
    if (exercise.equipment_type === 'cable_stack') {
      const isHalfPulley = Math.abs(exercise.pulley_ratio - 0.5) < EPSILON;
      let stepKg: number;

      if (isHalfPulley) {
        // Am 1:2 Flaschenzug:
        // Isolationsübungen nutzen das 2.5kg Micro-Addon (real +1.25kg)
        // Verbundübungen nutzen den 5.0kg Blocksprung (real +2.5kg)
        stepKg = exercise.movement_type === 'isolation'
          ? (gymProfile.stack_micro_addon_kg || 2.5)
          : (gymProfile.stack_increment_kg || 5.0);
      } else {
        // 1:1 Seilzug (z.B. Latzug / Rudern): 2.5kg Schritte dank Micro-Addon
        stepKg = gymProfile.stack_micro_addon_kg || 2.5;
      }

      return this.stepByAmount(currentEnteredWeightKg, stepKg, direction, stepKg);
    }

    // 3. Steckgewicht-Maschinen (Machine Stack)
    if (exercise.equipment_type === 'machine_stack') {
      const stepKg = gymProfile.stack_micro_addon_kg || 2.5;
      return this.stepByAmount(currentEnteredWeightKg, stepKg, direction, stepKg);
    }

    // 4. Langhantel (Barbell) & Plate-Loaded
    if (exercise.equipment_type === 'barbell' || exercise.equipment_type === 'plate_loaded') {
      // 2x 1.25 kg kleinste Scheiben bilateral = 2.5 kg Schritt
      const stepKg = 2.5;
      const minWeight = exercise.default_bar_or_sled_weight_kg || 0;
      return this.stepByAmount(currentEnteredWeightKg, stepKg, direction, minWeight);
    }

    // 5. Bodyweight mit Zusatzgewicht
    if (exercise.equipment_type === 'bodyweight') {
      const stepKg = 2.5;
      return this.stepByAmount(currentEnteredWeightKg, stepKg, direction, 0);
    }

    // Default Fallback
    return this.stepByAmount(currentEnteredWeightKg, 2.5, direction, 0);
  }

  /**
   * Berechnet für Langhanteln und gym80 Pure Kraft Maschinen exakt, welche Hantelscheiben
   * pro Seite aufgelegt werden müssen.
   *
   * Nutzt einen Greedy-Algorithmus mit absteigend sortierten verfügbaren Scheiben
   * (z.B. [20, 15, 10, 5, 2.5, 1.25] kg).
   */
  static calculatePlatesPerSide(
    targetTotalWeightKg: number,
    barWeightKg: number,
    availablePlatesKg: number[]
  ): PlateCalculationResult {
    const EPSILON = 0.0001;
    const sortedPlates = [...availablePlatesKg].sort((a, b) => b - a);

    if (targetTotalWeightKg <= barWeightKg) {
      return {
        targetTotalWeightKg,
        barWeightKg,
        weightToLoadTotalKg: 0,
        weightPerSideKg: 0,
        platesPerSide: [],
        matchedWeightPerSideKg: 0,
        matchedTotalWeightKg: barWeightKg,
        remainingWeightKg: 0,
        isExactMatch: true,
      };
    }

    const weightToLoadTotalKg = Number((targetTotalWeightKg - barWeightKg).toFixed(2));
    const weightPerSideKg = Number((weightToLoadTotalKg / 2).toFixed(2));

    let remainingPerSide = weightPerSideKg;
    const platesPerSide: PlateCount[] = [];

    for (const plate of sortedPlates) {
      if (plate <= 0) continue;
      const count = Math.floor((remainingPerSide + EPSILON) / plate);
      if (count > 0) {
        platesPerSide.push({ plateKg: plate, count });
        remainingPerSide = Number((remainingPerSide - count * plate).toFixed(4));
      }
    }

    const matchedWeightPerSideKg = Number(
      platesPerSide.reduce((sum, p) => sum + p.plateKg * p.count, 0).toFixed(2)
    );
    const matchedTotalWeightKg = Number((barWeightKg + matchedWeightPerSideKg * 2).toFixed(2));
    const remainingWeightKg = Number(Math.abs(targetTotalWeightKg - matchedTotalWeightKg).toFixed(2));
    const isExactMatch = remainingWeightKg < 0.01;

    return {
      targetTotalWeightKg,
      barWeightKg,
      weightToLoadTotalKg,
      weightPerSideKg,
      platesPerSide,
      matchedWeightPerSideKg,
      matchedTotalWeightKg,
      remainingWeightKg,
      isExactMatch,
    };
  }

  /**
   * Berechnet für Dropsätze ein um ca. 20-25% reduziertes Gewicht,
   * gerundet auf ein real im McFit existierendes Gewicht (bzw. 2 Platten am Block).
   */
  static calculateDropSetWeight(
    workingWeightKg: number,
    exercise: Exercise,
    gymProfile: GymProfile
  ): number {
    if (workingWeightKg <= 0) return 0;

    // Für Steckgewichts-Maschinen: 2 Platten (10 kg) bzw. ~20-25% tiefer
    if (exercise.equipment_type === 'machine_stack' || exercise.equipment_type === 'cable_stack') {
      const stackStep = gymProfile.stack_increment_kg || 5.0;
      // 2 Platten tiefer
      const twoPlatesDown = workingWeightKg - 2 * stackStep;
      if (twoPlatesDown >= stackStep) {
        return Number(twoPlatesDown.toFixed(2));
      }
      // Wenn das Ausgangsgewicht klein war (< 15 kg), 1 Platte bzw. Micro-Schritt tiefer
      const target25Pct = workingWeightKg * 0.75;
      return this.snapToValidWeight(target25Pct, exercise, gymProfile);
    }

    // Für Kurzhanteln und Freihanteln: ca. 20-25% Reduktion
    const targetDropRaw = workingWeightKg * 0.77; // ca. 23% Drop
    return this.snapToValidWeight(targetDropRaw, exercise, gymProfile);
  }

  /**
   * Rundet ein beliebiges Soll-Gewicht auf das nächste real im Studio verfügbare Gewicht.
   */
  static snapToValidWeight(
    rawWeightKg: number,
    exercise: Exercise,
    gymProfile: GymProfile
  ): number {
    if (rawWeightKg <= 0) return 0;

    if (exercise.equipment_type === 'dumbbell') {
      const list = [...gymProfile.dumbbell_list_kg].sort((a, b) => a - b);
      if (list.length === 0) return rawWeightKg;
      // Finde den nächstgelegenen Kurzhantelwert
      let closest = list[0];
      let minDiff = Math.abs(rawWeightKg - closest);
      for (const w of list) {
        const diff = Math.abs(rawWeightKg - w);
        if (diff < minDiff) {
          minDiff = diff;
          closest = w;
        }
      }
      return closest;
    }

    if (exercise.equipment_type === 'cable_stack' || exercise.equipment_type === 'machine_stack') {
      const micro = gymProfile.stack_micro_addon_kg || 2.5;
      const rounded = Math.round(rawWeightKg / micro) * micro;
      return Math.max(micro, Number(rounded.toFixed(2)));
    }

    if (exercise.equipment_type === 'barbell' || exercise.equipment_type === 'plate_loaded') {
      const minWeight = exercise.default_bar_or_sled_weight_kg || 0;
      const rounded = Math.round(rawWeightKg / 2.5) * 2.5;
      return Math.max(minWeight, Number(rounded.toFixed(2)));
    }

    const rounded = Math.round(rawWeightKg / 2.5) * 2.5;
    return Number(rounded.toFixed(2));
  }

  private static stepByAmount(
    current: number,
    step: number,
    direction: 'up' | 'down',
    minAllowed: number
  ): number {
    const EPSILON = 0.001;

    if (direction === 'up') {
      // Nächster echter Schritt nach oben
      const steps = Math.floor((current + EPSILON) / step) + 1;
      const next = steps * step;
      return Number(Math.max(minAllowed, next).toFixed(2));
    } else {
      // Nächster echter Schritt nach unten
      const steps = Math.ceil((current - EPSILON) / step) - 1;
      const next = steps * step;
      return Number(Math.max(minAllowed, next).toFixed(2));
    }
  }
}
