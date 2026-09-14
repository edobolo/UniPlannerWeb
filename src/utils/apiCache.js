/**
 * apiCache.js — UniPlanner In-Memory API Cache
 *
 * Cache con TTL (Time-To-Live) configurabile per le chiamate REST al backend
 * Raspberry Pi. Riduce la latenza percepita e limita il numero di richieste
 * verso Ngrok, che ha limiti di rate sul piano gratuito.
 *
 * Strategia: write-through cache
 * - GET: serve dalla cache se non scaduta, altrimenti fetch + aggiorna cache
 * - POST (mutazioni): invalida le chiavi correlate dopo la scrittura
 */

const _cache = new Map(); // key → { data, expiresAt }

/**
 * TTL predefiniti in millisecondi
 */
export const TTL = {
  USER_PROFILE:   5 * 60 * 1000,  // 5 minuti — profili amici
  FRIENDS_LIST:   2 * 60 * 1000,  // 2 minuti — lista amici reciproci
  SHORT:          30 * 1000,       // 30 secondi — dati live aggiornati
  LONG:           10 * 60 * 1000, // 10 minuti — dati statici
};

/**
 * Recupera un valore dalla cache.
 * @param {string} key
 * @returns {any|null} Il dato cachato oppure null se assente/scaduto
 */
export function cacheGet(key) {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _cache.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * Salva un valore in cache.
 * @param {string} key
 * @param {any} data
 * @param {number} ttl — durata in ms (usa le costanti TTL.* )
 */
export function cacheSet(key, data, ttl = TTL.USER_PROFILE) {
  _cache.set(key, { data, expiresAt: Date.now() + ttl });
}

/**
 * Invalida una specifica chiave (o tutte le chiavi che iniziano con un prefisso).
 * @param {string} keyOrPrefix
 * @param {boolean} [prefix=false] — se true, invalida tutte le chiavi con quel prefisso
 */
export function cacheInvalidate(keyOrPrefix, prefix = false) {
  if (prefix) {
    for (const k of _cache.keys()) {
      if (k.startsWith(keyOrPrefix)) _cache.delete(k);
    }
  } else {
    _cache.delete(keyOrPrefix);
  }
}

/**
 * Svuota completamente la cache (utile al logout).
 */
export function cacheClear() {
  _cache.clear();
}

/**
 * Wrapper per fetch con cache automatica.
 * Se la risposta è già in cache e non scaduta, restituisce i dati cachati
 * senza fare la richiesta di rete.
 *
 * @param {string} key — chiave univoca per questa richiesta
 * @param {() => Promise<any>} fetcher — funzione async che esegue il fetch reale
 * @param {number} ttl — TTL in ms
 * @returns {Promise<any>}
 */
export async function cachedFetch(key, fetcher, ttl = TTL.USER_PROFILE) {
  const cached = cacheGet(key);
  if (cached !== null) return cached;

  const data = await fetcher();
  if (data !== null && data !== undefined) {
    cacheSet(key, data, ttl);
  }
  return data;
}

/**
 * Chiave standardizzata per il profilo utente
 */
export const profileKey = (code) => `profile:${String(code).trim().toUpperCase()}`;

/**
 * Chiave standardizzata per la lista amici
 */
export const friendsListKey = (code) => `friends_list:${String(code).trim().toUpperCase()}`;
