import { useEffect, useRef } from 'react';
import Map from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Feature } from 'ol';
import { Polygon } from 'ol/geom';
import { fromLonLat } from 'ol/proj';
import { useCollection } from '../contexts/CollectionContext';
import { zoomToExtents } from '../mapView';

export function useCollectionExtents(
  map: Map | null,
  vectorLayer: VectorLayer<VectorSource> | null
): void {
  const { selectedCollectionExtents } = useCollection();
  const selectedExtentsRef = useRef(selectedCollectionExtents);

  useEffect(() => {
    if (map && selectedCollectionExtents && selectedExtentsRef.current !== selectedCollectionExtents) {
      if (vectorLayer) {
        vectorLayer.getSource()?.clear();

        // Add each bbox as a separate rectangle feature
        selectedCollectionExtents.forEach((bbox, index) => {
          const [west, south, east, north] = bbox;

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

          vectorLayer.getSource()?.addFeature(feature);
        });

        // Zoom to the overall extent
        zoomToExtents(map.getView(), selectedCollectionExtents);
      }

      selectedExtentsRef.current = selectedCollectionExtents;
    } else if (map && selectedCollectionExtents === null && vectorLayer) {
      vectorLayer.getSource()?.clear();
      selectedExtentsRef.current = null;
    }
  }, [map, selectedCollectionExtents, vectorLayer]);
}
