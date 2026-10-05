import { useState, useEffect, useRef, useCallback } from 'react';
import Map from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Feature } from 'ol';
import { Polygon, Point, LineString } from 'ol/geom';
import { fromLonLat, toLonLat } from 'ol/proj';
import { Style, Stroke } from 'ol/style';
import Draw from 'ol/interaction/Draw';
import { DrawEvent } from 'ol/interaction/Draw';
import { useMapInteraction } from '../contexts/MapInteractionContext';
import { useCollection } from '../contexts/CollectionContext';
import { geometryKindOf } from '../query/queryTypes';

export function useMapInteractions(
  map: Map | null,
  markerLayer: VectorLayer<VectorSource> | null,
  areaLayer: VectorLayer<VectorSource> | null,
  radiusLayer: VectorLayer<VectorSource> | null,
): { abortDrawing: () => void; isDrawing: boolean } {
  const { clickedCoords, setClickedCoords, selectedArea, setSelectedArea, radiusKm, dataQuery } = useMapInteraction();
  // dataQuery is the query type; the geometry kind decides what the map collects
  const geometryKind = geometryKindOf(dataQuery);
  const { selectedCollection, selectedFeature } = useCollection();
  const [drawInteraction, setDrawInteraction] = useState<Draw | null>(null);
  // True while an area/trajectory sketch is in progress (between drawstart and drawend/abort).
  const [isDrawing, setIsDrawing] = useState(false);
  // Imperative handle to the active Draw so the Clear buttons can abort an in-progress sketch.
  const drawInteractionRef = useRef<Draw | null>(null);
  const selectedAreaRef = useRef(selectedArea);
  const clickedCoordsRef = useRef(clickedCoords);

  // Keep refs in sync
  useEffect(() => { selectedAreaRef.current = selectedArea; }, [selectedArea]);
  useEffect(() => { clickedCoordsRef.current = clickedCoords; }, [clickedCoords]);

  // Zoom to feature when a location feature is selected
  useEffect(() => {
    if (!map || !selectedFeature?.geometry?.coordinates) return;
    const coords = selectedFeature.geometry.coordinates;
    if (selectedFeature.geometry.type === 'Point') {
      const [lon, lat] = coords;
      const margin = 0.5;
      const bbox: [number, number, number, number] = [lon - margin, lat - margin, lon + margin, lat + margin];
      const [west, south, east, north] = bbox;
      if (isFinite(west) && isFinite(south) && isFinite(east) && isFinite(north) && west !== east && south !== north) {
        const extent = [...fromLonLat([west, south]), ...fromLonLat([east, north])];
        if (extent.every(coord => isFinite(coord)) && extent[0] !== extent[2] && extent[1] !== extent[3]) {
          try {
            map.getView().fit(extent, { padding: [10, 10, 10, 10] });
          } catch (error) {
            console.error('Error fitting to feature:', error);
          }
        }
      }
    }
  }, [map, selectedFeature]);

  // Draw the clicked points (position) or the line (trajectory, corridor) from state
  useEffect(() => {
    if (markerLayer) {
      const source = markerLayer.getSource();
      if (source) {
        source.clear();
        if (dataQuery === 'position' && clickedCoords && clickedCoords.length > 0) {
          clickedCoords.forEach(coords => {
            const [lon, lat] = coords;
            const feature = new Feature({
              geometry: new Point(fromLonLat([lon, lat]))
            });
            source.addFeature(feature);
          });
        }
        if (geometryKind === 'line' && clickedCoords && clickedCoords.length > 1) {
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
  }, [clickedCoords, markerLayer, dataQuery, geometryKind]);

  // Update radius circles when clicked coords or radius change
  useEffect(() => {
    if (radiusLayer && dataQuery === 'radius') {
      const source = radiusLayer.getSource();
      if (source) {
        source.clear();

        if (clickedCoords && clickedCoords.length > 0 && radiusKm) {
          clickedCoords.forEach(coords => {
            const [lon, lat] = coords;
            const center = fromLonLat([lon, lat]);

            const pointsOnCircle = 64;
            const circleCoords: [number, number][] = [];

            for (let i = 0; i < pointsOnCircle; i++) {
              const angle = (i / pointsOnCircle) * 2 * Math.PI;
              const lonOffset = (radiusKm * 1000) / (111320 * Math.cos(lat * Math.PI / 180)) * Math.cos(angle);
              const latOffset = (radiusKm * 1000) / 110540 * Math.sin(angle);

              const pointLon = lon + lonOffset;
              const pointLat = lat + latOffset;
              const point = fromLonLat([pointLon, pointLat]);
              circleCoords.push(point as [number, number]);
            }

            circleCoords.push(circleCoords[0]);

            const circlePolygon = new Polygon([circleCoords]);
            const circleFeature = new Feature({
              geometry: circlePolygon,
            });
            source.addFeature(circleFeature);

            const centerFeature = new Feature({
              geometry: new Point(center),
            });
            source.addFeature(centerFeature);
          });
        }
      }
    } else if (radiusLayer) {
      const source = radiusLayer.getSource();
      if (source) {
        source.clear();
      }
    }
  }, [clickedCoords, radiusLayer, radiusKm, dataQuery]);

  // Handle map clicks for point queries (position, radius)
  useEffect(() => {
    if (!map) return;

    const handleMapClick = (event: any) => {
      const features = map.getFeaturesAtPixel(event.pixel);
      if (features && features.length > 0) {
        const hasGeoJsonFeature = features.some(feature => feature.get('layer') === 'geojson');
        if (hasGeoJsonFeature) {
          return;
        }
      }

      // Lines are intentionally excluded: for trajectory and corridor the Draw('LineString')
      // interaction below is the sole capturer of clickedCoords (mirroring how area's
      // polygon Draw owns selectedArea). Letting this handler also append here caused a
      // ghost line and premature queries from unfinished lines.
      if (geometryKind === 'points') {
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
            const currentCoords = clickedCoordsRef.current || [];
            const newCoords: [number, number][] = [...currentCoords, [x, y]];
            setClickedCoords(newCoords);
          }
        }
      }
    };

    map.on('singleclick', handleMapClick);

    return () => {
      map.un('singleclick', handleMapClick);
    };
  }, [map, geometryKind, selectedCollection, setClickedCoords]);

  // Draw areas (polygon) and lines (trajectory, corridor)
  useEffect(() => {
    if (!map) return;

    if (drawInteraction) {
      map.removeInteraction(drawInteraction);
      setDrawInteraction(null);
    }

    // Area query: Polygon drawing
    if (geometryKind === 'polygon' && areaLayer) {
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
        const currentAreas = selectedAreaRef.current || [];
        const newAreas: [number, number][][] = [...currentAreas, lonLatCoords];
        setSelectedArea(newAreas);
      });

      draw.on('drawstart', () => setIsDrawing(true));
      draw.on('drawend', () => setIsDrawing(false));
      draw.on('drawabort', () => setIsDrawing(false));

      map.addInteraction(draw);
      setDrawInteraction(draw);
      drawInteractionRef.current = draw;

      return () => {
        map.removeInteraction(draw);
        drawInteractionRef.current = null;
        setIsDrawing(false);
      };
    }

    // Trajectory and corridor queries: LineString drawing
    if (geometryKind === 'line' && markerLayer) {
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
        setClickedCoords(lonLatCoords);
      });

      draw.on('drawstart', () => setIsDrawing(true));
      draw.on('drawend', () => setIsDrawing(false));
      draw.on('drawabort', () => setIsDrawing(false));

      map.addInteraction(draw);
      setDrawInteraction(draw);
      drawInteractionRef.current = draw;

      return () => {
        map.removeInteraction(draw);
        drawInteractionRef.current = null;
        setIsDrawing(false);
      };
    }
    // Geometry another kind of query can't use is cleared by MapInteractionContext.setDataQuery,
    // and the layers redraw from state
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, geometryKind, areaLayer, markerLayer]);

  // Display selected areas
  useEffect(() => {
    if (areaLayer && selectedArea) {
      const source = areaLayer.getSource();
      if (source) {
        source.clear();

        selectedArea.forEach(polygonCoords => {
          const coordinates = polygonCoords.map(coord => fromLonLat([coord[0], coord[1]]));
          const polygon = new Polygon([coordinates]);
          const feature = new Feature({ geometry: polygon });
          source.addFeature(feature);
        });
      }
    }
  }, [selectedArea, areaLayer]);

  // Abort an in-progress sketch (the half-drawn line/polygon lives on the Draw
  // interaction's own overlay, not in our vector layers, so clearing the layer
  // source alone leaves it on screen). Used by the Clear buttons.
  const abortDrawing = useCallback(() => {
    const draw = drawInteractionRef.current;
    if (draw) {
      try {
        draw.abortDrawing();
      } catch {
        /* no active sketch to abort */
      }
    }
    setIsDrawing(false);
  }, []);

  return { abortDrawing, isDrawing };
}
