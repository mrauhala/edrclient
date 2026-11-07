// ...existing imports...
import React, { useEffect, useRef, useState } from 'react';
import 'ol/ol.css';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
import { FeatureViewer, normalizeGeoJsonFeature, normalizeOLFeature } from './FeatureViewer';
import DraggableMapPanel from './DraggableMapPanel';
import MapsAnimationBar from './MapsAnimationBar';
import ResponseCellsBar from './ResponseCellsBar';
import { useGeoJsonLayers } from './contexts/GeoJsonLayerContext';
import { useMapInteraction } from './contexts/MapInteractionContext';
import { useApi } from './contexts/ApiContext';
import { useCollection } from './contexts/CollectionContext';
import { usePanes } from './contexts/PanesContext';
import { useMapSetup } from './hooks/useMapSetup';
import { useCollectionExtents } from './hooks/useCollectionExtents';
import { useLocationFeatures } from './hooks/useLocationFeatures';
import { useGeoJsonOverlays } from './hooks/useGeoJsonOverlays';
import { useMapsOverlays } from './hooks/useMapsOverlays';
import { useResponseCellsLayer } from './hooks/useResponseCellsLayer';
import { useMapInteractions } from './hooks/useMapInteractions';
import { useLayerManagerSync } from './hooks/useLayerManagerSync';
import MapQueryOverlay from './MapQueryOverlay';
import { zoomToOverview } from './mapView';
import { geometryKindOf } from './query/queryTypes';
import { rangeFor } from './query/units';


interface MapProps {
  zoomLevel: number;
}

// At the right of the map's bottom edge, above the attribution button
const overviewButtonSx = {
  ml: 'auto',
  mr: '10px',
  mb: '40px',
  width: 44,
  height: 44,
  flexShrink: 0,
  color: 'white',
  backgroundColor: 'rgba(0, 0, 0, 0.9)',
  borderRadius: '8px',
  boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
  pointerEvents: 'auto',
  '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.75)' },
};

const OpenLayersMap: React.FC<MapProps> = ({ zoomLevel }) => {
  // Context values for JSX rendering
  const { geoJsonLayers, setGeoJsonLayers, selectedGeoJsonFeature, setSelectedGeoJsonFeature } = useGeoJsonLayers();
  const { clickedCoords, setClickedCoords, selectedArea, setSelectedArea, selectedBbox, setSelectedBbox, radius, setRadius, radiusUnits, dataQuery } = useMapInteraction();
  const geometryKind = geometryKindOf(dataQuery);
  const radiusRange = rangeFor(radiusUnits);
  const { selectedCollection, selectedCollectionExtents, selectedFeature, setSelectedFeature } = useCollection();
  const { license: apiLicense } = useApi();
  const { isMobile, isOpen } = usePanes();
  const mapShown = isMobile || isOpen.map;

  // The selected location's information. Closing it leaves the selection, which the query uses. On
  // desktop it opens beside the map with each selection; on a phone it would cover the map and the
  // bottom bar, so it waits to be asked for
  const [locationInfoOpen, setLocationInfoOpen] = useState(false);
  useEffect(() => setLocationInfoOpen(!isMobile), [selectedFeature, isMobile]);

  // Hook composition
  const { map, vectorLayer, locationLayer, markerLayer, areaLayer, radiusLayer, tooltipRef } =
    useMapSetup(zoomLevel);

  // A collection chosen while the map was hidden was framed for the hidden map's size, not the one it returns at
  const collectionWhenHidden = useRef<string | undefined | null>(null);
  useEffect(() => {
    if (!mapShown) {
      if (collectionWhenHidden.current === null) collectionWhenHidden.current = selectedCollection?.id;
      return;
    }
    if (map && collectionWhenHidden.current !== null && collectionWhenHidden.current !== selectedCollection?.id) {
      map.updateSize();
      zoomToOverview(map.getView(), selectedCollectionExtents, locationLayer?.getSource()?.getExtent());
    }
    collectionWhenHidden.current = null;
  }, [mapShown, map, selectedCollection?.id, selectedCollectionExtents, locationLayer]);

  useCollectionExtents(map, vectorLayer);
  useLocationFeatures(map, locationLayer);

  const { geoJsonMetadata } = useGeoJsonOverlays(map);
  useMapsOverlays(map);
  const responseCells = useResponseCellsLayer(map, mapShown);

  const { abortDrawing, undoLast, isDrawing } = useMapInteractions(map, markerLayer, areaLayer, radiusLayer);

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
        <DraggableMapPanel collection={selectedCollection} fallbackLicense={apiLicense} />
      )}

      <FeatureViewer
        feature={selectedFeature && locationInfoOpen ? normalizeGeoJsonFeature(selectedFeature) : null}
        variant="location"
        onClose={() => setLocationInfoOpen(false)}
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

      {/* Along the bottom edge, the query's card and the way back to the overview above the animation bars, so nothing covers anything else */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: '10px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          {/* What the query needs from the map, and clearing it */}
          <MapQueryOverlay
            queryType={dataQuery}
            hasGeometry={
              dataQuery === 'locations' ? !!selectedFeature
                : geometryKind === 'polygon' ? selectedArea.length > 0
                  : geometryKind === 'bbox' ? selectedBbox !== null
                    : clickedCoords.length > 0
            }
            isDrawing={isDrawing}
            onClear={() => {
              abortDrawing();
              setClickedCoords([]);
              setSelectedArea([]);
              setSelectedBbox(null);
              setSelectedFeature(null);
            }}
            // A box is one gesture and a location one pick: Clear takes those back
            onUndo={geometryKind === 'bbox' || geometryKind === 'none' ? undefined : undoLast}
            radiusLabel={`${radius} ${radiusUnits}`}
            selection={geometryKind === 'polygon'
              // The ring ends on its first vertex
              ? { title: 'Selected Polygons', items: selectedArea.map(polygon => `${polygon.length - 1} vertices`) }
              : {
                title: 'Selected Points',
                items: clickedCoords.map(([lon, lat]) => `Lat: ${lat.toFixed(6)}°, Lon: ${lon.toFixed(6)}°`),
              }}
            location={dataQuery === 'locations' && selectedFeature ? {
              name: String(selectedFeature.properties?.name || selectedFeature.properties?.title || selectedFeature.id || 'Location'),
              onInfo: () => setLocationInfoOpen(true),
            } : undefined}
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
          <Tooltip title="Zoom to the overview">
            <IconButton
              aria-label="Zoom to the overview"
              onClick={() => map && zoomToOverview(map.getView(), selectedCollectionExtents, locationLayer?.getSource()?.getExtent())}
              sx={overviewButtonSx}
            >
              <ZoomOutMapIcon />
            </IconButton>
          </Tooltip>
        </div>

        <ResponseCellsBar shows={responseCells.shows} outOfView={responseCells.outOfView} onGoToData={responseCells.goToData} />
        <MapsAnimationBar />
      </div>
    </div>
  );
};

export default OpenLayersMap;
