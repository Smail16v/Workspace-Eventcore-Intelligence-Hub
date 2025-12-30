import React, { useState, useEffect, useMemo } from 'react';
import { Search, Loader2, Printer, EyeOff, Table as TableIcon, BarChart2, FileText } from 'lucide-react';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { Project, QuestionDef, SurveyResponse, FilterState, DashboardViewMode } from '../types';
import { parseSchemaCsv, parseResponsesCsv, normalizeData, filterData, formatDisplayId } from '../services/parser';
import { QuestionCard } from './QuestionCard';
import { ToplineSummary } from './ToplineSummary';

interface Props { project: Project; onBack: () => void; readOnly?: boolean; }

const ProjectDashboard: React.FC<Props> = ({ project, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<QuestionDef[]>([]);
  const [normalizedData, setNormalizedData] = useState<SurveyResponse[]>([]);
  const [filters, setFilters] = useState<FilterState>({});
  const [viewMode, setViewMode] = useState<DashboardViewMode>('topline');
  const [cardViewMode, setCardViewMode] = useState<'chart' | 'table'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [surveyTitle, setSurveyTitle] = useState(project.name);

  // BRANDING LOGIC
  const branding = useMemo(() => {
    const n = project.name.toLowerCase();
    if (n.includes('fedex')) return { icon: 'text-purple-600', accent: 'bg-purple-600' };
    if (n.includes('players')) return { icon: 'text-yellow-600', accent: 'bg-yellow-600' };
    return { icon: 'text-blue-600', accent: 'bg-blue-600' };
  }, [project.name]);

  useEffect(() => {
    async function loadData() {
      if (!project.schemaUrl || !project.responsesUrl) return;
      try {
        setLoading(true);
        const [sRes, rRes] = await Promise.all([fetch(project.schemaUrl), fetch(project.responsesUrl)]);
        const [sText, rText] = await Promise.all([sRes.text(), rRes.text()]);
        const qs = await parseSchemaCsv(sText);
        setQuestions(qs);
        setNormalizedData(normalizeData(await parseResponsesCsv(rText), qs));
      } catch (e) { console.error(e); } finally { setLoading(false); }
    }
    loadData();
  }, [project.id, project.schemaUrl, project.responsesUrl]);

  const filteredData = useMemo(() => filterData(normalizedData, questions, filters), [normalizedData, questions, filters]);
  
  const displayedQuestions = useMemo(() => {
    if (!searchQuery) return questions;
    const term = searchQuery.toLowerCase();
    return questions.filter(q => q.id.toLowerCase().includes(term) || q.text.toLowerCase().includes(term));
  }, [questions, searchQuery]);

  // PII SCRUBBING
  const rawTableData = useMemo(() => {
    if (filteredData.length === 0) return { headers: [], rows: [] };
    const metadataHeaders = ['ResponseId', 'StartDate', 'Duration (in seconds)'];
    const safeQuestions = questions.filter(q => !/name|email|phone|contact|address/i.test(q.text + q.id));
    const headers = [...metadataHeaders, ...safeQuestions.map(q => q.id)];
    const rows = filteredData.slice(0, 50).map(resp => {
        const row: any = {};
        headers.forEach(h => row[h] = resp[h] || '-');
        return row;
    });
    return { headers, rows };
  }, [filteredData, questions]);

  const handleToggleFilter = (qId: string, value: string) => {
    setFilters(prev => {
        const current = prev[qId] || [];
        const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
        const updated = { ...prev, [qId]: next };
        if (next.length === 0) delete updated[qId];
        return updated;
    });
  };

  // ADVANCED PDF EXPORT
  const handlePrint = () => {
    const element = document.getElementById('report-content');
    const opt = { 
      margin: 10, 
      filename: `${project.name}_Report.pdf`, 
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 }, 
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
    };
    html2pdf().set(opt).from(element).save();
  };

  if (loading) return (
    <div className="h-screen bg-white dark:bg-[#131314] flex flex-col items-center justify-center text-blue-500">
      <Loader2 className="animate-spin w-12 h-12 mb-4" />
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading Analytical Engine...</p>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#E5E5E6] dark:bg-[#131314] overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-64 bg-white dark:bg-[#1e1f20] border-r dark:border-[#3c4043] flex flex-col hidden lg:flex">
        <div className="p-6 border-b dark:border-[#3c4043]">
          <img src={project.logoUrl || "https://picsum.photos/150/150"} className="h-8 mb-4 object-contain mx-auto" alt="Logo" />
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 text-center">Question Navigator</p>
          <div className="relative">
            <Search className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Jump to..." 
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-[#131314] rounded-lg text-[10px] outline-none border dark:border-[#3c4043] dark:text-white" 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
          {displayedQuestions.map(q => (
            <button 
              key={q.id} 
              onClick={() => document.getElementById(`q-${q.id}`)?.scrollIntoView({ behavior: 'smooth' })} 
              className="w-full text-left p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-[#3c4043] text-[11px] truncate group transition-colors"
            >
              <span className={`font-bold mr-2 ${branding.icon}`}>{formatDisplayId(q.id)}</span>
              <span className="text-slate-500 truncate group-hover:text-slate-900 dark:group-hover:text-white">{q.text}</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* HEADER TABS */}
        <header className="h-16 bg-white dark:bg-[#1e1f20] border-b dark:border-[#3c4043] flex items-center px-6 justify-between shrink-0 z-30 shadow-sm transition-colors">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="text-xs font-bold text-blue-600 uppercase tracking-widest hover:underline">← BACK</button>
            <div className="h-6 w-px bg-slate-200 dark:bg-[#3c4043]" />
            <div className="flex bg-slate-100 dark:bg-[#131314] p-1 rounded-xl">
              {(['topline', 'raw', 'schema'] as const).map(tab => (
                <button 
                  key={tab} 
                  onClick={() => setViewMode(tab)} 
                  className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${viewMode === tab ? 'bg-white dark:bg-[#3c4043] text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
             {viewMode === 'topline' && (
                <div className="flex bg-slate-100 dark:bg-[#131314] p-1 rounded-xl">
                  <button onClick={() => setCardViewMode('chart')} className={`p-1.5 rounded-lg transition-colors ${cardViewMode === 'chart' ? 'bg-white dark:bg-[#3c4043] shadow text-blue-600' : 'text-slate-400'}`}><BarChart2 className="w-4 h-4" /></button>
                  <button onClick={() => setCardViewMode('table')} className={`p-1.5 rounded-lg transition-colors ${cardViewMode === 'table' ? 'bg-white dark:bg-[#3c4043] shadow text-blue-600' : 'text-slate-400'}`}><TableIcon className="w-4 h-4" /></button>
                </div>
             )}
             <button onClick={handlePrint} className="p-2 text-slate-400 hover:text-blue-600 transition-colors" title="Export as PDF"><Printer className="w-4 h-4" /></button>
          </div>
        </header>

        <div id="report-content" className="flex-1 overflow-y-auto p-10 space-y-8 bg-[#E5E5E6] dark:bg-[#131314] custom-scrollbar">
          {viewMode === 'topline' ? (
            <>
              <ToplineSummary 
                surveyTitle={surveyTitle} onTitleChange={setSurveyTitle} year={project.year} dateRange={project.dates}
                respondentCount={filteredData.length} totalCount={normalizedData.length}
                avgDuration={project.metrics?.avgDuration || '0m'} avgEngagement={project.metrics?.engagement || '0Qs'}
                questionCount={questions.length} activeFilters={filters} 
              />
              {displayedQuestions.map(q => (
                <div key={q.id} id={`q-${q.id}`} className="scroll-mt-24">
                  <QuestionCard 
                    question={q} 
                    data={filteredData} 
                    activeFilters={filters[q.id] || []} 
                    onToggleFilter={(val) => handleToggleFilter(q.id, val)} 
                    allQuestions={questions} 
                    defaultViewMode={cardViewMode} 
                  />
                </div>
              ))}
            </>
          ) : viewMode === 'raw' ? (
            <div className="bg-white dark:bg-[#1e1f20] rounded-[32px] border dark:border-[#3c4043] overflow-hidden shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500 transition-colors">
               <div className="p-6 border-b dark:border-[#3c4043] flex justify-between items-center bg-slate-50/50 dark:bg-[#1e1f20]">
                  <h3 className="font-bold flex items-center gap-2 text-sm dark:text-white"><EyeOff className="w-4 h-4 text-brand-600" /> PII-Scrubbed Records</h3>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Displaying first 50 Rows</span>
               </div>
               <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-[10px] text-left border-collapse">
                     <thead className="bg-slate-50/50 dark:bg-[#131314] text-slate-500 uppercase font-bold border-b dark:border-[#3c4043]">
                        <tr>{rawTableData.headers.map(h => <th key={h} className="px-4 py-3 whitespace-nowrap">{h}</th>)}</tr>
                     </thead>
                     <tbody className="divide-y dark:divide-[#3c4043]">
                        {rawTableData.rows.map((row, i) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-[#131314] transition-colors">
                            {rawTableData.headers.map(h => <td key={h} className="px-4 py-3 dark:text-slate-300 font-mono">{row[h]}</td>)}
                          </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
          ) : (
             <div className="bg-white dark:bg-[#1e1f20] rounded-[32px] border dark:border-[#3c4043] p-8 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500 transition-colors">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-6 dark:text-white"><FileText className="w-5 h-5 text-blue-600" /> Survey Schema Definition</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                    <thead className="border-b dark:border-[#3c4043]"><tr className="text-slate-400 uppercase font-bold text-[10px]"><th className="pb-3">ID</th><th className="pb-3">Type</th><th className="pb-3">Question Text</th></tr></thead>
                    <tbody className="divide-y dark:divide-[#3c4043]">
                        {questions.map(q => (
                            <tr key={q.id} className="dark:text-slate-300 hover:bg-slate-50/50 dark:hover:bg-[#131314] transition-colors">
                                <td className="py-4 font-bold text-blue-600">{q.id}</td>
                                <td className="py-4 uppercase text-[10px] font-bold">{q.type}</td>
                                <td className="py-4">{q.text}</td>
                            </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
             </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ProjectDashboard;