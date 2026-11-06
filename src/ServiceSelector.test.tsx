import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ServiceSelector from './ServiceSelector';

const state = vi.hoisted(() => ({
  api: {} as Record<string, unknown>,
  service: {} as Record<string, unknown>,
}));
vi.mock('./contexts/ApiContext', () => ({ useApi: () => state.api }));
vi.mock('./contexts/ServiceContext', () => ({ useService: () => state.service }));

const FMI = 'https://opendata.fmi.fi/edr';
const OTHER = 'https://other.example/api';

const render = () => renderToStaticMarkup(<ServiceSelector />);
const urlField = (html: string) => /<input[^>]*id="apiUrl"[^>]*>/.exec(html)?.[0] ?? '';
const validate = (html: string) => /<button[^>]*>(Loading\.\.\.|Validate)/.exec(html)?.[0] ?? '';

describe('ServiceSelector', () => {
  beforeEach(() => {
    state.api = { apiUrl: FMI, status: 'done', title: null, loadApi: () => {}, reloadApi: () => {} };
    state.service = { customServices: [], serviceDescUrl: null };
  });

  it('shows the API loaded, by name if it is listed', () => {
    const html = render();
    expect(urlField(html)).toContain(`value="${FMI}"`);
    expect(html).toContain('FMI Open Data');
  });

  it('names no service for an API that is not listed', () => {
    state.api.apiUrl = OTHER;
    const html = render();
    expect(urlField(html)).toContain(`value="${OTHER}"`);
    expect(html).not.toContain('FMI Open Data');
  });

  it('knows a saved service by its name', () => {
    state.api.apiUrl = OTHER;
    state.service.customServices = [{ id: '1', name: 'Mine', url: OTHER }];
    const html = render();
    expect(html).toContain('<span>Mine</span>');
  });

  it('holds Validate back while loading', () => {
    const done = validate(render());
    expect(done).toContain('Validate');
    expect(done).not.toContain('disabled');

    state.api.status = 'loading';
    const loading = validate(render());
    expect(loading).toContain('Loading...');
    expect(loading).toContain('disabled');
  });

  it('offers the API docs only if there are any', () => {
    expect(render()).not.toContain('View API Docs');
    state.service.serviceDescUrl = `${FMI}/api`;
    expect(render()).toContain('View API Docs');
  });
});
