import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RequestUrlField from './RequestUrlField';
import { RequestUrlContext } from './contexts/RequestUrlContext';

const render = (requestUrl: string, isEdited = false) => renderToStaticMarkup(
  <RequestUrlContext.Provider value={{ requestUrl, isEdited, editUrl: () => {}, discardEdits: () => {} }}>
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
      <RequestUrlContext.Provider value={{ requestUrl, isEdited, editUrl: () => {}, discardEdits: () => {} }}>
        <RequestUrlField onSend={() => {}} compact />
      </RequestUrlContext.Provider>,
    );

    it('shows the part that matters, with the full URL still there to edit', () => {
      const html = compact(URL_TEXT);
      expect(html).toContain('>…/c/position?coords=POINT(1 2)</div>');
      expect(html).toContain(`>${URL_TEXT}</textarea>`);
    });

    it('says what to do when there is no request yet', () => {
      expect(compact('')).toContain('>Select a collection and query, or paste a request URL</div>');
    });

    it('keeps the short form out of the way of a tap and of a screen reader', () => {
      const html = compact(URL_TEXT);
      const shortForm = html.match(/<div[^>]*aria-hidden="true"[^>]*>/)?.[0].match(/css-[a-z0-9]+/)?.[0];
      expect(shortForm).toBeTruthy();
      expect(html).toMatch(new RegExp(`\\.${shortForm}\\{[^}]*pointer-events:none`));
    });

    it('leaves room for the way back when edited', () => {
      expect(compact(URL_TEXT, true)).toContain('right:40px');
      expect(compact(URL_TEXT)).toContain('right:8px');
    });

    it('hides the field\'s own text at rest, so it isn\'t shown twice', () => {
      const hidden = /textarea\{[^}]*color:transparent/;
      expect(compact(URL_TEXT)).toMatch(hidden);
      expect(render(URL_TEXT)).not.toMatch(hidden);
    });
  });

  it('opens downwards from a bar at the top, upwards from one at the bottom', () => {
    const at = (expandUp: boolean) => renderToStaticMarkup(
      <RequestUrlContext.Provider value={{ requestUrl: URL_TEXT, isEdited: false, editUrl: () => {}, discardEdits: () => {} }}>
        <RequestUrlField onSend={() => {}} expandUp={expandUp} />
      </RequestUrlContext.Provider>,
    );
    expect(at(false)).toContain('position:absolute;left:0;right:0;top:0');
    expect(at(true)).toContain('position:absolute;left:0;right:0;bottom:0');
  });
});
