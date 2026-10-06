import { describe, expect, it } from 'vitest';
import type { Collection } from '../../types/api';
import { lintOpenApiForEdr } from './lintEdr';
import { buildOperationIndex } from './operationIndex';
import { parseServiceDescription } from './loadServiceDescription';
import { fixtureCollections, fixtureText, SERVERS, type ServerName } from './__fixtures__/servers';

async function lint(server: ServerName) {
  const { doc } = await parseServiceDescription(fixtureText(SERVERS[server].doc));
  return lintOpenApiForEdr(buildOperationIndex({ url: SERVERS[server].docUrl, doc }), doc, fixtureCollections(server));
}

const summary = (findings: Awaited<ReturnType<typeof lint>>) =>
  findings.map(finding => `${finding.severity} ${finding.keyword}: ${finding.message.replace(/ \((\d+ )?collections?: .*\)$/, '')}`).sort();

describe('lintOpenApiForEdr on the real servers', () => {
  it('FMI: resolution schemas, cube requiring coords, optional corridor height, f on lists', async () => {
    expect(summary(await lint('fmi'))).toEqual([
      'info edr-required-optional: corridor queries: the API docs mark corridor-height optional; EDR requires it',
      'info edr-required-optional: corridor queries: the API docs mark height-units optional; EDR requires it',
      "warning required-beyond-edr: cube queries: the API docs require coords, which EDR doesn't",
      'warning schema-items-without-array: Parameter resolution-x: the schema has "items" but no "type": "array"',
      'warning schema-items-without-array: Parameter resolution-y: the schema has "items" but no "type": "array"',
      'warning schema-items-without-array: Parameter resolution-z: the schema has "items" but no "type": "array"',
    ]);
  });

  it('DWD: consistent', async () => {
    expect(await lint('dwd')).toEqual([]);
  });

  it('MeteoCore: consistent (its locations and instances formats are checked where EDR puts them)', async () => {
    expect(summary(await lint('meteocore'))).toEqual([]);
  });

  it('Met Office: within-units typed as a number, missing paths for model collections', async () => {
    const findings = summary(await lint('metoffice'));
    expect(findings).toContain('warning unit-not-string: Parameter within-units is typed number, but units are strings (e.g. km)');
    expect(findings.filter(f => f.startsWith('warning missing-operation')).length).toBe(8);
    expect(findings).toHaveLength(9);
  });

  it('MET Norway: consistent; Meteogate: a note', async () => {
    expect(summary(await lint('metno'))).toEqual([]);
    expect(summary(await lint('meteogate'))).toEqual([
      'info edr-required-optional: radius queries: the API docs mark within-units optional; EDR requires it',
    ]);
  });

  it('points findings at the document location and lists affected collections', async () => {
    const cube = (await lint('fmi')).find(finding => finding.keyword === 'required-beyond-edr');
    expect(cube).toMatchObject({ section: 'OpenAPI', schema: 'EDR consistency', path: expect.stringMatching(/^\/paths\/~1collections~1\{collectionId\}~1cube\/get\/parameters\/\d+$/) });
    expect(cube?.params?.collections).toContain('ecmwf_painepinta');
  });
});

