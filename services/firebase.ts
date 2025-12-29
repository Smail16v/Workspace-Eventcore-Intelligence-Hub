import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  collection, 
  getDocs, 
  deleteField,
  query,
  where,
  documentId
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
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

// Safe parsing of the config
let firebaseConfig = defaultFirebaseConfig;
try {
  if (typeof window !== 'undefined' && window.__firebase_config) {
    firebaseConfig = JSON.parse(window.__firebase_config);
  }
} catch (e) {
  console.warn("Failed to parse firebase config, using default", e);
}

// Initialize Firebase
// We use the compat library for App and Auth to handle environment inconsistencies with named exports,
// but use Modular SDK for Firestore and Storage to match the usage in the rest of the app.
export const app = firebase.initializeApp(firebaseConfig);
export const auth = app.auth();
export const db = getFirestore(app as any);
export const storage = getStorage(app as any);
export const appId = typeof window.__app_id !== 'undefined' ? window.__app_id : 'eventcore-workspace';

// Re-export User type from compat namespace
export type User = firebase.User;

// Export helpers for App.tsx
export { deleteField };

// --- Authentication Helpers ---

// Adapters to match Modular API signature expected by App.tsx
export const onAuthStateChanged = (
    authInstance: firebase.auth.Auth, 
    nextOrObserver: (user: firebase.User | null) => void
) => {
    return authInstance.onAuthStateChanged(nextOrObserver);
};

export const signInWithCustomToken = (authInstance: firebase.auth.Auth, token: string) => {
    return authInstance.signInWithCustomToken(token);
};

export const registerUser = async (email: string, password: string, fullName: string, company: string) => {
  try {
    // 1. Create the account
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;

    if (user) {
        // 2. Save the extra info (Company, etc.) to Firestore
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            fullName: fullName,
            companyName: company,
            email: email,
            accessLevel: [], // Default: Guest with no project access
            createdAt: Date.now()
        });

        // 3. Send Verification Email
        await user.sendEmailVerification();

        // 4. Force Sign Out (so they can't access app until verified)
        await auth.signOut();
    }

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
        if (!auth.currentUser || auth.currentUser.uid !== user.uid) return;

        const userDocRef = doc(db, "users", user.uid);
        const userSnapshot = await getDoc(userDocRef);

        if (!auth.currentUser || auth.currentUser.uid !== user.uid) return;

        if (!userSnapshot.exists()) {
            console.log("Healing: Creating missing Firestore profile for user", user.uid);
            await setDoc(userDocRef, {
                uid: user.uid,
                email: user.email || "",
                fullName: user.displayName || "User",
                companyName: "Unassigned",
                accessLevel: [], // Default: Guest
                createdAt: Date.now()
            }, { merge: true });
        }
    } catch (e: any) {
        if (e.code === 'permission-denied') {
             return; 
        }
        console.warn("Failed to ensure user profile exists:", e);
    }
};

export const resendVerificationEmail = async () => {
  const user = auth.currentUser;
  if (user) {
    await user.sendEmailVerification();
    return { success: "A new verification link has been sent to your inbox." };
  }
  return { error: "No user found. Please sign in again." };
};

export const loginUser = async (email: string, password: string) => {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;

        if (user && !user.emailVerified) {
            // DO NOT sign out here immediately; let the UI handle the prompt
            return { unverified: true, email: user.email };
        }

        if (user) await ensureUserProfileExists(user);

        return { success: true };
    } catch (error: any) {
        if (error.code === 'auth/invalid-credential') return { error: "Invalid email or password." };
        if (error.code === 'auth/user-not-found') return { error: "No account found." };
        if (error.code === 'auth/wrong-password') return { error: "Incorrect password." };
        if (error.code === 'auth/too-many-requests') return { error: "Too many attempts. Try again later." };
        return { error: error.message };
    }
};

export const resetPassword = async (email: string) => {
  try {
    await auth.sendPasswordResetEmail(email);
    return { success: "Password reset email sent! Check your inbox." };
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      return { error: "No account found with this email." };
    }
    return { error: error.message };
  }
};

export const logoutUser = async () => {
    await auth.signOut();
};

// --- Profile & Admin Management ---

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
        await deleteDoc(doc(db, "users", user.uid));
        await user.delete();
    } catch (error) {
        console.error("Error deleting account:", error);
        throw error;
    }
};

// -- Admin Functions --

export const fetchAllUsers = async (): Promise<UserProfile[]> => {
  const usersRef = collection(db, "users");
  const snapshot = await getDocs(usersRef);
  return snapshot.docs.map(doc => doc.data() as UserProfile);
};

export const updateUserAccess = async (uid: string, newAccess: 'all' | string[]) => {
  const userDocRef = doc(db, "users", uid);
  await updateDoc(userDocRef, { accessLevel: newAccess });
};

// --- Storage Management ---

export const uploadProjectFile = (
  projectId: string, 
  file: File, 
  type: 'schema' | 'responses',
  onProgress?: (progress: number) => void
): Promise<string> => {
    return new Promise((resolve, reject) => {
        // Folder structure: project_CSVs/{projectId}/{type}.csv
        const storageRef = ref(storage, `project_CSVs/${projectId}/${type}.csv`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed', 
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                if (onProgress) onProgress(progress);
            },
            (error) => reject(error),
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(downloadURL);
            }
        );
    });
};

export const uploadProjectLogo = (
    projectId: string, 
    file: File,
    onProgress?: (progress: number) => void
): Promise<string> => {
    return new Promise((resolve, reject) => {
        // Preserve extension if possible
        const ext = file.name.split('.').pop() || 'png';
        const storageRef = ref(storage, `project_assets/${projectId}/logo.${ext}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed', 
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                if (onProgress) onProgress(progress);
            },
            (error) => reject(error),
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                resolve(downloadURL);
            }
        );
    });
};

export const deleteProjectFile = async (projectId: string, type: 'schema' | 'responses') => {
    const storageRef = ref(storage, `project_CSVs/${projectId}/${type}.csv`);
    try {
        await deleteObject(storageRef);
    } catch (e: any) {
        // Ignore if file doesn't exist
        if (e.code !== 'storage/object-not-found') {
            console.error(`Error deleting ${type} file:`, e);
            throw e;
        }
    }
};

export const deleteProject = async (projectId: string) => {
    await deleteDoc(doc(db, "projects", projectId));
};