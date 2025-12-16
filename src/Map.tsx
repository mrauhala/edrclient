// ...existing imports...
import React, { useState, useEffect, useRef } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import XYZ from 'ol/source/XYZ';
import Overlay from 'ol/Overlay';
import { Feature } from 'ol';
import { Polygon, Point, LineString } from 'ol/geom';
import { fromLonLat, toLonLat } from 'ol/proj';
import { Style, Stroke, Fill, Circle, Text } from 'ol/style';
import GeoJSON from 'ol/format/GeoJSON';
import { defaults as defaultControls } from 'ol/control';
import Draw from 'ol/interaction/Draw';
import { DrawEvent } from 'ol/interaction/Draw';
import { bbox as bboxStrategy } from 'ol/loadingstrategy';
import FeatureInfo from './FeatureInfo';
import GeoJsonFeatureViewer from './GeoJsonFeatureViewer';
import LayerManager from './LayerManager';
import { Collection, normalizeTemporal, formatTemporalInterval, getOverallTemporalExtent, normalizeVertical, formatVerticalInterval, getOverallVerticalExtent, getVerticalUnit } from './DataRetrievalAPI';


interface MapProps {
  zoomLevel: number;
  boundingBox: [number, number, number, number];
  selectedCollectionExtents?: [number, number, number, number][] | null;
  selectedCollection?: Collection | null;
  locationFeatures?: any[] | null;
  selectedFeature?: any | null;
  clickedCoords?: [number, number][];
  selectedArea?: [number, number][][];
  radiusKm?: number;
  dataQuery?: string;
  onFeatureSelect?: (feature: any | null) => void;
  onMapClick?: (coords: [number, number][]) => void;
  onAreaSelect?: (area: [number, number][][]) => void;
  onRadiusChange?: (radius: number) => void;
  geoJsonLayers?: {url: string, title: string, visible: boolean, labelProperty?: string, data?: any, apiKey?: string, apiKeyParam?: string}[];
  selectedGeoJsonFeature?: any | null;
  onGeoJsonFeatureSelect?: (feature: any | null) => void;
  onGeoJsonLayerUpdate?: (layers: {url: string, title: string, visible: boolean, labelProperty?: string, data?: any, apiKey?: string, apiKeyParam?: string}[]) => void;
}

