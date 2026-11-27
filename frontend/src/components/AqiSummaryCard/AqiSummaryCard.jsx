// ============================================
// AqiSummaryCard — Compact Single-Row Summary
// ============================================
import { useAqi } from '../../context/AqiContext.jsx';
import { getAqiInfo } from '../../utils/aqiColorMapper.js';
import { timeAgo } from '../../utils/formatters.js';
import './AqiSummaryCard.css';

function AqiSummaryCard() {
  const { currentAqi, loading } = useAqi();

  if (loading) {
    return <div className="card aqi-placeholder">⏳ Loading air quality...</div>;
  }

  if (!currentAqi) {
    return <div className="card aqi-placeholder">📍 Search a place to begin</div>;
  }

  const info = getAqiInfo(currentAqi.aqi);

  return (
    <div className="card aqi-card">
      <div className="aqi-main">
        <div className="aqi-number" style={{ color: info.color }}>
          {currentAqi.aqi}
          <span className="aqi-label">AQI</span>
        </div>
        <div className="aqi-details">
          <span className="aqi-badge" style={{ background: info.bg, color: info.color }}>
            {info.emoji} {info.label}
          </span>
          <div className="aqi-meta">
            <span>
              PM2.5: <strong>{Math.round(currentAqi.pm25)}</strong> µg/m³
            </span>
            <span className="aqi-sep">•</span>
            <span>{currentAqi.dominant_pollutant}</span>
            <span className="aqi-sep">•</span>
            <span className="aqi-time">
              <span className="aqi-dot" />
              {timeAgo(currentAqi.timestamp)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AqiSummaryCard;
