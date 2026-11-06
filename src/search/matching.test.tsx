import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Collection } from '../types/api';
import { highlightMatch, matchCollection } from './matching';
import type { FilterField } from './types';

const ALL = new Set<FilterField>(['title', 'description', 'keywords', 'id']);
const collection = (overrides: Record<string, unknown>) => overrides as unknown as Collection;

describe('matchCollection', () => {
  it.each([
    ['title', { title: 'Sea level' }],
    ['description', { description: 'The sea level' }],
    ['id', { id: 'sea-level' }],
  ])('finds text in the %s, in any case', (_field, fields) => {
    expect(matchCollection(collection(fields), 'SEA', ALL).matches).toBe(true);
  });

  it('names the keywords that matched', () => {
    expect(matchCollection(collection({ keywords: ['sea', 'level', 'seabed'] }), 'sea', ALL)).toEqual({ matches: true, matchedKeywords: ['sea', 'seabed'] });
  });

  it('only looks where the filters say', () => {
    expect(matchCollection(collection({ title: 'sea', id: 'land' }), 'sea', new Set<FilterField>(['id'])).matches).toBe(false);
  });

  it('finds nothing where there is nothing', () => {
    expect(matchCollection(collection({ title: 'land' }), 'sea', ALL)).toEqual({ matches: false, matchedKeywords: [] });
  });

  describe("an API's data as it comes, whatever the schema says", () => {
    it('finds a numeric ID', () => {
      expect(matchCollection(collection({ id: 42 }), '42', ALL).matches).toBe(true);
    });

    it('survives a missing ID, title and description', () => {
      expect(matchCollection(collection({}), 'sea', ALL).matches).toBe(false);
    });

    it('survives keywords that are not text, or not a list', () => {
      expect(matchCollection(collection({ keywords: [1, null, 'sea'] }), 'sea', ALL).matchedKeywords).toEqual(['sea']);
      // Not letter by letter
      expect(matchCollection(collection({ keywords: 'sea' }), 's', ALL).matches).toBe(false);
    });

    it('survives a title that is not text', () => {
      expect(matchCollection(collection({ title: { en: 'sea' } }), 'zzz', ALL).matches).toBe(false);
    });
  });
});

describe('highlightMatch', () => {
  const html = (text: unknown, query: string) => renderToStaticMarkup(<>{highlightMatch(text as string, query)}</>);

  it('marks the match', () => {
    expect(html('Sea level', 'sea')).toMatch(/<mark[^>]*>Sea<\/mark> level/);
  });

  it('leaves text with no match or no query', () => {
    expect(html('Sea', 'land')).toBe('Sea');
    expect(html('Sea', '')).toBe('Sea');
  });

  it('copes with a number or nothing', () => {
    expect(html(42, '4')).toMatch(/<mark[^>]*>4<\/mark>2/);
    expect(html(undefined, 'x')).toBe('');
    expect(html(42, '')).toBe('42');
  });
});
