import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Sparkles, Loader2, Info, RotateCcw, AlignLeft, AlertCircle, Gift, Trophy, User, MapPin, Mail, Phone, ListOrdered, Medal, Activity, BarChart2, Table, Download, Copy, Check, ThumbsUp, ThumbsDown, Minus, Globe, Maximize, Minimize } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Papa from 'papaparse';
import Highcharts from 'highcharts';
import HighchartsMap from 'highcharts/modules/map';
import HighchartsTiledWebMap from 'highcharts/modules/tiledwebmap';
import { QuestionDef, SurveyResponse } from '../types';
import { formatDisplayId } from '../services/parser';
import { calculateMean, analyzeOption, detectCurrency, formatCurrency, calculateMeanFromMap } from '../services/analytics';
import { getSemanticValues, analyzeTextResponses, analyzeZipCodes, resolveLocations, TextAnalysisResult, getGeoCoordinates, GeoCoordinate } from '../services/ai';

interface Props {
  question: QuestionDef;
  data: SurveyResponse[];
  activeFilters: string[];
  onToggleFilter: (value: string) => void;
  allQuestions: QuestionDef[];
  defaultViewMode?: 'chart' | 'table';
}

interface Winner {
    name: string;
    email?: string;
    phone?: string;
    age?: string;
    gender?: string;
    zip?: string;
    location?: string;
}

const COLORS = {
    brand: '#3b82f6',
    success: '#22c55e',
    warning: '#eab308',
    danger: '#ef4444',
    passive: '#cbd5e1',
    hover: '#2563eb'
};

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 shadow-xl rounded-lg text-xs">
          <p className="font-bold text-slate-800 dark:text-slate-100 mb-1">{label}</p>
          <p className="text-brand-600 dark:text-brand-400 font-mono">Count: {payload[0].value}</p>
          <p className="text-slate-500 dark:text-slate-400">
             {payload[0].payload.pct}%
          </p>
        </div>
      );
    }
    return null;
  };

// Geo Cache to prevent redundant fetches within session
const geoCache: Record<string, {lat: number, lon: number, locationName: string}> = {};

