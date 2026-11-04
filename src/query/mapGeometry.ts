// Taking back the last thing added on the map, one vertex at a time

type LonLat = [number, number];

// One vertex isn't a line, so a line's last two go together
export function withoutLastPoint(points: LonLat[], kind: 'points' | 'line'): LonLat[] {
  return kind === 'line' && points.length <= 2 ? [] : points.slice(0, -1);
}

// A polygon's ring ends on its first vertex, so a triangle has 4 entries and goes as a whole
export function withoutLastCorner(polygons: LonLat[][]): LonLat[][] {
  const last = polygons[polygons.length - 1];
  if (!last) return polygons;
  const others = polygons.slice(0, -1);
  return last.length <= 4 ? others : [...others, [...last.slice(0, -2), last[0]]];
}
