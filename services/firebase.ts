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
import { getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
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

// --- Authentication Helpers ---

export const registerUser = async (email: string, password: string, fullName: string, company: string, role: string) => {
  if (isMock) {
      console.log("Mock Registration:", { email, fullName, company, role });
      return { success: true };
  }

  try {
    // 1. Create the account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // 2. Save the extra info (Company, Role, etc.) to Firestore
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      fullName: fullName,
      companyName: company,
      role: role, // 'admin' or 'venue_user'
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
    if (isMock || !user) return;
    
    try {
        const userDocRef = doc(db, "users", user.uid);
        const userSnapshot = await getDoc(userDocRef);

        if (!userSnapshot.exists()) {
            console.log("Healing: Creating missing Firestore profile for user", user.uid);
            await setDoc(userDocRef, {
                uid: user.uid,
                email: user.email || "",
                fullName: user.displayName || "User",
                companyName: "Unassigned",
                role: "venue_user",
                createdAt: Date.now()
            }, { merge: true });
        }
    } catch (e) {
        console.warn("Failed to ensure user profile exists:", e);
    }
};

export const loginUser = async (email: string, password: string) => {
    if (isMock) return { success: true };
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
  if (isMock) return { success: "Mock password reset email sent." };
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
    if (isMock) {
        window.location.reload(); // Simple reload for mock
        return;
    }
    await signOut(auth);
};

// --- Profile Management ---

export const subscribeToUserProfile = (uid: string, callback: (profile: UserProfile | null) => void) => {
    if (isMock) {
        callback({ uid: 'mock-uid', email: 'mock@example.com', fullName: 'Mock User', companyName: 'Mock Corp', role: 'admin', createdAt: Date.now() });
        return () => {};
    }

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
    if (isMock) return;
    const userDocRef = doc(db, "users", uid);
    await updateDoc(userDocRef, data);
};

export const deleteUserAccount = async () => {
    if (isMock) {
        window.location.reload();
        return;
    }
    
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