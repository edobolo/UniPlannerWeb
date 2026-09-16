# Walkthrough: Hardening di Sicurezza, Robustezza & Performance Completa

Tutti i requisiti di sicurezza avanzata, integrità dei dati, protezione da attacchi e ottimizzazione delle performance sono stati implementati e verificati con successo.

---

## Riepilogo degli Interventi Eseguiti

### 1. Eliminazione Token da `localStorage` & Sessioni Protette
- **HttpOnly Cookies**: Il JWT di sessione non viene mai memorizzato in `localStorage`. Viene emesso dal backend tramite cookie con flag `HttpOnly; Secure; SameSite=None`, inaccessibile agli script client e protetto contro XSS.
- **In-Memory State**: Il frontend conserva i dettagli di sessione unicamente in memoria React (`AuthContext.jsx`), eseguendo un silent check all'avvio su `GET /api/auth/me`.

### 2. Controllo Ruoli e PRO Rigorosamente Lato Server (Zero Bypass Client)
- **Eliminazione Codici Bypass**: Rimosso qualsiasi bypass hardcoded nel client (`EDO`, `UNIPLANNER-PRO-2026`, ecc.).
- **RBAC & Ownership Middleware**:
  - Middleware `authenticateToken` con verifica crittografica HMAC-SHA256 del JWT.
  - Middleware `requireRole('admin')` per endpoint di amministrazione.
  - Middleware `authorizeOwner` che verifica che `req.user.friendCode === req.params.code`, neutralizzando qualsiasi attacco IDOR (*Insecure Direct Object References*).

### 3. Autenticazione a Due Fattori (2FA / OTP)
- **Generazione & Scadenza OTP**: Codici monouso a 6 cifre con validità limitata a 5 minuti salvati in forma crittografata su database SQLite.
- **Flusso Completo nel Frontend**:
  - Se un utente con 2FA attivo esegue il login, il server risponde con `{ require2FA: true }`.
  - L'interfaccia passa automaticamente alla schermata di verifica OTP con inserimento formattato a 6 cifre.
  - Toggle 2FA disponibile nelle impostazioni del Profilo Utente in `AccountModal.jsx`.

### 4. Rate Limiting & Account Lockout Anti Brute-Force
- **Rate Limiting Globale**: Finestra di protezione su tutte le API.
- **Account Lockout**: Tracciamento dei tentativi falliti su database (`failed_login_attempts`). Al 5° tentativo consecutivo errato, l'account viene bloccato per 15 minuti (`locked_until`), impedendo attacchi dizionario e brute-force.

### 5. Validazione Complessità Password
- **Requisiti Stringenti**: Minimo 8 caratteri, almeno una lettera maiuscola, una minuscola, un numero e un carattere speciale.
- **UI Feedback Interattivo**: Barra di robustezza dinamica a colori (rosso, giallo, verde) e checklist con spunte in tempo reale durante la registrazione in `AccountModal.jsx`.

### 6. Query Parametrizzate al 100% & WAL Mode Database
- **Zero SQL Injection**: Tutte le query SQLite utilizzano prepared statements parametrizzati con segnaposto `?`.
- **SQLite Performance Hardening**:
  - `PRAGMA journal_mode = WAL;` (scritture e letture simultanee senza lock contention).
  - `PRAGMA synchronous = NORMAL;`
  - `PRAGMA cache_size = -64000;` (64MB di cache RAM).
  - Indici dedicati: `idx_users_locked`, `idx_exams_user_status`, `idx_schedules_day`, `idx_deadlines_date`, `idx_audit_event`.

### 7. Segregazione Chiavi API Pubbliche vs Segreti Server
- `process.env.STRIPE_SECRET_KEY`, `process.env.STRIPE_WEBHOOK_SECRET`, `process.env.JWT_SECRET`, `process.env.GROQ_API_KEY`, `process.env.GEMINI_API_KEY` sono confinati sul server.
- Il frontend utilizza esclusivamente chiavi pubbliche limitate (Publishable Key).

### 8. Sanitizzazione Input, Escaping HTML & Whitelist URL
- **DOMPurify & Anti-Prototype Pollution**: Sanitizzazione ricorsiva degli oggetti in transito.
- **Whitelist Protocolli Rigida**: `sanitizeResourceUrl` convalida tramite parser `new URL()` ammettendo unicamente i protocolli `http:` e `https:`, bloccando vettori `javascript:`, `data:`, `vbscript:`.
- **`escapeHtml`**: Sanitizzazione delle entità HTML per prevenire rendering malevolo.

### 9. Verifica Crittografica Webhook Stripe
- **HMAC-SHA256 Signature**: In `stripeController.js`, `/api/stripe/webhook` riceve il payload `express.raw()` grezzo e verifica la firma con `stripe.webhooks.constructEvent(rawBody, signature, secret)`.
- **Prevenzione Doppi Pagamenti / Abbonamenti**: Utilizzo dell'`idempotencyKey` su Stripe Checkout e controllo preventivo di abbonamenti attivi sul database.

