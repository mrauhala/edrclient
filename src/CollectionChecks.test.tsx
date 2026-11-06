import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CollectionChecks from './CollectionChecks';
import type { Collection, ValidationResult } from './types/api';

vi.mock('./CollectionValidationErrors', () => ({ default: ({ errors }: { errors: unknown[] }) => <i>{errors.length} schema errors</i> }));

const VALID: ValidationResult = { isValid: true, errors: null };
const MAP_LINK = { href: 'https://a.example/collections/one/map', rel: 'http://www.opengis.net/def/rel/ogc/1.0/map', type: 'image/png' };

const render = (collection: object, validation = VALID) => renderToStaticMarkup(
  <CollectionChecks collection={collection as unknown as Collection} validationResult={validation} />
);
const full = {
  id: 'one',
  title: 'First collection',
  description: 'What it holds',
  keywords: ['weather', 'forecast'],
  links: [{ href: 'https://a.example/collections/one', rel: 'self', title: 'This one' }, { href: 'https://a.example/x', rel: 'data' }],
  data_queries: { position: { link: { href: 'https://a.example/position', rel: 'data', title: 'Its position query' } } },
  extent: { spatial: { bbox: [[20, 55, 30, 65]], crs: 'CRS84' } },
  crs: 'CRS84',
  output_formats: ['CoverageJSON', 'GeoJSON'],
  parameter_names: { t: { type: 'Parameter', description: 'Temperature' } },
};
const severityOf = (html: string, title: string) => {
  const upTo = html.slice(0, html.indexOf(title));
  return [...upTo.matchAll(/MuiAlert-color(Success|Warning|Error|Info)/g)].at(-1)?.[1];
};

describe('CollectionChecks', () => {
  it('passes a complete collection on every field, naming what it found', () => {
    const html = render(full);
    for (const title of ['A: ID', 'B: TITLE', 'C: DESCRIPTION', 'D: KEYWORDS', 'E: LINKS', 'F: DATA_QUERIES', 'G: EXTENT', 'G.1: Spatial Extent', 'H: CRS', 'I: OUTPUT_FORMATS', 'J: PARAMETER_NAMES']) {
      expect(html).toContain(title);
      expect(severityOf(html, title)).toBe('Success');
    }
    expect(html).toContain('weather, forecast');
    expect(html).toContain('This one');
    expect(html).toContain('Its position query');
    expect(html).toContain('CoverageJSON, GeoJSON');
    expect(html).toContain('Temperature');
  });

  it('holds a missing required field against it as an error', () => {
    const html = render({ title: 'x' });
    for (const title of ['A: ID', 'E: LINKS', 'F: DATA_QUERIES', 'G: EXTENT', 'H: CRS', 'I: OUTPUT_FORMATS', 'J: PARAMETER_NAMES']) {
      expect(severityOf(html, title)).toBe('Error');
    }
  });

  it('warns of a missing optional field', () => {
    const html = render({ id: 'one' });
    for (const title of ['B: TITLE', 'C: DESCRIPTION', 'D: KEYWORDS']) {
      expect(severityOf(html, title)).toBe('Warning');
    }
  });

  it("doesn't hold fields against a Maps collection that it isn't asked for", () => {
    const html = render({ id: 'one', links: [MAP_LINK] });
    for (const title of ['F: DATA_QUERIES', 'I: OUTPUT_FORMATS', 'J: PARAMETER_NAMES']) {
      expect(severityOf(html, title)).toBe('Info');
    }
    expect(html).toContain('Not applicable');
  });

  it('shows the schema errors found for it, and not those of others', () => {
    const errors = { one: [{ message: 'x' }, { message: 'y' }], two: [{ message: 'z' }] };
    expect(render(full, { ...VALID, collectionErrors: errors })).toContain('2 schema errors');
    expect(render(full)).not.toContain('schema errors');
    expect(render({ ...full, id: 'three' }, { ...VALID, collectionErrors: errors })).not.toContain('schema errors');
  });

  it('flags a flat bounding box', () => {
    const html = render({ ...full, extent: { spatial: { bbox: [20, 55, 30, 65], crs: 'CRS84' } } });
    expect(html).toContain('Legacy bbox format');
    expect(html).toContain('[20, 55, 30, 65]');
    expect(render(full)).not.toContain('Legacy bbox format');
  });

  it('lists several bounding boxes', () => {
    const html = render({ ...full, extent: { spatial: { bbox: [[1, 2, 3, 4], [5, 6, 7, 8]], crs: 'CRS84' } } });
    expect(html).toContain('Bounding Boxes');
    expect(html).toContain('Bbox 2: [5, 6, 7, 8]');
  });

  it('calls a spatial extent without a CRS missing', () => {
    expect(severityOf(render({ ...full, extent: { spatial: { bbox: [[1, 2, 3, 4]] } } }), 'G.1: Spatial Extent')).toBe('Error');
  });

  it('accepts parameter names as a list', () => {
    const html = render({ ...full, parameter_names: [{ id: 't', label: 'Temperature', type: 'Parameter' }, { id: 'p' }] });
    expect(html).toContain('Temperature (Parameter)');
    expect(html).toContain('p (unknown)');
  });
});
