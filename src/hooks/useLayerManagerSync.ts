import { useEffect, useCallback } from 'react';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { normalizeHref } from '../DataRetrievalAPI';
import { useGeoJsonLayers, type GeoJsonLayer } from '../contexts/GeoJsonLayerContext';
import { useMapInteraction } from '../contexts/MapInteractionContext';
import { useCollection } from '../contexts/CollectionContext';
import { useLayerManager } from '../contexts/LayerManagerContext';

export function useLayerManagerSync(
  vectorLayer: VectorLayer<VectorSource> | null,
  locationLayer: VectorLayer<VectorSource> | null,
  markerLayer: VectorLayer<VectorSource> | null,
  areaLayer: VectorLayer<VectorSource> | null,
  radiusLayer: VectorLayer<VectorSource> | null,
): void {
  const { geoJsonLayers, setGeoJsonLayers } = useGeoJsonLayers();
  const { selectedArea, radiusKm, setClickedCoords, setSelectedArea } = useMapInteraction();
  const { selectedCollection, selectedCollectionExtents, locationFeatures } = useCollection();
  const { setAllMapLayers, setHandleLayerManagerChange } = useLayerManager();

  // Sync all map layers into context for LayerManager
  useEffect(() => {
    const layers: GeoJsonLayer[] = [];

    // Add GeoJSON layers (ensure opacity defaults)
    layers.push(...geoJsonLayers.map(l => ({ ...l, opacity: l.opacity ?? 1 })));

    // Add collection bbox layer
    if (vectorLayer && selectedCollectionExtents && selectedCollectionExtents.length > 0) {
      const source = vectorLayer.getSource();
      const hasFeatures = source && source.getFeatures().length > 0;
      if (hasFeatures) {
        layers.push({
          url: 'collection-bbox',
          title: 'Collection Extent',
          visible: vectorLayer.getVisible(),
          opacity: vectorLayer.getOpacity(),
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

      layers.push({
        url: locationUrl,
        title: `Location Features (${locationFeatures.length})`,
        visible: locationLayer.getVisible(),
        opacity: locationLayer.getOpacity(),
        data: { type: 'internal', layerType: 'locations' }
      });
    }

    // Add clicked markers layer
    if (markerLayer) {
      const source = markerLayer.getSource();
      const featureCount = source ? source.getFeatures().length : 0;
      if (featureCount > 0) {
        layers.push({
          url: 'clicked-markers',
          title: `Clicked Points (${featureCount})`,
          visible: markerLayer.getVisible(),
          opacity: markerLayer.getOpacity(),
          data: { type: 'internal', layerType: 'markers' }
        });
      }
    }

    // Add selected area layer
    if (areaLayer && selectedArea && selectedArea.length > 0) {
      layers.push({
        url: 'selected-area',
        title: 'Selected Area',
        visible: areaLayer.getVisible(),
        opacity: areaLayer.getOpacity(),
        data: { type: 'internal', layerType: 'area' }
      });
    }

    // Add radius layer
    if (radiusLayer) {
      const source = radiusLayer.getSource();
      const hasFeatures = source && source.getFeatures().length > 0;
      if (hasFeatures) {
        layers.push({
          url: 'radius-circle',
          title: `Radius Circle (${radiusKm} km)`,
          visible: radiusLayer.getVisible(),
          opacity: radiusLayer.getOpacity(),
          data: { type: 'internal', layerType: 'radius' }
        });
      }
    }

    setAllMapLayers(layers);
  }, [geoJsonLayers, vectorLayer, locationLayer, markerLayer, areaLayer, radiusLayer, selectedCollectionExtents, locationFeatures, selectedArea, radiusKm, selectedCollection, setAllMapLayers]);

  const handleLayerManagerChange = useCallback((updatedLayers: GeoJsonLayer[]) => {
    // Filter out internal layers and update GeoJSON layers in context
    const geoJsonUpdates = updatedLayers.filter(l => !l.data || l.data.type !== 'internal');
    setGeoJsonLayers(geoJsonUpdates);

    // Update internal layer visibility and opacity
    updatedLayers.forEach(layer => {
      if (layer.data?.type === 'internal') {
        const opacity = layer.opacity ?? 1;
        switch (layer.data.layerType) {
          case 'bbox':
            if (vectorLayer) {
              vectorLayer.setVisible(layer.visible);
              vectorLayer.setOpacity(opacity);
            }
            break;
          case 'locations':
            if (locationLayer) {
              locationLayer.setVisible(layer.visible);
              locationLayer.setOpacity(opacity);
            }
            break;
          case 'markers':
            if (markerLayer) {
              markerLayer.setVisible(layer.visible);
              markerLayer.setOpacity(opacity);
            }
            break;
          case 'area':
            if (areaLayer) {
              areaLayer.setVisible(layer.visible);
              areaLayer.setOpacity(opacity);
            }
            break;
          case 'radius':
            if (radiusLayer) {
              radiusLayer.setVisible(layer.visible);
              radiusLayer.setOpacity(opacity);
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
  }, [vectorLayer, locationLayer, markerLayer, areaLayer, radiusLayer, setGeoJsonLayers, setClickedCoords, setSelectedArea]);

  // Register the handler in context
  useEffect(() => {
    setHandleLayerManagerChange(handleLayerManagerChange);
  }, [handleLayerManagerChange, setHandleLayerManagerChange]);
}
