import { Circle, Fill, Stroke, Style } from 'ol/style';

// How an API's locations look on the map. They can number in the hundreds, so a marker is small, and a dark edge keeps
// neighbours apart, over the dark basemap and over a data layer alike. Only the selected one has a white edge, and it's
// drawn above the others. Shared, rather than made for each feature at every render.
const BLUE = '#2196F3';
const ORANGE = '#FF9800';

const POINT = new Style({
  image: new Circle({
    radius: 3.5,
    fill: new Fill({ color: '#42A5F5' }),
    stroke: new Stroke({ color: 'rgba(8, 16, 24, 0.85)', width: 1.25 }),
  }),
});
const SELECTED_POINT = new Style({
  zIndex: 1,
  image: new Circle({
    radius: 6,
    fill: new Fill({ color: ORANGE }),
    stroke: new Stroke({ color: '#ffffff', width: 2 }),
  }),
});

const line = (color: string, width: number) => new Style({ stroke: new Stroke({ color, width }) });
const area = (color: string, width: number, fill: string) => new Style({ stroke: new Stroke({ color, width }), fill: new Fill({ color: fill }) });

const LINE = line(BLUE, 4);
const SELECTED_LINE = line(ORANGE, 6);
const POLYGON = area(BLUE, 3, 'rgba(33, 150, 243, 0.3)');
const SELECTED_POLYGON = area(ORANGE, 4, 'rgba(255, 152, 0, 0.4)');
const OTHER = area(BLUE, 2, 'rgba(33, 150, 243, 0.2)');
const SELECTED_OTHER = area(ORANGE, 3, 'rgba(255, 152, 0, 0.3)');

export function locationStyle(geometryType: string, selected: boolean): Style {
  switch (geometryType) {
    case 'Point':
    case 'MultiPoint':
      return selected ? SELECTED_POINT : POINT;
    case 'LineString':
    case 'MultiLineString':
      return selected ? SELECTED_LINE : LINE;
    case 'Polygon':
    case 'MultiPolygon':
      return selected ? SELECTED_POLYGON : POLYGON;
    default:
      return selected ? SELECTED_OTHER : OTHER;
  }
}

// How far from a marker, in pixels, a pointer still counts as on it. A mouse has about the reach it had on the bigger
// marker, and a finger, being far less exact, more.
export const locationHitTolerance = (coarsePointer: boolean) => (coarsePointer ? 12 : 5);
