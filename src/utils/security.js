import DOMPurify from 'dompurify';

/**
 * Security & Data Sanitization Utilities
 * Protects UniPlanner against XSS, Injection, and Tampering attacks.
 */

// Salt used in combination with SHA-256 for local credential hashing
const AUTH_SALT = 'uniplanner_secure_salt_v1_';

/**
 * Sanitize plain string input to prevent stored/reflected XSS attacks
 */
export function sanitizeText(input, maxLength = 255) {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim().slice(0, maxLength);
  return DOMPurify.sanitize(trimmed, {
    ALLOWED_TAGS: [], // Disallow all HTML tags in pure text fields
    ALLOWED_ATTR: []
  });
}

/**
 * Validate email format securely
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim()) && email.length <= 100;
}

/**
 * Validate username (alphanumeric, underscores, hyphens, length 3-20)
 */
export function validateUsername(username) {
  if (!username || typeof username !== 'string') return false;
  const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  return usernameRegex.test(username.trim());
}

/**
 * Validate password strength (minimum 6 chars)
 */
export function validatePassword(password) {
  return typeof password === 'string' && password.length >= 6;
}

/**
 * Cryptographic SHA-256 password hashing using native browser Web Crypto API
 */
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(AUTH_SALT + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a cryptographically strong unique Friend Code (e.g. UP-8K3X9)
 */
export function generateFriendCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const array = new Uint8Array(5);
  crypto.getRandomValues(array);
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += chars[array[i] % chars.length];
  }
  return `UP-${code}`;
}

/**
 * Safe JSON parse with error catching to prevent crashes from tampered localStorage
 */
export function safeJsonParse(jsonString, fallback = null) {
  if (!jsonString) return fallback;
  try {
    return JSON.parse(jsonString);
  } catch (err) {
    console.error('SafeJsonParse error:', err);
    return fallback;
  }
}
