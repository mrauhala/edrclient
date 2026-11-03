import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import FetchErrorAlert from './FetchErrorAlert';

const RATE_LIMITED = 'Rate limited (429): Server is busy. Please try again later.';

describe('FetchErrorAlert', () => {
  it('shows the error with a Try again button when the request can be retried', () => {
    const html = renderToStaticMarkup(<FetchErrorAlert message={RATE_LIMITED} onRetry={() => {}} />);
    expect(html).toContain(RATE_LIMITED);
    expect(html).toMatch(/<button[^>]*>.*Try again<\/button>/);
  });

  it('shows only the error when retrying would not help', () => {
    const html = renderToStaticMarkup(<FetchErrorAlert message="Not found (404): The query returned no stations." />);
    expect(html).toContain('The query returned no stations.');
    expect(html).not.toContain('Try again');
    expect(html).not.toContain('<button');
  });
});
