import JSZip from 'jszip';
import Papa from 'papaparse';
import { Project } from '../types';

const API_KEY = "tQ73BOpPJhCwlf5hOSo29cLIIhbqdgVIdajTXPrY";
const BASE_URL = "https://pgatour.co1.qualtrics.com";

export interface QualtricsSurvey {
  id: string;
  name: string;
  isActive: boolean;
  creationDate: string;
  lastModifiedDate: string;
}

export async function listSurveys(): Promise<QualtricsSurvey[]> {
  try {
    const res = await fetch(`${BASE_URL}/API/v3/surveys`, {
        headers: { "X-API-TOKEN": API_KEY }
    });
    if (!res.ok) throw new Error("Failed to fetch surveys");
    const json = await res.json();
    return json.result?.elements || [];
  } catch (error) {
    console.error("Qualtrics API Error:", error);
    throw error;
  }
}

export async function importSurveyData(surveyId: string, surveyName: string): Promise<{
    metadata: Partial<Project>,
    schemaFile: File,
    responsesFile: File
}> {
    // 1. Get Definition (Schema)
    const defRes = await fetch(`${BASE_URL}/API/v3/survey-definitions/${surveyId}`, {
         headers: { "X-API-TOKEN": API_KEY, "Accept": "application/json" }
    });
    if (!defRes.ok) throw new Error("Failed to fetch definition");
    const defJson = await defRes.json();
    
    // Transform JSON definition to Tabular Schema
    const questionnaireRows = buildQuestionnaireRowsFromApi(defJson.result);
    const schemaCsv = Papa.unparse(questionnaireRows);
    const schemaFile = new File([schemaCsv], `Q_${surveyName}.csv`, { type: 'text/csv' });

    // 2. Export Responses (Raw Data)
    const exportStart = await fetch(`${BASE_URL}/API/v3/surveys/${surveyId}/export-responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-TOKEN": API_KEY },
        body: JSON.stringify({ format: "csv", useLabels: true })
    });
    const exportJson = await exportStart.json();
    const progressId = exportJson.result?.progressId;

    if (!progressId) throw new Error("Failed to start Qualtrics export");

    // 3. Poll for completion
    let fileId = null;
    let attempts = 0;
    while (!fileId && attempts < 30) { // Timeout after ~60s
        await new Promise(r => setTimeout(r, 2000));
        const poll = await fetch(`${BASE_URL}/API/v3/surveys/${surveyId}/export-responses/${progressId}`, {
             headers: { "X-API-TOKEN": API_KEY }
        });
        const pollJson = await poll.json();
        
        if (pollJson.result?.status === "failed") throw new Error("Qualtrics export failed on server");
        if (pollJson.result?.percentComplete === 100) {
            fileId = pollJson.result.fileId;
        }
        attempts++;
    }

    if (!fileId) throw new Error("Export timed out");

    // 4. Download & Unzip
    const fileRes = await fetch(`${BASE_URL}/API/v3/surveys/${surveyId}/export-responses/${fileId}/file`, {
         headers: { "X-API-TOKEN": API_KEY }
    });
    const blob = await fileRes.blob();
    const zip = await JSZip.loadAsync(blob);
    
    // Find the actual CSV file inside the zip
    // Note: The filename usually matches the survey name, but we check extension
    const csvFilename = Object.keys(zip.files).find(n => n.toLowerCase().endsWith('.csv'));
    if (!csvFilename) throw new Error("No CSV found in Qualtrics export zip");
    
    const csvContent = await zip.files[csvFilename].async("string");
    
    // Clean up Qualtrics Metadata rows (Top 3 lines usually) if needed, 
    // but here we just pass the raw content. The App logic handles cleaning later if needed.
    // However, the provided script had a cleanResponses() function. 
    // For the file artifact, we will save it raw.
    
    const responsesFile = new File([csvContent], `RawData_${surveyName}.csv`, { type: 'text/csv' });

    // 5. Construct Metadata
    const year = new Date().getFullYear().toString();
    
    return {
        metadata: {
            name: surveyName,
            year: year,
            promoter: 'Qualtrics Source',
            dates: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            venue: 'Online Survey',
            location: 'Global',
            logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Qualtrics_XM_Logo.svg/1200px-Qualtrics_XM_Logo.svg.png' // Default Qualtrics logo
        },
        schemaFile,
        responsesFile
    };
}

// --- Helpers for Schema Generation (Adapted from script) ---

function buildQuestionnaireRowsFromApi(def: any) {
    const bNames = extractBlockNames(def);
    const qBlocks = mapQuestionToBlock(def, bNames);
    const rows: any[] = [];
    const emit = (r: any) => rows.push(r);
    
    if (Array.isArray(def?.SurveyElements)) {
        def.SurveyElements.filter((e: any) => e.Element === "SQ").forEach((e: any) => 
            pushQuestionAndTextRows(e.Payload, e, emit, qBlocks)
        );
    } else if (def?.Questions) {
        Object.entries(def.Questions).forEach(([qid, p]: [string, any]) => 
            pushQuestionAndTextRows(p, { Payload: p, PrimaryAttribute: qid }, emit, qBlocks)
        );
    }
    
    // Filter trash and sort
    return rows
        .filter(r => (r.BlockName || "") !== "Trash / Unused Questions")
        .filter(r => String(r["Q#"]).toUpperCase().startsWith("Q"))
        .sort((a, b) => {
            const kA = a["Q#"].split('_')[0];
            const kB = b["Q#"].split('_')[0];
            const diff = sortKeyQ(kA) - sortKeyQ(kB);
            return diff !== 0 ? diff : a["Q#"].localeCompare(b["Q#"]);
        });
}

function extractBlockNames(def: any) {
    const map: any = {};
    if (def?.Blocks) Object.entries(def.Blocks).forEach(([bid, b]: [string, any]) => map[bid] = b?.Description || "");
    if (Array.isArray(def?.SurveyElements)) {
        def.SurveyElements.forEach((e: any) => {
            if (e.Element === "BL") {
                const bid = e.Payload?.ID || e.Payload?.BlockID || e.PrimaryAttribute;
                if (bid) map[bid] = e.Payload?.Description || map[bid] || "";
            }
        });
    }
    return map;
}

function mapQuestionToBlock(def: any, bNames: any) {
    const map: any = {};
    if (def?.Blocks) Object.entries(def.Blocks).forEach(([bid, b]: [string, any]) => {
        (b.BlockElements || []).forEach((be: any) => {
            if (be.Type === "Question") map[be.QuestionID] = bNames[bid] || "";
        });
    });
    if (Array.isArray(def?.SurveyElements)) {
        def.SurveyElements.forEach((e: any) => {
            if (e.Element === "BL") {
                const name = e.Payload?.Description || "";
                (e.Payload?.BlockElements || []).forEach((be: any) => {
                    if (be.Type === "Question") map[be.QuestionID] = name || map[be.QuestionID] || "";
                });
            }
        });
    }
    return map;
}

function pushQuestionAndTextRows(p: any, entry: any, emit: any, qBlocks: any) {
    const QID = p.QuestionID || entry.PrimaryAttribute || "";
    const Tag = p.DataExportTag || "";
    const qT = stripHTML(String(p.QuestionText ?? "").split(/<br\s*\/?>/i)[0] ?? "");
    const block = qBlocks[QID] || "";
    const qtU = String(p.QuestionType || "").toUpperCase();
    const selU = String(p.Selector || "").toUpperCase();
    
    let type = (qtU === "MC") ? (selU.startsWith("MA") ? "Multi" : "Single") : 
               (qtU === "MATRIX" ? "Matrix" : 
               (["TE", "ML"].includes(qtU) ? "Verbatim" : 
               (["DB", "GR", "TB"].includes(qtU) ? "Info" : p.QuestionType)));
               
    const choices = joinDisp(p.Choices, p.ChoiceOrder);
    const answers = joinDisp(p.Answers, p.AnswerOrder) || joinDisp(p.SubQuestions, p.SubQuestionOrder);
    const cols = joinDisp(p.Columns, p.ColumnOrder);
    
    let C = choices, R = answers, L = cols;
    if (type === "Matrix") { R = choices; L = answers || cols; C = ""; }
    
    emit({ "Q#": Tag || QID, "SourceLabel": block || Tag, "Type": type, "QText": qT || "(No text)", "Choices": C, "Rows": R, "Columns": L, "BlockName": block });
    
    const addT = (obj: any) => {
        if (obj && typeof obj === "object") Object.entries(obj).forEach(([k, v]: [string, any]) => {
            if (v && (v.TextEntry === true || v.TextEntry === "true")) {
                emit({ "Q#": `${Tag}_${k}_TEXT`, "SourceLabel": block, "Type": "Verbatim", "QText": `${qT} - ${stripHTML(v.Display || v.Text || "") || 'Other'} - Text`, "Choices": "", "Rows": "", "Columns": "", "BlockName": block });
            }
        });
    };
    addT(p.Choices);
    addT(p.Answers || p.SubQuestions);
}

function stripHTML(s: string) { return String(s ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim(); }
function sortKeyQ(q: string) { const m = String(q ?? "").match(/\d+/); return m ? parseInt(m[0], 10) : 999999; }
function joinDisp(obj: any, order: any) {
    if (!obj || typeof obj !== "object") return "";
    const keys = Array.isArray(order) ? order.map(String) : Object.keys(obj);
    return keys.map(k => obj[k]).map(x => x && (x.Display ?? x.Text ?? x.Label ?? "")).map(stripHTML).filter(Boolean).join("; ");
}