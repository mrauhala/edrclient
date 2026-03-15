import { useEffect, useRef } from 'react';
import Map from 'ol/Map';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Feature } from 'ol';
import { Polygon } from 'ol/geom';
import { fromLonLat } from 'ol/proj';
import { useCollection } from '../contexts/CollectionContext';

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

        // Calculate overall extent for zooming
        let minWest = Number.POSITIVE_INFINITY;
        let minSouth = Number.POSITIVE_INFINITY;
        let maxEast = Number.NEGATIVE_INFINITY;
        let maxNorth = Number.NEGATIVE_INFINITY;

        // Add each bbox as a separate rectangle feature
        selectedCollectionExtents.forEach((bbox, index) => {
          const [west, south, east, north] = bbox;

          minWest = Math.min(minWest, west);
          minSouth = Math.min(minSouth, south);
          maxEast = Math.max(maxEast, east);
          maxNorth = Math.max(maxNorth, north);

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
        if (isFinite(minWest) && isFinite(minSouth) && isFinite(maxEast) && isFinite(maxNorth)) {
          const hasValidArea = minWest !== maxEast && minSouth !== maxNorth;

          if (!hasValidArea) {
            console.warn('Extent has no area (point or line), skipping zoom');
          } else {
            const overallExtent = [
              ...fromLonLat([minWest, minSouth]),
              ...fromLonLat([maxEast, maxNorth])
            ];

            const isValidExtent = overallExtent.every(coord => isFinite(coord)) &&
                                  overallExtent[0] !== overallExtent[2] &&
                                  overallExtent[1] !== overallExtent[3];

            if (!isValidExtent) {
              console.warn('Transformed extent is invalid, skipping zoom');
            } else {
              const isGlobalBbox = minWest <= -179 && minSouth <= -89 && maxEast >= 179 && maxNorth >= 89;

              if (isGlobalBbox) {
                map.getView().setCenter([0, 0]);
                map.getView().setZoom(2);
              } else {
                try {
                  map.getView().fit(overallExtent, {
                    padding: [50, 50, 50, 50],
                    duration: 1000
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
      vectorLayer.getSource()?.clear();
      selectedExtentsRef.current = null;
    }
  }, [map, selectedCollectionExtents, vectorLayer]);
}
