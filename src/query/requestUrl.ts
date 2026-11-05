// A request URL as people read and edit it, and how edits made to one survive changes to the form

const readable = (text: string) => encodeURIComponent(text)
  .replace(/%2C/g, ',')
  .replace(/%3A/g, ':')
  .replace(/%2F/g, '/')
  .replace(/%20/g, ' ');

const pairOf = (name: string, value: string) => `${readable(name)}=${readable(value)}`;

// Query values show their ( ) , : / and spaces as themselves. What would change the URL's meaning
// (+ & = # %) stays encoded, and the browser sends the spaces as %20.
export function readableUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const query = [...parsed.searchParams].map(([name, value]) => pairOf(name, value)).join('&');
    const { hash } = parsed;
    parsed.search = '';
    parsed.hash = '';
    return `${parsed.href}${query ? `?${query}` : ''}${hash}`;
  } catch {
    return url;
  }
}

// Only the web's schemes: anything else, like a bare path, would be sent to the app's own host
export function isSendableUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

// The URL with its spaces encoded, safe to paste elsewhere
export function encodedUrl(url: string): string {
  try {
    return new URL(url).href;
  } catch {
    return url;
  }
}

// For where room is short: from the collection on, or else from the path on
export function shortUrl(url: string): string {
  try {
    const { pathname, search, hash } = new URL(url);
    const at = pathname.indexOf('/collections/');
    const path = at < 0 ? pathname : pathname.slice(at + '/collections'.length);
    return `…${path}${search.replace(/%20/g, ' ')}${hash}`;
  } catch {
    return url;
  }
}

export type UrlTokenKind = 'base' | 'path' | 'punctuation' | 'name' | 'value';

// A URL's text in parts, for colouring it. Works on the text as typed, however broken, since joined
// back up the parts have to be exactly that text: the field's caret sits on top of them.
export function urlTokens(text: string): { text: string; kind: UrlTokenKind }[] {
  const tokens: { text: string; kind: UrlTokenKind }[] = [];
  const add = (kind: UrlTokenKind, part: string) => {
    if (part) tokens.push({ text: part, kind });
  };
  const hashAt = text.indexOf('#');
  const beforeHash = hashAt < 0 ? text : text.slice(0, hashAt);
  const queryAt = beforeHash.indexOf('?');
  const path = queryAt < 0 ? beforeHash : beforeHash.slice(0, queryAt);

  // Where the API is, then what's being asked of it
  const originEnd = /^[a-z][a-z0-9+.-]*:\/\/[^/]*/i.exec(path)?.[0].length ?? 0;
  const collectionsAt = path.indexOf('/collections', originEnd);
  const baseEnd = collectionsAt < 0 ? originEnd : collectionsAt;
  add('base', path.slice(0, baseEnd));
  add('path', path.slice(baseEnd));

  if (queryAt >= 0) {
    add('punctuation', '?');
    beforeHash.slice(queryAt + 1).split('&').forEach((pair, index) => {
      if (index > 0) add('punctuation', '&');
      const equalsAt = pair.indexOf('=');
      if (equalsAt < 0) {
        add('name', pair);
      } else {
        add('name', pair.slice(0, equalsAt));
        add('punctuation', '=');
        add('value', pair.slice(equalsAt + 1));
      }
    });
  }
  if (hashAt >= 0) add('punctuation', text.slice(hashAt));
  return tokens;
}

function splitUrl(url: string) {
  const hashAt = url.indexOf('#');
  const hash = hashAt < 0 ? '' : url.slice(hashAt);
  const beforeHash = hashAt < 0 ? url : url.slice(0, hashAt);
  const queryAt = beforeHash.indexOf('?');
  const base = queryAt < 0 ? beforeHash : beforeHash.slice(0, queryAt);
  const query = queryAt < 0 ? '' : beforeHash.slice(queryAt + 1);
  return { base, pairs: query ? query.split('&') : [], hash };
}

function decoded(text: string): string {
  try {
    return decodeURIComponent(text.replace(/\+/g, ' '));
  } catch {
    return text;
  }
}

const nameOf = (pair: string) => decoded(pair.split('=', 1)[0]);
const valueOf = (pair: string) => decoded(pair.slice(pair.indexOf('=') + 1));
const paramsOf = (url: string) => new Map(splitUrl(url).pairs.map(pair => [nameOf(pair), valueOf(pair)]));

const NUMBER = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
const decimalsOf = (number: string) => number.split('.')[1]?.length ?? 0;

// Whether what the form built says the same as what was typed, at the form's precision: it writes
// 24.94123 as 24.941 and 24.94 as 24.940, and neither is a change worth overwriting the typed text for
function sameAsTyped(built: string, typed: string): boolean {
  const shape = (text: string) => text.replace(NUMBER, '#').replace(/\s+/g, '').toLowerCase();
  if (shape(built) !== shape(typed)) return false;
  const typedNumbers = typed.match(NUMBER) ?? [];
  return (built.match(NUMBER) ?? []).every((number, i) => {
    const decimals = decimalsOf(number);
    return Number(number).toFixed(decimals) === Number(typedNumbers[i]).toFixed(decimals);
  });
}

// The edited URL after the form went from building prevBuilt to nextBuilt: only the parameters the
// form changed are written in, as text, so what was typed keeps its encoding and order. Another
// query or collection starts again from the form (null: no edits left), unless the form went there
// because the URL says so.
export function mergeEditedUrl(prevBuilt: string, nextBuilt: string, edited: string): string | null {
  if (!edited.trim()) return null;
  const { base, hash, pairs: editedPairs } = splitUrl(edited);
  const nextBase = splitUrl(nextBuilt).base;
  // However each writes it: a server's links may have an instance's `:` where a typed URL has %3A
  if (splitUrl(prevBuilt).base !== nextBase) return decoded(base) === decoded(nextBase) && edited !== nextBuilt ? edited : null;

  const prev = paramsOf(prevBuilt);
  const next = paramsOf(nextBuilt);
  let pairs = editedPairs;

  for (const name of new Set([...prev.keys(), ...next.keys()])) {
    const before = prev.get(name);
    const after = next.get(name);
    if (before === after) continue;
    if (after === undefined) {
      // Gone from the form. A value typed over the form's isn't the one that went, so it stays.
      pairs = pairs.filter(pair => nameOf(pair) !== name || valueOf(pair) !== before);
    } else {
      const at = pairs.findIndex(pair => nameOf(pair) === name);
      if (at < 0) {
        pairs = [...pairs, pairOf(name, after)];
      } else if (!sameAsTyped(after, valueOf(pairs[at]))) {
        pairs = pairs
          .map((pair, index) => (index === at ? pairOf(name, after) : pair))
          .filter((pair, index) => index === at || nameOf(pair) !== name);
      }
    }
  }

  const merged = `${base}${pairs.length > 0 ? `?${pairs.join('&')}` : ''}${hash}`;
  return merged === nextBuilt ? null : merged;
}
