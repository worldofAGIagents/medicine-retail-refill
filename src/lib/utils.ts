/**
 * Shared utility functions for the pharmacy app.
 * Centralizes phone formatting, category normalization, and other helpers.
 */

/**
 * Formats a phone number for WhatsApp API links.
 * Strips any existing +91 or 91 prefix, then prepends 91.
 * Returns empty string if phone is invalid.
 */
export function formatWhatsAppPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  // Remove leading 91 country code if present (but only if number is > 10 digits)
  const cleaned = digits.length > 10 && digits.startsWith('91')
    ? digits.slice(2)
    : digits;
  // Must be exactly 10 digits for Indian numbers
  if (cleaned.length !== 10) return digits; // Return as-is if not standard Indian
  return '91' + cleaned;
}

/**
 * Generates a WhatsApp chat link with optional pre-filled message.
 */
export function whatsappLink(phone: string, message?: string): string {
  const formatted = formatWhatsAppPhone(phone);
  if (!formatted) return '#';
  const base = `https://wa.me/${formatted}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/**
 * Normalizes medicine category for consistent filtering.
 * Maps common aliases to canonical names.
 */
const CATEGORY_ALIASES: Record<string, string> = {
  'bp': 'Blood Pressure',
  'blood pressure': 'Blood Pressure',
  'hypertension': 'Blood Pressure',
  'dm': 'Diabetes',
  'diabetes': 'Diabetes',
  'sugar': 'Diabetes',
  'thyroid': 'Thyroid',
  'cholesterol': 'Cholesterol',
  'heart': 'Heart',
  'cardiac': 'Heart',
  'infant milk': 'Infant Milk',
  'baby milk': 'Infant Milk',
  'general': 'General',
};

export function normalizeCategory(category: string | null | undefined): string {
  if (!category) return 'General';
  const key = category.trim().toLowerCase();
  return CATEGORY_ALIASES[key] || category.trim();
}

/**
 * Checks if two categories match (case-insensitive, alias-aware).
 */
export function categoryMatches(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeCategory(a) === normalizeCategory(b);
}
