import { describe, expect, it } from 'vitest';
import { publicUrl } from './publicUrl';

describe('publicUrl', () => {
  it('serves public files from the site root by default', () => {
    expect(publicUrl('/schemas/openapi/3.1/schema.json')).toBe('/schemas/openapi/3.1/schema.json');
  });

  it('puts them under the base path a deployment uses (GitHub Pages)', () => {
    expect(publicUrl('/schemas/covjson/1.0/coveragejson.json', '/ogcapibrowser/')).toBe('/ogcapibrowser/schemas/covjson/1.0/coveragejson.json');
    expect(publicUrl('iwxxm-transform.xsl', '/ogcapibrowser')).toBe('/ogcapibrowser/iwxxm-transform.xsl');
  });
});
