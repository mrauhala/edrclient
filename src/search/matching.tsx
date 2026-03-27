import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import type { Collection } from '../types/api';
import type { FilterField, ItemResult } from './types';

export function highlightMatch(text: string, query: string): ReactNode {
  if (!query) return text;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <Box component="mark" sx={{ bgcolor: 'warning.light', color: 'warning.contrastText', px: '1px', borderRadius: 0.5, fontWeight: 500 }}>
        {text.slice(idx, idx + query.length)}
      </Box>
      {text.slice(idx + query.length)}
    </>
  );
}

export function matchCollection(c: Collection, query: string, filters: Set<FilterField>): { matches: boolean; matchedKeywords: string[] } {
  const lq = query.toLowerCase();
  const matchedKeywords: string[] = [];

  if (filters.has('title') && c.title?.toLowerCase().includes(lq)) {
    return { matches: true, matchedKeywords };
  }
  if (filters.has('description') && c.description?.toLowerCase().includes(lq)) {
    return { matches: true, matchedKeywords };
  }
  if (filters.has('keywords') && c.keywords) {
    for (const kw of c.keywords) {
      if (kw.toLowerCase().includes(lq)) {
        matchedKeywords.push(kw);
      }
    }
    if (matchedKeywords.length > 0) {
      return { matches: true, matchedKeywords };
    }
  }
  if (filters.has('id') && c.id.toLowerCase().includes(lq)) {
    return { matches: true, matchedKeywords };
  }
  return { matches: false, matchedKeywords: [] };
}

export function matchService(s: { label: string; url: string }, query: string): boolean {
  const lq = query.toLowerCase();
  return s.label.toLowerCase().includes(lq) || s.url.toLowerCase().includes(lq);
}

export function matchItem(item: ItemResult, query: string): boolean {
  const lq = query.toLowerCase();
  if (item.displayName.toLowerCase().includes(lq)) return true;
  if (item.geometryType.toLowerCase().includes(lq)) return true;
  if (item.feature.properties) {
    for (const val of Object.values(item.feature.properties)) {
      if (typeof val === 'string' && val.toLowerCase().includes(lq)) return true;
    }
  }
  if (item.feature.id != null && String(item.feature.id).toLowerCase().includes(lq)) return true;
  return false;
}

export function getPropertyPreview(properties: Record<string, unknown> | undefined): string {
  if (!properties) return '';
  const skip = new Set(['name', 'title', 'description']);
  const parts: string[] = [];
  for (const [key, val] of Object.entries(properties)) {
    if (skip.has(key) || val == null || typeof val === 'object') continue;
    parts.push(`${key}: ${String(val)}`);
    if (parts.length >= 2) break;
  }
  return parts.join(' \u00b7 ');
}
