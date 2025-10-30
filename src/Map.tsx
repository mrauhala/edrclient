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
import { Polygon } from 'ol/geom';
import { fromLonLat } from 'ol/proj';
import { Style, Stroke, Fill, Circle } from 'ol/style';
import GeoJSON from 'ol/format/GeoJSON';
import FeatureInfo from './FeatureInfo';
import { Collection, normalizeTemporal, formatTemporalInterval, getOverallTemporalExtent, normalizeVertical, formatVerticalInterval, getOverallVerticalExtent, getVerticalUnit } from './DataRetrievalAPI';

interface MapProps {
  zoomLevel: number;
  boundingBox: [number, number, number, number];
  selectedCollectionExtents?: [number, number, number, number][] | null;
  selectedCollection?: Collection | null;
  locationFeatures?: any[] | null;
  selectedFeature?: any | null;
  onUpdateBoundingBox?: (boundingBox: [number, number, number, number]) => void;
  onFeatureSelect?: (feature: any | null) => void;
}

const OpenLayersMap: React.FC<MapProps> = ({ zoomLevel, boundingBox, selectedCollectionExtents, selectedCollection, locationFeatures, selectedFeature, onUpdateBoundingBox, onFeatureSelect }) => {
  const [map, setMap] = useState<Map | null>(null);
  const [vectorLayer, setVectorLayer] = useState<VectorLayer<VectorSource> | null>(null);
  const [locationLayer, setLocationLayer] = useState<VectorLayer<VectorSource> | null>(null);
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
        if (isFinite(minWest)) {
          const overallExtent = [
            ...fromLonLat([minWest, minSouth]),
            ...fromLonLat([maxEast, maxNorth])
          ];
          
          console.log('Zooming to overall extent:', overallExtent);
          console.log('Overall bbox:', { minWest, minSouth, maxEast, maxNorth });
          
          // Check if this is a global bbox (-180, -90, 180, 90)
          const isGlobalBbox = minWest <= -179 && minSouth <= -89 && maxEast >= 179 && maxNorth >= 89;
          
          if (isGlobalBbox) {
            console.log('Detected global bbox, setting moderate zoom level');
            // For global bbox, just set a reasonable zoom level instead of fitting to full extent
            map.getView().setCenter([0, 0]);
            map.getView().setZoom(2);
          } else {
            map.getView().fit(overallExtent, { 
              padding: [50, 50, 50, 50],
              duration: 1000 // Smooth animation
            });
          }
        } else {
          console.warn('Invalid extent - not zooming');
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
            map.getView().fit(extent, { 
              padding: [50, 50, 50, 50],
              duration: 1000,
              maxZoom: 10 // Don't zoom in too much for point features
            });
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

  useEffect(() => {
    if (map && boundingBoxRef.current !== boundingBox) {
      // Convert bounding box coordinates [west, south, east, north] to extent
      const [west, south, east, north] = boundingBox;
      const extent = [
        ...fromLonLat([west, south]),
        ...fromLonLat([east, north])
      ];
      map.getView().fit(extent, { padding: [10, 10, 10, 10] });
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

    const openLayersMap = new Map({
      target: 'map',
      layers: [
        new TileLayer({
          source: new XYZ({
            url: 'https://{a-c}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            attributions: '© <a href="https://carto.com/attributions">CARTO</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          }),
        }),
        newVectorLayer, // Add vector layer for bounding boxes
        newLocationLayer, // Add vector layer for location features
      ],
      view: new View({
        center: [0, 0],
        zoom: zoomLevel,
      }),
    });

    // Set canvas willReadFrequently attribute for better performance
    const canvas = openLayersMap.getViewport().querySelector('canvas');
    if (canvas) {
      (canvas as any).willReadFrequently = true;
    }

    setMap(openLayersMap);
    setVectorLayer(newVectorLayer);
    setLocationLayer(newLocationLayer);

    // Create tooltip overlay
    const tooltip = new Overlay({
      element: tooltipRef.current!,
      offset: [10, 0],
      positioning: 'bottom-left',
    });
    openLayersMap.addOverlay(tooltip);
    setTooltipOverlay(tooltip);

    // Add click interaction for location features
    openLayersMap.on('click', (event) => {
      const features = openLayersMap.getFeaturesAtPixel(event.pixel);
      if (features && features.length > 0) {
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
          // Clicked somewhere else, clear selection
          onFeatureSelectRef.current?.(null);
        }
      } else {
        // No features at click point, clear selection
        onFeatureSelectRef.current?.(null);
      }
    });

    // Add pointer cursor when hovering over location features and show tooltip
    openLayersMap.on('pointermove', (event) => {
      const features = openLayersMap.getFeaturesAtPixel(event.pixel);
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
  }, [zoomLevel]); // Removed onFeatureSelect from dependencies to prevent map recreation

  useEffect(() => {
    if (onUpdateBoundingBox) {
      onUpdateBoundingBox(boundingBoxRef.current);
    }
  }, [onUpdateBoundingBox]);

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
      
      <FeatureInfo 
        feature={selectedFeature} 
        onClose={() => onFeatureSelectRef.current?.(null)} 
      />
    </div>
  );
};

export default OpenLayersMap;
