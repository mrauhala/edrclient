import type { ComponentProps } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ResponseStatusButton from './ResponseStatusButton';
import type { ResponseDetails } from './api/sendRequest';

const OK: ResponseDetails = { status: 200, statusText: 'OK', timeMs: 2230, sizeBytes: 7600, headers: [], contentType: 'application/json' };

const render = (props: Partial<ComponentProps<typeof ResponseStatusButton>>) => renderToStaticMarkup(
  <ResponseStatusButton response={null} isLoading={false} hasError={false} onClick={() => {}} {...props} />,
);

describe('ResponseStatusButton', () => {
  it("isn't there before anything has been sent", () => {
    expect(render({})).toBe('');
  });

  it('shows how a success went', () => {
    const html = render({ response: OK });
    expect(html).toContain('200 · 2.23 s · 7.6 KB');
    expect(html).toContain('MuiButton-colorSuccess');
  });

  it('shows a failure as one', () => {
    const html = render({ response: { ...OK, status: 404 }, hasError: true });
    expect(html).toContain('404 · 2.23 s · 7.6 KB');
    expect(html).toContain('MuiButton-colorError');
  });

  it('says so when no response came', () => {
    const html = render({ hasError: true });
    expect(html).toContain('No response');
    expect(html).toContain('MuiButton-colorError');
  });

  it('shows a request on its way, even over a previous response', () => {
    const html = render({ isLoading: true, response: OK });
    expect(html).toContain('Waiting…');
    expect(html).not.toContain('200 ·');
    expect(html).not.toContain('MuiButton-colorError');
  });
});
