import type { ComponentProps } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ResponsePane from './ResponsePane';
import type { ResponseDetails } from './api/sendRequest';

const URL_ = 'https://api.example.com/collections/a/position';
const OK: ResponseDetails = {
  status: 200,
  statusText: 'OK',
  timeMs: 2230,
  sizeBytes: 11,
  headers: [{ name: 'content-type', value: 'text/plain' }, { name: 'x-a', value: '1' }],
  contentType: 'text/plain',
};
const BAD_REQUEST: ResponseDetails = { ...OK, status: 400, statusText: 'Bad Request' };

const render = (props: Partial<ComponentProps<typeof ResponsePane>>) => renderToStaticMarkup(
  <ResponsePane open onClose={() => {}} url={URL_} data={null} contentType={null} isLoading={false} error={null} {...props} />,
);

describe('ResponsePane', () => {
  it('says what to do before anything has been sent', () => {
    const html = render({ url: '' });
    expect(html).toContain('Nothing sent yet');
    expect(html).not.toContain('Copy URL');
    expect(html).toContain('aria-label="Close the response pane"');
  });

  it('shows the URL that was sent, with a way to copy it', () => {
    const html = render({ data: 'hello world', contentType: 'text/plain', response: OK });
    expect(html).toContain(`>${URL_}<`);
    expect(html).toContain('aria-label="Copy URL"');
    expect(html).not.toContain('Nothing sent yet');
  });

  it('shows a response with its status line, and Body and Headers tabs', () => {
    const html = render({ data: 'hello world', contentType: 'text/plain', response: OK });
    expect(html).toContain('200 OK');
    expect(html).toContain('2.23 s');
    expect(html).toContain('>Body<');
    expect(html).toContain('>Headers (2)<');
    expect(html).toContain('hello world');
    expect(html).not.toContain('Content-Type:');
  });

  it("shows a failure's message and the body the server sent", () => {
    const html = render({ data: 'unknown parameter', contentType: 'text/plain', response: BAD_REQUEST, error: 'The server rejected the request (400).' });
    expect(html).toContain('400 Bad Request');
    expect(html).toContain('The server rejected the request (400).');
    expect(html).toContain('unknown parameter');
    expect(html).toContain('>Headers (2)<');
  });

  it('says so when a response has no body', () => {
    const html = render({ data: '', contentType: 'text/plain', response: { ...OK, sizeBytes: 0 } });
    expect(html).toContain('The response has no body.');
  });

  it("doesn't call an image a missing body", () => {
    const html = render({ imageUrl: 'blob:abc', contentType: 'image/png', response: { ...OK, contentType: 'image/png' } });
    expect(html).toContain('blob:abc');
    expect(html).not.toContain('The response has no body.');
  });

  it('shows an image the server sent with a failure', () => {
    const html = render({ imageUrl: 'blob:abc', contentType: 'image/png', response: BAD_REQUEST, error: 'The server rejected the request (400).' });
    expect(html).toContain('The server rejected the request (400).');
    expect(html).toContain('blob:abc');
  });

  it('shows only the message when no response came', () => {
    const html = render({ error: 'Network error.' });
    expect(html).toContain('Network error.');
    expect(html).not.toContain('>Body<');
    expect(html).not.toContain('The response has no body.');
  });

  it('shows a stored response without a status line or tabs', () => {
    const html = render({ data: 'stored', contentType: 'text/plain' });
    expect(html).toContain('Content-Type: text/plain');
    expect(html).toContain('stored');
    expect(html).not.toContain('>Body<');
  });

  it('shows neither tabs nor a body while loading', () => {
    const html = render({ isLoading: true, response: OK, data: 'hello world', contentType: 'text/plain' });
    expect(html).not.toContain('>Body<');
    expect(html).not.toContain('hello world');
  });
});