export const QuestionCard: React.FC<Props> = ({ question, data, activeFilters, onToggleFilter, allQuestions, defaultViewMode = 'table' }) => {
  const { id, text, type, choices, rows, columns, block } = question;
  const lowerType = type.toLowerCase();
  
  // States for View Mode
  const [viewMode, setViewMode] = useState<'chart' | 'table' | 'map'>('table');
  const [copied, setCopied] = useState(false);

  // Sync with prop change (global toggle)
  useEffect(() => {
    if (defaultViewMode && (defaultViewMode === 'chart' || defaultViewMode === 'table')) {
        setViewMode(defaultViewMode);
    }
  }, [defaultViewMode]);

  // States for AI Scale Mapping
  const [aiMap, setAiMap] = useState<Record<string, number> | null>(null);
  const [showAiDetails, setShowAiDetails] = useState(false);
  
  // States for AI Text Analysis
  const [textAnalysis, setTextAnalysis] = useState<TextAnalysisResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  
  // States for Prize Draw
  const [winners, setWinners] = useState<Winner[]>([]);
  
  // States for Map
  const [mapData, setMapData] = useState<any[] | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Highcharts.Chart | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Auto-dismiss AI Errors to prevent persistent UI clutter
  useEffect(() => {
    if (aiError) {
      const timer = setTimeout(() => {
        setAiError(null);
      }, 3000); // Dismiss after 3 seconds
      return () => clearTimeout(timer);
    }
  }, [aiError]);

  // --- MEMOS ---

  // Detect Ranking Pattern
  const isRanking = useMemo(() => {
     return text.toLowerCase().includes('rank') && (lowerType.includes('multi') || lowerType.includes('matrix'));
  }, [text, lowerType]);

  // Detect Geographic Question
  const isGeographic = useMemo(() => {
      const t = text.toLowerCase();
      const keywords = [
          'geographic', 'residence', 'province', 'territory', 'country', 
          'zip', 'postal', 'state', 'city', 'live in', 'location', 
          'area do you live', 'where do you live', 'region', 'where you live'
      ];
      return keywords.some(k => t.includes(k));
  }, [text]);

  // Enhanced NPS Pattern Detection
  const isNPS = useMemo(() => {
    const options = (lowerType.includes('matrix') ? columns : choices) || [];
    if (options.length !== 11) return false;

    const numericValues = options.map(opt => {
        const match = opt.match(/\d+/);
        return match ? parseInt(match[0], 10) : NaN;
    }).filter(n => !isNaN(n));

    const hasZero = numericValues.includes(0);
    const hasTen = numericValues.includes(10);
    const isSequential = numericValues.length === 11; 
    const structuralFingerprint = isSequential && hasZero && hasTen;
    const hasRecommendKeyword = text.toLowerCase().includes('recommend');

    return structuralFingerprint && hasRecommendKeyword;
  }, [choices, columns, lowerType, text]);

  // Detect if this is a Prize Draw / Contest Entry question
  const isPrizeDraw = useMemo(() => {
    const t = text.toLowerCase();
    const hasKeywords = t.includes('enter') || t.includes('win') || t.includes('drawing') || t.includes('prize') || t.includes('giveaway');
    const hasContactReq = t.includes('name') || t.includes('email') || t.includes('phone') || t.includes('contact');
    const fields = [...(choices || []), ...(rows || [])].join(' ').toLowerCase();
    const hasFieldReq = fields.includes('email') || fields.includes('phone');

    return hasKeywords && (hasContactReq || hasFieldReq);
  }, [text, choices, rows]);

  const stats = useMemo(() => {
    // --- INFO SCREEN HANDLING ---
    if (lowerType === 'info' || lowerType === 'itemselectionlist') {
        return { type: 'info', count: 0 };
    }

    // --- RANKING HANDLING (Virtual Matrix) ---
    if (isRanking) {
        let maxRank = 0;
        const choiceIndices = choices.map((_, i) => i + 1);
        
        data.forEach(resp => {
            choiceIndices.forEach(idx => {
                const rankVal = parseInt(resp[`${id}_${idx}`] || '0', 10);
                if (rankVal > maxRank) maxRank = rankVal;
            });
        });
        
        if (maxRank === 0) maxRank = choices.length;

        const rankCols = Array.from({length: maxRank}, (_, i) => String(i + 1));
        
        const rankingData = choices.map((choiceLabel, i) => {
             const choiceKey = `${id}_${i + 1}`; 
             const counts: Record<string, number> = {};
             rankCols.forEach(c => counts[c] = 0);
             
             let totalRankSum = 0;
             let totalCount = 0;

             data.forEach(resp => {
                 const rank = resp[choiceKey];
                 if (rank && counts[rank] !== undefined) {
                     counts[rank]++;
                     totalCount++;
                     totalRankSum += parseInt(rank, 10);
                 }
             });

             const average = totalCount > 0 ? (totalRankSum / totalCount).toFixed(2) : null;
             return { name: choiceLabel, ...counts, average, total: totalCount };
        });

        return { 
            type: 'matrix', 
            chartData: rankingData, 
            hasAverages: true, 
            total: data.filter(r => choiceIndices.some(idx => r[`${id}_${idx}`])).length,
            isRanking: true,
            columns: rankCols, 
            maxVal: maxRank
        };
    }

    // --- TEXT / VERBATIM HANDLING ---
    // Added 'numeric' to treat Numeric types (like Zip Codes) as Verbatim/Text to enable analysis
    if (lowerType.includes('verbatim') || lowerType.includes('text') || lowerType === 'numeric') {
      let validResponses = data.map(r => r[id]).filter(v => v && v.trim().length > 0);
      
      if (validResponses.length === 0) {
          const childKeys = Object.keys(data[0] || {}).filter(k => k.startsWith(`${id}_`));
          if (childKeys.length > 0) {
              validResponses = data
                .filter(r => childKeys.some(k => r[k] && r[k].trim().length > 0))
                .map(r => childKeys.map(k => r[k]).filter(Boolean).join(' | ')); 
          }
      }

      return { 
          type: 'text', 
          count: validResponses.length,
          responses: validResponses 
      };
    }

    // --- MATRIX HANDLING ---
    if (lowerType.includes('matrix')) {
       const cols = columns || [];
       const isCurrency = detectCurrency(text, cols);
       
       const colValues: Record<string, number | null> = {};
       let maxVal = 0;
       
       cols.forEach(c => {
           if (aiMap && aiMap[c] !== undefined) {
              colValues[c] = aiMap[c];
              if (aiMap[c] > maxVal) maxVal = aiMap[c];
           } else {
              const analysis = analyzeOption(c);
              const val = analysis.isNumeric ? analysis.value : null;
              colValues[c] = val;
              if (analysis.type === 'range_high' && val) {
                  const v = val * 1.2;
                  colValues[c] = v;
                  if (v > maxVal) maxVal = v;
              } else if (val && val > maxVal) {
                  maxVal = val;
              }
           }
       });
       
       if (maxVal === 0) maxVal = 5; 

       const matrixData = (rows || []).map((rowLabel, idx) => {
         const rowId = `${id}_${idx + 1}`;
         const counts: Record<string, number> = {};
         cols.forEach(col => counts[col] = 0);
         
         let rowSum = 0;
         let rowValidCount = 0;
         let rowTotalCount = 0; 

         data.forEach(resp => {
           const val = resp[rowId];
           if (val && counts[val] !== undefined) {
               counts[val]++;
               rowTotalCount++;
               
               const numVal = colValues[val];
               if (numVal !== null) {
                   rowSum += numVal;
                   rowValidCount++;
               }
           }
         });
         
         const meanVal = rowValidCount > 0 ? (rowSum / rowValidCount) : null;
         const average = meanVal !== null ? (isCurrency ? formatCurrency(meanVal) : meanVal.toFixed(2)) : null;
         
         return { name: rowLabel, ...counts, average, total: rowTotalCount };
       });
       
       const hasAverages = matrixData.some(r => r.average !== null);
       
       const rowKeys = (rows || []).map((_, i) => `${id}_${i + 1}`);
       const total = data.filter(r => rowKeys.some(k => r[k] && r[k].trim().length > 0)).length;
       
       return { type: 'matrix', chartData: matrixData, hasAverages, total, columns, maxVal, isRanking: false };
    }

    // --- STANDARD CHART HANDLING (SINGLE/MULTI) ---
    const counts: Record<string, number> = {};
    choices.forEach(c => counts[c] = 0);
    
    let validResponses = 0;
    const isSingle = !lowerType.includes('multi');

    let npsScore = null;
    let npsBreakdown = null;
    let promoters = 0;
    let passives = 0;
    let detractors = 0;

    data.forEach(row => {
        if (!isSingle) {
             const keys = Object.keys(row).filter(k => k.startsWith(id + '_'));
             let found = false;
             if (keys.length > 0) {
                 keys.forEach(k => {
                     const val = row[k];
                     if (val && counts[val] !== undefined) {
                         counts[val]++;
                         found = true;
                     }
                 });
             } else {
                 const val = row[id];
                 if (val) {
                     val.split(',').forEach(v => {
                         const vt = v.trim();
                         if (counts[vt] !== undefined) {
                             counts[vt]++;
                         }
                     });
                     found = true;
                 }
             }
             if (found) validResponses++;
        } else {
            const val = row[id];
            if (val && counts[val] !== undefined) {
                counts[val]++;
                validResponses++;
                
                if (isNPS) {
                    const valClean = val.match(/\d+/)?.[0];
                    const n = parseInt(valClean || val, 10);
                    if (!isNaN(n)) {
                        if (n >= 9) promoters++;
                        else if (n >= 7) passives++;
                        else if (n >= 0) detractors++;
                    }
                }
            }
        }
    });

    if (isNPS && validResponses > 0) {
        npsScore = Math.round(((promoters - detractors) / validResponses) * 100);
        npsBreakdown = {
            promoters: ((promoters / validResponses) * 100).toFixed(1),
            passives: ((passives / validResponses) * 100).toFixed(1),
            detractors: ((detractors / validResponses) * 100).toFixed(1)
        };
    }

    const mean = isSingle 
        ? (aiMap ? calculateMeanFromMap(counts, aiMap, text) : calculateMean(counts, text)) 
        : null;

    const chartData = choices.map((name) => {
        const value = counts[name] || 0;
        return { 
            name, 
            value, 
            pct: validResponses ? ((value / validResponses) * 100).toFixed(1) : 0 
        };
    });

    return { type: 'chart', chartData, total: validResponses, mean, npsScore, npsBreakdown };

  }, [data, id, lowerType, choices, rows, columns, text, aiMap, isRanking, isNPS]);

  // --- HANDLERS ---
  
  const handleAiScaleAnalysis = async () => {
    setIsAiLoading(true);
    setAiError(null);
    const optionsToAnalyze = stats.type === 'matrix' ? (stats.columns || columns || []) : choices;
    const mapping = await getSemanticValues(text, optionsToAnalyze);
    if (mapping) {
        setAiMap(mapping);
        setShowAiDetails(true); 
    } else {
        setAiError("AI unable to determine");
    }
    setIsAiLoading(false);
  };

  const handleDrawWinners = async () => {
      setIsAiLoading(true);
      const candidates: Winner[] = [];
      const ageQ = allQuestions.find(q => /\b(age|how old)\b/i.test(q.text) && (q.type === 'Single' || q.type === 'text'));
      const genderQ = allQuestions.find(q => /\b(gender|sex)\b/i.test(q.text) && (q.type === 'Single' || q.type === 'text'));
      const zipQ = allQuestions.find(q => /\b(zip|postal)\b/i.test(q.text));

      data.forEach(row => {
          const relevantKeys = Object.keys(row).filter(k => k === id || k.startsWith(`${id}_`));
          let name = '';
          let email = '';
          let phone = '';

          relevantKeys.forEach(k => {
              const val = String(row[k] || '').trim();
              if (!val) return;
              const digits = val.replace(/\D/g, '');
              if (val.includes('@') && val.includes('.')) {
                  email = val;
              } else if (digits.length >= 10 && digits.length <= 15) {
                  phone = val;
              } else if (val.length > 2 && !/^\d+$/.test(val)) {
                  if (!name || val.length > name.length) {
                      name = val;
                  }
              }
          });

          const age = ageQ ? row[ageQ.id] : undefined;
          const gender = genderQ ? row[genderQ.id] : undefined;
          const zip = zipQ ? row[zipQ.id] : undefined;

          if (name && (email || phone)) {
              candidates.push({ name, email, phone, age, gender, zip });
          }
      });

      const uniqueCandidates = candidates.filter((v, i, a) => 
          a.findIndex(t => (t.email && t.email === v.email) || (t.phone && t.phone === v.phone)) === i
      );

      const shuffled = [...uniqueCandidates];
      for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      
      const selected = shuffled.slice(0, 3);
      const zipsToResolve = selected.map(w => w.zip).filter(Boolean) as string[];
      let locationMap: Record<string, string> = {};
      
      if (zipsToResolve.length > 0) {
          locationMap = await resolveLocations(zipsToResolve);
      }

      const finalWinners = selected.map(w => ({
          ...w,
          location: w.zip && locationMap[w.zip] ? locationMap[w.zip] : (w.zip || '-')
      }));

      setWinners(finalWinners);
      setIsAiLoading(false);
  };

  const handleAiTextAnalysis = async () => {
    if (stats.type !== 'text' || !stats.responses) return;
    setIsAiLoading(true);
    setAiError(null);
    
    const isZipQuestion = /zip|postal/i.test(text);
    let result: TextAnalysisResult | null = null;

    if (isZipQuestion) {
        const residenceQuestion = allQuestions.find(q => 
            q.id !== id && 
            (q.type === 'Single' || q.type === 'Multi') && 
            (q.choices && q.choices.length > 0) &&
            /(live|residence|county|state|province|country)/i.test(q.text)
        );

        if (residenceQuestion) {
            result = await analyzeZipCodes(
                text, 
                stats.responses, 
                residenceQuestion.choices, 
                residenceQuestion.text
            );
        }
    }

    if (!result) {
        result = await analyzeTextResponses(text, stats.responses, choices);
    }
    
    if (result) {
        setTextAnalysis(result);
        setShowAiDetails(false); 
    } else {
        setAiError("AI analysis failed.");
    }
    setIsAiLoading(false);
  };

  // Helper: Fetch coords for single ZIP using Zippopotam
  const fetchZipCoords = async (zip: string): Promise<{lat: number, lon: number, locationName: string} | null> => {
      // Basic normalization
      let cleanZip = zip.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
      if (!cleanZip) return null;

      // Check Cache
      if (geoCache[cleanZip]) return geoCache[cleanZip];

      let country = 'us';

      // Detect Country based on format
      if (/[A-Z]/.test(cleanZip.charAt(0))) {
          // Canada: A1A...
          // Zippopotam support for Canadian FSAs is unreliable (often returns 404).
          // We intentionally skip it and return null to force the AI fallback mechanism to resolve these.
          return null;
      } else {
          // US: 12345...
          if (cleanZip.length >= 5) {
              cleanZip = cleanZip.substring(0, 5);
          } else {
              return null;
          }
      }

      try {
          // Cache Check again after normalization
          if (geoCache[cleanZip]) return geoCache[cleanZip];

          const res = await fetch(`https://api.zippopotam.us/${country}/${cleanZip}`);
          if (!res.ok) return null;
          const data = await res.json();
          const place = data.places[0];
          const result = {
              lat: parseFloat(place.latitude),
              lon: parseFloat(place.longitude),
              locationName: `${place['place name']}, ${place['state abbreviation']}`
          };
          geoCache[cleanZip] = result;
          return result;
      } catch (e) {
          return null;
      }
  };

  // Handler to generate Map Data
  const handleLoadMap = async () => {
      if (mapData) {
          setViewMode('map');
          return;
      }
      
      setIsAiLoading(true);
      setLoadingMessage('Aggregating location data...');
      setAiError(null);

      // Gather labels to map
      let labelsToMap: { label: string, count: number, pct: string }[] = [];
      
      if (stats.type === 'text' && textAnalysis?.type === 'themes' && textAnalysis.themes) {
          // Map AI themes (e.g. from Zips)
          const total = textAnalysis.themes.reduce((acc, t) => acc + t.count, 0);
          labelsToMap = textAnalysis.themes.map(t => ({ 
              label: t.theme, 
              count: t.count, 
              pct: ((t.count / total) * 100).toFixed(1) + '%' 
          }));
      } else if (stats.chartData) {
          // Map standard chart data
          labelsToMap = stats.chartData.map((d: any) => ({ 
              label: d.name, 
              count: d.value || 0, 
              pct: d.pct + '%'
          })).filter((d: any) => d.count > 0);
      } else if (stats.type === 'text' && isGeographic && stats.responses) {
          // Fallback: Aggregate raw responses for Geographic text questions
          const counts: Record<string, number> = {};
          let totalMapped = 0;
          stats.responses.forEach(r => {
             const val = r.trim();
             if (val.length > 1 && !['n/a', 'none', '.', 'test'].includes(val.toLowerCase())) {
                 const key = val.toUpperCase(); // Normalize for counting
                 counts[key] = (counts[key] || 0) + 1;
                 totalMapped++;
             }
          });
          
          labelsToMap = Object.entries(counts)
             .map(([label, count]) => ({
                 label,
                 count,
                 pct: ((count / totalMapped) * 100).toFixed(1) + '%'
             }))
             .sort((a,b) => b.count - a.count); 
      }

      if (labelsToMap.length === 0) {
          setAiError("No geographic data");
          setIsAiLoading(false);
          return;
      }

      const finalPoints: any[] = [];
      const zipsToFetch: { label: string, count: number, pct: string }[] = [];
      const othersToResolve: { label: string, count: number, pct: string }[] = [];
      
      // Smart Classification Loop
      labelsToMap.forEach(item => {
          if (['other', 'none', 'n/a', 'unknown', 'refused'].includes(item.label.toLowerCase())) return;

          // 1. Try US Zip (5 digits) on raw label first (most restrictive)
          const usMatch = item.label.match(/\b\d{5}(?:-\d{4})?\b/);
          if (usMatch) {
              zipsToFetch.push({ ...item, label: usMatch[0] });
              return;
          }

          // 2. Canadian Postal Code Normalization
          // Remove all non-alphanumeric characters to handle spacing/punctuation variations
          const cleanLabel = item.label.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          
          // Check for full CA code (A1A1A1) or FSA (A1A) in the cleaned string
          const caMatch = cleanLabel.match(/([A-Z]\d[A-Z]\d[A-Z]\d)|([A-Z]\d[A-Z])/);
          if (caMatch) {
               // Prefer full code (group 1) if available, otherwise FSA (group 2)
               zipsToFetch.push({ ...item, label: caMatch[1] || caMatch[2] });
               return;
          }

          othersToResolve.push(item);
      });
      
      // 1. Process ZIPs via Zippopotam (Fast, Client-side)
      if (zipsToFetch.length > 0) {
          setLoadingMessage(`Geocoding ${zipsToFetch.length} postal codes...`);
          // Parallelize in chunks of 50 for speed
          const BATCH_SIZE = 50;
          for (let i = 0; i < zipsToFetch.length; i += BATCH_SIZE) {
               const batch = zipsToFetch.slice(i, i + BATCH_SIZE);
               const results = await Promise.all(batch.map(async (item) => {
                   const coords = await fetchZipCoords(item.label);
                   if (coords) {
                       return {
                           name: coords.locationName, // Resolved City name
                           origLabel: item.label,
                           lat: coords.lat,
                           lon: coords.lon,
                           z: item.count,
                           percentage: item.pct
                       };
                   }
                   // If Zippopotam fails (or was skipped for CA), push to fallback AI list
                   return { failedItem: item };
               }));
               
               results.forEach(r => {
                   if (r && 'lat' in r) {
                       finalPoints.push(r);
                   } else if (r && r.failedItem) {
                       othersToResolve.push(r.failedItem);
                   }
               });
          }
      }

      // 2. Process Others via AI (Fallback) - Only if we have very few ZIPs or specific request
      // Optimization: If Zippopotam failed significantly (or we have many CA codes), allow AI to try to rescue up to 100 items.
      const shouldRunAi = othersToResolve.length > 0 && (finalPoints.length < 5 || othersToResolve.length < 150);

      if (shouldRunAi) {
           setLoadingMessage(`Resolving ${othersToResolve.length} place names...`);
           const othersToMap = othersToResolve.slice(0, 100); // Increased cap to 100 to handle typical Canadian survey volume
           const coordsMap = await getGeoCoordinates(othersToMap.map(l => l.label));
           
           othersToMap.forEach(l => {
               const coord = coordsMap[l.label];
               if (coord) {
                   finalPoints.push({
                      name: l.label,
                      lat: coord.lat,
                      lon: coord.lon,
                      z: l.count,
                      percentage: l.pct
                   });
               }
           });
      }

      if (finalPoints.length > 0) {
          setMapData(finalPoints);
          setViewMode('map');
      } else {
          setAiError("Could not resolve geo");
      }
      setIsAiLoading(false);
      setLoadingMessage('');
  };

  // Init Highcharts when viewMode is map
  useEffect(() => {
    if (viewMode === 'map' && mapData && mapContainerRef.current) {
        
        // Ensure Highcharts Modules are initialized
        // This fixes the "no map" issue if modules weren't applied to the core instance
        try {
            if (!(Highcharts as any).mapChart && (HighchartsMap as any)) {
                (HighchartsMap as any)(Highcharts);
            }
            if (!(Highcharts as any).seriesTypes?.tiledwebmap && (HighchartsTiledWebMap as any)) {
                (HighchartsTiledWebMap as any)(Highcharts);
            }
        } catch (e) {
            console.warn("Highcharts module init warning", e);
        }

        // Calculate data bounds for auto-zoom
        const lats = mapData.map((d: any) => d.lat);
        const lons = mapData.map((d: any) => d.lon);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLon = Math.min(...lons);
        const maxLon = Math.max(...lons);
        
        const centerLat = (minLat + maxLat) / 2;
        const centerLon = (minLon + maxLon) / 2;
        
        // Auto-Zoom Calculation (Heuristic)
        const latSpan = maxLat - minLat;
        const lonSpan = maxLon - minLon;
        const maxSpan = Math.max(latSpan, lonSpan);
        let zoom = 2;
        if (maxSpan < 0.1) zoom = 12;
        else if (maxSpan < 0.5) zoom = 10;
        else if (maxSpan < 2) zoom = 8;
        else if (maxSpan < 5) zoom = 6;
        else if (maxSpan < 20) zoom = 5;
        else if (maxSpan < 50) zoom = 4;
        
        // Color Function based on volume (Script Strategy: Red > Orange > Blue)
        const coloredData = mapData.map((d:any) => {
            let color = '#4575b4'; // Low (Blue)
            if (d.z > 20) color = '#d73027'; // High (Red)
            else if (d.z > 5) color = '#f46d43'; // Med (Orange)
            
            return { ...d, color };
        });

        if (chartRef.current) {
            chartRef.current.destroy();
        }

        const isDark = document.documentElement.classList.contains('dark');

        // Initialize Map with Minimal CartoDB Positron Theme
        chartRef.current = Highcharts.mapChart(mapContainerRef.current as any, {
            chart: { 
                margin: 0,
                animation: true,
                backgroundColor: isFullScreen ? (isDark ? '#0f172a' : '#ffffff') : (isDark ? '#1e293b' : '#f8fafc') 
            },
            title: { text: undefined },
            credits: { enabled: false }, 
            accessibility: { enabled: false }, 
            legend: { 
                enabled: false
            },  
            mapNavigation: { 
                enabled: true, 
                enableDoubleClickZoom: true,
                buttonOptions: { 
                    alignTo: 'spacingBox', 
                    verticalAlign: 'bottom' 
                } 
            },
            mapView: {
                projection: { name: 'WebMercator' }, 
                center: [centerLon, centerLat], 
                zoom: zoom
            },
            tooltip: {
                enabled: false, 
                useHTML: true,
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                borderColor: isDark ? '#334155' : '#e2e8f0',
                borderRadius: 8,
                shadow: true,
                padding: 12,
                headerFormat: '',
                pointFormat: `<div style="font-family:Inter, sans-serif"><span style="font-size:12px; font-weight:700; color:${isDark ? '#e2e8f0' : '#1e293b'}">{point.name}</span><br/><span style="font-size:11px; color:${isDark ? '#94a3b8' : '#64748b'}">Attendees: <b>{point.z}</b></span><br/><span style="font-size:11px; color:#3b82f6; font-weight:600">Share: {point.percentage}</span></div>`
            },
            plotOptions: {
                mapbubble: {
                    minSize: 4,
                    maxSize: 20, 
                    zMin: 0,
                    zMax: Math.max(...mapData.map((d:any) => d.z)),
                    animation: { duration: 1000 },
                    shadow: false,
                    states: {
                        hover: {
                            enabled: false 
                        }
                    },
                    dataLabels: {
                        enabled: false, 
                        allowOverlap: false,
                        useHTML: true,
                        filter: { property: 'z', operator: '>', value: 1 },
                        format: '{point.name}',
                        style: { 
                            fontSize: '9px', 
                            color: '#1e293b', 
                            textOutline: '2px white', 
                            fontWeight: '600',
                            fontFamily: 'Inter'
                        },
                        y: -6 
                    },
                    marker: {
                         fillOpacity: 0.85,
                         lineWidth: 1,
                         lineColor: '#fff',
                         symbol: 'circle'
                    },
                    point: {
                        events: {
                            click: function() {
                                const chart = this.series.chart;
                                if (chart.tooltip) {
                                    chart.tooltip.options.enabled = true;
                                    chart.tooltip.refresh(this);
                                }
                            },
                            mouseOut: function() {
                                const chart = this.series.chart;
                                if (chart.tooltip) {
                                    chart.tooltip.hide();
                                    chart.tooltip.options.enabled = false;
                                }
                            }
                        }
                    }
                } as any
            },
            series: [{
                type: 'tiledwebmap',
                name: 'Basemap',
                provider: {
                    type: 'OpenStreetMap',
                    theme: isDark ? 'Muted' : 'Standard'
                },
                showInLegend: false,
                opacity: 0.6
            }, {
                type: 'mapbubble',
                name: 'Attendees',
                data: coloredData,
                cursor: 'pointer'
            }] as any
        });
    }

    return () => {
        if (chartRef.current) {
            chartRef.current.destroy();
            chartRef.current = null;
        }
    }
  }, [viewMode, mapData]); // Note: isFullScreen triggers resize via separate effect

  // Handle Full Screen Resize
  useEffect(() => {
     if (chartRef.current) {
         setTimeout(() => {
             chartRef.current?.reflow();
         }, 100);
     }
  }, [isFullScreen]);

  const handleDownloadCsv = () => {
    if (!stats.chartData) return;
    const csv = Papa.unparse(stats.chartData as any);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${id}_summary.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyTable = () => {
      if (!stats.chartData) return;
      const headers = stats.type === 'matrix' 
          ? ['Row', ...(stats.columns || columns || []), 'Average'] 
          : ['Option', 'Count', 'Percent'];
      
      const rows = stats.chartData.map((r: any) => {
          if (stats.type === 'matrix') {
              return [r.name, ...(stats.columns || columns || []).map(c => r[c]), r.average || ''].join('\t');
          }
          return [r.name, r.value, r.pct + '%'].join('\t');
      });
      
      const text = [headers.join('\t'), ...rows].join('\n');
      navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
      });
  };

  const isFiltered = (val: string) => activeFilters.includes(val);

  const getBarColor = (name: string, isNps: boolean, aiVal?: number) => {
    if (isNps) {
        const match = name.match(/\d+/);
        const v = match ? parseInt(match[0], 10) : NaN;
        if (!isNaN(v)) {
            if (v >= 9) return COLORS.success;
            if (v >= 7) return COLORS.passive;
            return COLORS.danger;
        }
    }
    if (aiVal !== undefined && aiVal !== null) {
        if (aiVal >= 4.5) return COLORS.success;
        if (aiVal >= 3.5) return '#a3e635';
        if (aiVal >= 2.5) return COLORS.warning;
        if (aiVal >= 1.5) return '#fb923c';
        return COLORS.danger;
    }
    return COLORS.brand;
  };

  const formatPhoneNumber = (str: string | undefined) => {
    if (!str) return '-';
    const cleaned = str.replace(/\D/g, '');
    const match10 = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match10) return `(${match10[1]}) ${match10[2]}-${match10[3]}`;
    const match11 = cleaned.match(/^1(\d{3})(\d{3})(\d{4})$/);
    if (match11) return `+1 (${match11[1]}) ${match11[2]}-${match11[3]}`;
    return str;
  };

  const renderAiDetailsPanel = () => {
    if (winners.length > 0) {
        return (
            <div className="mb-6 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/30 dark:to-orange-900/30 rounded-xl border border-yellow-200 dark:border-yellow-800 p-6 animate-in slide-in-from-top-2">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-yellow-100 dark:bg-yellow-900/50 rounded-full text-yellow-600 dark:text-yellow-400">
                        <Trophy className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-yellow-800 dark:text-yellow-200">Winners Circle</h3>
                        <p className="text-xs text-yellow-600 dark:text-yellow-400">Randomly selected from valid entries</p>
                    </div>
                </div>
                
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-yellow-100 dark:border-slate-700 overflow-hidden overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-yellow-50/50 dark:bg-yellow-900/10 text-xs text-yellow-700 dark:text-yellow-400 uppercase font-bold border-b border-yellow-100 dark:border-slate-700">
                            <tr>
                                <th className="px-4 py-3 text-left w-1/4">Winner</th>
                                <th className="px-4 py-3 text-left">Age</th>
                                <th className="px-4 py-3 text-left">Gender</th>
                                <th className="px-4 py-3 text-left">Phone</th>
                                <th className="px-4 py-3 text-left">Email</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-yellow-50 dark:divide-slate-700">
                            {winners.map((w, idx) => (
                                <tr key={idx} className="hover:bg-yellow-50/30 dark:hover:bg-yellow-900/10 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                            <div className="bg-yellow-100 dark:bg-yellow-900/30 p-1.5 rounded-full flex-shrink-0">
                                                <User className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
                                            </div>
                                            <span className="truncate">{w.name}</span>
                                        </div>
                                        <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1 ml-9">
                                            <MapPin className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" />
                                            <span className="truncate">{w.location || 'Location Unknown'}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-medium whitespace-nowrap">{w.age || '-'}</td>
                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-medium whitespace-nowrap">{w.gender || '-'}</td>
                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs whitespace-nowrap">{w.phone ? formatPhoneNumber(w.phone) : '-'}</td>
                                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 font-mono text-xs whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]" title={w.email}>{w.email || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="mt-3 text-right">
                    <button onClick={() => setWinners([])} className="text-xs text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200 underline">Clear Winners</button>
                </div>
            </div>
        );
    }

    if (!showAiDetails) return null;

    if (aiMap) {
        return (
            <div className="mb-6 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 text-xs animate-in slide-in-from-top-2 fade-in duration-200">
                <div className="flex items-center gap-2 mb-3 text-brand-700 dark:text-brand-300 font-bold">
                    <Sparkles className="w-3.5 h-3.5" />
                    <h3>AI Semantic Scoring Logic</h3>
                </div>
                <div className="bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 overflow-hidden max-w-md">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-400 uppercase font-semibold text-[10px]">
                            <tr><th className="px-3 py-2 w-2/3">Option</th><th className="px-3 py-2 text-right">Value</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {Object.entries(aiMap).map(([opt, val]) => (
                                <tr key={opt}><td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 font-medium">{opt}</td><td className="px-3 py-1.5 text-right font-mono text-brand-600 dark:text-brand-400">{val}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }
    
    if (textAnalysis) {
        return (
             <div className="mb-6 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 text-xs animate-in slide-in-from-top-2 fade-in duration-200">
                <div className="flex items-center gap-2 mb-1 text-brand-700 dark:text-brand-300 font-bold">
                    <Sparkles className="w-3.5 h-3.5" />
                    <h3>AI Analysis Info</h3>
                </div>
                <p className="text-slate-500 dark:text-slate-400">
                   Generated by analyzing a sample of {stats.responses?.slice(0, 150).length} responses. 
                   {/zip|postal/i.test(text) 
                       ? " ZIP Codes were automatically mapped to residence categories found in the survey." 
                       : ` The AI automatically categorized the data into ${textAnalysis.type === 'themes' ? 'themes' : 'a summary'} based on content density.`
                   }
                </p>
            </div>
        );
    }
    return null;
  };

  const renderHeader = (showMeanBadge = true) => {
    // Determine which view options are available
    const showMapOption = isGeographic || (textAnalysis && textAnalysis.type === 'themes');
    const showChartOption = stats.type === 'chart';
    
    // Only show toolbar if there's more than just the table option, or if we have specific actions
    const showToolbar = showMapOption || showChartOption;

    return (
      <div className="flex justify-between items-start mb-6">
        <div className="flex-1 pr-4">
          <div className="flex items-center flex-wrap gap-2 mb-1">
             <span className="text-sm font-bold text-brand-600 dark:text-brand-400">{formatDisplayId(id)}</span>
             <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{block || type}</span>
             {isRanking && <span className="text-[10px] uppercase font-bold text-white bg-indigo-500 px-1.5 py-0.5 rounded flex items-center gap-1"><ListOrdered className="w-2.5 h-2.5" /> Ranking</span>}
             {isNPS && (
                <div className="flex items-center gap-2">
                     {stats.npsBreakdown && (
                        <div className="flex items-center gap-1 ml-1 text-[10px] font-bold">
                             <span className="text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded border border-green-200 dark:border-green-800 flex items-center gap-1" title="Promoters (9-10)"><ThumbsUp className="w-2.5 h-2.5" /> {stats.npsBreakdown.promoters}%</span>
                             <span className="text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600 flex items-center gap-1" title="Passives (7-8)"><Minus className="w-2.5 h-2.5" /> {stats.npsBreakdown.passives}%</span>
                             <span className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded border border-red-200 dark:border-red-800 flex items-center gap-1" title="Detractors (0-6)"><ThumbsDown className="w-2.5 h-2.5" /> {stats.npsBreakdown.detractors}%</span>
                        </div>
                     )}
                </div>
             )}
             {showMeanBadge && stats.mean && <span className="text-[10px] font-bold text-white bg-brand-600 px-2 py-0.5 rounded ml-2 shadow-sm flex items-center gap-1">Mean: {stats.mean}{aiMap && <Sparkles className="w-2 h-2 text-yellow-300" />}</span>}
             {stats.npsScore !== null && stats.npsScore !== undefined && <span className={`text-[10px] font-bold text-white px-2 py-0.5 rounded ml-2 shadow-sm flex items-center gap-1 ${stats.npsScore > 0 ? 'bg-green-600' : (stats.npsScore < 0 ? 'bg-red-500' : 'bg-slate-500')}`}>NPS: {stats.npsScore > 0 ? '+' : ''}{stats.npsScore}</span>}
             
             {(aiMap || textAnalysis || winners.length > 0) && (
                 <div className="flex items-center gap-1 ml-2">
                     <button onClick={() => setShowAiDetails(!showAiDetails)} className={`p-1 rounded transition-colors ${showAiDetails ? 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300' : 'text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`} title="Show AI details"><Info className="w-3.5 h-3.5" /></button>
                     <button onClick={() => { setAiMap(null); setTextAnalysis(null); setWinners([]); setShowAiDetails(false); setAiError(null); setMapData(null); setViewMode('table'); }} className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Reset / Revert to original"><RotateCcw className="w-3.5 h-3.5" /></button>
                 </div>
             )}

             {!isAiLoading && !aiMap && !textAnalysis && winners.length === 0 && (
                 <>
                    {stats.type !== 'text' && !isRanking && !isNPS && ((!stats.mean) || (stats.type === 'matrix' && !stats.hasAverages)) && !isPrizeDraw && (
                        <button onClick={aiError ? undefined : handleAiScaleAnalysis} disabled={!!aiError} title={aiError || undefined} className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 transition-colors border shadow-sm ${aiError ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60' : 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/20 hover:bg-brand-100 dark:hover:bg-brand-900/40 border-brand-200 dark:border-brand-800'}`}>
                            {aiError ? <AlertCircle className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />} AI Mean
                        </button>
                    )}
                    {isPrizeDraw ? (
                        <button onClick={handleDrawWinners} className="ml-2 text-[10px] font-bold text-yellow-700 dark:text-yellow-900 bg-gradient-to-b from-yellow-100 to-yellow-200 hover:from-yellow-200 hover:to-yellow-300 dark:from-yellow-400 dark:to-yellow-500 px-3 py-1 rounded flex items-center gap-1 transition-all border border-yellow-300 shadow-sm"><Gift className="w-3.5 h-3.5" /> Draw Winners</button>
                    ) : (
                        stats.type === 'text' && (stats.count || 0) > 0 && (
                            <button onClick={handleAiTextAnalysis} disabled={!!aiError} className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 transition-colors border ${aiError ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60' : 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 border-purple-200 dark:border-purple-800'}`}><Sparkles className="w-3 h-3" /> Analyze Text</button>
                        )
                    )}
                 </>
             )}
             {aiError && (
                 <div className="flex items-center gap-1 ml-2 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded border border-red-200 dark:border-red-800 animate-in fade-in" title={aiError}>
                     <AlertCircle className="w-3 h-3" /> <span className="max-w-[100px] truncate">{aiError}</span>
                 </div>
             )}
             {isAiLoading && (
                 <div className="flex items-center gap-2 ml-2 text-xs text-brand-600 dark:text-brand-400 font-medium">
                     <Loader2 className="w-3 h-3 animate-spin" />
                     {loadingMessage && <span className="animate-pulse">{loadingMessage}</span>}
                 </div>
             )}
          </div>
          <p className="font-medium text-slate-800 dark:text-slate-100 leading-snug">{text}</p>
        </div>
        
        <div className="flex items-center gap-3">
             <div className="flex items-center gap-2">
                 <div className="bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg flex items-center border border-slate-200 dark:border-slate-700">
                     {showChartOption && (
                         <button onClick={() => setViewMode('chart')} className={`p-1.5 rounded-md transition-all ${viewMode === 'chart' ? 'bg-white dark:bg-slate-600 shadow text-brand-600 dark:text-brand-300' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`} title="Chart View">
                             <BarChart2 className="w-3.5 h-3.5" />
                         </button>
                     )}
                     
                     <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white dark:bg-slate-600 shadow text-brand-600 dark:text-brand-300' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`} title="Table View">
                         <Table className="w-3.5 h-3.5" />
                     </button>

                     {showMapOption && (
                         <button onClick={handleLoadMap} className={`p-1.5 rounded-md transition-all ${viewMode === 'map' ? 'bg-white dark:bg-slate-600 shadow text-brand-600 dark:text-brand-300' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`} title="Map View">
                             <Globe className="w-3.5 h-3.5" />
                         </button>
                     )}

                     {/* Added Copy/Export actions to individual cards for best experience */}
                     <div className="w-px h-3 bg-slate-300 dark:bg-slate-600 mx-1"></div>
                     <button onClick={handleCopyTable} className={`p-1.5 rounded-md transition-all ${copied ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-600 hover:shadow-sm'}`} title="Copy Data">
                         {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                     </button>
                     <button onClick={handleDownloadCsv} className="p-1.5 rounded-md transition-all text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-600 hover:shadow-sm" title="Download CSV">
                         <Download className="w-3.5 h-3.5" />
                     </button>
                 </div>
             </div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded">n={stats.total || stats.count}</span>
        </div>
      </div>
    );
  };

  // --- RENDER MAIN CONTENT ---

  if (stats.type === 'info') {
      return (
        <div className="report-card bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 print-break-inside-avoid w-full opacity-80 bg-slate-50/30 dark:bg-slate-900/30 transition-colors">
             <div className="flex justify-between items-start mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-slate-400">{formatDisplayId(id)}</span>
                        <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">Info</span>
                    </div>
                    <p className="font-medium text-slate-600 dark:text-slate-400 leading-snug italic">{text}</p>
                </div>
            </div>
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-2 flex justify-center"><span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Instruction / Information Screen</span></div>
        </div>
      );
  }

  // MAP VIEW
  if (viewMode === 'map') {
      return (
          <div className={`report-card bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 print-break-inside-avoid group hover:border-brand-500 dark:hover:border-brand-500 transition-all duration-200 ${isFullScreen ? 'fixed inset-0 z-[9999] p-0 rounded-none h-screen w-screen' : 'p-6'}`}>
              {!isFullScreen && renderHeader(true)}
              {!isFullScreen && renderAiDetailsPanel()}
              <div className={`w-full overflow-hidden border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 relative ${isFullScreen ? 'h-full border-0' : 'h-[500px] rounded-lg'}`}>
                   <div ref={mapContainerRef} className="w-full h-full" />
                   
                   {/* Full Screen Toggle Button */}
                   <button 
                       onClick={() => setIsFullScreen(!isFullScreen)}
                       className="absolute top-4 right-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm p-2 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-brand-600 hover:bg-white dark:hover:text-brand-400 dark:hover:bg-slate-700 z-[1000] transition-colors"
                       title={isFullScreen ? "Exit Full Screen" : "Full Screen Map"}
                   >
                       {isFullScreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                   </button>
              </div>
          </div>
      );
  }

  // TEXT / VERBATIM VIEW
  if (stats.type === 'text' || isPrizeDraw) {
    return (
      <div className="report-card bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 print-break-inside-avoid w-full transition-colors">
        {renderHeader(false)}
        {renderAiDetailsPanel()}

        {textAnalysis?.type === 'themes' && textAnalysis.themes && (
             <div className="w-full overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs text-slate-400 uppercase border-b border-slate-100 dark:border-slate-800">
                            <th className="pb-2 font-semibold w-1/2">Theme (AI Categorized)</th>
                            <th className="pb-2 font-semibold text-right">Count</th>
                            <th className="pb-2 font-semibold text-right">Percentage</th>
                            <th className="pb-2 font-semibold w-1/4 pl-4">Distribution</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {textAnalysis.themes.map((row) => {
                             const totalAnalyzed = textAnalysis.themes!.reduce((acc, curr) => acc + curr.count, 0);
                             const pct = ((row.count / totalAnalyzed) * 100).toFixed(1);
                             return (
                                <tr key={row.theme} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                                    <td className="py-2 pr-2 text-slate-900 dark:text-slate-200 font-medium">{row.theme}</td>
                                    <td className="py-2 text-right text-slate-600 dark:text-slate-400">{row.count}</td>
                                    <td className="py-2 text-right text-purple-600 dark:text-purple-400 font-bold">{pct}%</td>
                                    <td className="py-2 pl-4">
                                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div className="h-full bg-purple-500" style={{ width: `${pct}%` }}></div>
                                        </div>
                                    </td>
                                </tr>
                             );
                        })}
                    </tbody>
                </table>
            </div>
        )}

        {textAnalysis?.type === 'summary' && (
             <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-6 border border-purple-100 dark:border-purple-800 animate-in fade-in slide-in-from-bottom-2">
                 <div className="flex items-start gap-3">
                     <AlignLeft className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-1 flex-shrink-0" />
                     <div>
                         <h4 className="text-sm font-bold text-purple-800 dark:text-purple-300 mb-2">Executive Summary</h4>
                         <p className="text-sm text-purple-900 dark:text-purple-200 leading-relaxed">{textAnalysis.summary}</p>
                     </div>
                 </div>
             </div>
        )}

        {!textAnalysis && winners.length === 0 && (
            <div className="h-32 flex items-center justify-center bg-slate-50 dark:bg-slate-800/50 rounded border border-dashed border-slate-300 dark:border-slate-700">
            <p className="text-slate-400 italic text-sm">
                {isPrizeDraw 
                    ? "Prize draw data ready. Click 'Draw Winners' to select random attendees." 
                    : "Open-ended text responses available in Raw Data view"}
            </p>
            </div>
        )}
      </div>
    );
  }

  // MATRIX VIEW
  if (stats.type === 'matrix') {
     const cols = stats.columns || columns || [];
     
     const renderRankingHeader = (c: string) => {
         if (stats.isRanking) {
             const n = parseInt(c);
             if (n === 1) return <div className="flex justify-center" title="1st Place"><Trophy className="w-4 h-4 text-yellow-500" /></div>;
             if (n === 2) return <div className="flex justify-center" title="2nd Place"><Medal className="w-4 h-4 text-slate-400" /></div>;
             if (n === 3) return <div className="flex justify-center" title="3rd Place"><Medal className="w-4 h-4 text-orange-400" /></div>;
             return <span className="text-slate-400 font-bold">#{n}</span>;
         }
         return c;
     };

     return (
        <div className="report-card bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 print-break-inside-avoid w-full transition-colors">
            {renderHeader(false)}
            {renderAiDetailsPanel()}
            
            <div className="w-full overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse table-fixed min-w-[500px]">
                    <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                            <th className="w-1/4 py-3 pr-4 font-bold text-slate-700 dark:text-slate-300 text-left align-bottom">{stats.isRanking ? 'Item Ranked' : ''}</th>
                            {cols.map(c => <th key={c} className="py-3 px-1 font-semibold text-slate-500 dark:text-slate-400 text-center align-bottom leading-tight">{renderRankingHeader(c)}</th>)}
                            {(stats.hasAverages || aiMap) && <th className="w-24 py-3 px-2 font-bold text-slate-800 dark:text-slate-200 text-center align-bottom bg-brand-50/30 dark:bg-brand-900/10">{stats.isRanking ? 'Average' : 'Avg'}{aiMap && <Sparkles className="w-3 h-3 inline text-brand-600 dark:text-brand-400 ml-1" />}</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {stats.chartData?.map((row: any) => (
                            <tr key={row.name} className="hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 last:border-0">
                                <td className="py-4 pr-4 font-medium text-slate-700 dark:text-slate-300 leading-snug">{row.name}</td>
                                {cols.map(c => {
                                    const count = row[c] || 0;
                                    const total = row.total || 0;
                                    const pctVal = total > 0 ? (count / total) * 100 : 0;
                                    const pctDisplay = pctVal.toFixed(1);
                                    
                                    return (
                                        <td key={c} className="py-3 px-1 text-center align-bottom">
                                            <div className="flex flex-col items-center justify-end w-full">
                                                <span className={`text-sm font-bold ${count > 0 ? 'text-brand-600 dark:text-brand-400' : 'text-slate-300 dark:text-slate-600'}`}>{pctDisplay}%</span>
                                                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mb-1">{count}</span>
                                                <div className="h-1.5 w-12 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                     <div className="h-full bg-brand-500" style={{ width: `${pctVal}%` }}></div>
                                                </div>
                                            </div>
                                        </td>
                                    );
                                })}
                                {(stats.hasAverages || aiMap) && (
                                    <td className="py-3 px-2 text-center font-bold text-brand-700 dark:text-brand-400 bg-brand-50/30 dark:bg-brand-900/10 align-middle">
                                        <div className="flex flex-col items-center justify-center">
                                            <span>{row.average || '-'}</span>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
     );
  }

  // STANDARD CHART VIEW
  return (
    <div className="report-card bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 print-break-inside-avoid group hover:border-brand-500 dark:hover:border-brand-500 transition-colors duration-200">
      {renderHeader(true)}
      {renderAiDetailsPanel()}

      <div className="w-full overflow-hidden">
        {viewMode === 'chart' ? (
             <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.chartData as any} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis 
                            dataKey="name" 
                            type="category" 
                            width={150} 
                            tick={{ fontSize: 11, fill: '#475569', fontWeight: 500 }}
                            interval={0}
                        />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20} onClick={(data) => onToggleFilter(data.name)} cursor="pointer">
                            {(stats.chartData as any[])?.map((entry, index) => (
                                <Cell 
                                    key={`cell-${index}`} 
                                    fill={getBarColor(entry.name, isNPS, aiMap ? aiMap[entry.name] : undefined)} 
                                    opacity={isFiltered(entry.name) ? 1 : 0.8}
                                    strokeWidth={isFiltered(entry.name) ? 2 : 0}
                                    stroke="#1e3a8a"
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
             </div>
        ) : (
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-left text-xs text-slate-400 uppercase border-b border-slate-100 dark:border-slate-800">
                        <th className="pb-2 font-semibold w-1/2">Option</th>
                        <th className="pb-2 font-semibold text-right">Count</th>
                        <th className="pb-2 font-semibold text-right">Percentage</th>
                        <th className="pb-2 font-semibold w-1/4 pl-4">Distribution</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {(stats.chartData as any[])?.map((row) => {
                        const barColor = getBarColor(row.name, isNPS, aiMap ? aiMap[row.name] : undefined);
                        return (
                            <tr key={row.name} onClick={() => onToggleFilter(row.name)} className={`cursor-pointer transition-colors ${isFiltered(row.name) ? 'bg-brand-50 dark:bg-brand-900/20 font-medium' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                <td className="py-2 pr-2 text-slate-900 dark:text-slate-200 font-medium" title={row.name}>{row.name}</td>
                                <td className="py-2 text-right text-slate-600 dark:text-slate-400">{row.value}</td>
                                <td className={`py-2 text-right font-bold ${isFiltered(row.name) ? 'text-brand-700 dark:text-brand-400' : 'text-slate-600 dark:text-slate-400'}`}>{row.pct}%</td>
                                <td className="py-2 pl-4">
                                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div className={`h-full`} style={{ width: `${row.pct}%`, backgroundColor: barColor }}></div>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        )}
      </div>
    </div>
  );
};