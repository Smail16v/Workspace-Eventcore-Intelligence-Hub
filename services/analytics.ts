
// Helper to convert word numbers to digits
const wordToNum: Record<string, number> = {
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5, 
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'eleven': 11, 'twelve': 12,
  'first': 1, 'second': 2, 'third': 3
};

export interface OptionStats {
  value: number;
  isNumeric: boolean;
  type: 'exact' | 'range_closed' | 'range_low' | 'range_high';
}

export const detectCurrency = (text: string, options: string[] = []): boolean => {
  const t = text.toLowerCase();
  
  // Exclude counts of people
  const countPhrases = [
    'how many people', 'party size', 'group size', 'people included'
  ];
  if (countPhrases.some(phrase => t.includes(phrase))) return false;

  // Check for $ in options or context keywords
  if (options.some(opt => opt.includes('$'))) return true;
  if (t.includes('income') || t.includes('salary') || t.includes('budget')) return true;
  return t.includes('spend') || t.includes('cost') || t.includes('pay') || t.includes('$');
};

export const formatCurrency = (val: number): string => {
  return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD', 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
  }).format(val);
};

export const analyzeOption = (label: string): OptionStats => {
  if (!label) return { value: 0, isNumeric: false, type: 'exact' };
  let clean = label.toLowerCase().trim().replace(/[$,]/g, '');

  // 1. Range Closed (e.g., "10 to 20")
  const closedMatch = clean.match(/(\d+(?:\.\d+)?)\s*(?:[-–]|to)\s*(\d+(?:\.\d+)?)/);
  if (closedMatch) {
    const min = parseFloat(closedMatch[1]);
    const max = parseFloat(closedMatch[2]);
    return { value: (min + max) / 2, isNumeric: true, type: 'range_closed' };
  }

  // 2. Open High (e.g., "50 or more")
  const highMatch = clean.match(/(?:over|more than)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:or more|or over|\+|plus)/);
  if (highMatch) {
    const val = parseFloat(highMatch[1] || highMatch[2]);
    return { value: val, isNumeric: true, type: 'range_high' };
  }

  // 3. Exact Number
  const exactMatch = clean.match(/^(\d+(?:\.\d+)?)/);
  if (exactMatch) {
    return { value: parseFloat(exactMatch[1]), isNumeric: true, type: 'exact' };
  }

  return { value: 0, isNumeric: false, type: 'exact' };
};

export const calculateMean = (counts: Record<string, number>, questionText: string): string | null => {
  const options = Object.keys(counts);
  const isCurrency = detectCurrency(questionText, options);
  
  let totalWeighted = 0;
  let totalCount = 0;
  let hasNumeric = false;

  for (const [label, count] of Object.entries(counts)) {
      if (count === 0) continue; 
      const stats = analyzeOption(label);
      if (!stats.isNumeric) continue;

      hasNumeric = true;
      let finalValue = stats.value;

      if (stats.type === 'range_high') finalValue = stats.value * 1.2;
      else if (stats.type === 'range_low') finalValue = stats.value * 0.8;

      totalWeighted += (finalValue * count);
      totalCount += count;
  }

  if (!hasNumeric || totalCount === 0) return null;
  const mean = totalWeighted / totalCount;
  return isCurrency ? formatCurrency(mean) : mean.toFixed(2);
};

export const calculateMeanFromMap = (
    counts: Record<string, number>, 
    valueMap: Record<string, number>, 
    questionText: string
): string | null => {
    const isCurrency = detectCurrency(questionText);
    let totalWeighted = 0;
    let totalCount = 0;

    Object.entries(counts).forEach(([label, count]) => {
        if (count === 0) return;
        const val = valueMap[label];
        if (val !== undefined && val !== null) {
            totalWeighted += (val * count);
            totalCount += count;
        }
    });

    if (totalCount === 0) return null;
    const mean = totalWeighted / totalCount;
    return isCurrency ? formatCurrency(mean) : mean.toFixed(2);
};
