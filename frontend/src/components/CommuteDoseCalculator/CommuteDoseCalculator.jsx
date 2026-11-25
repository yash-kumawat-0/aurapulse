// ============================================
// CommuteDoseCalculator — Full Multi-Route Map
//   • 6 modes: Car, Two-Wheeler, Metro, Bus, Walk, Bicycle
//   • Metro keeps ALL city lines in official colors:
//       - Traveling A -> B line highlighted BOLD + THICK
//       - Rest of metro network stays visible in THIN lines
//   • Bold Safe/Danger color-coded transport cards
//   • Clickable road route alternatives on map
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
      try { map.fitBounds(L.latLngBounds(coords), { padding: [45, 45], maxZoom: 15 }); } catch { /* skip */ }
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

// ── Transit Lines Renderer: Inactive Thin Official Lines + Active Thick Route Highlight ──
function TransitNetworkLayers({ lines, origin, destination, boardPoint, alightPoint }) {
  if (!lines?.length) return null;

  const hasActiveFlag = lines.some((l) => l.isActive !== undefined);
  const inactiveLines = hasActiveFlag ? lines.filter((l) => !l.isActive) : [];
  const activeLines = hasActiveFlag ? lines.filter((l) => l.isActive) : lines;

  const renderLinePolylines = (line, idx, keyPrefix, weight, opacity, useActiveSlice = false) => {
    const segList = (useActiveSlice && line.activeSegments?.length)
      ? line.activeSegments
      : (line.segments?.length ? line.segments : [line.coordinates]);
    const color = line.color || '#7B1FA2';

    return segList.map((coords, sIdx) => {
      const valid = (coords || []).filter((c) => c && !isNaN(c[0]) && !isNaN(c[1]));
      if (valid.length < 2) return null;
      return (
        <Polyline
          key={`${keyPrefix}-${idx}-${sIdx}`}
          positions={valid}
          color={color}
          weight={weight}
          opacity={opacity}
        >
          {sIdx === 0 && (
            <Tooltip sticky>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: 'inline-block' }} />
                {line.name} {line.isActive ? ' (Your Route)' : ''}
              </span>
            </Tooltip>
          )}
        </Polyline>
      );
    });
  };

  return (
    <>
      {/* 1) Remaining city metro lines — visible as thin colored lines */}
      {inactiveLines.map((line, i) => renderLinePolylines(line, i, 'thin', 3.5, 0.55, false))}

      {/* 2) Full path of active line faintly if active slice is shorter */}
      {activeLines.map((line, i) =>
        line.activeSegments?.length ? renderLinePolylines(line, i, 'active-base', 3.5, 0.45, false) : null
      )}

      {/* 3) Subtle dotted first/last-mile connectors to boarding & alighting points */}
      {origin && boardPoint && (
        <Polyline
          positions={[[origin.lat, origin.lng], boardPoint]}
          color="#475569"
          weight={3}
          opacity={0.75}
          dashArray="6 8"
        />
      )}
      {destination && alightPoint && (
        <Polyline
          positions={[alightPoint, [destination.lat, destination.lng]]}
          color="#475569"
          weight={3}
          opacity={0.75}
          dashArray="6 8"
        />
      )}

      {/* 4) Active Point A -> Point B corridor — crisp white halo + bold thick official color */}
      {activeLines.map((line, i) => {
        const segList = (line.activeSegments?.length ? line.activeSegments : line.segments) || [line.coordinates];
        return segList.map((coords, sIdx) => {
          const valid = (coords || []).filter((c) => c && !isNaN(c[0]) && !isNaN(c[1]));
          if (valid.length < 2) return null;
          return (
            <Polyline
              key={`halo-${i}-${sIdx}`}
              positions={valid}
              color="#FFFFFF"
              weight={13}
              opacity={0.92}
            />
          );
        });
      })}
      {activeLines.map((line, i) => renderLinePolylines(line, i, 'active-top', 8, 1.0, true))}
    </>
  );
}

