import { ProjectMetrics } from '../types';

export const extractProjectMetrics = (data: any[]): ProjectMetrics => {
  if (!data || data.length === 0) {
    return {
      onlinePercent: 0,
      onsitePercent: 0,
      dateRange: '-',
      avgDuration: '0m 0s',
      engagement: '0Qs',
      surveyLength: '0Questions',
      progressPercent: 0,
      totalRespondents: 'n = 0'
    };
  }

  const total = data.length;

  // 1. SystemID: Online vs On-site
  // Logic: 'DWL' usually denotes Online/Link, 'ECS-' denotes On-site devices
  const onlineCount = data.filter(r => r.SystemID === 'DWL').length;
  const onsiteCount = data.filter(r => String(r.SystemID || '').startsWith('ECS-')).length;

  // 2. Timing: Date Range Formatting
  // Checks common Qualtrics date fields
  const dates = data
    .map(r => r.TakeTime || r.StartDate || r.RecordedDate)
    .filter(Boolean)
    .map(d => new Date(d))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  let dateRangeStr = "-";
  if (dates.length > 0) {
    const fmt = (d: Date) => d.toLocaleString('en-US', { 
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true 
    });
    // If start and end are same day, simplify? For now, standard range.
    dateRangeStr = `${fmt(dates[0])} - ${fmt(dates[dates.length - 1])}`;
  }

  // 3. Duration: Average seconds to "Xm Ys"
  let totalSeconds = 0;
  let durationCount = 0;
  data.forEach(r => {
    // Try standard Duration column or verbose label
    const val = r.Duration || r['Duration (in seconds)'];
    const d = parseFloat(val);
    if (!isNaN(d)) { 
        totalSeconds += d; 
        durationCount++; 
    }
  });
  const avgSec = durationCount ? totalSeconds / durationCount : 0;
  const avgDuration = `${Math.floor(avgSec / 60)}m ${Math.round(avgSec % 60)}s`;

  // 4. Engagement: ActualAnswers or count Qs
  // ActualAnswers is a specific metadata field in some exports. If missing, heuristics apply.
  let totalAnswers = 0;
  data.forEach(r => {
    if (r.ActualAnswers) {
        totalAnswers += parseFloat(r.ActualAnswers);
    } else {
        // Fallback: Count keys starting with Q that are not empty
        const qCount = Object.keys(r).filter(k => k.startsWith('Q') && r[k] !== "").length;
        totalAnswers += qCount;
    }
  });
  const engagement = `${(totalAnswers / total).toFixed(1)}Qs`;

  // 5. Survey Length: TotalQuestions or Max Q ID
  let maxQ = 0;
  if (data[0] && data[0].TotalQuestions) {
      maxQ = parseInt(data[0].TotalQuestions);
  } else if (data[0]) {
      // Heuristic: Find highest Q#
      Object.keys(data[0]).forEach(k => {
          const match = k.match(/^Q(\d+)/);
          if (match) maxQ = Math.max(maxQ, parseInt(match[1]));
      });
  }
  const surveyLength = `${maxQ}Questions`;

  // 6. Progress: Finished or Termination
  const finishedCount = data.filter(r => 
    String(r.Finished).toLowerCase() === 'true' || 
    r.Finished === true || 
    r.Termination === 'Normal'
  ).length;

  return {
    onlinePercent: Math.round((onlineCount / total) * 100),
    onsitePercent: Math.round((onsiteCount / total) * 100),
    dateRange: dateRangeStr,
    avgDuration,
    engagement,
    surveyLength,
    progressPercent: Math.round((finishedCount / total) * 100),
    totalRespondents: `n = ${total.toLocaleString()}`
  };
};