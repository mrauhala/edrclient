import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ServiceInfoPanel from './ServiceInfoPanel';
import { NOTHING_LOADED, type LoadedApi } from './api/loadedApi';
import type { ValidationResult } from './types/api';

const state = vi.hoisted(() => ({
  api: {} as unknown,
  validation: {} as unknown,
}));
vi.mock('./contexts/ApiContext', () => ({ useApi: () => state.api }));
vi.mock('./contexts/ValidationContext', () => ({ useValidation: () => ({ validationResult: state.validation }) }));

const render = (api: Partial<LoadedApi> = {}, validation: ValidationResult = { isValid: true, errors: null }) => {
  state.api = { ...NOTHING_LOADED, ...api };
  state.validation = validation;
  return renderToStaticMarkup(<ServiceInfoPanel />);
};

describe('ServiceInfoPanel', () => {
  it('shows what the API says about itself', () => {
    const html = render({ title: 'A title', description: 'A description', keywords: ['weather'] });
    expect(html).toContain('A title');
    expect(html).toContain('A description');
    expect(html).toContain('weather');
  });

  it('leaves out what the API left out', () => {
    const html = render();
    expect(html).not.toContain('Conformance Classes');
    expect(html).not.toContain('Service Links');
  });

  it('counts the conformance classes it can name, once each', () => {
    const core = 'http://www.opengis.net/spec/ogcapi-edr-1/1.1/conf/core';
    expect(render({ conformsTo: [core, core, 'http://example.com/not-ogc'] })).toContain('Conformance Classes (1)');
  });

  it('counts the links', () => {
    const links = [{ href: 'https://a.example/', rel: 'self' }, { href: 'https://a.example/x', rel: 'data' }];
    expect(render({ links })).toContain('Service Links (2)');
  });
});
