// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Mock axios - uses manual mock from src/__mocks__/axios.ts
jest.mock('axios');

// Mock swagger-ui-react to avoid ES module issues
jest.mock('swagger-ui-react', () => ({
  __esModule: true,
  default: () => null,
}));

// Mock all OpenLayers imports
jest.mock('ol/Map', () => jest.fn());
jest.mock('ol/View', () => jest.fn());
jest.mock('ol/layer/Tile', () => jest.fn());
jest.mock('ol/layer/Vector', () => jest.fn());
jest.mock('ol/source/OSM', () => jest.fn());
jest.mock('ol/source/Vector', () => jest.fn());
jest.mock('ol/source/XYZ', () => jest.fn());
jest.mock('ol/geom/Point', () => jest.fn());
jest.mock('ol/Feature', () => jest.fn());
jest.mock('ol/style/Style', () => jest.fn());
jest.mock('ol/style/Icon', () => jest.fn());
jest.mock('ol/style/Stroke', () => jest.fn());
jest.mock('ol/style/Fill', () => jest.fn());
jest.mock('ol/format/GeoJSON', () => jest.fn());
jest.mock('ol/proj', () => ({
  fromLonLat: jest.fn((coords) => coords),
  toLonLat: jest.fn((coords) => coords),
  transform: jest.fn((coords) => coords),
}));
jest.mock('ol-layerswitcher', () => jest.fn());
