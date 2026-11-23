// ============================================
// DiurnalTimeline — Compact Horizontal Bar Chart
// ============================================
import { useAqi } from '../../context/AqiContext.jsx';
import { getPm25SafetyColor } from '../../utils/aqiColorMapper.js';
import './DiurnalTimeline.css';

function DiurnalTimeline() {
  const { diurnalData, loading } = useAqi();

  if (loading || !diurnalData) {
    return (
      <div className="card diurnal-placeholder">
        {loading ? '⏳ Loading forecast...' : '📍 Search a place to see timeline'}
      </div>
    );
  }

  const { diurnal } = diurnalData;
  if (!diurnal || diurnal.error) {
    return <div className="card diurnal-placeholder">⚠️ Could not load timeline</div>;
  }

  const hours = (diurnal.hourly_breakdown || []).slice(0, 24);
  const maxPM25 = Math.max(...hours.map((h) => h.pm25), 1);

  return (
    <div className="card diurnal-card">
      <div className="diurnal-top">
        <h3 className="diurnal-title">24-Hour Forecast</h3>
        <div className="diurnal-legend">
          <span className="diurnal-legend-item"><span className="diurnal-dot" style={{ background: '#4CAF50' }} /> Safe</span>
          <span className="diurnal-legend-item"><span className="diurnal-dot" style={{ background: '#FF9800' }} /> Moderate</span>
          <span className="diurnal-legend-item"><span className="diurnal-dot" style={{ background: '#F44336' }} /> Unhealthy</span>
        </div>
      </div>

      <div className="diurnal-chart">
        {hours.map((h, i) => {
          const pct = Math.max((h.pm25 / maxPM25) * 100, 6);
          const color = getPm25SafetyColor(h.pm25);
          return (
            <div
              key={i}
              className={`diurnal-bar-wrap ${h.is_cleanest_window ? 'diurnal-bar-wrap--best' : ''}`}
              title={`${h.hour}:00 — PM2.5: ${h.pm25} µg/m³`}
            >
              <div className="diurnal-bar" style={{ height: `${pct}%`, background: color }} />
              {i % 4 === 0 && <span className="diurnal-hour">{h.hour}</span>}
            </div>
          );
        })}
      </div>

      {diurnal.cleanest_window && (
        <div className="diurnal-rec diurnal-rec--good">
          ✅ Best window: {diurnal.cleanest_window.start_label} – {diurnal.cleanest_window.end_label} (PM2.5 ~{diurnal.cleanest_window.avg_pm25})
        </div>
      )}

      {diurnal.morning_trap_warning && (
        <div className="diurnal-rec diurnal-rec--warn">
          ⚠️ Morning inversion — avoid outdoor activity before 9 AM
        </div>
      )}
    </div>
  );
}

export default DiurnalTimeline;
