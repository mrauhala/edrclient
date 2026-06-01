import { useEffect, useRef } from 'react';
import OLMap from 'ol/Map';
import TileLayer from 'ol/layer/Tile';
import ImageLayer from 'ol/layer/Image';
import XYZ from 'ol/source/XYZ';
import ImageSource from 'ol/source/Image';
import { transformExtent } from 'ol/proj';
import type BaseLayer from 'ol/layer/Base';
import { addApiKeyToUrl } from '../api/auth';
import { buildDynamicMapUrl } from '../api/maps';
import { useMapsLayers, type MapsLayer } from '../contexts/MapsLayerContext';

type AnyImageOrTileLayer = TileLayer<XYZ> | ImageLayer<ImageSource>;

// Append the layer's frozen dimensions (datetime + elevation + UAD dims) to a tile URL template.
function applyDimensionsToTileUrl(template: string, config: MapsLayer): string {
  const params: [string, string][] = [];
  if (config.datetime) params.push(['datetime', config.datetime]);
  if (config.elevation) params.push(['elevation', config.elevation]);
  if (config.dimensions) {
    for (const [name, value] of Object.entries(config.dimensions)) {
      if (value) params.push([name, value]);
    }
  }
  if (!params.length) return template;
  const sep = template.includes('?') ? '&' : '?';
  return template + sep + params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}

function createTileLayer(config: MapsLayer): TileLayer<XYZ> {
  const datetimed = applyDimensionsToTileUrl(config.tileUrl!, config);
  const urlWithKey = config.apiKey
    ? addApiKeyToUrl(datetimed, { apiKey: config.apiKey, apiKeyParam: config.apiKeyParam })
    : datetimed;

  const source = new XYZ({
    url: urlWithKey,
    attributions: config.attribution,
    crossOrigin: 'anonymous',
  });

  const layer = new TileLayer({
    source,
    opacity: config.opacity,
    zIndex: config.zIndex,
    visible: true,
  });
  layer.set('layer', 'maps');
  layer.set('mapsLayerId', config.id);
  return layer;
}

function createImageLayer(config: MapsLayer): ImageLayer<ImageSource> {
  const endpoint = config.dynamicEndpoint!;

  const source = new ImageSource({
    attributions: config.attribution,
    loader: (extent, resolution, pixelRatio) => {
      const [minX, minY, maxX, maxY] = extent;
      const width = Math.round(((maxX - minX) / resolution) * pixelRatio);
      const height = Math.round(((maxY - minY) / resolution) * pixelRatio);

      // Servers expect bbox in CRS84 (lon/lat) by default; OL gives us extent in Web Mercator.
      const [lonMin, latMin, lonMax, latMax] = transformExtent(
        [minX, minY, maxX, maxY],
        'EPSG:3857',
        'EPSG:4326',
      );

      const url = buildDynamicMapUrl(endpoint, {
        bbox: [lonMin, latMin, lonMax, latMax],
        crs: 'EPSG:3857',
        width,
        height,
        format: config.format,
        datetime: config.datetime,
        elevation: config.elevation,
        dimensions: config.dimensions,
        styleId: config.styleQuery,
        transparent: true,
      });
      const finalUrl = config.apiKey
        ? addApiKeyToUrl(url, { apiKey: config.apiKey, apiKeyParam: config.apiKeyParam })
        : url;

      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve({ image: img, extent, resolution, pixelRatio });
        img.onerror = () => reject(new Error(`Failed to load map image: ${finalUrl}`));
        img.src = finalUrl;
      });
    },
  });

  const layer = new ImageLayer({
    source,
    opacity: config.opacity,
    zIndex: config.zIndex,
    visible: true,
  });
  layer.set('layer', 'maps');
  layer.set('mapsLayerId', config.id);
  return layer;
}

function buildLayer(config: MapsLayer): AnyImageOrTileLayer | null {
  if (config.sourceType === 'tiles' && config.tileUrl) return createTileLayer(config);
  if (config.sourceType === 'dynamic' && config.dynamicEndpoint) return createImageLayer(config);
  return null;
}

// Anything that requires a source rebuild — not just an opacity/zIndex tweak.
function fingerprint(config: MapsLayer): string {
  return [
    config.sourceType,
    config.tileUrl ?? '',
    config.dynamicEndpoint ?? '',
    config.format,
    config.datetime ?? '',
    config.elevation ?? '',
    config.dimensions ? JSON.stringify(config.dimensions) : '',
    config.apiKey ?? '',
    config.apiKeyParam ?? '',
  ].join('|');
}

export function useMapsOverlays(map: OLMap | null): void {
  const { mapsLayers, mapsBundles } = useMapsLayers();
  const olLayersRef = useRef<globalThis.Map<string, AnyImageOrTileLayer>>(new globalThis.Map());
  const fingerprintsRef = useRef<globalThis.Map<string, string>>(new globalThis.Map());

  useEffect(() => {
    if (!map) return;
    const olMap = map;
    const tracked = olLayersRef.current;
    const fingerprints = fingerprintsRef.current;

    const wantedIds = new Set<string>();

    for (const config of mapsLayers) {
      wantedIds.add(config.id);
      let existing = tracked.get(config.id);
      const fp = fingerprint(config);
      const prevFp = fingerprints.get(config.id);

      // Non-bundle layers honor the `visible` flag (remove when hidden). Bundle frames stay built
      // and are toggled via OpenLayers visibility by the bundle's currentIndex — so all frames
      // load once and stepping/animating doesn't refetch.
      if (!config.bundleId && !config.visible) {
        if (existing) {
          olMap.removeLayer(existing as unknown as BaseLayer);
          tracked.delete(config.id);
          fingerprints.delete(config.id);
        }
        continue;
      }

      // Rebuild when datetime/format/source/URL changes — OL sources can't be hot-swapped reliably.
      if (existing && prevFp !== fp) {
        olMap.removeLayer(existing as unknown as BaseLayer);
        tracked.delete(config.id);
        fingerprints.delete(config.id);
        existing = undefined;
      }

      if (!existing) {
        const layer = buildLayer(config);
        if (!layer) continue;
        olMap.addLayer(layer as unknown as BaseLayer);
        tracked.set(config.id, layer);
        fingerprints.set(config.id, fp);
        existing = layer;
      }

      existing.setOpacity(config.opacity);
      if (config.zIndex !== undefined) existing.setZIndex(config.zIndex);
      // A bundle frame is visible only when it's the current frame; standalone layers are visible.
      const bundle = config.bundleId ? mapsBundles[config.bundleId] : undefined;
      existing.setVisible(bundle ? config.frameIndex === bundle.currentIndex : true);
    }

    // Remove layers that disappeared from state entirely
    for (const [id, layer] of tracked.entries()) {
      if (!wantedIds.has(id)) {
        olMap.removeLayer(layer as unknown as BaseLayer);
        tracked.delete(id);
        fingerprints.delete(id);
      }
    }
  }, [map, mapsLayers, mapsBundles]);

  useEffect(() => {
    const tracked = olLayersRef.current;
    return () => {
      if (!map) return;
      for (const layer of tracked.values()) {
        map.removeLayer(layer as unknown as BaseLayer);
      }
      tracked.clear();
    };
  }, [map]);
}
