// ============================================
// CommuteDoseCalculator — Full Multi-Route Map
//   • 6 modes: Car, Two-Wheeler, Metro, Bus, Walk, Bicycle
//   • Metro:
//       - When 1 line is selected: highlight ONLY that line bold in original color; rest are thin light original color
//       - When none selected: ALL lines shown thin in light original colors
//       - Click any metro line on map or pill above map to toggle selection
//   • Toggleable colored AQI zones right on the map
//   • Bold Safe/Danger color-coded transport cards
// ============================================
import { Fragment, useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useUser } from '../../context/UserContext.jsx';
import { useAqi } from '../../context/AqiContext.jsx';
import { reverseGeocode } from '../../utils/geocoder.js';
import { fetchAllModesRoutes, MODE_CONFIG } from '../../utils/routingService.js';
import { fetchMetroLines, lightenHex } from '../../utils/transitService.js';
import {
  colorizeRoute,
  getColorLegend,
  calcRouteAvgPM25,
} from '../../utils/aqiRouteColorizer.js';
import { fetchMultiCommuteComparison, fetchOriginCommuteBrief } from '../../services/api.js';
import {
  startIcon,
  endIcon,
  estimateLegDoseUg,
  FitBounds,
  ViewportAqiOverlay,
  PlaceInput,
  ColoredRoute,
  TransitNetworkLayers,
} from './CommuteMapLayers.jsx';
import './CommuteDoseCalculator.css';

