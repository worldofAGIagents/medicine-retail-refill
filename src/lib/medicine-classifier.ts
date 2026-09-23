/**
 * Dynamic Medicine Category & Form-Factor Classifier
 * Automatically identifies chronic disease categories and clinical dosage form-factors
 * from brand names, generics, salt compositions, and packaging types.
 */

export const DEFAULT_CHRONIC_CATEGORY = 'Blood Pressure';

export const CHRONIC_CONDITIONS_LIST = [
  { id: 'Blood Pressure', label: 'Blood Pressure (BP)', shortLabel: 'BP', color: 'bg-red-50 text-red-700 border-red-200' },
  { id: 'Diabetes', label: 'Diabetes', shortLabel: 'Diabetes', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'Thyroid', label: 'Thyroid', shortLabel: 'Thyroid', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { id: 'Heart', label: 'Cardiac / Heart', shortLabel: 'Heart', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { id: 'Infant Milk', label: 'Infant Formula / Baby Milk', shortLabel: 'Infant Milk', color: 'bg-pink-50 text-pink-700 border-pink-200' },
  { id: 'Cholesterol', label: 'Cholesterol', shortLabel: 'Cholesterol', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { id: 'Respiratory', label: 'Asthma / Respiratory', shortLabel: 'Respiratory', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  { id: 'Gastric', label: 'Gastric / GI', shortLabel: 'Gastric', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
];

export type MedicineFormFactor =
  | 'tablet'
  | 'syrup'
  | 'insulin'
  | 'inhaler'
  | 'drops'
  | 'infant_milk';

export interface FormFactorConfig {
  id: MedicineFormFactor;
  label: string;
  shortLabel: string;
  unitLabel: string; // e.g., 'tab/day', 'ml/day', 'IU/day', 'puffs/day'
  unitName: string; // e.g., 'tablets', 'ml', 'units', 'puffs'
  defaultDosage: number;
  dosagePresets: number[];
  defaultBufferDays: number;
  packagingUnitLabel: string; // 'tabs/strip', 'ml/bottle', 'IU/vial', 'puffs/device'
  color: string;
  iconName: string;
}

export const FORM_FACTORS: Record<MedicineFormFactor, FormFactorConfig> = {
  tablet: {
    id: 'tablet',
    label: 'Tablets / Capsules',
    shortLabel: 'Tablet',
    unitLabel: 'tab/day',
    unitName: 'tablets',
    defaultDosage: 1,
    dosagePresets: [0.5, 1, 2, 3],
    defaultBufferDays: 3,
    packagingUnitLabel: 'tabs/strip',
    color: 'bg-teal-50 text-teal-700 border-teal-200',
    iconName: 'Pill',
  },
  insulin: {
    id: 'insulin',
    label: 'Insulin (Injectable)',
    shortLabel: 'Insulin',
    unitLabel: 'IU/day',
    unitName: 'units',
    defaultDosage: 20,
    dosagePresets: [10, 15, 20, 25, 30, 40, 50],
    defaultBufferDays: 4,
    packagingUnitLabel: 'IU / pack',
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    iconName: 'Syringe',
  },
  syrup: {
    id: 'syrup',
    label: 'Syrup / Suspension',
    shortLabel: 'Syrup',
    unitLabel: 'ml/day',
    unitName: 'ml',
    defaultDosage: 10,
    dosagePresets: [5, 10, 15, 20, 30],
    defaultBufferDays: 2,
    packagingUnitLabel: 'ml / bottle',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    iconName: 'FlaskConical',
  },
  inhaler: {
    id: 'inhaler',
    label: 'Inhaler / Respules',
    shortLabel: 'Inhaler',
    unitLabel: 'puffs/day',
    unitName: 'puffs',
    defaultDosage: 2,
    dosagePresets: [1, 2, 4, 6],
    defaultBufferDays: 4,
    packagingUnitLabel: 'puffs / device',
    color: 'bg-sky-50 text-sky-700 border-sky-200',
    iconName: 'Wind',
  },
  drops: {
    id: 'drops',
    label: 'Eye / Ear Drops',
    shortLabel: 'Drops',
    unitLabel: 'drops/day',
    unitName: 'drops',
    defaultDosage: 4,
    dosagePresets: [2, 4, 6, 8],
    defaultBufferDays: 2,
    packagingUnitLabel: 'ml / bottle',
    color: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    iconName: 'Droplet',
  },
  infant_milk: {
    id: 'infant_milk',
    label: 'Infant Formula / Milk',
    shortLabel: 'Baby Milk',
    unitLabel: 'g/day',
    unitName: 'grams',
    defaultDosage: 40,
    dosagePresets: [30, 40, 50, 60],
    defaultBufferDays: 2,
    packagingUnitLabel: 'g / tin',
    color: 'bg-pink-50 text-pink-700 border-pink-200',
    iconName: 'Baby',
  },
};

/**
 * Dynamically detects the chronic clinical category.
 */
export function detectMedicineCategory(
  name?: string | null,
  genericName?: string | null,
  saltComposition?: string | null
): string {
  const text = `${name || ''} ${genericName || ''} ${saltComposition || ''}`.toLowerCase().trim();
  if (!text) return DEFAULT_CHRONIC_CATEGORY;

  // 1. Infant Milk / Baby Formula
  if (/nan\s*pro|lactogen|similac|aptamil|dexolac|infant\s*milk|infant\s*formula|pediasure|nestogen|farex|cerelac|enfamil|isomil/i.test(text)) {
    return 'Infant Milk';
  }

  // 2. Thyroid
  if (/thyronorm|eltroxin|thyroxine|levothyroxine|thyrocab|neo-mercazole|carbimazole|propylthiouracil/i.test(text)) {
    return 'Thyroid';
  }

  // 3. Diabetes
  if (/metformin|glycomet|glimepiride|gliclazide|januvia|galvus|dapagliflozin|empagliflozin|vildagliptin|sitagliptin|pioglitazone|teneligliptin|insulin|rybelsus|trajenta|forxiga|jardiance|amaryl|glybovin|voglibose|glipizide|linagliptin|semaglutide/i.test(text)) {
    return 'Diabetes';
  }

  // 4. Blood Pressure / Hypertension
  if (/amlodipine|amlo|telmisartan|telma|telsartan|losartan|losar|olmesartan|olmetime|ramipril|cardace|enalapril|atenolol|aten|metoprolol|betaloc|metolar|bisoprolol|concor|cilnidipine|cilacar|nebivolol|nebicip|torsemide|dytor|lasix|furosemide|chlorthalidone|arkamin|clonidine|nifedipine|nicardia|diltiazem|verapamil|\bbp\b|hypertension|hypertens/i.test(text)) {
    return 'Blood Pressure';
  }

  // 5. Cholesterol / Dyslipidemia
  if (/atorvastatin|atorva|atorlip|rosuvastatin|rosuvas|rozavel|fenofibrate|lipaglyn|ezetimibe|statin/i.test(text)) {
    return 'Cholesterol';
  }

  // 6. Heart / Cardiac
  if (/clopidogrel|clopilet|ecosprin|aspirin|sorbitrate|monotrate|isosorbide|digoxin|nicorandil|korandil|ranolazine|ivabradine|cardiac|heart/i.test(text)) {
    return 'Heart';
  }

  // 7. Respiratory / Asthma
  if (/foracort|budecort|asthalin|seroflo|montair|montelukast|levolin|deriphyllin|tiova|budesonide|salbutamol|formoterol|inhaler|respiratory|rotacap/i.test(text)) {
    return 'Respiratory';
  }

  // 8. Gastric / Acid Reflux / GI
  if (/pantocid|pan-40|pan-d|pantoprazole|omez|omeprazole|rabeprazole|rabekind|rabicer|sucrafil|gelusil|digene|rantac|aciloc|ranitidine|famotidine|esomeprazole|nexpro/i.test(text)) {
    return 'Gastric';
  }

  return DEFAULT_CHRONIC_CATEGORY;
}

/**
 * Automatically detects the clinical form factor (Insulin, Syrup, Tablet, Inhaler, Drops, Infant Milk)
 * from the medicine name, packaging type, and unit type.
 */
export function detectMedicineFormFactor(medicine?: {
  name?: string | null;
  genericName?: string | null;
  category?: string | null;
  packagingType?: string | null;
  unitType?: string | null;
  customPackaging?: string | null;
} | null): MedicineFormFactor {
  if (!medicine) return 'tablet';

  const name = (medicine.name || '').trim().toLowerCase();
  const generic = (medicine.genericName || '').trim().toLowerCase();
  const category = (medicine.category || '').trim().toLowerCase();
  const packaging = (medicine.packagingType || '').trim().toLowerCase();
  const unit = (medicine.unitType || '').trim().toLowerCase();
  const custom = (medicine.customPackaging || '').trim().toLowerCase();
  const allText = `${name} ${generic} ${category} ${packaging} ${unit} ${custom}`.toLowerCase();

  // 1. Infant Milk Formula
  if (
    category === 'infant milk' ||
    packaging === 'tin' ||
    unit === 'grams' ||
    unit === 'tin' ||
    /nan\s*pro|lactogen|similac|aptamil|dexolac|infant\s*milk|infant\s*formula|pediasure|nestogen|farex|cerelac|enfamil/i.test(allText)
  ) {
    return 'infant_milk';
  }

  // 2. Insulin & Injectables (High priority clinical detection)
  if (
    unit === 'iu' ||
    unit === 'units' ||
    /insulin|lantus|humalog|novorapid|novomix|mixtard|apidra|tresiba|ryzodeg|toujeo|actrapid|insulatard|huminsulin|basalog|penfill|cartridge|100iu|40iu/i.test(allText)
  ) {
    return 'insulin';
  }

  // 3. Inhalers & Respules
  if (
    unit === 'puffs' ||
    unit === 'respules' ||
    /inhaler|mdi|rotacap|respule|inhalation|foracort|budecort|asthalin|seroflo|aerocort|tiova/i.test(allText)
  ) {
    return 'inhaler';
  }

  // 4. Eye / Ear / Nasal Drops
  if (
    unit === 'drops' ||
    /\b(eye\s+drop|ear\s+drop|nasal\s+drop|pediatric\s+drop|drops?|otobiotic|moxicip|ciplox)\b/i.test(allText)
  ) {
    // If it's a pediatric drop or eye drop, return 'drops'
    if (/eye|ear|nasal|pediatric\s+drop|otobiotic|moxicip/i.test(allText) || unit === 'drops') {
      return 'drops';
    }
  }

  // 5. Syrups, Suspensions & Liquids
  const syrupKeyword = /\b(syp|syrup|syrups|susp|suspension|suspensions|elixir|elixirs|solutions?|liquid|liquids|linctus|tonic|tonics|cough\s+formula|(oral|mouth)\s+(gel|paint)s?)\b/i;
  const tabletKeyword = /\b(tab|tabs|tablet|tablets|cap|caps|capsule|capsules)\b/i;

  // Explicit tablets in bottles (like Thyronorm, Acitrom) must stay as 'tablet'
  if (tabletKeyword.test(name) && !syrupKeyword.test(name)) {
    return 'tablet';
  }

  if (
    syrupKeyword.test(name) ||
    syrupKeyword.test(generic) ||
    category === 'syrup' ||
    category === 'suspension' ||
    unit === 'ml' ||
    packaging === 'bottle' ||
    /\b\d+\s*ml\b/i.test(name)
  ) {
    return 'syrup';
  }

  // 6. Default: Tablets & Capsules
  return 'tablet';
}

/**
 * Extracts default pack size, unit count, and packaging text from medicine data.
 */
export function parsePackDetails(medicine: {
  name: string;
  packagingType?: string | null;
  unitsPerPack?: number | null;
  category?: string | null;
}): {
  formFactor: MedicineFormFactor;
  unitsPerPack: number;
  defaultQty: number;
  defaultPackagingText: string;
  defaultDosage: number;
  unitLabel: string;
  bufferDays: number;
} {
  const form = detectMedicineFormFactor(medicine);
  const name = medicine.name.toUpperCase();
  const dbUnits = Number(medicine.unitsPerPack) || 0;

  switch (form) {
    case 'insulin': {
      // Check for 10ML VIAL (1000 IU) vs 3ML CARTRIDGE/PEN (300 IU)
      let totalUnits = 1000;
      let label = '1 Vial (10ml / 1000 IU)';
      if (/3ML|CARTRIDGE|PENFILL|SOLOSTAR|PEN/i.test(name)) {
        totalUnits = 300;
        label = '1 Pen / Cartridge (3ml / 300 IU)';
      }
      return {
        formFactor: 'insulin',
        unitsPerPack: totalUnits,
        defaultQty: totalUnits,
        defaultPackagingText: label,
        defaultDosage: 20, // 20 units/day default
        unitLabel: 'IU/day',
        bufferDays: 4,
      };
    }

    case 'syrup': {
      // Extract bottle size in ML if present in name (e.g., '100ML', '200ML', '60ML')
      const mlMatch = name.match(/(\d+)\s*ML/i);
      const volumeMl = mlMatch ? parseInt(mlMatch[1], 10) : (dbUnits > 1 ? dbUnits : 100);
      return {
        formFactor: 'syrup',
        unitsPerPack: volumeMl,
        defaultQty: volumeMl,
        defaultPackagingText: `1 Bottle (${volumeMl}ml)`,
        defaultDosage: 10, // 10 ml/day default
        unitLabel: 'ml/day',
        bufferDays: 2,
      };
    }

    case 'inhaler': {
      const puffs = 200; // Standard MDI
      return {
        formFactor: 'inhaler',
        unitsPerPack: puffs,
        defaultQty: puffs,
        defaultPackagingText: `1 Inhaler (${puffs} puffs)`,
        defaultDosage: 2, // 2 puffs/day
        unitLabel: 'puffs/day',
        bufferDays: 4,
      };
    }

    case 'drops': {
      const mlMatch = name.match(/(\d+)\s*ML/i);
      const volumeMl = mlMatch ? parseInt(mlMatch[1], 10) : (dbUnits > 1 ? dbUnits : 10);
      return {
        formFactor: 'drops',
        unitsPerPack: volumeMl,
        defaultQty: volumeMl,
        defaultPackagingText: `1 Bottle (${volumeMl}ml)`,
        defaultDosage: 4, // 4 drops/day
        unitLabel: 'drops/day',
        bufferDays: 2,
      };
    }

    case 'infant_milk': {
      const grams = dbUnits > 1 ? dbUnits : 400;
      return {
        formFactor: 'infant_milk',
        unitsPerPack: grams,
        defaultQty: grams,
        defaultPackagingText: `${grams}g Tin`,
        defaultDosage: 40, // 40g/day
        unitLabel: 'g/day',
        bufferDays: 2,
      };
    }

    case 'tablet':
    default: {
      const packSize = dbUnits > 0 ? dbUnits : 10;
      const isBottle = /bottle|1x\d{2,}/i.test(medicine.packagingType || '') || /1x120|1x60|1x30|1x100/i.test(name);
      return {
        formFactor: 'tablet',
        unitsPerPack: packSize,
        defaultQty: isBottle ? packSize : packSize * 2, // 2 strips or 1 bottle
        defaultPackagingText: isBottle ? `1 Bottle (${packSize} tabs)` : `${packSize} tabs/strip`,
        defaultDosage: 1, // 1 tab/day
        unitLabel: 'tab/day',
        bufferDays: 3,
      };
    }
  }
}

/**
 * Normalizes a category string. If empty, deselected, or 'General', returns 'Blood Pressure'.
 */
export function normalizeChronicCategory(category?: string | null): string {
  if (!category || category.trim() === '' || category.toLowerCase() === 'general' || category.toLowerCase() === 'none') {
    return DEFAULT_CHRONIC_CATEGORY;
  }
  const match = CHRONIC_CONDITIONS_LIST.find(
    (c) => c.id.toLowerCase() === category.toLowerCase() || c.shortLabel.toLowerCase() === category.toLowerCase()
  );
  return match ? match.id : DEFAULT_CHRONIC_CATEGORY;
}
