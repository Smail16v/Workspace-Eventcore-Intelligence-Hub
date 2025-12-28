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

  // 2. Timing: Pre-calculate Active Days (Threshold >= 10 responses)
  const responseDates = data
    .map(r => ({ date: new Date(r.TakeTime || r.StartDate || r.RecordedDate), record: r }))
    .filter(item => !isNaN(item.date.getTime()));

  const dayCounts: Record<string, number> = {};
  responseDates.forEach(item => {
    const dayKey = item.date.toISOString().split('T')[0];
    dayCounts[dayKey] = (dayCounts[dayKey] || 0) + 1;
  });

  const activeDayKeys = new Set(Object.keys(dayCounts).filter(day => dayCounts[day] >= 10));
  
  // 3. Date Range Label (uses all valid records for full context)
  let dateRangeStr = "-";
  if (responseDates.length > 0) {
    const sorted = [...responseDates].sort((a, b) => a.date.getTime() - b.date.getTime());
    const fmt = (d: Date) => d.toLocaleString('en-US', { 
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true 
    });
    dateRangeStr = `${fmt(sorted[0].date)} - ${fmt(sorted[sorted.length - 1].date)}`;
  }

  // 4. Duration: Average seconds (Filtered by active dates only)
  let totalSeconds = 0;
  let durationCount = 0;
  responseDates.forEach(item => {
    const dayKey = item.date.toISOString().split('T')[0];
    if (activeDayKeys.has(dayKey)) {
        const val = item.record.Duration || item.record['Duration (in seconds)'];
        const d = parseFloat(val);
        if (!isNaN(d)) { 
            totalSeconds += d; 
            durationCount++; 
        }
    }
  });
  const avgSec = durationCount ? totalSeconds / durationCount : 0;
  const avgDuration = `${Math.floor(avgSec / 60)}m ${Math.round(avgSec % 60)}s`;

  // 5. Engagement: ActualAnswers or count Qs
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

  // 6. Survey Length: TotalQuestions or Max Q ID
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

  // 7. Progress: Finished or Termination
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
    totalDays: `${activeDayKeys.size} days`
  };
};