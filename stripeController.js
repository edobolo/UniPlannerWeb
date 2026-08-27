const Stripe = require('stripe');
const express = require('express');
const fs = require('fs');

const stripe = Stripe('sk_test_51U6YE4GgjWDI5KlvsbOmjnesk5lSmUfy7u9VA6XU5OBMHoND6EIvKEwq3OuEkTQ7ZDkKzbBBxiSmVniKC3rDUyQw003rZpkry6');
const NTFY_CHANNEL = process.env.NTFY_CHANNEL || 'uniplanner-edo-alerts-2026';

// 📡 Helper per inviare notifiche Push su ntfy.sh (100% compatibile ASCII Header)
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
    console.log(`📡 Notifica inviata su ntfy.sh/${NTFY_CHANNEL}: ${cleanTitle}`);
  } catch (err) {
    console.error('Errore invio notifica ntfy:', err);
  }
}

function setupStripeRoutes(app, dbFilePath) {

  function readDb() {
    try {
      if (!fs.existsSync(dbFilePath)) return { students: {}, connections: {}, bugReports: [] };
      const raw = fs.readFileSync(dbFilePath, 'utf8');
      const data = JSON.parse(raw || '{"students":{}, "connections":{}, "bugReports":[]}');
      if (!data.students) data.students = {};
      return data;
    } catch(e) {
      console.error('[DB Read Error]:', e);
      return { students: {}, connections: {}, bugReports: [] };
    }
  }

  function writeDb(db) {
    try {
      fs.writeFileSync(dbFilePath, JSON.stringify(db, null, 2));
    } catch(e) {
      console.error('[DB Write Error]:', e);
    }
  }

  function findStudent(db, friendCode) {
    if (!db.students) return null;
    const cleanCode = (friendCode || '').trim().toUpperCase();
    if (db.students[cleanCode]) return db.students[cleanCode];
    return Object.values(db.students).find(s => (s.friendCode || '').trim().toUpperCase() === cleanCode);
  }

  // 1. Crea sessione di checkout
  app.post('/api/stripe/create-checkout-session', express.json(), async (req, res) => {
    try {
      const { friendCode, priceId } = req.body || {};
      if (!friendCode || !priceId) {
        return res.status(400).json({ error: 'friendCode e priceId obbligatori' });
      }

      const mode = (priceId === 'price_1U9Aj2Gfd5kpnWkPU7bgOY6o' || priceId === 'price_1U6Z9AGgjWDI5KlvFxLCbUT5') ? 'payment' : 'subscription';

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: mode,
        success_url: 'https://uniplanner-web-app.vercel.app/?unlock=pro',
        cancel_url: 'https://uniplanner-web-app.vercel.app/',
        client_reference_id: friendCode,
        metadata: { friendCode: friendCode }
      });

      console.log(`[Stripe Checkout] Generata sessione per ${friendCode}: ${session.id}`);
      res.json({ url: session.url });
    } catch (error) {
      console.error('[Stripe Checkout Error]:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 2. Portale Clienti per Gestione Abbonamento
  app.post('/api/stripe/create-portal-session', express.json(), async (req, res) => {
    try {
      const { friendCode } = req.body || {};
      if (!friendCode) {
        return res.status(400).json({ error: 'friendCode obbligatorio' });
      }

      const db = readDb();
      const student = findStudent(db, friendCode);

      if (!student || !student.stripeCustomerId) {
        return res.status(404).json({ error: 'Nessun abbonamento attivo trovato per questo account.' });
      }

      const portalSession = await stripe.billingPortal.sessions.create({
        customer: student.stripeCustomerId,
        return_url: 'https://uniplanner-web-app.vercel.app/'
      });

      res.json({ url: portalSession.url });
    } catch (error) {
      console.error('[Stripe Portal Error]:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // 3. Webhook universale con Notifiche ntfy.sh
  app.post('/api/stripe/webhook', express.json({ type: '*/*' }), async (req, res) => {
    const event = req.body;

    if (!event || !event.type) {
      return res.status(400).send('Invalid event structure');
    }

    console.log(`[Webhook Event Received]: ${event.type}`);

    // Evento 1: Pagamento completato -> Attiva PRO + Notifica Push
    if (event.type === 'checkout.session.completed') {
      const session = event.data?.object || {};
      const rawFriendCode = session.metadata?.friendCode || session.client_reference_id;
      const friendCode = rawFriendCode || 'UTENTE_TEST';
      const customerId = session.customer;
      const amountTotal = (session.amount_total ? (session.amount_total / 100).toFixed(2) : '0.00') + ' €';

      const cleanCode = friendCode.trim().toUpperCase();
      const db = readDb();
      const student = findStudent(db, cleanCode);
      const studentName = student ? (student.fullName || student.username) : 'Studente UniPlanner';

      if (student) {
        student.isPremium = true;
        if (customerId) student.stripeCustomerId = customerId;
        writeDb(db);
        console.log(`✅ [DB UPDATE] Studente ${cleanCode} aggiornato a PRO! (Customer: ${customerId})`);
      } else if (rawFriendCode) {
        db.students[cleanCode] = {
          friendCode: cleanCode,
          username: cleanCode.toLowerCase(),
          fullName: 'Studente PRO',
          isPremium: true,
          stripeCustomerId: customerId || null,
          createdAt: new Date().toISOString()
        };
        writeDb(db);
        console.log(`✅ [DB CREATE] Nuovo studente PRO registrato: ${cleanCode}`);
      }

      // 🔔 Invia Notifica Push Istantanea
      await sendNtfyAlert(
        'Nuovo Abbonamento UniPlanner PRO!',
        `💰 Incasso registrato con successo!\n\n👤 Studente: ${studentName}\n🏷️ Codice: ${cleanCode}\n💶 Importo: ${amountTotal}\n⏰ Data: ${new Date().toLocaleString('it-IT')}`,
        'tada,moneybag,crown',
        'urgent'
      );
    }

    // Evento 2: Abbonamento cancellato -> Revoca PRO + Notifica Push
    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data?.object || {};
      const customerId = sub.customer;

      let studentName = 'Studente';
      let studentCode = 'PRO';

      if (customerId) {
        const db = readDb();
        const student = Object.values(db.students || {}).find(s => s.stripeCustomerId === customerId);
        if (student) {
          student.isPremium = false;
          studentName = student.fullName || student.username;
          studentCode = student.friendCode;
          writeDb(db);
          console.log(`⚠️ [DB UPDATE] PRO revocato per ${student.friendCode}`);
        }
      }

      // 🔔 Invia Notifica Push di Disdetta
      await sendNtfyAlert(
        'Abbonamento PRO Annullato',
        `Un utente ha cancellato il proprio piano.\n\n👤 Studente: ${studentName}\n🏷️ Codice: ${studentCode}\nLo stato PRO è stato revocato automaticamente.`,
        'warning,skull',
        'default'
      );
    }

    res.json({ received: true });
  });
}

module.exports = setupStripeRoutes;