// ========== MAIN COMPONENT ==========
function CommuteDoseCalculator() {
  const { location } = useUser();
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
      const loc = { lat: location.lat, lng: location.lng, label: location.label };
      setOrigin(loc);

      if (location.label && location.label.match(/^[\d.\-,\s]+$/)) {
        reverseGeocode(location.lat, location.lng).then((name) => {
          setOrigin((prev) => (prev ? { ...prev, label: name } : prev));
        }).catch(() => {});
      }
    }
  }, [location, origin]);

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

  const fetchRoutes = useCallback(async () => {
    if (!origin || !destination) return;
    setLoading(true); setError(null);
    setAllModes([]); setDoseByMode({}); setSafestMode(null); setSelectedAlt(0);

    try {
      const modes = await fetchAllModesRoutes(origin.lat, origin.lng, destination.lat, destination.lng);
      if (!modes.length) { setError('No routes found.'); setLoading(false); return; }
      setAllModes(modes);
      if (!modes.find((m) => m.mode === selectedMode)) setSelectedMode(modes[0].mode);

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
          dmap[m.mode] = {
            mode: m.mode, label: m.label, dose_ug: m.routes[0]?.estimatedDose || 0,
            duration_min: m.routes[0]?.durationMin || 0, distance_km: m.routes[0]?.distanceKm || 0, co2_kg: 0,
          };
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

  const curMode = allModes.find((m) => m.mode === selectedMode);
  const curRoutes = curMode?.routes || [];
  const curRoute = curRoutes[selectedAlt] || curRoutes[0];
  const basePM25 = currentAqi?.pm25 || 100;

  const coloredAlts = curRoutes.map((r, idx) => ({
    ...r,
    segments: r.isTransit ? [] : colorizeRoute(r.coordinates, basePM25, curMode?.pm25Multiplier || 1.0, idx, 8),
  }));

  const selectedColored = coloredAlts[selectedAlt] || coloredAlts[0];
  const transitLines = curRoute?.transitLines || [];
  const isTransitMode = curMode?.type === 'transit';

  // Fit bounds neatly to active route + start/end markers (keeps A->B focused while rest of metro stays visible)
  const mapCoords = (() => {
    if (isTransitMode && origin && destination) {
      const activeCoords = transitLines
        .filter((l) => l.isActive)
        .flatMap((l) => (l.activeSegments?.length ? l.activeSegments.flat() : l.coordinates || []))
        .filter((c) => c && !isNaN(c[0]));
      return [[origin.lat, origin.lng], [destination.lat, destination.lng], ...activeCoords];
    }
    const allRouteCoords = curRoutes.flatMap((r) => (r.coordinates || []).filter((c) => !isNaN(c[0])));
    return allRouteCoords.length > 1 ? allRouteCoords : curRoute?.coordinates?.filter((c) => !isNaN(c[0]));
  })();

  // ── Safety tier styling (bold SAFE -> MODERATE -> HIGH -> DANGER colors) ──
  const allDoses = Object.values(doseByMode).map((d) => d.dose_ug).filter((v) => v != null);
  const minDose = Math.min(...allDoses, 999);
  const maxDose = Math.max(...allDoses, 1);

  function getRiskTier(dose) {
    if (dose == null || allDoses.length < 2) {
      return { color: '#334155', bg: '#F8FAFC', border: '#CBD5E1', pillBg: '#E2E8F0', label: 'ESTIMATE', icon: '📊' };
    }
    const ratio = (dose - minDose) / (maxDose - minDose || 1);
    if (ratio <= 0.25) {
      return { color: '#15803D', bg: '#F0FDF4', border: '#22C55E', pillBg: '#DCFCE7', label: 'SAFE', icon: '🛡️' };
    }
    if (ratio <= 0.5) {
      return { color: '#B45309', bg: '#FFFBEB', border: '#F59E0B', pillBg: '#FEF3C7', label: 'MODERATE', icon: '⚡' };
    }
    if (ratio <= 0.75) {
      return { color: '#C2410C', bg: '#FFF7ED', border: '#F97316', pillBg: '#FFEDD5', label: 'HIGH RISK', icon: '⚠️' };
    }
    return { color: '#B91C1C', bg: '#FEF2F2', border: '#EF4444', pillBg: '#FEE2E2', label: 'DANGER', icon: '🚨' };
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
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
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
            <strong>Safest Choice: {MODE_CONFIG[safestMode]?.icon} {MODE_CONFIG[safestMode]?.label}</strong>
            {doseByMode[safestMode] && <span className="cdc-recommend-dose"> — {doseByMode[safestMode].dose_ug} µg inhaled</span>}
          </div>
        </div>
      )}

      {/* ── Bold Safe/Danger 6-Mode Transport Cards ── */}
      {allModes.length > 0 && (
        <div className="cdc-modes">
          {allModes.map((m) => {
            const active = m.mode === selectedMode;
            const safest = m.mode === safestMode;
            const dose = doseByMode[m.mode];
            const doseVal = dose?.dose_ug ?? m.routes[0]?.estimatedDose;
            const risk = getRiskTier(doseVal);

            return (
              <button
                key={m.mode}
                type="button"
                className={`cdc-mode ${active ? 'cdc-mode--on' : ''}`}
                onClick={() => { setSelectedMode(m.mode); setSelectedAlt(0); }}
                style={{
                  background: risk.bg,
                  borderColor: active ? risk.color : risk.border,
                  borderLeftColor: risk.color,
                  boxShadow: active ? `0 0 0 2px ${risk.color}35, 0 8px 20px rgba(15,23,42,0.1)` : undefined,
                }}
              >
                <div className="cdc-mode-top">
                  <span className="cdc-mode-icon">{m.icon}</span>
                  <span className="cdc-mode-name">{m.label}</span>
                  {safest && <span className="cdc-mode-safest-tag">BEST</span>}
                </div>

                <div className="cdc-mode-mid">
                  <span className="cdc-mode-dose" style={{ color: risk.color }}>
                    {doseVal ?? '—'} <small>µg</small>
                  </span>
                  <span className="cdc-mode-risk-pill" style={{ background: risk.pillBg, color: risk.color }}>
                    {risk.icon} {risk.label}
                  </span>
                </div>

                <div className="cdc-mode-foot">
                  <span>⏱️ {m.routes[0]?.durationMin || '—'} min</span>
                  <span>• {m.routes[0]?.distanceKm || '—'} km</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Route Alternatives Panel ── */}
      {curRoutes.length > 1 && (
        <div className="cdc-alts">
          <span className="cdc-alts-title">📍 Route Options — click to select (or tap on map):</span>
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
                  {!r.isTransit && <span className="cdc-alt-aqi">Avg PM2.5: {avg}</span>}
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

            {/* ── Non-selected road/bus alternatives faded behind ── */}
            {!isTransitMode && coloredAlts.map((r, idx) => {
              if (idx === selectedAlt || !r.segments?.length) return null;
              return (
                <ColoredRoute
                  key={r.id + '-fade'}
                  segments={r.segments}
                  weight={5}
                  opacity={0.35}
                  onClick={() => setSelectedAlt(idx)}
                  tooltip={`${r.altLabel} · ${r.distanceKm} km · ${r.durationMin} min`}
                />
              );
            })}

            {isTransitMode && curMode?.mode === 'BUS' && coloredAlts.map((r, idx) => {
              if (idx === selectedAlt) return null;
              return (
                <TransitNetworkLayers
                  key={r.id + '-fade'}
                  lines={r.transitLines}
                />
              );
            })}

            {/* ── METRO: Highlight traveling A -> B line thick + rest of city metro lines thin with official colors ── */}
            {isTransitMode && transitLines.length > 0 && (
              <TransitNetworkLayers
                lines={transitLines}
                origin={origin}
                destination={destination}
                boardPoint={curRoute?.boardPoint}
                alightPoint={curRoute?.alightPoint}
              />
            )}

            {isTransitMode && transitLines.length === 0 && selectedColored?.coordinates && (
              <Polyline positions={selectedColored.coordinates.filter((c) => !isNaN(c[0]))}
                color={curMode?.color || '#7B1FA2'} weight={7} opacity={1.0}>
                <Tooltip sticky>{curMode?.icon} {curMode?.label}</Tooltip>
              </Polyline>
            )}

            {!isTransitMode && selectedColored?.segments?.length > 0 && (
              <ColoredRoute segments={selectedColored.segments} weight={7.5} opacity={1.0}
                tooltip={`${selectedColored.altLabel} (selected) · ${selectedColored.distanceKm} km`} />
            )}

            {origin && <Marker position={[origin.lat, origin.lng]} icon={startIcon} />}
            {destination && <Marker position={[destination.lat, destination.lng]} icon={endIcon} />}
          </MapContainer>

          {/* Legend */}
          <div className="cdc-legend">
            {isTransitMode ? (
              <>
                <span className="cdc-legend-title">{curMode?.icon} {curMode?.label} Network:</span>
                {transitLines.length > 0 ? (
                  [...transitLines]
                    .sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0))
                    .slice(0, 8)
                    .map((l, i) => (
                      <span
                        key={i}
                        className={`cdc-legend-item ${l.isActive ? 'cdc-legend-item--active' : 'cdc-legend-item--thin'}`}
                      >
                        <span
                          className="cdc-legend-dot"
                          style={{
                            background: l.color || curMode?.color,
                            height: l.isActive ? 10 : 4,
                            width: l.isActive ? 18 : 14,
                          }}
                        />
                        {l.name} {l.isActive ? '★ Active' : '(Thin)'}
                      </span>
                    ))
                ) : (
                  <span className="cdc-legend-item" style={{ color: 'var(--text-muted)' }}>
                    Estimated corridor for this area
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
      {curRoute && (() => {
        const curDose = doseByMode[selectedMode]?.dose_ug ?? curRoute.estimatedDose;
        const curRisk = getRiskTier(curDose);
        return (
          <div className="card cdc-stats">
            <div className="cdc-stats-header">
              <span style={{ color: curMode?.color, fontSize: '1.35rem' }}>{curMode?.icon}</span>
              <h3>{curMode?.label} — {curRoute.altLabel}</h3>
              <span className="cdc-safe-pill" style={{ background: curRisk.pillBg, color: curRisk.color }}>
                {curRisk.icon} {curRisk.label}
              </span>
            </div>
            <div className="cdc-stats-grid">
              <div className="cdc-stat-box" style={{ background: curRisk.bg, borderColor: curRisk.border }}>
                <span className="cdc-stat-num" style={{ color: curRisk.color }}>
                  {curDose}
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
                  {!isTransitMode && selectedColored?.segments
                    ? calcRouteAvgPM25(selectedColored.segments)
                    : Math.round(basePM25 * (curMode?.pm25Multiplier || 1))}
                </span>
                <span className="cdc-stat-unit">avg PM2.5</span>
              </div>
            </div>

            {Object.keys(doseByMode).length > 1 && (
              <div className="cdc-dose-bars">
                <span className="cdc-bars-title">Pollution Exposure by Transport</span>
                {allModes.map((m) => {
                  const dose = doseByMode[m.mode];
                  if (!dose) return null;
                  const maxD = Math.max(...Object.values(doseByMode).map((d) => d.dose_ug), 1);
                  const pct = Math.max((dose.dose_ug / maxD) * 100, 4);
                  const barRisk = getRiskTier(dose.dose_ug);
                  return (
                    <div key={m.mode}
                      className={`cdc-bar-row ${m.mode === selectedMode ? 'cdc-bar-row--on' : ''}`}
                      onClick={() => { setSelectedMode(m.mode); setSelectedAlt(0); }}>
                      <span className="cdc-bar-name">{m.icon} {m.label}</span>
                      <div className="cdc-bar-track">
                        <div className="cdc-bar-fill" style={{ width: `${pct}%`, background: barRisk.color }} />
                      </div>
                      <span className="cdc-bar-val" style={{ color: barRisk.color }}>{dose.dose_ug} µg</span>
                      <span className="cdc-bar-risk" style={{ color: barRisk.color }}>{barRisk.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

export default CommuteDoseCalculator;
