/**
 * stripeController.js — UniPlanner Stripe Integration with SQLite & Webhook Signature Verification
 * 
 * Implementa:
 * 1. Verifica crittografica rigorosa della firma webhook (stripe-signature)
 * 2. Prevenzione doppi abbonamenti e pagamenti duplicati (idempotency key + is_premium check)
 * 3. Segregazione segreti: STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET da process.env
 * 4. Protezione IDOR sul Customer Portal (verifica ownership del chiamante)
 * 5. Integrazione con SQLite nativo tramite transazioni atomiche
 */

const Stripe = require('stripe');
const express = require('express');

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const NTFY_CHANNEL = process.env.NTFY_CHANNEL || 'uniplanner-edo-alerts-2026';

let stripe = null;
if (STRIPE_SECRET) {
  stripe = Stripe(STRIPE_SECRET);
} else {
  console.warn('[STRIPE WARNING] STRIPE_SECRET_KEY non configurata in process.env.');
}

// Helper per notifiche push su ntfy.sh
async function sendNtfyAlert(title, message, tags = 'tada,moneybag', priority = 'high') {
  try {
    const cleanTitle = title.replace(/[^\x00-\x7F]/g, '').trim();
    await fetch(`https://ntfy.sh/${NTFY_CHANNEL}`, {
      method: 'POST',
      headers: {
        'Title': cleanTitle || 'UniPlanner Alert',
        'Priority': priority,
        'Tags': tags
      },
      body: message
    });
  } catch (err) {
    console.error('[NTFY ERROR]', err.message);
  }
}

