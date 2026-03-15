import { useEffect, useRef } from 'react';
import Map from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import GeoJSON from 'ol/format/GeoJSON';
import { useCollection } from '../contexts/CollectionContext';

export function useLocationFeatures(
  map: Map | null,
  locationLayer: VectorLayer<VectorSource> | null
): void {
  const { locationFeatures, selectedCollectionExtents, selectedFeature } = useCollection();
  const locationFeaturesRef = useRef(locationFeatures);

  // Effect to handle location features (GeoJSON)
  useEffect(() => {
    if (map && locationLayer && locationFeatures !== locationFeaturesRef.current) {
      locationLayer.getSource()?.clear();

      if (locationFeatures && locationFeatures.length > 0) {
        const geojsonFormat = new GeoJSON({
          featureProjection: 'EPSG:3857',
          dataProjection: 'EPSG:4326'
        });

        locationFeatures.forEach((feature, index) => {
          try {
            const olFeatures = geojsonFormat.readFeatures(feature);
            const featuresArray = Array.isArray(olFeatures) ? olFeatures : [olFeatures];

            featuresArray.forEach((olFeature, subIndex) => {
              olFeature.set('featureIndex', index);
              olFeature.set('subIndex', subIndex);
              olFeature.set('layer', 'location');
              olFeature.set('name', feature.properties?.name || `Location ${index + 1}-${subIndex + 1}`);
              olFeature.set('originalFeature', feature);
              olFeature.set('featureId', feature.id);

              locationLayer.getSource()?.addFeature(olFeature);
            });
          } catch (error) {
            console.warn(`Failed to parse location feature ${index}:`, error, feature);
          }
        });

        // Only zoom to location features if there's no bbox extent being displayed
        if (!selectedCollectionExtents || selectedCollectionExtents.length === 0) {
          const extent = locationLayer.getSource()?.getExtent();
          if (extent && extent.every(coord => isFinite(coord))) {
            const hasValidArea = extent[0] !== extent[2] && extent[1] !== extent[3];

            if (!hasValidArea) {
              console.warn('Location extent has no area (point), using center with zoom instead of fit');
              const centerX = (extent[0] + extent[2]) / 2;
              const centerY = (extent[1] + extent[3]) / 2;
              map.getView().setCenter([centerX, centerY]);
              map.getView().setZoom(10);
            } else {
              try {
                map.getView().fit(extent, {
                  padding: [50, 50, 50, 50],
                  duration: 1000,
                  maxZoom: 10
                });
              } catch (error) {
                console.error('Error fitting location extent to map view:', error, extent);
              }
            }
          }
        }
      }

      locationFeaturesRef.current = locationFeatures;
    } else if (map && locationLayer && locationFeatures === null) {
      locationLayer.getSource()?.clear();
      locationFeaturesRef.current = null;
    }
  }, [map, locationLayer, locationFeatures, selectedCollectionExtents]);

  // Effect to refresh location layer styles when selected feature changes
  useEffect(() => {
    if (locationLayer) {
      locationLayer.changed();
    }
  }, [selectedFeature, locationLayer]);
}
