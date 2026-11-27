// ============================================
// CommuteMapLayers — Extracted Map, AQI Grid, Place Autocomplete
// & Transit Network Layers for clean modularity & accessibility.
// ============================================
import { Fragment, useState, useEffect, useRef } from 'react';
import { Polyline, Rectangle, CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { searchPlace } from '../../utils/geocoder.js';
import { lightenHex } from '../../utils/transitService.js';
import { generateViewportAqiGrid } from '../../utils/aqiRouteColorizer.js';

// Configure Leaflet default marker icons once
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export const startIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export const endIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const LEG_PM_MULT = {
  DRIVE: 1.2,
  TWO_WHEELER: 1.4,
  METRO: 0.3,
  TRANSFER: 0.35,
  BUS: 0.6,
  WALK: 1.0,
  BICYCLE: 1.3,
};
const LEG_VE_LPM = {
  resting_in_vehicle: 9,
  walking_slow: 18,
  two_wheeler: 14,
  walking_brisk: 25,
  cycling: 35,
};

/**
 * Estimates inhaled PM2.5 (µg) for a transit or road leg.
 *
 * @param {object} leg - Route segment descriptor.
 * @param {number} [basePm25=100] - Ambient PM2.5 (µg/m³).
 * @returns {number} Inhaled µg dose.
 */
export function estimateLegDoseUg(leg, basePm25 = 100) {
  if (leg?.dose_ug != null) return leg.dose_ug;
  const mult = LEG_PM_MULT[leg?.mode] || 1.0;
  const act = leg?.activity_mode || (leg?.mode === 'WALK' ? 'walking_brisk' : 'resting_in_vehicle');
  const ve = LEG_VE_LPM[act] || 9;
  const dur = leg?.duration_min || 10;
  return Math.round(((basePm25 * mult * ve * dur) / 1000) * 100) / 100;
}

export function FitBounds({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords?.length > 1) {
      try {
        map.fitBounds(L.latLngBounds(coords), { padding: [45, 45], maxZoom: 15 });
      } catch {
        /* ignore bounds errors when coordinates collapse */
      }
    }
  }, [map, coords]);
  return null;
}

export function ViewportAqiOverlay({ basePM25 }) {
  const map = useMap();
  const [bounds, setBounds] = useState(() => map.getBounds());

  useMapEvents({
    moveend: () => setBounds(map.getBounds()),
    zoomend: () => setBounds(map.getBounds()),
  });

  const cells = generateViewportAqiGrid(bounds, basePM25, 8, 6);

  return cells.map((cell) => (
    <Rectangle
      key={cell.id}
      bounds={cell.bounds}
      pathOptions={{ stroke: false, fillColor: cell.color, fillOpacity: 0.2 }}
    >
      <Tooltip sticky>
        AQI Zone: ~{cell.pm25} µg/m³ ({cell.label})
      </Tooltip>
    </Rectangle>
  ));
}

