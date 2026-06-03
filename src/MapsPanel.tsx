import { useEffect, useState, useMemo } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import SlideshowIcon from '@mui/icons-material/Slideshow';
import { transformExtent } from 'ol/proj';

import type { Collection } from './DataRetrievalAPI';
import { normalizeHref, expandTemporalValues } from './DataRetrievalAPI';
import {
  buildDynamicMapUrl,
  fetchStyles,
  getMapsLinks,
  getStyleLinks,
  hasMapsSupport,
  resolveWebMercatorTileTemplate,
  type StyleEntry,
} from './api/maps';
import { useMapsLayers, type MapsLayer } from './contexts/MapsLayerContext';
import { useService } from './contexts/ServiceContext';
import { useMapInteraction } from './contexts/MapInteractionContext';
import { useCollection } from './contexts/CollectionContext';
import type { UseQueryUrlReturn } from './hooks/useQueryUrl';

const DEFAULT_STYLE_ID = '__default__';
const FORMAT_OPTIONS = ['image/png', 'image/jpeg'];
// Cap frames per animated series so a wide range doesn't fire hundreds of /map requests.
const MAX_FRAMES = 48;

interface MapsPanelProps {
  collection: Collection;
  apiUrl: string;
  queryState: UseQueryUrlReturn;
}

// A stable string for the non-time dimension selection, so layers differing only by
// elevation/UAD-dimension get distinct ids.
function dimsKey(elevation?: string, dimensions?: Record<string, string>): string {
  const dims = dimensions
    ? Object.entries(dimensions).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).sort().join(',')
    : '';
  return [elevation ?? '', dims].filter(Boolean).join('|');
}

function layerIdFor(
  collectionId: string,
  styleId: string | undefined,
  sourceType: 'tiles' | 'dynamic',
  datetime?: string,
  extras?: string,
): string {
  return `${collectionId}::${styleId ?? 'default'}::${sourceType}::${datetime ?? 'now'}::${extras ?? ''}`;
}

// Build the OGC API Maps `datetime` parameter value from the query state, or undefined if none.
function currentDatetime(q: UseQueryUrlReturn): string | undefined {
  if (q.datetimeMode === 'range' && q.startDatetime && q.endDatetime) {
    return `${q.startDatetime}/${q.endDatetime}`;
  }
  if (q.datetimeMode !== 'range' && q.selectedDatetime) {
    return q.selectedDatetime;
  }
  return undefined;
}

// Vertical dimension → OGC API Maps `elevation` (instant or "start/end" interval).
function currentElevation(q: UseQueryUrlReturn): string | undefined {
  if (q.verticalMode === 'range' && q.startVertical && q.endVertical) {
    return `${q.startVertical}/${q.endVertical}`;
  }
  if (q.verticalMode !== 'range' && q.selectedVertical) {
    return q.selectedVertical;
  }
  return undefined;
}

// Additional (UAD) dimensions the user selected → { dimensionId: value | "start/end" }.
function currentDimensions(q: UseQueryUrlReturn): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const id of Object.keys(q.selectedCustomDimensions || {})) {
    const mode = q.customDimensionModes[id] || 'individual';
    if (mode === 'range' && q.customDimensionStarts[id] && q.customDimensionEnds[id]) {
      out[id] = `${q.customDimensionStarts[id]}/${q.customDimensionEnds[id]}`;
    } else if (mode !== 'range' && q.selectedCustomDimensions[id]) {
      out[id] = q.selectedCustomDimensions[id];
    }
  }
  return Object.keys(out).length ? out : undefined;
}

