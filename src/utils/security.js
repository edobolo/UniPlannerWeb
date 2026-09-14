import DOMPurify from 'dompurify';

/**
 * security.js — Comprehensive Security & Data Sanitization Utilities
 * Protects UniPlanner against XSS, Prototype Pollution, Injection, and Tampering.
 */

// Salt used in combination with SHA-256 for local credential hashing
const AUTH_SALT = 'uniplanner_secure_salt_v1_';

/**
 * Sanitize plain string input to prevent stored/reflected XSS attacks.
 * Strips all HTML/script tags and trims excessive length.
 */
export function sanitizeText(input, maxLength = 255) {
  if (typeof input !== 'string') return '';
  const trimmed = input.trim().slice(0, maxLength);
  return DOMPurify.sanitize(trimmed, {
    ALLOWED_TAGS: [], // Disallow all HTML tags in pure text fields
    ALLOWED_ATTR: [],
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
  });
}

/**
 * Deep recursive object & array sanitization.
 * Traverses an object, cleans strings with DOMPurify, and strips dangerous
 * prototype pollution keys (__proto__, constructor, prototype).
 */
export function sanitizeObject(obj, maxDepth = 5) {
  if (obj === null || obj === undefined || maxDepth < 0) return obj;

  if (typeof obj === 'string') {
    return sanitizeText(obj, 10000);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, maxDepth - 1));
  }

  if (typeof obj === 'object') {
    const cleanObj = {};
    for (const [key, value] of Object.entries(obj)) {
      // Anti-Prototype Pollution: Drop dangerous keys
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue;
      }
      const cleanKey = sanitizeText(key, 50);
      cleanObj[cleanKey] = sanitizeObject(value, maxDepth - 1);
    }
    return cleanObj;
  }

  return obj;
}

/**
 * Anti-Prototype Pollution protection for external data (e.g. SheetJS / JSON payloads)
 */
export function cleanPrototypePollution(data) {
  if (!data || typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map(item => cleanPrototypePollution(item));
  }

  const sanitized = {};
  for (const prop of Object.keys(data)) {
    if (prop === '__proto__' || prop === 'constructor' || prop === 'prototype') {
      continue;
    }
    const val = data[prop];
    if (val !== null && typeof val === 'object') {
      sanitized[prop] = cleanPrototypePollution(val);
    } else {
      sanitized[prop] = val;
    }
  }
  return sanitized;
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
 * Validate friend code format (e.g. UP-XXXXX or alphanumeric 3-30 chars)
 */
export function isValidFriendCode(code) {
  if (!code || typeof code !== 'string') return false;
  const friendCodeRegex = /^(UP-)?[A-Z0-9]{3,20}$/i;
  return friendCodeRegex.test(code.trim());
}

/**
 * Validate password strength (minimum 6 chars, max 128 chars)
 */
export function validatePassword(password) {
  return typeof password === 'string' && password.length >= 6 && password.length <= 128;
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
 * Safe JSON parse with error catching and anti-prototype pollution
 */
export function safeJsonParse(jsonString, fallback = null) {
  if (!jsonString) return fallback;
  try {
    const parsed = JSON.parse(jsonString);
    return cleanPrototypePollution(parsed);
  } catch (err) {
    console.error('SafeJsonParse error:', err);
    return fallback;
  }
}

/**
 * Masks sensitive user fields (passwords, emails, tokens) before logging or printing
 */
export function maskSensitiveData(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const masked = { ...obj };
  const sensitiveKeys = ['password', 'passwordHash', 'token', 'secret', 'apiKey', 'stripeCustomerId', 'email'];

  for (const key of Object.keys(masked)) {
    if (sensitiveKeys.includes(key) && typeof masked[key] === 'string') {
      if (key === 'email') {
        const [user, domain] = masked[key].split('@');
        masked[key] = `${user ? user.slice(0, 2) : ''}***@${domain || '***'}`;
      } else {
        masked[key] = '***REDACTED***';
      }
    } else if (typeof masked[key] === 'object' && masked[key] !== null) {
      masked[key] = maskSensitiveData(masked[key]);
    }
  }
  return masked;
}
