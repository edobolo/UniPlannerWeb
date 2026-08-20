import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Crown, Rocket, CheckCircle2, X, Loader2 } from 'lucide-react';
import { BACKEND_URL } from '../utils/cloudSync';
import './ProUpgradeModal.css';

export default function ProUpgradeModal({ isOpen, onClose, friendCode }) {
  const [loadingPriceId, setLoadingPriceId] = useState(null);
  const [error, setError] = useState('');

  // Questi verranno sostituiti con i veri price_...
  const plans = [
    {
      id: 'price_1U6ZCCGgjWDI5KlvrFZykyxQ',
      name: 'Mensile',
      icon: <Sparkles className="plan-icon" />,
      price: '1,99 €',
      period: '/ mese',
      desc: 'Flessibilità totale',
      color: '#38bdf8'
    },
    {
      id: 'price_1U6Z9rGgjWDI5KlvAhilRbOy',
      name: 'Annuale',
      icon: <Crown className="plan-icon" />,
      price: '9,99 €',
      period: '/ anno',
      desc: 'Risparmi il 58%',
      color: '#f59e0b',
      badge: 'PIÙ SCELTO'
    },
    {
      id: 'price_1U6Z9AGgjWDI5KlvFxLCbUT5',
      name: "Founder's Edition",
      icon: <Rocket className="plan-icon" />,
      price: '19,99 €',
      period: 'una tantum',
      desc: 'Accesso a vita',
      color: '#ec4899',
      badge: 'BEST VALUE'
    }
  ];

  const handleCheckout = async (priceId) => {
    setLoadingPriceId(priceId);
    setError('');

    try {
      const codeToSend = friendCode || localStorage.getItem('uniplanner_friend_code') || 'OSPITE_' + Math.random().toString(36).substring(2, 7).toUpperCase();

      const res = await fetch(`${BACKEND_URL}/stripe/create-checkout-session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({ friendCode: codeToSend, priceId })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Errore nella creazione del checkout');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
      setLoadingPriceId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="modal-overlay">
        <motion.div 
          className="pro-modal-content"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
        >
          <button className="pro-close-btn" onClick={onClose}>
            <X size={20} />
          </button>

          <div className="pro-header">
            <div className="pro-badge-top">
              <Crown size={16} />
              <span>UniPlanner PRO</span>
            </div>
            <h2>Sblocca il tuo potenziale accademico.</h2>
            <p>Accedi al Simulatore Avanzato, statistiche illimitate e funzioni esclusive per massimizzare la tua media.</p>
          </div>

          {error && (
            <div className="pro-error-banner">
              {error}
            </div>
          )}

          <div className="pro-plans-grid">
            {plans.map((plan) => (
              <div 
                key={plan.id} 
                className="pro-plan-card"
                style={{ '--plan-color': plan.color }}
              >
                {plan.badge && (
                  <div className="plan-badge" style={{ backgroundColor: plan.color }}>
                    {plan.badge}
                  </div>
                )}
                
                <div className="plan-header">
                  <div className="plan-icon-wrapper" style={{ color: plan.color, backgroundColor: `${plan.color}15` }}>
                    {plan.icon}
                  </div>
                  <h3>{plan.name}</h3>
                </div>

                <div className="plan-price">
                  <span className="price-amount">{plan.price}</span>
                  <span className="price-period">{plan.period}</span>
                </div>
                
                <p className="plan-desc">{plan.desc}</p>

                <ul className="plan-features">
                  <li><CheckCircle2 size={16} /> Simulatore Laurea 100%</li>
                  <li><CheckCircle2 size={16} /> Calcolo Scarto CFU</li>
                  <li><CheckCircle2 size={16} /> Statistiche Illimitate</li>
                  {plan.id.includes('tantum') && <li><CheckCircle2 size={16} /> Supporto Prioritario</li>}
                </ul>

                <button 
                  className="plan-cta-btn"
                  style={{ backgroundColor: plan.color }}
                  onClick={() => handleCheckout(plan.id)}
                  disabled={loadingPriceId !== null}
                >
                  {loadingPriceId === plan.id ? <Loader2 className="spin" size={18} /> : 'Scegli Piano'}
                </button>
              </div>
            ))}
          </div>

          <div className="pro-footer">
            <p>Pagamento sicuro gestito da <strong>Stripe</strong>. Cancella in qualsiasi momento.</p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
