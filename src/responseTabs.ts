import type { ValidationError } from './types/api';

export type ResponseTab = 'data' | 'raw' | 'headers' | 'sizes' | 'checks';

// The ways to read a response. Data only if there's a view of the data, and Raw only if there's text
// to show or none at all to say so: an image has no text. A stored response or a failure with no
// response has no tabs, since there's only its text, if that.
export function responseTabs({ hasResponse, hasDataView, hasImage }: { hasResponse: boolean; hasDataView: boolean; hasImage: boolean }): ResponseTab[] {
  if (!hasResponse) return [];
  return [
    ...(hasDataView ? ['data' as const] : []),
    ...(hasImage ? [] : ['raw' as const]),
    'headers', 'sizes', 'checks',
  ];
}

// The tab asked for, if this response has it: it's still asked for, for a later response that does.
export function shownTab(preferred: ResponseTab | null, tabs: ResponseTab[]): ResponseTab {
  if (preferred && tabs.includes(preferred)) return preferred;
  return tabs[0] ?? 'raw';
}

const WORST_FIRST = [
  { severity: 'error', noun: 'error', color: 'error' },
  { severity: 'warning', noun: 'issue', color: 'warning' },
  { severity: 'info', noun: 'note', color: 'info' },
] as const;

// What the Checks tab says on it: how many of the worst kind of finding there are
export function checksCount(findings: Pick<ValidationError, 'severity'>[]): { label: string; color: 'error' | 'warning' | 'info' } | null {
  for (const { severity, noun, color } of WORST_FIRST) {
    const count = findings.filter(finding => (finding.severity ?? 'error') === severity).length;
    if (count > 0) return { label: `${count} ${noun}${count === 1 ? '' : 's'}`, color };
  }
  return null;
}