const OpenLayersMap: React.FC<MapProps> = ({ zoomLevel, boundingBox, selectedCollectionExtents, selectedCollection, locationFeatures, selectedFeature, clickedCoords, selectedArea, radiusKm, dataQuery, onFeatureSelect, onMapClick, onAreaSelect, onRadiusChange, geoJsonLayers = [], selectedGeoJsonFeature, onGeoJsonFeatureSelect, onGeoJsonLayerUpdate }) => {
  const [map, setMap] = useState<Map | null>(null);
  const [vectorLayer, setVectorLayer] = useState<VectorLayer<VectorSource> | null>(null);
  const [locationLayer, setLocationLayer] = useState<VectorLayer<VectorSource> | null>(null);
  const [markerLayer, setMarkerLayer] = useState<VectorLayer<VectorSource> | null>(null);
  const [areaLayer, setAreaLayer] = useState<VectorLayer<VectorSource> | null>(null);
  const [radiusLayer, setRadiusLayer] = useState<VectorLayer<VectorSource> | null>(null);
  const [drawInteraction, setDrawInteraction] = useState<Draw | null>(null);
  const [geoJsonVectorLayers, setGeoJsonVectorLayers] = useState<{[key: string]: VectorLayer<VectorSource>}>({});
  const [geoJsonMetadata, setGeoJsonMetadata] = useState<{[key: string]: {numberReturned?: number, numberMatched?: number}}>({});
  const boundingBoxRef = useRef(boundingBox);
  const selectedExtentsRef = useRef(selectedCollectionExtents);
  const locationFeaturesRef = useRef(locationFeatures);
  const selectedFeatureRef = useRef(selectedFeature);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const onFeatureSelectRef = useRef(onFeatureSelect);
  const selectedAreaRef = useRef(selectedArea);
  const clickedCoordsRef = useRef(clickedCoords);
  const geoJsonLayersRef = useRef<{url: string, title: string, visible: boolean, labelProperty?: string, data?: any, apiKey?: string, apiKeyParam?: string}[]>([]);

  // Update selectedFeatureRef when selectedFeature changes
  useEffect(() => {
    selectedFeatureRef.current = selectedFeature;
  }, [selectedFeature]);

  // Effect to reset trajectory state when leaving trajectory mode
  useEffect(() => {
    if (dataQuery && dataQuery.toLowerCase() !== 'trajectory') {
      if (markerLayer) {
        const source = markerLayer.getSource();
        if (source) source.clear();
      }
    }
  }, [dataQuery, markerLayer]);


  // Keep the callback ref updated
  useEffect(() => {
    onFeatureSelectRef.current = onFeatureSelect;
  }, [onFeatureSelect]);

  // Keep the area ref updated
  useEffect(() => {
    selectedAreaRef.current = selectedArea;
  }, [selectedArea]);

  // Keep the coords ref updated
  useEffect(() => {
    clickedCoordsRef.current = clickedCoords;
  }, [clickedCoords]);

  // Effect to handle selected collection extents changes (multiple bboxes)
  useEffect(() => {
    if (map && selectedCollectionExtents && selectedExtentsRef.current !== selectedCollectionExtents) {
      // Clear previous bounding box rectangles
      if (vectorLayer) {
        vectorLayer.getSource()?.clear();
        
        // Calculate overall extent for zooming
        let minWest = Number.POSITIVE_INFINITY;
        let minSouth = Number.POSITIVE_INFINITY;
        let maxEast = Number.NEGATIVE_INFINITY;
        let maxNorth = Number.NEGATIVE_INFINITY;
        
        // Add each bbox as a separate rectangle feature
        selectedCollectionExtents.forEach((bbox, index) => {
          const [west, south, east, north] = bbox;
          
          // Update overall extent
          minWest = Math.min(minWest, west);
          minSouth = Math.min(minSouth, south);
          maxEast = Math.max(maxEast, east);
          maxNorth = Math.max(maxNorth, north);
          
          // Create polygon for this bounding box
          const coordinates = [
            [
              fromLonLat([west, south]),
              fromLonLat([east, south]),
              fromLonLat([east, north]),
              fromLonLat([west, north]),
              fromLonLat([west, south])
            ]
          ];
          
          const polygon = new Polygon(coordinates);
          const feature = new Feature({
            geometry: polygon,
            name: `Collection Extent ${index + 1}`,
            bboxIndex: index
          });
          
          // Add the feature to the vector layer
          vectorLayer.getSource()?.addFeature(feature);
        });
        
        // Zoom to the overall extent that encompasses all bboxes
        if (isFinite(minWest) && isFinite(minSouth) && isFinite(maxEast) && isFinite(maxNorth)) {
          // Additional validation: check if the extent is not empty (has area)
          const hasValidArea = minWest !== maxEast && minSouth !== maxNorth;
          
          if (!hasValidArea) {
            console.warn('Extent has no area (point or line), skipping zoom');
          } else {
            const overallExtent = [
              ...fromLonLat([minWest, minSouth]),
              ...fromLonLat([maxEast, maxNorth])
            ];
            
            // Validate that the transformed extent is also valid
            const isValidExtent = overallExtent.every(coord => isFinite(coord)) &&
                                  overallExtent[0] !== overallExtent[2] && 
                                  overallExtent[1] !== overallExtent[3];
            
            if (!isValidExtent) {
              console.warn('Transformed extent is invalid, skipping zoom');
            } else {
              // Check if this is a global bbox (-180, -90, 180, 90)
              const isGlobalBbox = minWest <= -179 && minSouth <= -89 && maxEast >= 179 && maxNorth >= 89;
              
              if (isGlobalBbox) {
                // For global bbox, just set a reasonable zoom level instead of fitting to full extent
                map.getView().setCenter([0, 0]);
                map.getView().setZoom(2);
              } else {
                try {
                  map.getView().fit(overallExtent, { 
                    padding: [50, 50, 50, 50],
                    duration: 1000 // Smooth animation
                  });
                } catch (error) {
                  console.error('Error fitting extent to map view:', error, overallExtent);
                }
              }
            }
          }
        } else {
          console.warn('Invalid extent - coordinates are not finite, not zooming');
        }
      }
      
      selectedExtentsRef.current = selectedCollectionExtents;
    } else if (map && selectedCollectionExtents === null && vectorLayer) {
      // Clear the bounding box rectangles when no collection is selected
      vectorLayer.getSource()?.clear();
      selectedExtentsRef.current = null;
    }
  }, [map, selectedCollectionExtents, vectorLayer]);

  // Effect to handle location features (GeoJSON)
  useEffect(() => {
    if (map && locationLayer && locationFeatures !== locationFeaturesRef.current) {
      // Clear previous location features
      locationLayer.getSource()?.clear();
      
      if (locationFeatures && locationFeatures.length > 0) {
        // Create GeoJSON format for parsing
        const geojsonFormat = new GeoJSON({
          featureProjection: 'EPSG:3857', // Map projection
          dataProjection: 'EPSG:4326' // GeoJSON is typically in WGS84
        });
        
        // Add each feature to the location layer
        locationFeatures.forEach((feature, index) => {
          try {
            // Parse the GeoJSON feature
            const olFeatures = geojsonFormat.readFeatures(feature);
            
            // Handle both single feature and feature array
            const featuresArray = Array.isArray(olFeatures) ? olFeatures : [olFeatures];
            
            featuresArray.forEach((olFeature, subIndex) => {
              olFeature.set('featureIndex', index);
              olFeature.set('subIndex', subIndex);
              olFeature.set('layer', 'location');
              olFeature.set('name', feature.properties?.name || `Location ${index + 1}-${subIndex + 1}`);
              olFeature.set('originalFeature', feature); // Store reference to original GeoJSON feature
              olFeature.set('featureId', feature.id); // Store feature ID for comparison
              
              // Add to location layer
              locationLayer.getSource()?.addFeature(olFeature);
            });
          } catch (error) {
            console.warn(`Failed to parse location feature ${index}:`, error, feature);
          }
        });
        
        // Only zoom to location features if there's no bbox extent being displayed
        // This prevents the location zoom from overriding the bbox zoom
        if (!selectedCollectionExtents || selectedCollectionExtents.length === 0) {
          const extent = locationLayer.getSource()?.getExtent();
          if (extent && extent.every(coord => isFinite(coord))) {
            // Additional validation: check if the extent is not empty (has area)
            const hasValidArea = extent[0] !== extent[2] && extent[1] !== extent[3];
            
            if (!hasValidArea) {
              console.warn('Location extent has no area (point), using center with zoom instead of fit');
              // For point features, center on the point with a reasonable zoom level
              const centerX = (extent[0] + extent[2]) / 2;
              const centerY = (extent[1] + extent[3]) / 2;
              map.getView().setCenter([centerX, centerY]);
              map.getView().setZoom(10);
            } else {
              try {
                map.getView().fit(extent, { 
                  padding: [50, 50, 50, 50],
                  duration: 1000,
                  maxZoom: 10 // Don't zoom in too much for point features
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
      // Clear location features when null
      locationLayer.getSource()?.clear();
      locationFeaturesRef.current = null;
    }
  }, [map, locationLayer, locationFeatures, selectedCollectionExtents]);

  // Effect to refresh location layer styles when selected feature changes
  useEffect(() => {
    if (locationLayer) {
      // Force the layer to re-render with updated styles
      locationLayer.changed();
    }
  }, [selectedFeature, locationLayer]);

  // Effect to manage GeoJSON layers based on geoJsonLayers prop
  useEffect(() => {
    if (!map) return;

    // Check if geoJsonLayers has actually changed
    const layersChanged = JSON.stringify(geoJsonLayers) !== JSON.stringify(geoJsonLayersRef.current);
    if (!layersChanged) return;
    
    geoJsonLayersRef.current = geoJsonLayers;

    const newLayers: {[key: string]: VectorLayer<VectorSource>} = {};
    const currentLayerKeys = new Set(Object.keys(geoJsonVectorLayers));
    const newLayerKeys = new Set<string>();

    // Create or update layers for visible GeoJSON layers
    geoJsonLayers.forEach((layerConfig) => {
      const layerKey = layerConfig.url;
      newLayerKeys.add(layerKey);

      if (layerConfig.visible) {
        // Check if layer already exists and if labelProperty has changed
        const existingLayer = geoJsonVectorLayers[layerKey];
        const needsStyleUpdate = existingLayer && 
          existingLayer.get('labelProperty') !== layerConfig.labelProperty;
        
        if (existingLayer && !needsStyleUpdate) {
          // Reuse existing layer without changes
          newLayers[layerKey] = existingLayer;
        } else if (existingLayer && needsStyleUpdate) {
          // Update style function for existing layer
          existingLayer.setStyle((feature) => {
            const labelProperty = layerConfig.labelProperty;
            const properties = feature.getProperties();
            let labelText = '';
            
            if (labelProperty && properties[labelProperty] !== undefined && properties[labelProperty] !== null) {
              labelText = String(properties[labelProperty]);
            }
            
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
                  color: '#6BFB66', // Green
                }),
                stroke: new Stroke({
                  color: '#424242', // Darker gray halo
                  width: 1,
                }),
                font: 'bold 12px sans-serif',
              }) : undefined,
            });
          });
          
          // Store the labelProperty on the layer for comparison
          existingLayer.set('labelProperty', layerConfig.labelProperty);
          
          // Force layer to redraw with new style
          existingLayer.changed();
          
          newLayers[layerKey] = existingLayer;
        } else {
          // Create new layer with bbox strategy
          const geojsonFormat = new GeoJSON({
            dataProjection: 'EPSG:4326',
            featureProjection: 'EPSG:3857',
          });

          const vectorSource = new VectorSource({
            format: geojsonFormat,
            strategy: bboxStrategy
          });

          // Mark all features from this source as GeoJSON layer features
          // IMPORTANT: Attach event listener BEFORE adding features
          vectorSource.on('addfeature', (event) => {
            if (event.feature) {
              event.feature.set('layer', 'geojson');
              event.feature.set('layerTitle', layerConfig.title);
              event.feature.set('layerUrl', layerConfig.url);
            }
          });

          // If data is pre-fetched, use it directly instead of loading from URL
          if (layerConfig.data) {
            try {
              // Capture metadata from the response
              if (layerConfig.data.numberReturned !== undefined || layerConfig.data.numberMatched !== undefined) {
                setGeoJsonMetadata(prev => ({
                  ...prev,
                  [layerKey]: {
                    numberReturned: layerConfig.data.numberReturned,
                    numberMatched: layerConfig.data.numberMatched
                  }
                }));
              }
              
              // Parse features using GeoJSON format
              const features = geojsonFormat.readFeatures(layerConfig.data, {
                featureProjection: 'EPSG:3857'
              });
              
              vectorSource.addFeatures(features);
            } catch (error) {
              console.error('Error parsing pre-fetched GeoJSON:', error);
            }
          } else {
            // Use custom loader with bbox strategy for layers without pre-fetched data
            // The bbox strategy will automatically call this loader with the current extent
            const loader = function(extent: any, _resolution: any, projection: any) {
              const [minX, minY, maxX, maxY] = extent;
              // Transform extent from map projection (EPSG:3857) to WGS84 (EPSG:4326)
              const [minLon, minLat] = toLonLat([minX, minY]);
              const [maxLon, maxLat] = toLonLat([maxX, maxY]);
              const bboxString = `${minLon},${minLat},${maxLon},${maxLat}`;
              
              // Start building URL with bbox parameter
              const separator = layerConfig.url.includes('?') ? '&' : '?';
              let finalUrl = `${layerConfig.url}${separator}bbox=${bboxString}`;
              
              // Add API key if provided
              if (layerConfig.apiKey) {
                const paramName = layerConfig.apiKeyParam || 'api-key';
                finalUrl = `${finalUrl}&${paramName}=${layerConfig.apiKey}`;
              }
              
              console.log('Loading GeoJSON with bbox:', finalUrl);
              
              fetch(finalUrl)
                .then(response => response.json())
                .then(data => {
                  // Capture metadata from the response
                  if (data.numberReturned !== undefined || data.numberMatched !== undefined) {
                    setGeoJsonMetadata(prev => ({
                      ...prev,
                      [layerKey]: {
                        numberReturned: data.numberReturned,
                        numberMatched: data.numberMatched
                      }
                    }));
                  }
                  
                  // Parse and add features
                  const features = geojsonFormat.readFeatures(data, {
                    featureProjection: projection
                  });
                  
                  // Add features to the source - bboxStrategy will handle deduplication
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
                    color: '#6BFB66', // Green
                  }),
                  stroke: new Stroke({
                    color: '#424242', // Darker gray halo
                    width: 1,
                  }),
                  font: 'bold 12px sans-serif',
                }) : undefined,
              });
            },
          });

          // Store the labelProperty on the layer for future comparison
          geoJsonLayer.set('labelProperty', layerConfig.labelProperty);

          // Add layer to map
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

    // Update state with new layers
    setGeoJsonVectorLayers(newLayers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, geoJsonLayers]);

  useEffect(() => {
    if (map && boundingBoxRef.current !== boundingBox) {
      // Convert bounding box coordinates [west, south, east, north] to extent
      const [west, south, east, north] = boundingBox;
      
      // Validate coordinates
      if (isFinite(west) && isFinite(south) && isFinite(east) && isFinite(north)) {
        // Check if the extent has valid area
        const hasValidArea = west !== east && south !== north;
        
        if (!hasValidArea) {
          console.warn('Bounding box has no area, skipping fit');
        } else {
          const extent = [
            ...fromLonLat([west, south]),
            ...fromLonLat([east, north])
          ];
          
          // Additional check for transformed extent
          if (extent.every(coord => isFinite(coord)) && extent[0] !== extent[2] && extent[1] !== extent[3]) {
            try {
              map.getView().fit(extent, { padding: [10, 10, 10, 10] });
            } catch (error) {
              console.error('Error fitting bounding box to map view:', error, extent);
            }
          } else {
            console.warn('Transformed bounding box extent is invalid, skipping fit');
          }
        }
      } else {
        console.warn('Invalid bounding box coordinates:', { west, south, east, north });
      }
      
      boundingBoxRef.current = boundingBox;
    }
  }, [map, boundingBox]);

  useEffect(() => {
    // Create vector source and layer for bounding box rectangles
    const vectorSource = new VectorSource();
    const newVectorLayer = new VectorLayer({
      source: vectorSource,
      style: new Style({
        stroke: new Stroke({
          color: '#ff0000',
          width: 3,
        }),
        fill: new Fill({
          color: 'rgba(255, 0, 0, 0.2)',
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
        zoom: false, // Disable zoom control buttons
      }),
      layers: [
        new TileLayer({
          source: new XYZ({
            url: 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            attributions: '© <a href="https://carto.com/attributions">CARTO</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          }),
        }),
        newVectorLayer, // Add vector layer for bounding boxes
        newLocationLayer, // Add vector layer for location features
        newMarkerLayer, // Add marker layer for position clicks
        newAreaLayer, // Add area layer for area selection
        newRadiusLayer, // Add radius layer for radius query circles
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
        
        if (geoJsonFeature && onGeoJsonFeatureSelect) {
          onGeoJsonFeatureSelect(geoJsonFeature);
          return; // Don't check for location features if GeoJSON feature was clicked
        }
        
        // Look for location features (features from the location layer)
        const locationFeature = features.find(feature => {
          const layer = feature.get('layer');
          return layer === 'location' || feature.get('featureIndex') !== undefined;
        });
        
        if (locationFeature) {
          // Get the original GeoJSON feature data
          const featureIndex = locationFeature.get('featureIndex');
          const originalFeature = locationFeaturesRef.current?.[featureIndex];
          
          if (originalFeature) {
            onFeatureSelectRef.current?.(originalFeature);
          }
        } else {
          // Clicked somewhere else, clear selections
          onFeatureSelectRef.current?.(null);
          if (onGeoJsonFeatureSelect) {
            onGeoJsonFeatureSelect(null);
          }
        }
      } else {
        // No features at click point, clear selections
        onFeatureSelectRef.current?.(null);
        if (onGeoJsonFeatureSelect) {
          onGeoJsonFeatureSelect(null);
        }
      }
    });

    // Add pointer cursor when hovering over location features and GeoJSON features, and show tooltip
    openLayersMap.on('pointermove', (event) => {
      const features = openLayersMap.getFeaturesAtPixel(event.pixel);
      
      // Check for GeoJSON features first
      const geoJsonFeature = features && features.find(feature => {
        const layer = feature.get('layer');
        return layer === 'geojson';
      });
      
      if (geoJsonFeature && tooltip) {
        // Show tooltip with layer title and feature properties
        const layerTitle = geoJsonFeature.get('layerTitle') || 'GeoJSON Layer';
        const properties = geoJsonFeature.getProperties();
        const displayName = properties.name || properties.id || properties.title || 'Feature';
        
        if (tooltipRef.current) {
          tooltipRef.current.innerHTML = `${layerTitle}: ${displayName}`;
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
        // Show tooltip with feature name or ID
        const featureIndex = locationFeature.get('featureIndex');
        const originalFeature = locationFeaturesRef.current?.[featureIndex];
        
        if (originalFeature) {
          const name = originalFeature.properties?.name || originalFeature.id || 'Unknown Location';
          if (tooltipRef.current) {
            tooltipRef.current.innerHTML = name;
            tooltipRef.current.style.display = 'block';
          }
          tooltip.setPosition(event.coordinate);
        }
        
        openLayersMap.getTargetElement().style.cursor = 'pointer';
      } else {
        // Hide tooltip and reset cursor
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
  }, [zoomLevel, onGeoJsonFeatureSelect]); // Removed onFeatureSelect from dependencies to prevent map recreation

  // Effect to update marker/trajectory when clicked coordinates change (for position, radius, trajectory)
  useEffect(() => {
    if (markerLayer && dataQuery) {
      const source = markerLayer.getSource();
      if (source) {
        source.clear();
        if (dataQuery.toLowerCase() === 'position' && clickedCoords && clickedCoords.length > 0) {
          clickedCoords.forEach(coords => {
            const [lon, lat] = coords;
            const feature = new Feature({
              geometry: new Point(fromLonLat([lon, lat]))
            });
            source.addFeature(feature);
          });
        }
        if (dataQuery.toLowerCase() === 'trajectory' && clickedCoords && clickedCoords.length > 1) {
          const lineCoords = clickedCoords.map(([lon, lat]) => fromLonLat([lon, lat]));
          const lineFeature = new Feature({
            geometry: new LineString(lineCoords)
          });
          lineFeature.setStyle(new Style({
            stroke: new Stroke({
              color: '#00BFFF',
              width: 3
            })
          }));
          source.addFeature(lineFeature);
        }
      }
    }
  }, [clickedCoords, markerLayer, dataQuery]);

  // Effect to update radius circles when clicked coords or radius change
  useEffect(() => {
    if (radiusLayer && dataQuery && dataQuery.toLowerCase() === 'radius') {
      const source = radiusLayer.getSource();
      if (source) {
        source.clear();
        
        // Add geodesic circles for all clicked coordinates
        if (clickedCoords && clickedCoords.length > 0 && radiusKm) {
          clickedCoords.forEach(coords => {
            const [lon, lat] = coords;
            const center = fromLonLat([lon, lat]);
            
            // Create a geodesic circle
            // We need to calculate points on the circle using getDistance
            const pointsOnCircle = 64; // Number of points to approximate the circle
            const circleCoords: [number, number][] = [];
            
            for (let i = 0; i < pointsOnCircle; i++) {
              const angle = (i / pointsOnCircle) * 2 * Math.PI;
              
              // Calculate a point at the specified radius from center
              // We use a simple approximation: move radiusKm in the direction of angle
              // For more accuracy, we could use geodesic calculations
              const lonOffset = (radiusKm * 1000) / (111320 * Math.cos(lat * Math.PI / 180)) * Math.cos(angle);
              const latOffset = (radiusKm * 1000) / 110540 * Math.sin(angle);
              
              const pointLon = lon + lonOffset;
              const pointLat = lat + latOffset;
              const point = fromLonLat([pointLon, pointLat]);
              circleCoords.push(point as [number, number]);
            }
            
            // Close the circle
            circleCoords.push(circleCoords[0]);
            
            // Create polygon from circle coordinates
            const circlePolygon = new Polygon([circleCoords]);
            const circleFeature = new Feature({
              geometry: circlePolygon,
            });
            source.addFeature(circleFeature);
            
            // Also add a point marker at the center
            const centerFeature = new Feature({
              geometry: new Point(center),
            });
            source.addFeature(centerFeature);
          });
        }
      }
    } else if (radiusLayer && dataQuery && dataQuery.toLowerCase() !== 'radius') {
      // Clear radius layer when not in radius mode
      const source = radiusLayer.getSource();
      if (source) {
        source.clear();
      }
    }
  }, [clickedCoords, radiusLayer, radiusKm, dataQuery]);

  // Effect to handle map clicks for position and radius queries
  useEffect(() => {
    if (!map) return;

    const handleMapClick = (event: any) => {
      // Check if clicking on a GeoJSON feature - if so, don't add position marker
      const features = map.getFeaturesAtPixel(event.pixel);
      if (features && features.length > 0) {
        const hasGeoJsonFeature = features.some(feature => feature.get('layer') === 'geojson');
        if (hasGeoJsonFeature) {
          return; // Don't add position marker when clicking on GeoJSON features
        }
      }
      
      // Handle clicks for position, radius, and trajectory queries
      if (dataQuery && (dataQuery.toLowerCase() === 'position' || dataQuery.toLowerCase() === 'radius' || dataQuery.toLowerCase() === 'trajectory')) {
        const coords = map.getCoordinateFromPixel(event.pixel);
        const [x, y] = toLonLat(coords);
        const bbox = selectedCollection?.extent?.spatial?.bbox;
        if (bbox && Array.isArray(bbox) && bbox.length > 0) {
          let minLon: number, minLat: number, maxLon: number, maxLat: number;
          if (Array.isArray(bbox[0])) {
            [minLon, minLat, maxLon, maxLat] = bbox[0];
          } else {
            [minLon, minLat, maxLon, maxLat] = bbox as number[];
          }
          if (x >= minLon && x <= maxLon && y >= minLat && y <= maxLat) {
            // For all three query types, update clickedCoords
            if (onMapClick) {
              const currentCoords = clickedCoordsRef.current || [];
              const newCoords: [number, number][] = [...currentCoords, [x, y]];
              onMapClick(newCoords);
            }
          }
        }
      }
    };

    map.on('singleclick', handleMapClick);

    return () => {
      map.un('singleclick', handleMapClick);
    };
  }, [map, dataQuery, selectedCollection, onMapClick]);

  // Effect to handle area and trajectory selection with drawing tool
  useEffect(() => {
    if (!map) return;

    // Remove existing draw interaction if any
    if (drawInteraction) {
      map.removeInteraction(drawInteraction);
      setDrawInteraction(null);
    }

    // Area query: Polygon drawing
    if (dataQuery && dataQuery.toLowerCase() === 'area' && areaLayer) {
      const source = areaLayer.getSource();
      if (!source) return;

      const draw = new Draw({
        type: 'Polygon',
        condition: (event: any) => {
          const features = map.getFeaturesAtPixel(event.pixel);
          if (features && features.length > 0) {
            const hasGeoJsonFeature = features.some(feature => feature.get('layer') === 'geojson');
            if (hasGeoJsonFeature) {
              return false;
            }
          }
          return true;
        }
      });

      draw.on('drawend', (event: DrawEvent) => {
        const feature = event.feature;
        const geometry = feature.getGeometry() as Polygon;
        const coordinates = geometry.getCoordinates()[0];
        const lonLatCoords: [number, number][] = coordinates.map(coord => {
          const [lon, lat] = toLonLat(coord);
          return [lon, lat];
        });
        if (onAreaSelect) {
          const currentAreas = selectedAreaRef.current || [];
          const newAreas: [number, number][][] = [...currentAreas, lonLatCoords];
          onAreaSelect(newAreas);
        }
      });

      map.addInteraction(draw);
      setDrawInteraction(draw);

      return () => {
        map.removeInteraction(draw);
      };
    }

    // Trajectory query: LineString drawing
    if (dataQuery && dataQuery.toLowerCase() === 'trajectory' && markerLayer) {
      const source = markerLayer.getSource();
      if (!source) return;

      const draw = new Draw({
        type: 'LineString',
        condition: (event: any) => {
          const features = map.getFeaturesAtPixel(event.pixel);
          if (features && features.length > 0) {
            const hasGeoJsonFeature = features.some(feature => feature.get('layer') === 'geojson');
            if (hasGeoJsonFeature) {
              return false;
            }
          }
          return true;
        }
      });

      draw.on('drawend', (event: DrawEvent) => {
        const feature = event.feature;
        const geometry = feature.getGeometry() as LineString;
        const coordinates = geometry.getCoordinates();
        const lonLatCoords: [number, number][] = coordinates.map(coord => {
          const [lon, lat] = toLonLat(coord);
          return [lon, lat];
        });
        if (onMapClick) {
          onMapClick(lonLatCoords);
        }
      });

      map.addInteraction(draw);
      setDrawInteraction(draw);

      return () => {
        map.removeInteraction(draw);
      };
    }

    // Clear layers and state when not in area/trajectory mode
    if ((dataQuery && dataQuery.toLowerCase() !== 'area' && areaLayer) || (dataQuery && dataQuery.toLowerCase() !== 'trajectory' && markerLayer)) {
      if (areaLayer) {
        const source = areaLayer.getSource();
        if (source) source.clear();
        if (onAreaSelect) onAreaSelect([]);
      }
      if (markerLayer) {
        const source = markerLayer.getSource();
        if (source) source.clear();
        if (onMapClick) onMapClick([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, dataQuery, areaLayer, markerLayer]);

  // Effect to display selected areas
  useEffect(() => {
    if (areaLayer && selectedArea) {
      const source = areaLayer.getSource();
      if (source) {
        source.clear();
        
        // Add all polygons
        selectedArea.forEach(polygonCoords => {
          const coordinates = polygonCoords.map(coord => fromLonLat([coord[0], coord[1]]));
          const polygon = new Polygon([coordinates]);
          const feature = new Feature({ geometry: polygon });
          source.addFeature(feature);
        });
      }
    }
  }, [selectedArea, areaLayer]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div id="map" key="main-map" style={{ width: '100%', height: '100%' }} />

      {/* Trajectory controls outside map container (commented out for isolation) */}
      {/*
      {map && dataQuery && dataQuery.toLowerCase() === 'trajectory' && (
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1100, background: 'rgba(0,0,0,0.8)', padding: '10px', borderRadius: '8px', color: 'white' }}>
          <div style={{ marginBottom: '8px' }}>Click on the map to add trajectory points.</div>
          <button
            style={{ marginRight: '8px', padding: '6px 12px', borderRadius: '4px', border: 'none', background: '#00BFFF', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
            onClick={() => {
              if (onMapClick && trajectoryCoords.length > 1) {
                onMapClick(trajectoryCoords);
              }
            }}
            disabled={trajectoryCoords.length < 2}
          >
            Finish Trajectory
          </button>
          <button
            style={{ padding: '6px 12px', borderRadius: '4px', border: 'none', background: '#444', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
            onClick={() => setTrajectoryCoords([])}
          >
            Reset
          </button>
        </div>
      )}
      */}

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
        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 'normal',
            maxWidth: '350px',
            zIndex: 1000,
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.2)',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '16px' }}>
            {selectedCollection.title || selectedCollection.id}
          </div>
          {selectedCollection.description && (
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.9)', lineHeight: '1.3', marginBottom: '8px' }}>
              {selectedCollection.description}
            </div>
          )}
          
          {/* Temporal Coverage */}
          {selectedCollection.extent?.temporal && (() => {
            const normalizedTemporal = normalizeTemporal(selectedCollection.extent.temporal);
            if (normalizedTemporal && normalizedTemporal.intervals.length > 0) {
              const overallExtent = getOverallTemporalExtent(normalizedTemporal.intervals);
              if (overallExtent) {
                return (
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', marginBottom: '4px' }}>
                    <div style={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.9)' }}>Available:</div>
                    <div>{formatTemporalInterval(overallExtent[0], overallExtent[1])}</div>
                    {normalizedTemporal.intervals.length > 1 && (
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)' }}>
                        ({normalizedTemporal.intervals.length} intervals)
                      </div>
                    )}
                  </div>
                );
              }
            }
            return null;
          })()}

          {/* Vertical Coverage */}
          {selectedCollection.extent?.vertical && (() => {
            const normalizedVertical = normalizeVertical(selectedCollection.extent.vertical);
            if (normalizedVertical && normalizedVertical.intervals.length > 0) {
              const overallExtent = getOverallVerticalExtent(normalizedVertical.intervals);
              if (overallExtent) {
                const unit = getVerticalUnit(normalizedVertical.vrs);
                return (
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', marginBottom: '4px' }}>
                    <div style={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.9)' }}>Vertical Coverage:</div>
                    <div>{formatVerticalInterval(overallExtent[0], overallExtent[1], unit)}</div>
                    {normalizedVertical.intervals.length > 1 && (
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)' }}>
                        ({normalizedVertical.intervals.length} intervals)
                      </div>
                    )}
                  </div>
                );
              }
            }
            return null;
          })()}

          {/* License Information */}
          {(() => {
            // Find license link in collection links
            const licenseLink = selectedCollection.links?.find(link => link.rel === 'license');
            if (licenseLink && licenseLink.href) {
              const href = typeof licenseLink.href === 'string' ? licenseLink.href : Object.values(licenseLink.href)[0];
              
              // Check if it's a Creative Commons license
              if (href && href.includes('creativecommons.org/licenses/')) {
                try {
                  const url = new URL(href);
                  const pathParts = url.pathname.split('/').filter(p => p);
                  
                  // Expected format: /licenses/by-nc-nd/4.0/
                  if (pathParts.length >= 3 && pathParts[0] === 'licenses') {
                    const licenseType = pathParts[1].toUpperCase().replace(/-/g, '-');
                    const version = pathParts[2];
                    
                    return (
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', marginTop: '4px' }}>
                        <span style={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.9)' }}>License: </span>
                        CC {licenseType} {version}
                      </div>
                    );
                  }
                } catch (e) {
                  // Invalid URL, skip
                }
              }
            }
            return null;
          })()}

          {selectedCollection.id && selectedCollection.title && (
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>
              ID: {selectedCollection.id}
            </div>
          )}
        </div>
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
            <div>Click and drag to draw a trajectory (double-click to finish)</div>
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
              if (onMapClick) {
                onMapClick([]);
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
                if (onMapClick) {
                  onMapClick([]);
                }
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
              if (onAreaSelect) {
                onAreaSelect([]);
              }
              // Also clear the area layer
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
              if (onMapClick) {
                onMapClick([]);
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
                if (onRadiusChange) {
                  onRadiusChange(Number(e.target.value));
                }
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
      
      {/* Layer Manager */}
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '10px',
        zIndex: 1000,
        maxWidth: '400px',
      }}>
        <LayerManager
          layers={geoJsonLayers}
          onLayersChange={(updatedLayers) => {
            if (onGeoJsonLayerUpdate) {
              onGeoJsonLayerUpdate(updatedLayers);
            }
          }}
        />
      </div>
      
      <FeatureInfo 
        feature={selectedFeature} 
        onClose={() => onFeatureSelectRef.current?.(null)} 
      />
      
      <GeoJsonFeatureViewer
        feature={selectedGeoJsonFeature}
        onClose={() => onGeoJsonFeatureSelect?.(null)}
        metadata={selectedGeoJsonFeature?.get ? geoJsonMetadata[selectedGeoJsonFeature.get('layerUrl')] : undefined}
        selectedLabelProperty={selectedGeoJsonFeature?.get ? 
          geoJsonLayers.find(l => l.url === selectedGeoJsonFeature.get('layerUrl'))?.labelProperty : undefined}
        onSelectLabelProperty={(propertyName) => {
          if (selectedGeoJsonFeature?.get && onGeoJsonLayerUpdate) {
            const layerUrl = selectedGeoJsonFeature.get('layerUrl');
            const updatedLayers = geoJsonLayers.map(layer => 
              layer.url === layerUrl ? { ...layer, labelProperty: propertyName } : layer
            );
            onGeoJsonLayerUpdate(updatedLayers);
          }
        }}
      />
    </div>
  );
};

export default OpenLayersMap;
