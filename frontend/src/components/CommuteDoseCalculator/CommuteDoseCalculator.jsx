// ============================================
// CommuteDoseCalculator — Modular Multi-Route Dose & AI Planner
// ============================================
import { useState, useEffect, useCallback, useMemo } from 'react';
import 'leaflet/dist/leaflet.css';
import { useUser } from '../../context/UserContext.jsx';
import { useAqi } from '../../context/AqiContext.jsx';
import { reverseGeocode } from '../../utils/geocoder.js';
import { fetchAllModesRoutes, MODE_CONFIG } from '../../utils/routingService.js';
import { fetchMetroLines, lightenHex } from '../../utils/transitService.js';
import { colorizeRoute } from '../../utils/aqiRouteColorizer.js';
import { fetchMultiCommuteComparison, fetchOriginCommuteBrief } from '../../services/api.js';
import { PlaceInput } from './CommuteMapLayers.jsx';
import CommuteModeCards from './CommuteModeCards.jsx';
import CommuteMapPanel from './CommuteMapPanel.jsx';
import CommuteRouteStats from './CommuteRouteStats.jsx';
import './CommuteDoseCalculator.css';

function CommuteDoseCalculator() {
  const { location, language } = useUser();
  const { currentAqi, setCommuteData } = useAqi();

  const [customOrigin, setCustomOrigin] = useState(null);
  const [resolvedLabel, setResolvedLabel] = useState(null);
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

  const origin = useMemo(() => {
    if (customOrigin) return customOrigin;
    if (!location) return null;
    return {
      lat: location.lat,
      lng: location.lng,
      label: resolvedLabel || location.label,
    };
  }, [customOrigin, location, resolvedLabel]);

  useEffect(() => {
    if (!location?.label || !/^[\d.\-,\s]+$/.test(location.label)) return undefined;
    let active = true;
    reverseGeocode(location.lat, location.lng)
      .then((name) => {
        if (active && name) setResolvedLabel(name);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [location]);

  useEffect(() => {
    if (!origin?.lat || !origin?.lng) return undefined;
    let active = true;
    Promise.resolve()
      .then(() => {
        if (active) setBriefLoading(true);
        return fetchOriginCommuteBrief({
          lat: origin.lat,
          lng: origin.lng,
          origin_label: origin.label,
          language,
        });
      })
      .then((res) => {
        if (active && res?.data?.brief) setOriginBrief(res.data);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setBriefLoading(false);
      });
    return () => {
      active = false;
    };
  }, [origin?.lat, origin?.lng, origin?.label, language]);

  useEffect(() => {
    if (!origin || destination) return undefined;
    let active = true;
    fetchMetroLines(origin.lat, origin.lng, origin.lat, origin.lng)
      .then((lines) => {
        if (active) {
          setPreviewMetroLines(lines.map((l) => ({ ...l, lightColor: lightenHex(l.color, 0.52) })));
        }
      })
      .catch(() => {
        if (active) setPreviewMetroLines([]);
      });
    return () => {
      active = false;
    };
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
        } catch {
          /* fallback coordinates label */
        }
        setCustomOrigin({ lat, lng, label });
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
    setLoading(true);
    setError(null);
    setAllModes([]);
    setDoseByMode({});
    setSafestMode(null);
    setAiAnalysis(null);
    setSelectedAlt(0);
    setSelectedMetroLineIdx(null);

    try {
      const modes = await fetchAllModesRoutes(origin.lat, origin.lng, destination.lat, destination.lng);
      if (!modes.length) {
        setError('No routes found.');
        setLoading(false);
        return;
      }
      setAllModes(modes);

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
        (result.data.routes || []).forEach((d) => {
          dmap[d.mode] = d;
        });
        setDoseByMode(dmap);
        setAiAnalysis(result.data.ai_commute_analysis || null);
        setCommuteData?.(result.data);
        if (result.data.safest_mode) {
          setSafestMode(result.data.safest_mode);
          setSelectedMode(result.data.safest_mode);
        }
      } catch {
        const dmap = {};
        modes.forEach((m) => {
          dmap[m.mode] = {
            mode: m.mode,
            label: m.label,
            dose_ug: m.routes[0]?.estimatedDose || 0,
            duration_min: m.routes[0]?.durationMin || 0,
            distance_km: m.routes[0]?.distanceKm || 0,
            co2_kg: 0,
          };
        });
        setDoseByMode(dmap);
        const sorted = [...modes].sort(
          (a, b) => (a.routes[0]?.estimatedDose || 999) - (b.routes[0]?.estimatedDose || 999),
        );
        setSafestMode(sorted[0]?.mode);
      }
    } catch {
      setError('Could not fetch routes.');
    } finally {
      setLoading(false);
    }
  }, [origin, destination, language, setCommuteData]);

  useEffect(() => {
    if (!origin || !destination) return undefined;
    const timer = setTimeout(() => {
      fetchRoutes();
    }, 0);
    return () => clearTimeout(timer);
  }, [origin, destination, fetchRoutes]);

  const curMode = allModes.find((m) => m.mode === selectedMode);
  const curRoutes = curMode?.routes || [];
  const curRoute = curRoutes[selectedAlt] || curRoutes[0];
  const basePM25 = currentAqi?.pm25 || 100;

  const coloredAlts = curRoutes.map((r, idx) => ({
    ...r,
    segments: r.isTransit
      ? []
      : colorizeRoute(r.coordinates, basePM25, curMode?.pm25Multiplier || 1.0, idx, 8),
  }));

  const selectedColored = coloredAlts[selectedAlt] || coloredAlts[0];
  const isMetroMode = curMode?.mode === 'METRO';
  const isTransitMode = curMode?.type === 'transit';
  const metroLinesToRender =
    isMetroMode && curRoute?.transitLines?.length
      ? curRoute.transitLines
      : !destination
        ? previewMetroLines
        : [];
  const busLines = curMode?.mode === 'BUS' ? curRoute?.transitLines || [] : [];

  const mapCoords = (() => {
    if (isMetroMode && origin && destination) {
      if (selectedMetroLineIdx === 'interchange' && curRoute?.interchangePlan?.segments?.length) {
        const xCoords = curRoute.interchangePlan.segments.flatMap((s) => s.coords || []);
        return [[origin.lat, origin.lng], [destination.lat, destination.lng], ...xCoords].filter(
          (c) => c && !isNaN(c[0]),
        );
      }
      const selLine =
        typeof selectedMetroLineIdx === 'number' ? metroLinesToRender[selectedMetroLineIdx] : null;
      const selCoords = selLine
        ? selLine.activeSegments?.length
          ? selLine.activeSegments.flat()
          : selLine.coordinates || []
        : [];
      return [[origin.lat, origin.lng], [destination.lat, destination.lng], ...selCoords].filter(
        (c) => c && !isNaN(c[0]),
      );
    }
    const allRouteCoords = curRoutes.flatMap((r) => (r.coordinates || []).filter((c) => !isNaN(c[0])));
    return allRouteCoords.length > 1 ? allRouteCoords : curRoute?.coordinates?.filter((c) => !isNaN(c[0]));
  })();

  const allDoses = Object.values(doseByMode)
    .map((d) => d.dose_ug)
    .filter((v) => v != null);
  const minDose = Math.min(...allDoses, 999);
  const maxDose = Math.max(...allDoses, 1);

  function getRiskTier(dose) {
    if (dose == null || allDoses.length < 2) {
      return {
        color: '#334155',
        bg: '#F8FAFC',
        border: '#CBD5E1',
        pillBg: '#E2E8F0',
        label: 'ESTIMATE',
        icon: '📊',
      };
    }
    const ratio = (dose - minDose) / (maxDose - minDose || 1);
    if (ratio <= 0.25)
      return {
        color: '#15803D',
        bg: '#F0FDF4',
        border: '#22C55E',
        pillBg: '#DCFCE7',
        label: 'SAFE',
        icon: '🛡️',
      };
    if (ratio <= 0.5)
      return {
        color: '#B45309',
        bg: '#FFFBEB',
        border: '#F59E0B',
        pillBg: '#FEF3C7',
        label: 'MODERATE',
        icon: '⚡',
      };
    if (ratio <= 0.75)
      return {
        color: '#C2410C',
        bg: '#FFF7ED',
        border: '#F97316',
        pillBg: '#FFEDD5',
        label: 'HIGH RISK',
        icon: '⚠️',
      };
    return {
      color: '#B91C1C',
      bg: '#FEF2F2',
      border: '#EF4444',
      pillBg: '#FEE2E2',
      label: 'DANGER',
      icon: '🚨',
    };
  }

  return (
    <div className="cdc">
      <div className="card cdc-search">
        <div className="cdc-search-row">
          <div className="cdc-source-wrap">
            <PlaceInput
              label="Start"
              value={origin?.label || ''}
              onChange={setCustomOrigin}
              placeholder="Starting point..."
            />
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
                  <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0013 3.06V1h-2v2.06A8.994 8.994 0 003.06 11H1v2h2.06A8.994 8.994 0 0011 20.94V23h2v-2.06A8.994 8.994 0 0020.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
                </svg>
              )}
            </button>
          </div>
          <span className="cdc-arrow" aria-hidden="true">
            →
          </span>
          <PlaceInput label="Destination" value="" onChange={setDestination} placeholder="Where to?" />
        </div>
        {loading && (
          <div className="cdc-status" role="status">
            <span className="cdc-spin" aria-hidden="true" /> Finding routes across all modes...
          </div>
        )}
        {error && (
          <div className="cdc-status cdc-status--err" role="alert">
            ⚠️ {error}
          </div>
        )}
      </div>

      {(originBrief?.brief || briefLoading) && allModes.length === 0 && (
        <div className="cdc-origin-brief" aria-live="polite">
          <div className="cdc-brief-left">
            <span className="cdc-brief-clock cdc-shield-pulse" aria-hidden="true">
              ⏰
            </span>
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
                {originBrief?.brief?.ai_powered && <span className="cdc-ai-pill">✨ Gemini AI</span>}
              </div>
              {originBrief?.brief?.headline_verdict && (
                <div className="cdc-ai-verdict">{originBrief.brief.headline_verdict}</div>
              )}
              {Array.isArray(originBrief?.brief?.origin_stickers) && (
                <div className="cdc-ai-tips">
                  {originBrief.brief.origin_stickers.map((st, idx) => (
                    <span key={idx} className="cdc-ai-tip-chip">
                      {st.emoji || st.icon} {st.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {safestMode && allModes.length > 1 && (
        <div className="cdc-recommend-wrap" aria-live="polite">
          <div className="cdc-recommend">
            <span className="cdc-recommend-shield cdc-shield-pulse" aria-hidden="true">
              🛡️
            </span>
            <div className="cdc-recommend-main">
              <div className="cdc-recommend-top">
                <strong>
                  Best: {MODE_CONFIG[safestMode]?.icon} {MODE_CONFIG[safestMode]?.label}
                </strong>
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
                {aiAnalysis?.ai_powered && <span className="cdc-ai-pill">✨ Gemini AI</span>}
              </div>

              {aiAnalysis?.headline_verdict && (
                <div className="cdc-ai-verdict">{aiAnalysis.headline_verdict}</div>
              )}

              {Array.isArray(aiAnalysis?.action_stickers) && aiAnalysis.action_stickers.length > 0 && (
                <div className="cdc-ai-tips">
                  {aiAnalysis.action_stickers.map((st, idx) => (
                    <span key={idx} className="cdc-ai-tip-chip">
                      {st.emoji || st.icon} {st.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <CommuteModeCards
        allModes={allModes}
        selectedMode={selectedMode}
        safestMode={safestMode}
        doseByMode={doseByMode}
        aiAnalysis={aiAnalysis}
        maxDose={maxDose}
        getRiskTier={getRiskTier}
        onSelectMode={(mode) => {
          setSelectedMode(mode);
          setSelectedAlt(0);
        }}
      />

      <CommuteMapPanel
        origin={origin}
        destination={destination}
        allModes={allModes}
        selectedMode={selectedMode}
        curMode={curMode}
        curRoutes={curRoutes}
        curRoute={curRoute}
        coloredAlts={coloredAlts}
        selectedAlt={selectedAlt}
        setSelectedAlt={setSelectedAlt}
        selectedColored={selectedColored}
        isMetroMode={isMetroMode}
        isTransitMode={isTransitMode}
        metroLinesToRender={metroLinesToRender}
        busLines={busLines}
        selectedMetroLineIdx={selectedMetroLineIdx}
        setSelectedMetroLineIdx={setSelectedMetroLineIdx}
        showAqiZones={showAqiZones}
        setShowAqiZones={setShowAqiZones}
        mapCoords={mapCoords}
        basePM25={basePM25}
        doseByMode={doseByMode}
      />

      <CommuteRouteStats
        curRoute={curRoute}
        curMode={curMode}
        selectedMode={selectedMode}
        selectedMetroLineIdx={selectedMetroLineIdx}
        metroLinesToRender={metroLinesToRender}
        isMetroMode={isMetroMode}
        doseByMode={doseByMode}
        safestMode={safestMode}
        basePM25={basePM25}
        aiAnalysis={aiAnalysis}
        getRiskTier={getRiskTier}
      />
    </div>
  );
}

export default CommuteDoseCalculator;