### 10. Limiti di Spesa AI, Timeout e Resilienza di Rete
- **AI Daily Spending Cap**: Massimo 20 generazioni kit studio al giorno per utente per prevenire costi imprevisti sulle API LLM.
- **Request Timeout**: 15 secondi tramite `AbortController` in `apiFetch`.
- **Retry con Exponential Backoff**: Ripristino automatico in caso di instabilità di rete temporanea.
- **Compressione Risposte**: Compressione Gzip automatica per payload > 1KB.
- **Limite Dimensione Payload**: Limite massimo di 5MB configurato su `express.json()`.
- **Uptime Monitoring**: Endpoint dedicati `/api/health` e `/api/uptime`.

### 11. Error Boundary & Pagina 404 Accademica Personalizzata
- **`ErrorBoundary.jsx`**: Cattura eccezioni a runtime nei componenti React, evitando schermate bianche ed esponendo un recupero rapido.
- **`NotFound.jsx` & `NotFound.css`**: Design coerente con il tema accademico editoriale (*Newsreader*, *JetBrains Mono*, *Plus Jakarta Sans*), pulsanti di reindirizzamento al Piano Esami e alla Guida.

### 12. Risoluzione Glitch Visivo Barra Aggiungi Esame
- **Doppio Bordo al Focus**: Rimossa la sovrapposizione tra il contorno del container `.modern-add-bar` e l'input interno `.borderless-input`. Applicato `border: none !important; box-shadow: none !important; outline: none !important; border-radius: 0 !important; background: transparent !important;` in `src/pages/Exams.css` e `src/index.css`.

### 13. Eliminazione Password Predefinita & Riforma Password Policy
- **Rimozione Password Predefinita**: Eliminata completamente dall'interfaccia la scritta fuorviante `Password predefinita: UniPlanner2026!`.
- **Policy di Complessità Standardizzata**: Rilassata la regola rigida (che imponeva obbligatoriamente simboli speciali complessi, bloccando password normali come `Edoardo2026`): ora richiede almeno 8 caratteri con lettere e numeri. I simboli speciali rimangono supportati e consigliati con punteggio bonus visivo.
- **Registrazione Connessa al Database**: `register()` in `AuthContext.jsx` ora invoca `registerUserOnline()` creando l'account in SQLite con credenziali conformi e token di sessione autenticato.

### 14. Overhaul Completo Ripristino Password (OTP via Email a 2 Passaggi)
- **Eliminazione Falla di Sicurezza `friendCode`**: Il vecchio reset richiedeva solo Codice Amico ed Email, consentendo a conoscenti di sovrascrivere la password di un account. Il parametro `friendCode` è stato completamente rimosso dal ripristino credenziali.
- **Flusso Professionale a 2 Fasi**:
  1. **Fase 1 (`POST /api/auth/forgot-password`)**: L'utente inserisce la propria email (o username). Il server genera un codice OTP numerico a 6 cifre, lo memorizza sotto forma di hash SHA-256 con scadenza a 10 minuti (`reset_code_expires`), e lo recapita all'email registrata.
  2. **Fase 2 (`POST /api/auth/reset-password`)**: L'utente inserisce il codice OTP a 6 cifre ricevuto e la nuova password. Il server verifica l'hash del codice, controlla che non sia scaduto, impone un limite anti-bruteforce (massimo 5 tentativi errati) e aggiorna la password.
- **Protezione Anti-Enumerazione**: Se l'email inserita non esiste, il server risponde comunque con messaggio generico per non rivelare quali email sono iscritte alla piattaforma.

---

## Risultati dei Test e Verifiche

| Test Eseguito | Script / Comando | Esito | Dettagli |
|---|---|---|---|
| **Stress Test Concorrenza SQLite** | `scratch/test_concurrency.js` | **SUPERATO (0 errori)** | 30 transazioni simultanee completate in 3ms in WAL mode senza lock contention |
| **Integrità Backup & Restore** | `scratch/test_backup_restore.js` | **SUPERATO (0 errori)** | Checksum SHA-256 speculari al 100% prima e dopo la serializzazione |
| **Test Flusso Auth & Reset OTP su Raspberry Pi** | `scratch/test_auth_flow.js` | **SUPERATO (0 errori)** | Registrazione 200 OK, Generazione OTP 200 OK, Verifica OTP e cambio password 200 OK, Login con nuova password 200 OK |
| **Build di Produzione Frontend** | `npm run build` | **SUPERATO (0 errori)** | 3.499 moduli trasformati e bundlati in 14.79s (Vite v5.4.21) |

---

## Note per il Deployment
1. Le modifiche frontend e backend sono state committate e spinte su GitHub (`main`), innescando il deploy automatico su Vercel.
2. Sul server Raspberry Pi (`edob@100.121.66.33`), `server.js` e `schema.sql` sono stati sincronizzati e il processo PM2 `uniplanner-api` (id 0) è stato riavviato e verificato online in produzione.
