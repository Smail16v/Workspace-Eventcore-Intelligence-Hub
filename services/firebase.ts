import { initializeApp, getApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signInWithCustomToken as firebaseSignInWithCustomToken,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  deleteUser as firebaseDeleteUser,
  User as FirebaseUser
} from 'firebase/auth';
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
  deleteField 
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytesResumable, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { UserProfile } from '../types';

const firebaseConfig = {
  apiKey: "AIzaSyCJ8ySYbW89WK8GRzJt9aelf-4tmocsdPI",
  authDomain: "eventcore-intelligence-hub.firebaseapp.com",
  projectId: "eventcore-intelligence-hub",
  storageBucket: "eventcore-intelligence-hub.firebasestorage.app",
  messagingSenderId: "166550528716",
  appId: "1:166550528716:web:0560e89cfd4b8e2165d869"
};

// Initialize Firebase Modularly
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// These exports ensure the internal registries for auth, db, and storage are correctly linked to 'app'
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const appId = typeof window.__app_id !== 'undefined' ? window.__app_id : 'eventcore-workspace';

export type User = FirebaseUser;
export { deleteField };

// --- Authentication Helpers (Modular Adapters) ---
export const onAuthStateChanged = firebaseOnAuthStateChanged;
export const signInWithCustomToken = firebaseSignInWithCustomToken;

export const registerUser = async (email: string, password: string, fullName: string, company: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    if (user) {
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            fullName,
            companyName: company,
            email,
            accessLevel: [], 
            createdAt: Date.now()
        });
        await sendEmailVerification(user);
        await firebaseSignOut(auth);
    }
    return { success: true };
  } catch (error: any) {
    return { error: error.code === 'auth/email-already-in-use' ? "User already exists." : error.message };
  }
};

export const ensureUserProfileExists = async (user: User) => {
    if (!user) return;
    try {
        const userDocRef = doc(db, "users", user.uid);
        const userSnapshot = await getDoc(userDocRef);
        if (!userSnapshot.exists()) {
            await setDoc(userDocRef, {
                uid: user.uid,
                email: user.email || "",
                fullName: user.displayName || "User",
                companyName: "Unassigned",
                accessLevel: [],
                createdAt: Date.now()
            }, { merge: true });
        }
    } catch (e: any) {
        if (e.code !== 'permission-denied') console.warn("Profile heal skipped:", e);
    }
};

export const loginUser = async (email: string, password: string) => {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        if (user && !user.emailVerified) return { unverified: true, email: user.email };
        if (user) await ensureUserProfileExists(user);
        return { success: true };
    } catch (error: any) {
        return { error: "Invalid email or password." };
    }
};

export const resetPassword = async (email: string) => {
    try {
        await sendPasswordResetEmail(auth, email);
        return { success: "Password reset email sent. Please check your inbox." };
    } catch (error: any) {
        return { error: error.message };
    }
};

export const resendVerificationEmail = async () => {
    try {
        const user = auth.currentUser;
        if (user) {
            await sendEmailVerification(user);
            return { success: "Verification email sent. Please check your inbox." };
        }
        return { error: "No user currently signed in." };
    } catch (error: any) {
        return { error: error.message };
    }
};

export const logoutUser = () => firebaseSignOut(auth);

export const subscribeToUserProfile = (uid: string, callback: (profile: UserProfile | null) => void) => {
    return onSnapshot(doc(db, "users", uid), 
        (snapshot) => callback(snapshot.exists() ? snapshot.data() as UserProfile : null),
        () => callback(null)
    );
};

export const updateUserProfile = async (uid: string, data: Partial<UserProfile>) => {
    await updateDoc(doc(db, "users", uid), data);
};

export const fetchAllUsers = async (): Promise<UserProfile[]> => {
    const snapshot = await getDocs(collection(db, "users"));
    return snapshot.docs.map(doc => doc.data() as UserProfile);
};

export const updateUserAccess = async (uid: string, accessLevel: 'all' | string[]) => {
    await updateDoc(doc(db, "users", uid), { accessLevel });
};

export const deleteUserAccount = async () => {
    const user = auth.currentUser;
    if (user) {
        await deleteDoc(doc(db, "users", user.uid));
        await firebaseDeleteUser(user);
    }
};

export const uploadProjectFile = (projectId: string, file: File, type: 'schema' | 'responses', onProgress?: (p: number) => void): Promise<string> => {
    return new Promise((resolve, reject) => {
        const storageRef = ref(storage, `project_CSVs/${projectId}/${type}.csv`);
        const uploadTask = uploadBytesResumable(storageRef, file);
        uploadTask.on('state_changed', 
            (s) => onProgress?.((s.bytesTransferred / s.totalBytes) * 100),
            reject,
            async () => resolve(await getDownloadURL(uploadTask.snapshot.ref))
        );
    });
};

export const uploadProjectLogo = (projectId: string, file: File, onProgress?: (p: number) => void): Promise<string> => {
    return new Promise((resolve, reject) => {
        const ext = file.name.split('.').pop() || 'png';
        const storageRef = ref(storage, `project_assets/${projectId}/logo.${ext}`);
        const uploadTask = uploadBytesResumable(storageRef, file);
        uploadTask.on('state_changed', (s) => onProgress?.((s.bytesTransferred / s.totalBytes) * 100), reject,
            async () => resolve(await getDownloadURL(uploadTask.snapshot.ref))
        );
    });
};

export const deleteProjectFile = async (projectId: string, type: 'schema' | 'responses') => {
    const storageRef = ref(storage, `project_CSVs/${projectId}/${type}.csv`);
    try { await deleteObject(storageRef); } catch (e) {}
};

export const deleteProject = (projectId: string) => deleteDoc(doc(db, 'projects', projectId));
