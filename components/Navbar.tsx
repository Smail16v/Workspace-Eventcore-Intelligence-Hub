import React from 'react';
import { Globe, User } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';

interface NavbarProps {
  user: FirebaseUser | null;
}

const Navbar: React.FC<NavbarProps> = ({ user }) => {
  return (
    <nav className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-500/20">
          <Globe className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-lg tracking-tight text-slate-900">Intelligence Hub</h1>
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest leading-none">Workspace</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
           <p className="text-xs font-bold leading-none text-slate-700">{user?.uid ? `User ${user.uid.substring(0, 5)}` : 'Guest'}</p>
           <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">Eventcore Administrator</p>
        </div>
        <div className="w-9 h-9 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center overflow-hidden">
           <User className="w-5 h-5 text-slate-400" />
        </div>
      </div>
    </nav>
  );
};

export default Navbar;