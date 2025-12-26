import React, { useState, useEffect, useRef } from 'react';
import { X, ImageIcon, Plus, Sparkles, Link as LinkIcon, Loader2, FileSpreadsheet, FileCheck, Upload, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { Project } from '../types';
import { analyzeEventContext } from '../services/geminiService';

interface ProjectModalProps {
  project: Project | null;
  onClose: () => void;
  onSave: (data: Partial<Project>) => Promise<void>;
}

const ProjectModal: React.FC<ProjectModalProps> = ({ project, onClose, onSave }) => {
  const isEditing = !!project;
  const [url, setUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  
  // Refs for hidden file inputs
  const logoInputRef = useRef<HTMLInputElement>(null);
  const schemaInputRef = useRef<HTMLInputElement>(null);
  const responsesInputRef = useRef<HTMLInputElement>(null);

  const [uploadedFiles, setUploadedFiles] = useState({
    schema: isEditing ? true : false,
    responses: isEditing ? true : false
  });

  const [selectedFiles, setSelectedFiles] = useState<{
    schema: File | null;
    responses: File | null;
  }>({ schema: null, responses: null });

  const [formData, setFormData] = useState<Partial<Project>>({
    name: '',
    venue: '',
    location: '',
    dates: '',
    year: new Date().getFullYear().toString(),
    promoter: 'Eventcore',
    logoUrl: ''
  });

  useEffect(() => {
    if (project) {
        setFormData({
            name: project.name || '',
            venue: project.venue || '',
            location: project.location || '',
            dates: project.dates || '',
            year: project.year || '',
            promoter: project.promoter || 'Eventcore',
            logoUrl: project.logoUrl || ''
        });
    }
  }, [project]);

  const handleAutoRetrieve = async () => {
    if (!url) return;
    setAnalyzing(true);
    try {
      const data = await analyzeEventContext(url);
      setFormData(prev => ({ ...prev, ...data }));
    } catch (e) {
      console.error("Analysis Failed", e);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileClick = (type: 'schema' | 'responses') => {
    if (type === 'schema') schemaInputRef.current?.click();
    if (type === 'responses') responsesInputRef.current?.click();
  };

  const handleFileChange = (type: 'schema' | 'responses', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFiles(prev => ({ ...prev, [type]: file }));
      setUploadedFiles(prev => ({ ...prev, [type]: true }));
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, logoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
       <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
       
       <div className="relative bg-white w-full max-w-3xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
          <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
             <div>
                <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                    {isEditing ? `Edit Hub: ${formData.name || 'Project'}` : 'Hub Initialization'}
                </h3>
                <p className="text-sm text-slate-500 font-medium">Configure project metadata and required dataset association.</p>
             </div>
             <button onClick={onClose} className="p-3 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
          </div>

          <div className="p-8 overflow-y-auto custom-scrollbar space-y-10">
             {/* Logo & AI */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="flex flex-col items-center gap-3">
                   <div 
                      onClick={() => logoInputRef.current?.click()}
                      className="w-32 h-32 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex items-center justify-center p-6 relative overflow-hidden group cursor-pointer hover:border-blue-400 transition-colors"
                   >
                       {formData.logoUrl ? (
                           <img src={formData.logoUrl} className="max-h-full max-w-full object-contain" alt="Logo Preview" />
                       ) : (
                           <ImageIcon className="w-10 h-10 text-slate-200" />
                       )}
                       <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                          <Plus className="w-6 h-6 text-blue-600" />
                       </div>
                       <input 
                          type="file" 
                          ref={logoInputRef} 
                          onChange={handleLogoUpload} 
                          accept="image/*" 
                          className="hidden" 
                       />
                   </div>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Branding Logo</p>
                </div>

                <div className="md:col-span-2 bg-blue-50 rounded-3xl p-6 border border-blue-100 flex flex-col justify-center">
                   <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      <h4 className="font-bold text-blue-800 text-sm tracking-tight">Event Intelligence Search</h4>
                   </div>
                   <div className="flex gap-2">
                      <div className="relative flex-1">
                        <LinkIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" />
                        <input 
                          type="text" 
                          placeholder="Paste URL or Event Name (AI Search)..."
                          value={url}
                          onChange={(e) => setUrl(e.target.value)}
                          className="w-full pl-9 pr-4 py-3 bg-white border border-blue-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-sm"
                        />
                      </div>
                      <button onClick={handleAutoRetrieve} disabled={analyzing} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-md hover:bg-blue-700 transition-all flex items-center gap-2">
                         {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Auto Fill"}
                      </button>
                   </div>
                   <p className="text-[10px] text-blue-600 mt-3 font-bold uppercase tracking-tight">AI will extract name, venue, promoter, and suggest the logo.</p>
                </div>
             </div>

             {/* Basic Info Grid */}
             <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                <div className="col-span-2">
                   <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Project Name</label>
                   <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="e.g. US Open Tennis" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all text-sm font-bold" />
                </div>
                <div>
                   <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Promoter / Sponsor</label>
                   <input type="text" value={formData.promoter} onChange={(e) => setFormData({...formData, promoter: e.target.value})} placeholder="e.g. USTA Billie Jean King" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                </div>
                <div>
                   <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Venue</label>
                   <input type="text" value={formData.venue} onChange={(e) => setFormData({...formData, venue: e.target.value})} placeholder="e.g. Arthur Ashe Stadium" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                </div>
                <div>
                   <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Location / Country</label>
                   <input type="text" value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} placeholder="e.g. New York, NY • USA" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all text-sm" />
                </div>
                <div>
                   <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Dates (JAN 15 - 18)</label>
                   <input type="text" value={formData.dates} onChange={(e) => setFormData({...formData, dates: e.target.value})} placeholder="e.g. AUG 25 - SEP 08" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all text-sm font-mono" />
                </div>
                <div className="col-span-2">
                   <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Logo URL (Manual Override)</label>
                   <input type="text" value={formData.logoUrl} onChange={(e) => setFormData({...formData, logoUrl: e.target.value})} placeholder="https://domain.com/logo.png" className="w-full px-5 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all text-xs" />
                </div>
             </div>

             {/* Dataset Uploads */}
             <div className="pt-10 border-t border-slate-100">
                <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
                   <FileSpreadsheet className="w-4 h-4" /> Required Datasets
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {/* Schema Upload */}
                   <div onClick={() => handleFileClick('schema')} className={`p-6 border-2 border-dashed rounded-[24px] flex flex-col gap-3 transition-all cursor-pointer ${uploadedFiles.schema ? 'bg-blue-50 border-blue-500' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                      <input 
                        type="file" 
                        ref={schemaInputRef} 
                        onChange={(e) => handleFileChange('schema', e)} 
                        accept=".csv" 
                        className="hidden" 
                      />
                      <div className="flex items-center justify-between">
                         <div className={`p-2.5 rounded-xl ${uploadedFiles.schema ? 'bg-white text-blue-600 shadow-sm' : 'bg-white text-slate-300'}`}>
                            {uploadedFiles.schema ? <FileCheck className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
                         </div>
                         <span className={`text-[8px] font-bold uppercase border px-2 py-0.5 rounded-full flex items-center gap-1 ${uploadedFiles.schema ? 'text-blue-600 bg-white border-blue-100' : 'text-slate-400 bg-white border-slate-100'}`}>
                            {uploadedFiles.schema ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />} {uploadedFiles.schema ? 'Ready' : 'Missing'}
                         </span>
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${uploadedFiles.schema ? 'text-blue-900' : 'text-slate-400'}`}>Schema CSV</p>
                        <p className={`text-[10px] font-bold uppercase tracking-tight mt-1 ${uploadedFiles.schema ? 'text-blue-500' : 'text-slate-400'} truncate`}>
                          {selectedFiles.schema ? selectedFiles.schema.name : (uploadedFiles.schema ? `Q_${formData.name || 'Project'}.csv` : `Pattern: Q_${formData.name || 'Project'}.csv`)}
                        </p>
                      </div>
                   </div>

                   {/* Responses Upload */}
                   <div onClick={() => handleFileClick('responses')} className={`p-6 border-2 border-dashed rounded-[24px] flex flex-col gap-3 transition-all cursor-pointer ${uploadedFiles.responses ? 'bg-blue-50 border-blue-500' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                      <input 
                        type="file" 
                        ref={responsesInputRef} 
                        onChange={(e) => handleFileChange('responses', e)} 
                        accept=".csv" 
                        className="hidden" 
                      />
                      <div className="flex items-center justify-between">
                         <div className={`p-2.5 rounded-xl ${uploadedFiles.responses ? 'bg-white text-blue-600 shadow-sm' : 'bg-white text-slate-300'}`}>
                            {uploadedFiles.responses ? <FileCheck className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
                         </div>
                         <span className={`text-[8px] font-bold uppercase border px-2 py-0.5 rounded-full flex items-center gap-1 ${uploadedFiles.responses ? 'text-blue-600 bg-white border-blue-100' : 'text-slate-400 bg-white border-slate-100'}`}>
                            {uploadedFiles.responses ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />} {uploadedFiles.responses ? 'Ready' : 'Missing'}
                         </span>
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${uploadedFiles.responses ? 'text-blue-900' : 'text-slate-400'}`}>Responses CSV</p>
                        <p className={`text-[10px] font-bold uppercase tracking-tight mt-1 ${uploadedFiles.responses ? 'text-blue-500' : 'text-slate-400'} truncate`}>
                          {selectedFiles.responses ? selectedFiles.responses.name : (uploadedFiles.responses ? `RawData_${formData.name || 'Project'}.csv` : `Pattern: RawData_${formData.name || 'Project'}.csv`)}
                        </p>
                      </div>
                   </div>
                </div>
             </div>
          </div>

          <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-4 shrink-0">
             <button onClick={onClose} className="px-8 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">Discard</button>
             <button 
               onClick={() => onSave(formData)} 
               disabled={!uploadedFiles.schema || !uploadedFiles.responses}
               className={`px-12 py-4 rounded-2xl font-bold shadow-xl transition-all flex items-center gap-2 ${(!uploadedFiles.schema || !uploadedFiles.responses) ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-blue-600 text-white shadow-blue-500/30 hover:bg-blue-700 hover:scale-105 active:scale-95'}`}
             >
                {isEditing ? 'Save Changes' : 'Initialize Hub'} <ArrowRight className="w-4 h-4" />
             </button>
          </div>
       </div>
    </div>
  );
};

export default ProjectModal;