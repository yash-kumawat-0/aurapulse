// ============================================
// Diurnal Air Quality Optimizer
// ============================================
// Analyzes a 48-hour AQI forecast to identify:
//   1. The cleanest 2-hour window for outdoor activity
//   2. The dirtiest hours to avoid
//   3. The best ventilation window for opening home windows
//
// Science: During winter, nocturnal surface cooling creates a
// temperature inversion that traps pollutants near the ground.
// Solar heating breaks the inversion layer by late morning,
// and the Planetary Boundary Layer (PBL) expands in the afternoon,
// dispersing pollutants vertically. The cleanest air is typically
// between 2:00 PM and 5:00 PM when PBL height peaks.
// ============================================

/**
 * Analyzes hourly PM2.5 forecast data to identify optimal time windows.
 *
 * @param {Array<object>} hourlyData - Array of { hour: number (0-23), pm25: number, dateLabel: string }.
 *   At minimum, 24 entries for one day, ideally 48 for two days.
 * @returns {object} Diurnal analysis with clean/dirty windows and ventilation advice.
 */
export function analyzeDiurnalPattern(hourlyData) {
  if (!hourlyData || hourlyData.length === 0) {
    return { error: 'No hourly data provided.' };
  }

  // --- Find the cleanest and dirtiest 2-hour windows ---
  let cleanestWindow = { startIndex: 0, avgPM25: Infinity };
  let dirtiestWindow = { startIndex: 0, avgPM25: -Infinity };

  for (let i = 0; i < hourlyData.length - 1; i++) {
    const avgPM25 = (hourlyData[i].pm25 + hourlyData[i + 1].pm25) / 2;
    if (avgPM25 < cleanestWindow.avgPM25) {
      cleanestWindow = { startIndex: i, avgPM25 };
    }
    if (avgPM25 > dirtiestWindow.avgPM25) {
      dirtiestWindow = { startIndex: i, avgPM25 };
    }
  }

  // --- Categorize each hour into safety bands ---
  const categorizedHours = hourlyData.map((entry) => {
    let safety;
    if (entry.pm25 <= 30) safety = 'EXCELLENT';
    else if (entry.pm25 <= 60) safety = 'GOOD';
    else if (entry.pm25 <= 90) safety = 'MODERATE';
    else if (entry.pm25 <= 120) safety = 'UNHEALTHY_SENSITIVE';
    else if (entry.pm25 <= 250) safety = 'UNHEALTHY';
    else safety = 'HAZARDOUS';

    return {
      hour: entry.hour,
      date: entry.dateLabel || 'Today',
      pm25: Math.round(entry.pm25),
      safety,
      is_cleanest_window: false,
      is_dirtiest_window: false,
    };
  });

  // Mark the cleanest 2-hour block
  categorizedHours[cleanestWindow.startIndex].is_cleanest_window = true;
  if (cleanestWindow.startIndex + 1 < categorizedHours.length) {
    categorizedHours[cleanestWindow.startIndex + 1].is_cleanest_window = true;
  }

  // Mark the dirtiest 2-hour block
  categorizedHours[dirtiestWindow.startIndex].is_dirtiest_window = true;
  if (dirtiestWindow.startIndex + 1 < categorizedHours.length) {
    categorizedHours[dirtiestWindow.startIndex + 1].is_dirtiest_window = true;
  }

  // --- Build ventilation recommendation ---
  const cleanStart = hourlyData[cleanestWindow.startIndex];
  const cleanEnd = hourlyData[cleanestWindow.startIndex + 1] || cleanStart;

  const formatHour = (h) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayHour}:00 ${period}`;
  };

  // --- Calculate daily average ---
  const todayHours = hourlyData.filter((_, i) => i < 24);
  const dailyAvg = todayHours.reduce((sum, h) => sum + h.pm25, 0) / todayHours.length;

  return {
    hourly_breakdown: categorizedHours,
    cleanest_window: {
      start_hour: cleanStart.hour,
      end_hour: cleanEnd.hour + 1,
      start_label: formatHour(cleanStart.hour),
      end_label: formatHour(cleanEnd.hour + 1),
      avg_pm25: Math.round(cleanestWindow.avgPM25),
      date: cleanStart.dateLabel || 'Today',
    },
    dirtiest_window: {
      start_hour: hourlyData[dirtiestWindow.startIndex].hour,
      end_hour: (hourlyData[dirtiestWindow.startIndex + 1] || hourlyData[dirtiestWindow.startIndex]).hour + 1,
      start_label: formatHour(hourlyData[dirtiestWindow.startIndex].hour),
      end_label: formatHour(
        (hourlyData[dirtiestWindow.startIndex + 1] || hourlyData[dirtiestWindow.startIndex]).hour + 1,
      ),
      avg_pm25: Math.round(dirtiestWindow.avgPM25),
    },
    ventilation_recommendation: {
      should_ventilate: cleanestWindow.avgPM25 <= 100,
      window: `${formatHour(cleanStart.hour)} – ${formatHour(cleanEnd.hour + 1)}`,
      reason:
        cleanestWindow.avgPM25 <= 60
          ? 'Air quality during this window is good enough for safe natural ventilation.'
          : cleanestWindow.avgPM25 <= 100
            ? 'Air quality is moderate. Open windows briefly (20-30 minutes) for air exchange.'
            : 'Even the cleanest window today is unhealthy. Keep windows closed and use air filtration.',
    },
    daily_average_pm25: Math.round(dailyAvg),
    morning_trap_warning: todayHours.some((h) => h.hour >= 5 && h.hour <= 8 && h.pm25 > dailyAvg * 1.3),
  };
}
