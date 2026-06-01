import axios from 'axios';
import type { AuthCredentials, Collection, Link } from '../types/api';
import { OGC_REL } from '../types/api';
import { normalizeHref } from '../utils/href';
import { getAxiosConfig, addApiKeyToUrl } from './auth';

export interface MapsLinks {
  mapLink?: Link;
  tilesetsLink?: Link;
  stylesLink?: Link;
}

export interface StyleEntry {
  id: string;
  title?: string;
  description?: string;
  links?: Link[];
}

export interface StylesDocument {
  styles: StyleEntry[];
  links?: Link[];
}

export interface TilesetSummary {
  tileMatrixSetId?: string;
  tileMatrixSetURI?: string;
  links?: Link[];
}

export interface TilesetListDocument {
  tilesets: TilesetSummary[];
  links?: Link[];
}

export interface TilesetDocument {
  tileMatrixSetURI?: string;
  tileMatrixSetId?: string;
  links?: Link[];
}

function matchesRel(link: Link, rels: readonly string[]): boolean {
  return !!link.rel && rels.includes(link.rel);
}

export function getMapsLinks(collection: Collection): MapsLinks {
  if (!collection?.links || !Array.isArray(collection.links)) return {};
  const out: MapsLinks = {};
  for (const link of collection.links) {
    if (!out.mapLink && matchesRel(link, OGC_REL.map)) out.mapLink = link;
    else if (!out.tilesetsLink && matchesRel(link, OGC_REL.tilesetsMap)) out.tilesetsLink = link;
    else if (!out.stylesLink && matchesRel(link, OGC_REL.styles)) out.stylesLink = link;
  }
  return out;
}

export function hasMapsSupport(collection: Collection): boolean {
  const links = getMapsLinks(collection);
  return !!(links.mapLink || links.tilesetsLink);
}

// Pick a style entry's links by rel — used to find that style's map/tilesets endpoint.
export function getStyleLinks(style: StyleEntry): MapsLinks {
  const out: MapsLinks = {};
  if (!style.links) return out;
  for (const link of style.links) {
    if (!out.mapLink && matchesRel(link, OGC_REL.map)) out.mapLink = link;
    else if (!out.tilesetsLink && matchesRel(link, OGC_REL.tilesetsMap)) out.tilesetsLink = link;
  }
  return out;
}

export async function fetchStyles(stylesUrl: string, auth?: AuthCredentials, signal?: AbortSignal): Promise<StylesDocument | null> {
  try {
    const finalUrl = addApiKeyToUrl(stylesUrl, auth);
    const response = await axios.get(finalUrl, { ...getAxiosConfig(auth, signal), responseType: 'json' });
    const data = response.data;
    if (data && Array.isArray(data.styles)) return data as StylesDocument;
    return null;
  } catch (error) {
    if (axios.isCancel(error)) return null;
    console.error('Error fetching styles document:', error);
    return null;
  }
}

export async function fetchTilesetsList(url: string, auth?: AuthCredentials, signal?: AbortSignal): Promise<TilesetListDocument | null> {
  try {
    const finalUrl = addApiKeyToUrl(url, auth);
    const response = await axios.get(finalUrl, { ...getAxiosConfig(auth, signal), responseType: 'json' });
    const data = response.data;
    if (data && Array.isArray(data.tilesets)) return data as TilesetListDocument;
    return null;
  } catch (error) {
    if (axios.isCancel(error)) return null;
    console.error('Error fetching tilesets list:', error);
    return null;
  }
}

export async function fetchTileset(url: string, auth?: AuthCredentials, signal?: AbortSignal): Promise<TilesetDocument | null> {
  try {
    const finalUrl = addApiKeyToUrl(url, auth);
    const response = await axios.get(finalUrl, { ...getAxiosConfig(auth, signal), responseType: 'json' });
    return response.data ?? null;
  } catch (error) {
    if (axios.isCancel(error)) return null;
    console.error('Error fetching tileset metadata:', error);
    return null;
  }
}

// WebMercatorQuad is the Web Mercator tile-matrix-set we can render directly via ol/source/XYZ.
const WEB_MERCATOR_QUAD_URIS = new Set<string>([
  'http://www.opengis.net/def/tilematrixset/OGC/1.0/WebMercatorQuad',
  'https://www.opengis.net/def/tilematrixset/OGC/1.0/WebMercatorQuad',
]);

