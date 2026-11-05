import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CopyMenu from './CopyMenu';

const button = (url: string) => renderToStaticMarkup(<CopyMenu url={url} />).match(/<button[^>]*>/)?.[0] ?? '';

describe('CopyMenu', () => {
  it('offers to copy a request', () => {
    const tag = button('https://api.test/x');
    expect(tag).toContain('aria-label="Copy the request"');
    expect(tag).toContain('aria-haspopup="menu"');
    expect(tag).not.toMatch(/ disabled/);
  });

  it("has nothing to copy without one we'd send", () => {
    expect(button('')).toMatch(/ disabled/);
    expect(button('/collections/c')).toMatch(/ disabled/);
  });
});
