// ...existing imports...
import React from 'react';
import 'ol/ol.css';
import { FeatureViewer, normalizeGeoJsonFeature, normalizeOLFeature } from './FeatureViewer';
import DraggableMapPanel from './DraggableMapPanel';
import MapsAnimationBar from './MapsAnimationBar';
import { useGeoJsonLayers } from './contexts/GeoJsonLayerContext';
import { useMapInteraction } from './contexts/MapInteractionContext';
import { useCollection } from './contexts/CollectionContext';
import { useMapSetup } from './hooks/useMapSetup';
import { useCollectionExtents } from './hooks/useCollectionExtents';
import { useLocationFeatures } from './hooks/useLocationFeatures';
import { useGeoJsonOverlays } from './hooks/useGeoJsonOverlays';
import { useMapsOverlays } from './hooks/useMapsOverlays';
import { useMapInteractions } from './hooks/useMapInteractions';
import { useLayerManagerSync } from './hooks/useLayerManagerSync';
import MapQueryOverlay from './MapQueryOverlay';
import { geometryKindOf } from './query/queryTypes';
import { rangeFor } from './query/units';


interface MapProps {
  zoomLevel: number;
}

const OpenLayersMap: React.FC<MapProps> = ({ zoomLevel }) => {
  // Context values for JSX rendering
  const { geoJsonLayers, setGeoJsonLayers, selectedGeoJsonFeature, setSelectedGeoJsonFeature } = useGeoJsonLayers();
  const { clickedCoords, setClickedCoords, selectedArea, setSelectedArea, selectedBbox, setSelectedBbox, radius, setRadius, radiusUnits, dataQuery } = useMapInteraction();
  const geometryKind = geometryKindOf(dataQuery);
  const radiusRange = rangeFor(radiusUnits);
  const { selectedCollection, selectedFeature, setSelectedFeature, landingPageLicense } = useCollection();

  // Hook composition
  const { map, vectorLayer, locationLayer, markerLayer, areaLayer, radiusLayer, tooltipRef } =
    useMapSetup(zoomLevel);

  useCollectionExtents(map, vectorLayer);
  useLocationFeatures(map, locationLayer);

  const { geoJsonMetadata } = useGeoJsonOverlays(map);
  useMapsOverlays(map);

  const { abortDrawing, isDrawing } = useMapInteractions(map, markerLayer, areaLayer, radiusLayer);

  useLayerManagerSync(
    vectorLayer, locationLayer, markerLayer, areaLayer, radiusLayer,
  );

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div id="map" key="main-map" tabIndex={0} style={{ width: '100%', height: '100%', outline: 'none' }} />

      {/* Tooltip element */}
      <div
        ref={tooltipRef}
        style={{
          position: 'absolute',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 'bold',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          display: 'none',
          zIndex: 1000,
          boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
        }}
      />

      {/* Collection Legend */}
      {selectedCollection && (
        <DraggableMapPanel collection={selectedCollection} fallbackLicense={landingPageLicense} />
      )}

      <FeatureViewer
        feature={selectedFeature ? normalizeGeoJsonFeature(selectedFeature) : null}
        variant="location"
        onClose={() => setSelectedFeature(null)}
      />

      <FeatureViewer
        feature={selectedGeoJsonFeature ? normalizeOLFeature(selectedGeoJsonFeature) : null}
        variant="geojson"
        onClose={() => setSelectedGeoJsonFeature(null)}
        metadata={selectedGeoJsonFeature?.get ? geoJsonMetadata[selectedGeoJsonFeature.get('layerUrl')] : undefined}
        selectedLabelProperty={selectedGeoJsonFeature?.get ?
          geoJsonLayers.find(l => l.url === selectedGeoJsonFeature.get('layerUrl'))?.labelProperty : undefined}
        onSelectLabelProperty={(propertyName) => {
          if (selectedGeoJsonFeature?.get) {
            const layerUrl = selectedGeoJsonFeature.get('layerUrl');
            const updatedLayers = geoJsonLayers.map(layer =>
              layer.url === layerUrl ? { ...layer, labelProperty: propertyName } : layer
            );
            setGeoJsonLayers(updatedLayers);
          }
        }}
      />

      {/* Along the bottom edge, the query's card above the animation bars, so neither covers the other */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: '10px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none' }}>
        {/* What the query needs from the map, and clearing it */}
        <MapQueryOverlay
          queryType={dataQuery}
          hasGeometry={geometryKind === 'polygon' ? selectedArea.length > 0 : geometryKind === 'bbox' ? selectedBbox !== null : clickedCoords.length > 0}
          isDrawing={isDrawing}
          onClear={() => {
            abortDrawing();
            setClickedCoords([]);
            setSelectedArea([]);
            setSelectedBbox(null);
          }}
          radiusLabel={`${radius} ${radiusUnits}`}
          selection={geometryKind === 'polygon'
            ? { title: 'Selected Polygons', items: selectedArea.map(polygon => `${polygon.length} vertices`) }
            : {
              title: 'Selected Points',
              items: clickedCoords.map(([lon, lat]) => `Lat: ${lat.toFixed(6)}°, Lon: ${lon.toFixed(6)}°`),
            }}
        >
          {dataQuery === 'radius' && (
            <div style={{ margin: '2px 0 4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', fontSize: '12px' }}>
                <span style={{ fontWeight: 'bold' }}>Radius: {radius} {radiusUnits}</span>
                <span style={{ fontSize: '10px', opacity: 0.7 }}>{radiusRange.min} - {radiusRange.max} {radiusUnits}</span>
              </div>
              <input
                type="range"
                aria-label="Radius"
                min={radiusRange.min}
                max={radiusRange.max}
                step={radiusRange.step}
                value={radius}
                onChange={(e) => {
                  setRadius(Number(e.target.value));
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  margin: '6px 0 0',
                  cursor: 'pointer',
                }}
              />
            </div>
          )}
        </MapQueryOverlay>

        <MapsAnimationBar />
      </div>
    </div>
  );
};

export default OpenLayersMap;
