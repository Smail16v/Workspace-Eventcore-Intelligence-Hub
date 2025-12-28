import { ProjectMetrics } from '../types';

export const extractProjectMetrics = (data: any[], source: string = 'Digivey Source'): ProjectMetrics => {
  if (!data || data.length === 0) {
    return {
      onlinePercent: 0,
      onsitePercent: 0,
      dateRange: '-',
      avgDuration: '0m 0s',
      engagement: '0Qs',
      surveyLength: '0Questions',
      progressPercent: 0,
      totalRespondents: 'n = 0',
      source,
      totalDays: '0 days'
    };
  }

  const total = data.length;

  // 1. SystemID & Status: Online vs On-site calculation
  let onlineCount = 0;
  let onsiteCount = 0;

  data.forEach(r => {
    const sysId = String(r.SystemID || '');
    const status = String(r.Status || '');

    if (sysId === 'DWL') {
      // Standard Qualtrics Online code
      onlineCount++;
    } else if (sysId.startsWith('ECS-')) {
      // Standard Eventcore On-site device code
      onsiteCount++;
    } else if (status === 'Offline') {
      // Fallback: If SystemID is missing, "Offline" status means onsite
      onsiteCount++;
    } else if (status !== "") {
      // Fallback: If SystemID is missing and status is anything else, it means online
      onlineCount++;
    }
  });

  // 2. Timing: Date Range & Unique Days calculation
  const validDates = data
    .map(r => r.TakeTime || r.StartDate || r.RecordedDate)
    .filter(Boolean)
    .map(d => new Date(d))
    .filter(d => !isNaN(d.getTime()));

  let dateRangeStr = "-";
  let daysCountStr = "0 days";

  if (validDates.length > 0) {
    // Sort dates to find range
    const sortedDates = [...validDates].sort((a, b) => a.getTime() - b.getTime());
    const fmt = (d: Date) => d.toLocaleString('en-US', { 
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true 
    });
    dateRangeStr = `${fmt(sortedDates[0])} - ${fmt(sortedDates[sortedDates.length - 1])}`;

    // Calculate unique calendar days
    const uniqueDays = new Set(
      validDates.map(d => d.toISOString().split('T')[0]) // Get YYYY-MM-DD format
    );
    daysCountStr = `${uniqueDays.size} days`;
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
    totalRespondents: `n = ${total.toLocaleString()}`,
    source,
    totalDays: daysCountStr
  };
};