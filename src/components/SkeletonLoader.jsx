/**
 * SkeletonLoader.jsx — Componenti skeleton animati per UniPlanner
 *
 * Mostra placeholder animati durante il caricamento dati, evitando
 * schermate bianche/vuote. Migliora la UX percepita (Perceived Performance).
 */

import React from 'react';
import './SkeletonLoader.css';

/**
 * Blocco skeleton generico: rettangolo animato
 */
export const SkeletonBlock = ({ width = '100%', height = '16px', borderRadius = '8px', style = {} }) => (
  <div
    className="skeleton-block"
    style={{ width, height, borderRadius, ...style }}
    aria-hidden="true"
  />
);

/**
 * Skeleton per card amico nella lista Friends
 */
export const FriendCardSkeleton = () => (
  <div className="skeleton-friend-card" aria-hidden="true">
    <div className="skeleton-avatar" />
    <div className="skeleton-friend-info">
      <SkeletonBlock width="60%" height="14px" />
      <SkeletonBlock width="40%" height="11px" style={{ marginTop: '6px' }} />
    </div>
  </div>
);

/**
 * Lista di skeleton per la schermata Amici
 */
export const FriendsListSkeleton = ({ count = 4 }) => (
  <div className="skeleton-friends-list" aria-label="Caricamento amici...">
    {Array.from({ length: count }, (_, i) => (
      <FriendCardSkeleton key={i} />
    ))}
  </div>
);

/**
 * Skeleton per il pannello dettaglio amico (destra)
 */
export const FriendDetailSkeleton = () => (
  <div className="skeleton-friend-detail" aria-label="Caricamento profilo...">
    <div className="skeleton-detail-header">
      <div className="skeleton-avatar-lg" />
      <div className="skeleton-detail-meta">
        <SkeletonBlock width="55%" height="18px" />
        <SkeletonBlock width="35%" height="12px" style={{ marginTop: '8px' }} />
        <SkeletonBlock width="45%" height="11px" style={{ marginTop: '6px' }} />
      </div>
    </div>
    <div className="skeleton-detail-rows">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="skeleton-detail-row">
          <SkeletonBlock width="30%" height="13px" />
          <SkeletonBlock width="50%" height="13px" />
        </div>
      ))}
    </div>
  </div>
);

/**
 * Skeleton per card esame
 */
export const ExamCardSkeleton = () => (
  <div className="skeleton-exam-card" aria-hidden="true">
    <SkeletonBlock width="70%" height="15px" />
    <SkeletonBlock width="40%" height="11px" style={{ marginTop: '10px' }} />
    <div className="skeleton-exam-bottom">
      <SkeletonBlock width="25%" height="22px" borderRadius="6px" />
      <SkeletonBlock width="20%" height="22px" borderRadius="6px" />
    </div>
  </div>
);

/**
 * Spinner overlay leggero (per operazioni brevi come refresh singolo profilo)
 */
export const MiniSpinner = ({ size = 18, color = 'var(--accent)' }) => (
  <svg
    className="mini-spinner"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    style={{ '--spinner-color': color }}
  >
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
      strokeDasharray="31.4" strokeDashoffset="10" />
  </svg>
);

export default { SkeletonBlock, FriendCardSkeleton, FriendsListSkeleton, FriendDetailSkeleton, ExamCardSkeleton, MiniSpinner };
