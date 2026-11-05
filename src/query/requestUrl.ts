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

// The edited URL after the form went from building prevBuilt to nextBuilt: only the parameters the
// form changed are written in, as text, so what was typed keeps its encoding and order. Another
// query or collection starts again from the form (null: no edits left).
export function mergeEditedUrl(prevBuilt: string, nextBuilt: string, edited: string): string | null {
  if (!edited.trim() || splitUrl(prevBuilt).base !== splitUrl(nextBuilt).base) return null;

  const prev = paramsOf(prevBuilt);
  const next = paramsOf(nextBuilt);
  const { base, hash, pairs: editedPairs } = splitUrl(edited);
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
      } else {
        pairs = pairs
          .map((pair, index) => (index === at ? pairOf(name, after) : pair))
          .filter((pair, index) => index === at || nameOf(pair) !== name);
      }
    }
  }

  const merged = `${base}${pairs.length > 0 ? `?${pairs.join('&')}` : ''}${hash}`;
  return merged === nextBuilt ? null : merged;
}