export function isWebMercatorQuad(uriOrId?: string): boolean {
  if (!uriOrId) return false;
  if (WEB_MERCATOR_QUAD_URIS.has(uriOrId)) return true;
  return uriOrId === 'WebMercatorQuad';
}

// Pick a WebMercatorQuad entry from a tilesets list and resolve its tile-URL template.
// Returns the XYZ template (with {z}/{x}/{y} placeholders) if discoverable; otherwise null.
export async function resolveWebMercatorTileTemplate(
  tilesetsUrl: string,
  format: string,
  auth?: AuthCredentials,
  signal?: AbortSignal,
): Promise<string | null> {
  const list = await fetchTilesetsList(tilesetsUrl, auth, signal);
  if (!list) return null;

  // Find WebMercatorQuad tileset
  const wmq = list.tilesets.find(t => isWebMercatorQuad(t.tileMatrixSetURI) || isWebMercatorQuad(t.tileMatrixSetId));
  if (!wmq) return null;

  // The tileset entry usually has rel="item" link with the tileset metadata URL,
  // and the metadata document carries the actual `tileMatrixSetLimits` and the templated tile URL.
  // The spec's "tile" link relation carries the URI template, on either the list entry or the tileset metadata.
  const findTileTemplate = (links?: Link[]): string | null => {
    if (!links) return null;
    for (const link of links) {
      const isTile = link.rel === 'item' || link.rel === 'http://www.opengis.net/def/rel/ogc/1.0/tile';
      if (!isTile) continue;
      if (link.type && format && !link.type.includes(format.split('/').pop() ?? format)) continue;
      const href = normalizeHref(link.href);
      if (href && (href.includes('{tileMatrix}') || href.includes('{z}'))) return href;
    }
    return null;
  };

  // 1. Try templated tile URL on the list entry itself.
  let template = findTileTemplate(wmq.links);

  // 2. Otherwise, fetch the tileset metadata via its self link and look there.
  if (!template) {
    const selfLink = wmq.links?.find(l => l.rel === 'self' || l.rel === 'item');
    const metaUrl = normalizeHref(selfLink?.href);
    if (metaUrl) {
      const meta = await fetchTileset(metaUrl, auth, signal);
      template = findTileTemplate(meta?.links);
    }
  }

  if (!template) return null;
  // OGC API - Tiles uses {tileMatrix}/{tileRow}/{tileCol}; OpenLayers XYZ wants {z}/{y}/{x}.
  return template
    .replace('{tileMatrix}', '{z}')
    .replace('{tileRow}', '{y}')
    .replace('{tileCol}', '{x}');
}

export interface DynamicMapParams {
  bbox?: [number, number, number, number];
  bboxCrs?: string;
  width?: number;
  height?: number;
  crs?: string;
  styleId?: string;
  format?: string;
  datetime?: string;
  // Vertical dimension (OGC API Maps `elevation`) — instant ("500") or interval ("500/850").
  elevation?: string;
  // Additional (UAD) dimensions, each serialized as its own query param named by dimension id.
  dimensions?: Record<string, string>;
  transparent?: boolean;
  bgcolor?: string;
}

// Build a GET /map URL with the given params. Omits unset values.
export function buildDynamicMapUrl(endpoint: string, params: DynamicMapParams): string {
  const url = new URL(endpoint);
  if (params.bbox) url.searchParams.set('bbox', params.bbox.join(','));
  if (params.bboxCrs) url.searchParams.set('bbox-crs', params.bboxCrs);
  if (params.width !== undefined) url.searchParams.set('width', String(params.width));
  if (params.height !== undefined) url.searchParams.set('height', String(params.height));
  if (params.crs) url.searchParams.set('crs', params.crs);
  if (params.datetime) url.searchParams.set('datetime', params.datetime);
  if (params.elevation) url.searchParams.set('elevation', params.elevation);
  if (params.dimensions) {
    for (const [name, value] of Object.entries(params.dimensions)) {
      if (value) url.searchParams.set(name, value);
    }
  }
  // Fallback only: style is normally applied via path routing (a style's own /map link). This is
  // used when a style is selected but the server exposes only a generic /map endpoint.
  if (params.styleId) url.searchParams.set('styles', params.styleId);
  if (params.transparent !== undefined) url.searchParams.set('transparent', String(params.transparent));
  if (params.bgcolor) url.searchParams.set('bgcolor', params.bgcolor);
  if (params.format) url.searchParams.set('f', params.format);
  return url.toString();
}
