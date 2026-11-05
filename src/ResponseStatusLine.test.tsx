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
  requestUrlBytes: 50,
  timing: null,
};

describe('ResponseStatusLine', () => {
  it('shows the status, time, size and content type', () => {
    const html = renderToStaticMarkup(<ResponseStatusLine response={OK} />);
    expect(html).toContain('>200 OK</span> · 2.23 s · 7.6 KB · application/vnd.cov+json</span>');
  });

  it('shows only the number when the server gives no reason phrase, as over HTTP/2', () => {
    const html = renderToStaticMarkup(<ResponseStatusLine response={{ ...OK, statusText: '' }} />);
    expect(html).toContain('>200</span> · 2.23 s · 7.6 KB · application/vnd.cov+json</span>');
  });

  it('leaves out a missing content type', () => {
    const html = renderToStaticMarkup(<ResponseStatusLine response={{ ...OK, contentType: '' }} />);
    expect(html).toContain('>200 OK</span> · 2.23 s · 7.6 KB</span>');
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
