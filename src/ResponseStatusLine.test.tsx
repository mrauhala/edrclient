import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createTheme } from '@mui/material/styles';
import ResponseStatusLine from './ResponseStatusLine';
import type { ResponseDetails } from './api/sendRequest';

const OK: ResponseDetails = {
  status: 200,
  statusText: 'OK',
  timeMs: 2230,
  sizeBytes: 7600,
  headers: [],
  contentType: 'application/vnd.cov+json',
};

const text = (html: string) => html.replace(/<style[^>]*>.*?<\/style>/g, '').replace(/<[^>]+>/g, '');

describe('ResponseStatusLine', () => {
  it('shows the status, time, size and content type', () => {
    const html = renderToStaticMarkup(<ResponseStatusLine response={OK} />);
    expect(text(html)).toBe('200 OK · 2.23 s · 7.6 KB · application/vnd.cov+json');
  });

  it('shows only the number when the server gives no reason phrase, as over HTTP/2', () => {
    const html = renderToStaticMarkup(<ResponseStatusLine response={{ ...OK, statusText: '' }} />);
    expect(text(html)).toBe('200 · 2.23 s · 7.6 KB · application/vnd.cov+json');
  });

  it('leaves out a missing content type', () => {
    const html = renderToStaticMarkup(<ResponseStatusLine response={{ ...OK, contentType: '' }} />);
    expect(text(html)).toBe('200 OK · 2.23 s · 7.6 KB');
  });

  it('colours a success and a failure', () => {
    const { success, error } = createTheme().palette;
    const ok = renderToStaticMarkup(<ResponseStatusLine response={OK} />);
    expect(ok).toContain(`color:${success.main}`);
    expect(ok).not.toContain(`color:${error.main}`);

    const failed = renderToStaticMarkup(<ResponseStatusLine response={{ ...OK, status: 400, statusText: 'Bad Request' }} />);
    expect(failed).toContain(`color:${error.main}`);
    expect(failed).not.toContain(`color:${success.main}`);
  });
});
