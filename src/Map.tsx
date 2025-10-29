import React, { useState, useEffect, useRef } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import OSM from 'ol/source/OSM';
import { Feature } from 'ol';
import { Polygon } from 'ol/geom';
import { fromLonLat } from 'ol/proj';
import { Style, Stroke, Fill } from 'ol/style';

interface MapProps {
  zoomLevel: number;
  boundingBox: [number, number, number, number];
  selectedCollectionExtents?: [number, number, number, number][] | null;
  onUpdateBoundingBox?: (boundingBox: [number, number, number, number]) => void;
}

const OpenLayersMap: React.FC<MapProps> = ({ zoomLevel, boundingBox, selectedCollectionExtents, onUpdateBoundingBox }) => {
  const [map, setMap] = useState<Map | null>(null);
  const [vectorLayer, setVectorLayer] = useState<VectorLayer<VectorSource> | null>(null);
  const boundingBoxRef = useRef(boundingBox);
  const selectedExtentsRef = useRef(selectedCollectionExtents);

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
        if (isFinite(minWest)) {
          const overallExtent = [
            ...fromLonLat([minWest, minSouth]),
            ...fromLonLat([maxEast, maxNorth])
          ];
          
          map.getView().fit(overallExtent, { 
            padding: [50, 50, 50, 50],
            duration: 1000 // Smooth animation
          });
        }
      }
      
      selectedExtentsRef.current = selectedCollectionExtents;
    } else if (map && selectedCollectionExtents === null && vectorLayer) {
      // Clear the bounding box rectangles when no collection is selected
      vectorLayer.getSource()?.clear();
      selectedExtentsRef.current = null;
    }
  }, [map, selectedCollectionExtents, vectorLayer]);

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
          width: 2,
        }),
        fill: new Fill({
          color: 'rgba(255, 0, 0, 0.1)',
        }),
      }),
    });

    const openLayersMap = new Map({
      target: 'map',
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
        newVectorLayer, // Add vector layer for bounding boxes
      ],
      view: new View({
        center: [0, 0],
        zoom: zoomLevel,
      }),
    });

    setMap(openLayersMap);
    setVectorLayer(newVectorLayer);

    return () => {
      openLayersMap.setTarget(undefined);
    };
  }, [zoomLevel]);

  useEffect(() => {
    if (onUpdateBoundingBox) {
      onUpdateBoundingBox(boundingBoxRef.current);
    }
  }, [onUpdateBoundingBox]);

  return <div id="map" style={{ width: '100%', height: '100%' }} />;
};

export default OpenLayersMap;
