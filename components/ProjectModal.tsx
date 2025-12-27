import React, { useState, useEffect, useRef } from 'react';
import { X, ImageIcon, Plus, Sparkles, Link as LinkIcon, Loader2, FileSpreadsheet, FileCheck, Upload, AlertCircle, CheckCircle2, ArrowRight, RefreshCw, DownloadCloud, AlertTriangle, Trash2, Eye } from 'lucide-react';
import Papa from 'papaparse';
import { Project, ProjectMetrics } from '../types';
import { analyzeEventContext } from '../services/geminiService';
import { listSurveys, importSurveyData, QualtricsSurvey } from '../services/qualtricsService';
import { extractProjectMetrics } from '../services/metadataService';

interface ProjectModalProps {
  project: Project | null;
  onClose: () => void;
  onDelete?: (projectId: string) => Promise<void>;
  onSave: (
      data: Partial<Project>, 
      schemaData?: any[], 
      responsesData?: any[],
      schemaFile?: File | null,
      responsesFile?: File | null,
      deleteSchema?: boolean,
      deleteResponses?: boolean,
      logoFile?: File | null,
      onProgress?: (stage: string, percent: number) => void
    ) => Promise<void>;
}

const formatFileSize = (bytes?: number) => {
  if (!bytes) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const extractProjectNameFromFilename = (filename: string): string => {
  // Remove extension
  let name = filename.replace(/\.[^/.]+$/, "");
  // Remove common prefixes
  name = name.replace(/^(Q_|RawData_|Schema_|Responses_)/i, "");
  // Replace underscores and dashes with spaces
  name = name.replace(/[_-]/g, " ");
  return name.trim();
};

const ProjectModal: React.FC<ProjectModalProps> = ({ project, onClose, onSave, onDelete }) => {
  const isEditing = !!project;
  const [url, setUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'ai' | 'qualtrics'>('ai');
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<{ stage: string; percent: number } | null>(null);
  
  // Qualtrics State
  const [surveys, setSurveys] = useState<QualtricsSurvey[]>([]);
  const [loadingSurveys, setLoadingSurveys] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);

  // Refs for hidden file inputs
  const logoInputRef = useRef<HTMLInputElement>(null);
  const schemaInputRef = useRef<HTMLInputElement>(null);
  const responsesInputRef = useRef<HTMLInputElement>(null);

  // File State
  const [uploadedFiles, setUploadedFiles] = useState({
    schema: !!project?.schemaUrl,
    responses: !!project?.responsesUrl
  });

  const [selectedFiles, setSelectedFiles] = useState<{
    schema: File | null;
    responses: File | null;
  }>({ schema: null, responses: null });

  const [logoFile, setLogoFile] = useState<File | null>(null);

  // Delete Flags
  const [filesToDelete, setFilesToDelete] = useState({
    schema: false,
    responses: false
  });

  const [formData, setFormData] = useState<Partial<Project>>({
    name: '',
    venue: '',
    location: '',
    country: '',
    dates: '',
    year: new Date().getFullYear().toString(),
    promoter: 'Eventcore',
    logoUrl: ''
  });

  useEffect(() => {
    if (project) {
        // Attempt to split location if country isn't set (backward compatibility)
        let loc = project.location || '';
        let country = project.country || '';
        
        if (!country && loc.includes('•')) {
           const parts = loc.split('•');
           loc = parts[0].trim();
           country = parts[1].trim();
        }

        setFormData({
            name: project.name || '',
            venue: project.venue || '',
            location: loc,
            country: country,
            dates: project.dates || '',
            year: project.year || '',
            promoter: project.promoter || 'Eventcore',
            logoUrl: project.logoUrl || ''
        });
        
        // Update file presence indicators based on project data
        setUploadedFiles({
            schema: !!project.schemaUrl,
            responses: !!project.responsesUrl
        });
    }
  }, [project]);

  // Load surveys when switching to Qualtrics mode
  useEffect(() => {
      if (importMode === 'qualtrics' && surveys.length === 0) {
          loadSurveys();
      }
  }, [importMode]);

  const loadSurveys = async () => {
      setLoadingSurveys(true);
      try {
          const list = await listSurveys();
          setSurveys(list);
      } catch (e) {
          console.error("Failed to load surveys", e);
      } finally {
          setLoadingSurveys(false);
      }
  };

  const handleQualtricsImport = async (survey: QualtricsSurvey) => {
      setImportingId(survey.id);
      try {
          const { metadata, schemaFile, responsesFile } = await importSurveyData(survey.id, survey.name);
          
          // Construct the final data object
          const finalData = { ...formData, ...metadata };
          
          // Update local state (for visual completeness if errors occur later)
          setFormData(finalData);
          setSelectedFiles({ schema: schemaFile, responses: responsesFile });
          setUploadedFiles({ schema: true, responses: true });
          setFilesToDelete({ schema: false, responses: false }); // Reset delete flags
          
          // Automatically trigger save flow
          await handleSaveInternal(finalData, schemaFile, responsesFile);
          
      } catch (e) {
          console.error("Import failed", e);
          alert("Failed to import from Qualtrics. See console.");
      } finally {
          setImportingId(null);
      }
  };

  // Helper to process AI results and split location/country
  const processAndSetAiData = (data: Partial<Project>) => {
      let loc = data.location || '';
      let country = '';
      if (loc.includes('•')) {
          const parts = loc.split('•');
          loc = parts[0].trim();
          country = parts[1].trim();
      } else if (loc.includes(',')) {
          // Simple heuristic: last part is country
          const parts = loc.split(',');
          country = parts.pop()?.trim() || '';
          loc = parts.join(',').trim();
      }
      
      setFormData(prev => ({ 
          ...prev, 
          ...data,
          location: loc,
          country: country 
      }));
  };

  const handleAutoRetrieve = async () => {
    if (!url) return;
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const data = await analyzeEventContext(url);
      processAndSetAiData(data);
    } catch (e: any) {
      console.error("Analysis Failed", e);
      setAnalysisError("Failed to extract details. Please try again or fill manually.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileClick = (type: 'schema' | 'responses') => {
    // Prevent opening file dialog if a file is already uploaded/synced. User must delete first.
    if (uploadedFiles[type]) return;

    if (type === 'schema') schemaInputRef.current?.click();
    if (type === 'responses') responsesInputRef.current?.click();
  };

  const handleFileDelete = (e: React.MouseEvent, type: 'schema' | 'responses') => {
    e.stopPropagation();
    setUploadedFiles(prev => ({ ...prev, [type]: false }));
    setSelectedFiles(prev => ({ ...prev, [type]: null }));
    setFilesToDelete(prev => ({ ...prev, [type]: true }));
    
    // Reset the input value so the same file can be selected again if needed
    if (type === 'schema' && schemaInputRef.current) schemaInputRef.current.value = '';
    if (type === 'responses' && responsesInputRef.current) responsesInputRef.current.value = '';
  };

  const handleViewFile = (e: React.MouseEvent, type: 'schema' | 'responses') => {
      e.stopPropagation();
      const url = type === 'schema' ? project?.schemaUrl : project?.responsesUrl;
      if (url) {
          window.open(url, '_blank');
      }
  };

  const handleFileChange = async (type: 'schema' | 'responses', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFiles(prev => ({ ...prev, [type]: file }));
      setUploadedFiles(prev => ({ ...prev, [type]: true }));
      setFilesToDelete(prev => ({ ...prev, [type]: false })); // We are uploading, so don't delete

      // Auto-Fill Logic: If name is empty, try to extract from filename and run AI
      if (!formData.name) {
         const potentialName = extractProjectNameFromFilename(file.name);
         if (potentialName && potentialName.length > 2) {
             // Set name immediately for UX
             setFormData(prev => ({ ...prev, name: potentialName }));
             
             // Trigger AI Analysis in background
             setAnalyzing(true);
             try {
                const aiData = await analyzeEventContext(potentialName);
                processAndSetAiData(aiData);
             } catch (err) {
                 console.warn("Auto-fill from filename failed", err);
                 // Silent fail is okay here, user can fill manually
             } finally {
                 setAnalyzing(false);
             }
         }
      }
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, logoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const parseCsvFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data),
        error: (error) => reject(error)
      });
    });
  };

  const handleSaveInternal = async (
    dataToSave: Partial<Project>, 
    schemaFile: File | null, 
    responsesFile: File | null
  ) => {
    setSaving(true);
    setProgress({ stage: 'Initializing...', percent: 0 });
    try {
        let schemaData: any[] = [];
        let responsesData: any[] = [];
        let extractedMetrics: ProjectMetrics | undefined;

        if (schemaFile) {
            setProgress({ stage: 'Parsing Schema CSV...', percent: 10 });
            schemaData = await parseCsvFile(schemaFile);
        }

        if (responsesFile) {
            setProgress({ stage: 'Parsing Responses CSV...', percent: 20 });
            responsesData = await parseCsvFile(responsesFile);

            // Extract Snapshot Metrics immediately after parsing
            setProgress({ stage: 'Extracting Workspace Metrics...', percent: 25 });
            extractedMetrics = extractProjectMetrics(responsesData);
        }
        
        setProgress({ stage: 'Starting Uploads...', percent: 30 });

        // Project Name Fallback Logic (For Qualtrics Auto-Import)
        // If the user hasn't edited the name, and we are importing, ensure we have a name.
        let finalName = dataToSave.name || '';
        if (!finalName && importMode === 'qualtrics' && importingId) {
             const foundSurvey = surveys.find(s => s.id === importingId);
             if (foundSurvey) finalName = foundSurvey.name;
        }
        
        // Recombine data
        const finalData = { 
            ...dataToSave,
            name: finalName,
            metrics: extractedMetrics // Attach the calculated snapshots
        };

        // Legacy composite handling if needed
        if (finalData.location && finalData.country) {
            // Optional legacy logic
        }

        await onSave(
            finalData, 
            schemaData, 
            responsesData, 
            schemaFile, 
            responsesFile,
            filesToDelete.schema,
            filesToDelete.responses,
            logoFile,
            (stage, percent) => setProgress({ stage, percent })
        );
    } catch (e) {
        console.error("Error processing files", e);
        alert("Failed to process initialization. Please check CSV format.");
    } finally {
        setSaving(false);
        setProgress(null);
    }
  };

  const handleDeleteClick = async () => {
      if (!onDelete) {
          console.error("onDelete function is not defined");
          return;
      }

      if (!project?.id) {
          console.error("Project ID is missing", project);
          alert("Error: Cannot delete this project because its ID is missing.");
          return;
      }
      
      if (window.confirm(`Are you sure you want to delete "${project.name}" entirely? This action cannot be undone.`)) {
          setSaving(true);
          try {
              await onDelete(project.id);
          } catch (e) {
              console.error("Delete failed in modal catch:", e);
              setSaving(false);
          }
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
       <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
       
       <div className="relative bg-white dark:bg-slate-900 w-full max-w-3xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh] transition-colors">
          <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
             <div>
                <h3 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {isEditing ? `Edit Hub: ${formData.name || 'Project'}` : 'Hub Initialization'}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Configure project metadata and required dataset association.</p>
             </div>
             <button onClick={onClose} className="p-3 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"><X className="w-5 h-5 text-slate-400 dark:text-slate-500" /></button>
          </div>

          <div className="p-8 overflow-y-auto custom-scrollbar space-y-10">
             {/* Logo & AI/Qualtrics Section */}
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="flex flex-col items-center gap-3">
                   <div 
                      onClick={() => logoInputRef.current?.click()}
                      className="w-32 h-32 bg-slate-50 dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center p-6 relative overflow-hidden group cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                   >
                       {formData.logoUrl ? (
                           <img src={formData.logoUrl} className="max-h-full max-w-full object-contain" alt="Logo Preview" />
                       ) : (
                           <ImageIcon className="w-10 h-10 text-slate-200 dark:text-slate-600" />
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
                   <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Branding Logo</p>
                </div>

                <div className="md:col-span-2 bg-blue-50 dark:bg-blue-900/20 rounded-3xl p-6 border border-blue-100 dark:border-blue-800/50 flex flex-col relative overflow-hidden">
                   {/* Tabs */}
                   <div className="flex items-center gap-4 mb-4 border-b border-blue-100 dark:border-blue-800/50 pb-2">
                      <button 
                        onClick={() => setImportMode('ai')}
                        className={`text-xs font-bold uppercase tracking-wide pb-1 transition-colors flex items-center gap-2 ${importMode === 'ai' ? 'text-blue-700 dark:text-blue-400' : 'text-blue-300 dark:text-blue-500 hover:text-blue-500 dark:hover:text-blue-400'}`}
                      >
                         <Sparkles className="w-3.5 h-3.5" /> AI Auto-Fill
                      </button>
                      <button 
                        onClick={() => setImportMode('qualtrics')}
                        className={`text-xs font-bold uppercase tracking-wide pb-1 transition-colors flex items-center gap-2 ${importMode === 'qualtrics' ? 'text-blue-700 dark:text-blue-400' : 'text-blue-300 dark:text-blue-500 hover:text-blue-500 dark:hover:text-blue-400'}`}
                      >
                         <RefreshCw className="w-3.5 h-3.5" /> Qualtrics Import
                      </button>
                   </div>
                   
                   {/* Content */}
                   {importMode === 'ai' ? (
                     <div className="animate-in fade-in duration-300">
                         <div className="flex gap-2">
                            <div className="relative flex-1">
                              <LinkIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-blue-300 dark:text-blue-500" />
                              <input 
                                type="text" 
                                placeholder="Paste URL or Event Name..."
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAutoRetrieve()}
                                className="w-full pl-9 pr-4 py-3 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-sm dark:text-white dark:placeholder-slate-500"
                              />
                            </div>
                            <button onClick={handleAutoRetrieve} disabled={analyzing} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-md hover:bg-blue-700 transition-all flex items-center gap-2">
                               {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Auto Fill"}
                            </button>
                         </div>
                         <div className="flex items-center justify-between mt-3">
                            <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-tight">AI will extract name, venue, promoter, and suggest the logo.</p>
                            {analysisError && <span className="text-[10px] text-red-500 font-bold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {analysisError}</span>}
                         </div>
                     </div>
                   ) : (
                     <div className="animate-in fade-in duration-300 h-[100px]">
                        {loadingSurveys ? (
                            <div className="flex items-center justify-center h-full text-blue-400 gap-2">
                                <Loader2 className="w-5 h-5 animate-spin" /> <span className="text-xs font-bold">Connecting to Qualtrics...</span>
                            </div>
                        ) : surveys.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-blue-400">
                                <p className="text-xs font-bold">No active surveys found.</p>
                                <button onClick={loadSurveys} className="mt-1 underline text-[10px]">Retry</button>
                            </div>
                        ) : (
                            <div className="overflow-y-auto custom-scrollbar h-full pr-2 space-y-2">
                                {surveys.map(s => (
                                    <div key={s.id} className="flex items-center justify-between bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-blue-100 dark:border-blue-800 hover:border-blue-300 transition-colors shadow-sm">
                                        <div className="truncate pr-2">
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{s.name}</p>
                                            <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{s.id}</p>
                                        </div>
                                        <button 
                                            onClick={() => handleQualtricsImport(s)}
                                            disabled={!!importingId}
                                            className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-blue-600 hover:text-white transition-all flex items-center gap-1"
                                        >
                                            {importingId === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <DownloadCloud className="w-3 h-3" />}
                                            {importingId === s.id ? 'Importing' : 'Import'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                     </div>
                   )}
                </div>
             </div>

             {/* Basic Info Grid */}
             <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                <div className="col-span-2">
                   <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-1">Project Name</label>
                   <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} placeholder="e.g. US Open Tennis" className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 transition-all text-sm font-bold dark:text-white dark:placeholder-slate-500" />
                </div>
                <div>
                   <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-1">Promoter / Sponsor</label>
                   <input type="text" value={formData.promoter} onChange={(e) => setFormData({...formData, promoter: e.target.value})} placeholder="e.g. USTA Billie Jean King" className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 transition-all text-sm dark:text-white dark:placeholder-slate-500" />
                </div>
                <div>
                   <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-1">Venue</label>
                   <input type="text" value={formData.venue} onChange={(e) => setFormData({...formData, venue: e.target.value})} placeholder="e.g. Arthur Ashe Stadium" className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 transition-all text-sm dark:text-white dark:placeholder-slate-500" />
                </div>
                
                {/* Updated Location Inputs */}
                <div>
                   <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-1">Location (City)</label>
                   <input type="text" value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} placeholder="e.g. New York, NY" className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 transition-all text-sm dark:text-white dark:placeholder-slate-500" />
                </div>
                <div>
                   <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-1">Country</label>
                   <input type="text" value={formData.country} onChange={(e) => setFormData({...formData, country: e.target.value})} placeholder="e.g. USA" className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 transition-all text-sm dark:text-white dark:placeholder-slate-500" />
                </div>

                {/* Updated Date/Year Inputs */}
                <div>
                   <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-1">Event Year</label>
                   <input type="number" value={formData.year} onChange={(e) => setFormData({...formData, year: e.target.value})} placeholder="e.g. 2025" className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 transition-all text-sm font-bold dark:text-white dark:placeholder-slate-500" />
                </div>
                <div>
                   <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-1">Dates (JAN 15 - 18)</label>
                   <input type="text" value={formData.dates} onChange={(e) => setFormData({...formData, dates: e.target.value})} placeholder="e.g. AUG 25 - SEP 08" className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 transition-all text-sm font-mono dark:text-white dark:placeholder-slate-500" />
                </div>

                <div className="col-span-2">
                   <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-1">Logo URL (Manual Override)</label>
                   <input 
                      type="text" 
                      value={formData.logoUrl} 
                      onChange={(e) => {
                         setFormData({...formData, logoUrl: e.target.value});
                         setLogoFile(null); // Clear file on manual entry
                      }} 
                      placeholder="https://domain.com/logo.png" 
                      className="w-full px-5 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-2xl outline-none focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-blue-500 transition-all text-xs dark:text-white dark:placeholder-slate-500" 
                   />
                </div>
             </div>

             {/* Dataset Uploads */}
             <div className="pt-10 border-t border-slate-100 dark:border-slate-800">
                <h5 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-5 flex items-center gap-2">
                   <FileSpreadsheet className="w-4 h-4" /> Required Datasets
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {/* Schema Upload */}
                   <div onClick={() => handleFileClick('schema')} className={`p-6 border-2 border-dashed rounded-[24px] flex flex-col gap-3 transition-all relative ${uploadedFiles.schema ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 cursor-default' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer'}`}>
                      <input 
                        type="file" 
                        ref={schemaInputRef} 
                        onChange={(e) => handleFileChange('schema', e)} 
                        accept=".csv" 
                        className="hidden" 
                      />
                      {uploadedFiles.schema && (
                        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                            {project?.schemaUrl && (
                                <button
                                    onClick={(e) => handleViewFile(e, 'schema')}
                                    className="p-2 bg-white dark:bg-slate-800 rounded-full shadow-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-400 hover:text-blue-500 transition-colors"
                                    title="View/Download CSV"
                                >
                                    <Eye className="w-4 h-4" />
                                </button>
                            )}
                            <button 
                                onClick={(e) => handleFileDelete(e, 'schema')} 
                                className="p-2 bg-white dark:bg-slate-800 rounded-full shadow-sm hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 transition-colors"
                                title="Remove file to update"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                         <div className={`p-2.5 rounded-xl ${uploadedFiles.schema ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-300 dark:text-slate-600'}`}>
                            {uploadedFiles.schema ? <FileCheck className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
                         </div>
                         <span className={`text-[8px] font-bold uppercase border px-2 py-0.5 rounded-full flex items-center gap-1 ${uploadedFiles.schema ? 'text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 border-blue-100 dark:border-blue-800' : 'text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}>
                            {uploadedFiles.schema ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />} {uploadedFiles.schema ? 'Ready' : 'Missing'}
                         </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                            <p className={`text-xs font-bold ${uploadedFiles.schema ? 'text-blue-900 dark:text-blue-100' : 'text-slate-400 dark:text-slate-500'}`}>Schema CSV</p>
                            {(selectedFiles.schema?.size || project?.schemaSize) && (
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-800 font-mono">
                                    {formatFileSize(selectedFiles.schema?.size || project?.schemaSize)}
                                </span>
                            )}
                        </div>
                        <p className={`text-[10px] font-bold uppercase tracking-tight mt-1 ${uploadedFiles.schema ? 'text-blue-500 dark:text-blue-400' : 'text-slate-400 dark:text-slate-600'} truncate pr-16`}>
                          {selectedFiles.schema ? selectedFiles.schema.name : (uploadedFiles.schema ? (project?.schemaUrl ? 'Synced in Cloud' : `Q_${formData.name || 'Project'}.csv`) : `Pattern: Q_${formData.name || 'Project'}.csv`)}
                        </p>
                      </div>
                   </div>

                   {/* Responses Upload */}
                   <div onClick={() => handleFileClick('responses')} className={`p-6 border-2 border-dashed rounded-[24px] flex flex-col gap-3 transition-all relative ${uploadedFiles.responses ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 cursor-default' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer'}`}>
                      <input 
                        type="file" 
                        ref={responsesInputRef} 
                        onChange={(e) => handleFileChange('responses', e)} 
                        accept=".csv" 
                        className="hidden" 
                      />
                      {uploadedFiles.responses && (
                        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                            {project?.responsesUrl && (
                                <button
                                    onClick={(e) => handleViewFile(e, 'responses')}
                                    className="p-2 bg-white dark:bg-slate-800 rounded-full shadow-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-400 hover:text-blue-500 transition-colors"
                                    title="View/Download CSV"
                                >
                                    <Eye className="w-4 h-4" />
                                </button>
                            )}
                            <button 
                                onClick={(e) => handleFileDelete(e, 'responses')} 
                                className="p-2 bg-white dark:bg-slate-800 rounded-full shadow-sm hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500 transition-colors"
                                title="Remove file to update"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                         <div className={`p-2.5 rounded-xl ${uploadedFiles.responses ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm' : 'bg-white dark:bg-slate-900 text-slate-300 dark:text-slate-600'}`}>
                            {uploadedFiles.responses ? <FileCheck className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
                         </div>
                         <span className={`text-[8px] font-bold uppercase border px-2 py-0.5 rounded-full flex items-center gap-1 ${uploadedFiles.responses ? 'text-blue-600 dark:text-blue-400 bg-white dark:bg-slate-900 border-blue-100 dark:border-blue-800' : 'text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'}`}>
                            {uploadedFiles.responses ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />} {uploadedFiles.responses ? 'Ready' : 'Missing'}
                         </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                            <p className={`text-xs font-bold ${uploadedFiles.responses ? 'text-blue-900 dark:text-blue-100' : 'text-slate-400 dark:text-slate-500'}`}>Responses CSV</p>
                            {(selectedFiles.responses?.size || project?.responsesSize) && (
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-800 font-mono">
                                    {formatFileSize(selectedFiles.responses?.size || project?.responsesSize)}
                                </span>
                            )}
                        </div>
                        <p className={`text-[10px] font-bold uppercase tracking-tight mt-1 ${uploadedFiles.responses ? 'text-blue-500 dark:text-blue-400' : 'text-slate-400 dark:text-slate-600'} truncate pr-16`}>
                          {selectedFiles.responses ? selectedFiles.responses.name : (uploadedFiles.responses ? (project?.responsesUrl ? 'Synced in Cloud' : `RawData_${formData.name || 'Project'}.csv`) : `Pattern: RawData_${formData.name || 'Project'}.csv`)}
                        </p>
                      </div>
                   </div>
                </div>
             </div>
          </div>

          <div className="p-8 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
             <div>
                {isEditing && (
                    <button 
                        type="button"
                        onClick={handleDeleteClick}
                        disabled={saving}
                        className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-xl font-bold text-xs hover:bg-red-100 dark:hover:bg-red-900/20 transition-all active:scale-95"
                    >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Delete Project
                    </button>
                )}
             </div>
             
             <div className="flex items-center gap-4">
                <button onClick={onClose} disabled={saving} className="px-8 py-3 text-sm font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors">Discard</button>
                <button 
                onClick={() => handleSaveInternal(formData, selectedFiles.schema, selectedFiles.responses)}
                disabled={saving}
                className={`px-12 py-4 rounded-2xl font-bold shadow-xl transition-all flex items-center gap-2 ${saving ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed shadow-none min-w-[200px] justify-center' : 'bg-blue-600 text-white shadow-blue-500/30 hover:bg-blue-700 hover:scale-105 active:scale-95'}`}
                >
                    {saving ? (
                    <div className="flex items-center gap-3">
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                        {progress ? (
                            <div className="flex flex-col items-start w-full">
                                <span className="text-[10px] uppercase font-bold tracking-widest leading-none mb-1.5">{progress.stage}</span>
                                <div className="w-32 h-1 bg-slate-400/20 rounded-full overflow-hidden">
                                    <div className="h-full bg-slate-400 dark:bg-slate-500 transition-all duration-300" style={{ width: `${progress.percent}%` }}></div>
                                </div>
                            </div>
                        ) : (
                            <span>Processing...</span>
                        )}
                    </div>
                    ) : (
                    <>
                        {isEditing ? 'Save Changes' : 'Initialize Hub'} 
                        <ArrowRight className="w-4 h-4" />
                    </>
                    )} 
                </button>
             </div>
          </div>
       </div>
    </div>
  );
};

export default ProjectModal;