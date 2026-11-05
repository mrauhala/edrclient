import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CopyMenu from './CopyMenu';

const buttons = (url: string, compact = false) => [...renderToStaticMarkup(<CopyMenu url={url} compact={compact} />).matchAll(/<button[^>]*>.*?<\/button>/g)].map(match => match[0]);

describe('CopyMenu', () => {
  it('has words when there is room: a menu for copying, and sharing', () => {
    const [copyAs, share, ...rest] = buttons('https://api.test/x');
    expect(rest).toEqual([]);
    expect(copyAs).toContain('Copy as');
    expect(copyAs).toContain('aria-haspopup="menu"');
    expect(copyAs).toContain('ArrowDropDownIcon');
    expect(copyAs).not.toMatch(/<button[^>]* disabled/);
    expect(share).toContain('Share');
    expect(share).not.toContain('aria-haspopup');
    expect(share).not.toMatch(/<button[^>]* disabled/);
  });

  it('is one icon when there is not', () => {
    const [icon, ...rest] = buttons('https://api.test/x', true);
    expect(rest).toEqual([]);
    expect(icon).toContain('aria-label="Copy the request"');
    expect(icon).toContain('aria-haspopup="menu"');
    expect(icon).not.toMatch(/<button[^>]* disabled/);
  });

  it.each(['', '/collections/c'])("has nothing to copy or share for \"%s\", which it wouldn't send", url => {
    for (const button of buttons(url)) expect(button).toMatch(/<button[^>]* disabled/);
    expect(buttons(url, true)[0]).toMatch(/<button[^>]* disabled/);
  });
});
