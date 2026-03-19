/**
 * Resolves a JSON pointer (e.g. "/collections/0/extent/spatial") to a 1-based
 * line number in a pretty-printed JSON string (2-space indent).
 *
 * Strategy: walk the formatted JSON lines, tracking the current JSON path by
 * matching key names and array indices at the correct indentation depth.
 */
export function findLineForJsonPointer(prettyJson: string, pointer: string): number {
  if (!pointer || pointer === 'root') return 1;

  const segments = pointer.replace(/^\//, '').split('/');
  if (segments.length === 0) return 1;

  const lines = prettyJson.split('\n');
  let segIdx = 0;
  let arrayItemCount = -1; // -1 means not tracking array items
  let lastMatchLine = 1;

  for (let i = 0; i < lines.length && segIdx < segments.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    const indent = line.length - line.trimStart().length;

    // Calculate depth at this line based on indentation (2-space)
    const lineDepth = indent / 2;

    const segment = segments[segIdx];
    const isArrayIndex = /^\d+$/.test(segment);
    // Target depth is segIdx + 1 for keys inside the root object
    const targetDepth = segIdx + 1;

    if (isArrayIndex) {
      // We're looking for the N-th item inside an array
      // The array was opened by the previous key match, so items are at targetDepth
      if (lineDepth === targetDepth) {
        // Is this line the start of an array item?
        if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"') || /^[\d\-ntf]/.test(trimmed)) {
          arrayItemCount++;
          if (arrayItemCount === parseInt(segment, 10)) {
            lastMatchLine = i + 1; // 1-based
            segIdx++;
            arrayItemCount = -1;
            // If this opens an object/array, the next segment will be inside it
          }
        }
      }
    } else {
      // Looking for a key name at the target depth
      if (lineDepth === targetDepth) {
        const keyMatch = trimmed.match(/^"([^"]+)"\s*:/);
        if (keyMatch && keyMatch[1] === segment) {
          lastMatchLine = i + 1; // 1-based
          segIdx++;
          arrayItemCount = -1;

          // Check if the value starts an array on this same line — prepare for array index tracking
          if (segIdx < segments.length && /^\d+$/.test(segments[segIdx])) {
            // Value might be on this line (e.g., "key": [) or the next
            if (trimmed.includes('[')) {
              arrayItemCount = -1; // will start counting on subsequent lines
            }
          }
        }
      }
    }
  }

  return lastMatchLine;
}

/**
 * Find the line range (1-based, inclusive) of a collection object at the
 * given index within a pretty-printed collections JSON response.
 */
export function findCollectionRange(
  prettyJson: string,
  collectionIndex: number
): { start: number; end: number } | null {
  const lines = prettyJson.split('\n');

  // Find "collections": [ line
  let arrayStartLine = -1;
  let arrayDepthIndent = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    if (trimmed.match(/^"collections"\s*:\s*\[/)) {
      arrayStartLine = i;
      arrayDepthIndent = lines[i].length - trimmed.length;
      break;
    }
  }
  if (arrayStartLine === -1) return null;

  // Items inside the array are one level deeper than the key
  const itemIndent = arrayDepthIndent + 2;
  let count = -1;

  for (let i = arrayStartLine + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    const indent = line.length - trimmed.length;

    // The closing bracket of the collections array is at the key's indent level + 2
    if (indent <= arrayDepthIndent && trimmed.startsWith(']')) {
      break;
    }

    // Count objects at the item indent level
    if (indent === itemIndent && trimmed.startsWith('{')) {
      count++;
      if (count === collectionIndex) {
        const start = i + 1; // 1-based
        // Find matching closing brace
        let braceDepth = 0;
        for (let j = i; j < lines.length; j++) {
          for (const ch of lines[j]) {
            if (ch === '{') braceDepth++;
            else if (ch === '}') braceDepth--;
          }
          if (braceDepth === 0) {
            return { start, end: j + 1 }; // 1-based
          }
        }
      }
    }
  }

  return null;
}

/**
 * Extract the collection index from a JSON pointer path.
 * e.g. "/collections/2/extent" → 2, "/title" → null
 */
export function getCollectionIndexFromPath(path: string): number | null {
  const match = path.match(/^\/collections\/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}
