import { useState, useEffect, useRef } from 'react';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Map from 'ol/Map';
import GeoJSON from 'ol/format/GeoJSON';
import { Style, Stroke, Fill, Circle, Text } from 'ol/style';
import { bbox as bboxStrategy } from 'ol/loadingstrategy';
import { toLonLat } from 'ol/proj';
import { sanitizeUrl } from '../utils/sanitizeUrl';
import { useGeoJsonLayers } from '../contexts/GeoJsonLayerContext';

export interface UseGeoJsonOverlaysReturn {
  geoJsonVectorLayers: { [key: string]: VectorLayer<VectorSource> };
  geoJsonMetadata: { [key: string]: { numberReturned?: number; numberMatched?: number } };
}

export function useGeoJsonOverlays(map: Map | null): UseGeoJsonOverlaysReturn {
  const { geoJsonLayers } = useGeoJsonLayers();
  const [geoJsonVectorLayers, setGeoJsonVectorLayers] = useState<{ [key: string]: VectorLayer<VectorSource> }>({});
  const [geoJsonMetadata, setGeoJsonMetadata] = useState<{ [key: string]: { numberReturned?: number; numberMatched?: number } }>({});
  const geoJsonLayersRef = useRef(geoJsonLayers);

  useEffect(() => {
    if (!map) return;

    const layersChanged = JSON.stringify(geoJsonLayers) !== JSON.stringify(geoJsonLayersRef.current);
    if (!layersChanged) return;

    geoJsonLayersRef.current = geoJsonLayers;

    const newLayers: { [key: string]: VectorLayer<VectorSource> } = {};
    const currentLayerKeys = new Set(Object.keys(geoJsonVectorLayers));
    const newLayerKeys = new Set<string>();

    geoJsonLayers.forEach((layerConfig) => {
      const layerKey = layerConfig.url;
      newLayerKeys.add(layerKey);

      if (layerConfig.visible) {
        const existingLayer = geoJsonVectorLayers[layerKey];
        const needsStyleUpdate = existingLayer &&
          existingLayer.get('labelProperty') !== layerConfig.labelProperty;

        if (existingLayer && !needsStyleUpdate) {
          newLayers[layerKey] = existingLayer;
        } else if (existingLayer && needsStyleUpdate) {
          existingLayer.setStyle((feature) => {
            const labelProperty = layerConfig.labelProperty;
            const properties = feature.getProperties();
            let labelText = '';

            if (labelProperty && properties[labelProperty] !== undefined && properties[labelProperty] !== null) {
              labelText = String(properties[labelProperty]);
            }

            return createGeoJsonStyle(labelText);
          });

          existingLayer.set('labelProperty', layerConfig.labelProperty);
          existingLayer.changed();
          newLayers[layerKey] = existingLayer;
        } else {
          // Create new layer
          const geojsonFormat = new GeoJSON({
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857',
          });

          const vectorSource = new VectorSource({
            format: geojsonFormat,
            strategy: bboxStrategy
          });

          // Mark all features from this source as GeoJSON layer features
          vectorSource.on('addfeature', (event) => {
            if (event.feature) {
              event.feature.set('layer', 'geojson');
              event.feature.set('layerTitle', layerConfig.title);
              event.feature.set('layerUrl', layerConfig.url);
            }
          });

          if (layerConfig.data) {
            try {
              if (layerConfig.data.numberReturned !== undefined || layerConfig.data.numberMatched !== undefined) {
                setGeoJsonMetadata(prev => ({
                  ...prev,
                  [layerKey]: {
                    numberReturned: layerConfig.data.numberReturned,
                    numberMatched: layerConfig.data.numberMatched
                  }
                }));
              }

              const features = geojsonFormat.readFeatures(layerConfig.data, {
                featureProjection: 'EPSG:3857'
              });

              vectorSource.addFeatures(features);
            } catch (error) {
              console.error('Error parsing pre-fetched GeoJSON:', error);
            }
          } else {
            const loader = function(extent: any, _resolution: any, projection: any) {
              const [minX, minY, maxX, maxY] = extent;
              const [minLon, minLat] = toLonLat([minX, minY]);
              const [maxLon, maxLat] = toLonLat([maxX, maxY]);
              const bboxString = `${minLon},${minLat},${maxLon},${maxLat}`;

              const separator = layerConfig.url.includes('?') ? '&' : '?';
              let finalUrl = `${layerConfig.url}${separator}bbox=${bboxString}&limit=2000`;

              if (layerConfig.apiKey) {
                const paramName = layerConfig.apiKeyParam || 'api-key';
                finalUrl = `${finalUrl}&${paramName}=${layerConfig.apiKey}`;
              }

              console.log('Loading GeoJSON with bbox:', sanitizeUrl(finalUrl));

              fetch(finalUrl)
                .then(response => response.json())
                .then(data => {
                  if (data.numberReturned !== undefined || data.numberMatched !== undefined) {
                    setGeoJsonMetadata(prev => ({
                      ...prev,
                      [layerKey]: {
                        numberReturned: data.numberReturned,
                        numberMatched: data.numberMatched
                      }
                    }));
                  }

                  const features = geojsonFormat.readFeatures(data, {
                    featureProjection: projection
                  });

                  vectorSource.addFeatures(features);
                })
                .catch(error => {
                  console.error('Error loading GeoJSON:', error);
                  vectorSource.removeLoadedExtent(extent);
                });
            };

            vectorSource.setLoader(loader);
          }

          const geoJsonLayer = new VectorLayer({
            source: vectorSource,
            style: (feature) => {
              const labelProperty = layerConfig.labelProperty;
              const properties = feature.getProperties();
              let labelText = '';

              if (labelProperty && properties[labelProperty] !== undefined && properties[labelProperty] !== null) {
                labelText = String(properties[labelProperty]);
              }

              return createGeoJsonStyle(labelText);
            },
          });

          geoJsonLayer.set('labelProperty', layerConfig.labelProperty);
          map.addLayer(geoJsonLayer);
          newLayers[layerKey] = geoJsonLayer;
        }
      }
    });

    // Remove layers that are no longer visible or no longer in the list
    currentLayerKeys.forEach((layerKey) => {
      const layerConfig = geoJsonLayers.find(l => l.url === layerKey);
      const shouldRemove = !layerConfig || !layerConfig.visible || !newLayerKeys.has(layerKey);

      if (shouldRemove && geoJsonVectorLayers[layerKey]) {
        map.removeLayer(geoJsonVectorLayers[layerKey]);
      }
    });

    setGeoJsonVectorLayers(newLayers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, geoJsonLayers]);

  return { geoJsonVectorLayers, geoJsonMetadata };
}

function createGeoJsonStyle(labelText: string): Style {
  return new Style({
    stroke: new Stroke({
      color: '#FF9800',
      width: 2,
    }),
    fill: new Fill({
      color: 'rgba(255, 152, 0, 0.3)',
    }),
    image: new Circle({
      radius: 6,
      fill: new Fill({
        color: '#FF9800',
      }),
      stroke: new Stroke({
        color: '#ffffff',
        width: 2,
      }),
    }),
    text: labelText ? new Text({
      text: labelText,
      offsetY: -15,
      fill: new Fill({
        color: '#6BFB66',
      }),
      stroke: new Stroke({
        color: '#424242',
        width: 1,
      }),
      font: 'bold 12px sans-serif',
    }) : undefined,
  });
}
