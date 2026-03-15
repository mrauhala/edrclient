import { useState, useEffect, useRef, type RefObject } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import Overlay from 'ol/Overlay';
import { Style, Stroke, Fill, Circle } from 'ol/style';
import { defaults as defaultControls } from 'ol/control';
import { useGeoJsonLayers } from '../contexts/GeoJsonLayerContext';
import { useCollection } from '../contexts/CollectionContext';

export interface UseMapSetupReturn {
  map: Map | null;
  vectorLayer: VectorLayer<VectorSource> | null;
  locationLayer: VectorLayer<VectorSource> | null;
  markerLayer: VectorLayer<VectorSource> | null;
  areaLayer: VectorLayer<VectorSource> | null;
  radiusLayer: VectorLayer<VectorSource> | null;
  tooltipRef: RefObject<HTMLDivElement>;
}

export function useMapSetup(zoomLevel: number): UseMapSetupReturn {
  const { setSelectedGeoJsonFeature } = useGeoJsonLayers();
  const { locationFeatures, selectedFeature, setSelectedFeature } = useCollection();

  const [map, setMap] = useState<Map | null>(null);
  const [vectorLayer, setVectorLayer] = useState<VectorLayer<VectorSource> | null>(null);
  const [locationLayer, setLocationLayer] = useState<VectorLayer<VectorSource> | null>(null);
  const [markerLayer, setMarkerLayer] = useState<VectorLayer<VectorSource> | null>(null);
  const [areaLayer, setAreaLayer] = useState<VectorLayer<VectorSource> | null>(null);
  const [radiusLayer, setRadiusLayer] = useState<VectorLayer<VectorSource> | null>(null);

  const selectedFeatureRef = useRef(selectedFeature);
  const onFeatureSelectRef = useRef(setSelectedFeature);
  const locationFeaturesRef = useRef(locationFeatures);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Keep refs in sync with current values
  useEffect(() => { selectedFeatureRef.current = selectedFeature; }, [selectedFeature]);
  useEffect(() => { onFeatureSelectRef.current = setSelectedFeature; }, [setSelectedFeature]);
  useEffect(() => { locationFeaturesRef.current = locationFeatures; }, [locationFeatures]);

  // Map initialization — creates map, layers, click/hover handlers
  useEffect(() => {
    // Create vector source and layer for bounding box rectangles
    const vectorSource = new VectorSource();
    const newVectorLayer = new VectorLayer({
      source: vectorSource,
      style: new Style({
        stroke: new Stroke({
          color: '#ff0000',
          width: 2,
        }),
        fill: new Fill({
          color: 'rgba(255, 0, 0, 0.05)',
        }),
      }),
    });

    // Create vector source and layer for location features
    const locationSource = new VectorSource();
    const newLocationLayer = new VectorLayer({
      source: locationSource,
      style: (feature) => {
        const geometry = feature.getGeometry();
        if (!geometry) return new Style();

        const geometryType = geometry.getType();
        const originalFeature = feature.get('originalFeature');
        const featureId = feature.get('featureId');

        // Check if this feature is selected by comparing the feature objects or IDs
        const currentSelectedFeature = selectedFeatureRef.current;
        const isSelected = currentSelectedFeature && (
          currentSelectedFeature === originalFeature ||
          (featureId && currentSelectedFeature.id === featureId)
        );

        if (geometryType === 'Point') {
          return new Style({
            image: new Circle({
              radius: isSelected ? 12 : 8,
              fill: new Fill({
                color: isSelected ? '#FF9800' : '#2196F3',
              }),
              stroke: new Stroke({
                color: isSelected ? '#F57C00' : '#ffffff',
                width: isSelected ? 4 : 3,
              }),
            }),
          });
        } else if (geometryType === 'LineString' || geometryType === 'MultiLineString') {
          return new Style({
            stroke: new Stroke({
              color: isSelected ? '#FF9800' : '#2196F3',
              width: isSelected ? 6 : 4,
            }),
          });
        } else if (geometryType === 'Polygon' || geometryType === 'MultiPolygon') {
          return new Style({
            stroke: new Stroke({
              color: isSelected ? '#FF9800' : '#2196F3',
              width: isSelected ? 4 : 3,
            }),
            fill: new Fill({
              color: isSelected ? 'rgba(255, 152, 0, 0.4)' : 'rgba(33, 150, 243, 0.3)',
            }),
          });
        }

        // Default style
        return new Style({
          stroke: new Stroke({
            color: isSelected ? '#FF9800' : '#2196F3',
            width: isSelected ? 3 : 2,
          }),
          fill: new Fill({
            color: isSelected ? 'rgba(255, 152, 0, 0.3)' : 'rgba(33, 150, 243, 0.2)',
          }),
        });
      },
    });

    // Create marker layer for position query clicks
    const newMarkerLayer = new VectorLayer({
      source: new VectorSource(),
      style: new Style({
        image: new Circle({
          radius: 8,
          fill: new Fill({ color: 'rgba(255, 0, 0, 0.8)' }),
          stroke: new Stroke({ color: 'white', width: 2 }),
        }),
      }),
    });

    // Create area layer for area query selections
    const newAreaLayer = new VectorLayer({
      source: new VectorSource(),
      style: new Style({
        stroke: new Stroke({
          color: 'rgba(255, 0, 0, 0.8)',
          width: 3,
        }),
        fill: new Fill({
          color: 'rgba(255, 0, 0, 0.1)',
        }),
      }),
    });

    const newRadiusLayer = new VectorLayer({
      source: new VectorSource(),
      style: new Style({
        stroke: new Stroke({
          color: 'rgba(0, 123, 255, 0.8)',
          width: 2,
        }),
        fill: new Fill({
          color: 'rgba(0, 123, 255, 0.2)',
        }),
        image: new Circle({
          radius: 6,
          fill: new Fill({
            color: 'rgba(0, 123, 255, 1)',
          }),
          stroke: new Stroke({
            color: 'white',
            width: 2,
          }),
        }),
      }),
    });

    const openLayersMap = new Map({
      target: 'map',
      controls: defaultControls({
        zoom: false,
      }),
      layers: [
        new TileLayer({
          source: new XYZ({
            url: 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            attributions: '© <a href="https://carto.com/attributions">CARTO</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          }),
        }),
        newVectorLayer,
        newLocationLayer,
        newMarkerLayer,
        newAreaLayer,
        newRadiusLayer,
      ],
      view: new View({
        center: [0, 0],
        zoom: zoomLevel,
      }),
    });

    setMap(openLayersMap);
    setVectorLayer(newVectorLayer);
    setLocationLayer(newLocationLayer);
    setMarkerLayer(newMarkerLayer);
    setAreaLayer(newAreaLayer);
    setRadiusLayer(newRadiusLayer);

    // Create tooltip overlay
    const tooltip = new Overlay({
      element: tooltipRef.current!,
      offset: [10, 0],
      positioning: 'bottom-left',
    });
    openLayersMap.addOverlay(tooltip);

    // Add click interaction for location features and GeoJSON features
    openLayersMap.on('click', (event) => {
      const features = openLayersMap.getFeaturesAtPixel(event.pixel);
      if (features && features.length > 0) {
        // First, check for GeoJSON layer features
        const geoJsonFeature = features.find(feature => {
          const layer = feature.get('layer');
          return layer === 'geojson';
        });

        if (geoJsonFeature) {
          setSelectedGeoJsonFeature(geoJsonFeature);
          return;
        }

        // Look for location features
        const locationFeature = features.find(feature => {
          const layer = feature.get('layer');
          return layer === 'location' || feature.get('featureIndex') !== undefined;
        });

        if (locationFeature) {
          const featureIndex = locationFeature.get('featureIndex');
          const originalFeature = locationFeaturesRef.current?.[featureIndex];

          if (originalFeature) {
            onFeatureSelectRef.current?.(originalFeature);
          }
        } else {
          onFeatureSelectRef.current?.(null);
          setSelectedGeoJsonFeature(null);
        }
      } else {
        onFeatureSelectRef.current?.(null);
        setSelectedGeoJsonFeature(null);
      }
    });

    // Add pointer cursor when hovering over features, and show tooltip
    openLayersMap.on('pointermove', (event) => {
      const features = openLayersMap.getFeaturesAtPixel(event.pixel);

      // Check for GeoJSON features first
      const geoJsonFeature = features && features.find(feature => {
        const layer = feature.get('layer');
        return layer === 'geojson';
      });

      if (geoJsonFeature && tooltip) {
        const layerTitle = geoJsonFeature.get('layerTitle') || 'GeoJSON Layer';
        const properties = geoJsonFeature.getProperties();
        const displayName = properties.name || properties.id || properties.title || 'Feature';

        if (tooltipRef.current) {
          tooltipRef.current.textContent = `${layerTitle}: ${displayName}`;
          tooltipRef.current.style.display = 'block';
        }
        tooltip.setPosition(event.coordinate);
        openLayersMap.getTargetElement().style.cursor = 'pointer';
        return;
      }

      // Check for location features
      const locationFeature = features && features.find(feature => {
        const layer = feature.get('layer');
        return layer === 'location' || feature.get('featureIndex') !== undefined;
      });

      if (locationFeature && tooltip) {
        const featureIndex = locationFeature.get('featureIndex');
        const originalFeature = locationFeaturesRef.current?.[featureIndex];

        if (originalFeature) {
          const name = originalFeature.properties?.name || originalFeature.id || 'Unknown Location';
          if (tooltipRef.current) {
            tooltipRef.current.textContent = name;
            tooltipRef.current.style.display = 'block';
          }
          tooltip.setPosition(event.coordinate);
        }

        openLayersMap.getTargetElement().style.cursor = 'pointer';
      } else {
        if (tooltipRef.current) {
          tooltipRef.current.style.display = 'none';
        }
        if (tooltip) {
          tooltip.setPosition(undefined);
        }
        openLayersMap.getTargetElement().style.cursor = '';
      }
    });

    return () => {
      openLayersMap.setTarget(undefined);
    };
  }, [zoomLevel, setSelectedGeoJsonFeature]);

  return { map, vectorLayer, locationLayer, markerLayer, areaLayer, radiusLayer, tooltipRef };
}
