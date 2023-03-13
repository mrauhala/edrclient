import React, { useState, useEffect, useRef } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat } from 'ol/proj';

interface MapProps {
  zoomLevel: number;
  boundingBox: [number, number, number, number];
  onUpdateBoundingBox?: (boundingBox: [number, number, number, number]) => void;
}

const OpenLayersMap: React.FC<MapProps> = ({ zoomLevel, boundingBox, onUpdateBoundingBox }) => {
  const [map, setMap] = useState<Map | null>(null);
  const boundingBoxRef = useRef(boundingBox);

  useEffect(() => {
    if (map && boundingBoxRef.current !== boundingBox) {
      map.getView().fit(fromLonLat(boundingBox), { padding: [10, 10, 10, 10] });
      boundingBoxRef.current = boundingBox;
    }
  }, [map, boundingBox]);

  useEffect(() => {
    const openLayersMap = new Map({
      target: 'map',
      layers: [
        new TileLayer({
          source: new OSM(),
        }),
      ],
      view: new View({
        center: [0, 0],
        zoom: zoomLevel,
      }),
    });

    setMap(openLayersMap);

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
