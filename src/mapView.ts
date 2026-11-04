import type View from 'ol/View';
import { fromLonLat } from 'ol/proj';

type Bbox = [number, number, number, number];

function zoomToWorld(view: View): void {
  view.setCenter([0, 0]);
  view.setZoom(2);
}

// All of a collection's extents
export function zoomToExtents(view: View, extents: Bbox[]): void {
  let minWest = Number.POSITIVE_INFINITY;
  let minSouth = Number.POSITIVE_INFINITY;
  let maxEast = Number.NEGATIVE_INFINITY;
  let maxNorth = Number.NEGATIVE_INFINITY;

  extents.forEach(([west, south, east, north]) => {
    minWest = Math.min(minWest, west);
    minSouth = Math.min(minSouth, south);
    maxEast = Math.max(maxEast, east);
    maxNorth = Math.max(maxNorth, north);
  });

  const overallExtent = [
    ...fromLonLat([minWest, minSouth]),
    ...fromLonLat([maxEast, maxNorth])
  ];
  if (!overallExtent.every(coord => isFinite(coord)) || overallExtent[0] === overallExtent[2] || overallExtent[1] === overallExtent[3]) {
    console.warn('Extent is invalid or has no area (point or line), skipping zoom');
    return;
  }

  if (minWest <= -179 && minSouth <= -89 && maxEast >= 179 && maxNorth >= 89) {
    zoomToWorld(view);
    return;
  }
  try {
    view.fit(overallExtent, {
      padding: [50, 50, 50, 50],
      duration: 1000
    });
  } catch (error) {
    console.error('Error fitting extent to map view:', error, overallExtent);
  }
}

// All of a collection's locations, given the extent of their features in the view's projection
export function zoomToLocations(view: View, extent: number[]): void {
  if (!extent.every(coord => isFinite(coord))) return;

  if (extent[0] === extent[2] || extent[1] === extent[3]) {
    console.warn('Location extent has no area (point), using center with zoom instead of fit');
    view.setCenter([(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2]);
    view.setZoom(10);
    return;
  }
  try {
    view.fit(extent, {
      padding: [50, 50, 50, 50],
      duration: 1000,
      maxZoom: 10
    });
  } catch (error) {
    console.error('Error fitting location extent to map view:', error, extent);
  }
}

// One location, about 110 km across
export function zoomToPoint(view: View, [lon, lat]: number[]): void {
  const margin = 0.5;
  const extent = [...fromLonLat([lon - margin, lat - margin]), ...fromLonLat([lon + margin, lat + margin])];
  if (!extent.every(coord => isFinite(coord))) return;
  try {
    view.fit(extent, { padding: [10, 10, 10, 10] });
  } catch (error) {
    console.error('Error fitting to feature:', error);
  }
}

// Back to all of what's chosen: the collection's extents, else its locations, else the world
export function zoomToOverview(view: View, extents: Bbox[] | null, locationExtent: number[] | null | undefined): void {
  if (extents && extents.length > 0) zoomToExtents(view, extents);
  else if (locationExtent?.every(coord => isFinite(coord))) zoomToLocations(view, locationExtent);
  else zoomToWorld(view);
}
