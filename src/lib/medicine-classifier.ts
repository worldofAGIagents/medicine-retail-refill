/**
 * Dynamic Medicine Category Classifier
 * Automatically identifies chronic disease categories from brand names, generics, and salt compositions.
 * Defaults to 'Blood Pressure' (BP) whenever unclassified, ambiguous, or deselected.
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

/**
 * Dynamically detects the category of a medicine from its name, generic name, and salt composition.
 * If deselected, unknown, or general, automatically defaults to 'Blood Pressure'.
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

  // 4. Blood Pressure / Hypertension (Highest retail frequency in rural/semi-urban Bihar)
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

  // Default to Blood Pressure for any unclassified chronic medicine or deselected category
  return DEFAULT_CHRONIC_CATEGORY;
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
