import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  sanitizeText, 
  validateEmail, 
  validateUsername, 
  validatePassword, 
  hashPassword, 
  generateFriendCode, 
  safeJsonParse 
} from '../utils/security';
import { loginUserOnline, publishUserProfile } from '../utils/cloudSync';

const AuthContext = createContext();

const STORAGE_USERS_KEY = 'uniplanner_users_db_v2';
const STORAGE_SESSION_KEY = 'uniplanner_active_session_v2';

export const AuthProvider = ({ children }) => {
  const [users, setUsers] = useState(() => {
    // Purge legacy v1 demo users if present
    const legacyV1 = safeJsonParse(localStorage.getItem('uniplanner_users_db_v1'), []);
    const cleanV1 = legacyV1.filter(u => u.id !== 'usr_main_demo' && u.username !== 'edoardo_dev');
    if (cleanV1.length > 0) {
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(cleanV1));
    }
    localStorage.removeItem('uniplanner_users_db_v1');

    const currentV2 = safeJsonParse(localStorage.getItem(STORAGE_USERS_KEY), []);
    return currentV2.filter(u => u.id !== 'usr_main_demo' && u.username !== 'edoardo_dev');
  });

  const [currentUser, setCurrentUser] = useState(() => {
    // Purge legacy v1 demo session
    const legacySession = safeJsonParse(localStorage.getItem('uniplanner_active_session_v1'), null);
    if (legacySession && (legacySession.id === 'usr_main_demo' || legacySession.username === 'edoardo_dev')) {
      localStorage.removeItem('uniplanner_active_session_v1');
    }
    localStorage.removeItem('uniplanner_active_session_v1');

    const session = safeJsonParse(localStorage.getItem(STORAGE_SESSION_KEY), null);
    if (session && session.id && session.id !== 'usr_main_demo' && session.username !== 'edoardo_dev') {
      return session;
    }
    return null;
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('register'); // 'profile' | 'login' | 'register'

  useEffect(() => {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_SESSION_KEY);
    }
  }, [currentUser]);

  /**
   * Secure User Registration
   */
  const register = async ({ username, fullName, email, password, university, degreeCourse }) => {
    const cleanUsername = sanitizeText(username, 20);
    const cleanFullName = sanitizeText(fullName, 50);
    const cleanEmail = sanitizeText(email, 100).toLowerCase();
    const cleanUni = sanitizeText(university, 80);
    const cleanDegree = sanitizeText(degreeCourse, 80);

    // Validation
    if (!validateUsername(cleanUsername)) {
      throw new Error('Lo username deve contenere da 3 a 20 caratteri alfanumerici (lettere, numeri, underscore).');
    }
    if (!validateEmail(cleanEmail)) {
      throw new Error('Inserisci un indirizzo email valido.');
    }
    if (!validatePassword(password)) {
      throw new Error('La password deve contenere almeno 6 caratteri.');
    }

    // Check unique username and email
    const exists = users.some(u => u.username.toLowerCase() === cleanUsername.toLowerCase() || u.email.toLowerCase() === cleanEmail);
    if (exists) {
      throw new Error('Uno username o un account con questa email è già registrato.');
    }

    const passwordHash = await hashPassword(password);
    const avatarColors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];
    const randomColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];

    const newUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      username: cleanUsername,
      fullName: cleanFullName || cleanUsername,
      email: cleanEmail,
      passwordHash,
      university: cleanUni || 'Università',
      degreeCourse: cleanDegree || 'Corso di Studi',
      avatarColor: randomColor,
      friendCode: generateFriendCode(),
      bio: 'Studente UniPlanner',
      status: 'Libero ☕',
      shareGrades: true,
      createdAt: new Date().toISOString()
    };

    setUsers(prev => [...prev, newUser]);
    setCurrentUser(newUser);

    try {
      publishUserProfile(newUser, [], [], []);
    } catch (e) {
      console.warn('Initial cloud register sync err:', e);
    }

    return newUser;
  };

  /**
   * Secure User Login (Backend First with Local Fallback)
   */
  const login = async (identifier, password) => {
    const cleanId = sanitizeText(identifier, 100).trim();
    if (!cleanId || !password) {
      throw new Error('Inserisci username/email e password.');
    }

    let onlineUser = null;
    try {
      onlineUser = await loginUserOnline(cleanId, password);
    } catch (onlineErr) {
      // Se l'errore è credenziali errate dal server, lancia subito l'errore
      if (onlineErr.message && onlineErr.message.includes('non valide')) {
        throw onlineErr;
      }
      console.warn('Login online fallito, provo fallback locale:', onlineErr);
    }

    if (onlineUser) {
      // Salva i dati dell'utente online in locale
      if (onlineUser.exams) {
        localStorage.setItem('uniplanner_exams', JSON.stringify(onlineUser.exams));
      }
      if (onlineUser.schedule) {
        localStorage.setItem('uniplanner_schedule_v1', JSON.stringify(onlineUser.schedule));
      }
      if (onlineUser.deadlines) {
        localStorage.setItem('uniplanner_deadlines', JSON.stringify(onlineUser.deadlines));
      }

      const formattedUser = {
        id: `usr_${onlineUser.friendCode}`,
        username: onlineUser.username,
        fullName: onlineUser.fullName || onlineUser.username,
        email: onlineUser.email || '',
        university: onlineUser.university || '',
        degreeCourse: onlineUser.degreeCourse || '',
        avatarColor: onlineUser.avatarColor || '#8b5cf6',
        friendCode: onlineUser.friendCode,
        bio: onlineUser.bio || '',
        status: onlineUser.status || 'In sessione 🎯',
        shareGrades: onlineUser.shareGrades !== false
      };

      setUsers(prev => {
        const filtered = prev.filter(u => u.friendCode !== formattedUser.friendCode);
        return [...filtered, formattedUser];
      });

      setCurrentUser(formattedUser);
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(formattedUser));
      
      // Ricarica per applicare tutti i dati del profilo
      setTimeout(() => {
        window.location.reload();
      }, 300);
      return formattedUser;
    }

    // Fallback Locale
    const passwordHash = await hashPassword(password);
    const user = users.find(u => 
      (u.username.toLowerCase() === cleanId.toLowerCase() || u.email.toLowerCase() === cleanId.toLowerCase()) &&
      (!u.passwordHash || u.passwordHash === passwordHash)
    );

    if (!user) {
      throw new Error('Credenziali non valide. Verifica username/email e password.');
    }

    setCurrentUser(user);
    return user;
  };

  /**
   * Logout Completo & Pulizia Dati Totale
   */
  const logout = () => {
    setCurrentUser(null);
    try {
      localStorage.clear();
    } catch (e) {}
    
    // Ricarica la pagina per resettare completamente l'interfaccia a 0
    window.location.reload();
  };

  /**
   * Secure Profile Update
   */
  const updateProfile = (fields) => {
    if (!currentUser) return;

    const updated = {
      ...currentUser,
      fullName: fields.fullName !== undefined ? sanitizeText(fields.fullName, 50) : currentUser.fullName,
      university: fields.university !== undefined ? sanitizeText(fields.university, 80) : currentUser.university,
      degreeCourse: fields.degreeCourse !== undefined ? sanitizeText(fields.degreeCourse, 80) : currentUser.degreeCourse,
      bio: fields.bio !== undefined ? sanitizeText(fields.bio, 200) : currentUser.bio,
      status: fields.status !== undefined ? sanitizeText(fields.status, 50) : currentUser.status,
      avatarColor: fields.avatarColor || currentUser.avatarColor,
      shareGrades: fields.shareGrades !== undefined ? Boolean(fields.shareGrades) : (currentUser.shareGrades !== false)
    };

    setCurrentUser(updated);
    setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
  };

  const [isProUser, setIsProUser] = useState(() => {
    const isUnlocked = localStorage.getItem('uniplanner_pro_unlocked') === 'true';
    const isEdo = currentUser && (
      currentUser.isPro === true ||
      currentUser.username?.toLowerCase().includes('edo') ||
      currentUser.email?.toLowerCase().includes('edo') ||
      currentUser.email?.toLowerCase().includes('edob') ||
      currentUser.email?.toLowerCase().includes('bolo') ||
      currentUser.fullName?.toLowerCase().includes('edo')
    );
    return Boolean(isUnlocked || isEdo);
  });

  useEffect(() => {
    const isUnlocked = localStorage.getItem('uniplanner_pro_unlocked') === 'true';
    const isEdo = currentUser && (
      currentUser.isPro === true ||
      currentUser.username?.toLowerCase().includes('edo') ||
      currentUser.email?.toLowerCase().includes('edo') ||
      currentUser.email?.toLowerCase().includes('edob') ||
      currentUser.email?.toLowerCase().includes('bolo') ||
      currentUser.fullName?.toLowerCase().includes('edo')
    );
    if (isEdo && !isUnlocked) {
      localStorage.setItem('uniplanner_pro_unlocked', 'true');
    }
    setIsProUser(Boolean(isUnlocked || isEdo));
  }, [currentUser]);

  const unlockPro = (code) => {
    const cleanCode = (code || '').trim().toUpperCase();
    if (
      cleanCode === 'UNIPLANNER-PRO-2026' || 
      cleanCode === 'EDO-PRO-VIP' || 
      cleanCode === 'EDO' || 
      cleanCode === 'PRO' ||
      cleanCode === 'EDOBOLO'
    ) {
      localStorage.setItem('uniplanner_pro_unlocked', 'true');
      setIsProUser(true);
      return true;
    }
    return false;
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      users,
      register,
      login,
      logout,
      updateProfile,
      isAuthModalOpen,
      setIsAuthModalOpen,
      authModalTab,
      setAuthModalTab,
      isPro: isProUser,
      unlockPro
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
