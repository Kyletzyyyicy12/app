// src/config/firebaseConfig.ts
import { initializeApp, getApps, getApp } from "firebase/app"
import { getAuth, Auth, initializeAuth, onAuthStateChanged } from "firebase/auth"
import { getFirestore, Firestore, setLogLevel, enableNetwork, collection, addDoc, serverTimestamp, doc, updateDoc as firebaseUpdateDoc, setDoc as firebaseSetDoc } from "firebase/firestore"
import { getStorage, FirebaseStorage } from "firebase/storage"
import { getFunctions, Functions } from "firebase/functions"
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Your web app's Firebase configuration - SYNCHRONIZED WITH WEB APP
const firebaseConfig = {
  apiKey: "AIzaSyB-C_IjY-ywRfZJWd015As_hGnpV_pfyuw",
  authDomain: "cobypicksswu.firebaseapp.com",
  databaseURL: "https://cobypicksswu-default-rtdb.firebaseio.com",
  projectId: "cobypicksswu",
  storageBucket: "cobypicksswu.firebasestorage.app",
  messagingSenderId: "469611837919",
  appId: "1:469611837919:web:088c372029035bfe0b2c6a",
  measurementId: "G-SQ8C2YNEJ3"
};

// Initialize Firebase with enhanced error handling
let app;
try {
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
} catch (error) {
  console.error('Firebase app initialization error:', error);
  // Fallback initialization
  app = initializeApp(firebaseConfig);
}

// Initialize Auth with Firebase v12 React Native persistence
let auth: Auth;

// Import getReactNativePersistence with safe fallback approaches
let getReactNativePersistence = null;
try {
  // Try to get getReactNativePersistence from firebase/auth
  const firebaseAuth = require('firebase/auth');
  if (firebaseAuth.getReactNativePersistence) {
    getReactNativePersistence = firebaseAuth.getReactNativePersistence;
    console.log('[Firebase] Found getReactNativePersistence in firebase/auth');
  } else {
    console.log('[Firebase] getReactNativePersistence not available in firebase/auth');
  }
} catch (error) {
  console.log('[Firebase] Could not load getReactNativePersistence, will use manual fallback');
}

// Initialize Auth with proper persistence
try {
  if (Platform.OS !== 'web') {
    let persistenceConfig;

    if (getReactNativePersistence) {
      // Use official Firebase React Native persistence
      persistenceConfig = getReactNativePersistence(AsyncStorage);
      console.log('[Firebase] Using official getReactNativePersistence');
    } else {
      // Fallback manual configuration
      persistenceConfig = {
        type: 'LOCAL',
        storage: {
          getItem: (key: string) => AsyncStorage.getItem(key),
          setItem: (key: string, value: string) => AsyncStorage.setItem(key, value),
          removeItem: (key: string) => AsyncStorage.removeItem(key)
        }
      };
      console.log('[Firebase] Using fallback manual persistence configuration');
    }

    auth = initializeAuth(app, {
      persistence: persistenceConfig
    });
    console.log('[Firebase] Auth initialized with AsyncStorage persistence for React Native');
  } else {
    auth = getAuth(app);
    console.log('[Firebase] Auth initialized for web platform');
  }
} catch (error) {
  console.warn('[Firebase] initializeAuth failed, using getAuth fallback:', error);
  auth = getAuth(app); // Fallback
}

// Add auth state listener for debugging
try {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log('[Firebase] User is signed in:', user.uid, user.email);
    } else {
      console.log('[Firebase] No user is signed in');
    }
  });
} catch (error) {
  console.error('[Firebase] Auth state listener error:', error);
}

// Initialize Firestore with network error handling
let db: Firestore;
try {
  db = getFirestore(app);
  // Reduce Firestore log verbosity to hide noisy BloomFilter warnings on React Native
  setLogLevel('error');
  
  // Add network error handling for mobile
  if (Platform.OS !== 'web') {
    // Enable network with retry logic for mobile
    enableNetwork(db).catch(error => {
      console.warn('Failed to enable Firestore network:', error);
    });
  }
  
} catch (error) {
  console.error('Firestore initialization error:', error);
  // Fallback to ensure non-null type; may still throw at runtime if environment misconfigured
  db = getFirestore(app);
}

// Initialize Storage
let storage: FirebaseStorage;
try {
  storage = getStorage(app);
} catch (error) {
  console.error('Firebase storage initialization error:', error);
  // Fallback to ensure non-null type
  storage = getStorage(app);
}

// Initialize Functions
let functions: Functions;
try {
  functions = getFunctions(app);
} catch (error) {
  console.error('Firebase functions initialization error:', error);
  // Fallback to ensure non-null type
  functions = getFunctions(app);
}

export { app, auth, db, storage, functions }

// Ensure a user is signed in (anonymous if necessary)
export async function ensureSignedIn(): Promise<boolean> {
  // With public session access, we don't need to ensure sign in
  return true;
}

// Enhanced logging functions with network error handling
const logTeacherAction = async (userId: string, action: string, details: any) => {
  if (!db) {
    console.warn('Firestore not available for logging');
    return;
  }
  
  try {
    await addDoc(collection(db, 'users', userId, 'activityLogs'), {
      action,
      details,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error logging teacher action:', error);
  }
};

const logStudentAction = async (userId: string, action: string, details: any) => {
  if (!db) {
    console.warn('Firestore not available for logging');
    return;
  }
  
  try {
    await addDoc(collection(db, 'users', userId, 'activityLogs'), {
      action,
      details,
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error logging student action:', error);
  }
};

export { logTeacherAction, logStudentAction };

/**
 * Utility function to filter out undefined values before Firebase operations
 * This prevents the "Unsupported field value: undefined" error
 */
const filterUndefinedValues = (data: any): any => {
  if (data === null || data === undefined) {
    return null;
  }

  if (typeof data === 'object') {
    if (Array.isArray(data)) {
      return data.map(item => filterUndefinedValues(item));
    }

    const filtered: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        filtered[key] = filterUndefinedValues(value);
      }
    }
    return filtered;
  }

  return data;
};

/**
 * Safe updateDoc that filters out undefined values for mobile app
 */
export const safeUpdateDoc = async (documentRef: any, data: any) => {
  const filteredData = filterUndefinedValues(data);

  // Log what was filtered out for debugging
  const originalKeys = Object.keys(data || {});
  const filteredKeys = Object.keys(filteredData || {});
  const removedKeys = originalKeys.filter(key => !(filteredData as any)[key]);

  if (removedKeys.length > 0) {
    console.warn('🔧 Mobile Firebase safeUpdateDoc filtered out undefined values:', removedKeys);
  }

  return firebaseUpdateDoc(documentRef, filteredData);
};

/**
 * Safe setDoc that filters out undefined values for mobile app
 */
export const safeSetDoc = async (documentRef: any, data: any) => {
  const filteredData = filterUndefinedValues(data);

  // Log what was filtered out for debugging
  const originalKeys = Object.keys(data || {});
  const filteredKeys = Object.keys(filteredData || {});
  const removedKeys = originalKeys.filter(key => !(filteredData as any)[key]);

  if (removedKeys.length > 0) {
    console.warn('🔧 Mobile Firebase safeSetDoc filtered out undefined values:', removedKeys);
  }

  return firebaseSetDoc(documentRef, filteredData);
};
