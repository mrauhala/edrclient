import { useState, useEffect, useRef, type RefObject } from 'react';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import Overlay from 'ol/Overlay';
import type { Pixel } from 'ol/pixel';
import { Style, Stroke, Fill, Circle } from 'ol/style';
import { defaults as defaultControls } from 'ol/control';
import { defaults as defaultInteractions } from 'ol/interaction';
import { useGeoJsonLayers } from '../contexts/GeoJsonLayerContext';
import { useCollection } from '../contexts/CollectionContext';
import { useMapInteraction } from '../contexts/MapInteractionContext';
import { locationHitTolerance, locationStyle } from '../locationStyle';
import { zoomToPoint } from '../mapView';
import { takesMapGeometry } from '../query/queryTypes';

function getCartoApiKey(): string | undefined {
  return window.__RUNTIME_CONFIG__?.VITE_CARTO_API_KEY || import.meta.env.VITE_CARTO_API_KEY;
}

const ESRI_CANVAS = 'https://services.arcgisonline.com/arcgis/rest/services/Canvas';
const ESRI_ATTRIBUTION = 'Powered by <a href="https://www.esri.com">Esri</a> | Esri, HERE, Garmin, © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, and the GIS user community';

// The dark basemap. Carto's needs an API key now (without one its tiles show a watermark), so it's
// used only with a key (build env or the CLI's --carto-api-key). Otherwise Esri's Dark Gray Canvas,
// keyless: its place names are a separate layer, drawn above every data layer so they stay
// readable over overlays. Esri has data to zoom 16; OpenLayers scales that up beyond.
function basemapLayers(): TileLayer<XYZ>[] {
  const cartoKey = getCartoApiKey();
  if (cartoKey) {
    return [new TileLayer({
      source: new XYZ({
        url: `https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png?key=${encodeURIComponent(cartoKey)}`,
        attributions: '© <a href="https://carto.com/attributions">CARTO</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }),
    })];
  }
  const esri = (service: string, attributions?: string) =>
    new XYZ({ url: `${ESRI_CANVAS}/${service}/MapServer/tile/{z}/{y}/{x}`, maxZoom: 16, attributions });
  return [
    new TileLayer({ source: esri('World_Dark_Gray_Base', ESRI_ATTRIBUTION) }),
    // The layer manager numbers data layers from 0 up, so this stays on top
    new TileLayer({ source: esri('World_Dark_Gray_Reference'), zIndex: 10000 }),
  ];
}

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
  const { dataQuery, setViewExtent, setViewSize } = useMapInteraction();

  const [map, setMap] = useState<Map | null>(null);
  const [vectorLayer, setVectorLayer] = useState<VectorLayer<VectorSource> | null>(null);
  const [locationLayer, setLocationLayer] = useState<VectorLayer<VectorSource> | null>(null);
  const [markerLayer, setMarkerLayer] = useState<VectorLayer<VectorSource> | null>(null);
  const [areaLayer, setAreaLayer] = useState<VectorLayer<VectorSource> | null>(null);
  const [radiusLayer, setRadiusLayer] = useState<VectorLayer<VectorSource> | null>(null);

  const selectedFeatureRef = useRef(selectedFeature);
  const onFeatureSelectRef = useRef(setSelectedFeature);
  const locationFeaturesRef = useRef(locationFeatures);
  const dataQueryRef = useRef(dataQuery);
  const pickedOnMapRef = useRef<unknown>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Keep refs in sync with current values
  useEffect(() => { selectedFeatureRef.current = selectedFeature; }, [selectedFeature]);
  useEffect(() => { onFeatureSelectRef.current = setSelectedFeature; }, [setSelectedFeature]);
  useEffect(() => { locationFeaturesRef.current = locationFeatures; }, [locationFeatures]);
  useEffect(() => { dataQueryRef.current = dataQuery; }, [dataQuery]);

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

        const originalFeature = feature.get('originalFeature');
        const featureId = feature.get('featureId');

        // Check if this feature is selected by comparing the feature objects or IDs
        const currentSelectedFeature = selectedFeatureRef.current;
        const isSelected = currentSelectedFeature && (
          currentSelectedFeature === originalFeature ||
          (featureId && currentSelectedFeature.id === featureId)
        );

        return locationStyle(geometry.getType(), !!isSelected);
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

    const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    const openLayersMap = new Map({
      target: 'map',
      controls: defaultControls({
        zoom: false,
      }),
      // The map has a tabindex for the keyboard shortcuts, and then OpenLayers' default pans and
      // wheel-zooms only once the map has focus: on a phone one finger did nothing until a tap. The
      // map isn't in a page that scrolls, so it doesn't need to wait. No rotation
      interactions: defaultInteractions({
        onFocusOnly: false,
        altShiftDragRotate: false,
        pinchRotate: false,
      }),
      // A finger moves a few pixels during a tap, and past the default 1 px OpenLayers takes it for a
      // drag: on a phone most taps added no point
      moveTolerance: coarsePointer ? 10 : 1,
      layers: [
        ...basemapLayers(),
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

    // Publish current view extent + viewport size so the sidebar can build "copyable" map URLs.
    const publishView = () => {
      const size = openLayersMap.getSize();
      if (size) setViewSize([size[0], size[1]]);
      const extent = openLayersMap.getView().calculateExtent(size ?? undefined);
      if (extent && extent.every(Number.isFinite)) {
        setViewExtent([extent[0], extent[1], extent[2], extent[3]]);
      }
    };
    openLayersMap.on('moveend', publishView);
    openLayersMap.once('postrender', publishView);

    // A marker is small, so near one counts as on it, and the nearest wins
    const locationAt = (pixel: Pixel) => openLayersMap.getFeaturesAtPixel(pixel, {
      layerFilter: layer => layer === newLocationLayer,
      hitTolerance: locationHitTolerance(coarsePointer),
    })[0];

    // Add click interaction for location features and GeoJSON features
    openLayersMap.on('click', (event) => {
      const geoJsonFeature = openLayersMap.getFeaturesAtPixel(event.pixel).find(feature => feature.get('layer') === 'geojson');
      if (geoJsonFeature) {
        setSelectedGeoJsonFeature(geoJsonFeature);
        return;
      }

      // A query that takes its geometry from the map gets the tap like any other: selecting a location
      // would switch it to `locations` and drop what it has
      const locationFeature = !takesMapGeometry(dataQueryRef.current) && locationAt(event.pixel);
      if (locationFeature) {
        const originalFeature = locationFeaturesRef.current?.[locationFeature.get('featureIndex')];
        if (originalFeature) {
          pickedOnMapRef.current = originalFeature;
          onFeatureSelectRef.current?.(originalFeature);
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
      const locationFeature = locationAt(event.pixel);

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
      openLayersMap.un('moveend', publishView);
      openLayersMap.setTarget(undefined);
    };
  }, [zoomLevel, setSelectedGeoJsonFeature, setViewExtent, setViewSize]);

  // Zoom in on a location selected in the list or search. One picked on the map is already in view,
  // and zooming in would mean zooming back out to pick another
  useEffect(() => {
    const pickedOnMap = pickedOnMapRef.current;
    pickedOnMapRef.current = null;
    if (!map || selectedFeature === pickedOnMap) return;
    if (selectedFeature?.geometry?.type === 'Point' && selectedFeature.geometry.coordinates) {
      zoomToPoint(map.getView(), selectedFeature.geometry.coordinates);
    }
  }, [map, selectedFeature]);

  return { map, vectorLayer, locationLayer, markerLayer, areaLayer, radiusLayer, tooltipRef };
}
