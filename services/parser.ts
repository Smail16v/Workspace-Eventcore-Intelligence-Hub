import Papa from 'papaparse';
import { QuestionDef, SurveyResponse } from '../types';

// Helper to clean HTML from strings
export const stripHtml = (html: any): string => {
  if (html === null || html === undefined) return "";
  return String(html).replace(/<[^>]*>?/gm, '').trim().replace(/\s+/g, ' ');
};

// Formatter for Question IDs (e.g. Q7_10_TEXT -> Q7 Other)
export const formatDisplayId = (id: string): string => {
  return id.replace(/_(\d+_)?TEXT$/, ' Other');
};

// Parse Question Schema CSV (Supports Qualtrics and Digivey)
export const parseSchemaCsv = (csvText: string): Promise<QuestionDef[]> => {
  return new Promise((resolve) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        const data = results.data;
        const questions: QuestionDef[] = data
          .map((row: any) => {
            // Mapping Logic supporting both Qualtrics and Digivey headers
            const qId = row['Q#'] || row['QuestionID'] || row['Question #'];
            let qText = row['QText'] || row['Question Text'] || row['Text'];
            const typeRaw = (row['Type'] || row['Question Type'] || 'Verbatim');
            
            // Normalize Geo Question Texts
            const qTextLower = stripHtml(qText).toLowerCase();
            if (qTextLower === 'zip' || qTextLower === 'zipcode') {
                qText = 'Zip Code';
            } else if (qTextLower === 'postal' || qTextLower === 'postalcode') {
                qText = 'Postal Code';
            } else if (qTextLower === 'zip / postal code' || qTextLower === 'zip/postal code') {
                qText = 'Zip / Postal Code';
            }

            const choices = (row['Choices'] || row['Answer Choices'] || '').split(';').map((c: string) => c.trim()).filter(Boolean);
            const rowsArr = (row['Rows'] || '').split(';').map((r: string) => r.trim()).filter(Boolean);
            const colsArr = (row['Columns'] || '').split(';').map((c: string) => c.trim()).filter(Boolean);

            let finalType = typeRaw;
            let finalChoices = choices;
            let finalRows = rowsArr;
            let finalCols = colsArr;

            // AGGREGATION PROTOCOL: Single-Row Matrix Logic (e.g., Q14 pattern)
            // Rule: If Matrix type has Columns defined but NO Rows, it acts as a Single Choice horizontal scale.
            if (finalType.toLowerCase() === 'matrix' && finalRows.length === 0 && finalCols.length > 0) {
                finalType = 'Single';
                finalChoices = finalCols; // Promote Columns to Choices
                finalCols = [];
            }
            
            return {
              id: qId,
              text: stripHtml(qText),
              type: finalType,
              choices: finalChoices,
              rows: finalRows,
              columns: finalCols,
              block: row['BlockName'] || row['Block'] || row['SourceLabel'] || 'General'
            };
          })
          .filter((q: QuestionDef) => q.id && !q.id.includes('_TEXT'));
        
        resolve(questions);
      }
    });
  });
};

// Parse Responses CSV
export const parseResponsesCsv = (csvText: string): Promise<SurveyResponse[]> => {
  return new Promise((resolve) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        let raw = results.data;
        // Skip metadata rows common in Qualtrics/Digivey
        const cleanData = raw.filter((row: any) => {
          // AGGREGATION PROTOCOL: Validation
          // Must have a valid identifier or timestamp to be included in Base N
          const val = row['StartDate'] || row['RecordedDate'] || row['TakeTime'];
          if (!val) return false;
          const s = String(val);
          return !s.includes('Date') && !s.includes('{') && !s.includes('ImportId');
        });
        resolve(cleanData);
      }
    });
  });
};

/**
 * Normalizes raw survey data based on the Aggregation Protocol.
 * Updated to handle Digivey/Qualtrics 1-based indexing logic explicitly.
 */
