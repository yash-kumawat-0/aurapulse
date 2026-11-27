// ============================================
// DiurnalTimeline — Accessible 24h Forecast Chart
// ============================================
import { useAqi } from '../../context/AqiContext.jsx';
import { getPm25SafetyColor } from '../../utils/aqiColorMapper.js';
import './DiurnalTimeline.css';

function DiurnalTimeline() {
  const { diurnalData, loading } = useAqi();

  if (loading || !diurnalData) {
    return (
      <div className="card diurnal-placeholder" aria-live="polite">
        {loading ? '⏳ Loading forecast...' : '📍 Search a place to see timeline'}
      </div>
    );
  }

  const { diurnal } = diurnalData;
  if (!diurnal || diurnal.error) {
    return <div className="card diurnal-placeholder" role="status">⚠️ Could not load timeline</div>;
  }

  const hours = (diurnal.hourly_breakdown || []).slice(0, 24);
  const maxPM25 = Math.max(...hours.map((h) => h.pm25), 1);

  return (
    <section className="card diurnal-card" aria-labelledby="diurnal-heading">
      <div className="diurnal-top">
        <h2 id="diurnal-heading" className="diurnal-title">24-Hour Forecast</h2>
        <div className="diurnal-legend">
          <span className="diurnal-legend-item"><span className="diurnal-dot" style={{ background: '#4CAF50' }} aria-hidden="true" /> Safe</span>
          <span className="diurnal-legend-item"><span className="diurnal-dot" style={{ background: '#FF9800' }} aria-hidden="true" /> Moderate</span>
          <span className="diurnal-legend-item"><span className="diurnal-dot" style={{ background: '#F44336' }} aria-hidden="true" /> Unhealthy</span>
        </div>
      </div>

      <div className="diurnal-chart" role="list" aria-label="Hourly PM2.5 levels for next 24 hours">
        {hours.map((h, i) => {
          const pct = Math.max((h.pm25 / maxPM25) * 100, 6);
          const color = getPm25SafetyColor(h.pm25);
          return (
            <div
              key={i}
              role="listitem"
              aria-label={`${h.hour}:00 PM2.5 ${h.pm25} µg/m³`}
              className={`diurnal-bar-wrap ${h.is_cleanest_window ? 'diurnal-bar-wrap--best' : ''}`}
              title={`${h.hour}:00 — PM2.5: ${h.pm25} µg/m³`}
            >
              <div className="diurnal-bar" style={{ height: `${pct}%`, background: color }} />
              {i % 4 === 0 && <span className="diurnal-hour" aria-hidden="true">{h.hour}</span>}
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
    </section>
  );
}

export default DiurnalTimeline;
