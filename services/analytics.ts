
const wordToNum: Record<string, number> = {
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'first': 1, 'second': 2, 'third': 3
};

export interface OptionStats {
  value: number;
  isNumeric: boolean;
  type: 'exact' | 'range_closed' | 'range_low' | 'range_high';
}

export const detectCurrency = (text: string, options: string[] = []): boolean => {
  const t = text.toLowerCase();
  const countPhrases = ['how many people', 'party size', 'group size', 'people included'];
  if (countPhrases.some(phrase => t.includes(phrase))) return false;
  if (options.some(opt => opt.includes('$'))) return true;
  if (t.includes('income') || t.includes('salary') || t.includes('budget')) return true;
  return t.includes('spend') || t.includes('cost') || t.includes('pay') || t.includes('$');
};

export const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(val);
};

export const analyzeOption = (label: string): OptionStats => {
  if (!label) return { value: 0, isNumeric: false, type: 'exact' };
  let clean = label.toLowerCase().trim().replace(/[$,]/g, '');
  
  const closedMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:[-–]|to)\s*(\d+(?:\.\d+)?)/);
  if (closedMatch) return { value: (parseFloat(closedMatch[1]) + parseFloat(closedMatch[2])) / 2, isNumeric: true, type: 'range_closed' };

  const highMatch = clean.match(/(?:over|more than)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:or more|plus)/);
  if (highMatch) return { value: parseFloat(highMatch[1] || highMatch[2]), isNumeric: true, type: 'range_high' };

  const exactMatch = clean.match(/^(\d+(?:\.\d+)?)/);
  if (exactMatch) return { value: parseFloat(exactMatch[1]), isNumeric: true, type: 'exact' };

  return { value: 0, isNumeric: false, type: 'exact' };
};

export const calculateMean = (counts: Record<string, number>, questionText: string): string | null => {
  const entries = Object.entries(counts);
  let totalWeighted = 0, totalCount = 0, hasNumeric = false;

  for (const [label, count] of entries) {
      if (count === 0) continue; 
      const stats = analyzeOption(label);
      if (!stats.isNumeric) continue;
      hasNumeric = true;
      let val = stats.type === 'range_high' ? stats.value * 1.2 : (stats.type === 'range_low' ? stats.value * 0.8 : stats.value);
      totalWeighted += (val * count);
      totalCount += count;
  }
  if (!hasNumeric || totalCount === 0) return null;
  return detectCurrency(questionText) ? formatCurrency(totalWeighted / totalCount) : (totalWeighted / totalCount).toFixed(2);
};

export const calculateMeanFromMap = (counts: Record<string, number>, valueMap: Record<string, number>, questionText: string): string | null => {
    let totalWeighted = 0, totalCount = 0;
    Object.entries(counts).forEach(([label, count]) => {
        if (count === 0 || valueMap[label] === undefined) return;
        totalWeighted += (valueMap[label] * count);
        totalCount += count;
    });
    if (totalCount === 0) return null;
    return detectCurrency(questionText) ? formatCurrency(totalWeighted / totalCount) : (totalWeighted / totalCount).toFixed(2);
};
