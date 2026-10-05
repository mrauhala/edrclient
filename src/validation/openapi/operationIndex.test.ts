import { describe, expect, it } from 'vitest';
import { buildOperationIndex, matchOperation } from './operationIndex';
import { parseServiceDescription } from './loadServiceDescription';
import { fixtureCollections, fixtureText, SERVERS, type ServerName } from './__fixtures__/servers';
import { normalizeHref } from '../../utils/href';

async function indexFor(server: ServerName) {
  const { doc } = await parseServiceDescription(fixtureText(SERVERS[server].doc));
  return buildOperationIndex({ url: SERVERS[server].docUrl, doc });
}

describe('buildOperationIndex', () => {
  it.each([
    ['fmi', ['/edr']], // absolute servers URL
    ['dwd', ['/v1beta1']], // relative servers URL, resolved against the document URL
    ['meteocore', ['']], // no servers: paths carry /edr themselves
    ['metoffice', ['/edr']], // absolute with trailing slash
    ['metno', ['']],
    ['meteogate', ['/eu-eumetnet-surface-observations']],
  ] as [ServerName, string[]][])('%s servers give base paths %j', async (server, basePaths) => {
    expect((await indexFor(server)).basePaths).toEqual(basePaths);
  });
});

describe('matchOperation against the real data_queries', () => {
  // Met Office's document lacks most model collections' paths (only their instance paths exist)
  it.each([
    ['fmi', 300, 300], ['dwd', 8, 8], ['meteocore', 266, 266], ['metoffice', 123, 50], ['metno', 5, 5], ['meteogate', 4, 4],
  ] as [ServerName, number, number][])('%s: %i data queries, %i described', async (server, total, matched) => {
    const index = await indexFor(server);
    const hrefs = fixtureCollections(server).flatMap(collection =>
      Object.values(collection.data_queries ?? {}).map(query => normalizeHref(query.link.href)!));
    const matches = hrefs.map(href => matchOperation(index, href));
    expect(hrefs.length).toBe(total);
    expect(matches.filter(Boolean).length).toBe(matched);
    expect(matches.every(match => !match || match.via === 'server')).toBe(true);
  });

  it('matches generic paths and extracts path parameters (FMI, location id)', async () => {
    const match = matchOperation(await indexFor('fmi'), 'https://opendata.fmi.fi/edr/collections/ecmwf/locations/658225?f=CoverageJSON');
    expect(match?.entry.template).toBe('/collections/{collectionId}/locations/{locationId}');
    expect(match?.pathParams).toEqual({ collectionId: 'ecmwf', locationId: '658225' });
  });

  it('prefers the most specific path (MeteoCore per-collection paths)', async () => {
    const match = matchOperation(await indexFor('meteocore'), 'https://meteocore.app.meteo.fi/edr/collections/fmi-obs/position?coords=POINT(1%202)');
    expect(match?.entry.template).toBe('/edr/collections/fmi-obs/position');
  });

  it('resolves enums from $ref schemas and anyOf members (DWD) and array items (Met Office)', async () => {
    const dwd = matchOperation(await indexFor('dwd'), 'https://nwp.opendata-api.dwd.de/v1beta1/collections/ICON-D2-RUC@single_level/radius');
    const param = (name: string) => dwd?.entry.params.find(p => p.name === name);
    expect(param('collection_id')?.enumValues).toContain('ICON-D2-RUC@single_level');
    expect(param('within-units')?.enumValues).toEqual(['km', 'm']);
    expect(param('f')?.enumValues).toEqual(['CoverageJSON']);

    const metoffice = matchOperation(await indexFor('metoffice'), 'https://labs.metoffice.gov.uk/edr/collections/global_pop_density/position');
    const parameterName = metoffice?.entry.params.find(p => p.name === 'parameter-name');
    expect(parameterName?.isArray).toBe(true);
    expect(parameterName?.enumValues).toContain('Pop_Density');
  });

  it('falls back to matching the end of the path when the servers prefix is wrong', () => {
    const index = buildOperationIndex({
      url: 'https://x.org/api',
      doc: { servers: [{ url: 'https://x.org/v2' }], paths: { '/collections/{id}/position': { get: {} } } },
    });
    expect(matchOperation(index, 'https://x.org/edr/collections/c/position')).toMatchObject({ via: 'suffix', pathParams: { id: 'c' } });
    expect(matchOperation(index, 'https://x.org/v2/collections/c/area')).toBeNull();
    expect(matchOperation(index, 'not a url')).toBeNull();
  });
});
