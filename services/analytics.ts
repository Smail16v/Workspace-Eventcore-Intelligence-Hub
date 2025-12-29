
export const calculateMean = (counts: Record<string, number>, text: string): string | null => {
  // Simplified mean calculation for numeric scales found in text
  // Stub implementation
  return null; 
};

export const calculateMeanFromMap = (counts: Record<string, number>, aiMap: Record<string, number>, text: string): string | null => {
  let total = 0;
  let sum = 0;
  
  Object.entries(counts).forEach(([label, count]) => {
    if (aiMap[label] !== undefined) {
      sum += aiMap[label] * count;
      total += count;
    }
  });

  return total > 0 ? (sum / total).toFixed(2) : null;
};

export const analyzeOption = (text: string): { isNumeric: boolean, value: number, type: string } => {
  // Basic heuristic
  const num = parseFloat(text);
  if (!isNaN(num)) {
      return { isNumeric: true, value: num, type: 'numeric' };
  }
  return { isNumeric: false, value: 0, type: 'string' };
};

export const detectCurrency = (text: string, cols: string[]): boolean => {
  return text.includes('$') || cols.some(c => c.includes('$'));
};

export const formatCurrency = (val: number): string => {
  return `$${val.toFixed(2)}`;
};
