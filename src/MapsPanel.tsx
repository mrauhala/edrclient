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
import { transformExtent } from 'ol/proj';

import type { Collection } from './DataRetrievalAPI';
import { normalizeHref } from './DataRetrievalAPI';
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

interface MapsPanelProps {
  collection: Collection;
  apiUrl: string;
  queryState: UseQueryUrlReturn;
}

function layerIdFor(collectionId: string, styleId: string | undefined, sourceType: 'tiles' | 'dynamic', datetime?: string): string {
  return `${collectionId}::${styleId ?? 'default'}::${sourceType}::${datetime ?? 'now'}`;
}

// Build the OGC API Maps `datetime` parameter value from the query state, or null if no time selected.
function currentDatetime(q: UseQueryUrlReturn): string | undefined {
  if (q.datetimeMode === 'range' && q.startDatetime && q.endDatetime) {
    return `${q.startDatetime}/${q.endDatetime}`;
  }
  if (q.datetimeMode !== 'range' && q.selectedDatetime) {
    return q.selectedDatetime;
  }
  return undefined;
}

export default function MapsPanel({ collection, apiUrl, queryState }: MapsPanelProps) {
  const { setMapsLayers } = useMapsLayers();
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

  const handleAdd = async () => {
    setAdding(true);
    setAddError(null);
    try {
      const auth = getAuthCredentials(apiUrl);
      const styleId = selectedStyle?.id;
      const datetime = currentDatetime(queryState);
      const title = `${collection.title || collection.id}${styleId ? ` · ${styleId}` : ''}${datetime ? ` @ ${datetime}` : ''}`;

      let layer: MapsLayer | null = null;

      // Prefer tiles when available and WebMercatorQuad can be resolved.
      const tilesetsHref = normalizeHref(effectiveTilesetsLink?.href);
      if (tilesetsHref) {
        const tileUrl = await resolveWebMercatorTileTemplate(tilesetsHref, selectedFormat, auth);
        if (tileUrl) {
          layer = {
            id: layerIdFor(collection.id, styleId, 'tiles', datetime),
            collectionId: collection.id,
            styleId,
            title,
            visible: true,
            opacity: 1,
            zIndex: 50,
            sourceType: 'tiles',
            tileUrl,
            format: selectedFormat,
            datetime,
            apiKey: auth?.apiKey,
            apiKeyParam: auth?.apiKeyParam,
          };
        }
      }

      // Fall back to dynamic /map.
      if (!layer) {
        const mapHref = normalizeHref(effectiveMapLink?.href);
        if (!mapHref) {
          setAddError('Collection advertises Maps but exposes no usable map or tileset link.');
          return;
        }
        layer = {
          id: layerIdFor(collection.id, styleId, 'dynamic', datetime),
          collectionId: collection.id,
          styleId,
          title,
          visible: true,
          opacity: 1,
          zIndex: 50,
          sourceType: 'dynamic',
          dynamicEndpoint: mapHref,
          format: selectedFormat,
          datetime,
          apiKey: auth?.apiKey,
          apiKeyParam: auth?.apiKeyParam,
        };
      }

      setMapsLayers(prev => {
        const idx = prev.findIndex(l => l.id === layer!.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = { ...next[idx], visible: true };
          return next;
        }
        return [...prev, layer!];
      });
    } catch (err) {
      console.error('Add map layer failed:', err);
      setAddError(err instanceof Error ? err.message : 'Failed to add map layer.');
    } finally {
      setAdding(false);
    }
  };

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

      {stylesError && <Alert severity="warning" sx={{ mb: 1 }}>{stylesError}</Alert>}
      {addError && <Alert severity="error" sx={{ mb: 1 }}>{addError}</Alert>}
    </Box>
  );
}
