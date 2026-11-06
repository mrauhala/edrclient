import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ProjectLinks from './ProjectLinks';
import { version } from '../package.json';

const html = renderToStaticMarkup(<ProjectLinks />);
const linkTo = (href: string) => new RegExp(`<a[^>]*href="${href}"[^>]*>`).exec(html)?.[0] ?? '';

describe('ProjectLinks', () => {
  it('links to the source, without what npm adds to the address', () => {
    expect(linkTo('https://github.com/mrauhala/ogcapi-browser')).not.toBe('');
    expect(html).toContain('Source on GitHub');
    expect(html).not.toContain('git+');
    expect(html).not.toContain('.git"');
  });

  it('links to where issues are reported', () => {
    expect(linkTo('https://github.com/mrauhala/ogcapi-browser/issues')).not.toBe('');
    expect(html).toContain('Report an issue');
  });

  it('names this version, with a link to its release', () => {
    expect(linkTo(`https://github.com/mrauhala/ogcapi-browser/releases/tag/v${version}`)).not.toBe('');
    expect(html).toContain(`>v${version}<`);
  });

  it('opens each in a new tab, telling that tab nothing about this one', () => {
    const links = html.match(/<a [^>]*>/g) ?? [];
    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link).toContain('target="_blank"');
      expect(link).toContain('rel="noopener noreferrer"');
    }
  });

  it('shows the GitHub mark beside the source link', () => {
    expect(html.indexOf('GitHubIcon')).toBeGreaterThan(-1);
    expect(html.indexOf('GitHubIcon')).toBeLessThan(html.indexOf('Source on GitHub'));
  });
});