export const normalizeData = (data: SurveyResponse[], questions: QuestionDef[]): SurveyResponse[] => {
  if (!data.length || !questions.length) return data;

  const columns = Object.keys(data[0]);
  const qToColMap: Record<string, string> = {};

  // 1. Column Selection (Fuzzy Match for Digivey style headers)
  questions.forEach(q => {
    const qid = q.id;
    const match = columns.find(c => c === qid || c.startsWith(qid + " ") || c.startsWith(qid + "."));
    if (match) qToColMap[qid] = match;
  });

  // 1.5 Pre-scan for Index Mode Detection (Digivey Pattern)
  const indexModeMap: Record<string, boolean> = {};

  questions.forEach(q => {
      const origCol = qToColMap[q.id];
      if (!origCol) return;

      const type = q.type.toLowerCase();
      // Only relevant for choice-based questions
      if (!type.includes('multi') && !type.includes('matrix') && type !== 'single') return;

      const options = (type.includes('matrix') || type.includes('likert')) ? (q.columns || []) : (q.choices || []);
      const len = options.length;
      if (len === 0) return;

      let maxValFound = 0;
      let minValFound = 999;
      let hasNumeric = false;
      
      // Sample data to detect pattern
      for (let i = 0; i < Math.min(data.length, 1000); i++) {
          const val = String(data[i][origCol] || '').trim();
          if (!val || val === '.empty.' || val === '.Timeout.') continue;
          
          if (/^\d+$/.test(val)) {
              hasNumeric = true;
              const n = parseInt(val, 10);
              if (n > maxValFound) maxValFound = n;
              if (n < minValFound && n !== 0) minValFound = n; // Ignore 0 for min calc as it might be null
          }
      }

      // STRICT DIGIVEY RULE:
      // If we see values > 0 but <= length+1, AND strict 0s exist, AND labels don't match indices.
      // Example: Labels are "0".."10" (Length 11). Raw values 1..11.
      if (hasNumeric) {
          // If the max value found matches the length of options (1-based index limit)
          // e.g. 5 options, max value 5.
          // e.g. 11 options (0-10), max value 11.
          if (maxValFound === len) {
              indexModeMap[q.id] = true;
          }
          // Special Case: NPS 0-10 (11 options). If we see an "11", it's definitely 1-based.
          else if (len === 11 && maxValFound === 11) {
              indexModeMap[q.id] = true;
          }
      }
  });

  return data.map(row => {
    const newRow: SurveyResponse = { ...row };
    
    // Normalize Metadata
    if (row.TakeTime && !row.StartDate) newRow.StartDate = row.TakeTime;
    if (row.Duration && !row['Duration (in seconds)']) newRow['Duration (in seconds)'] = row.Duration;

    questions.forEach(q => {
      const origCol = qToColMap[q.id];
      if (!origCol) return; 

      let val = String(row[origCol] || '').trim();

      // 2. Data Scrubbing (Protocol)
      // Treat specific markers and strictly '0' as empty if in Index Mode
      const lowerVal = val.toLowerCase();
      const isIndexBased = indexModeMap[q.id];

      if (!val || lowerVal === '.empty.' || lowerVal === '.timeout.' || lowerVal === '.dropped.') {
          newRow[q.id] = ""; 
          return;
      }

      // CRITICAL FIX: In Digivey 1-based mode, raw '0' is strictly NULL / Skip.
      // It must NOT be mapped to option 0.
      if (isIndexBased && val === '0') {
          newRow[q.id] = "";
          return;
      }

      // If we mapped a fuzzy column, ensure the standard ID exists
      if (origCol !== q.id) {
          newRow[q.id] = val;
      }

      const type = q.type.toLowerCase();

      // Key-Value Pair Matrix Pattern
      const isKeyValue = /[=:]/.test(val) && /^(\d+[:=]\d+[,;\s]*)+$/.test(val);
      if (isKeyValue && type.includes('matrix')) {
          const pairs = val.split(/[,;\s]+/).filter(Boolean);
          const cols = q.columns || [];
          pairs.forEach(p => {
              const sep = p.includes(':') ? ':' : '=';
              const [r, c] = p.split(sep);
              const rIdx = parseInt(r, 10);
              const cIdx = parseInt(c, 10);
              if (!isNaN(rIdx) && !isNaN(cIdx) && cols[cIdx - 1]) {
                  newRow[`${q.id}_${rIdx}`] = cols[cIdx - 1];
              }
          });
          return;
      }

      // 3. Index-to-Label Mapping
      const isNumericList = /^[\d$,;\s]+$/.test(val) && /\d/.test(val);
      
      if (isNumericList && (type.includes('multi') || type.includes('matrix') || type === 'single')) {
          // Ranking Pattern
          const isRanking = q.text.toLowerCase().includes('rank') && !type.includes('single');
          if (isRanking) {
              const rawParts = val.split(/[,;]/);
              const choices = q.choices || [];
              const rankedLabels: string[] = [];
              rawParts.forEach((rankVal, index) => {
                  const cleanRank = rankVal.replace('$', '').trim();
                  if (cleanRank && choices[index]) {
                      newRow[`${q.id}_${index + 1}`] = cleanRank;
                      rankedLabels.push(`${choices[index]} (#${cleanRank})`);
                  }
              });
              if (rankedLabels.length > 0) newRow[q.id] = rankedLabels.join('; ');
              return;
          }

          const rawParts = val.split(/[,;]/);
          let options = (type.includes('matrix') || type.includes('likert')) ? (q.columns || []) : (q.choices || []);

          // RESOLUTION LOGIC
          const resolveValue = (raw: string): string | null => {
              const clean = raw.replace('$', '').trim();
              if (clean === '') return null;
              
              const idx = parseInt(clean, 10);

              // A. Forced Index Mode (Digivey / Qualtrics Recode)
              if (isIndexBased) {
                  // Protocol: Raw 0 = Null. 
                  if (idx === 0) return null; 
                  
                  // Protocol: Index Shift. Raw N -> Option[N-1]
                  // e.g. Raw 1 -> Index 0 (First Option)
                  // e.g. Raw 11 -> Index 10 (Eleventh Option, often label "10")
                  if (!isNaN(idx) && options[idx - 1] !== undefined) {
                      return options[idx - 1];
                  }
                  return null;
              }

              // B. Standard Priority: Label Match > Index Match
              const labelMatch = options.find(o => o.trim() === clean);
              if (labelMatch) return labelMatch;

              // Fallback to direct index (1-based assumption) if label not found
              if (!isNaN(idx) && idx > 0 && options[idx - 1] !== undefined) {
                  return options[idx - 1];
              }
              return null;
          };

          if (type.includes('matrix') || type.includes('likert')) {
              rawParts.forEach((part, rIdx) => {
                  const resolved = resolveValue(part);
                  if (resolved) {
                      newRow[`${q.id}_${rIdx + 1}`] = resolved;
                  }
              });
          }
          else if (type.includes('multi') || type.includes('multiple')) {
              const selectedLabels: string[] = [];
              rawParts.forEach(part => {
                  const resolved = resolveValue(part);
                  if (resolved) {
                      selectedLabels.push(resolved);
                      const idx = options.indexOf(resolved);
                      if (idx !== -1) newRow[`${q.id}_${idx + 1}`] = resolved;
                  }
              });
              if (selectedLabels.length > 0) newRow[q.id] = selectedLabels.join('; ');
          } 
          else if (type === 'single') {
              for (const part of rawParts) {
                  const resolved = resolveValue(part);
                  if (resolved) {
                      newRow[q.id] = resolved;
                      break; 
                  }
              }
          }
      }
    });
    return newRow;
  });
};

// Filter Data Logic
export const filterData = (data: SurveyResponse[], questions: QuestionDef[], filters: Record<string, string[]>): SurveyResponse[] => {
  if (Object.keys(filters).length === 0) return data;

  return data.filter(row => {
    return Object.entries(filters).every(([qId, selectedValues]) => {
      if (selectedValues.length === 0) return true;
      
      const question = questions.find(q => q.id === qId);
      if (!question) return true;

      // Handle mapped array values (Multi/Matrix)
      if (question.type.toLowerCase().includes('multi') || question.type.toLowerCase().includes('matrix')) {
        const responseKeys = Object.keys(row).filter(k => k.startsWith(qId + '_') || k === qId);
        return responseKeys.some(key => {
            const val = row[key];
            if (!val) return false;
            const parts = val.split(';').map(p => p.trim());
            return selectedValues.some(sv => parts.includes(sv));
        });
      }
      
      return selectedValues.includes(row[qId]);
    });
  });
};