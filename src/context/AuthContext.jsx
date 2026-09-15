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
import { 
  loginUserOnline, 
  loginGoogleOnline,
  verify2FAOnline, 
  toggle2FAOnline, 
  logoutUserOnline, 
  getCurrentUserOnline, 
  publishUserProfile,
  getAuthToken,
  setAuthToken 
} from '../utils/cloudSync';

const AuthContext = createContext();

const STORAGE_USERS_KEY = 'uniplanner_users_db_v2';
const STORAGE_SESSION_KEY = 'uniplanner_active_session_v2';

export const AuthProvider = ({ children }) => {
  const [users, setUsers] = useState(() => {
    const currentV2 = safeJsonParse(localStorage.getItem(STORAGE_USERS_KEY), []);
    return currentV2.filter(u => u.id !== 'usr_main_demo' && u.username !== 'edoardo_dev');
  });

  const [currentUser, setCurrentUser] = useState(() => {
    const session = safeJsonParse(localStorage.getItem(STORAGE_SESSION_KEY), null);
    if (session && session.id && session.id !== 'usr_main_demo' && session.username !== 'edoardo_dev') {
      return session;
    }
    return null;
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('register'); // 'profile' | 'login' | 'register' | 'otp'

  useEffect(() => {
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    if (currentUser) {
      // Store public profile attributes only (never session tokens or secrets)
      const safeSession = { ...currentUser };
      delete safeSession.token;
      delete safeSession.jwt;
      delete safeSession.password;
      delete safeSession.passwordHash;
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(safeSession));
    } else {
      localStorage.removeItem(STORAGE_SESSION_KEY);
    }
  }, [currentUser]);

  // Silent session check on initial load with auto-healing token recovery
  useEffect(() => {
    const checkActiveSession = async () => {
      try {
        const token = getAuthToken();
        if (token) {
          const userOnline = await getCurrentUserOnline();
          if (userOnline && userOnline.friendCode) {
            const formatted = {
              id: `usr_${userOnline.friendCode}`,
              username: userOnline.username,
              fullName: userOnline.fullName || userOnline.username,
              email: userOnline.email || '',
              university: userOnline.university || '',
              degreeCourse: userOnline.degreeCourse || '',
              avatarColor: userOnline.avatarColor || '#8b5cf6',
              friendCode: userOnline.friendCode,
              bio: userOnline.bio || '',
              status: userOnline.status || 'In sessione 🎯',
              shareGrades: userOnline.shareGrades !== false,
              isPremium: Boolean(userOnline.isPremium),
              twoFactorEnabled: Boolean(userOnline.twoFactorEnabled),
              role: userOnline.role || 'student'
            };
            setCurrentUser(formatted);
          }
        } else if (currentUser && currentUser.friendCode) {
          // Se l'utente è loggato localmente ma il tab non ha ancora il token (es. nuovo tab o ricarica),
          // tenta il recupero trasparente del token tramite sync
          const matchingLocal = users.find(u => u.friendCode === currentUser.friendCode);
          if (matchingLocal?.passwordHash) {
            const savedExams = safeJsonParse(localStorage.getItem('uniplanner_exams'), []);
            const savedSchedule = safeJsonParse(localStorage.getItem('uniplanner_schedule_v1'), []);
            const savedDeadlines = safeJsonParse(localStorage.getItem('uniplanner_deadlines'), []);
            await publishUserProfile({ ...currentUser, passwordHash: matchingLocal.passwordHash }, savedExams, savedSchedule, savedDeadlines);
          }
        }
      } catch (err) {
        console.warn('Session verification fallback to local:', err);
      }
    };

    checkActiveSession();
  }, []);

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
      twoFactorEnabled: false,
      isPremium: false,
      role: 'student',
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
   * Secure User Login with 2FA Support
   */
  const login = async (identifier, password) => {
    const cleanId = sanitizeText(identifier, 100).trim();
    if (!cleanId || !password) {
      throw new Error('Inserisci username/email e password.');
    }

    let authResponse = null;
    try {
      authResponse = await loginUserOnline(cleanId, password);
    } catch (onlineErr) {
      if (onlineErr.message && (onlineErr.message.includes('non valide') || onlineErr.message.includes('bloccato'))) {
        throw onlineErr;
      }
      console.warn('Login online fallito, provo fallback locale:', onlineErr);
    }

    // Se il server richiede 2FA OTP
    if (authResponse && authResponse.require2FA) {
      return {
        require2FA: true,
        friendCode: authResponse.friendCode
      };
    }

    if (authResponse && authResponse.user) {
      const onlineUser = authResponse.user;
      if (onlineUser.exams) {
        localStorage.setItem('uniplanner_exams', JSON.stringify(onlineUser.exams));
      }
      if (onlineUser.schedule) {
        localStorage.setItem('uniplanner_schedule_v1', JSON.stringify(onlineUser.schedule));
      }
      if (onlineUser.deadlines) {
        localStorage.setItem('uniplanner_deadlines', JSON.stringify(onlineUser.deadlines));
      }

      if (authResponse.token) {
        setAuthToken(authResponse.token);
      }

      const passwordHash = await hashPassword(password);

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
        shareGrades: onlineUser.shareGrades !== false,
        isPremium: Boolean(onlineUser.isPremium),
        twoFactorEnabled: Boolean(onlineUser.twoFactorEnabled),
        role: onlineUser.role || 'student',
        passwordHash
      };

      setUsers(prev => {
        const filtered = prev.filter(u => u.friendCode !== formattedUser.friendCode);
        return [...filtered, formattedUser];
      });

      setCurrentUser(formattedUser);
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
   * Accesso e registrazione rapida con Account Google
   */
  const loginWithGoogle = async (credential, profile = null) => {
    let authRes = null;
    try {
      authRes = await loginGoogleOnline(credential, profile);
    } catch (err) {
      console.warn('Login Google backend non raggiungibile, utilizzo fallback locale:', err);
    }

    let googleEmail = profile?.email;
    let googleName = profile?.name || profile?.fullName;
    let googlePicture = profile?.picture;

    if (credential && !googleEmail) {
      try {
        const payloadBase64 = credential.split('.')[1];
        const decoded = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
        googleEmail = decoded.email;
        googleName = decoded.name || decoded.given_name;
        googlePicture = decoded.picture;
      } catch (e) {}
    }

    if (authRes && authRes.user) {
      const onlineUser = authRes.user;
      if (authRes.token) {
        setAuthToken(authRes.token);
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
        shareGrades: onlineUser.shareGrades !== false,
        isPremium: Boolean(onlineUser.isPremium),
        twoFactorEnabled: Boolean(onlineUser.twoFactorEnabled),
        role: onlineUser.role || 'student',
        avatarUrl: googlePicture || null
      };

      setUsers(prev => {
        const filtered = prev.filter(u => u.friendCode !== formattedUser.friendCode);
        return [...filtered, formattedUser];
      });

      setCurrentUser(formattedUser);
      return formattedUser;
    }

    // Fallback Locale se offline
    if (googleEmail) {
      const cleanEmail = googleEmail.toLowerCase();
      let localUser = users.find(u => u.email?.toLowerCase() === cleanEmail);
      if (!localUser) {
        const avatarColors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];
        const randomColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];
        localUser = {
          id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          username: googleEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').slice(0, 18) || 'studente',
          fullName: googleName || googleEmail.split('@')[0],
          email: cleanEmail,
          passwordHash: '',
          university: 'Università',
          degreeCourse: 'Corso di Studi',
          avatarColor: randomColor,
          friendCode: generateFriendCode(),
          bio: 'Studente UniPlanner',
          status: 'In sessione 🎯',
          shareGrades: true,
          twoFactorEnabled: false,
          isPremium: false,
          role: 'student',
          avatarUrl: googlePicture || null,
          createdAt: new Date().toISOString()
        };
        setUsers(prev => [...prev, localUser]);
      }
      setCurrentUser(localUser);
      return localUser;
    }

    throw new Error('Impossibile completare l\'accesso con Google.');
  };

  /**
   * Completes 2FA verification with 6-digit OTP
   */
  const verify2FA = async (friendCode, otp) => {
    const userOnline = await verify2FAOnline(friendCode, otp);
    if (!userOnline) {
      throw new Error('Verifica 2FA non riuscita.');
    }

    const formattedUser = {
      id: `usr_${userOnline.friendCode}`,
      username: userOnline.username,
      fullName: userOnline.fullName || userOnline.username,
      email: userOnline.email || '',
      university: userOnline.university || '',
      degreeCourse: userOnline.degreeCourse || '',
      avatarColor: userOnline.avatarColor || '#8b5cf6',
      friendCode: userOnline.friendCode,
      bio: userOnline.bio || '',
      status: userOnline.status || 'In sessione 🎯',
      shareGrades: userOnline.shareGrades !== false,
      isPremium: Boolean(userOnline.isPremium),
      twoFactorEnabled: Boolean(userOnline.twoFactorEnabled),
      role: userOnline.role || 'student'
    };

    setUsers(prev => {
      const filtered = prev.filter(u => u.friendCode !== formattedUser.friendCode);
      return [...filtered, formattedUser];
    });

    setCurrentUser(formattedUser);
    return formattedUser;
  };

  /**
   * Toggles 2FA setting on the backend
   */
  const toggle2FA = async (enabled) => {
    if (!currentUser?.friendCode) return;
    const res = await toggle2FAOnline(currentUser.friendCode, enabled);
    setCurrentUser(prev => ({
      ...prev,
      twoFactorEnabled: Boolean(res.twoFactorEnabled)
    }));
    return res;
  };

  /**
   * Logout Completo & Pulizia Dati
   */
  const logout = async () => {
    await logoutUserOnline();
    setCurrentUser(null);
    try {
      localStorage.removeItem(STORAGE_SESSION_KEY);
      localStorage.removeItem('uniplanner_exams');
      localStorage.removeItem('uniplanner_schedule_v1');
      localStorage.removeItem('uniplanner_deadlines');
    } catch (e) {}
    
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

  const isProUser = Boolean(currentUser?.isPremium || currentUser?.role === 'admin');

  return (
    <AuthContext.Provider value={{
      currentUser,
      users,
      register,
      login,
      loginWithGoogle,
      verify2FA,
      toggle2FA,
      logout,
      updateProfile,
      isAuthModalOpen,
      setIsAuthModalOpen,
      authModalTab,
      setAuthModalTab,
      isPro: isProUser
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
