// ============================================
// CommuteMapPanel — Transit Line Switcher, Map & AQI Legend
// ============================================
import { MapContainer, TileLayer, Marker, Polyline, Tooltip } from 'react-leaflet';
import { calcRouteAvgPM25, getColorLegend } from '../../utils/aqiRouteColorizer.js';
import {
  startIcon,
  endIcon,
  estimateLegDoseUg,
  FitBounds,
  ViewportAqiOverlay,
  ColoredRoute,
  TransitNetworkLayers,
} from './CommuteMapLayers.jsx';

function CommuteMapPanel({
  origin,
  destination,
  allModes,
  selectedMode,
  curMode,
  curRoutes,
  curRoute,
  coloredAlts,
  selectedAlt,
  setSelectedAlt,
  selectedColored,
  isMetroMode,
  isTransitMode,
  metroLinesToRender,
  busLines,
  selectedMetroLineIdx,
  setSelectedMetroLineIdx,
  showAqiZones,
  setShowAqiZones,
  mapCoords,
  basePM25,
  doseByMode,
}) {
  return (
    <>
      {(isMetroMode || !destination) && metroLinesToRender.length > 0 && (
        <div className="cdc-alts">
          <span className="cdc-alts-title">🚇 Metro Route — pick Interchange, Single Line, or All Thin:</span>
          <div className="cdc-alts-row">
            {isMetroMode && curRoute?.interchangePlan && (
              <button
                type="button"
                className={`cdc-metro-chip ${selectedMetroLineIdx === 'interchange' ? 'cdc-metro-chip--on' : ''}`}
                style={
                  selectedMetroLineIdx === 'interchange'
                    ? { borderColor: '#2563EB', background: '#EFF6FF' }
                    : undefined
                }
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
                    borderColor: isSel ? line.color : line.lightColor || line.color,
                    background: isSel ? `${line.color}16` : '#FFFFFF',
                  }}
                  onClick={() => setSelectedMetroLineIdx(isSel ? null : i)}
                >
                  <span
                    className="cdc-metro-swatch"
                    style={{ background: isSel ? line.color : line.lightColor || line.color }}
                  />
                  <span>{line.name.split('(')[0].trim()}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!isMetroMode && curRoutes.length > 1 && (
        <div className="cdc-alts">
          <span className="cdc-alts-title">📍 Route Options — click to select:</span>
          <div className="cdc-alts-row">
            {curRoutes.map((r, idx) => {
              const avg = coloredAlts[idx]?.segments ? calcRouteAvgPM25(coloredAlts[idx].segments) : '—';
              const isSelected = idx === selectedAlt;
              return (
                <button
                  key={r.id}
                  type="button"
                  className={`cdc-alt ${isSelected ? 'cdc-alt--on' : ''}`}
                  onClick={() => setSelectedAlt(idx)}
                >
                  <strong>{r.altLabel}</strong>
                  <span>
                    {r.distanceKm} km · {r.durationMin} min
                  </span>
                  {!r.isTransit && <span className="cdc-alt-aqi">Avg PM2.5: {avg}</span>}
                  {isSelected && <span className="cdc-alt-selected">✓ Selected</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {(allModes.length > 0 || origin) && (
        <div className="card cdc-map-wrap">
          <button
            type="button"
            aria-pressed={showAqiZones}
            className={`cdc-aqi-toggle ${showAqiZones ? 'cdc-aqi-toggle--on' : ''}`}
            onClick={() => setShowAqiZones((s) => !s)}
            title="Show or hide colored AQI zones on map"
          >
            🎨 AQI Map Colors: <strong>{showAqiZones ? 'ON' : 'OFF'}</strong>
          </button>

          <MapContainer
            center={origin ? [origin.lat, origin.lng] : [20.59, 78.96]}
            zoom={12}
            className="cdc-map"
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {mapCoords?.length > 1 && <FitBounds coords={mapCoords} />}
            {showAqiZones && <ViewportAqiOverlay basePM25={basePM25} />}

            {!isTransitMode &&
              coloredAlts.map((r, idx) => {
                if (idx === selectedAlt || !r.segments?.length) return null;
                const altDose =
                  Math.round(
                    estimateLegDoseUg(
                      {
                        mode: selectedMode,
                        activity_mode: curMode?.activityMode,
                        duration_min: r.durationMin,
                      },
                      basePM25,
                    ) * 10,
                  ) / 10;
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

            {metroLinesToRender.length > 0 && (
              <TransitNetworkLayers
                lines={metroLinesToRender}
                selectedIndex={isMetroMode ? selectedMetroLineIdx : destination ? null : selectedMetroLineIdx}
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

            {isMetroMode && metroLinesToRender.length === 0 && selectedColored?.coordinates && (
              <Polyline
                positions={selectedColored.coordinates.filter((c) => !isNaN(c[0]))}
                color={curMode?.color || '#7B1FA2'}
                weight={7}
                opacity={1.0}
              >
                <Tooltip sticky>
                  {curMode?.icon} {curMode?.label}
                </Tooltip>
              </Polyline>
            )}

            {curMode?.mode === 'BUS' &&
              coloredAlts.map((r, idx) =>
                idx !== selectedAlt && r.transitLines?.length ? (
                  <TransitNetworkLayers key={r.id + '-bfade'} lines={r.transitLines} selectedIndex={null} />
                ) : null,
              )}
            {curMode?.mode === 'BUS' && busLines.length > 0 && (
              <TransitNetworkLayers lines={busLines} selectedIndex={0} />
            )}
            {curMode?.mode === 'BUS' && busLines.length === 0 && selectedColored?.coordinates && (
              <Polyline
                positions={selectedColored.coordinates.filter((c) => !isNaN(c[0]))}
                color={curMode?.color || '#0288D1'}
                weight={7}
                opacity={1.0}
              >
                <Tooltip sticky>🚌 Bus Route</Tooltip>
              </Polyline>
            )}

            {!isTransitMode &&
              selectedColored?.segments?.length > 0 &&
              (() => {
                const selDose =
                  Math.round(
                    estimateLegDoseUg(
                      {
                        mode: selectedMode,
                        activity_mode: curMode?.activityMode,
                        duration_min: selectedColored.durationMin,
                      },
                      basePM25,
                    ) * 10,
                  ) / 10;
                return (
                  <ColoredRoute
                    segments={selectedColored.segments}
                    weight={7.5}
                    opacity={1.0}
                    tooltip={`${curMode?.icon} ${curMode?.label} (${selectedColored.altLabel}) · ${selectedColored.distanceKm} km · ~${doseByMode[selectedMode]?.dose_ug ?? selDose} µg inhaled`}
                  />
                );
              })()}

            {origin && <Marker position={[origin.lat, origin.lng]} icon={startIcon} />}
            {destination && <Marker position={[destination.lat, destination.lng]} icon={endIcon} />}
          </MapContainer>

          <div className="cdc-legend">
            {(showAqiZones || !isTransitMode) && (
              <div className="cdc-legend-group">
                <span className="cdc-legend-title">AQI Map Levels:</span>
                {getColorLegend().map((item) => (
                  <span key={item.color} className="cdc-legend-item">
                    <span className="cdc-legend-dot" style={{ background: item.color }} aria-hidden="true" />
                    {item.label}
                  </span>
                ))}
              </div>
            )}

            {metroLinesToRender.length > 0 && (
              <div className="cdc-legend-group">
                <span className="cdc-legend-title">🚇 Metro:</span>
                {metroLinesToRender.map((l, i) => {
                  const isSel =
                    selectedMetroLineIdx === i ||
                    (selectedMetroLineIdx === 'interchange' &&
                      (curRoute?.interchangePlan?.lineAIndex === i ||
                        curRoute?.interchangePlan?.lineBIndex === i));
                  return (
                    <span
                      key={i}
                      className={`cdc-legend-item ${isSel ? 'cdc-legend-item--active' : 'cdc-legend-item--thin'}`}
                    >
                      <span
                        className="cdc-legend-dot"
                        style={{
                          background: isSel ? l.color : l.lightColor || l.color,
                          height: isSel ? 9 : 4,
                          width: isSel ? 18 : 14,
                        }}
                        aria-hidden="true"
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
    </>
  );
}

export default CommuteMapPanel;