// ========== MAIN COMPONENT ==========
function CommuteDoseCalculator() {
  const { location, language } = useUser();
  const { currentAqi, setCommuteData } = useAqi();

  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [allModes, setAllModes] = useState([]);
  const [selectedMode, setSelectedMode] = useState('DRIVE');
  const [selectedAlt, setSelectedAlt] = useState(0);
  const [selectedMetroLineIdx, setSelectedMetroLineIdx] = useState(null);
  const [previewMetroLines, setPreviewMetroLines] = useState([]);
  const [showAqiZones, setShowAqiZones] = useState(true);
  const [doseByMode, setDoseByMode] = useState({});
  const [safestMode, setSafestMode] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [originBrief, setOriginBrief] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [detectingGPS, setDetectingGPS] = useState(false);

  // Auto-run Gemini departure & street smog brief as soon as Start location loads
  useEffect(() => {
    if (!origin?.lat || !origin?.lng) return undefined;
    let active = true;
    setBriefLoading(true);
    fetchOriginCommuteBrief({
      lat: origin.lat,
      lng: origin.lng,
      origin_label: origin.label,
      language,
    })
      .then((res) => {
        if (active && res?.data?.brief) setOriginBrief(res.data);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setBriefLoading(false);
      });
    return () => { active = false; };
  }, [origin?.lat, origin?.lng, origin?.label, language]);

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

  // Also preview city metro lines in light thin official colors before Destination is entered
  useEffect(() => {
    if (!origin || destination) return;
    fetchMetroLines(origin.lat, origin.lng, origin.lat, origin.lng)
      .then((lines) => {
        setPreviewMetroLines(
          lines.map((l) => ({ ...l, lightColor: lightenHex(l.color, 0.52) }))
        );
      })
      .catch(() => setPreviewMetroLines([]));
  }, [origin, destination]);

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
    setAllModes([]); setDoseByMode({}); setSafestMode(null); setAiAnalysis(null); setSelectedAlt(0);
    setSelectedMetroLineIdx(null);

    try {
      const modes = await fetchAllModesRoutes(origin.lat, origin.lng, destination.lat, destination.lng);
      if (!modes.length) { setError('No routes found.'); setLoading(false); return; }
      setAllModes(modes);

      // Set single recommended metro line index from A->B route
      const metroMode = modes.find((m) => m.mode === 'METRO');
      const defLineIdx = metroMode?.routes?.[0]?.defaultActiveLineIndex;
      if (defLineIdx !== undefined && defLineIdx !== null) {
        setSelectedMetroLineIdx(defLineIdx);
      }

      setSelectedMode((prev) => (modes.find((m) => m.mode === prev) ? prev : modes[0].mode));

      try {
        const routeParams = modes.map((m) => ({
          mode: m.mode,
          label: m.label,
          distance_km: m.routes[0]?.distanceKm || 10,
          duration_min: m.routes[0]?.durationMin || 20,
          activity_mode: m.activityMode,
          legs: m.routes[0]?.autoPlan?.legs,
        }));
        const result = await fetchMultiCommuteComparison({
          origin: { latitude: origin.lat, longitude: origin.lng },
          origin_label: origin.label,
          destination_label: destination.label,
          language,
          routes: routeParams,
        });
        const dmap = {};
        (result.data.routes || []).forEach((d) => { dmap[d.mode] = d; });
        setDoseByMode(dmap);
        setAiAnalysis(result.data.ai_commute_analysis || null);
        setCommuteData?.(result.data);
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
  }, [origin, destination, language, setCommuteData]);

  useEffect(() => {
    if (origin && destination) {
      fetchRoutes();
    }
  }, [origin, destination, fetchRoutes]);

  const curMode = allModes.find((m) => m.mode === selectedMode);
  const curRoutes = curMode?.routes || [];
  const curRoute = curRoutes[selectedAlt] || curRoutes[0];
  const basePM25 = currentAqi?.pm25 || 100;

  const coloredAlts = curRoutes.map((r, idx) => ({
    ...r,
    segments: r.isTransit ? [] : colorizeRoute(r.coordinates, basePM25, curMode?.pm25Multiplier || 1.0, idx, 8),
  }));

  const selectedColored = coloredAlts[selectedAlt] || coloredAlts[0];
  const isMetroMode = curMode?.mode === 'METRO';
  const isTransitMode = curMode?.type === 'transit';
  const metroLinesToRender = isMetroMode && curRoute?.transitLines?.length
    ? curRoute.transitLines
    : (!destination ? previewMetroLines : []);
  const busLines = curMode?.mode === 'BUS' ? (curRoute?.transitLines || []) : [];

  // Keep map camera neatly framed around origin/destination & selected line or interchange
  const mapCoords = (() => {
    if (isMetroMode && origin && destination) {
      if (selectedMetroLineIdx === 'interchange' && curRoute?.interchangePlan?.segments?.length) {
        const xCoords = curRoute.interchangePlan.segments.flatMap((s) => s.coords || []);
        return [[origin.lat, origin.lng], [destination.lat, destination.lng], ...xCoords]
          .filter((c) => c && !isNaN(c[0]));
      }
      const selLine = typeof selectedMetroLineIdx === 'number' ? metroLinesToRender[selectedMetroLineIdx] : null;
      const selCoords = selLine
        ? (selLine.activeSegments?.length ? selLine.activeSegments.flat() : selLine.coordinates || [])
        : [];
      return [[origin.lat, origin.lng], [destination.lat, destination.lng], ...selCoords]
        .filter((c) => c && !isNaN(c[0]));
    }
    const allRouteCoords = curRoutes.flatMap((r) => (r.coordinates || []).filter((c) => !isNaN(c[0])));
    return allRouteCoords.length > 1 ? allRouteCoords : curRoute?.coordinates?.filter((c) => !isNaN(c[0]));
  })();

  // ── Safety tier helper ──
  const allDoses = Object.values(doseByMode).map((d) => d.dose_ug).filter((v) => v != null);
  const minDose = Math.min(...allDoses, 999);
  const maxDose = Math.max(...allDoses, 1);

  function getRiskTier(dose) {
    if (dose == null || allDoses.length < 2) {
      return { color: '#334155', bg: '#F8FAFC', border: '#CBD5E1', pillBg: '#E2E8F0', label: 'ESTIMATE', icon: '📊' };
    }
    const ratio = (dose - minDose) / (maxDose - minDose || 1);
    if (ratio <= 0.25) return { color: '#15803D', bg: '#F0FDF4', border: '#22C55E', pillBg: '#DCFCE7', label: 'SAFE', icon: '🛡️' };
    if (ratio <= 0.5) return { color: '#B45309', bg: '#FFFBEB', border: '#F59E0B', pillBg: '#FEF3C7', label: 'MODERATE', icon: '⚡' };
    if (ratio <= 0.75) return { color: '#C2410C', bg: '#FFF7ED', border: '#F97316', pillBg: '#FFEDD5', label: 'HIGH RISK', icon: '⚠️' };
    return { color: '#B91C1C', bg: '#FEF2F2', border: '#EF4444', pillBg: '#FEE2E2', label: 'DANGER', icon: '🚨' };
  }

  return (
    <div className="cdc">
      {/* ── Search ── */}
      <div className="card cdc-search">
        <div className="cdc-search-row">
          <div className="cdc-source-wrap">
            <PlaceInput label="Start" value={origin?.label || ''} onChange={setOrigin} placeholder="Starting point..." />
            <button
              type="button"
              className="cdc-detect-btn"
              onClick={handleDetectSource}
              disabled={detectingGPS}
              aria-label="Detect my current start location"
              title="Detect my location"
            >
              {detectingGPS ? (
                <span className="cdc-spin" aria-hidden="true" />
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
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

      {/* ── Live Origin Departure Window Brief (Runs Immediately on Start Location) ── */}
      {(originBrief?.brief || briefLoading) && allModes.length === 0 && (
        <div className="cdc-origin-brief">
          <div className="cdc-brief-left">
            <span className="cdc-brief-clock cdc-shield-pulse">⏰</span>
            <div>
              <div className="cdc-brief-top">
                <strong>
                  {originBrief?.brief?.best_leave_window
                    ? `Best Leave: ${originBrief.brief.best_leave_window}`
                    : 'Checking Best Departure Time...'}
                </strong>
                {originBrief?.brief?.departure_savings_pct > 0 && (
                  <span className="cdc-save-badge">−{originBrief.brief.departure_savings_pct}% smog</span>
                )}
                {originBrief?.brief?.ai_powered && (
                  <span className="cdc-ai-pill">✨ Gemini AI</span>
                )}
              </div>
              {originBrief?.brief?.headline_verdict && (
                <div className="cdc-ai-verdict">{originBrief.brief.headline_verdict}</div>
              )}
              {Array.isArray(originBrief?.brief?.origin_stickers) && (
                <div className="cdc-ai-tips">
                  {originBrief.brief.origin_stickers.map((st, idx) => (
                    <span key={idx} className="cdc-ai-tip-chip">{st.emoji || st.icon} {st.label}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Visual Animated Safe Recommendation Strip ── */}
      {safestMode && allModes.length > 1 && (
        <div className="cdc-recommend-wrap">
          <div className="cdc-recommend">
            <span className="cdc-recommend-shield cdc-shield-pulse">🛡️</span>
            <div className="cdc-recommend-main">
              <div className="cdc-recommend-top">
                <strong>Best: {MODE_CONFIG[safestMode]?.icon} {MODE_CONFIG[safestMode]?.label}</strong>
                {doseByMode[safestMode] && (
                  <span className="cdc-recommend-dose">{doseByMode[safestMode].dose_ug} µg</span>
                )}
                {aiAnalysis?.reduction_vs_worst_pct > 0 && (
                  <span className="cdc-save-badge">−{aiAnalysis.reduction_vs_worst_pct}% smog</span>
                )}
                {aiAnalysis?.cigarette_equivalent > 0 && (
                  <span className="cdc-cig-pill">🚬 Saves {aiAnalysis.cigarette_equivalent} cigs</span>
                )}
                {aiAnalysis?.best_leave_window && (
                  <span className="cdc-leave-pill">⏰ Leave {aiAnalysis.best_leave_window}</span>
                )}
                {aiAnalysis?.ai_powered && (
                  <span className="cdc-ai-pill">✨ Gemini AI</span>
                )}
              </div>

              {aiAnalysis?.headline_verdict && (
                <div className="cdc-ai-verdict">{aiAnalysis.headline_verdict}</div>
              )}

              {Array.isArray(aiAnalysis?.action_stickers) && aiAnalysis.action_stickers.length > 0 && (
                <div className="cdc-ai-tips">
                  {aiAnalysis.action_stickers.map((st, idx) => (
                    <span key={idx} className="cdc-ai-tip-chip">{st.emoji || st.icon} {st.label}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Bold Safe/Danger 6-Mode Transport Cards with Gemini Mode Stickers ── */}
      {allModes.length > 0 && (
        <div className="cdc-modes">
          {allModes.map((m) => {
            const active = m.mode === selectedMode;
            const safest = m.mode === safestMode;
            const dose = doseByMode[m.mode];
            const doseVal = dose?.dose_ug ?? m.routes[0]?.estimatedDose;
            const risk = getRiskTier(doseVal);
            const modeNote = aiAnalysis?.mode_notes?.find((n) => n.mode === m.mode);
            const rangePct = doseVal != null
              ? Math.min(100, Math.max(8, Math.round((doseVal / Math.max(maxDose, 1)) * 100)))
              : 0;

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

                {modeNote && (
                  <div className="cdc-mode-ai-note">
                    <span>{modeNote.emoji || '📊'}</span>
                    <span>{modeNote.note}</span>
                  </div>
                )}

                <div className="cdc-mode-foot">
                  <span>⏱️ {m.routes[0]?.durationMin || '—'} min</span>
                  <span>• {m.routes[0]?.distanceKm || '—'} km</span>
                </div>

                {/* Flush Bottom-Edge Direct Comparison Range Bar */}
                <div className="cdc-mode-range-track" title={`Relative exposure: ${rangePct}% of highest-dose mode`}>
                  <div
                    className="cdc-mode-range-fill"
                    style={{ width: `${rangePct}%`, background: risk.color }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Metro Line Switcher (Smart Interchange, Single Line, or Show All Thin) ── */}
      {(isMetroMode || !destination) && metroLinesToRender.length > 0 && (
        <div className="cdc-alts">
          <span className="cdc-alts-title">🚇 Metro Route — pick Interchange, Single Line, or All Thin:</span>
          <div className="cdc-alts-row">
            {isMetroMode && curRoute?.interchangePlan && (
              <button
                type="button"
                className={`cdc-metro-chip ${selectedMetroLineIdx === 'interchange' ? 'cdc-metro-chip--on' : ''}`}
                style={selectedMetroLineIdx === 'interchange' ? { borderColor: '#2563EB', background: '#EFF6FF' } : undefined}
                onClick={() => setSelectedMetroLineIdx('interchange')}
              >
                🔄 {curRoute.interchangePlan.lineAName} ⇄ {curRoute.interchangePlan.lineBName}
              </button>
            )}
            <button
              type="button"
              className={`cdc-metro-chip ${selectedMetroLineIdx === null ? 'cdc-metro-chip--on' : ''}`}
              onClick={() => setSelectedMetroLineIdx(null)}
            >
              All Lines (Thin)
            </button>
            {metroLinesToRender.map((line, i) => {
              const isSel = selectedMetroLineIdx === i;
              return (
                <button
                  key={i}
                  type="button"
                  className={`cdc-metro-chip ${isSel ? 'cdc-metro-chip--on' : ''}`}
                  style={{
                    borderColor: isSel ? line.color : (line.lightColor || line.color),
                    background: isSel ? `${line.color}16` : '#FFFFFF',
                  }}
                  onClick={() => setSelectedMetroLineIdx(isSel ? null : i)}
                >
                  <span
                    className="cdc-metro-swatch"
                    style={{ background: isSel ? line.color : (line.lightColor || line.color) }}
                  />
                  <span>{line.name.split('(')[0].trim()}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Road Route Alternatives Panel ── */}
      {!isMetroMode && curRoutes.length > 1 && (
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
          {/* Top-right Map Overlay Toggle for AQI Colors */}
          <button
            type="button"
            className={`cdc-aqi-toggle ${showAqiZones ? 'cdc-aqi-toggle--on' : ''}`}
            onClick={() => setShowAqiZones((s) => !s)}
            title="Show or hide colored AQI zones on map"
          >
            🎨 AQI Map Colors: <strong>{showAqiZones ? 'ON' : 'OFF'}</strong>
          </button>

          <MapContainer center={origin ? [origin.lat, origin.lng] : [20.59, 78.96]} zoom={12}
            className="cdc-map" scrollWheelZoom={true}>
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {mapCoords?.length > 1 && <FitBounds coords={mapCoords} />}

            {/* ── Colored AQI Overlay All Over Map ── */}
            {showAqiZones && <ViewportAqiOverlay basePM25={basePM25} />}

            {/* ── Road Alternatives (faded behind) ── */}
            {!isTransitMode && coloredAlts.map((r, idx) => {
              if (idx === selectedAlt || !r.segments?.length) return null;
              const altDose = Math.round(estimateLegDoseUg({ mode: selectedMode, activity_mode: curMode?.activityMode, duration_min: r.durationMin }, basePM25) * 10) / 10;
              return (
                <ColoredRoute
                  key={r.id + '-fade'}
                  segments={r.segments}
                  weight={5}
                  opacity={0.35}
                  onClick={() => setSelectedAlt(idx)}
                  tooltip={`${curMode?.icon} ${r.altLabel} · ${r.distanceKm} km · ${r.durationMin} min · ~${altDose} µg inhaled`}
                />
              );
            })}

            {/* ── METRO: All light-thin lines OR 1 bold line OR Smart Interchange + feeder connectors ── */}
            {metroLinesToRender.length > 0 && (
              <TransitNetworkLayers
                lines={metroLinesToRender}
                selectedIndex={isMetroMode ? selectedMetroLineIdx : (destination ? null : selectedMetroLineIdx)}
                onSelectLine={(idx) => setSelectedMetroLineIdx(idx)}
                origin={origin}
                destination={destination}
                firstMilePath={curRoute?.firstMilePath}
                lastMilePath={curRoute?.lastMilePath}
                interchangePlan={isMetroMode ? curRoute?.interchangePlan : null}
                basePM25={basePM25}
                evaluatedLegs={
                  isMetroMode && selectedMetroLineIdx === curRoute?.defaultActiveLineIndex
                    ? doseByMode.METRO?.legs
                    : null
                }
              />
            )}

            {/* Fallback Metro poly when city has no rail geometry */}
            {isMetroMode && metroLinesToRender.length === 0 && selectedColored?.coordinates && (
              <Polyline positions={selectedColored.coordinates.filter((c) => !isNaN(c[0]))}
                color={curMode?.color || '#7B1FA2'} weight={7} opacity={1.0}>
                <Tooltip sticky>{curMode?.icon} {curMode?.label}</Tooltip>
              </Polyline>
            )}

            {/* ── BUS Lines ── */}
            {curMode?.mode === 'BUS' && coloredAlts.map((r, idx) => {
              if (idx === selectedAlt) return null;
              return r.transitLines?.length ? (
                <TransitNetworkLayers key={r.id + '-bfade'} lines={r.transitLines} selectedIndex={null} />
              ) : null;
            })}
            {curMode?.mode === 'BUS' && busLines.length > 0 && (
              <TransitNetworkLayers lines={busLines} selectedIndex={0} />
            )}
            {curMode?.mode === 'BUS' && busLines.length === 0 && selectedColored?.coordinates && (
              <Polyline positions={selectedColored.coordinates.filter((c) => !isNaN(c[0]))}
                color={curMode?.color || '#0288D1'} weight={7} opacity={1.0}>
                <Tooltip sticky>🚌 Bus Route</Tooltip>
              </Polyline>
            )}

            {/* ── Selected Road Route ON TOP ── */}
            {!isTransitMode && selectedColored?.segments?.length > 0 && (() => {
              const selDose = Math.round(estimateLegDoseUg({ mode: selectedMode, activity_mode: curMode?.activityMode, duration_min: selectedColored.durationMin }, basePM25) * 10) / 10;
              return (
                <ColoredRoute segments={selectedColored.segments} weight={7.5} opacity={1.0}
                  tooltip={`${curMode?.icon} ${curMode?.label} (${selectedColored.altLabel}) · ${selectedColored.distanceKm} km · ~${doseByMode[selectedMode]?.dose_ug ?? selDose} µg inhaled`} />
              );
            })()}

            {origin && <Marker position={[origin.lat, origin.lng]} icon={startIcon} />}
            {destination && <Marker position={[destination.lat, destination.lng]} icon={endIcon} />}
          </MapContainer>

          {/* Combined Legend: AQI Colors + Metro Lines */}
          <div className="cdc-legend">
            {(showAqiZones || !isTransitMode) && (
              <div className="cdc-legend-group">
                <span className="cdc-legend-title">AQI Map Levels:</span>
                {getColorLegend().map((item) => (
                  <span key={item.color} className="cdc-legend-item">
                    <span className="cdc-legend-dot" style={{ background: item.color }} />
                    {item.label}
                  </span>
                ))}
              </div>
            )}

            {metroLinesToRender.length > 0 && (
              <div className="cdc-legend-group">
                <span className="cdc-legend-title">🚇 Metro:</span>
                {metroLinesToRender.map((l, i) => {
                  const isSel = selectedMetroLineIdx === i ||
                    (selectedMetroLineIdx === 'interchange' &&
                      (curRoute?.interchangePlan?.lineAIndex === i || curRoute?.interchangePlan?.lineBIndex === i));
                  return (
                    <span
                      key={i}
                      className={`cdc-legend-item ${isSel ? 'cdc-legend-item--active' : 'cdc-legend-item--thin'}`}
                    >
                      <span
                        className="cdc-legend-dot"
                        style={{
                          background: isSel ? l.color : (l.lightColor || l.color),
                          height: isSel ? 9 : 4,
                          width: isSel ? 18 : 14,
                        }}
                      />
                      {l.name.split('(')[0].trim()}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Route Stats (compact, no Exposure Comparison) + Highlighted Per-Leg Estimation ── */}
      {curRoute && (() => {
        const modeEval = doseByMode[selectedMode];
        const isInterchangeSel = isMetroMode && selectedMetroLineIdx === 'interchange' && curRoute?.interchangePlan;
        const selectedLineObj = isMetroMode && typeof selectedMetroLineIdx === 'number'
          ? metroLinesToRender[selectedMetroLineIdx]
          : null;
        const isDefaultPlan = selectedMetroLineIdx === curRoute?.defaultActiveLineIndex;
        const activeLegs = isInterchangeSel
          ? ((isDefaultPlan && modeEval?.legs?.length) ? modeEval.legs : curRoute.interchangePlan.legs)
          : ((isDefaultPlan && modeEval?.legs?.length)
              ? modeEval.legs
              : (selectedLineObj?.autoPlan?.legs || curRoute?.autoPlan?.legs));

        const computedLineDose = (!isDefaultPlan && activeLegs?.length)
          ? Math.round(activeLegs.reduce((sum, leg) => sum + estimateLegDoseUg(leg, basePM25), 0) * 100) / 100
          : null;
        const curDose = computedLineDose ?? modeEval?.dose_ug ?? curRoute.estimatedDose;
        const curRisk = getRiskTier(curDose);

        // Automated safe path suggestion (including Metro Interchange comparison!)
        let safeTip = null;
        if (isMetroMode && activeLegs?.length > 1) {
          const walkGapDose = modeEval?.walk_gap_dose_ug;
          const n95Dose = modeEval?.n95_feeder_dose_ug;
          const usesBusFeeder = activeLegs.some((l) => l.role !== 'main' && l.mode === 'BUS');

          if (isInterchangeSel) {
            const singleBest = metroLinesToRender.find((l) => l.isActive);
            const singleBusKm = singleBest ? Math.round((singleBest.autoPlan.firstMileKm + singleBest.autoPlan.lastMileKm) * 10) / 10 : null;
            const xferBusKm = Math.round((curRoute.interchangePlan.firstMileKm + curRoute.interchangePlan.lastMileKm) * 10) / 10;
            safeTip = singleBusKm && singleBusKm > xferBusKm + 1
              ? `Metro Interchange (${curRoute.interchangePlan.lineAName} ⇄ ${curRoute.interchangePlan.lineBName}) cuts road gaps from ${singleBusKm} km to ${xferBusKm} km before final feeder.`
              : `Metro Interchange (${curRoute.interchangePlan.lineAName} ⇄ ${curRoute.interchangePlan.lineBName}) maximizes enclosed rail coverage across town.`;
          } else if (curRoute?.interchangePlan && typeof selectedMetroLineIdx === 'number') {
            safeTip = `Tip: Select 🔄 ${curRoute.interchangePlan.lineAName} ⇄ ${curRoute.interchangePlan.lineBName} above to avoid a longer final Bus leg across town.`;
          } else if (safestMode && safestMode !== 'METRO' && doseByMode[safestMode]?.dose_ug < curDose - 0.5) {
            const alt = doseByMode[safestMode];
            const saved = Math.round((curDose - alt.dose_ug) * 10) / 10;
            safeTip = `Nearest metro station is far — direct ${MODE_CONFIG[safestMode]?.icon} ${MODE_CONFIG[safestMode]?.label} (${alt.dose_ug} µg) saves −${saved} µg total.`;
          } else if (usesBusFeeder && walkGapDose && walkGapDose > curDose + 0.5) {
            const busSaved = Math.round((walkGapDose - curDose) * 10) / 10;
            safeTip = `Auto-selected feeder Bus cuts station-gap inhalation by −${busSaved} µg vs walking${n95Dose ? ` (or wear N95 for ${n95Dose} µg)` : ''}.`;
          } else if (n95Dose && n95Dose < curDose - 0.5) {
            safeTip = `Wear an N95 mask on short station walks to drop exposure to ${n95Dose} µg.`;
          }
        } else if (safestMode && safestMode !== selectedMode && doseByMode[safestMode]?.dose_ug < curDose - 0.5) {
          const alt = doseByMode[safestMode];
          const saved = Math.round((curDose - alt.dose_ug) * 10) / 10;
          safeTip = `Switch to ${MODE_CONFIG[safestMode]?.icon} ${MODE_CONFIG[safestMode]?.label} (${alt.dose_ug} µg) to inhale −${saved} µg less pollution.`;
        }

        const headerTitle = isInterchangeSel
          ? `${curRoute.interchangePlan.lineAName} ⇄ ${curRoute.interchangePlan.lineBName}`
          : (selectedLineObj ? selectedLineObj.name.split('(')[0].trim() : curRoute.altLabel);

        const activePlanMeta = isInterchangeSel
          ? curRoute.interchangePlan
          : selectedLineObj?.autoPlan;

        return (
          <div className="card cdc-stats cdc-stats--compact">
            <div className="cdc-stats-header">
              <span style={{ color: curMode?.color, fontSize: '1.2rem' }}>{curMode?.icon}</span>
              <h3>{curMode?.label} — {headerTitle}</h3>
              {modeEval?.health_status && (
                <span className="cdc-health-chip" style={{ color: curRisk.color }}>
                  {modeEval.health_status.label}
                </span>
              )}
              <span className="cdc-safe-pill" style={{ background: curRisk.pillBg, color: curRisk.color }}>
                {curRisk.icon} {curRisk.label}
              </span>
            </div>

            {/* Highlighted Per-Leg Pollution Estimation Strip (supports Interchange legs!) */}
            {isMetroMode && activeLegs?.length > 0 && (
              <div className="cdc-est-highlight">
                <div className="cdc-est-top">
                  <span className="cdc-est-label">⚡ Estimated Pollution Breakdown</span>
                  <span className="cdc-est-total" style={{ color: curRisk.color }}>
                    Total Inhaled: <strong>{curDose} µg</strong>
                  </span>
                </div>
                <div className="cdc-chain-pills">
                  {activeLegs.map((leg, i) => {
                    const isXfer = leg.mode === 'TRANSFER';
                    const icon = isXfer ? '🔄' : (MODE_CONFIG[leg.mode]?.icon || '🚆');
                    const name = isXfer
                      ? 'Interchange'
                      : (leg.line_name ? leg.line_name.split('(')[0].trim() : (MODE_CONFIG[leg.mode]?.label || leg.mode));
                    const legDose = estimateLegDoseUg(leg, basePM25);
                    return (
                      <Fragment key={i}>
                        {i > 0 && <span className="cdc-chain-arrow">➔</span>}
                        <span className={`cdc-chain-pill ${leg.mode === 'METRO' ? 'cdc-chain-pill--metro' : ''} ${isXfer ? 'cdc-chain-pill--xfer' : ''}`}>
                          <span>{icon} {name}{!isXfer ? ` ${leg.distance_km} km` : ` ${leg.duration_min}m`}</span>
                          {leg.coverage_pct && <span className="cdc-chain-cov">({leg.coverage_pct}%)</span>}
                          <strong className="cdc-chain-ug">{legDose} µg</strong>
                        </span>
                      </Fragment>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="cdc-stats-grid">
              <div className="cdc-stat-box" style={{ background: curRisk.bg, borderColor: curRisk.border }}>
                <span className="cdc-stat-num" style={{ color: curRisk.color }}>
                  {curDose} <small>µg</small>
                </span>
                <span className="cdc-stat-unit">total inhaled</span>
              </div>
              <div className="cdc-stat-box">
                <span className="cdc-stat-num">{modeEval?.estimated_aqi ?? Math.round(basePM25)}</span>
                <span className="cdc-stat-unit">est. trip AQI</span>
              </div>
              <div className="cdc-stat-box">
                <span className="cdc-stat-num">{activePlanMeta?.totalDurationMin || curRoute.durationMin} <small>min</small></span>
                <span className="cdc-stat-unit">time</span>
              </div>
              <div className="cdc-stat-box">
                <span className="cdc-stat-num">{activePlanMeta?.totalKm || curRoute.distanceKm} <small>km</small></span>
                <span className="cdc-stat-unit">distance</span>
              </div>
            </div>

            {(aiAnalysis?.safe_tip_sticker || safeTip) && (
              <div className="cdc-safe-suggest">
                <span>🛡️</span>
                <span>{aiAnalysis?.safe_tip_sticker || safeTip}</span>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}

export default CommuteDoseCalculator;
