// AI services for semantic scoring and text analysis
import { GoogleGenAI, Type } from "@google/genai";

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
    // Fix: Instantiate GoogleGenAI within the function for up-to-date API key access
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
        const prompt = `Analyze if these survey options represent a numeric/satisfaction scale. Return JSON: { "mappings": { "Label": value }, "isScale": boolean }. Input: "${question}", Options: ${JSON.stringify(options)}`;
        
        // Use gemini-3-flash-preview for scale detection
        // Fix: Use responseSchema as the recommended way to get structured JSON
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        mappings: {
                            type: Type.OBJECT,
                            additionalProperties: { type: Type.NUMBER }
                        },
                        isScale: { type: Type.BOOLEAN }
                    },
                    required: ["mappings", "isScale"]
                }
            }
        });
        
        // Fix: Use .text property to get response string
        const data = JSON.parse(response.text || '{}');
        return data.isScale ? data.mappings : null;
    } catch (e) {
        console.error("AI Semantic Error", e);
        return null;
    }
};

export const analyzeTextResponses = async (question: string, responses: string[], choices?: string[]): Promise<TextAnalysisResult | null> => {
    if (!process.env.API_KEY || responses.length === 0) return null;
    // Fix: Instantiate GoogleGenAI within the function
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
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
            config: { 
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        themes: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    theme: { type: Type.STRING },
                                    count: { type: Type.NUMBER }
                                },
                                required: ["theme", "count"]
                            }
                        },
                        summary: { type: Type.STRING }
                    },
                    required: ["themes", "summary"]
                }
            }
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
    // Fix: Instantiate GoogleGenAI within the function
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
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
            config: { 
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    additionalProperties: { type: Type.STRING }
                }
            }
        });
        
        return JSON.parse(response.text || '{}');
    } catch (e) {
        return {};
    }
};

export const getGeoCoordinates = async (labels: string[]): Promise<Record<string, GeoCoordinate>> => {
    if (!process.env.API_KEY || labels.length === 0) return {};
    // Fix: Instantiate GoogleGenAI within the function
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
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
            config: { 
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    additionalProperties: {
                        type: Type.OBJECT,
                        properties: {
                            lat: { type: Type.NUMBER },
                            lon: { type: Type.NUMBER }
                        },
                        required: ["lat", "lon"]
                    }
                }
            }
        });
        
        return JSON.parse(response.text || '{}');
    } catch (e) {
        return {};
    }
};