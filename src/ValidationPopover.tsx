import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Badge from '@mui/material/Badge';
import Popover from '@mui/material/Popover';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import ButtonBase from '@mui/material/ButtonBase';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import GppBadIcon from '@mui/icons-material/GppBad';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useValidation } from './contexts/ValidationContext';
import type { EndpointUrls, RawResponses } from './contexts/ValidationContext';
import type { ValidationError } from './DataRetrievalAPI';

function SectionStatus({ label, validation }: {
  label: string;
  validation?: { isValid: boolean; errors: ValidationError[] | null; schemaResults?: Array<{ schema: string; isValid: boolean }> };
}) {
  if (!validation) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <RemoveCircleOutlineIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
        <Typography variant="body2" color="text.secondary">{label}</Typography>
      </Box>
    );
  }

  const errorCount = validation.errors?.filter(e => e.type !== 'cors' && e.type !== 'network' && !e.section).length ?? 0;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {validation.isValid ? (
        <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
      ) : (
        <ErrorIcon sx={{ fontSize: 18, color: 'warning.main' }} />
      )}
      <Typography variant="body2" sx={{ flex: 1 }}>{label}</Typography>
      {errorCount > 0 && (
        <Typography variant="caption" color="text.secondary">
          {errorCount} {errorCount === 1 ? 'error' : 'errors'}
        </Typography>
      )}
    </Box>
  );
}

function getUrlForSection(section: string | undefined, urls: EndpointUrls): string | undefined {
  switch (section) {
    case 'Landing Page': return urls.landingPage;
    case 'Conformance': return urls.conformance;
    case 'Collections': return urls.collections;
    case 'Locations': return urls.locations;
    default: return urls.collections;
  }
}

function getResponseForSection(section: string | undefined, responses: RawResponses): unknown | undefined {
  switch (section) {
    case 'Landing Page': return responses.landingPage;
    case 'Conformance': return responses.conformance;
    case 'Collections': return responses.collections;
    case 'Locations': return responses.locations;
    default: return responses.collections;
  }
}

