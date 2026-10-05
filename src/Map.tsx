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

      {/* Coordinates Legend - Lower Right Corner */}
      {clickedCoords && clickedCoords.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            right: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 'normal',
            zIndex: 1000,
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.2)',
            fontFamily: 'monospace',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '11px', opacity: 0.7 }}>
            Selected Points ({clickedCoords.length})
          </div>
          {clickedCoords.map((coords, idx) => (
            <div key={idx} style={{ fontSize: '10px', marginTop: idx > 0 ? '4px' : '0' }}>
              {idx + 1}. Lat: {coords[1].toFixed(6)}°, Lon: {coords[0].toFixed(6)}°
            </div>
          ))}
        </div>
      )}

      {/* Area Selection Info - Lower Right Corner */}
      {selectedArea && selectedArea.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            right: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 'normal',
            zIndex: 1000,
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.2)',
            fontFamily: 'monospace',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '11px', opacity: 0.7 }}>
            Selected Polygons ({selectedArea.length})
          </div>
          {selectedArea.map((polygon, idx) => (
            <div key={idx} style={{ fontSize: '10px' }}>
              {idx + 1}. {polygon.length} vertices
            </div>
          ))}
        </div>
      )}

      {/* Radius Selection Info - Lower Right Corner */}
      {dataQuery === 'radius' && clickedCoords && clickedCoords.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            right: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 'normal',
            zIndex: 1000,
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            border: '1px solid rgba(0, 123, 255, 0.5)',
            fontFamily: 'monospace',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '11px', opacity: 0.7 }}>
            Selected Points ({clickedCoords.length})
          </div>
          {clickedCoords.map((coords, idx) => (
            <div key={idx} style={{ fontSize: '10px', marginTop: idx > 0 ? '4px' : '0' }}>
              {idx + 1}. Lat: {coords[1].toFixed(6)}°, Lon: {coords[0].toFixed(6)}°
            </div>
          ))}
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.2)', fontWeight: 'bold' }}>
            Radius: {radius} {radiusUnits}
          </div>
        </div>
      )}

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
      >
        {dataQuery === 'radius' && (
          <div
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              color: 'white',
              border: '2px solid rgba(0, 123, 255, 0.5)',
              padding: '12px',
              borderRadius: '6px',
              fontSize: '12px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Radius: {radius} {radiusUnits}</div>
            <input
              type="range"
              min={radiusRange.min}
              max={radiusRange.max}
              step={radiusRange.step}
              value={radius}
              onChange={(e) => {
                setRadius(Number(e.target.value));
              }}
              style={{
                width: '150px',
                cursor: 'pointer',
              }}
            />
            <div style={{ marginTop: '4px', fontSize: '10px', opacity: 0.7 }}>
              {radiusRange.min} - {radiusRange.max} {radiusUnits}
            </div>
          </div>
        )}
      </MapQueryOverlay>

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

      <MapsAnimationBar />
    </div>
  );
};

export default OpenLayersMap;
