import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail, 
  sendEmailVerification,
  signOut,
  deleteUser,
  User
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot, writeBatch, collection } from 'firebase/firestore';
import { UserProfile } from '../types';

// Default configuration provided
const defaultFirebaseConfig = {
  apiKey: "AIzaSyCJ8ySYbW89WK8GRzJt9aelf-4tmocsdPI",
  authDomain: "eventcore-intelligence-hub.firebaseapp.com",
  projectId: "eventcore-intelligence-hub",
  storageBucket: "eventcore-intelligence-hub.firebasestorage.app",
  messagingSenderId: "166550528716",
  appId: "1:166550528716:web:0560e89cfd4b8e2165d869"
};

// Safe parsing of the config: Use injected config if available, otherwise default to provided credentials
let firebaseConfig = defaultFirebaseConfig;
try {
  if (typeof window !== 'undefined' && window.__firebase_config) {
    firebaseConfig = JSON.parse(window.__firebase_config);
  }
} catch (e) {
  console.warn("Failed to parse firebase config, using default", e);
}

// Initialize Firebase
// If config is missing or invalid, this might throw, enforcing valid credentials requirement.
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const appId = typeof window.__app_id !== 'undefined' ? window.__app_id : 'eventcore-workspace';

// --- Authentication Helpers ---

export const registerUser = async (email: string, password: string, fullName: string, company: string) => {
  try {
    // 1. Create the account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. Save the extra info (Company, etc.) to Firestore
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      fullName: fullName,
      companyName: company,
      email: email,
      createdAt: Date.now()
    });

    // 3. Send Verification Email
    await sendEmailVerification(user);

    // 4. Force Sign Out (so they can't access app until verified)
    await signOut(auth);

    return { success: true };
  } catch (error: any) {
    // Error Handling: If email is taken
    if (error.code === 'auth/email-already-in-use') {
      return { error: "User already exists. Please sign in." };
    }
    return { error: error.message };
  }
};

export const ensureUserProfileExists = async (user: User) => {
    if (!user) return;
    
    try {
        // Race Condition Guard: If the user has signed out (e.g. during registration flow), abort.
        if (!auth.currentUser || auth.currentUser.uid !== user.uid) return;

        const userDocRef = doc(db, "users", user.uid);
        const userSnapshot = await getDoc(userDocRef);

        // Guard again after async operation
        if (!auth.currentUser || auth.currentUser.uid !== user.uid) return;

        if (!userSnapshot.exists()) {
            console.log("Healing: Creating missing Firestore profile for user", user.uid);
            await setDoc(userDocRef, {
                uid: user.uid,
                email: user.email || "",
                fullName: user.displayName || "User",
                companyName: "Unassigned",
                createdAt: Date.now()
            }, { merge: true });
        }
    } catch (e: any) {
        // Silently suppress permission errors. These often happen due to auth race conditions
        // (like sign-out during registration) and are usually harmless as the profile is likely
        // already being handled by the main flow.
        if (e.code === 'permission-denied') {
             return; 
        }
        console.warn("Failed to ensure user profile exists:", e);
    }
};

export const loginUser = async (email: string, password: string) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Check if email is verified
        if (!user.emailVerified) {
            await signOut(auth); // Log them out immediately
            return { error: "Email not verified. Please check your inbox and click the verification link." };
        }

        // --- Sync Logic: Ensure Firestore Document Exists ---
        await ensureUserProfileExists(user);

        return { success: true };
    } catch (error: any) {
        // Map common error codes to friendly messages
        if (error.code === 'auth/invalid-credential') return { error: "Invalid email or password." };
        if (error.code === 'auth/user-not-found') return { error: "No account found." };
        if (error.code === 'auth/wrong-password') return { error: "Incorrect password." };
        if (error.code === 'auth/too-many-requests') return { error: "Too many attempts. Try again later." };
        return { error: error.message };
    }
};

export const resetPassword = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: "Password reset email sent! Check your inbox." };
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      return { error: "No account found with this email." };
    }
    return { error: error.message };
  }
};

export const logoutUser = async () => {
    await signOut(auth);
};

// --- Profile Management ---

export const subscribeToUserProfile = (uid: string, callback: (profile: UserProfile | null) => void) => {
    const unsub = onSnapshot(doc(db, "users", uid), 
        (doc) => {
            if (doc.exists()) {
                callback(doc.data() as UserProfile);
            } else {
                callback(null);
            }
        },
        (error) => {
            // Suppress "Missing or insufficient permissions" error logging if expected (e.g. during logout)
            // The logic in App.tsx should prevent this, but this is a failsafe.
            if (error.code !== 'permission-denied') {
                console.error("Error subscribing to user profile:", error);
            }
            callback(null);
        }
    );
    return unsub;
};

export const updateUserProfile = async (uid: string, data: Partial<UserProfile>) => {
    const userDocRef = doc(db, "users", uid);
    await updateDoc(userDocRef, data);
};

export const deleteUserAccount = async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
        // 1. Delete Firestore Document
        await deleteDoc(doc(db, "users", user.uid));
        
        // 2. Delete Auth User
        await deleteUser(user);
    } catch (error) {
        console.error("Error deleting account:", error);
        throw error;
    }
};

// --- Bulk Data Management ---

// Helper to sanitize object keys for Firestore (no dots, no undefined values)
const sanitizeFirestoreData = (data: any) => {
  if (!data || typeof data !== 'object') return {};
  const clean: any = {};
  
  Object.keys(data).forEach(key => {
    // Replace dots with underscores in keys
    const cleanKey = key.replace(/\./g, '_').trim();
    if (!cleanKey) return;

    const value = data[key];
    // Filter out undefined values
    if (value !== undefined) {
      clean[cleanKey] = value;
    }
  });
  return clean;
};

/**
 * Uploads arrays of objects to Firestore subcollections in batches.
 * Firestore limits batches to 500 operations.
 */
export const saveProjectDatasets = async (
  projectId: string, 
  schemaRows?: any[], 
  responseRows?: any[]
) => {
  const uploadBatch = async (collectionName: string, rows: any[]) => {
    const BATCH_SIZE = 450; 
    const total = rows.length;
    
    console.log(`Starting batch upload for ${collectionName}: ${total} rows`);

    // Process in chunks
    for (let i = 0; i < total; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE);
      const batch = writeBatch(db);
      let opCount = 0;

      chunk.forEach((row) => {
        const cleanRow = sanitizeFirestoreData(row);
        // Only add if row has data
        if (Object.keys(cleanRow).length > 0) {
           const docRef = doc(collection(db, 'projects', projectId, collectionName));
           batch.set(docRef, cleanRow);
           opCount++;
        }
      });

      if (opCount > 0) {
         await batch.commit();
         console.log(`Uploaded batch ${Math.floor(i / BATCH_SIZE) + 1} for ${collectionName} (${opCount} docs)`);
      }
    }
  };

  const promises = [];
  if (schemaRows && schemaRows.length > 0) {
    promises.push(uploadBatch('schema', schemaRows));
  }
  if (responseRows && responseRows.length > 0) {
    promises.push(uploadBatch('responses', responseRows));
  }

  await Promise.all(promises);
};