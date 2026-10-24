import type { EquipmentType, TrackingType } from '../models/types.ts';

export interface CalculateEffectiveWeightParams {
  equipmentType: EquipmentType;
  trackingType: TrackingType;
  actualWeight: number | null | undefined;
  usedMicroAddon?: boolean;
  stackMicroAddonKg?: number;
  pulleyRatio?: number;
  defaultBarOrSledWeightKg?: number;
  userBodyweightKg?: number | null;
  bodyweightFactor?: number;
}

/**
 * Berechnet das tatsächliche effektive Lastgewicht unter Berücksichtigung von:
 * - Flaschenzug-Übersetzungen (pulley_ratio, z.B. 0.5 bei gym80 Kabelturm)
 * - gym80 2.5kg Micro-Addon Zusatzgewicht
 * - Plate-Loaded Schlitten- oder Stangengewichten (z.B. 50kg gym80 45° Beinpresse)
 * - Körpergewichtsanteilen bei Bodyweight / Assisted Bodyweight
 */
export function calculateEffectiveWeight(params: CalculateEffectiveWeightParams): number | null {
  const {
    equipmentType,
    trackingType,
    actualWeight,
    usedMicroAddon = false,
    stackMicroAddonKg = 2.5,
    pulleyRatio = 1.0,
    defaultBarOrSledWeightKg = 0,
    userBodyweightKg = 0,
    bodyweightFactor = 0,
  } = params;

  if (trackingType === 'bodyweight_reps') {
    const bwComponent = (userBodyweightKg ?? 0) * (bodyweightFactor || 1.0);
    const addedWeight = actualWeight ?? 0;
    return Number((bwComponent + addedWeight).toFixed(2));
  }

  if (trackingType === 'assisted_bodyweight') {
    const bwComponent = (userBodyweightKg ?? 0) * (bodyweightFactor || 1.0);
    const assistedWeight = actualWeight ?? 0;
    return Number(Math.max(0, bwComponent - assistedWeight).toFixed(2));
  }

  if (actualWeight === null || actualWeight === undefined) {
    return null;
  }

  const addon = usedMicroAddon ? stackMicroAddonKg : 0;

  switch (equipmentType) {
    case 'cable_stack': {
      const ratio = pulleyRatio > 0 ? pulleyRatio : 1.0;
      return Number(((actualWeight + addon) * ratio).toFixed(2));
    }

    case 'machine_stack': {
      const ratio = pulleyRatio > 0 ? pulleyRatio : 1.0;
      return Number(((actualWeight + addon) * ratio).toFixed(2));
    }

    case 'plate_loaded': {
      return Number((actualWeight + (defaultBarOrSledWeightKg || 0)).toFixed(2));
    }

    case 'barbell': {
      // Wenn der Nutzer bei Langhantel nur Scheiben einträgt oder Gesamtgewicht:
      // Bei Angabe eines Barbell-Eigengewichts und separatem Scheibengewicht:
      return Number((actualWeight + (defaultBarOrSledWeightKg || 0)).toFixed(2));
    }

    case 'dumbbell':
    case 'bodyweight':
    default:
      return Number(actualWeight.toFixed(2));
  }
}
