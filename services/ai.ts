// AI services for semantic scoring and text analysis
import { GoogleGenAI } from "@google/genai";

// Initialize AI client using environment variable strictly
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
    if (!process.env.API_KEY) return null;
    try {
        const prompt = `Analyze if these survey options represent a numeric/satisfaction scale. Return JSON: { "mappings": { "Label": value }, "isScale": boolean }. Input: "${question}", Options: ${JSON.stringify(options)}`;
        
        // Use gemini-3-flash-preview for scale detection
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: 'application/json'
            }
        });
        
        const data = JSON.parse(response.text || '{}');
        return data.isScale ? data.mappings : null;
    } catch (e) {
        console.error("AI Semantic Error", e);
        return null;
    }
};

export const analyzeTextResponses = async (question: string, responses: string[], choices?: string[]): Promise<TextAnalysisResult | null> => {
    if (!process.env.API_KEY || responses.length === 0) return null;
    
    // Sample if too large to save tokens/latency
    const sample = responses.slice(0, 150).filter(r => r.length > 2);
    if (sample.length === 0) return null;
    
    try {
        const prompt = `Categorize these survey responses into themes with counts or provide a summary. Question: "${question}", Data: ${JSON.stringify(sample)}
        Return JSON:
        {
            "themes": [{ "theme": "Theme Name", "count": number }],
            "summary": "Brief executive summary of the sentiment found in these responses."
        }`;

        // Use gemini-3-flash-preview for text theme analysis
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
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
    if (!process.env.API_KEY || zips.length === 0) return {};
    
    try {
        const uniqueZips = [...new Set(zips)].slice(0, 20); // Limit to batch of 20
        const prompt = `
        Identify the City and State/Country for these Zip/Postal Codes: ${uniqueZips.join(', ')}.
        Return JSON: { "zip": "City, State" }
        `;
        
        // Use gemini-3-flash-preview for low-latency location mapping
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
    if (!process.env.API_KEY || labels.length === 0) return {};
    
    try {
        const uniqueLabels = [...new Set(labels)].slice(0, 50);
        const prompt = `
        Get latitude and longitude for these locations: ${uniqueLabels.join('; ')}.
        Return JSON: { "Location Name": { "lat": number, "lon": number } }
        `;
        
        // Use gemini-3-flash-preview for geocoding
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