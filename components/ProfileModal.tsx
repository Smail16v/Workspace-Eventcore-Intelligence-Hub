import React, { useState, useEffect } from 'react';
import { X, User, Building, Save, Loader2, Trash2 } from 'lucide-react';
import { UserProfile } from '../types';
import { updateUserProfile, deleteUserAccount, logoutUser } from '../services/firebase';

interface ProfileModalProps {
  profile: UserProfile;
  onClose: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ profile, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<Partial<UserProfile>>({
    fullName: '',
    companyName: ''
  });

  useEffect(() => {
    if (profile) {
        setFormData({
            fullName: profile.fullName || '',
            companyName: profile.companyName || ''
        });
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
        await updateUserProfile(profile.uid, formData);
        onClose();
    } catch (error) {
        console.error("Failed to update profile", error);
        alert("Failed to update profile. Please try again.");
    } finally {
        setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
      if (window.confirm("Are you sure you want to delete your account? This action cannot be undone and you will lose access to all data.")) {
          setLoading(true);
          try {
              await deleteUserAccount();
              // Note: deleteUserAccount usually triggers auth state change which redirects/reloads app
          } catch (error: any) {
              console.error(error);
              if (error.code === 'auth/requires-recent-login') {
                  alert("For security, you must re-login before deleting your account.");
                  await logoutUser();
              } else {
                  alert("Failed to delete account: " + error.message);
              }
              setLoading(false);
          }
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 transition-colors">
        <div className="absolute top-4 right-4 z-10">
           <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400 dark:text-slate-500" /></button>
        </div>

        <div className="p-8">
           <div className="mb-8 text-center">
              <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600 dark:text-blue-400 border-4 border-white dark:border-slate-800 shadow-xl">
                 <User className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Edit Profile</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
                 Update your personal details or manage account settings.
              </p>
           </div>

           <form onSubmit={handleSave} className="space-y-4">
                <div>
                    <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-1">Full Name</label>
                    <div className="relative">
                        <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                        <input type="text" placeholder="Full Name" value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-700 dark:text-white" />
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-1">Company</label>
                    <div className="relative">
                        <Building className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                        <input type="text" placeholder="Company Name" value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-700 dark:text-white" />
                    </div>
                </div>

                <div className="pt-4">
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                            <>
                                <Save className="w-4 h-4" /> Save Changes
                            </>
                        )}
                    </button>
                </div>
           </form>

           <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-3">
               <button 
                  onClick={handleDeleteAccount}
                  type="button" 
                  className="w-full py-2.5 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30 rounded-xl font-bold text-xs hover:bg-red-100 dark:hover:bg-red-900/20 transition-all flex items-center justify-center gap-2"
               >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Account
               </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;