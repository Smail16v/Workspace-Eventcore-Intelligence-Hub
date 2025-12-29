
import { GoogleGenAI } from "@google/genai";

export interface TextAnalysisResult {
    type: 'themes' | 'summary';
    themes?: { theme: string; count: number }[];
    summary?: string;
}

export interface GeoCoordinate {
    lat: number;
    lon: number;
}

// Stub implementations to satisfy QuestionCard imports

export const getSemanticValues = async (text: string, options: string[]): Promise<Record<string, number> | null> => {
    // Return null or implement real AI call if needed later
    return null;
};

export const analyzeTextResponses = async (text: string, responses: string[], choices: string[]): Promise<TextAnalysisResult | null> => {
    return {
        type: 'summary',
        summary: 'AI Analysis is not fully configured in this environment. Please ensure API keys are set.'
    };
};

export const analyzeZipCodes = async (text: string, responses: string[], choices: string[], questionText: string): Promise<TextAnalysisResult | null> => {
    return null;
};

export const resolveLocations = async (zips: string[]): Promise<Record<string, string>> => {
    const res: Record<string, string> = {};
    zips.forEach(z => res[z] = "Unknown Location");
    return res;
};

export const getGeoCoordinates = async (labels: string[]): Promise<Record<string, GeoCoordinate>> => {
    return {};
};
