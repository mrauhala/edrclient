import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import FetchButton, { QueryProblems } from './FetchButton';
import { summarizeIssues } from './query/validateQuery';
import type { QueryIssue } from './query/types';

const issue = (severity: QueryIssue['severity'], message: string): QueryIssue => ({ id: message, severity, source: 'edr', field: 'coords', message });
const missing = issue('missing', 'Click a point on the map');
const wrong = issue('error', 'The radius must be greater than 0');
const warned = issue('warning', 'Point 1 is outside the extent');

// MUI's stylesheet in the output names the class either way, so look at the badge's own classes
const hiddenBadge = /class="[^"]*MuiBadge-badge[^"]*MuiBadge-invisible/;

const render = (issues: QueryIssue[]) => renderToStaticMarkup(<FetchButton issues={issues} summary={summarizeIssues(issues)} onFetch={() => {}} />);

describe('FetchButton', () => {
  it('is a plain button for a complete query', () => {
    const html = render([]);
    expect(html).toContain('Fetch');
    expect(html).toContain('MuiButton-colorPrimary');
    expect(html).toContain('CloudDownloadIcon');
    expect(html).toMatch(hiddenBadge);
  });

  it('warns about a query with problems, and counts them', () => {
    const html = render([missing, wrong, warned]);
    expect(html).toContain('MuiButton-colorWarning');
    expect(html).toContain('WarningAmberIcon');
    expect(html).not.toMatch(hiddenBadge);
    expect(html).toMatch(/MuiBadge-badge[^>]*>2</);
  });

  it('does not count warnings, which leave the query complete', () => {
    const html = render([warned]);
    expect(html).toContain('MuiButton-colorPrimary');
    expect(html).toMatch(hiddenBadge);
  });

  it('keeps its problems out of the way until asked', () => {
    expect(render([missing])).not.toContain('Click a point on the map');
  });
});

describe('QueryProblems', () => {
  const problemsHtml = (issues: QueryIssue[]) => renderToStaticMarkup(<QueryProblems titleId="title" issues={issues} summary={summarizeIssues(issues)} onFetch={() => {}} />);

  it('lists every problem, more than the tooltip has room for, with a way to send anyway', () => {
    const problems = ['one', 'two', 'three', 'four', 'five'].map(message => issue('missing', message));
    const html = problemsHtml(problems);
    for (const problem of problems) expect(html).toContain(`<li>${problem.message}</li>`);
    expect(html).toMatch(/<button[^>]*>Fetch anyway/);
  });

  it('calls a query lacking something incomplete, even with errors too', () => {
    expect(problemsHtml([missing, wrong])).toMatch(/id="title"[^>]*>Query incomplete</);
  });

  it('calls a query with only errors one with problems', () => {
    const html = problemsHtml([wrong]);
    expect(html).toMatch(/id="title"[^>]*>Query has problems</);
    expect(html).toContain(`<li>${wrong.message}</li>`);
  });

  it('leaves out warnings, which do not stop a query', () => {
    expect(problemsHtml([missing, warned])).not.toContain(warned.message);
  });
});
