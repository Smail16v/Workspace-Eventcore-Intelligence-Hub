import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutGrid, 
  List, 
  Plus, 
  Search, 
  Filter,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { onAuthStateChanged, signInAnonymously, signInWithCustomToken, User } from 'firebase/auth';
import { collection, addDoc, onSnapshot, query, doc, updateDoc } from 'firebase/firestore';

import { auth, db, appId, isMock } from './services/firebase';
import { Project, ViewMode, GroupBy } from './types';

import Navbar from './components/Navbar';
import ProjectCard from './components/ProjectCard';
import ProjectModal from './components/ProjectModal';
import ProjectDashboard from './components/ProjectDashboard';
import EmptyState from './components/EmptyState';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalState, setModalState] = useState<{ isOpen: boolean; project: Project | null }>({ isOpen: false, project: null });
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  // Authentication
  useEffect(() => {
    // If we are in mock mode (no valid config), skip auth to prevent "invalid-api-key" errors.
    if (isMock) {
      setLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        if (typeof window.__initial_auth_token !== 'undefined' && window.__initial_auth_token) {
          await signInWithCustomToken(auth, window.__initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Authentication error:", error);
        // Ensure we stop loading if auth fails, allowing the UI to render the empty state
        setLoading(false);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      // Data Sync effect handles the loading state logic for data fetching based on user presence.
    });

    return () => unsubscribe();
  }, []);

  // Data Sync
  useEffect(() => {
    if (!user) return;
    if (isMock) {
      setLoading(false);
      return;
    }

    setLoading(true);
    // Path: artifacts/{appId}/public/data/projects
    const projectsRef = collection(db, 'artifacts', appId, 'public', 'data', 'projects');
    const q = query(projectsRef);

    const unsubscribeData = onSnapshot(q, 
      (snapshot) => {
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
        setProjects(list);
        setLoading(false);
      }, 
      (err) => {
        console.error("Firestore access error:", err);
        setLoading(false);
      }
    );

    return () => unsubscribeData();
  }, [user]);

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
  const handleSaveProject = async (data: Partial<Project>) => {
    // 1. MOCK / DEMO MODE HANDLER
    if (isMock) {
        // Simulate network delay for realism
        await new Promise(resolve => setTimeout(resolve, 600));

        if (modalState.project?.id) {
             // Update existing project in local state
             setProjects(prev => prev.map(p => 
                p.id === modalState.project!.id ? { ...p, ...data, updatedAt: Date.now() } as Project : p
             ));
        } else {
             // Create new project in local state
             const newProject = {
                 id: `demo-${Date.now()}`,
                 ownerId: 'guest-demo',
                 createdAt: Date.now(),
                 ...data
             } as Project;
             setProjects(prev => [newProject, ...prev]);
        }
        
        setModalState({ isOpen: false, project: null });
        return;
    }

    // 2. FIREBASE MODE HANDLER
    if (!user) {
        alert("Authentication required to save changes to the database.");
        return;
    }

    const projectsRef = collection(db, 'artifacts', appId, 'public', 'data', 'projects');
    
    try {
      if (modalState.project?.id) {
        // Update
        const projectDoc = doc(db, 'artifacts', appId, 'public', 'data', 'projects', modalState.project.id);
        await updateDoc(projectDoc, {
          ...data,
          updatedAt: Date.now()
        });
      } else {
        // Create
        await addDoc(projectsRef, {
          ...data,
          createdAt: Date.now(),
          ownerId: user.uid
        });
      }
      setModalState({ isOpen: false, project: null });
    } catch (e) {
      console.error("Error saving project:", e);
      alert("Failed to save project. Check your connection.");
    }
  };

  const handleEditClick = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setModalState({ isOpen: true, project });
  };

  if (loading && !user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (activeProject) {
    return (
      <ProjectDashboard 
        project={activeProject} 
        onBack={() => setActiveProject(null)} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans flex flex-col transition-colors">
      <Navbar user={user} />
      
      {isMock && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 text-xs font-bold text-amber-800 flex items-center justify-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Running in Demo Mode. Data is stored locally and will be reset on refresh. Connect Firebase for persistence.</span>
        </div>
      )}

      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Project Workspace</h2>
            <p className="text-slate-500 mt-1">Organize your event intelligence by Promoter, Year, or Venue.</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
              <input 
                type="text" 
                placeholder="Search projects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none w-64 shadow-sm transition-all"
              />
            </div>
            
            <button 
              onClick={() => setModalState({ isOpen: true, project: null })}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 flex items-center gap-2 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" /> New Project
            </button>
          </div>
        </div>

        {/* Controls Section */}
        <div className="flex items-center justify-between mb-8 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
           <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-2 ml-2 mr-3 tracking-widest whitespace-nowrap">
                 <Filter className="w-3 h-3" /> Group View
              </span>
              <div className="flex gap-1">
                 {(['none', 'year', 'promoter', 'location', 'venue'] as const).map(opt => (
                   <button 
                     key={opt}
                     onClick={() => setGroupBy(opt)}
                     className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all whitespace-nowrap ${groupBy === opt ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
                   >
                     {opt}
                   </button>
                 ))}
              </div>
           </div>

           <div className="flex items-center gap-1 pl-4">
             <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-blue-50 text-blue-600' : 'text-slate-400'}`} title="Grid View"><LayoutGrid className="w-4 h-4" /></button>
             <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-blue-50 text-blue-600' : 'text-slate-400'}`} title="List View"><List className="w-4 h-4" /></button>
           </div>
        </div>

        {/* Content Section */}
        {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading Analytics Workspace...</p>
            </div>
        ) : Object.keys(groupedProjects).length === 0 ? (
          <EmptyState onAdd={() => setModalState({ isOpen: true, project: null })} />
        ) : (
          Object.entries(groupedProjects).map(([group, list]) => (
            <div key={group} className="mb-12 animate-in fade-in slide-in-from-top-4 duration-500">
               <div className="flex items-center gap-4 mb-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">{group}</h3>
                  <div className="flex-1 h-px bg-slate-200"></div>
                  <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded text-[10px] font-bold tracking-tight">{list.length} Projects</span>
               </div>
               
               <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" : "space-y-3"}>
                  {list.map(project => (
                    <ProjectCard 
                      key={project.id} 
                      project={project} 
                      viewMode={viewMode} 
                      onSelect={() => setActiveProject(project)}
                      onEdit={(e) => handleEditClick(e, project)}
                    />
                  ))}
               </div>
            </div>
          ))
        )}
      </main>

      {modalState.isOpen && (
        <ProjectModal 
          project={modalState.project}
          onClose={() => setModalState({ isOpen: false, project: null })} 
          onSave={handleSaveProject} 
        />
      )}
    </div>
  );
}