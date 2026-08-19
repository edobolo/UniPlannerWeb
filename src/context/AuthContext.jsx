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

const AuthContext = createContext();

const STORAGE_USERS_KEY = 'uniplanner_users_db_v1';
const STORAGE_SESSION_KEY = 'uniplanner_active_session_v1';

// Default initial student user if none exists
const DEFAULT_USER = {
  id: 'usr_main_demo',
  username: 'edoardo_dev',
  fullName: 'Edoardo B.',
  email: 'edoardo@uniplanner.it',
  university: 'Università degli Studi di Milano',
  degreeCourse: 'Informatica e Tecnologie Digitali',
  avatarColor: '#8b5cf6',
  friendCode: 'UP-7X9K2',
  bio: 'Studente al 2° anno. Focus su esami di sviluppo e algoritmi.',
  status: 'In sessione Focus 🎯',
  shareGrades: true, // Privacy option: toggle sharing grades and average with friends
  createdAt: new Date().toISOString()
};

export const AuthProvider = ({ children }) => {
  const [users, setUsers] = useState(() => {
    const saved = safeJsonParse(localStorage.getItem(STORAGE_USERS_KEY), []);
    if (!saved || saved.length === 0) {
      return [DEFAULT_USER];
    }
    return saved;
  });

  const [currentUser, setCurrentUser] = useState(() => {
    const session = safeJsonParse(localStorage.getItem(STORAGE_SESSION_KEY), null);
    if (session && session.id) {
      return session;
    }
    return DEFAULT_USER;
  });

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('profile'); // 'profile' | 'login' | 'register'

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
    return newUser;
  };

  /**
   * Secure User Login
   */
  const login = async (identifier, password) => {
    const cleanId = sanitizeText(identifier, 100).trim();
    if (!cleanId || !password) {
      throw new Error('Inserisci username/email e password.');
    }

    const passwordHash = await hashPassword(password);
    const user = users.find(u => 
      (u.username.toLowerCase() === cleanId.toLowerCase() || u.email.toLowerCase() === cleanId.toLowerCase()) &&
      (!u.passwordHash || u.passwordHash === passwordHash) // Allow default demo user login
    );

    if (!user) {
      throw new Error('Credenziali non valide. Verifica username/email e password.');
    }

    setCurrentUser(user);
    return user;
  };

  /**
   * Logout
   */
  const logout = () => {
    setCurrentUser(null);
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
      setAuthModalTab
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
