/**
 * Shared utility functions for the pharmacy app.
 * Centralizes phone formatting, category normalization, and other helpers.
 */

/**
 * Cleans and normalizes a phone number for WhatsApp API links.
 * Strips non-digits, handles leading zeros, and extracts a standard 10-digit Indian number.
 * Returns EXACTLY '91XXXXXXXXXX' (12 digits) if valid.
 * Returns an empty string if invalid.
 */
export function isDesktopDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return true;
  return !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
}

/**
 * Cleans and normalizes a phone number for WhatsApp API links.
 * Strips non-digits, handles leading zeros and +91 prefixes.
 * Returns EXACTLY '91XXXXXXXXXX' (12 digits) if valid.
 * Returns an empty string if fewer than 10 digits.
 */
export function cleanWhatsAppNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = String(phone).replace(/[^0-9]/g, '');
  if (digits.length === 0) return '';

  // If already exactly 91 followed by 10 digits (12 digits total)
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }

  // Strip leading zero(s)
  let stripped = digits;
  while (stripped.startsWith('0')) {
    stripped = stripped.slice(1);
  }

  if (stripped.length === 12 && stripped.startsWith('91')) {
    return stripped;
  }

  // If exactly 10 digits, prepend 91
  if (stripped.length === 10) {
    return '91' + stripped;
  }

  // If longer than 10 digits, grab the last 10 digits
  if (stripped.length > 10) {
    const last10 = stripped.slice(-10);
    return '91' + last10;
  }

  // If fewer than 10 digits, invalid phone
  return '';
}

/**
 * Formats a phone number for WhatsApp API links.
 * @deprecated Use cleanWhatsAppNumber instead.
 */
export function formatWhatsAppPhone(phone: string | null | undefined): string {
  return cleanWhatsAppNumber(phone);
}

/**
 * Generates a direct WhatsApp Web URL (best for Desktop Mac/Windows browsers).
 * Directly opens the chat with that phone number without intermediate landing pages.
 */
export function getWhatsAppWebUrl(phone: string | null | undefined, message?: string): string {
  const cleanPhone = cleanWhatsAppNumber(phone);
  const textParam = message ? `&text=${encodeURIComponent(message)}` : '';
  if (cleanPhone) {
    return `https://web.whatsapp.com/send?phone=${cleanPhone}${textParam}`;
  }
  return message ? `https://web.whatsapp.com/send?text=${encodeURIComponent(message)}` : 'https://web.whatsapp.com/';
}

/**
 * Generates a direct WhatsApp App URL (best for Mobile).
 */
export function getWhatsAppAppUrl(phone: string | null | undefined, message?: string): string {
  const cleanPhone = cleanWhatsAppNumber(phone);
  const encoded = message ? `?text=${encodeURIComponent(message)}` : '';
  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}${encoded}`;
  }
  return message ? `https://wa.me/?text=${encodeURIComponent(message)}` : 'https://wa.me/';
}

/**
 * Generates native protocol link for WhatsApp Desktop app (macOS / Windows).
 */
export function getWhatsAppNativeUrl(phone: string | null | undefined, message?: string): string {
  const cleanPhone = cleanWhatsAppNumber(phone);
  const textParam = message ? `&text=${encodeURIComponent(message)}` : '';
  if (cleanPhone) {
    return `whatsapp://send?phone=${cleanPhone}${textParam}`;
  }
  return message ? `whatsapp://send?text=${encodeURIComponent(message)}` : 'whatsapp://send';
}

/**
 * Generates a direct WhatsApp link that NEVER drops the phone number.
 * Defaults to WhatsApp Web on Desktop (Mac/PC) because wa.me drops the phone number on desktop redirects!
 * On Mobile, defaults to wa.me which opens the WhatsApp mobile app directly.
 */
export function buildWhatsAppUrl(
  phone: string | null | undefined,
  message?: string,
  preferWeb?: boolean
): string {
  const useWeb = preferWeb !== undefined ? preferWeb : isDesktopDevice();
  return useWeb ? getWhatsAppWebUrl(phone, message) : getWhatsAppAppUrl(phone, message);
}

/**
 * Robustly opens WhatsApp in a new tab without being blocked by popup blockers.
 * Automatically falls back to window.location.href if the popup is blocked.
 */
export function openWhatsAppDirect(
  phone: string | null | undefined,
  message: string,
  preferWeb?: boolean
): void {
  const useWeb = preferWeb !== undefined ? preferWeb : isDesktopDevice();
  const url = buildWhatsAppUrl(phone, message, useWeb);
  try {
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win || win.closed || typeof win.closed === 'undefined') {
      // Popup was blocked by browser — navigate directly
      window.location.href = url;
    }
  } catch (_) {
    window.location.href = url;
  }
}

/**
 * @deprecated Use buildWhatsAppUrl instead.
 */
export function whatsappLink(phone: string, message?: string): string {
  return buildWhatsAppUrl(phone, message);
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
