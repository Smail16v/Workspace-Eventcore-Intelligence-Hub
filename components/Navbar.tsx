import React from 'react';
import { Globe, User, LogOut, LogIn, Sun, Moon, Settings } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { logoutUser } from '../services/firebase';
import { UserProfile } from '../types';

interface NavbarProps {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  onAuthClick: () => void;
  onProfileClick: () => void;
  isDark: boolean;
  toggleTheme: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ user, userProfile, onAuthClick, onProfileClick, isDark, toggleTheme }) => {
  // Use profile data if available, fallback to Auth data
  const displayName = userProfile?.fullName || user?.displayName || user?.email || 'Welcome';
  const displayCompany = userProfile?.companyName || 'Eventcore Member';

  return (
    <nav className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between sticky top-0 z-30 transition-colors duration-300">
      <div className="flex items-center gap-3">
        <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-500/20">
          <Globe className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">Intelligence Hub</h1>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-widest leading-none">Workspace</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Theme Toggle */}
        <button 
          onClick={toggleTheme}
          className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          title="Toggle Theme"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-2 hidden sm:block"></div>

        <div className="text-right hidden sm:block">
           <p className="text-xs font-bold leading-none text-slate-700 dark:text-slate-200">
             {displayName}
           </p>
           <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-tighter">
             {displayCompany}
           </p>
        </div>
        
        {!user ? (
           <button 
             onClick={onAuthClick}
             className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-700 transition-all shadow-md"
           >
             <LogIn className="w-3.5 h-3.5" /> Sign In
           </button>
        ) : (
           <div className="flex items-center gap-2">
             <div 
                onClick={onProfileClick}
                className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-700 shadow-sm flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                title="Edit Profile"
             >
                <User className="w-5 h-5 text-slate-400 dark:text-slate-400" />
             </div>
             <button 
                onClick={logoutUser}
                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 text-slate-400 dark:text-slate-500 rounded-lg transition-colors"
                title="Sign Out"
             >
                <LogOut className="w-4 h-4" />
             </button>
           </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;