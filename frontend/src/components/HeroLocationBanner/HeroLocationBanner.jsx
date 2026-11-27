// ============================================
// HeroLocationBanner — Search Bar + Auto Outdoor vs
// Indoor Graph (shown on Commute, Family & Indoor)
// ============================================
import { useState, useEffect, useRef } from 'react';
import { useUser } from '../../context/UserContext.jsx';
import { useAqi } from '../../context/AqiContext.jsx';
import { searchPlace, reverseGeocode } from '../../utils/geocoder.js';
import './HeroLocationBanner.css';

function getPmColor(pm) {
  if (pm <= 12) return '#10B981';
  if (pm <= 35) return '#22C55E';
  if (pm <= 55) return '#F59E0B';
  if (pm <= 150) return '#EA580C';
  return '#DC2626';
}

function getPmLabel(pm) {
  if (pm <= 12) return 'Excellent';
  if (pm <= 35) return 'Safe';
  if (pm <= 55) return 'Moderate';
  if (pm <= 150) return 'Unhealthy';
  return 'Hazardous';
}

function MiniCircularGauge({ value, maxValue, label, icon, color }) {
  const size = 82;
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = Math.min(Math.max(value / Math.max(maxValue, 50), 0.05), 1);
  const offset = circumference * (1 - ratio);
  const center = size / 2;

  return (
    <div className="hero-gauge">
      <div className="hero-gauge-ring" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle cx={center} cy={center} r={radius} fill="none" stroke="#E2E8F0" strokeWidth={strokeWidth} />
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${center} ${center})`}
            className="hero-gauge-arc"
          />
        </svg>
        <div className="hero-gauge-center">
          <span className="hero-gauge-num" style={{ color }}>{Math.round(value)}</span>
          <span className="hero-gauge-unit">µg/m³</span>
        </div>
      </div>
      <div className="hero-gauge-meta">
        <span className="hero-gauge-title">{icon} {label}</span>
        <span className="hero-gauge-status" style={{ color, background: `${color}18` }}>
          {getPmLabel(value)}
        </span>
      </div>
    </div>
  );
}

const GRAPH_TABS = new Set(['indoor', 'commute', 'family']);

function HeroLocationBanner({ activeTab = 'dashboard' }) {
  const { location, setLocation, detectLocation, homeProfile } = useUser();
  const { currentAqi, indoorData, loadAqiData, loadIndoorSimulation, loading } = useAqi();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [noMatch, setNoMatch] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);
  const lastAutoAqiRef = useRef(null);

  const showAirGraph = GRAPH_TABS.has(activeTab);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // When location is set via GPS, reverse geocode and load data
  useEffect(() => {
    if (location && !initialized) {
      setInitialized(true);
      setQuery(location.label);
      loadAqiData(location.lat, location.lng);

      reverseGeocode(location.lat, location.lng).then((name) => {
        setQuery(name);
        setLocation((prev) => ({ ...prev, label: name }));
      });
    }
  }, [location, initialized, loadAqiData, setLocation]);

  // Auto-generate Outdoor vs Indoor graph whenever AQI updates — NO Simulate button needed
  useEffect(() => {
    if (!currentAqi) return;
    const key = `${currentAqi.pm25}-${currentAqi.timestamp || ''}`;
    if (lastAutoAqiRef.current !== key) {
      lastAutoAqiRef.current = key;
      loadIndoorSimulation({
        outdoor_pm25: currentAqi.pm25,
        room_area_sqft: homeProfile.room_area_sqft || 150,
        ceiling_height_ft: homeProfile.ceiling_height_ft || 10,
        window_seal_type: homeProfile.window_seal_type || 'standard_aluminum',
        purifier_cadr: homeProfile.purifier_cadr || 0,
        indoor_source: homeProfile.indoor_source || 'none',
        skip_ai: true,
      });
    }
  }, [currentAqi, homeProfile, loadIndoorSimulation]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.length >= 3) {
      debounceRef.current = setTimeout(async () => {
        const results = await searchPlace(value);
        setSuggestions(results);
        setNoMatch(results.length === 0);
        setShowSuggestions(true);
      }, 350);
    } else {
      setSuggestions([]);
      setNoMatch(false);
      setShowSuggestions(false);
    }
  };

  const handleSelectPlace = (place) => {
    setQuery(place.label);
    setLocation({ lat: place.lat, lng: place.lng, label: place.label });
    loadAqiData(place.lat, place.lng);
    setShowSuggestions(false);
    setInitialized(true);
  };

  const handleDetect = () => {
    setInitialized(false);
    detectLocation();
  };

  const sim = indoorData?.simulation;
  const outdoorPM = currentAqi?.pm25 ?? null;
  const estimatedFallbackIndoor = outdoorPM !== null ? Math.round(outdoorPM * 0.71) : null;
  const indoorPM = sim ? sim.indoor_pm25 : estimatedFallbackIndoor;
  const maxScale = outdoorPM !== null ? Math.max(outdoorPM, indoorPM || 0, 60) : 100;
  const deltaPct = outdoorPM && indoorPM !== null
    ? Math.round(((outdoorPM - indoorPM) / outdoorPM) * 100)
    : 0;
  const safeLinePct = Math.min((35 / maxScale) * 100, 100);

  const panelTag = activeTab === 'commute'
    ? 'Home vs Outside'
    : activeTab === 'family'
      ? 'Family Shelter Air'
      : `${homeProfile.room_area_sqft || 150} ft² · Auto Live`;

  return (
    <section className="hero">
      <div className={`hero-inner ${showAirGraph ? 'hero-inner--split' : 'hero-inner--centered'}`}>
        {/* ── Search Bar Section ── */}
        <div className="hero-search-col">
          <h1 className="hero-title">Check your air quality</h1>
          <div className="hero-search-wrapper" ref={wrapperRef}>
            <div className="hero-search">
              <svg className="hero-search-icon" viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
              <input
                type="text"
                className="hero-search-input"
                placeholder="Search any place..."
                value={query}
                onChange={handleInputChange}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              />
              <button
                type="button"
                className="hero-gps-btn"
                onClick={handleDetect}
                disabled={loading}
                title="Use my location"
              >
                {loading ? (
                  <span className="hero-spinner" />
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                    <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
                  </svg>
                )}
              </button>
            </div>

            {showSuggestions && (
              <ul className="hero-suggestions">
                {suggestions.length > 0 ? suggestions.map((place, i) => (
                  <li key={i}>
                    <button
                      className="hero-suggestion-item"
                      onClick={() => handleSelectPlace(place)}
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14" className="hero-suggestion-pin">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                      {place.label}
                    </button>
                  </li>
                )) : noMatch && (
                  <li className="hero-suggestion-empty">
                    No matching location found — try another city or tap GPS
                  </li>
                )}
              </ul>
            )}
          </div>

          {location && (
            <p className="hero-current-loc">
              📍 {location.label}
            </p>
          )}
        </div>

        {/* ── Right Side: Separate Outdoor vs Indoor Graph ONLY on Indoor Air, Commute & Family Plan ── */}
        {showAirGraph && (
          <div className="hero-graph-card" aria-label="Live Outdoor vs Indoor Air Comparison">
            <div className="hero-graph-head">
              <span className="hero-graph-title">
                <span className="hero-graph-live-dot" />
                Outdoor vs Indoor Air
              </span>
              <span className="hero-graph-sub">{panelTag}</span>
            </div>

            {outdoorPM !== null && indoorPM !== null ? (
              <>
                <div className="hero-graph-gauges">
                  <MiniCircularGauge
                    value={outdoorPM}
                    maxValue={maxScale}
                    label="Outdoor"
                    icon="🌍"
                    color={getPmColor(outdoorPM)}
                  />

                  <div className="hero-graph-delta">
                    <span className={`hero-delta-pill ${deltaPct >= 0 ? 'hero-delta-pill--good' : 'hero-delta-pill--bad'}`}>
                      {deltaPct >= 0 ? `↓ ${deltaPct}%` : `↑ ${Math.abs(deltaPct)}%`}
                    </span>
                    <span className="hero-delta-caption">
                      {deltaPct >= 0 ? 'cleaner inside' : 'higher inside'}
                    </span>
                  </div>

                  <MiniCircularGauge
                    value={indoorPM}
                    maxValue={maxScale}
                    label="Indoor"
                    icon="🏠"
                    color={getPmColor(indoorPM)}
                  />
                </div>

                <div className="hero-scale-bars">
                  <div className="hero-scale-row">
                    <span className="hero-scale-name">Outdoor</span>
                    <div className="hero-scale-track">
                      <div
                        className="hero-scale-fill"
                        style={{ width: `${Math.min((outdoorPM / maxScale) * 100, 100)}%`, background: getPmColor(outdoorPM) }}
                      />
                      <span className="hero-safe-marker" style={{ left: `${safeLinePct}%` }} title="Safe Limit: 35 µg/m³" />
                    </div>
                  </div>
                  <div className="hero-scale-row">
                    <span className="hero-scale-name">Indoor</span>
                    <div className="hero-scale-track">
                      <div
                        className="hero-scale-fill"
                        style={{ width: `${Math.min((indoorPM / maxScale) * 100, 100)}%`, background: getPmColor(indoorPM) }}
                      />
                      <span className="hero-safe-marker" style={{ left: `${safeLinePct}%` }} title="Safe Limit: 35 µg/m³" />
                    </div>
                  </div>
                  <div className="hero-scale-legend">
                    <span>Safe limit: 35 µg/m³</span>
                    <span>I/O: {sim ? `${sim.io_ratio_percent}%` : `${Math.round((indoorPM / Math.max(outdoorPM, 1)) * 100)}%`}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="hero-graph-empty">
                {loading ? '⏳ Loading live Outdoor vs Indoor comparison...' : '📍 Detecting location or search a city'}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default HeroLocationBanner;
