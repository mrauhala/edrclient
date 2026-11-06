import type { FeatureLike } from 'ol/Feature';
import Point from 'ol/geom/Point';
import { Fill, Stroke, Style, Text } from 'ol/style';

// The box a collection declares as its extent. Only an outline, so that the map and any data on it keep their colours.
// Dashes tell it from a border, and from the red of an area drawn for a query. The dark line under them keeps it visible
// over a bright layer.
const CASING = new Style({ stroke: new Stroke({ color: 'rgba(0, 0, 0, 0.45)', width: 3 }) });
const DASHES = new Style({ stroke: new Stroke({ color: 'rgba(255, 255, 255, 0.85)', width: 1.25, lineDash: [6, 5] }) });

// In the box's bottom right corner, clear of the card over the map's top left and the prompts in its bottom left
const LABEL = new Style({
  geometry: feature => {
    const [, south, east] = feature.getGeometry()!.getExtent();
    return new Point([east, south]);
  },
  text: new Text({
    text: [
      'Collection extent', '500 11px Roboto, Helvetica, Arial, sans-serif',
      '\n', '',
      'where it says it has data', '400 10px Roboto, Helvetica, Arial, sans-serif',
    ],
    fill: new Fill({ color: 'rgba(255, 255, 255, 0.92)' }),
    stroke: new Stroke({ color: 'rgba(0, 0, 0, 0.8)', width: 3 }),
    textAlign: 'right',
    textBaseline: 'bottom',
    offsetX: -7,
    offsetY: -7,
  }),
});

const BOX = [CASING, DASHES];
const LABELLED_BOX = [CASING, DASHES, LABEL];

// Named once: the first box is the collection's overall extent, and any others are parts of it
export const extentStyle = (feature: FeatureLike) => (feature.get('bboxIndex') === 0 ? LABELLED_BOX : BOX);
