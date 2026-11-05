import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RequestUrlField from './RequestUrlField';
import { RequestUrlContext } from './contexts/RequestUrlContext';

const render = (requestUrl: string, isEdited = false) => renderToStaticMarkup(
  <RequestUrlContext.Provider value={{ requestUrl, isEdited, editUrl: () => {}, discardEdits: () => {}, pinUrl: () => {}, unpinUrl: () => {} }}>
    <RequestUrlField onSend={() => {}} />
  </RequestUrlContext.Provider>,
);

const URL_TEXT = 'https://api.test/edr/collections/c/position?coords=POINT(1 2)';

// MUI's stylesheet in the output names its classes and attributes too, so look at the element
const textareaOf = (html: string) => html.match(/<textarea[^>]*aria-label="Request URL"[^>]*>/)?.[0] ?? '';
const markedAsError = /class="[^"]*Mui-error/;

describe('RequestUrlField', () => {
  it('shows the request, ready to edit', () => {
    const html = render(URL_TEXT);
    expect(html).toContain('GET');
    expect(html).toContain('aria-label="Request URL"');
    expect(html).toContain(`>${URL_TEXT}</textarea>`);
    expect(textareaOf(html)).not.toMatch(/readonly/i);
  });

  it('is one line at rest', () => {
    expect(textareaOf(render(URL_TEXT))).toContain('rows="1"');
  });

  it('leaves autocorrect out of it', () => {
    const textarea = textareaOf(render(URL_TEXT));
    expect(textarea).toMatch(/spellcheck="false"/i);
    expect(textarea).toMatch(/autocapitalize="off"/i);
    expect(textarea).toMatch(/autocorrect="off"/i);
  });

  it('says what to do when there is no request yet', () => {
    const html = render('');
    expect(html).toContain('placeholder="Select a collection and query, or paste a request URL"');
    expect(html).not.toContain('starts with http');
    expect(html).not.toMatch(markedAsError);
  });

  it('offers a way back only once edited', () => {
    expect(render(URL_TEXT)).not.toContain('Discard URL edits');
    expect(render(URL_TEXT, true)).toContain('aria-label="Discard URL edits"');
  });

  it('explains a URL it would refuse to send', () => {
    const html = render('/collections/c/position', true);
    expect(html).toContain('A request URL starts with http:// or https://');
    expect(html).toMatch(markedAsError);
  });

  it("doesn't count blanks as a URL to refuse", () => {
    expect(render('   ', true)).not.toContain('starts with http');
  });

  describe('with little room', () => {
    const compact = (requestUrl: string, isEdited = false) => renderToStaticMarkup(
      <RequestUrlContext.Provider value={{ requestUrl, isEdited, editUrl: () => {}, discardEdits: () => {}, pinUrl: () => {}, unpinUrl: () => {} }}>
        <RequestUrlField onSend={() => {}} compact />
      </RequestUrlContext.Provider>,
    );

    it('shows the part that matters, with the full URL still there to edit', () => {
      const html = compact(URL_TEXT);
      expect(html).toContain('<span class="url-path">…/c/position</span>');
      expect(html).toContain('<span class="url-value">POINT(1 2)</span>');
      expect(html).toContain(`>${URL_TEXT}</textarea>`);
    });

    it('says what to do when there is no request yet', () => {
      expect(compact('')).toContain('>Select a collection and query, or paste a request URL</div>');
    });

    it('keeps the short form out of the way of a tap and of a screen reader', () => {
      const html = compact(URL_TEXT);
      const tag = html.match(/<div[^>]*data-url-short[^>]*>/)?.[0] ?? '';
      expect(tag).toContain('aria-hidden="true"');
      const shortForm = tag.match(/css-[a-z0-9]+/)?.[0];
      expect(shortForm).toBeTruthy();
      expect(html).toMatch(new RegExp(`\\.${shortForm}\\{[^}]*pointer-events:none`));
    });

    it('leaves room for the way back when edited', () => {
      expect(compact(URL_TEXT, true)).toContain('right:40px');
      expect(compact(URL_TEXT)).toContain('right:8px');
    });

    it('hides the field\'s own text at rest, so it isn\'t shown twice', () => {
      const hidden = (html: string) => html.match(/<div[^>]*data-url-copy[^>]*>/)?.[0].match(/css-[a-z0-9]+/)?.[0];
      const isHidden = (html: string) => new RegExp(`\\.${hidden(html)}\\{[^}]*visibility:hidden`).test(html);
      expect(isHidden(compact(URL_TEXT))).toBe(true);
      expect(isHidden(render(URL_TEXT))).toBe(false);
    });
  });

  describe('colours', () => {
    const parts = (html: string, kind: string) => [...html.matchAll(new RegExp(`<span class="url-${kind}">([^<]*)</span>`, 'g'))].map(match => match[1]);

    it('marks out the parts of the URL', () => {
      const html = render(URL_TEXT);
      expect(parts(html, 'base')).toEqual(['https://api.test/edr']);
      expect(parts(html, 'path')).toEqual(['/collections/c/position']);
      expect(parts(html, 'name')).toEqual(['coords']);
      expect(parts(html, 'value')).toEqual(['POINT(1 2)']);
      expect(parts(html, 'punctuation')).toEqual(['?', '=']);
    });

    it('keeps the coloured copy away from a screen reader, which has the textarea', () => {
      expect(render(URL_TEXT)).toMatch(/<div[^>]*data-url-copy[^>]*aria-hidden="true"|<div[^>]*aria-hidden="true"[^>]*data-url-copy/);
    });

    it('has the textarea show its caret, over text of its own that is transparent', () => {
      const html = render(URL_TEXT);
      const textareaClass = textareaOf(html).match(/css-[A-Za-z0-9-]+/g)?.at(-1);
      expect(html).toMatch(new RegExp(`\\.${textareaClass}\\{[^}]*[;{]color:transparent`));
      expect(html).toMatch(new RegExp(`\\.${textareaClass}\\{[^}]*caret-color:`));
    });

    it('still shows the placeholder, which transparent text would otherwise take with it', () => {
      const html = render('');
      expect(html).toContain('placeholder="Select a collection and query, or paste a request URL"');
      expect(html).toMatch(/::placeholder\{color:[^;}]*text-secondary|::placeholder\{color:rgba|::placeholder\{color:#/);
    });
  });

  it('opens downwards from a bar at the top, upwards from one at the bottom', () => {
    const at = (expandUp: boolean) => renderToStaticMarkup(
      <RequestUrlContext.Provider value={{ requestUrl: URL_TEXT, isEdited: false, editUrl: () => {}, discardEdits: () => {}, pinUrl: () => {}, unpinUrl: () => {} }}>
        <RequestUrlField onSend={() => {}} expandUp={expandUp} />
      </RequestUrlContext.Provider>,
    );
    expect(at(false)).toContain('position:absolute;left:0;right:0;top:0');
    expect(at(true)).toContain('position:absolute;left:0;right:0;bottom:0');
  });
});