const ValidationPopover: React.FC = () => {
  const { validationResult, endpointUrls, rawResponses } = useValidation();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  // Close when layers popover opens; listen for keyboard toggle
  useEffect(() => {
    const handleClose = () => setAnchorEl(null);
    const handleToggle = () => {
      const btn = document.getElementById('validation-button') as HTMLButtonElement | null;
      if (btn) setAnchorEl(prev => prev ? null : btn);
    };
    document.addEventListener('close-validation-popover', handleClose);
    document.addEventListener('toggle-validation-popover', handleToggle);
    return () => {
      document.removeEventListener('close-validation-popover', handleClose);
      document.removeEventListener('toggle-validation-popover', handleToggle);
    };
  }, []);

  const open = Boolean(anchorEl);
  const hasService = validationResult.schemaCount !== undefined || validationResult.errors !== null;
  const errorCount = validationResult.errors?.length ?? 0;
  const isValid = validationResult.isValid && errorCount === 0;

  const errorsBySchema = useMemo(() => {
    const errors = validationResult.errors;
    if (!errors || errors.length === 0) return new Map<string, ValidationError[]>();

    const grouped = new Map<string, ValidationError[]>();
    for (const error of errors) {
      const key = (typeof error.schema === 'string' && error.schema) || error.section || 'General';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(error);
    }
    return grouped;
  }, [validationResult.errors]);

  const handleErrorClick = useCallback((error: ValidationError) => {
    const url = getUrlForSection(error.section, endpointUrls);
    const responseData = getResponseForSection(error.section, rawResponses);
    if (!url || !responseData) return;

    // Gather all errors for the same section so they can all be highlighted
    const sectionErrors = validationResult.errors?.filter(
      e => (e.section || 'Collections') === (error.section || 'Collections')
    ) ?? [];

    document.dispatchEvent(new CustomEvent('open-validation-response', {
      detail: {
        url,
        section: error.section,
        scrollToPath: error.path,
        errors: sectionErrors,
        data: JSON.stringify(responseData, null, 2),
      },
    }));
    setAnchorEl(null);
  }, [endpointUrls, rawResponses, validationResult.errors]);

  if (!hasService) return null;

  return (
    <>
      <Tooltip title="Validation Results">
        <IconButton
          id="validation-button"
          size="small"
          color="inherit"
          aria-label="validation results"
          onClick={(e) => setAnchorEl(prev => {
            if (prev) return null;
            document.dispatchEvent(new Event('close-layers-popover'));
            document.dispatchEvent(new Event('close-search-popover'));
            return e.currentTarget;
          })}
        >
          <Badge
            badgeContent={errorCount}
            color="error"
            invisible={errorCount === 0}
          >
            {isValid ? <VerifiedUserIcon /> : <GppBadIcon />}
          </Badge>
        </IconButton>
      </Tooltip>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: { width: 400, maxHeight: 520 },
          },
        }}
      >
        {/* Header */}
        <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2">
            Validation Results {errorCount > 0 && `(${errorCount} ${errorCount === 1 ? 'error' : 'errors'})`}
          </Typography>
        </Box>

        {/* Traffic light summary */}
        <Box sx={{ px: 2, py: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75, borderBottom: 1, borderColor: 'divider' }}>
          <SectionStatus label="Landing Page" validation={validationResult.landingPageValidation} />
          <SectionStatus label="Collections" validation={validationResult.collectionsValidation} />
          <SectionStatus label="Conformance" validation={validationResult.conformanceValidation} />
          {validationResult.locationsValidation && (
            <SectionStatus label="Locations" validation={validationResult.locationsValidation} />
          )}
        </Box>

        {/* Error list or empty state */}
        {errorCount === 0 ? (
          <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircleIcon color="success" />
            <Typography variant="body2" color="text.secondary">
              No validation errors
            </Typography>
          </Box>
        ) : (
          <Box sx={{ overflow: 'auto', maxHeight: 360 }}>
            {Array.from(errorsBySchema.entries()).map(([schema, errors], groupIdx) => (
              <Box key={schema}>
                {groupIdx > 0 && <Divider />}
                <Typography
                  variant="caption"
                  sx={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                    display: 'block',
                    px: 1.5,
                    py: 0.75,
                    bgcolor: 'background.paper',
                    borderBottom: 1,
                    borderColor: 'divider',
                    fontWeight: 600,
                  }}
                >
                  {schema}
                </Typography>
                {(() => {
                  // Group errors by section label within this schema group
                  const bySection: { key: string; label: string; items: ValidationError[] }[] = [];
                  const seen = new Map<string, ValidationError[]>();
                  for (const error of errors) {
                    const label = error.collectionId
                      ? `Collection: ${error.collectionId}`
                      : error.section || 'General';
                    const key = label;
                    if (!seen.has(key)) {
                      const group = { key, label, items: [] as ValidationError[] };
                      bySection.push(group);
                      seen.set(key, group.items);
                    }
                    seen.get(key)!.push(error);
                  }
                  return bySection.map((group) => (
                    <Box key={group.key}>
                      <Typography variant="caption" sx={{ display: 'block', px: 1.5, pt: 0.75, pb: 0.25, fontWeight: 600, color: 'info.main' }}>
                        {group.label}
                      </Typography>
                      {group.items.map((error, idx) => {
                        const msg = error.path && error.message.startsWith(error.path)
                          ? error.message.slice(error.path.length).replace(/^:\s*/, '')
                          : error.message;
                        const hasUrl = !!getUrlForSection(error.section, endpointUrls) && !!getResponseForSection(error.section, rawResponses);
                        return (
                          <ButtonBase
                            key={idx}
                            component="div"
                            disabled={!hasUrl}
                            onClick={() => handleErrorClick(error)}
                            sx={{
                              display: 'block',
                              width: '100%',
                              textAlign: 'left',
                              px: 1.5,
                              py: 0.5,
                              cursor: hasUrl ? 'pointer' : 'default',
                              borderRadius: 0.5,
                              '&:hover': hasUrl ? { bgcolor: 'action.hover' } : {},
                            }}
                          >
                            {error.path && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                                  {error.path}
                                </Typography>
                                {hasUrl && <OpenInNewIcon sx={{ fontSize: 10, color: 'text.disabled' }} />}
                              </Box>
                            )}
                            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, flexWrap: 'wrap' }}>
                              {error.keyword && (
                                <Chip label={error.keyword} size="small" variant="outlined" sx={{ fontSize: '0.6rem', height: 16 }} />
                              )}
                              <Typography variant="caption">{msg}</Typography>
                              {error.params?.missingProperty && (
                                <Typography variant="caption" color="error.main" sx={{ fontFamily: 'monospace', fontSize: '0.65rem' }}>
                                  missing: {error.params.missingProperty}
                                </Typography>
                              )}
                              {error.params?.allowedValues && (
                                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.65rem' }}>
                                  allowed: {error.params.allowedValues.slice(0, 5).join(', ')}{error.params.allowedValues.length > 5 ? '...' : ''}
                                </Typography>
                              )}
                              {error.data !== undefined && error.keyword !== 'required' && (
                                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.65rem' }}>
                                  got: {typeof error.data === 'object' ? JSON.stringify(error.data).slice(0, 60) : String(error.data).slice(0, 60)}
                                </Typography>
                              )}
                            </Box>
                          </ButtonBase>
                        );
                      })}
                    </Box>
                  ));
                })()}
              </Box>
            ))}
          </Box>
        )}
      </Popover>
    </>
  );
};

export default ValidationPopover;
