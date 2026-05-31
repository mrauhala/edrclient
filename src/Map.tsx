// ...existing imports...
import React from 'react';
import 'ol/ol.css';
import { FeatureViewer, normalizeGeoJsonFeature, normalizeOLFeature } from './FeatureViewer';
import DraggableMapPanel from './DraggableMapPanel';
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


interface MapProps {
  zoomLevel: number;
}

const OpenLayersMap: React.FC<MapProps> = ({ zoomLevel }) => {
  // Context values for JSX rendering
  const { geoJsonLayers, setGeoJsonLayers, selectedGeoJsonFeature, setSelectedGeoJsonFeature } = useGeoJsonLayers();
  const { clickedCoords, setClickedCoords, selectedArea, setSelectedArea, radiusKm, setRadiusKm, dataQuery } = useMapInteraction();
  const { selectedCollection, selectedFeature, setSelectedFeature, landingPageLicense } = useCollection();

  // Hook composition
  const { map, vectorLayer, locationLayer, markerLayer, areaLayer, radiusLayer, tooltipRef } =
    useMapSetup(zoomLevel);

  useCollectionExtents(map, vectorLayer);
  useLocationFeatures(map, locationLayer);

  const { geoJsonMetadata } = useGeoJsonOverlays(map);
  useMapsOverlays(map);

  useMapInteractions(map, markerLayer, areaLayer, radiusLayer);

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

      {/* Position Selection Instruction - Top Center */}
      {dataQuery && dataQuery.toLowerCase() === 'position' && (!clickedCoords || clickedCoords.length === 0) && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            padding: '16px 24px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 'normal',
            zIndex: 1000,
            boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
            border: '2px solid rgba(255, 0, 0, 0.6)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '16px', color: '#FF4444' }}>
            Click Points on Map
          </div>
          <div>Click to add multiple points</div>
        </div>
      )}

        {/* Trajectory Selection Instruction - Top Center */}
        {dataQuery && dataQuery.toLowerCase() === 'trajectory' && (!clickedCoords || clickedCoords.length === 0) && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              color: 'white',
              padding: '16px 24px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 'normal',
              zIndex: 1000,
              boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
              border: '2px solid rgba(255, 0, 0, 0.6)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '16px', color: '#FF4444' }}>
              Draw Trajectory on Map
            </div>
            <div>Click to add points along the path; double-click to finish</div>
          </div>
        )}

      {/* Reset Button for Position Mode */}
      {dataQuery && dataQuery.toLowerCase() === 'position' && clickedCoords && clickedCoords.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 1000,
          }}
        >
          <button
            onClick={() => {
              setClickedCoords([]);
            }}
            style={{
              backgroundColor: 'rgba(255, 68, 68, 0.9)',
              color: 'white',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 68, 68, 1)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 68, 68, 0.9)';
            }}
          >
            Clear Points
          </button>
        </div>
      )}

        {/* Reset Button for Trajectory Mode */}
        {dataQuery && dataQuery.toLowerCase() === 'trajectory' && clickedCoords && clickedCoords.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              zIndex: 1000,
            }}
          >
            <button
              onClick={() => {
                setClickedCoords([]);
                if (markerLayer) {
                  const source = markerLayer.getSource();
                  if (source) source.clear();
                }
              }}
              style={{
                backgroundColor: 'rgba(255, 68, 68, 0.9)',
                color: 'white',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 68, 68, 1)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 68, 68, 0.9)';
              }}
            >
              Clear Trajectory
            </button>
          </div>
        )}

      {/* Area Drawing Instruction - Top Center */}
      {dataQuery && dataQuery.toLowerCase() === 'area' && (!selectedArea || selectedArea.length === 0) && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            padding: '16px 24px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 'normal',
            zIndex: 1000,
            boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
            border: '2px solid rgba(255, 0, 0, 0.6)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '16px', color: '#FF4444' }}>
            Draw Areas on Map
          </div>
          <div>Click to add vertices, double-click to complete each polygon</div>
        </div>
      )}

      {/* Reset Button for Area Mode */}
      {dataQuery && dataQuery.toLowerCase() === 'area' && selectedArea && selectedArea.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 1000,
          }}
        >
          <button
            onClick={() => {
              setSelectedArea([]);
              if (areaLayer) {
                const source = areaLayer.getSource();
                if (source) {
                  source.clear();
                }
              }
            }}
            style={{
              backgroundColor: 'rgba(255, 68, 68, 0.9)',
              color: 'white',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 68, 68, 1)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 68, 68, 0.9)';
            }}
          >
            Clear Polygons
          </button>
        </div>
      )}

      {/* Radius Selection Info - Lower Right Corner */}
      {dataQuery && dataQuery.toLowerCase() === 'radius' && clickedCoords && clickedCoords.length > 0 && (
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
            Radius: {radiusKm} km
          </div>
        </div>
      )}

      {/* Radius Selection Instruction - Top Center */}
      {dataQuery && dataQuery.toLowerCase() === 'radius' && (!clickedCoords || clickedCoords.length === 0) && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            padding: '16px 24px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 'normal',
            zIndex: 1000,
            boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
            border: '2px solid rgba(0, 123, 255, 0.6)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '16px', color: '#007BFF' }}>
            Click Points on Map
          </div>
          <div>Click to add multiple points with radius {radiusKm} km</div>
        </div>
      )}

      {/* Reset Button and Radius Control for Radius Mode */}
      {dataQuery && dataQuery.toLowerCase() === 'radius' && clickedCoords && clickedCoords.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <button
            onClick={() => {
              setClickedCoords([]);
            }}
            style={{
              backgroundColor: 'rgba(255, 68, 68, 0.9)',
              color: 'white',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 68, 68, 1)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 68, 68, 0.9)';
            }}
          >
            Clear Points
          </button>

          {/* Radius Control */}
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
            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Radius: {radiusKm} km</div>
            <input
              type="range"
              min="1"
              max="500"
              value={radiusKm}
              onChange={(e) => {
                setRadiusKm(Number(e.target.value));
              }}
              style={{
                width: '150px',
                cursor: 'pointer',
              }}
            />
            <div style={{ marginTop: '4px', fontSize: '10px', opacity: 0.7 }}>
              1 - 500 km
            </div>
          </div>
        </div>
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
    </div>
  );
};

export default OpenLayersMap;
