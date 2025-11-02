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
import { Polygon, Point } from 'ol/geom';
import { fromLonLat, toLonLat } from 'ol/proj';
import { Style, Stroke, Fill, Circle, Text } from 'ol/style';
import GeoJSON from 'ol/format/GeoJSON';
import { defaults as defaultControls } from 'ol/control';
import { bbox as bboxStrategy } from 'ol/loadingstrategy';
import Draw from 'ol/interaction/Draw';
import { DrawEvent } from 'ol/interaction/Draw';
import FeatureInfo from './FeatureInfo';
import GeoJsonFeatureViewer from './GeoJsonFeatureViewer';
import { Collection, normalizeTemporal, formatTemporalInterval, getOverallTemporalExtent, normalizeVertical, formatVerticalInterval, getOverallVerticalExtent, getVerticalUnit } from './DataRetrievalAPI';

interface MapProps {
  zoomLevel: number;
  boundingBox: [number, number, number, number];
  selectedCollectionExtents?: [number, number, number, number][] | null;
  selectedCollection?: Collection | null;
  locationFeatures?: any[] | null;
  selectedFeature?: any | null;
  clickedCoords?: [number, number] | null;
  selectedArea?: [number, number][] | null;
  dataQuery?: string;
  onUpdateBoundingBox?: (boundingBox: [number, number, number, number]) => void;
  onFeatureSelect?: (feature: any | null) => void;
  onMapClick?: (coords: [number, number] | null) => void;
  onAreaSelect?: (area: [number, number][] | null) => void;
  geoJsonLayers?: {url: string, title: string, visible: boolean, labelProperty?: string}[];
  selectedGeoJsonFeature?: any | null;
  onGeoJsonFeatureSelect?: (feature: any | null) => void;
  onGeoJsonLayerUpdate?: (layers: {url: string, title: string, visible: boolean, labelProperty?: string}[]) => void;
}

