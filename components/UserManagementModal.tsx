import React, { useState, useEffect } from 'react';
import { X, Search, Shield, User, Loader2, Check, AlertTriangle } from 'lucide-react';
import { UserProfile, Project } from '../types';
import { fetchAllUsers, updateUserAccess, auth } from '../services/firebase';

interface UserManagementModalProps {
  onClose: () => void;
  availableProjects: Project[];
}

const UserManagementModal: React.FC<UserManagementModalProps> = ({ onClose, availableProjects }) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
        const data = await fetchAllUsers();
        setUsers(data);
    } catch (e: any) {
        console.error("Failed to fetch users", e);
        if (e.code === 'permission-denied') {
             setError("Permission denied. Please verify your Admin status in the database.");
        } else {
             setError("Failed to load users. " + e.message);
        }
    } finally {
        setLoading(false);
    }
  };

  const handleToggleAdmin = async (user: UserProfile) => {
    // Prevent self-demotion
    if (user.uid === auth.currentUser?.uid) {
        alert("You cannot remove your own admin privileges.");
        return;
    }

    const newAccess = user.accessLevel === 'all' ? [] : 'all'; // Toggle between Admin and Guest (empty)
    await updatePermission(user, newAccess);
  };

  const handleToggleProject = async (user: UserProfile, projectId: string) => {
    if (user.accessLevel === 'all') return; // Admin has all access anyway

    // Parse current list safely
    let currentList: string[] = [];
    const rawAccess = user.accessLevel as string | string[];

    if (Array.isArray(rawAccess)) {
        currentList = [...rawAccess];
    } else if (typeof rawAccess === 'string' && rawAccess !== 'all') {
        currentList = rawAccess.split(',').map(s => s.trim()).filter(Boolean);
    }

    // Toggle ID
    if (currentList.includes(projectId)) {
        currentList = currentList.filter(id => id !== projectId);
    } else {
        currentList.push(projectId);
    }

    await updatePermission(user, currentList);
  };

  const updatePermission = async (user: UserProfile, newAccess: 'all' | string[]) => {
    setUpdatingId(user.uid);
    try {
        await updateUserAccess(user.uid, newAccess);
        // Optimistic update locally
        setUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, accessLevel: newAccess } : u));
    } catch (e) {
        console.error("Failed to update access", e);
        alert("Failed to save permission changes.");
    } finally {
        setUpdatingId(null);
    }
  };

  const filteredUsers = users.filter(u => 
    (u.fullName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 transition-colors flex flex-col max-h-[85vh]">
         {/* Header */}
         <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
             <div>
                 <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                    <Shield className="w-6 h-6 text-blue-600" /> User Management
                 </h2>
                 <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Assign roles and project access permissions.</p>
             </div>
             <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400 dark:text-slate-500" /></button>
         </div>

         {/* Search Bar */}
         <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 shrink-0">
             <div className="relative">
                 <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                 <input 
                    type="text" 
                    placeholder="Search users by name or email..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all dark:text-white dark:placeholder-slate-500"
                 />
             </div>
         </div>

         {/* User List */}
         <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
            {loading ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    <span className="text-xs font-bold uppercase tracking-widest">Loading Users...</span>
                </div>
            ) : error ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                    <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900 dark:text-white">Access Error</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">{error}</p>
                    </div>
                    <button onClick={loadUsers} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">Retry</button>
                </div>
            ) : filteredUsers.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                    <p>No users found matching "{searchTerm}".</p>
                </div>
            ) : (
                filteredUsers.map(user => {
                    const isAdmin = user.accessLevel === 'all';
                    const isSelf = user.uid === auth.currentUser?.uid;
                    const rawAccess = user.accessLevel as string | string[];
                    const accessList = Array.isArray(rawAccess) 
                        ? rawAccess 
                        : (typeof rawAccess === 'string' && rawAccess !== 'all' ? rawAccess.split(',') : []);

                    return (
                        <div key={user.uid} className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden transition-all bg-white dark:bg-slate-900 shadow-sm">
                            <div className="p-4 flex items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/30">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0 ${isAdmin ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}>
                                        {isAdmin ? <Shield className="w-5 h-5" /> : <User className="w-5 h-5" />}
                                    </div>
                                    <div className="truncate">
                                        <h4 className="font-bold text-slate-900 dark:text-white truncate">{user.fullName || 'Unknown User'} {isSelf && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded ml-2 align-middle">YOU</span>}</h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email} • {user.companyName}</p>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-3 shrink-0">
                                    {updatingId === user.uid && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <span className={`text-xs font-bold uppercase tracking-wider ${isAdmin ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>Admin Access</span>
                                        <div 
                                            onClick={() => !isSelf && handleToggleAdmin(user)} 
                                            className={`w-11 h-6 rounded-full p-1 transition-colors relative ${isAdmin ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'} ${isSelf ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${isAdmin ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Project Assignment Area (Only for Guests) */}
                            {!isAdmin && (
                                <div className="p-4 border-t border-slate-100 dark:border-slate-800">
                                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Project Access Assignment</p>
                                    
                                    {availableProjects.length === 0 ? (
                                        <div className="text-xs text-slate-400 italic">No projects available to assign.</div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                            {availableProjects.map(project => {
                                                const isSelected = accessList.includes(project.id || '');
                                                return (
                                                    <div 
                                                        key={project.id}
                                                        onClick={() => handleToggleProject(user, project.id || '')}
                                                        className={`flex items-center gap-3 p-2 rounded-lg border text-xs font-bold cursor-pointer transition-all ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-blue-300 dark:hover:border-blue-600'}`}
                                                    >
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-500 border-blue-500' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600'}`}>
                                                            {isSelected && <Check className="w-3 h-3 text-white" />}
                                                        </div>
                                                        <span className="truncate">{project.name || 'Untitled Project'}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })
            )}
         </div>
         
         {/* Footer Hint */}
         <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 text-center">
             <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center justify-center gap-2">
                 <AlertTriangle className="w-3 h-3" /> Changes to permissions are saved immediately.
             </p>
         </div>
      </div>
    </div>
  );
};

export default UserManagementModal;