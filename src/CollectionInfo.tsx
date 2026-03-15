import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import Public from '@mui/icons-material/Public';
import AccessTime from '@mui/icons-material/AccessTime';
import Height from '@mui/icons-material/Height';
import Category from '@mui/icons-material/Category';
import Balance from '@mui/icons-material/Balance';
import KeywordChips from './KeywordChips';
import {
  Collection,
  ValidationError,
  getSupportedDataQueries,
  normalizeTemporal,
  formatTemporalInterval,
  getOverallTemporalExtent,
  normalizeVertical,
  formatVerticalInterval,
  getOverallVerticalExtent,
  getVerticalUnit,
} from './DataRetrievalAPI';

/** Parsed license info: a human-readable label and a URL. */
export interface LicenseInfo {
  label: string;
  href: string;
}

interface CollectionInfoProps {
  collection: Collection;
  /** Use white text colours for dark backgrounds (map overlay). Default: false (MUI theme). */
  dark?: boolean;
  /** Top-level service license to show when the collection has no license link of its own. */
  fallbackLicense?: LicenseInfo | null;
  /**
   * Validation errors for this collection (Option C footer).
   * undefined = don't show footer (map overlay / validation not yet run).
   * []         = show "✓ Valid".
   * [...]      = show "⚠ N issues".
   */
  validationErrors?: ValidationError[] | null;
  /** Clamp the description to a max number of lines. Default: false (show full). */
  clampDescription?: boolean;
}

/** Resolve a licence link into a { label, href } pair.
 *  Recognises CC /licenses/ and /publicdomain/ URLs; falls back to the
 *  link's own title field, then a generic "License" label. */
export function parseLicense(
  rawHref: string | Record<string, string> | unknown,
  title?: string,
): { label: string; href: string } | null {
  const href =
    typeof rawHref === 'string'
      ? rawHref
      : (Object.values(rawHref as Record<string, string>)[0] as string);
  if (!href) return null;

  let label: string | null = null;
  try {
    const url = new URL(href);
    if (url.hostname === 'creativecommons.org') {
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts[0] === 'licenses' && parts.length >= 3) {
        // /licenses/by-nc-nd/4.0/ → CC BY-NC-ND 4.0
        label = `CC ${parts[1].toUpperCase()} ${parts[2]}`;
      } else if (parts[0] === 'publicdomain' && parts.length >= 3) {
        // /publicdomain/zero/1.0/ → CC0 1.0
        label = `CC0 ${parts[2]}`;
      }
    }
  } catch {
    // Invalid URL – fall through to title/generic
  }

  return { label: label ?? title ?? 'License', href };
}