const OpenLayersMap: React.FC<MapProps> = ({ zoomLevel, boundingBox, selectedCollectionExtents, selectedCollection, locationFeatures, selectedFeature, clickedCoords, selectedArea, dataQuery, onUpdateBoundingBox, onFeatureSelect, onMapClick, onAreaSelect, geoJsonLayers = [], selectedGeoJsonFeature, onGeoJsonFeatureSelect, onGeoJsonLayerUpdate }) => {
  const [map, setMap] = useState<Map | null>(null);
  const [vectorLayer, setVectorLayer] = useState<VectorLayer<VectorSource> | null>(null);
  const [locationLayer, setLocationLayer] = useState<VectorLayer<VectorSource> | null>(null);
  const [markerLayer, setMarkerLayer] = useState<VectorLayer<VectorSource> | null>(null);
  const [areaLayer, setAreaLayer] = useState<VectorLayer<VectorSource> | null>(null);
  const [drawInteraction, setDrawInteraction] = useState<Draw | null>(null);
  const [geoJsonVectorLayers, setGeoJsonVectorLayers] = useState<{[key: string]: VectorLayer<VectorSource>}>({});
  const [geoJsonMetadata, setGeoJsonMetadata] = useState<{[key: string]: {numberReturned?: number, numberMatched?: number}}>({});
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [tooltipOverlay, setTooltipOverlay] = useState<Overlay | null>(null);
  const boundingBoxRef = useRef(boundingBox);
  const selectedExtentsRef = useRef(selectedCollectionExtents);
  const locationFeaturesRef = useRef(locationFeatures);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const onFeatureSelectRef = useRef(onFeatureSelect);

  // Keep the callback ref updated
  useEffect(() => {
    onFeatureSelectRef.current = onFeatureSelect;
  }, [onFeatureSelect]);

  // Effect to handle selected collection extents changes (multiple bboxes)
  useEffect(() => {
    if (map && selectedCollectionExtents && selectedExtentsRef.current !== selectedCollectionExtents) {
      console.log('Processing selectedCollectionExtents:', selectedCollectionExtents);
      
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
          console.log(`Processing bbox ${index}:`, { west, south, east, north });
          
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
          
          console.log('Creating polygon with coordinates:', coordinates);
          
          const polygon = new Polygon(coordinates);
          const feature = new Feature({
            geometry: polygon,
            name: `Collection Extent ${index + 1}`,
            bboxIndex: index
          });
          
          console.log('Adding feature to vector layer:', feature);
          
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
            
            console.log('Zooming to overall extent:', overallExtent);
            console.log('Overall bbox:', { minWest, minSouth, maxEast, maxNorth });
            
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
                console.log('Detected global bbox, setting moderate zoom level');
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
        console.log(`Adding ${locationFeatures.length} location features to map`);
        
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

  // Effect to manage GeoJSON layers based on geoJsonLayers prop
  useEffect(() => {
    if (!map) return;

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
            url: function (extent) {
              const [minX, minY, maxX, maxY] = extent;
              // Transform extent from map projection (EPSG:3857) to WGS84 (EPSG:4326)
              const [minLon, minLat] = toLonLat([minX, minY]);
              const [maxLon, maxLat] = toLonLat([maxX, maxY]);
              const bboxString = `${minLon},${minLat},${maxLon},${maxLat}`;
              
              // Append bbox parameter to URL
              const separator = layerConfig.url.includes('?') ? '&' : '?';
              return `${layerConfig.url}${separator}bbox=${bboxString}`;
            },
            strategy: bboxStrategy,
            format: geojsonFormat,
            loader: function(extent, resolution, projection, success, failure) {
              const [minX, minY, maxX, maxY] = extent;
              const [minLon, minLat] = toLonLat([minX, minY]);
              const [maxLon, maxLat] = toLonLat([maxX, maxY]);
              const bboxString = `${minLon},${minLat},${maxLon},${maxLat}`;
              const separator = layerConfig.url.includes('?') ? '&' : '?';
              const url = `${layerConfig.url}${separator}bbox=${bboxString}`;

              fetch(url)
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
                  
                  // Parse features using GeoJSON format
                  const features = geojsonFormat.readFeatures(data, {
                    featureProjection: projection
                  });
                  
                  vectorSource.addFeatures(features);
                  if (success) success(features);
                })
                .catch(error => {
                  console.error('Error loading GeoJSON:', error);
                  if (failure) failure();
                });
            }
          });

          // Mark all features from this source as GeoJSON layer features
          vectorSource.on('addfeature', (event) => {
            if (event.feature) {
              event.feature.set('layer', 'geojson');
              event.feature.set('layerTitle', layerConfig.title);
              event.feature.set('layerUrl', layerConfig.url);
            }
          });

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
  }, [map, geoJsonLayers, geoJsonVectorLayers]);

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
        
        if (geometryType === 'Point') {
          return new Style({
            image: new Circle({
              radius: 8,
              fill: new Fill({
                color: '#2196F3',
              }),
              stroke: new Stroke({
                color: '#ffffff',
                width: 3,
              }),
            }),
          });
        } else if (geometryType === 'LineString' || geometryType === 'MultiLineString') {
          return new Style({
            stroke: new Stroke({
              color: '#2196F3',
              width: 4,
            }),
          });
        } else if (geometryType === 'Polygon' || geometryType === 'MultiPolygon') {
          return new Style({
            stroke: new Stroke({
              color: '#2196F3',
              width: 3,
            }),
            fill: new Fill({
              color: 'rgba(33, 150, 243, 0.3)',
            }),
          });
        }
        
        // Default style
        return new Style({
          stroke: new Stroke({
            color: '#2196F3',
            width: 2,
          }),
          fill: new Fill({
            color: 'rgba(33, 150, 243, 0.2)',
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

    // Create tooltip overlay
    const tooltip = new Overlay({
      element: tooltipRef.current!,
      offset: [10, 0],
      positioning: 'bottom-left',
    });
    openLayersMap.addOverlay(tooltip);
    setTooltipOverlay(tooltip);

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
          console.log('Selected GeoJSON feature:', geoJsonFeature);
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
            console.log('Selected location feature:', originalFeature);
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

  useEffect(() => {
    if (onUpdateBoundingBox) {
      onUpdateBoundingBox(boundingBoxRef.current);
    }
  }, [onUpdateBoundingBox]);

  // Effect to update marker when clicked coordinates change
  useEffect(() => {
    if (markerLayer) {
      const source = markerLayer.getSource();
      if (source) {
        source.clear();
        
        if (clickedCoords) {
          const [lon, lat] = clickedCoords;
          const feature = new Feature({
            geometry: new Point(fromLonLat([lon, lat])),
          });
          source.addFeature(feature);
        }
      }
    }
  }, [clickedCoords, markerLayer]);

  // Effect to handle map clicks for position queries
  useEffect(() => {
    if (!map) return;

    const handleMapClick = (event: any) => {
      // Only handle clicks if data query is 'position'
      if (dataQuery && dataQuery.toLowerCase() === 'position') {
        // Check if click is within collection bbox
        const coords = map.getCoordinateFromPixel(event.pixel);
        const [x, y] = toLonLat(coords);
        
        // Get collection bbox
        const bbox = selectedCollection?.extent?.spatial?.bbox;
        
        if (bbox && Array.isArray(bbox) && bbox.length > 0) {
          // bbox can be either a flat array [minLon, minLat, maxLon, maxLat] 
          // or an array of arrays [[minLon, minLat, maxLon, maxLat]]
          let minLon: number, minLat: number, maxLon: number, maxLat: number;
          
          if (Array.isArray(bbox[0])) {
            // Array of arrays format (EDR standard)
            [minLon, minLat, maxLon, maxLat] = bbox[0];
          } else {
            // Flat array format (non-standard but some services use it)
            [minLon, minLat, maxLon, maxLat] = bbox as number[];
          }
          
          // Check if click is within bbox
          if (x >= minLon && x <= maxLon && y >= minLat && y <= maxLat) {
            // Pass coordinates back to parent
            if (onMapClick) {
              onMapClick([x, y]);
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

  // Effect to handle area selection with drawing tool
  useEffect(() => {
    if (!map || !areaLayer) return;

    // Remove existing draw interaction if any
    if (drawInteraction) {
      map.removeInteraction(drawInteraction);
      setDrawInteraction(null);
    }

    // Only add draw interaction if data query is 'area'
    if (dataQuery && dataQuery.toLowerCase() === 'area') {
      const source = areaLayer.getSource();
      if (!source) return;

      // Clear previous area selection
      source.clear();

      // Create new draw interaction
      const draw = new Draw({
        source: source,
        type: 'Polygon',
      });

      // Handle draw completion
      draw.on('drawend', (event: DrawEvent) => {
        const feature = event.feature;
        const geometry = feature.getGeometry() as Polygon;
        
        // Get the coordinates in EPSG:3857 and convert to WGS84
        const coordinates = geometry.getCoordinates()[0]; // Get outer ring
        const lonLatCoords: [number, number][] = coordinates.map(coord => {
          const [lon, lat] = toLonLat(coord);
          return [lon, lat];
        });

        // Pass coordinates back to parent
        if (onAreaSelect) {
          onAreaSelect(lonLatCoords);
        }

        // Clear previous drawings (keep only the latest)
        setTimeout(() => {
          source.clear();
          source.addFeature(feature);
        }, 0);
      });

      map.addInteraction(draw);
      setDrawInteraction(draw);

      return () => {
        map.removeInteraction(draw);
      };
    } else {
      // Clear area layer when not in area mode
      const source = areaLayer.getSource();
      if (source) {
        source.clear();
      }
      // Clear selected area
      if (onAreaSelect) {
        onAreaSelect(null);
      }
    }
  }, [map, dataQuery, areaLayer, onAreaSelect]);

  // Effect to display selected area
  useEffect(() => {
    if (areaLayer && selectedArea) {
      const source = areaLayer.getSource();
      if (source) {
        source.clear();
        
        // Convert coordinates back to map projection and create polygon
        const coordinates = selectedArea.map(coord => fromLonLat([coord[0], coord[1]]));
        const polygon = new Polygon([coordinates]);
        const feature = new Feature({ geometry: polygon });
        source.addFeature(feature);
      }
    }
  }, [selectedArea, areaLayer]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div id="map" style={{ width: '100%', height: '100%' }} />
      
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
                    <div style={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.9)' }}>Time Coverage:</div>
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

          {selectedCollection.id && selectedCollection.title && (
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '4px' }}>
              ID: {selectedCollection.id}
            </div>
          )}
        </div>
      )}
      
      {/* Coordinates Legend - Lower Right Corner */}
      {clickedCoords && (
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
            Selected Coordinates
          </div>
          <div>Lat: {clickedCoords[1].toFixed(6)}°</div>
          <div>Lon: {clickedCoords[0].toFixed(6)}°</div>
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
            Selected Area
          </div>
          <div>{selectedArea.length} vertices</div>
        </div>
      )}

      {/* Drawing Instruction - Top Center */}
      {dataQuery && dataQuery.toLowerCase() === 'area' && !selectedArea && (
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
            Draw Area on Map
          </div>
          <div>Click to add vertices, double-click to complete</div>
        </div>
      )}
      
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
