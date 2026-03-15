// Function to format OGC API conformance classes for display
export function formatConformanceClass(url: string): string | null {
  try {
    // Only process OGC API conformance URLs
    if (!url.includes('ogcapi-')) {
      return null;
    }

    // Extract the relevant parts after ogcapi-
    // Pattern: http://www.opengis.net/spec/ogcapi-{standard}-{partNum}/{version}/conf/{confName}
    // or: http://www.opengis.net/spec/ogcapi-{standard}/{version}/conf/{confName}
    const match = url.match(/ogcapi-([^/]+)\/([^/]+)\/conf\/(.+)/);
    if (!match) {
      // Fallback to simple pattern without conf path
      const simpleMatch = url.match(/ogcapi-([^/]+)\/([^/]+)/);
      if (!simpleMatch) {
        return null;
      }

      const [, standardWithPart, version] = simpleMatch;

      // Check if standard has a part number (e.g., "edr-1")
      const partMatch = standardWithPart.match(/^(.+)-(\d+)$/);
      if (partMatch) {
        const [, standardName, partNum] = partMatch;
        const formattedStandard = standardName.toUpperCase();
        return `OGC API - ${formattedStandard} - Part ${partNum} (v${version})`;
      }

      const formattedStandard = standardWithPart
        .split('-')
        .map(word => word.toUpperCase())
        .join(' ');

      return `OGC API - ${formattedStandard} (v${version})`;
    }

    const [, standardWithPart, version, confPath] = match;

    // Check if standard has a part number suffix (e.g., "edr-1", "common-1")
    let standardName = standardWithPart;
    let partNum = '1'; // Default to part 1

    const standardPartMatch = standardWithPart.match(/^(.+)-(\d+)$/);
    if (standardPartMatch) {
      standardName = standardPartMatch[1];
      partNum = standardPartMatch[2];
    }

    // Format the standard name - convert to uppercase
    const formattedStandard = standardName.toUpperCase();

    // Format the conf path name (capitalize first letter)
    const formattedConfName = confPath
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    return `OGC API - ${formattedStandard} - Part ${partNum}: ${formattedConfName} (v${version})`;
  } catch (error) {
    console.warn('Error formatting conformance class:', error);
    return null;
  }
}
