import { useState, useEffect } from 'react';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { normalizeHref } from '../DataRetrievalAPI';
import { useGeoJsonLayers, type GeoJsonLayer } from '../contexts/GeoJsonLayerContext';
import { useMapInteraction } from '../contexts/MapInteractionContext';
import { useCollection } from '../contexts/CollectionContext';

export interface UseLayerManagerSyncReturn {
  allMapLayers: GeoJsonLayer[];
  handleLayerManagerChange: (layers: GeoJsonLayer[]) => void;
}

export function useLayerManagerSync(
  vectorLayer: VectorLayer<VectorSource> | null,
  locationLayer: VectorLayer<VectorSource> | null,
  markerLayer: VectorLayer<VectorSource> | null,
  areaLayer: VectorLayer<VectorSource> | null,
  radiusLayer: VectorLayer<VectorSource> | null,
): UseLayerManagerSyncReturn {
  const { geoJsonLayers, setGeoJsonLayers } = useGeoJsonLayers();
  const { selectedArea, radiusKm, setClickedCoords, setSelectedArea } = useMapInteraction();
  const { selectedCollection, selectedCollectionExtents, locationFeatures } = useCollection();
  const [allMapLayers, setAllMapLayers] = useState<GeoJsonLayer[]>([]);

  // Sync all map layers into allMapLayers state for LayerManager
  useEffect(() => {
    const layers: GeoJsonLayer[] = [];

    // Add GeoJSON layers
    layers.push(...geoJsonLayers);

    // Add collection bbox layer
    if (vectorLayer && selectedCollectionExtents && selectedCollectionExtents.length > 0) {
      const source = vectorLayer.getSource();
      const hasFeatures = source && source.getFeatures().length > 0;
      if (hasFeatures) {
        layers.push({
          url: 'collection-bbox',
          title: 'Collection Extent',
          visible: vectorLayer.getVisible(),
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
          data: { type: 'internal', layerType: 'radius' }
        });
      }
    }

    setAllMapLayers(layers);
  }, [geoJsonLayers, vectorLayer, locationLayer, markerLayer, areaLayer, radiusLayer, selectedCollectionExtents, locationFeatures, selectedArea, radiusKm, selectedCollection]);

  const handleLayerManagerChange = (updatedLayers: GeoJsonLayer[]) => {
    // Filter out internal layers
    const geoJsonUpdates = updatedLayers.filter(l => !l.data || l.data.type !== 'internal');
    setGeoJsonLayers(geoJsonUpdates);

    // Update internal layer visibility
    updatedLayers.forEach(layer => {
      if (layer.data?.type === 'internal') {
        switch (layer.data.layerType) {
          case 'bbox':
            if (vectorLayer) vectorLayer.setVisible(layer.visible);
            break;
          case 'locations':
            if (locationLayer) locationLayer.setVisible(layer.visible);
            break;
          case 'markers':
            if (markerLayer) markerLayer.setVisible(layer.visible);
            break;
          case 'area':
            if (areaLayer) areaLayer.setVisible(layer.visible);
            break;
          case 'radius':
            if (radiusLayer) radiusLayer.setVisible(layer.visible);
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
  };

  return { allMapLayers, handleLayerManagerChange };
}