describe('lintOpenApiForEdr rules', () => {
  const collection = {
    id: 'c', links: [], crs: [], output_formats: null,
    parameter_names: { temp: { type: 'Parameter' }, wind: { type: 'Parameter' } },
    data_queries: {
      radius: {
        link: {
          href: 'https://x.org/edr/collections/c/radius',
          variables: { query_type: 'radius', output_formats: ['CoverageJSON', 'GeoJSON'], within_units: ['km', 'mi'] },
        },
      },
    },
  } as unknown as Collection;

  const run = (parameters: unknown[], extra: Record<string, unknown> = {}) => {
    const doc = { openapi: '3.1.0', servers: [{ url: 'https://x.org/edr' }], paths: { '/collections/{id}/radius': { get: { parameters } } }, ...extra };
    return lintOpenApiForEdr(buildOperationIndex({ url: 'https://x.org/edr/api', doc }), doc, [collection]).map(f => `${f.severity} ${f.keyword}`).sort();
  };
  const param = (name: string, schema: object, required = true) => ({ name, in: 'query', required, schema });
  const complete = [
    { name: 'id', in: 'path', required: true, schema: { type: 'string', enum: ['c'] } },
    param('coords', { type: 'string' }), param('within', { type: 'number' }), param('within-units', { type: 'string', enum: ['km', 'mi'] }),
    param('f', { type: 'string', enum: ['CoverageJSON', 'GeoJSON'] }, false),
    param('parameter-name', { type: 'array', items: { enum: ['temp', 'wind'] } }, false),
  ];

  it('accepts a document consistent with EDR and the metadata', () => {
    expect(run(complete)).toEqual([]);
  });

  it('flags enums that leave out what the collection offers', () => {
    expect(run([
      { name: 'id', in: 'path', required: true, schema: { enum: ['other'] } },
      param('coords', {}), param('within', {}), param('within-units', { enum: ['km'] }),
      param('f', { enum: ['coveragejson'] }, false),
      param('parameter-name', { type: 'array', items: { enum: ['temp'] } }, false),
    ])).toEqual([
      'info enum-case', 'warning enum-vs-metadata', 'warning enum-vs-metadata', 'warning enum-vs-metadata', 'warning enum-vs-metadata',
    ]);
  });

  // EDR 1.2: the locations list takes no f (paths/queries/locations.yaml); a location's data, and so
  // the query's output_formats, come from /locations/{locationId}. MeteoCore's production docs.
  it("checks a locations query's formats against /locations/{locationId}, not the list", () => {
    const locations = {
      id: 'c', links: [], crs: [], output_formats: null,
      data_queries: { locations: { link: { href: 'https://x.org/edr/collections/c/locations', variables: { query_type: 'locations', output_formats: ['CoverageJSON', 'PNG'] } } } },
    } as unknown as Collection;
    const lint = (byIdFormats: string[] | null) => {
      const paths: Record<string, unknown> = { '/collections/{id}/locations': { get: { parameters: [param('f', { enum: ['GeoJSON', 'HTML'] }, false)] } } };
      if (byIdFormats) paths['/collections/{id}/locations/{locationId}'] = { get: { parameters: [param('f', { enum: byIdFormats }, false)] } };
      const doc = { openapi: '3.1.0', servers: [{ url: 'https://x.org/edr' }], paths };
      return lintOpenApiForEdr(buildOperationIndex({ url: 'https://x.org/edr/api', doc }), doc, [locations]);
    };
    expect(lint(['CoverageJSON', 'PNG', 'HTML'])).toEqual([]);
    expect(lint(['CoverageJSON', 'HTML'])).toMatchObject([{ keyword: 'enum-vs-metadata', path: '/paths/~1collections~1{id}~1locations~1{locationId}/get/parameters/0' }]);
    expect(lint(null)).toEqual([]); // the list alone describes no data formats
  });

  // EDR 1.2: an instances data query declares no output formats (instancesDataQuery.yaml) and
  // /instances takes the core f (json, html), so the collection's formats don't apply
  it("doesn't check instances against the collection's output formats", () => {
    const instances = {
      id: 'c', links: [], crs: [], output_formats: ['CoverageJSON', 'PNG', 'HTML'],
      data_queries: { instances: { link: { href: 'https://x.org/edr/collections/c/instances', variables: { query_type: 'instances' } } } },
    } as unknown as Collection;
    const doc = { openapi: '3.1.0', servers: [{ url: 'https://x.org/edr' }], paths: { '/collections/{id}/instances': { get: { parameters: [param('f', { enum: ['json', 'html'] }, false)] } } } };
    expect(lintOpenApiForEdr(buildOperationIndex({ url: 'https://x.org/edr/api', doc }), doc, [instances])).toEqual([]);
  });

  it('flags missing required parameters, a missing f and broken refs', () => {
    expect(run([param('coords', {}), { $ref: '#/components/parameters/gone' }])).toEqual([
      'error broken-ref', 'warning edr-required-undeclared', 'warning edr-required-undeclared', 'warning f-undeclared',
    ]);
  });
});
