import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CollectionsList from './CollectionsList';
import type { Collection, ValidationResult } from './types/api';

const state = vi.hoisted(() => ({
  api: {} as Record<string, unknown>,
  collections: [] as unknown[],
  selected: null as unknown,
  validation: {} as unknown,
}));
vi.mock('./contexts/ApiContext', () => ({ useApi: () => state.api }));
vi.mock('./contexts/CollectionContext', () => ({
  useCollection: () => ({ collections: state.collections, selectedCollection: state.selected }),
}));
vi.mock('./contexts/ValidationContext', () => ({ useValidation: () => ({ validationResult: state.validation }) }));
vi.mock('./contexts/OpenCollectionContext', () => ({ useOpenCollection: () => ({ openCollection: () => {}, closeCollection: () => {} }) }));
vi.mock('./contexts/PanesContext', () => ({ usePanes: () => ({ showPane: () => {} }) }));

const collection = { id: 'one', title: 'First collection', links: [] } as unknown as Collection;

function render(validation: ValidationResult = { isValid: true, errors: null }) {
  state.validation = validation;
  return renderToStaticMarkup(<CollectionsList />);
}

describe('CollectionsList', () => {
  beforeEach(() => {
    state.api = { apiUrl: 'https://a.example', status: 'done', license: null };
    state.collections = [];
    state.selected = null;
  });

  it('says so while loading, and nothing else', () => {
    state.api.status = 'loading';
    const html = render({ isValid: false, errors: [{ message: 'From before' }] });
    expect(html).toContain('Loading collections...');
    expect(html).not.toContain('From before');
    expect(html).not.toContain('No collections found');
  });

  it('counts the collections and lists them', () => {
    state.collections = [collection];
    const html = render();
    expect(html).toContain('Found 1 collections');
    expect(html).toContain('First collection');
  });

  it('keeps long descriptions short on the row', () => {
    state.collections = [{ ...collection, description: 'What it holds' }];
    expect(render()).toContain('-webkit-line-clamp:6');
  });

  it('says when an API has none', () => {
    expect(render()).toContain('No collections found from this endpoint.');
  });

  it('shows why a load failed instead', () => {
    const html = render({ isValid: false, errors: [{ title: 'Server said no', message: 'A 500', section: 'collections' }] });
    expect(html).toContain('Server said no');
    expect(html).toContain('A 500');
    expect(html).not.toContain('No collections found');
  });

  it('adds what can be done about CORS', () => {
    expect(render({ isValid: false, errors: [{ message: 'Blocked', type: 'cors' }] })).toContain('Possible solutions:');
  });

  it("doesn't take a conformance or data link problem for a failed load, and shows each", () => {
    const html = render({
      isValid: false,
      errors: [
        { message: 'No conformance', section: 'conformance', title: 'Conformance Unavailable' },
        { message: 'Odd link', section: 'data link', title: 'Collections Link Issue' },
      ],
    });
    expect(html).toContain('No collections found');
    expect(html).toContain('No conformance');
    expect(html).toContain('Odd link');
  });

  it('shows a conformance problem once, next to a failed load', () => {
    const html = render({
      isValid: false,
      errors: [
        { message: 'A 500', section: 'collections' },
        { message: 'No conformance', section: 'conformance' },
      ],
    });
    expect(html).toContain('A 500');
    expect(html.split('No conformance').length - 1).toBe(1);
  });

  it('offers Close only on the open one, and marks it as open', () => {
    const other = { id: 'two', title: 'Second collection', links: [] } as unknown as Collection;
    state.collections = [collection, other];

    // In a class: the styles mention it for every row
    const selectedRows = (html: string) => [...html.matchAll(/class="[^"]*Mui-selected[^"]*"/g)];

    expect(render()).not.toContain('>Close<');
    expect(selectedRows(render())).toHaveLength(0);

    state.selected = other;
    const html = render();
    expect(html.split('>Close<').length - 1).toBe(1);
    expect(html.indexOf('>Close<')).toBeGreaterThan(html.indexOf('Second collection'));
    const selected = selectedRows(html);
    expect(selected).toHaveLength(1);
    expect(selected[0].index).toBeGreaterThan(html.indexOf('First collection'));
  });

  it('shows the same row whether or not it is open, with no form in it', () => {
    state.collections = [collection];
    state.selected = collection;
    const html = render();
    expect(html).toContain('First collection');
    expect(html).not.toContain('Show Validation');
    expect(html).not.toContain('Data Query');
  });

  it("falls back on the API's licence for a collection without one", () => {
    state.collections = [collection];
    expect(render()).not.toContain('CC BY 4.0');
    state.api.license = { label: 'CC BY 4.0', href: 'https://creativecommons.org/licenses/by/4.0/' };
    expect(render()).toContain('CC BY 4.0');
  });
});
