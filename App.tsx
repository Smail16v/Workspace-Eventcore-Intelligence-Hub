import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutGrid, 
  List, 
  Plus, 
  Search, 
  Filter,
  Loader2,
  Lock
} from 'lucide-react';
import { onAuthStateChanged, signInWithCustomToken, User } from 'firebase/auth';
import { collection, addDoc, onSnapshot, query, doc, updateDoc, setDoc, deleteField, where, documentId } from 'firebase/firestore';

import { 
  auth, 
  db, 
  appId, 
  subscribeToUserProfile, 
  ensureUserProfileExists, 
  saveProjectDatasets,
  uploadProjectFile,
  deleteProjectFile,
  uploadProjectLogo
} from './services/firebase';
import { Project, ViewMode, GroupBy, UserProfile } from './types';

import Navbar from './components/Navbar';
import ProjectCard from './components/ProjectCard';
import ProjectModal from './components/ProjectModal';
import ProjectDashboard from './components/ProjectDashboard';
import EmptyState from './components/EmptyState';
import AuthModal from './components/AuthModal';
import ProfileModal from './components/ProfileModal';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [modalState, setModalState] = useState<{ isOpen: boolean; project: Project | null }>({ isOpen: false, project: null });
  const [authModalOpen, setAuthModalOpen] = useState(true);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  
  // Theme State
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    }
    return 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  // Authentication Setup
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof window.__initial_auth_token !== 'undefined' && window.__initial_auth_token) {
          await signInWithCustomToken(auth, window.__initial_auth_token);
        }
      } catch (error: any) {
         console.error("Authentication error:", error);
         setLoading(false);
      }
    };
    
    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      // If a real user is detected
      if (currentUser) {
         setAuthModalOpen(false);
         // Ensure profile exists (Auto-Heal for restored sessions)
         ensureUserProfileExists(currentUser);
      } else {
         setUserProfile(null);
         // Strictly enforce auth modal when no user
         setAuthModalOpen(true);
      }
    });

    initAuth();

    return () => unsubscribe();
  }, []);

  // User Profile Sync - Separated to handle cleanup correctly
  useEffect(() => {
      if (!user) {
          setUserProfile(null);
          return;
      }

      // Subscribe to profile changes
      const unsubscribeProfile = subscribeToUserProfile(user.uid, (profile) => {
          setUserProfile(profile);
      });

      return () => {
          unsubscribeProfile();
      };
  }, [user]);

  // Data Sync - RBAC Implementation
  useEffect(() => {
    // Wait for BOTH user and profile to be loaded to determine access level
    if (!user) {
        setProjects([]);
        setLoading(false);
        return;
    }

    if (!userProfile) {
        // Keep loading while we fetch profile
        return;
    }

    setLoading(true);

    // Fix: Cast accessLevel to loose type to allow robust parsing of potential CSV strings
    const rawAccess = userProfile.accessLevel as string | string[];
    let accessList: string[] = [];
    let isAdmin = false;

    // Robust parsing: Handle Array or comma-separated string
    if (rawAccess === 'all') {
        isAdmin = true;
    } else if (Array.isArray(rawAccess)) {
        accessList = rawAccess;
    } else if (typeof rawAccess === 'string') {
        accessList = rawAccess.split(',').map(s => s.trim()).filter(s => s.length > 0);
    }

    let q;

    if (isAdmin) {
        // ADMIN: Fetch all projects
        q = query(collection(db, 'projects'));
    } else if (accessList.length > 0) {
        // GUEST: Fetch only allowed projects (Max 30 due to Firestore limits)
        q = query(collection(db, 'projects'), where(documentId(), 'in', accessList.slice(0, 30)));
    } else {
        // GUEST (No Access):
        setProjects([]);
        setLoading(false);
        return;
    }

    const unsubscribeData = onSnapshot(q, 
      (snapshot) => {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
        setProjects(list);
        setLoading(false);
      }, 
      (err) => {
        // Only log error if not a permission denied caused by logout race condition
        if (err.code !== 'permission-denied') {
             console.error("Firestore access error:", err);
        } else {
             console.warn("Firestore permission denied (likely logout or insufficient rights).");
        }
        setLoading(false);
      }
    );

    return () => unsubscribeData();
  }, [user, userProfile]);

  // Filtering & Grouping
  const filteredProjects = useMemo(() => {
    return projects.filter(p => 
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.venue?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [projects, searchTerm]);

  const groupedProjects = useMemo(() => {
    if (groupBy === 'none') return { "All Projects": filteredProjects };
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return filteredProjects.reduce((acc: Record<string, Project[]>, p: any) => {
      const key = p[groupBy] || 'Uncategorized';
      if (!acc[key]) acc[key] = [];
      acc[key].push(p);
      return acc;
    }, {});
  }, [filteredProjects, groupBy]);

  // Actions
  const handleSaveProject = async (
    data: Partial<Project>, 
    schemaData?: any[], 
    responsesData?: any[],
    schemaFile?: File | null,
    responsesFile?: File | null,
    deleteSchema?: boolean,
    deleteResponses?: boolean,
    logoFile?: File | null,
    onProgress?: (stage: string, percent: number) => void
  ) => {
    if (!user) {
        setAuthModalOpen(true);
        return;
    }

    // SIMPLIFIED PATH: Root 'projects' collection
    const projectsRef = collection(db, 'projects');
    
    // Sanitize data: Firestore throws error if 'undefined' is passed as a value.
    const cleanData: any = Object.fromEntries(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      Object.entries(data).filter(([_, v]) => v !== undefined)
    );

    try {
      let projectId = modalState.project?.id;
      let isNew = false;

      // If creating new project, generate ID immediately so we can use it for Storage upload
      if (!projectId) {
         isNew = true;
         projectId = doc(projectsRef).id;
      }

      // --- Storage Operations (Sync) ---
      
      // 0. Logo Upload
      if (logoFile && projectId) {
          if (onProgress) onProgress("Uploading Logo...", 0);
          const logoUrl = await uploadProjectLogo(
              projectId, 
              logoFile, 
              (p) => onProgress && onProgress("Uploading Logo...", p)
          );
          cleanData.logoUrl = logoUrl;
      }

      // 1. Schema
      if (deleteSchema && projectId) {
          await deleteProjectFile(projectId, 'schema');
          cleanData.schemaUrl = deleteField();
          cleanData.schemaSize = deleteField();
      } else if (schemaFile && projectId) {
          if (onProgress) onProgress("Uploading Schema...", 0);
          const url = await uploadProjectFile(
              projectId, 
              schemaFile, 
              'schema',
              (p) => onProgress && onProgress("Uploading Schema...", p)
          );
          cleanData.schemaUrl = url;
          cleanData.schemaSize = schemaFile.size;
      }

      // 2. Responses
      if (deleteResponses && projectId) {
          await deleteProjectFile(projectId, 'responses');
          cleanData.responsesUrl = deleteField();
          cleanData.responsesSize = deleteField();
      } else if (responsesFile && projectId) {
          if (onProgress) onProgress("Uploading Responses...", 0);
          const url = await uploadProjectFile(
              projectId, 
              responsesFile, 
              'responses',
              (p) => onProgress && onProgress("Uploading Responses...", p)
          );
          cleanData.responsesUrl = url;
          cleanData.responsesSize = responsesFile.size;
      }

      // --- Firestore Metadata Operation ---
      if (onProgress) onProgress("Finalizing...", 100);
      
      const projectDoc = doc(db, 'projects', projectId);
      
      if (isNew) {
        await setDoc(projectDoc, {
          ...cleanData,
          createdAt: Date.now(),
          ownerId: user.uid
        });
      } else {
        await updateDoc(projectDoc, {
          ...cleanData,
          updatedAt: Date.now()
        });
      }

      // --- Firestore Data Rows Operation (Subcollections) ---
      // We still run this to support the requirement of converting CSV to Firestore Database
      if ((schemaData && schemaData.length > 0) || (responsesData && responsesData.length > 0)) {
          if (onProgress) onProgress("Processing Datasets...", 100);
          await saveProjectDatasets(projectId, schemaData, responsesData);
      }

      setModalState({ isOpen: false, project: null });
    } catch (e: any) {
      console.error("Error saving project:", e);
      if (e.code === 'permission-denied' || e.code === 'storage/unauthorized') {
          alert("Permission Denied: You do not have sufficient rights to perform this action.");
      } else {
          const msg = e.message || "Unknown error";
          alert(`Failed to save project. ${msg}`);
      }
    }
  };

  const handleEditClick = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setModalState({ isOpen: true, project });
  };

  // RBAC Checks
  const isAdmin = userProfile?.accessLevel === 'all';
  const isReadOnly = !isAdmin;

  // If loading and we have no user, we might be initializing auth. 
  // But if auth is initialized and we have no user, the modal should be open (handled in render).
  if (loading && user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (activeProject) {
    return (
      <ProjectDashboard 
        project={activeProject} 
        onBack={() => setActiveProject(null)} 
        readOnly={isReadOnly}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col transition-colors duration-300">
      <Navbar 
        user={user} 
        userProfile={userProfile}
        onAuthClick={() => setAuthModalOpen(true)} 
        onProfileClick={() => setProfileModalOpen(true)}
        isDark={theme === 'dark'}
        toggleTheme={toggleTheme}
      />

      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Project Workspace</h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Organize your event intelligence by Promoter, Year, or Venue.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
              <input 
                type="text" 
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500 focus:border-transparent outline-none w-64 shadow-sm transition-all dark:text-white placeholder-slate-400"
              />
            </div>
            
            {/* New Project Button - Only for Admins */}
            {isAdmin && (
                <button 
                onClick={() => setModalState({ isOpen: true, project: null })}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all active:scale-95"
                >
                <Plus className="w-4 h-4" /> New Project
                </button>
            )}
          </div>
        </div>

        {/* Controls Section */}
        <div className="flex items-center justify-between mb-8 bg-white dark:bg-slate-900 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
           <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase flex items-center gap-2 ml-2 mr-3 tracking-widest whitespace-nowrap">
                 <Filter className="w-3 h-3" /> Group View
              </span>
              <div className="flex gap-1">
                 {(['none', 'year', 'promoter', 'location', 'venue'] as const).map(opt => (
                   <button 
                     key={opt}
                     onClick={() => setGroupBy(opt)}
                     className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all whitespace-nowrap ${groupBy === opt ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                   >
                     {opt}
                   </button>
                 ))}
              </div>
           </div>

           <div className="flex items-center gap-1 pl-4">
             <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`} title="Grid View"><LayoutGrid className="w-4 h-4" /></button>
             <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`} title="List View"><List className="w-4 h-4" /></button>
           </div>
        </div>

        {/* Content Section */}
        {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading Analytics Workspace...</p>
            </div>
        ) : Object.keys(groupedProjects).length === 0 ? (
          isAdmin ? (
             <EmptyState onAdd={() => setModalState({ isOpen: true, project: null })} />
          ) : (
            <div className="py-24 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                    <Lock className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Projects Assigned</h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-sm text-sm">You do not currently have access to any event hubs. Please contact an administrator.</p>
            </div>
          )
        ) : (
          Object.entries(groupedProjects).map(([group, list]) => (
            <div key={group} className="mb-12 animate-in fade-in slide-in-from-top-4 duration-500">
               <div className="flex items-center gap-4 mb-6">
                  <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none">{group}</h3>
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
                  <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded text-[10px] font-bold tracking-tight">{list.length} Projects</span>
               </div>
               
               <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" : "space-y-3"}>
                  {list.map(project => (
                    <ProjectCard 
                      key={project.id} 
                      project={project} 
                      viewMode={viewMode} 
                      onSelect={() => setActiveProject(project)}
                      onEdit={(e) => handleEditClick(e, project)}
                      readOnly={isReadOnly}
                    />
                  ))}
               </div>
            </div>
          ))
        )}
      </main>

      {/* Modals */}
      {modalState.isOpen && (
        <ProjectModal 
          project={modalState.project}
          onClose={() => setModalState({ isOpen: false, project: null })} 
          onSave={handleSaveProject} 
        />
      )}

      {authModalOpen && (
        <AuthModal 
          onClose={() => setAuthModalOpen(false)} 
          allowClose={!!user}
        />
      )}

      {profileModalOpen && userProfile && (
        <ProfileModal 
          profile={userProfile}
          onClose={() => setProfileModalOpen(false)}
        />
      )}
    </div>
  );
}