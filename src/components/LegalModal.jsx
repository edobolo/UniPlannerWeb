import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, 
  FileText, 
  Cookie, 
  Lock, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink,
  Scale,
  School,
  Database
} from 'lucide-react';
import './LegalModal.css';

const LegalModal = ({ isOpen, onClose, initialTab = 'privacy' }) => {
  const [activeTab, setActiveTab] = useState(initialTab);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay legal-modal-overlay">
      <motion.div 
        className="modal-content glass-panel legal-modal-content"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
      >
        {/* Header */}
        <div className="legal-modal-header">
          <div className="legal-header-title-row">
            <div className="legal-icon-box">
              <Scale size={22} />
            </div>
            <div>
              <h2>Informative Legali & Privacy</h2>
              <span className="legal-subtitle">Conformità GDPR UE 2016/679, Cookie Law e Termini di Servizio</span>
            </div>
          </div>
          <button className="icon-btn" onClick={onClose} title="Chiudi">
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="legal-nav-tabs">
          <button 
            className={`legal-tab-btn ${activeTab === 'privacy' ? 'active' : ''}`}
            onClick={() => setActiveTab('privacy')}
          >
            <ShieldCheck size={16} />
            <span>Privacy Policy (GDPR)</span>
          </button>
          <button 
            className={`legal-tab-btn ${activeTab === 'terms' ? 'active' : ''}`}
            onClick={() => setActiveTab('terms')}
          >
            <FileText size={16} />
            <span>Termini & Disclaimer</span>
          </button>
          <button 
            className={`legal-tab-btn ${activeTab === 'cookies' ? 'active' : ''}`}
            onClick={() => setActiveTab('cookies')}
          >
            <Cookie size={16} />
            <span>Cookie & Storage</span>
          </button>
          <button 
            className={`legal-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            <Lock size={16} />
            <span>Sicurezza Dati</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="legal-modal-body">
          {/* 1. PRIVACY POLICY */}
          {activeTab === 'privacy' && (
            <div className="legal-tab-pane">
              <div className="legal-alert-box info">
                <CheckCircle2 size={18} className="alert-icon" />
                <div>
                  <strong>Tutela della Privacy al 100%</strong>
                  <p>I tuoi dati personali sono trattati in conformità al Regolamento Generale sulla Protezione dei Dati dell'Unione Europea (GDPR UE 2016/679).</p>
                </div>
              </div>

              <section className="legal-section">
                <h3>1. Titolare del Trattamento</h3>
                <p>
                  Il progetto <strong>UniPlanner</strong> è una piattaforma indipendente no-profit per studenti universitari finalizzata alla gestione dello studio, dell'orario delle lezioni e delle scadenze accademiche. Il trattamento dei dati è limitato esclusivamente all'erogazione delle funzionalità dell'applicazione.
                </p>
              </section>

              <section className="legal-section">
                <h3>2. Tipologia di Dati Raccolti</h3>
                <p>UniPlanner raccoglie e memorizza esclusivamente i dati strettamente necessari:</p>
                <ul>
                  <li><strong>Dati di registrazione</strong>: Nome e cognome (o pseudonimo), username, indirizzo email (personale o istituzionale universitario) e password cifrata.</li>
                  <li><strong>Dati accademici</strong>: Ateneo di appartenenza, corso di laurea, piano di studi (esami, CFU, voti), orario delle lezioni e scadenze personali.</li>
                  <li><strong>Dati di condivisione social</strong>: Elenco degli amici collegati e stato di studio/focus.</li>
                </ul>
              </section>

              <section className="legal-section">
                <h3>3. Finalità e Base Giuridica del Trattamento</h3>
                <p>
                  I dati personali sono trattati esclusivamente per consentire all'utente di organizzare la propria carriera universitaria, calcolare le statistiche di rendimento, sincronizzare gli orari con i colleghi di corso e ricevere notifiche. La base giuridica del trattamento è l'<strong>esecuzione del servizio</strong> richiesto dall'utente e il <strong>consenso esplicito</strong> prestato in fase di registrazione.
                </p>
              </section>

              <section className="legal-section">
                <h3>4. Non Cessione a Terzi & Assenza di Profilazione Pubblicitaria</h3>
                <p>
                  I dati degli utenti <strong>NON vengono in alcun caso venduti, ceduti, monetizzati o trasferiti a società terze</strong> per scopi commerciali, marketing o profilazione comportamentale.
                </p>
              </section>

              <section className="legal-section">
                <h3>5. Diritti dell'Interessato (Artt. 15-22 GDPR)</h3>
                <p>In ogni momento hai il diritto di:</p>
                <ul>
                  <li>Accedere ai tuoi dati personali memorizzati e richiederne una copia.</li>
                  <li>Rettificare o aggiornare i dati direttamente dalle impostazioni del tuo Profilo.</li>
                  <li><strong>Diritto all'Oblio / Cancellazione Totale</strong>: Puoi richiedere o effettuare la cancellazione permanente del tuo account e di tutti i dati associati in qualsiasi momento.</li>
                </ul>
              </section>
            </div>
          )}

          {/* 2. TERMS & DISCLAIMER */}
          {activeTab === 'terms' && (
            <div className="legal-tab-pane">
              <div className="legal-alert-box warning">
                <School size={18} className="alert-icon" />
                <div>
                  <strong>Progetto Indipendente per Studenti</strong>
                  <p>UniPlanner è sviluppato in modo autonomo e non costituisce un canale ufficiale degli atenei.</p>
                </div>
              </div>

              <section className="legal-section">
                <h3>1. Natura del Servizio</h3>
                <p>
                  UniPlanner è offerto a titolo gratuito *"così com'è"* (*as-is*) per assistere gli studenti nell'organizzazione autonoma del proprio tempo e del proprio percorso di studi.
                </p>
              </section>

              <section className="legal-section">
                <h3>2. Esclusione di Affiliazione con le Università</h3>
                <p>
                  UniPlanner è un progetto autonomo e <strong>non è affiliato, autorizzato, sponsorizzato né collegato ufficialmente</strong> ad alcuna università o ateneo italiano o estero eventualmente citato all'interno dell'applicazione.
                </p>
                <p>
                  I marchi, i nomi di ateneo e le denominazioni dei corsi di laurea appartengono ai rispettivi enti titolari e sono utilizzati dagli utenti esclusivamente a titolo descrittivo per l'organizzazione didattica personale.
                </p>
              </section>

              <section className="legal-section">
                <h3>3. Limitazione di Responsabilità sui Dati Accademici</h3>
                <p>
                  Le date degli appelli, gli orari delle lezioni e le scadenze inseriti manualmente o importati da file (XLS/ICS) hanno valore puramente indicativo e di promemoria personale.
                </p>
                <p>
                  <strong>Gli studenti sono sempre tenuti a fare riferimento ai canali, ai portali ufficiali (es. Esse3, bacheche docenti, segreterie) e ai calendari didattici deliberati dal proprio Ateneo.</strong> Gli sviluppatori di UniPlanner non rispondono di eventuali discrepanze orarie, modifiche di aula o variazioni di appelli decisi dai docenti o dalle facoltà.
                </p>
              </section>

              <section className="legal-section">
                <h3>4. Condotta e Rispetto della Community</h3>
                <p>
                  Gli utenti si impegnano a utilizzare il servizio in modo corretto, a non caricare contenuti illeciti o offensivi e a non tentare di compromettere l'integrità del sistema.
                </p>
              </section>
            </div>
          )}

          {/* 3. COOKIES & STORAGE */}
          {activeTab === 'cookies' && (
            <div className="legal-tab-pane">
              <div className="legal-alert-box success">
                <Cookie size={18} className="alert-icon" />
                <div>
                  <strong>Nessun Cookie di Tracciamento Pubblicitario</strong>
                  <p>UniPlanner rispetta la tua privacy: utilizziamo solo storage tecnico necessario al funzionamento.</p>
                </div>
              </div>

              <section className="legal-section">
                <h3>1. Cosa Utilizziamo</h3>
                <p>
                  UniPlanner non utilizza cookie di terze parti per il tracciamento né cookie di profilazione commerciale (come pixel pubblicitari, Google Ads, tracker di social network).
                </p>
                <p>
                  L'applicazione fa uso esclusivamente di **tecnologie di memorizzazione locale standard (Web Storage / localStorage)** per finalità strettamente tecniche:
                </p>
                <ul>
                  <li><strong>Sessione di autenticazione</strong>: Per mantenere l'utente connesso in sicurezza senza dover reinserire le credenziali ad ogni pagina.</li>
                  <li><strong>Preferenze grafiche</strong>: Per salvare la preferenza del tema (Modalità Chiara / Scura).</li>
                  <li><strong>Cache dei dati di studio</strong>: Per consentire l'avvio rapido e l'uso dell'applicazione anche in modalità offline.</li>
                </ul>
              </section>

              <section className="legal-section">
                <h3>2. Conformità alla Cookie Law Europea</h3>
                <p>
                  Ai sensi della Direttiva e-Privacy e delle Linee Guida del Garante per la Protezione dei Dati Personali (10 giugno 2021), l'uso di **soli strumenti tecnici di memorizzazione** non richiede l'obbligo del banner preventivo di consenso, in quanto tali elementi sono indispensabili per l'erogazione del servizio esplicitamente richiesto dall'utente.
                </p>
              </section>
            </div>
          )}

          {/* 4. SECURITY */}
          {activeTab === 'security' && (
            <div className="legal-tab-pane">
              <div className="legal-alert-box info">
                <Lock size={18} className="alert-icon" />
                <div>
                  <strong>Sicurezza Informatica Integrata</strong>
                  <p>Adottiamo le migliori pratiche crittografiche per proteggere il tuo account e le tue informazioni.</p>
                </div>
              </div>

              <section className="legal-section">
                <h3>1. Protezione delle Credenziali</h3>
                <p>
                  Le password degli account non vengono mai salvate in chiaro. Sono protette tramite algoritmi crittografici di hashing e salatura irreversibili conformi agli standard internazionali di settore.
                </p>
              </section>

              <section className="legal-section">
                <h3>2. Trasmissione Dati Cifrata (HTTPS / SSL)</h3>
                <p>
                  Tutte le comunicazioni tra il browser, l'applicazione desktop e i server avvengono tramite canali crittografati con protocolli TLS/HTTPS per impedire qualsiasi intercettazione da parte di terzi (*man-in-the-middle*).
                </p>
              </section>

              <section className="legal-section">
                <h3>3. Opzione Privacy Reciproca Voti</h3>
                <p>
                  Per proteggere la riservatezza del tuo rendimento accademico, puoi attivare in qualsiasi momento la **Modalità Privacy Voti**: la tua media e i tuoi voti rimarranno invisibili ai compagni di corso, mantenendo comunque attiva la condivisione dell'orario e delle scadenze.
                </p>
              </section>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="legal-modal-footer">
          <span className="legal-footer-note">Ultimo aggiornamento: Agosto 2026 • UniPlanner Platform</span>
          <button className="primary-btn legal-close-btn" onClick={onClose}>
            Ho Capito
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default LegalModal;
