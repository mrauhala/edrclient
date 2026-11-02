import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { validateOpenApiStructure, type OasVersion } from './validateStructure';
import { parseServiceDescription } from './loadServiceDescription';
import { fixtureText, SERVERS, type ServerName } from './__fixtures__/servers';

// The schemas as the app serves them (public/schemas/openapi, written by scripts/download-schemas.js)
const loadSchema = async (version: OasVersion) =>
  JSON.parse(readFileSync(new URL(`../../../public/schemas/openapi/${version}/schema.json`, import.meta.url), 'utf8'));

describe('validateOpenApiStructure', () => {
  it.each(Object.keys(SERVERS) as ServerName[])('%s: the real document is valid', async server => {
    const { doc } = await parseServiceDescription(fixtureText(SERVERS[server].doc));
    const result = await validateOpenApiStructure(doc, loadSchema);
    expect(result.errors).toEqual([]);
    expect(result.schemaName).toMatch(/^OpenAPI 3\.[01] schema$/);
  });

  it('reports a broken 3.1 document with condensed, readable errors', async () => {
    const doc = {
      openapi: '3.1.0',
      info: { title: 'Broken' },
      paths: { '/a': { get: { parameters: [{ name: 'p' }], responses: {} } } },
    };
    const { errors } = await validateOpenApiStructure(doc, loadSchema);
    const lines = errors.map(error => `${error.path} ${error.keyword}: ${error.message.replace(/^[^:]*: /, '')}`);
    expect(lines).toEqual(expect.arrayContaining([
      "/info required: must have required property 'version'",
      "/paths/~1a/get/parameters/0 required: must have required property 'in'",
      '/paths/~1a/get/parameters/0 required: must have one of: schema, content',
    ]));
    // oneOf/if umbrella errors are dropped in favour of the specific ones
    expect(errors.some(error => ['oneOf', 'if', 'else'].includes(error.keyword ?? ''))).toBe(false);
    expect(errors.every(error => error.section === 'OpenAPI' && error.severity === 'error')).toBe(true);
  });

  it('reports a problem repeated across parameters once, naming them (Meteogate)', async () => {
    // Meteogate's parameters have examples but neither schema nor content, 153 times
    const parameter = (name: string) => ({ name, in: 'query', examples: { a: { value: 'x' } } });
    const doc = {
      openapi: '3.1.0',
      info: { title: 'Repeated', version: '1' },
      paths: {
        '/a': { get: { parameters: [parameter('f'), parameter('datetime')], responses: { 200: { description: 'OK' } } } },
        '/b': { get: { parameters: [parameter('f'), parameter('bbox')], responses: { 200: { description: 'OK' } } } },
      },
    };
    const { errors } = await validateOpenApiStructure(doc, loadSchema);
    expect(errors.map(({ path, message }) => [path, message])).toEqual([
      ['/paths/~1a/get/parameters/0', '4 parameters (f, datetime, bbox): must have one of: schema, content'],
    ]);
    // The examples weren't flagged as unevaluated properties: that only followed from the missing schema
    expect(errors.some(error => error.keyword === 'unevaluatedProperties')).toBe(false);
  });

  it('keeps unevaluatedProperties when nothing else explains it', async () => {
    const doc = { openapi: '3.1.0', info: { title: 'x', version: '1', extra: true }, paths: {} };
    const { errors } = await validateOpenApiStructure(doc, loadSchema);
    expect(errors.map(error => [error.path, error.keyword])).toEqual([['/info', 'unevaluatedProperties']]);
  });

  it('caps the list with a last "+N more"', async () => {
    const paths = Object.fromEntries(Array.from({ length: 205 }, (_, i) => [`/p${i}`, { [`x${i}`]: {} }]));
    const { errors } = await validateOpenApiStructure({ openapi: '3.1.0', info: { title: 'x', version: '1' }, paths }, loadSchema);
    expect(errors).toHaveLength(201);
    expect(errors[200]).toMatchObject({ keyword: 'truncated', message: '+5 more errors not shown' });
  });

  it('validates 3.0 documents with the draft-04 based schema', async () => {
    const { errors } = await validateOpenApiStructure({ openapi: '3.0.3', info: { title: 'x', version: '1' }, paths: { a: {} } }, loadSchema);
    expect(errors.map(error => error.path)).toContain('/paths');
  });

  it('notes documents it cannot validate (Swagger 2.0)', async () => {
    const { errors } = await validateOpenApiStructure({ swagger: '2.0' }, loadSchema);
    expect(errors).toEqual([expect.objectContaining({ severity: 'info', keyword: 'version' })]);
  });
});
