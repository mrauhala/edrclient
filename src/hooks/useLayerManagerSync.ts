import { useEffect, useCallback, useRef } from 'react';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { normalizeHref } from '../DataRetrievalAPI';
import { useGeoJsonLayers, type GeoJsonLayer } from '../contexts/GeoJsonLayerContext';
import { useMapsLayers } from '../contexts/MapsLayerContext';
import { useMapInteraction } from '../contexts/MapInteractionContext';
import { useCollection } from '../contexts/CollectionContext';
import { useLayerManager } from '../contexts/LayerManagerContext';

// Unique key for each layer (used for order tracking)
function layerKey(layer: GeoJsonLayer): string {
  if (layer.data?.type === 'internal') return `internal:${layer.data.layerType}`;
  if (layer.data?.type === 'maps') return `maps:${layer.data.mapsLayerId}`;
  return layer.url;
}

export function useLayerManagerSync(
  vectorLayer: VectorLayer<VectorSource> | null,
  locationLayer: VectorLayer<VectorSource> | null,
  markerLayer: VectorLayer<VectorSource> | null,
  areaLayer: VectorLayer<VectorSource> | null,
  radiusLayer: VectorLayer<VectorSource> | null,
): void {
  const { geoJsonLayers, setGeoJsonLayers } = useGeoJsonLayers();
  const { mapsLayers, setMapsLayers } = useMapsLayers();
  const { clickedCoords, selectedArea, radiusKm, setClickedCoords, setSelectedArea } = useMapInteraction();
  const { selectedCollection, selectedCollectionExtents, locationFeatures } = useCollection();
  const { setAllMapLayers, setHandleLayerManagerChange } = useLayerManager();

  // Track user-defined zIndex per layer key so rebuilds preserve order
  const zIndexMapRef = useRef<Map<string, number>>(new Map());

  // Sync all map layers into context for LayerManager
  useEffect(() => {
    const layers: GeoJsonLayer[] = [];

    // Add GeoJSON layers (preserve existing zIndex)
    geoJsonLayers.forEach(l => {
      const key = layerKey(l);
      const existingZ = zIndexMapRef.current.get(key);
      layers.push({ ...l, opacity: l.opacity ?? 1, zIndex: l.zIndex ?? existingZ });
    });

    // Add OGC API Maps layers (carried into the GeoJsonLayer shape so the LayerManager UI
    // can render them; identified by data.type === 'maps').
    mapsLayers.forEach(ml => {
      // Animation-bundle frames are managed via the on-map playback bar, not as individual
      // LayerManager rows (a bundle would otherwise explode into dozens of entries).
      if (ml.bundleId) return;
      const key = `maps:${ml.id}`;
      const existingZ = zIndexMapRef.current.get(key);
      layers.push({
        url: ml.id,
        title: ml.title,
        visible: ml.visible,
        opacity: ml.opacity,
        zIndex: ml.zIndex ?? existingZ,
        data: { type: 'maps', mapsLayerId: ml.id, sourceType: ml.sourceType },
      });
    });

    // Add collection bbox layer
    if (vectorLayer && selectedCollectionExtents && selectedCollectionExtents.length > 0) {
      const source = vectorLayer.getSource();
      const hasFeatures = source && source.getFeatures().length > 0;
      if (hasFeatures) {
        const key = 'internal:bbox';
        layers.push({
          url: 'collection-bbox',
          title: 'Collection Extent',
          visible: vectorLayer.getVisible(),
          opacity: vectorLayer.getOpacity(),
          zIndex: zIndexMapRef.current.get(key),
          data: { type: 'internal', layerType: 'bbox' }
        });
      }
    }

    // Add location features layer
    if (locationLayer && locationFeatures && locationFeatures.length > 0) {
      let locationUrl = 'location-features';
      if (selectedCollection) {
        const locationQueryUrl = normalizeHref(selectedCollection.data_queries?.locations?.link?.href);
        if (locationQueryUrl) {
          locationUrl = locationQueryUrl;
        }
      }

      const key = 'internal:locations';
      layers.push({
        url: locationUrl,
        title: `Location Features (${locationFeatures.length})`,
        visible: locationLayer.getVisible(),
        opacity: locationLayer.getOpacity(),
        zIndex: zIndexMapRef.current.get(key),
        data: { type: 'internal', layerType: 'locations' }
      });
    }

    // Add clicked markers layer
    if (markerLayer) {
      const source = markerLayer.getSource();
      const featureCount = source ? source.getFeatures().length : 0;
      if (featureCount > 0) {
        const key = 'internal:markers';
        layers.push({
          url: 'clicked-markers',
          title: `Clicked Points (${featureCount})`,
          visible: markerLayer.getVisible(),
          opacity: markerLayer.getOpacity(),
          zIndex: zIndexMapRef.current.get(key),
          data: { type: 'internal', layerType: 'markers' }
        });
      }
    }

    // Add selected area layer
    if (areaLayer && selectedArea && selectedArea.length > 0) {
      const key = 'internal:area';
      layers.push({
        url: 'selected-area',
        title: 'Selected Area',
        visible: areaLayer.getVisible(),
        opacity: areaLayer.getOpacity(),
        zIndex: zIndexMapRef.current.get(key),
        data: { type: 'internal', layerType: 'area' }
      });
    }

    // Add radius layer
    if (radiusLayer) {
      const source = radiusLayer.getSource();
      const hasFeatures = source && source.getFeatures().length > 0;
      if (hasFeatures) {
        const key = 'internal:radius';
        layers.push({
          url: 'radius-circle',
          title: `Radius Circle (${radiusKm} km)`,
          visible: radiusLayer.getVisible(),
          opacity: radiusLayer.getOpacity(),
          zIndex: zIndexMapRef.current.get(key),
          data: { type: 'internal', layerType: 'radius' }
        });
      }
    }

    // Assign default zIndex to layers that don't have one yet
    // New layers get the next available index (appended to top of stack)
    const maxExisting = layers.reduce((max, l) => Math.max(max, l.zIndex ?? 0), 0);
    let nextZ = maxExisting;
    layers.forEach(l => {
      if (l.zIndex === undefined) {
        nextZ++;
        l.zIndex = nextZ;
      }
    });

    // Sort by zIndex descending (highest = top of list = rendered on top)
    layers.sort((a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0));

    // Update the zIndex map ref
    const newZMap = new Map<string, number>();
    layers.forEach(l => newZMap.set(layerKey(l), l.zIndex ?? 0));
    zIndexMapRef.current = newZMap;

    // Apply zIndex to internal OL layers
    layers.forEach(l => {
      if (l.data?.type === 'internal') {
        const z = l.zIndex ?? 0;
        switch (l.data.layerType) {
          case 'bbox': vectorLayer?.setZIndex(z); break;
          case 'locations': locationLayer?.setZIndex(z); break;
          case 'markers': markerLayer?.setZIndex(z); break;
          case 'area': areaLayer?.setZIndex(z); break;
          case 'radius': radiusLayer?.setZIndex(z); break;
        }
      }
    });

    setAllMapLayers(layers);
  }, [geoJsonLayers, mapsLayers, vectorLayer, locationLayer, markerLayer, areaLayer, radiusLayer, selectedCollectionExtents, locationFeatures, clickedCoords, selectedArea, radiusKm, selectedCollection, setAllMapLayers]);

  const handleLayerManagerChange = useCallback((updatedLayers: GeoJsonLayer[]) => {
    // Update zIndex ref from the new order
    const newZMap = new Map<string, number>();
    updatedLayers.forEach(l => newZMap.set(layerKey(l), l.zIndex ?? 0));
    zIndexMapRef.current = newZMap;

    // Filter out internal + maps layers; remaining are GeoJSON layers
    const geoJsonUpdates = updatedLayers.filter(l => !l.data || (l.data.type !== 'internal' && l.data.type !== 'maps'));
    setGeoJsonLayers(geoJsonUpdates);

    // Route Maps layer updates back to the MapsLayerContext (handles visibility, opacity, zIndex, deletion)
    const mapsUpdatesById = new Map<string, GeoJsonLayer>();
    updatedLayers.forEach(l => {
      if (l.data?.type === 'maps') mapsUpdatesById.set(l.data.mapsLayerId, l);
    });
    setMapsLayers(prev => {
      const next = [] as typeof prev;
      for (const ml of prev) {
        const update = mapsUpdatesById.get(ml.id);
        if (!update) continue; // removed in the manager UI
        next.push({
          ...ml,
          visible: update.visible,
          opacity: update.opacity ?? ml.opacity,
          zIndex: update.zIndex ?? ml.zIndex,
        });
      }
      return next;
    });

    // Update internal layer visibility, opacity, and zIndex
    updatedLayers.forEach(layer => {
      if (layer.data?.type === 'internal') {
        const opacity = layer.opacity ?? 1;
        const zIndex = layer.zIndex ?? 0;
        switch (layer.data.layerType) {
          case 'bbox':
            if (vectorLayer) {
              vectorLayer.setVisible(layer.visible);
              vectorLayer.setOpacity(opacity);
              vectorLayer.setZIndex(zIndex);
            }
            break;
          case 'locations':
            if (locationLayer) {
              locationLayer.setVisible(layer.visible);
              locationLayer.setOpacity(opacity);
              locationLayer.setZIndex(zIndex);
            }
            break;
          case 'markers':
            if (markerLayer) {
              markerLayer.setVisible(layer.visible);
              markerLayer.setOpacity(opacity);
              markerLayer.setZIndex(zIndex);
            }
            break;
          case 'area':
            if (areaLayer) {
              areaLayer.setVisible(layer.visible);
              areaLayer.setOpacity(opacity);
              areaLayer.setZIndex(zIndex);
            }
            break;
          case 'radius':
            if (radiusLayer) {
              radiusLayer.setVisible(layer.visible);
              radiusLayer.setOpacity(opacity);
              radiusLayer.setZIndex(zIndex);
            }
            break;
        }
      }
    });

    // Handle deletions for internal layers
    const internalLayers = updatedLayers.filter(l => l.data?.type === 'internal');
    const internalLayerTypes = new Set(internalLayers.map(l => l.data.layerType));

    if (!internalLayerTypes.has('markers') && markerLayer) {
      const source = markerLayer.getSource();
      if (source) source.clear();
      setClickedCoords([]);
    }

    if (!internalLayerTypes.has('area') && areaLayer) {
      const source = areaLayer.getSource();
      if (source) source.clear();
      setSelectedArea([]);
    }
  }, [vectorLayer, locationLayer, markerLayer, areaLayer, radiusLayer, setGeoJsonLayers, setMapsLayers, setClickedCoords, setSelectedArea]);

  // Register the handler in context
  useEffect(() => {
    setHandleLayerManagerChange(handleLayerManagerChange);
  }, [handleLayerManagerChange, setHandleLayerManagerChange]);
}
