import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ApiProvider, useApi } from './ApiContext';
import { CollectionProvider } from './CollectionContext';
import { GeoJsonLayerProvider } from './GeoJsonLayerContext';
import { MapInteractionProvider } from './MapInteractionContext';
import { OpenApiProvider } from './OpenApiContext';
import { QueryBuilderProvider } from './QueryBuilderContext';
import { QueryValidationProvider } from './QueryValidationContext';
import { RequestUrlProvider } from './RequestUrlContext';
import { ServiceProvider } from './ServiceContext';
import { ValidationProvider } from './ValidationContext';
import type { CustomService } from '../types/CustomService';

// What the first render sees, which is what a request being opened sees first
type Seen = ReturnType<typeof useApi>;
function Report({ onSeen }: { onSeen: (seen: Seen) => void }) {
  onSeen(useApi());
  return null;
}

function firstRender(hash: string, customServices: CustomService[] = []): Seen {
  vi.stubGlobal('window', { location: { hash } });
  let seen: Seen | undefined;
  renderToStaticMarkup(
    <ServiceProvider customServices={customServices}>
      <CollectionProvider>
        <RequestUrlProvider>
          <QueryValidationProvider>
            <MapInteractionProvider>
              <GeoJsonLayerProvider>
                <ValidationProvider>
                  <OpenApiProvider>
                    <QueryBuilderProvider>
                      <ApiProvider>
                        <Report onSeen={value => { seen = value; }} />
                      </ApiProvider>
                    </QueryBuilderProvider>
                  </OpenApiProvider>
                </ValidationProvider>
              </GeoJsonLayerProvider>
            </MapInteractionProvider>
          </QueryValidationProvider>
        </RequestUrlProvider>
      </CollectionProvider>
    </ServiceProvider>
  );
  return seen!;
}

const hashOf = (url: string) => `#request=${encodeURIComponent(url)}`;

describe('ApiProvider', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is loading from the first render, so that a link waits for its API', () => {
    expect(firstRender('').status).toBe('loading');
    expect(firstRender(hashOf('https://other.example/api/collections/a')).status).toBe('loading');
  });

  it('starts on FMI without a link', () => {
    expect(firstRender('').apiUrl).toBe('https://opendata.fmi.fi/edr');
  });

  it("starts on a link's API", () => {
    expect(firstRender(hashOf('https://other.example/api/collections/a/position')).apiUrl).toBe('https://other.example/api');
  });

  it('knows a custom service, by the name it was saved under', () => {
    const saved = { id: '1', name: 'Mine', url: 'https://mine.example/edr/' } as CustomService;
    expect(firstRender(hashOf('https://mine.example/edr/collections/a'), [saved]).apiUrl).toBe('https://mine.example/edr/');
  });

  it('has nothing to say about the API before it has loaded', () => {
    expect(firstRender('')).toMatchObject({ title: null, license: null });
  });
});

describe('useApi', () => {
  it('says so outside its provider', () => {
    expect(() => renderToStaticMarkup(<Report onSeen={() => {}} />)).toThrow('useApi must be used within an ApiProvider');
  });
});
