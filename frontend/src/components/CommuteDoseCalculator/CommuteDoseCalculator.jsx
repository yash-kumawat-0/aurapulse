// ============================================
// CommuteDoseCalculator — Full Multi-Route Map
//   • 6 modes: Car, Two-Wheeler, Metro, Bus, Walk, Bicycle
//   • Metro shows real rail lines with official Indian colors
//   • Bus shows real bus routes or road fallback
//   • Road modes show 2-3 alternatives on map simultaneously
//   • Click any route on map to select it
//   • Selected = thick + dark, others = faded with AQI colors
//   • Safest mode auto-suggested
// ============================================
import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useUser } from '../../context/UserContext.jsx';
import { useAqi } from '../../context/AqiContext.jsx';
import { searchPlace, reverseGeocode } from '../../utils/geocoder.js';
import { fetchAllModesRoutes, MODE_CONFIG } from '../../utils/routingService.js';
import { colorizeRoute, getColorLegend, calcRouteAvgPM25 } from '../../utils/aqiRouteColorizer.js';
import { fetchMultiCommuteComparison } from '../../services/api.js';
import './CommuteDoseCalculator.css';

// Leaflet icon fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});
const startIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
const endIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

function FitBounds({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords?.length > 1) {
      try { map.fitBounds(L.latLngBounds(coords), { padding: [40, 40], maxZoom: 15 }); } catch { /* skip */ }
    }
  }, [map, coords]);
  return null;
}

