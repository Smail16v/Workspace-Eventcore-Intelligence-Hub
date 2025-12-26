import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Safe parsing of the config
let firebaseConfig;
try {
  if (typeof window !== 'undefined' && window.__firebase_config) {
    firebaseConfig = JSON.parse(window.__firebase_config);
  }
} catch (e) {
  console.warn("Failed to parse firebase config", e);
}

export let isMock = false;

// Fallback to prevent immediate crash if config is missing or invalid.
// The 'auth/invalid-api-key' error occurs if apiKey is missing in the config.
if (!firebaseConfig || !firebaseConfig.apiKey) {
    console.info("Using mock Firebase config to prevent crash");
    isMock = true;
    firebaseConfig = {
        apiKey: "mock-api-key",
        authDomain: "mock.firebaseapp.com",
        projectId: "mock-project",
        storageBucket: "mock.appspot.com",
        messagingSenderId: "000000000000",
        appId: "1:000000000000:web:0000000000000000000000"
    };
}

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const appId = typeof window.__app_id !== 'undefined' ? window.__app_id : 'eventcore-workspace';