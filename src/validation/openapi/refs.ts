// JSON pointers and local $ref resolution in OpenAPI documents. Only same-document refs
// ('#/...') are followed; external refs are left alone.

export const escapePointerSegment = (segment: string) => segment.replace(/~/g, '~0').replace(/\//g, '~1');
export const unescapePointerSegment = (segment: string) => segment.replace(/~1/g, '/').replace(/~0/g, '~');

export function pointerOf(...segments: (string | number)[]): string {
  return segments.map(segment => '/' + escapePointerSegment(String(segment))).join('');
}

// The value at a JSON pointer ('/a/b' or '#/a/b'), or undefined
export function resolvePointer(doc: unknown, pointer: string): unknown {
  const path = pointer.replace(/^#/, '');
  if (path === '') return doc;
  let node: unknown = doc;
  for (const raw of path.split('/').slice(1)) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[unescapePointerSegment(decodeURIComponent(raw))];
  }
  return node;
}

const isLocalRef = (value: unknown): value is { $ref: string } =>
  !!value && typeof value === 'object' && typeof (value as { $ref?: unknown }).$ref === 'string'
  && (value as { $ref: string }).$ref.startsWith('#');

// Follow a chain of local $refs to the object it points at. Returns the node itself if it isn't
// a local ref, and undefined for a broken or circular chain.
export function derefLocal<T = unknown>(doc: unknown, node: unknown, maxDepth = 20): T | undefined {
  const seen = new Set<string>();
  let current = node;
  while (isLocalRef(current)) {
    const ref = current.$ref;
    if (seen.has(ref) || seen.size >= maxDepth) return undefined;
    seen.add(ref);
    current = resolvePointer(doc, ref);
    if (current === undefined) return undefined;
  }
  return current as T;
}

// Keys whose values are data, not part of the document: a $ref inside them is just text.
// Meteogate's climate observations put JSON Schemas, $refs and all, in response examples.
const LITERAL_KEYS = new Set(['example', 'default', 'enum', 'const']);
// Maps whose keys are names chosen by the author, so a property may be called "example"
const NAME_MAPS = new Set(['properties', 'patternProperties']);

function isLiteral(key: string, child: unknown, parentKey: string, grandparentKey: string): boolean {
  if (NAME_MAPS.has(parentKey)) return false;
  if (LITERAL_KEYS.has(key) || key.startsWith('x-')) return true;
  if (key === 'examples' && Array.isArray(child)) return true; // JSON Schema examples: values
  return key === 'value' && grandparentKey === 'examples'; // an Example Object's value
}

// Every local $ref that doesn't resolve, with the pointer of the object holding it
export function findBrokenLocalRefs(doc: unknown): { at: string; ref: string }[] {
  const broken: { at: string; ref: string }[] = [];
  const visit = (node: unknown, at: string, key: string, parentKey: string) => {
    if (Array.isArray(node)) {
      node.forEach((child, i) => visit(child, `${at}/${i}`, String(i), key));
    } else if (node && typeof node === 'object') {
      if (isLocalRef(node) && resolvePointer(doc, node.$ref) === undefined) {
        broken.push({ at, ref: node.$ref });
      }
      Object.entries(node).forEach(([childKey, child]) => {
        if (!isLiteral(childKey, child, key, parentKey)) visit(child, `${at}/${escapePointerSegment(childKey)}`, childKey, key);
      });
    }
  };
  visit(doc, '', '', '');
  return broken;
}