export default function CollectionInfo({
  collection,
  dark = false,
  fallbackLicense = null,
  validationErrors,
  clampDescription = false,
}: CollectionInfoProps) {
  // ── Colour tokens ────────────────────────────────────────────────────────
  const textPrimary   = dark ? 'rgba(255,255,255,1)'    : 'text.primary';
  const textSecondary = dark ? 'rgba(255,255,255,0.85)' : 'text.secondary';
  const darkChipSx    = dark ? { color: 'white', borderColor: 'rgba(255,255,255,0.5)' } : {};

  const sectionLabelSx = {
    fontSize: '0.6rem',
    fontWeight: 700,
    letterSpacing: '0.09em',
    textTransform: 'uppercase' as const,
    color: dark ? 'rgba(255,255,255,0.30)' : '#bdbdbd',
    mb: 0.5,
  };

  const chipBaseSx = {
    height: '18px',
    fontSize: '0.6rem',
    fontWeight: 'bold',
    borderWidth: '1px',
    '& .MuiChip-label': { padding: '0 5px' },
    ...darkChipSx,
  } as const;

  // ── Extent badges ────────────────────────────────────────────────────────
  const extentBadges: { label: string; color: 'primary' | 'secondary'; icon?: React.ReactElement }[] = [];

  if (
    collection.extent?.spatial?.bbox &&
    Array.isArray(collection.extent.spatial.bbox) &&
    collection.extent.spatial.bbox.length > 0
  ) {
    extentBadges.push({ label: 'Spatial', color: 'primary', icon: <Public sx={{ fontSize: '0.7rem' }} /> });
  }
  if (collection.extent?.temporal && (collection.extent.temporal.interval || collection.extent.temporal.values)) {
    extentBadges.push({ label: 'Temporal', color: 'primary', icon: <AccessTime sx={{ fontSize: '0.7rem' }} /> });
  }
  if (collection.extent?.vertical && (collection.extent.vertical.interval || collection.extent.vertical.values)) {
    extentBadges.push({ label: 'Vertical', color: 'primary', icon: <Height sx={{ fontSize: '0.7rem' }} /> });
  }
  if (collection.extent?.custom && Array.isArray(collection.extent.custom)) {
    collection.extent.custom.forEach((dim: any) => {
      if (dim.id) extentBadges.push({ label: dim.id, color: 'secondary' });
    });
  }

  // ── Licence ──────────────────────────────────────────────────────────────
  // Prefer the collection's own license link; fall back to the service-level one.
  const licenseLink = collection.links?.find((l) => l.rel === 'license');
  const license = licenseLink
    ? parseLicense(licenseLink.href, licenseLink.title)
    : fallbackLicense ?? null;

  // ── Spatial CRS ──────────────────────────────────────────────────────────
  const spatialCrs = collection.extent?.spatial?.crs || null;

  // ── Temporal interval ────────────────────────────────────────────────────
  let temporalDisplay: string | null = null;
  if (collection.extent?.temporal) {
    const norm = normalizeTemporal(collection.extent.temporal);
    if (norm && norm.intervals.length > 0) {
      const overall = getOverallTemporalExtent(norm.intervals);
      if (overall) temporalDisplay = formatTemporalInterval(overall[0], overall[1]);
    }
  }

  // ── Vertical interval ────────────────────────────────────────────────────
  let verticalDisplay: string | null = null;
  if (collection.extent?.vertical) {
    const norm = normalizeVertical(collection.extent.vertical);
    if (norm && norm.intervals.length > 0) {
      const overall = getOverallVerticalExtent(norm.intervals);
      if (overall) verticalDisplay = formatVerticalInterval(overall[0], overall[1], getVerticalUnit(norm.vrs));
    }
  }

  // ── Data queries ─────────────────────────────────────────────────────────
  const dataQueries = getSupportedDataQueries(collection);
  // If no EDR queries are declared but a rel=items link exists, synthesise an ITEMS entry.
  const hasItemsLink =
    dataQueries.length === 0 &&
    collection.links?.some(
      (l) => l.rel === 'items' || l.rel === 'http://www.opengis.net/def/rel/ogc/1.0/items',
    );
  const effectiveQueries = hasItemsLink ? ['items'] : dataQueries;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <Box>
      {/* 0. Validation status — before title, no separator */}
      {validationErrors != null && (
        <Box sx={{ mb: 0.5 }}>
          {validationErrors.length === 0 ? (
            <Box sx={{ fontSize: '0.7rem', fontWeight: 500, color: 'success.main' }}>
              ✓ Valid
            </Box>
          ) : (
            <Box sx={{ fontSize: '0.7rem', fontWeight: 500, color: 'warning.main' }}>
              ⚠ {validationErrors.length} {validationErrors.length === 1 ? 'issue' : 'issues'}
            </Box>
          )}
        </Box>
      )}

      {/* 1. Title */}
      <Typography
        variant="subtitle1"
        component="div"
        sx={{ fontWeight: 600, lineHeight: 1.3, mb: '2px', color: textPrimary }}
      >
        {collection.title || collection.id}
      </Typography>

      {/* 2. ID caption — only when a distinct title exists */}
      {collection.title && (
        <Box sx={{
          fontSize: '0.7rem',
          color: dark ? 'rgba(255,255,255,0.38)' : 'text.disabled',
          mb: 1,
        }}>
          {collection.id}
        </Box>
      )}

      {/* 3. Available extents */}
      {extentBadges.length > 0 && (
        <Box sx={{ display: 'flex', gap: '4px', flexWrap: 'wrap', mb: 0.75 }}>
          {extentBadges.map((badge, idx) => (
            <Chip
              key={`${badge.label}-${idx}`}
              label={badge.label}
              icon={badge.icon}
              size="small"
              color={dark ? 'default' : badge.color}
              variant={dark ? 'outlined' : 'filled'}
              sx={{
                ...chipBaseSx,
                '& .MuiChip-icon': { marginLeft: '4px' },
                ...(dark
                  ? { backgroundColor: 'rgba(255,255,255,0.15)' }
                  : {}),
              }}
            />
          ))}
        </Box>
      )}

      {/* 4. Description (with optional thumbnail) */}
      {collection.description && (
        <Box sx={{ position: 'relative', mb: 0.5 }}>
          {collection.assets?.thumbnail?.href && (
            <Box
              component="img"
              src={collection.assets.thumbnail.href}
              alt={collection.assets.thumbnail.title ?? collection.title ?? 'Collection thumbnail'}
              sx={{
                float: 'right',
                width: 100,
                height: 100,
                objectFit: 'cover',
                borderRadius: 1,
                ml: 1.5,
                mb: 1,
              }}
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          )}
          <Typography
            variant="body2"
            component="span"
            sx={{
              color: textSecondary,
              ...(clampDescription && {
                display: '-webkit-box',
                WebkitLineClamp: 6,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }),
            }}
          >
            {collection.description}
          </Typography>
        </Box>
      )}

      {/* 5–10. Metadata rows: spatial CRS, temporal, vertical, itemType, licence */}
      {(spatialCrs || temporalDisplay || verticalDisplay || collection.itemType || license) && (
        <>
          <Divider sx={{ my: 1.25, borderColor: dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)' }} />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {spatialCrs && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Public sx={{ fontSize: '15px', color: dark ? 'rgba(255,255,255,0.32)' : '#c5c5c5', flexShrink: 0 }} />
                <Box sx={{ fontSize: '0.75rem', color: textSecondary }}>{spatialCrs}</Box>
              </Box>
            )}
            {temporalDisplay && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AccessTime sx={{ fontSize: '15px', color: dark ? 'rgba(255,255,255,0.32)' : '#c5c5c5', flexShrink: 0 }} />
                <Box sx={{ fontSize: '0.75rem', color: textSecondary }}>{temporalDisplay}</Box>
              </Box>
            )}
            {verticalDisplay && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Height sx={{ fontSize: '15px', color: dark ? 'rgba(255,255,255,0.32)' : '#c5c5c5', flexShrink: 0 }} />
                <Box sx={{ fontSize: '0.75rem', color: textSecondary }}>{verticalDisplay}</Box>
              </Box>
            )}
            {collection.itemType && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Category sx={{ fontSize: '15px', color: dark ? 'rgba(255,255,255,0.32)' : '#c5c5c5', flexShrink: 0 }} />
                <Box sx={{ fontSize: '0.75rem', color: textSecondary }}>{collection.itemType}</Box>
              </Box>
            )}
            {license && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Balance sx={{ fontSize: '15px', color: dark ? 'rgba(255,255,255,0.32)' : '#c5c5c5', flexShrink: 0 }} />
                <Link
                  href={license.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ fontSize: '0.75rem', color: textSecondary, textDecorationColor: 'inherit' }}
                >
                  {license.label}
                </Link>
              </Box>
            )}
          </Box>
        </>
      )}

      {/* 10. Keywords */}
      {collection.keywords && collection.keywords.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Box sx={sectionLabelSx}>Keywords</Box>
          <Box
            sx={{
              '& .MuiChip-root': {
                borderRadius: '4px',
                ...(dark
                  ? {
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      borderColor: 'rgba(255,255,255,0.17)',
                      color: 'rgba(255,255,255,0.60)',
                    }
                  : {
                      backgroundColor: 'action.hover',
                      borderColor: 'divider',
                    }),
              },
            }}
          >
            <KeywordChips keywords={collection.keywords} size="small" maxVisible={5} />
          </Box>
        </Box>
      )}

      {/* 11. Data queries */}
      {effectiveQueries.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Box sx={sectionLabelSx}>Queries</Box>
          <Box sx={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {effectiveQueries.map((queryType) => (
              <Chip
                key={queryType}
                label={queryType.toUpperCase()}
                size="small"
                color={dark ? 'default' : 'primary'}
                variant="filled"
                sx={{
                  ...chipBaseSx,
                  borderRadius: '4px',
                  ...(dark && {
                    backgroundColor: 'rgba(255,255,255,0.18)',
                    color: 'rgba(255,255,255,0.92)',
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.25)' },
                  }),
                }}
              />
            ))}
          </Box>
        </Box>
      )}

    </Box>
  );
}