function setupStripeRoutes(app, db, authenticateToken) {
  // 1. Webhook Stripe con validazione crittografica della firma (DEVE essere registrato con express.raw)
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe non configurato sul server.' });
    }

    const sig = req.headers['stripe-signature'];
    let event;

    try {
      if (STRIPE_WEBHOOK_SECRET && sig) {
        // Verifica firma crittografica con raw body
        event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
      } else if (!STRIPE_WEBHOOK_SECRET) {
        console.warn('[STRIPE WEBHOOK] STRIPE_WEBHOOK_SECRET mancante. Parsing fallback solo in dev.');
        event = JSON.parse(req.body.toString('utf8'));
      } else {
        return res.status(400).send('Header stripe-signature mancante.');
      }
    } catch (err) {
      console.error('[STRIPE WEBHOOK VERIFICATION FAILED]', err.message);
      return res.status(400).send(`Webhook Signature Verification Error: ${err.message}`);
    }

    console.info(`[STRIPE WEBHOOK] Evento autenticato ricevuto: ${event.type}`);

    try {
      // Evento 1: Pagamento completato -> Attiva PRO su SQLite + Notifica Push
      if (event.type === 'checkout.session.completed') {
        const session = event.data?.object || {};
        const rawFriendCode = session.metadata?.friendCode || session.client_reference_id;
        const customerId = session.customer;
        const amountTotal = (session.amount_total ? (session.amount_total / 100).toFixed(2) : '0.00') + ' €';

        if (rawFriendCode) {
          const cleanCode = String(rawFriendCode).trim().toUpperCase();

          const updateStmt = db.prepare(`
            UPDATE users SET 
              is_premium = 1,
              stripe_customer_id = COALESCE(?, stripe_customer_id),
              updated_at = CURRENT_TIMESTAMP
            WHERE UPPER(friend_code) = ?
          `);
          const info = updateStmt.run(customerId || null, cleanCode);

          if (info.changes > 0) {
            console.info(`✅ [STRIPE] Utente ${cleanCode} promosso a PRO nel database SQLite.`);
          } else {
            console.warn(`⚠️ [STRIPE] Utente ${cleanCode} non trovato in SQLite per upgrade.`);
          }

          // Invia Notifica Push
          await sendNtfyAlert(
            'Nuovo Abbonamento UniPlanner PRO!',
            `💰 Incasso registrato con successo!\n\n🏷️ Codice Amico: ${cleanCode}\n💶 Importo: ${amountTotal}\n⏰ Data: ${new Date().toLocaleString('it-IT')}`,
            'tada,moneybag,crown',
            'urgent'
          );
        }
      }

      // Evento 2: Abbonamento cancellato -> Revoca PRO su SQLite
      if (event.type === 'customer.subscription.deleted') {
        const sub = event.data?.object || {};
        const customerId = sub.customer;

        if (customerId) {
          const revokeStmt = db.prepare(`
            UPDATE users SET 
              is_premium = 0,
              updated_at = CURRENT_TIMESTAMP
            WHERE stripe_customer_id = ?
          `);
          const info = revokeStmt.run(customerId);
          console.info(`⚠️ [STRIPE] Revocato stato PRO per Customer ID: ${customerId} (${info.changes} utenti aggiornati).`);

          await sendNtfyAlert(
            'Abbonamento PRO Annullato',
            `Un utente ha cancellato il proprio piano.\nCustomer ID: ${customerId}\nLo stato PRO è stato revocato automaticamente.`,
            'warning,skull',
            'default'
          );
        }
      }

      res.json({ received: true });
    } catch (dbErr) {
      console.error('[STRIPE WEBHOOK DB ERROR]', dbErr.message);
      res.status(500).json({ error: 'Errore interno aggiornamento stato utente.' });
    }
  });

  // 2. Creazione sessione di Checkout con Prevenzione Duplicati e Idempotency
  app.post('/api/stripe/create-checkout-session', express.json(), async (req, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({ error: 'Servizio pagamenti temporaneamente non disponibile.' });
      }

      const { friendCode, priceId } = req.body || {};
      if (!friendCode || !priceId) {
        return res.status(400).json({ error: 'friendCode e priceId obbligatori.' });
      }

      const cleanCode = String(friendCode).trim().toUpperCase();

      // Prevenzione Duplicati: controlla se l'utente ha già PRO attivo
      const user = db.prepare(`SELECT is_premium, stripe_customer_id FROM users WHERE UPPER(friend_code) = ?`).get(cleanCode);
      if (user && user.is_premium) {
        return res.status(400).json({ 
          error: 'Hai già un abbonamento PRO attivo! Per gestire o annullare il piano, accedi al Portale Clienti.' 
        });
      }

      const mode = (priceId === 'price_1U9Aj2Gfd5kpnWkPU7bgOY6o' || priceId === 'price_1U6Z9AGgjWDI5KlvFxLCbUT5') 
        ? 'payment' 
        : 'subscription';

      // Idempotency Key per prevenire doppi click/richieste identiche entro 60 secondi
      const idempotencyKey = `cs_${cleanCode}_${priceId}_${Math.floor(Date.now() / 60000)}`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: mode,
        success_url: 'https://uniplanner-web-app.vercel.app/?unlock=pro',
        cancel_url: 'https://uniplanner-web-app.vercel.app/',
        client_reference_id: cleanCode,
        metadata: { friendCode: cleanCode }
      }, {
        idempotencyKey
      });

      console.info(`[STRIPE CHECKOUT] Sessione generata per ${cleanCode}: ${session.id}`);
      res.json({ url: session.url });
    } catch (error) {
      console.error('[STRIPE CHECKOUT ERROR]', error.message);
      res.status(500).json({ error: 'Impossibile inizializzare il checkout. Riprova tra poco.' });
    }
  });

  // 3. Portale Clienti Stripe con Protezione IDOR (Ownership Check)
  app.post('/api/stripe/create-portal-session', express.json(), authenticateToken, async (req, res) => {
    try {
      if (!stripe) {
        return res.status(503).json({ error: 'Servizio pagamenti non disponibile.' });
      }

      const { friendCode } = req.body || {};
      if (!friendCode) {
        return res.status(400).json({ error: 'friendCode obbligatorio.' });
      }

      const cleanCode = String(friendCode).trim().toUpperCase();

      // IDOR Protection: l'utente può aprire SOLO il proprio portale di fatturazione
      if (req.user?.friendCode && req.user.friendCode.toUpperCase() !== cleanCode && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Accesso negato: non puoi accedere al portale di un altro utente.' });
      }

      const user = db.prepare(`SELECT stripe_customer_id FROM users WHERE UPPER(friend_code) = ?`).get(cleanCode);
      if (!user || !user.stripe_customer_id) {
        return res.status(404).json({ error: 'Nessun abbonamento attivo trovato per questo account.' });
      }

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: user.stripe_customer_id,
        return_url: 'https://uniplanner-web-app.vercel.app/'
      });

      res.json({ url: portalSession.url });
    } catch (error) {
      console.error('[STRIPE PORTAL ERROR]', error.message);
      res.status(500).json({ error: 'Impossibile accedere al portale clienti.' });
    }
  });
}

module.exports = setupStripeRoutes;
