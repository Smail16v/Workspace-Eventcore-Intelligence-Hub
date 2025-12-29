
import { GoogleGenAI } from "@google/genai";

// Initialize AI client safely
// Use generic access to global objects to support both Vite (import.meta) and Webpack/CRA (process.env)
const getApiKey = () => {
  try {
    if (typeof process !== 'undefined' && process.env?.API_KEY) return process.env.API_KEY;
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) return import.meta.env.VITE_GEMINI_API_KEY;
  } catch (e) {
    return '';
  }
  return '';
};

const apiKey = getApiKey();
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export interface TextAnalysisResult {
    type: 'themes' | 'summary';
    themes?: { theme: string; count: number }[];
    summary?: string;
}

export interface GeoCoordinate {
    lat: number;
    lon: number;
}

export const getSemanticValues = async (question: string, options: string[]): Promise<Record<string, number> | null> => {
    if (!ai) return null;
    try {
        const prompt = `
        Analyze this survey question and its options to determine a numeric scoring map.
        Question: "${question}"
        Options: ${JSON.stringify(options)}
        
        Task: Assign a numeric value to each option representing its sentiment or magnitude (e.g. Strongly Disagree=1 to Strongly Agree=5, or High=10).
        If the options are not ordinal/scalar/numeric-implied, return null.
        
        Return JSON schema:
        {
            "mappings": { "Option Label": number },
            "isScale": boolean
        }
        `;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-09-2025', 
            contents: prompt,
            config: {
                responseMimeType: 'application/json'
            }
        });
        
        const result = JSON.parse(response.text || '{}');
        return result.isScale ? result.mappings : null;
    } catch (e) {
        console.error("AI Semantic Error", e);
        return null;
    }
};

export const analyzeTextResponses = async (question: string, responses: string[], choices: string[]): Promise<TextAnalysisResult | null> => {
    if (!ai || responses.length === 0) return null;
    
    // Sample if too large to save tokens/latency
    const sample = responses.slice(0, 50).join("\n");
    
    try {
        const prompt = `
        Analyze these open-ended text responses for the question: "${question}".
        Sample Responses:
        ${sample}
        
        Task: Group them into 3-5 distinct themes with counts based on the sample provided.
        Return JSON:
        {
            "themes": [{ "theme": "Theme Name", "count": number }],
            "summary": "Brief executive summary of the sentiment found in these responses."
        }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-09-2025',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        
        const data = JSON.parse(response.text || '{}');
        return {
            type: 'themes',
            themes: data.themes,
            summary: data.summary
        };
    } catch (e) {
        console.error("AI Text Analysis Error", e);
        return { type: 'summary', summary: "Analysis failed due to an error." };
    }
};

export const analyzeZipCodes = async (text: string, responses: string[], choices: string[], questionText: string): Promise<TextAnalysisResult | null> => {
    return analyzeTextResponses(text, responses, choices);
};

export const resolveLocations = async (zips: string[]): Promise<Record<string, string>> => {
    if (!ai || zips.length === 0) return {};
    
    try {
        const uniqueZips = [...new Set(zips)].slice(0, 20); // Limit to batch of 20
        const prompt = `
        Identify the City and State/Country for these Zip/Postal Codes: ${uniqueZips.join(', ')}.
        Return JSON: { "zip": "City, State" }
        `;
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        
        return JSON.parse(response.text || '{}');
    } catch (e) {
        return {};
    }
};

export const getGeoCoordinates = async (labels: string[]): Promise<Record<string, GeoCoordinate>> => {
    if (!ai || labels.length === 0) return {};
    
    try {
        const uniqueLabels = [...new Set(labels)].slice(0, 50);
        const prompt = `
        Get latitude and longitude for these locations: ${uniqueLabels.join('; ')}.
        Return JSON: { "Location Name": { "lat": number, "lon": number } }
        `;
        
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        });
        
        return JSON.parse(response.text || '{}');
    } catch (e) {
        return {};
    }
};
