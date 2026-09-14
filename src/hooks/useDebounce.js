/**
 * useDebounce.js — Hook generico per debounce di valori React
 *
 * Ritarda l'aggiornamento del valore fino a che non passa `delay` ms
 * dall'ultima modifica. Usato per:
 * - Ricerca amici (Friends.jsx) — evita fetch ad ogni carattere
 * - Input AI Assistant (AiStudyAssistant.jsx) — evita render inutili
 *
 * @param {any} value — valore da debounce
 * @param {number} delay — ms da attendere (default: 350ms)
 * @returns {any} — valore debounced
 */

import { useState, useEffect } from 'react';

export function useDebounce(value, delay = 350) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;
