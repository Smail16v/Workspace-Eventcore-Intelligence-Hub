import React, { useState } from 'react';
import { X, Mail, Lock, User, Building, ArrowRight, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { registerUser, loginUser, resetPassword } from '../services/firebase';

interface AuthModalProps {
  onClose: () => void;
  defaultView?: 'login' | 'register';
  allowClose?: boolean;
}

const AuthModal: React.FC<AuthModalProps> = ({ onClose, defaultView = 'login', allowClose = true }) => {
  const [view, setView] = useState<'login' | 'register' | 'forgot'>(defaultView);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  // Default role to venue_user, logic handled by admin later
  const [role] = useState('venue_user');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (view === 'login') {
        const res = await loginUser(email, password);
        if (res.error) throw new Error(res.error);
        onClose();
      } else if (view === 'register') {
        if (!fullName || !company || !email || !password || !confirmPassword) {
            throw new Error("Please fill in all fields.");
        }
        
        if (password !== confirmPassword) {
            throw new Error("Passwords do not match.");
        }

        if (password.length < 6) {
            throw new Error("Password must be at least 6 characters.");
        }

        const res = await registerUser(email, password, fullName, company, role);
        if (res.error) throw new Error(res.error);
        
        // On successful register, switch to login and show success message about verification
        setView('login');
        setSuccessMsg("Account created! Verification email sent. Please check your inbox before logging in.");
        // Clear password fields for safety
        setPassword('');
        setConfirmPassword('');
        
      } else if (view === 'forgot') {
        const res = await resetPassword(email);
        if (res.error) throw new Error(res.error);
        if (typeof res.success === 'string') setSuccessMsg(res.success);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => allowClose && onClose()}></div>
      
      <div className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 transition-colors">
        {allowClose && (
            <div className="absolute top-4 right-4 z-10">
               <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400 dark:text-slate-500" /></button>
            </div>
        )}

        <div className="p-8">
           <div className="mb-6 text-center">
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                 {view === 'login' && 'Welcome Back'}
                 {view === 'register' && 'Create Account'}
                 {view === 'forgot' && 'Reset Password'}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
                 {view === 'login' && 'Sign in to access your intelligence hub.'}
                 {view === 'register' && 'Get started with event analytics today.'}
                 {view === 'forgot' && 'Enter your email to receive a reset link.'}
              </p>
           </div>

           {error && (
               <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400 text-xs font-bold animate-in fade-in">
                   <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
               </div>
           )}

           {successMsg && (
               <div className="mb-6 p-3 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-xl flex items-center gap-3 text-green-600 dark:text-green-400 text-xs font-bold animate-in fade-in text-left">
                   <CheckCircle2 className="w-4 h-4 shrink-0" /> <span className="flex-1">{successMsg}</span>
               </div>
           )}

           <form onSubmit={handleSubmit} className="space-y-4">
              {view === 'register' && (
                  <>
                    <div className="relative">
                        <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                        <input type="text" placeholder="Full Name" value={fullName} onChange={e => setFullName(e.target.value)} className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-700 dark:text-white placeholder:font-medium dark:placeholder-slate-500" />
                    </div>
                    <div className="relative">
                        <Building className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                        <input type="text" placeholder="Company Name" value={company} onChange={e => setCompany(e.target.value)} className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-700 dark:text-white placeholder:font-medium dark:placeholder-slate-500" />
                    </div>
                  </>
              )}

              <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <input type="email" placeholder="Email Address" required value={email} onChange={e => setEmail(e.target.value)} className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-700 dark:text-white placeholder:font-medium dark:placeholder-slate-500" />
              </div>

              {view !== 'forgot' && (
                  <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                      <input type="password" placeholder="Password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-700 dark:text-white placeholder:font-medium dark:placeholder-slate-500" />
                  </div>
              )}

              {view === 'register' && (
                  <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                      <input type="password" placeholder="Confirm Password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-slate-700 dark:text-white placeholder:font-medium dark:placeholder-slate-500" />
                  </div>
              )}

              {view === 'login' && (
                  <div className="text-right">
                      <button type="button" onClick={() => { setView('forgot'); setError(null); setSuccessMsg(null); }} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors">Forgot Password?</button>
                  </div>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                      <>
                        {view === 'login' && 'Sign In'}
                        {view === 'register' && 'Create Account'}
                        {view === 'forgot' && 'Send Reset Link'}
                        <ArrowRight className="w-4 h-4" />
                      </>
                  )}
              </button>
           </form>

           <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
              {view === 'login' && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Don't have an account? <button onClick={() => { setView('register'); setError(null); setSuccessMsg(null); }} className="font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors">Sign up</button>
                  </p>
              )}
              {(view === 'register' || view === 'forgot') && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Already have an account? <button onClick={() => { setView('login'); setError(null); setSuccessMsg(null); }} className="font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors">Sign in</button>
                  </p>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;