// ── Place Search Input ──
function PlaceInput({ label, value, onChange, placeholder }) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  const wrap = useRef(null);

  useEffect(() => { if (value && !query) setQuery(value); }, [value]); // eslint-disable-line
  useEffect(() => {
    const h = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const onType = (e) => {
    const v = e.target.value;
    setQuery(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.length >= 3) {
      timer.current = setTimeout(async () => {
        const r = await searchPlace(v);
        setSuggestions(r); setOpen(r.length > 0);
      }, 350);
    } else { setSuggestions([]); setOpen(false); }
  };
  const pick = (p) => { setQuery(p.label); setOpen(false); onChange({ lat: p.lat, lng: p.lng, label: p.label }); };

  return (
    <div className="cdc-place" ref={wrap}>
      <label className="cdc-place-label">{label}</label>
      <input className="cdc-place-input" placeholder={placeholder} value={query}
        onChange={onType} onFocus={() => suggestions.length > 0 && setOpen(true)} />
      {open && (
        <ul className="cdc-place-list">
          {suggestions.map((p, i) => (
            <li key={i}><button className="cdc-place-opt" onClick={() => pick(p)}>📍 {p.label}</button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Colored Route Segments on Map ──
function ColoredRoute({ segments, weight, opacity, onClick, tooltip }) {
  return segments.map((seg, si) => (
    <Polyline key={si} positions={seg.points} color={seg.color}
      weight={weight} opacity={opacity}
      eventHandlers={onClick ? { click: onClick } : {}}>
      {tooltip && si === Math.floor(segments.length / 2) && (
        <Tooltip sticky>{tooltip}</Tooltip>
      )}
    </Polyline>
  ));
}

// ── Transit Lines (metro/bus real geometry) ──
function TransitLines({ lines, opacity, weight }) {
  return lines.map((line, i) => (
    <Polyline key={i} positions={line.coordinates} color={line.color || '#7B1FA2'}
      weight={weight} opacity={opacity}>
      <Tooltip sticky>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: line.color || '#7B1FA2' }} />
          {line.name}
        </span>
      </Tooltip>
    </Polyline>
  ));
}

// ========== MAIN COMPONENT ==========
function CommuteDoseCalculator() {
  const { location, detectLocation } = useUser();
  const { currentAqi } = useAqi();

  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [allModes, setAllModes] = useState([]);
  const [selectedMode, setSelectedMode] = useState('DRIVE');
  const [selectedAlt, setSelectedAlt] = useState(0);
  const [doseByMode, setDoseByMode] = useState({});
  const [safestMode, setSafestMode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [detectingGPS, setDetectingGPS] = useState(false);

  // Auto-set origin from user's detected location
  useEffect(() => {
    if (location && !origin) {
      // If we have a readable label, use it; otherwise reverse-geocode
      const loc = { lat: location.lat, lng: location.lng, label: location.label };
      setOrigin(loc);

      // Try to get a readable place name if label looks like coordinates
      if (location.label && location.label.match(/^[\d\.\-,\s]+$/)) {
        reverseGeocode(location.lat, location.lng).then((name) => {
          setOrigin((prev) => prev ? { ...prev, label: name } : prev);
        }).catch(() => {});
      }
    }
  }, [location, origin]);

  // ── Detect current location for source ──
  const handleDetectSource = useCallback(() => {
    if (!navigator.geolocation) return;
    setDetectingGPS(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        let label = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        try {
          label = await reverseGeocode(lat, lng);
        } catch { /* use coord label */ }
        setOrigin({ lat, lng, label });
        setDetectingGPS(false);
      },
      (err) => {
        console.error('GPS error:', err.message);
        setDetectingGPS(false);
      },
    );
  }, []);

  // ── Fetch all routes ──
  const fetchRoutes = useCallback(async () => {
    if (!origin || !destination) return;
    setLoading(true); setError(null);
    setAllModes([]); setDoseByMode({}); setSafestMode(null); setSelectedAlt(0);

    try {
      const modes = await fetchAllModesRoutes(origin.lat, origin.lng, destination.lat, destination.lng);
      if (!modes.length) { setError('No routes found.'); setLoading(false); return; }
      setAllModes(modes);
      if (!modes.find((m) => m.mode === selectedMode)) setSelectedMode(modes[0].mode);

      // Backend dose calculation
      try {
        const routeParams = modes.map((m) => ({
          mode: m.mode, label: m.label,
          distance_km: m.routes[0]?.distanceKm || 10,
          duration_min: m.routes[0]?.durationMin || 20,
          activity_mode: m.activityMode,
        }));
        const result = await fetchMultiCommuteComparison({
          origin: { latitude: origin.lat, longitude: origin.lng },
          routes: routeParams,
        });
        const dmap = {};
        (result.data.routes || []).forEach((d) => { dmap[d.mode] = d; });
        setDoseByMode(dmap);
        if (result.data.safest_mode) { setSafestMode(result.data.safest_mode); setSelectedMode(result.data.safest_mode); }
      } catch {
        const dmap = {};
        modes.forEach((m) => {
          dmap[m.mode] = { mode: m.mode, label: m.label, dose_ug: m.routes[0]?.estimatedDose || 0,
            duration_min: m.routes[0]?.durationMin || 0, distance_km: m.routes[0]?.distanceKm || 0, co2_kg: 0 };
        });
        setDoseByMode(dmap);
        const sorted = [...modes].sort((a, b) => (a.routes[0]?.estimatedDose || 999) - (b.routes[0]?.estimatedDose || 999));
        setSafestMode(sorted[0]?.mode);
      }
    } catch (err) {
      setError('Could not fetch routes.'); console.error(err);
    } finally { setLoading(false); }
  }, [origin, destination, selectedMode]);

  useEffect(() => { if (origin && destination) fetchRoutes(); }, [origin, destination]); // eslint-disable-line

  // ── Derived state ──
  const curMode = allModes.find((m) => m.mode === selectedMode);
  const curRoutes = curMode?.routes || [];
  const curRoute = curRoutes[selectedAlt] || curRoutes[0];
  const basePM25 = currentAqi?.pm25 || 100;

  // Build colored segments for each alternative
  const coloredAlts = curRoutes.map((r, idx) => ({
    ...r,
    segments: r.isTransit ? [] : colorizeRoute(r.coordinates, basePM25, curMode?.pm25Multiplier || 1.0, idx, 8),
  }));

  const selectedColored = coloredAlts[selectedAlt] || coloredAlts[0];

  // Collect all route coords for FitBounds (include all alternatives)
  const allRouteCoords = curRoutes.flatMap((r) => (r.coordinates || []).filter(c => !isNaN(c[0])));
  const mapCoords = allRouteCoords.length > 1 ? allRouteCoords : curRoute?.coordinates?.filter(c => !isNaN(c[0]));

  // For transit modes, extract transit lines for rendering
  const transitLines = curRoute?.transitLines || [];
  const isTransitMode = curMode?.type === 'transit';

  // ── Dose color helper: green → yellow → orange → red ──
  const allDoses = Object.values(doseByMode).map((d) => d.dose_ug).filter(Boolean);
  const minDose = Math.min(...allDoses, 999);
  const maxDose = Math.max(...allDoses, 1);
  function getDoseColor(dose) {
    if (!dose || allDoses.length < 2) return 'var(--text-primary)';
    const ratio = (dose - minDose) / (maxDose - minDose || 1); // 0 = safest, 1 = worst
    if (ratio <= 0.25) return '#2E7D32'; // Green — safest
    if (ratio <= 0.5) return '#F9A825';  // Yellow — moderate
    if (ratio <= 0.75) return '#EF6C00'; // Orange — high
    return '#C62828';                     // Red — worst
  }
  function getDoseBg(dose) {
    if (!dose || allDoses.length < 2) return 'transparent';
    const ratio = (dose - minDose) / (maxDose - minDose || 1);
    if (ratio <= 0.25) return '#E8F5E9';
    if (ratio <= 0.5) return '#FFF8E1';
    if (ratio <= 0.75) return '#FFF3E0';
    return '#FFEBEE';
  }
  function getDoseLabel(dose) {
    if (!dose || allDoses.length < 2) return '';
    const ratio = (dose - minDose) / (maxDose - minDose || 1);
    if (ratio <= 0.25) return 'Low';
    if (ratio <= 0.5) return 'Moderate';
    if (ratio <= 0.75) return 'High';
    return 'Very High';
  }

  return (
    <div className="cdc">
      {/* ── Search ── */}
      <div className="card cdc-search">
        <div className="cdc-search-row">
          <div className="cdc-source-wrap">
            <PlaceInput label="Start" value={origin?.label || ''} onChange={setOrigin} placeholder="Starting point..." />
            <button className="cdc-detect-btn" onClick={handleDetectSource}
              disabled={detectingGPS} title="Detect my location">
              {detectingGPS ? (
                <span className="cdc-spin" />
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                  <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
                </svg>
              )}
            </button>
          </div>
          <span className="cdc-arrow">→</span>
          <PlaceInput label="Destination" value="" onChange={setDestination} placeholder="Where to?" />
        </div>
        {loading && <div className="cdc-status"><span className="cdc-spin" /> Finding routes across all modes...</div>}
        {error && <div className="cdc-status cdc-status--err">⚠️ {error}</div>}
      </div>

      {/* ── Safest Recommendation ── */}
      {safestMode && allModes.length > 1 && (
        <div className="cdc-recommend">
          <span className="cdc-recommend-shield">🛡️</span>
          <div>
            <strong>Safest: {MODE_CONFIG[safestMode]?.icon} {MODE_CONFIG[safestMode]?.label}</strong>
            {doseByMode[safestMode] && <span className="cdc-recommend-dose"> — {doseByMode[safestMode].dose_ug} µg inhaled</span>}
          </div>
        </div>
      )}

      {/* ── 6-Mode Selector ── */}
      {allModes.length > 0 && (
        <div className="cdc-modes">
          {allModes.map((m) => {
            const active = m.mode === selectedMode;
            const safest = m.mode === safestMode;
            const dose = doseByMode[m.mode];
            const doseVal = dose?.dose_ug;
            const dColor = getDoseColor(doseVal);
            const dBg = getDoseBg(doseVal);
            const dLabel = getDoseLabel(doseVal);
            return (
              <button key={m.mode}
                className={`cdc-mode ${active ? 'cdc-mode--on' : ''} ${safest ? 'cdc-mode--safest' : ''}`}
                onClick={() => { setSelectedMode(m.mode); setSelectedAlt(0); }}
                style={active ? { borderColor: m.color } : {}}>
                <span className="cdc-mode-icon">{m.icon}</span>
                <span className="cdc-mode-name">{m.label}</span>
                {doseVal != null && (
                  <span className="cdc-mode-dose-pill" style={{ color: dColor, background: dBg }}>
                    {doseVal} µg
                  </span>
                )}
                <span className="cdc-mode-time">{m.routes[0]?.durationMin || '—'} min</span>
                {dLabel && <span className="cdc-mode-risk" style={{ color: dColor }}>{dLabel}</span>}
                {safest && <span className="cdc-mode-badge">🛡️ Safest</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Route Alternatives Panel (clickable list below mode selector) ── */}
      {curRoutes.length > 1 && (
        <div className="cdc-alts">
          <span className="cdc-alts-title">📍 Routes — click to select (or click on map):</span>
          <div className="cdc-alts-row">
            {curRoutes.map((r, idx) => {
              const avg = coloredAlts[idx]?.segments ? calcRouteAvgPM25(coloredAlts[idx].segments) : '—';
              const isSelected = idx === selectedAlt;
              return (
                <button key={r.id}
                  className={`cdc-alt ${isSelected ? 'cdc-alt--on' : ''}`}
                  onClick={() => setSelectedAlt(idx)}>
                  <strong>{r.altLabel}</strong>
                  <span>{r.distanceKm} km · {r.durationMin} min</span>
                  {!r.isTransit && <span className="cdc-alt-aqi">PM2.5 avg: {avg}</span>}
                  {isSelected && <span className="cdc-alt-selected">✓ Selected</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MAP ── */}
      {(allModes.length > 0 || origin) && (
        <div className="card cdc-map-wrap">
          <MapContainer center={origin ? [origin.lat, origin.lng] : [20.59, 78.96]} zoom={12}
            className="cdc-map" scrollWheelZoom={true}>
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {mapCoords?.length > 1 && <FitBounds coords={mapCoords} />}

            {/* ── ALL non-selected alternatives rendered FIRST (behind) ── */}
            {coloredAlts.map((r, idx) => {
              if (idx === selectedAlt) return null;
              const routeLabel = `${r.altLabel} · ${r.distanceKm} km · ${r.durationMin} min`;
              if (r.isTransit) {
                // Transit alternative: show as single faded line
                const tLines = r.transitLines || [];
                if (tLines.length > 0) {
                  return <TransitLines key={r.id + '-fade'} lines={tLines} weight={4} opacity={0.35} />;
                }
                return <Polyline key={r.id + '-fade'}
                  positions={r.coordinates?.filter(c => !isNaN(c[0])) || []}
                  color={curMode?.color || '#999'} weight={4} opacity={0.35}
                  eventHandlers={{ click: () => setSelectedAlt(idx) }}>
                  <Tooltip sticky>{routeLabel}</Tooltip>
                </Polyline>;
              }
              // Road alternative: show AQI-colored but faded
              if (r.segments?.length) {
                return <ColoredRoute key={r.id + '-fade'} segments={r.segments}
                  weight={5} opacity={0.35}
                  onClick={() => setSelectedAlt(idx)}
                  tooltip={routeLabel} />;
              }
              return null;
            })}

            {/* ── SELECTED route rendered ON TOP: THICK + vivid ── */}
            {isTransitMode && transitLines.length > 0 && (
              <TransitLines lines={transitLines} weight={7} opacity={1.0} />
            )}
            {isTransitMode && transitLines.length === 0 && selectedColored?.coordinates && (
              <Polyline positions={selectedColored.coordinates.filter(c => !isNaN(c[0]))}
                color={curMode?.color || '#7B1FA2'} weight={7} opacity={1.0}>
                <Tooltip sticky>{curMode?.icon} {curMode?.label}</Tooltip>
              </Polyline>
            )}
            {!isTransitMode && selectedColored?.segments?.length > 0 && (
              <ColoredRoute segments={selectedColored.segments} weight={7} opacity={1.0}
                tooltip={`${selectedColored.altLabel} (selected) · ${selectedColored.distanceKm} km`} />
            )}

            {/* ── Markers ── */}
            {origin && <Marker position={[origin.lat, origin.lng]} icon={startIcon} />}
            {destination && <Marker position={[destination.lat, destination.lng]} icon={endIcon} />}
          </MapContainer>

          {/* Legend */}
          <div className="cdc-legend">
            {isTransitMode ? (
              <>
                <span className="cdc-legend-title">{curMode?.icon} {curMode?.label} Lines</span>
                {transitLines.length > 0 ? (
                  transitLines.slice(0, 8).map((l, i) => (
                    <span key={i} className="cdc-legend-item">
                      <span className="cdc-legend-dot" style={{ background: l.color || curMode?.color }} />
                      {l.name}
                    </span>
                  ))
                ) : (
                  <span className="cdc-legend-item" style={{ color: 'var(--text-muted)' }}>
                    Route shown along roads (no metro/bus data for this area)
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="cdc-legend-title">Air Quality:</span>
                {getColorLegend().map((item) => (
                  <span key={item.color} className="cdc-legend-item">
                    <span className="cdc-legend-dot" style={{ background: item.color }} />
                    {item.label}
                  </span>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Route Stats ── */}
      {curRoute && (
        <div className="card cdc-stats">
          <div className="cdc-stats-header">
            <span style={{ color: curMode?.color, fontSize: '1.2rem' }}>{curMode?.icon}</span>
            <h3>{curMode?.label} — {curRoute.altLabel}</h3>
            {selectedMode === safestMode && <span className="cdc-safe-pill">🛡️ Lowest Exposure</span>}
          </div>
          <div className="cdc-stats-grid">
            <div className="cdc-stat-box" style={{ background: getDoseBg(doseByMode[selectedMode]?.dose_ug ?? curRoute.estimatedDose) }}>
              <span className="cdc-stat-num" style={{ color: getDoseColor(doseByMode[selectedMode]?.dose_ug ?? curRoute.estimatedDose) }}>
                {doseByMode[selectedMode]?.dose_ug ?? curRoute.estimatedDose}
              </span>
              <span className="cdc-stat-unit">µg inhaled</span>
            </div>
            <div className="cdc-stat-box">
              <span className="cdc-stat-num">{curRoute.durationMin}</span>
              <span className="cdc-stat-unit">minutes</span>
            </div>
            <div className="cdc-stat-box">
              <span className="cdc-stat-num">{curRoute.distanceKm}</span>
              <span className="cdc-stat-unit">km</span>
            </div>
            <div className="cdc-stat-box">
              <span className="cdc-stat-num">
                {!isTransitMode && selectedColored?.segments ? calcRouteAvgPM25(selectedColored.segments) : Math.round(basePM25 * (curMode?.pm25Multiplier || 1))}
              </span>
              <span className="cdc-stat-unit">avg PM2.5</span>
            </div>
          </div>

          {/* ── Comparison Bars with dose colors ── */}
          {Object.keys(doseByMode).length > 1 && (
            <div className="cdc-dose-bars">
              <span className="cdc-bars-title">Pollution Exposure by Transport</span>
              {allModes.map((m) => {
                const dose = doseByMode[m.mode];
                if (!dose) return null;
                const maxD = Math.max(...Object.values(doseByMode).map((d) => d.dose_ug), 1);
                const pct = Math.max((dose.dose_ug / maxD) * 100, 4);
                const barColor = getDoseColor(dose.dose_ug);
                return (
                  <div key={m.mode}
                    className={`cdc-bar-row ${m.mode === selectedMode ? 'cdc-bar-row--on' : ''}`}
                    onClick={() => { setSelectedMode(m.mode); setSelectedAlt(0); }}>
                    <span className="cdc-bar-name">{m.icon} {m.label}</span>
                    <div className="cdc-bar-track">
                      <div className="cdc-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
                    </div>
                    <span className="cdc-bar-val" style={{ color: barColor }}>{dose.dose_ug} µg</span>
                    <span className="cdc-bar-risk" style={{ color: barColor }}>{getDoseLabel(dose.dose_ug)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CommuteDoseCalculator;