export function PlaceInput({ label, value, onChange, placeholder }) {
  const [query, setQuery] = useState('');
  const [dirty, setDirty] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [noMatch, setNoMatch] = useState(false);
  const timer = useRef(null);
  const wrap = useRef(null);
  const listId = `place-list-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
  const displayValue = dirty ? query : query || value || '';

  useEffect(() => {
    const handleOutside = (e) => {
      if (wrap.current && !wrap.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const onType = (e) => {
    const val = e.target.value;
    setDirty(true);
    setQuery(val);
    if (timer.current) clearTimeout(timer.current);
    if (vLong(val)) {
      timer.current = setTimeout(async () => {
        const res = await searchPlace(val);
        setSuggestions(res);
        setNoMatch(res.length === 0);
        setOpen(true);
      }, 350);
    } else {
      setSuggestions([]);
      setNoMatch(false);
      setOpen(false);
    }
  };

  function vLong(v) {
    return v.length >= 3;
  }

  const pick = (place) => {
    setDirty(true);
    setQuery(place.label);
    setNoMatch(false);
    setOpen(false);
    onChange({ lat: place.lat, lng: place.lng, label: place.label });
  };

  return (
    <div className="cdc-place" ref={wrap}>
      <label className="cdc-place-label" htmlFor={`${listId}-input`}>
        {label}
      </label>
      <input
        id={`${listId}-input`}
        className="cdc-place-input"
        placeholder={placeholder}
        value={displayValue}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        onChange={onType}
        onFocus={() => (suggestions.length > 0 || noMatch) && setOpen(true)}
      />
      {open && (
        <ul id={listId} className="cdc-place-list" role="listbox">
          {suggestions.length > 0
            ? suggestions.map((p, i) => (
                <li key={i} role="option" aria-selected={false}>
                  <button type="button" className="cdc-place-opt" onClick={() => pick(p)}>
                    📍 {p.label}
                  </button>
                </li>
              ))
            : noMatch && (
                <li className="cdc-place-empty">No matching location found — try another landmark or city</li>
              )}
        </ul>
      )}
    </div>
  );
}

export function ColoredRoute({ segments, weight, opacity, onClick, tooltip }) {
  return segments.map((seg, si) => (
    <Polyline
      key={si}
      positions={seg.points}
      color={seg.color}
      weight={weight}
      opacity={opacity}
      eventHandlers={onClick ? { click: onClick } : {}}
    >
      {tooltip && si === Math.floor(segments.length / 2) && <Tooltip sticky>{tooltip}</Tooltip>}
    </Polyline>
  ));
}

export function TransitNetworkLayers({
  lines,
  selectedIndex,
  onSelectLine,
  origin,
  destination,
  firstMilePath,
  lastMilePath,
  interchangePlan = null,
  basePM25 = 100,
  evaluatedLegs = null,
}) {
  if (!lines?.length) return null;

  const isInterchange = selectedIndex === 'interchange' && interchangePlan?.segments?.length;
  const hasSingleSel = typeof selectedIndex === 'number' && lines[selectedIndex];
  const selectedLine = hasSingleSel ? lines[selectedIndex] : null;
  const activeBoardPoint = isInterchange ? interchangePlan.boardPoint : selectedLine?.boardPoint;
  const activeAlightPoint = isInterchange ? interchangePlan.alightPoint : selectedLine?.alightPoint;
  const activeLegsSource = isInterchange ? interchangePlan.legs : selectedLine?.autoPlan?.legs;

  const renderPolylines = (
    line,
    lineIdx,
    weight,
    colorOverride,
    opacity,
    useSlice = false,
    interactive = true,
  ) => {
    const segList =
      useSlice && line.activeSegments?.length
        ? line.activeSegments
        : line.segments?.length
          ? line.segments
          : [line.coordinates];
    const color = colorOverride || line.color || '#7B1FA2';

    return segList.map((coords, sIdx) => {
      const valid = (coords || []).filter((c) => c && !isNaN(c[0]) && !isNaN(c[1]));
      if (valid.length < 2) return null;
      return (
        <Polyline
          key={`tl-${lineIdx}-${sIdx}-${weight}-${interactive ? 'i' : 'c'}`}
          positions={valid}
          color={color}
          weight={weight}
          opacity={opacity}
          interactive={interactive}
          eventHandlers={
            interactive && onSelectLine
              ? {
                  click: (e) => {
                    L.DomEvent?.stopPropagation?.(e);
                    onSelectLine(selectedIndex === lineIdx ? null : lineIdx);
                  },
                }
              : {}
          }
        >
          {interactive &&
            sIdx === 0 &&
            (() => {
              const mLeg =
                (selectedIndex === lineIdx && evaluatedLegs?.find((l) => l.mode === 'METRO')) ||
                line.autoPlan?.legs?.find((l) => l.mode === 'METRO');
              const metroDoseUg = mLeg ? estimateLegDoseUg(mLeg, basePM25) : null;
              return (
                <Tooltip sticky>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 3,
                        background: line.color,
                        display: 'inline-block',
                      }}
                    />
                    {line.name}
                    {metroDoseUg != null && (
                      <span style={{ color: '#15803D', marginLeft: 4 }}>· {metroDoseUg} µg inhaled</span>
                    )}
                  </span>
                </Tooltip>
              );
            })()}
        </Polyline>
      );
    });
  };

  return (
    <>
      {lines.map((line, idx) => {
        if (hasSingleSel && idx === selectedIndex && !line.activeSegments?.length) {
          return null;
        }
        const thinColor = line.lightColor || lightenHex(line.color, 0.22);
        return (
          <Fragment key={`thin-wrap-${idx}`}>
            {renderPolylines(line, idx, 7, '#FFFFFF', 0.8, false, false)}
            {renderPolylines(line, idx, 4, thinColor, 0.92, false, true)}
          </Fragment>
        );
      })}

      {(selectedLine || isInterchange) &&
        origin &&
        activeBoardPoint &&
        (() => {
          const firstLeg =
            evaluatedLegs?.find((l) => l.role === 'first') ||
            activeLegsSource?.find((l) => l.role === 'first');
          if (!firstLeg) return null;
          const pts =
            (selectedLine?.isActive || isInterchange) && firstMilePath?.length > 1
              ? firstMilePath
              : [[origin.lat, origin.lng], activeBoardPoint];
          const isWalk = firstLeg.mode === 'WALK';
          const legDose = estimateLegDoseUg(firstLeg, basePM25);
          return (
            <Polyline
              positions={pts}
              color={isWalk ? '#2E7D32' : '#0288D1'}
              weight={5}
              opacity={0.92}
              dashArray={isWalk ? '5 8' : '10 6'}
            >
              <Tooltip sticky>
                <strong>{isWalk ? '🚶 Walk' : '🚌 Bus'}</strong> · {firstLeg.distance_km} km (~
                {firstLeg.duration_min} min) · <strong>{legDose} µg inhaled</strong>
              </Tooltip>
            </Polyline>
          );
        })()}

      {(selectedLine || isInterchange) &&
        destination &&
        activeAlightPoint &&
        (() => {
          const lastLeg =
            evaluatedLegs?.find((l) => l.role === 'last') || activeLegsSource?.find((l) => l.role === 'last');
          if (!lastLeg) return null;
          const pts =
            (selectedLine?.isActive || isInterchange) && lastMilePath?.length > 1
              ? lastMilePath
              : [activeAlightPoint, [destination.lat, destination.lng]];
          const isWalk = lastLeg.mode === 'WALK';
          const legDose = estimateLegDoseUg(lastLeg, basePM25);
          return (
            <Polyline
              positions={pts}
              color={isWalk ? '#2E7D32' : '#0288D1'}
              weight={5}
              opacity={0.92}
              dashArray={isWalk ? '5 8' : '10 6'}
            >
              <Tooltip sticky>
                <strong>{isWalk ? '🚶 Walk' : '🚌 Bus'}</strong> · {lastLeg.distance_km} km (~
                {lastLeg.duration_min} min) · <strong>{legDose} µg inhaled</strong>
              </Tooltip>
            </Polyline>
          );
        })()}

      {isInterchange && (
        <>
          {interchangePlan.segments.map((seg, sIdx) => (
            <Polyline
              key={`xfer-halo-${sIdx}`}
              positions={seg.coords}
              color="#FFFFFF"
              weight={13}
              opacity={0.94}
            />
          ))}
          {interchangePlan.segments.map((seg, sIdx) => {
            const matchedLeg =
              (evaluatedLegs || []).filter((l) => l.mode === 'METRO')[sIdx] ||
              (interchangePlan.legs || []).filter((l) => l.mode === 'METRO')[sIdx];
            const metroDoseUg = matchedLeg ? estimateLegDoseUg(matchedLeg, basePM25) : null;
            return (
              <Polyline
                key={`xfer-top-${sIdx}`}
                positions={seg.coords}
                color={seg.color}
                weight={8}
                opacity={1.0}
              >
                <Tooltip sticky>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 3,
                        background: seg.color,
                        display: 'inline-block',
                      }}
                    />
                    {seg.name} · {seg.distance_km} km
                    {metroDoseUg != null && (
                      <span style={{ color: '#15803D' }}> · {metroDoseUg} µg inhaled</span>
                    )}
                  </span>
                </Tooltip>
              </Polyline>
            );
          })}
          {interchangePlan.transferPoint && (
            <CircleMarker
              center={interchangePlan.transferPoint}
              radius={8}
              pathOptions={{ color: '#1E293B', weight: 3, fillColor: '#FFFFFF', fillOpacity: 1 }}
            >
              <Tooltip sticky>
                🔄 <strong>Metro Interchange:</strong> {interchangePlan.lineAName} ➔{' '}
                {interchangePlan.lineBName}
              </Tooltip>
            </CircleMarker>
          )}
        </>
      )}

      {selectedLine &&
        (() => {
          const segList = (selectedLine.activeSegments?.length
            ? selectedLine.activeSegments
            : selectedLine.segments) || [selectedLine.coordinates];
          return (
            <>
              {segList.map((coords, sIdx) => {
                const valid = (coords || []).filter((c) => c && !isNaN(c[0]) && !isNaN(c[1]));
                if (valid.length < 2) return null;
                return (
                  <Polyline
                    key={`halo-${selectedIndex}-${sIdx}`}
                    positions={valid}
                    color="#FFFFFF"
                    weight={13}
                    opacity={0.94}
                  />
                );
              })}
              {renderPolylines(selectedLine, selectedIndex, 8, selectedLine.color, 1.0, true)}
            </>
          );
        })()}
    </>
  );
}
