import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import SendButton, { QueryProblems, sendShortcut, sendTooltip } from './SendButton';
import { summarizeIssues } from './query/validateQuery';
import type { QueryIssue } from './query/types';

const issue = (severity: QueryIssue['severity'], message: string): QueryIssue => ({ id: message, severity, source: 'edr', field: 'coords', message });
const missing = issue('missing', 'Click a point on the map');
const wrong = issue('error', 'The radius must be greater than 0');
const warned = issue('warning', 'Point 1 is outside the extent');

// MUI's stylesheet in the output names the class either way, so look at the badge's own classes
const hiddenBadge = /class="[^"]*MuiBadge-badge[^"]*MuiBadge-invisible/;

const render = (issues: QueryIssue[]) => renderToStaticMarkup(<SendButton issues={issues} summary={summarizeIssues(issues)} onSend={() => {}} />);

describe('SendButton', () => {
  it('is a plain button for a complete query', () => {
    const html = render([]);
    expect(html).toMatch(/<button[^>]*>Send/);
    expect(html).toContain('MuiButton-colorPrimary');
    expect(html).not.toContain('data-testid="WarningAmberIcon"');
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

  it('shows its shortcut, out of what a screen reader says', () => {
    expect(render([])).toMatch(/<span[^>]*aria-hidden="true"[^>]*>(⌘↵|Ctrl ↵)<\/span>/);
  });

  it('can only be pressed when there is something to send', () => {
    const markup = (disabled?: boolean) => renderToStaticMarkup(<SendButton issues={[]} summary={summarizeIssues([])} disabled={disabled} onSend={() => {}} />);
    expect(markup(true)).toMatch(/<button[^>]* disabled/);
    expect(markup()).not.toMatch(/<button[^>]* disabled/);
  });
});

describe('sendShortcut', () => {
  it.each(['MacIntel', 'iPhone', 'iPad'])('writes it the Apple way on %s', platform => {
    expect(sendShortcut(platform)).toBe('⌘↵');
  });

  it.each(['Win32', 'Linux x86_64', ''])('writes it with Ctrl on "%s"', platform => {
    expect(sendShortcut(platform)).toBe('Ctrl ↵');
  });
});

describe('sendTooltip', () => {
  const tip = (issues: QueryIssue[]) => renderToStaticMarkup(<>{sendTooltip(issues, summarizeIssues(issues))}</>);
  const warnings = (count: number) => Array.from({ length: count }, (_, index) => issue('warning', `warning ${index + 1}`));
  const noted = issue('info', "The API docs don't declare bogus");

  it('is plain for a complete query', () => {
    expect(tip([])).toBe('Send the request');
  });

  it('says what a warning is, since a warning is all a bad parameter gets', () => {
    const html = tip([warned]);
    expect(html).toContain('Send the request, but note:');
    expect(html).toContain(warned.message);
  });

  it('passes on a note too, like a parameter the API docs lack', () => {
    expect(tip([noted])).toContain('The API docs don&#x27;t declare bogus');
  });

  it('puts warnings before notes', () => {
    const html = tip([noted, warned]);
    expect(html.indexOf(warned.message)).toBeLessThan(html.indexOf('declare bogus'));
  });

  it('keeps a long list short', () => {
    const html = tip(warnings(5));
    expect(html).toContain('warning 3');
    expect(html).not.toContain('warning 4');
    expect(html).toContain('+2 more');
  });

  it('puts problems before warnings', () => {
    const html = tip([missing, warned]);
    expect(html).toContain('Query incomplete, send anyway:');
    expect(html).toContain(missing.message);
    expect(html).not.toContain(warned.message);
  });
});

describe('QueryProblems', () => {
  const problemsHtml = (issues: QueryIssue[]) => renderToStaticMarkup(<QueryProblems titleId="title" issues={issues} summary={summarizeIssues(issues)} onSend={() => {}} />);

  it('lists every problem, more than the tooltip has room for, with a way to send anyway', () => {
    const problems = ['one', 'two', 'three', 'four', 'five'].map(message => issue('missing', message));
    const html = problemsHtml(problems);
    for (const problem of problems) expect(html).toContain(`<li>${problem.message}</li>`);
    expect(html).toMatch(/<button[^>]*>Send anyway/);
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
