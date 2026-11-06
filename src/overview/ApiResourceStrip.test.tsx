import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ApiResourceStrip from './ApiResourceStrip';
import type { CapturedResponse } from '../api/capture';

const API = 'https://a.example/edr';
const answer = (path: string, status = 200): CapturedResponse => ({
  url: `${API}${path}?f=json`,
  response: { status, statusText: '', timeMs: 76, sizeBytes: 1126, headers: [], contentType: 'application/json', requestUrlBytes: 10, timing: null },
  text: '{"real":"text"}',
  failure: null,
});

const state = vi.hoisted(() => ({
  status: 'done',
  captured: {} as Record<string, unknown>,
  validation: { isValid: true, errors: null } as Record<string, unknown>,
  clicks: {} as Record<string, () => void>,
}));
vi.mock('../contexts/ApiContext', () => ({ useApi: () => ({ apiUrl: 'https://a.example/edr', status: state.status, captured: state.captured, conformsTo: ['a', 'b'] }) }));
vi.mock('../contexts/CollectionContext', () => ({ useCollection: () => ({ collections: [{}, {}, {}] }) }));
vi.mock('../contexts/OpenApiContext', () => ({ useOpenApi: () => ({ status: 'none', url: null, description: null, captured: null }) }));
vi.mock('../contexts/ValidationContext', () => ({ useValidation: () => ({ validationResult: state.validation }) }));
// As it is, but keeping what pressing it does, which the server renderer leaves out
vi.mock('@mui/material/ButtonBase', async importOriginal => {
  const { default: ButtonBase } = await importOriginal<typeof import('@mui/material/ButtonBase')>();
  return {
    default: (props: { onClick: () => void; children: unknown }) => {
      const flat = JSON.stringify(props.children, (key, value) => (key === '_owner' ? undefined : value)) ?? '';
      const name = ['Landing page', 'Conformance', 'OpenAPI', 'Collections'].find(candidate => flat.includes(candidate));
      if (name) state.clicks[name] = props.onClick;
      return <ButtonBase {...(props as object)} />;
    },
  };
});

describe('ApiResourceStrip', () => {
  const sent: CustomEvent[] = [];
  beforeEach(() => {
    state.status = 'done';
    state.captured = { landingPage: answer(''), conformance: answer('/conformance'), collections: answer('/collections') };
    state.validation = { isValid: true, errors: null };
    state.clicks = {};
    sent.length = 0;
    vi.stubGlobal('document', { dispatchEvent: (event: CustomEvent) => { sent.push(event); return true; } });
    vi.stubGlobal('CustomEvent', class { type: string; detail: unknown; constructor(type: string, init: { detail: unknown }) { this.type = type; this.detail = init.detail; } });
  });
  afterEach(() => vi.unstubAllGlobals());

  const render = () => renderToStaticMarkup(<ApiResourceStrip />);

  it('is named for screen readers', () => {
    expect(render()).toContain('aria-label="The API&#x27;s resources"');
  });

  it('shows each resource with its path and figures', () => {
    const html = render();
    expect(html).toContain('Landing page');
    expect(html).toContain('>/<');
    expect(html).toContain('>/conformance<');
    expect(html).toContain('>/collections<');
    expect(html).toContain('>200<');
    const flat = html.replace(/<style[^>]*>.*?<\/style>/g, '').replace(/<[^>]+>/g, '');
    expect(flat).toContain('200 · 76 ms · 1.1 KB');
    expect(flat).toContain('200 · 76 ms · 2 classes');
    expect(flat).toContain('200 · 76 ms · 3 · 0 issues');
  });

  it('keeps each figure whole when the line wraps', () => {
    // A rule of its own: the path has this as well, along with its ellipsis
    expect(render()).toContain('{white-space:nowrap;}');
  });

  it('colours a status by whether it succeeded', () => {
    state.captured = { landingPage: answer('', 500) };
    expect(render()).toContain('>500<');
  });

  it('says how the list stands even with no issues, and the others only with some', () => {
    expect(render().match(/0 issues/g)).toHaveLength(1);
    state.validation = { isValid: false, errors: [{ message: 'x', section: 'Landing Page' }, { message: 'y', section: 'Conformance' }, { message: 'z', section: 'Conformance' }] };
    const html = render();
    expect(html).toContain('1 issue<');
    expect(html).toContain('2 issues<');
    expect(html).toContain('0 issues<');
  });

  it('says nothing of issues where no response came, not even for the list', () => {
    const none = (path: string) => ({ url: `${API}${path}`, response: null, text: null, failure: 'Network error.' });
    state.captured = { landingPage: answer(''), collections: none('/collections') };
    const html = render();
    expect(html).toContain('no response');
    expect(html).not.toContain('issue');
  });

  it('has nothing to press while loading', () => {
    state.status = 'loading';
    state.captured = {};
    const html = render();
    expect(html.match(/disabled=""/g)).toHaveLength(4);
    expect(html).toContain('loading');
  });

  it('has nothing to press for what was not asked for', () => {
    state.captured = { landingPage: answer('', 404) };
    const html = render();
    expect(html.match(/not requested/g)).toHaveLength(3);
    expect(html.match(/disabled=""/g)).toHaveLength(3);
  });

  it('opens what really came back, with what was found in it', () => {
    state.validation = { isValid: false, errors: [{ message: 'x', section: 'Collections' }], collectionsValidation: { isValid: false, errors: null, schemaResults: [{ schema: 'EDR', isValid: false }] } };
    render();
    state.clicks.Collections();
    expect(sent).toHaveLength(1);
    expect(sent[0].type).toBe('open-validation-response');
    expect(sent[0].detail).toEqual({
      url: `${API}/collections?f=json`,
      data: '{"real":"text"}',
      response: (state.captured.collections as CapturedResponse).response,
      failure: null,
      errors: [{ message: 'x', section: 'Collections' }],
      schemaName: 'EDR',
    });
  });

  it('opens what went wrong when no response came', () => {
    state.captured = { landingPage: { url: `${API}?f=json`, response: null, text: null, failure: 'Network error.' } };
    render();
    state.clicks['Landing page']();
    expect(sent[0].detail).toMatchObject({ url: `${API}?f=json`, data: null, response: null, failure: 'Network error.' });
  });

  it('opens nothing where there is nothing', () => {
    state.captured = { landingPage: answer('') };
    render();
    state.clicks.OpenAPI();
    expect(sent).toHaveLength(0);
  });
});