export default function MapsPanel({ collection, apiUrl, queryState }: MapsPanelProps) {
  const { setMapsLayers, setMapsBundles } = useMapsLayers();
  const { getAuthCredentials } = useService();
  const { viewExtent, viewSize } = useMapInteraction();
  const { setCollectionUrl } = useCollection();
  const [styles, setStyles] = useState<StyleEntry[] | null>(null);
  const [stylesError, setStylesError] = useState<string | null>(null);
  const [stylesLoading, setStylesLoading] = useState(false);
  const [selectedStyleId, setSelectedStyleId] = useState<string>(DEFAULT_STYLE_ID);
  const [selectedFormat, setSelectedFormat] = useState<string>(FORMAT_OPTIONS[0]);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const collectionLinks = useMemo(() => getMapsLinks(collection), [collection]);
  const supported = hasMapsSupport(collection);

  // Fetch styles when collection changes and a styles link is advertised.
  useEffect(() => {
    if (!supported) return;
    setStyles(null);
    setStylesError(null);
    setSelectedStyleId(DEFAULT_STYLE_ID);

    const stylesHref = normalizeHref(collectionLinks.stylesLink?.href);
    if (!stylesHref) return;

    const controller = new AbortController();
    setStylesLoading(true);
    fetchStyles(stylesHref, getAuthCredentials(apiUrl), controller.signal)
      .then(doc => {
        if (controller.signal.aborted) return;
        if (!doc) {
          setStylesError('Could not load styles document.');
          return;
        }
        setStyles(doc.styles);
      })
      .finally(() => {
        if (!controller.signal.aborted) setStylesLoading(false);
      });

    return () => controller.abort();
  }, [collection, supported, collectionLinks.stylesLink, apiUrl, getAuthCredentials]);

  const selectedStyle: StyleEntry | undefined =
    selectedStyleId !== DEFAULT_STYLE_ID ? styles?.find(s => s.id === selectedStyleId) : undefined;

  // Pick the best map/tilesets links for the current selection — prefer the style's own links if present.
  const styleLinks = selectedStyle ? getStyleLinks(selectedStyle) : {};
  const effectiveMapLink = styleLinks.mapLink ?? collectionLinks.mapLink;
  const effectiveTilesetsLink = styleLinks.tilesetsLink ?? collectionLinks.tilesetsLink;

  // Resolve the layer source once: prefer WebMercatorQuad tiles, else the dynamic /map endpoint.
  const resolveSource = async (
    auth: ReturnType<typeof getAuthCredentials>,
  ): Promise<{ sourceType: 'tiles' | 'dynamic'; tileUrl?: string; dynamicEndpoint?: string } | null> => {
    const tilesetsHref = normalizeHref(effectiveTilesetsLink?.href);
    if (tilesetsHref) {
      const tileUrl = await resolveWebMercatorTileTemplate(tilesetsHref, selectedFormat, auth);
      if (tileUrl) return { sourceType: 'tiles', tileUrl };
    }
    const mapHref = normalizeHref(effectiveMapLink?.href);
    if (mapHref) return { sourceType: 'dynamic', dynamicEndpoint: mapHref };
    return null;
  };

  // Style as a `styles=` param — fallback only, when no style-specific /map link exists.
  const styleQueryFallback = (): string | undefined =>
    (selectedStyle && !styleLinks.mapLink && !styleLinks.tilesetsLink) ? selectedStyle.id : undefined;

  const handleAdd = async () => {
    setAdding(true);
    setAddError(null);
    setNotice(null);
    try {
      const auth = getAuthCredentials(apiUrl);
      const src = await resolveSource(auth);
      if (!src) {
        setAddError('Collection advertises Maps but exposes no usable map or tileset link.');
        return;
      }
      const styleId = selectedStyle?.id;
      const datetime = currentDatetime(queryState);
      const elevation = currentElevation(queryState);
      const dimensions = currentDimensions(queryState);
      const extras = dimsKey(elevation, dimensions);
      const dimLabel = dimensions ? ` · ${Object.entries(dimensions).map(([k, v]) => `${k}=${v}`).join(' ')}` : '';
      const title = `${collection.title || collection.id}${styleId ? ` · ${styleId}` : ''}${datetime ? ` @ ${datetime}` : ''}${elevation ? ` · z=${elevation}` : ''}${dimLabel}`;

      const layer: MapsLayer = {
        id: layerIdFor(collection.id, styleId, src.sourceType, datetime, extras),
        collectionId: collection.id,
        styleId,
        title,
        visible: true,
        opacity: 1,
        zIndex: 50,
        sourceType: src.sourceType,
        tileUrl: src.tileUrl,
        dynamicEndpoint: src.dynamicEndpoint,
        styleQuery: src.sourceType === 'dynamic' ? styleQueryFallback() : undefined,
        format: selectedFormat,
        datetime,
        elevation,
        dimensions,
        apiKey: auth?.apiKey,
        apiKeyParam: auth?.apiKeyParam,
      };

      setMapsLayers(prev => {
        const idx = prev.findIndex(l => l.id === layer.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], visible: true };
          return next;
        }
        return [...prev, layer];
      });
    } catch (err) {
      console.error('Add map layer failed:', err);
      setAddError(err instanceof Error ? err.message : 'Failed to add map layer.');
    } finally {
      setAdding(false);
    }
  };

  // Add a time range as an animated bundle: one frame-layer per discrete instant in the window,
  // each issued as its own /map request (OGC API Maps returns one image per request). The
  // playback bar steps/animates by toggling which frame is visible.
  const handleAddSeries = async () => {
    setAdding(true);
    setAddError(null);
    setNotice(null);
    try {
      const temporal = collection.extent?.temporal;
      if (!temporal) { setAddError('Collection has no temporal extent to animate.'); return; }

      // Window: the selected range if set, else the full temporal extent.
      const useRange = queryState.datetimeMode === 'range' && queryState.startDatetime && queryState.endDatetime;
      const windowTemporal = useRange
        ? { interval: [[queryState.startDatetime, queryState.endDatetime]] as (string | null)[][] }
        : temporal;
      let instants = expandTemporalValues(windowTemporal, 500);
      if (instants.length < 2) {
        setAddError('Select a time range with at least two steps to animate.');
        return;
      }

      let truncated = false;
      if (instants.length > MAX_FRAMES) {
        const stride = instants.length / MAX_FRAMES;
        const sampled: string[] = [];
        for (let i = 0; i < MAX_FRAMES; i++) sampled.push(instants[Math.floor(i * stride)]);
        sampled[sampled.length - 1] = instants[instants.length - 1];
        instants = sampled;
        truncated = true;
      }

      const auth = getAuthCredentials(apiUrl);
      const src = await resolveSource(auth);
      if (!src) {
        setAddError('Collection advertises Maps but exposes no usable map or tileset link.');
        return;
      }
      const styleId = selectedStyle?.id;
      const elevation = currentElevation(queryState);
      const dimensions = currentDimensions(queryState);
      const extras = dimsKey(elevation, dimensions);
      const styleQuery = src.sourceType === 'dynamic' ? styleQueryFallback() : undefined;
      const bundleId = `bundle::${collection.id}::${styleId ?? 'default'}::${src.sourceType}::${extras}::${instants[0]}_${instants[instants.length - 1]}_${instants.length}`;
      const collectionTitle = `${collection.title || collection.id}${styleId ? ` · ${styleId}` : ''}${elevation ? ` · z=${elevation}` : ''}`;

      const frames: MapsLayer[] = instants.map((t, i) => ({
        id: layerIdFor(collection.id, styleId, src.sourceType, t, `${extras}::${bundleId}#${i}`),
        collectionId: collection.id,
        styleId,
        title: `${collectionTitle} @ ${t}`,
        visible: true,
        opacity: 1,
        zIndex: 50,
        sourceType: src.sourceType,
        tileUrl: src.tileUrl,
        dynamicEndpoint: src.dynamicEndpoint,
        styleQuery,
        format: selectedFormat,
        datetime: t,
        elevation,
        dimensions,
        apiKey: auth?.apiKey,
        apiKeyParam: auth?.apiKeyParam,
        bundleId,
        frameIndex: i,
        frameTime: t,
      }));

      setMapsLayers(prev => [...prev.filter(l => l.bundleId !== bundleId), ...frames]);
      setMapsBundles(prev => ({
        ...prev,
        [bundleId]: { bundleId, collectionTitle, frameCount: frames.length, currentIndex: 0, isPlaying: false, fps: 2 },
      }));
      setNotice(
        `Added ${frames.length} frames${truncated ? ` (capped at ${MAX_FRAMES})` : ''}. Use the playback bar on the map.`,
      );
    } catch (err) {
      console.error('Add animated series failed:', err);
      setAddError(err instanceof Error ? err.message : 'Failed to add animated series.');
    } finally {
      setAdding(false);
    }
  };

  // Serialized custom-dimension selection, so the preview effect re-runs when any dim changes
  // (kept as one variable to avoid complex expressions in the dependency array).
  const customDimSelectionKey = JSON.stringify([
    queryState.selectedCustomDimensions,
    queryState.customDimensionModes,
    queryState.customDimensionStarts,
    queryState.customDimensionEnds,
  ]);

  // Publish a copy-pasteable /map URL into the bottom URL bar reflecting style + datetime + current
  // map view. Only runs when no EDR data_query is active (which would otherwise own the URL).
  useEffect(() => {
    if (queryState.selectedDataQuery) return;
    const mapHref = normalizeHref(effectiveMapLink?.href);
    if (!mapHref || !viewExtent || !viewSize) return;

    const [lonMin, latMin, lonMax, latMax] = transformExtent(viewExtent, 'EPSG:3857', 'EPSG:4326');
    const url = buildDynamicMapUrl(mapHref, {
      bbox: [lonMin, latMin, lonMax, latMax],
      crs: 'EPSG:3857',
      width: viewSize[0],
      height: viewSize[1],
      format: selectedFormat,
      datetime: currentDatetime(queryState),
      elevation: currentElevation(queryState),
      dimensions: currentDimensions(queryState),
      styleId: (selectedStyle && !styleLinks.mapLink && !styleLinks.tilesetsLink) ? selectedStyle.id : undefined,
      transparent: true,
    });
    setCollectionUrl(url);
    // We intentionally exclude setCollectionUrl from deps (stable from context) — and the
    // queryState reference is stable enough that watching its substructure here is overkill.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    effectiveMapLink?.href, selectedFormat, viewExtent, viewSize,
    queryState.selectedDataQuery,
    queryState.selectedDatetime, queryState.startDatetime, queryState.endDatetime, queryState.datetimeMode,
    queryState.selectedVertical, queryState.startVertical, queryState.endVertical, queryState.verticalMode,
    customDimSelectionKey,
  ]);

  if (!supported) return null;

  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>Map layers</Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1 }}>
        <FormControl fullWidth size="small">
          <InputLabel id={`maps-style-label-${collection.id}`}>Style</InputLabel>
          <Select
            labelId={`maps-style-label-${collection.id}`}
            label="Style"
            value={selectedStyleId}
            onChange={(e) => setSelectedStyleId(String(e.target.value))}
            disabled={stylesLoading}
          >
            <MenuItem value={DEFAULT_STYLE_ID}>
              <em>Default</em>
            </MenuItem>
            {styles?.map(s => (
              <MenuItem key={s.id} value={s.id}>
                {s.title || s.id}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth size="small">
          <InputLabel id={`maps-format-label-${collection.id}`}>Format</InputLabel>
          <Select
            labelId={`maps-format-label-${collection.id}`}
            label="Format"
            value={selectedFormat}
            onChange={(e) => setSelectedFormat(String(e.target.value))}
          >
            {FORMAT_OPTIONS.map(f => (
              <MenuItem key={f} value={f}>{f}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAdd}
          disabled={adding}
          sx={{ whiteSpace: 'nowrap' }}
        >
          Add layer
        </Button>
      </Stack>

      {collection.extent?.temporal && (
        <Button
          variant="outlined"
          size="small"
          startIcon={<SlideshowIcon />}
          onClick={handleAddSeries}
          disabled={adding}
          sx={{ mb: 1 }}
        >
          Add animated series
        </Button>
      )}

      {stylesError && <Alert severity="warning" sx={{ mb: 1 }}>{stylesError}</Alert>}
      {addError && <Alert severity="error" sx={{ mb: 1 }}>{addError}</Alert>}
      {notice && <Alert severity="info" sx={{ mb: 1 }}>{notice}</Alert>}
    </Box>
  );
}
