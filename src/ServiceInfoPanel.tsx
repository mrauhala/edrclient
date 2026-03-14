import { useState } from 'react';
import List from '@mui/material/List';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import Collapse from '@mui/material/Collapse';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ErrorIcon from '@mui/icons-material/Error';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import { ValidationResult, formatConformanceClass, Link as ApiLink, normalizeHref } from './DataRetrievalAPI';
import ValidationResults from './ValidationResult';
import KeywordChips from './KeywordChips';

interface ServiceInfoPanelProps {
  landingPageTitle: string | null;
  landingPageDescription: string | null;
  landingPageKeywords: string[] | null;
  conformsTo: string[] | null;
  landingPageLinks: ApiLink[] | null;
  validationResult: ValidationResult;
  onConformanceClick: (url: string) => void;
}

const ServiceInfoPanel = ({
  landingPageTitle,
  landingPageDescription,
  landingPageKeywords,
  conformsTo,
  landingPageLinks,
  validationResult,
  onConformanceClick,
}: ServiceInfoPanelProps) => {
  const [showConformanceClasses, setShowConformanceClasses] = useState(false);
  const [showServiceLinks, setShowServiceLinks] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [showValidationDetails, setShowValidationDetails] = useState(false);

  return (
    <Card sx={{ minWidth: 275 }}>
      <CardContent>
        {/* Service Information from Landing Page */}
        {(landingPageTitle || landingPageDescription) && (
          <Box sx={{ mb: 2, p: 2, backgroundColor: 'rgba(25, 118, 210, 0.08)', borderRadius: 1 }}>
            {landingPageTitle && (
              <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 600 }}>
                {landingPageTitle}
              </Typography>
            )}
            {landingPageDescription && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {landingPageDescription}
              </Typography>
            )}
            {landingPageKeywords && landingPageKeywords.length > 0 && (
              <KeywordChips keywords={landingPageKeywords} />
            )}
          </Box>
        )}

        {/* OGC API Conformance Classes */}
        {conformsTo && conformsTo.length > 0 && (() => {
          const ogcApiConformance = conformsTo
            .map(url => ({
              url,
              formatted: formatConformanceClass(url)
            }))
            .filter(item => item.formatted !== null);

          const uniqueConformance = Array.from(
            new Map(ogcApiConformance.map(item => [item.url, item])).values()
          );

          if (uniqueConformance.length > 0) {
            return (
              <Box sx={{ mb: 2 }}>
                <ListItemButton
                  onClick={() => setShowConformanceClasses(!showConformanceClasses)}
                  sx={{
                    p: 1.5,
                    backgroundColor: 'rgba(76, 175, 80, 0.08)',
                    borderRadius: 1,
                    '&:hover': {
                      backgroundColor: 'rgba(76, 175, 80, 0.15)',
                    }
                  }}
                >
                  <ListItemText
                    primary={
                      <Typography variant="subtitle2" sx={{ color: 'success.main', fontWeight: 600 }}>
                        Conformance Classes ({uniqueConformance.length})
                      </Typography>
                    }
                  />
                  {showConformanceClasses ? <ExpandLess /> : <ExpandMore />}
                </ListItemButton>
                <Collapse in={showConformanceClasses} timeout="auto" unmountOnExit>
                  <Box sx={{ p: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {uniqueConformance.map((item, index) => (
                      <Tooltip key={index} title={item.url} arrow>
                        <Chip
                          label={item.formatted}
                          size="small"
                          color="success"
                          variant="outlined"
                          onClick={() => onConformanceClick(item.url)}
                          clickable
                          sx={{
                            fontSize: '0.7rem',
                            height: '22px',
                            cursor: 'pointer',
                            '&:hover': {
                              backgroundColor: 'rgba(76, 175, 80, 0.2)',
                            }
                          }}
                        />
                      </Tooltip>
                    ))}
                  </Box>
                </Collapse>
              </Box>
            );
          }
          return null;
        })()}

        {/* Service Links Section */}
        {landingPageLinks && landingPageLinks.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <ListItemButton
              onClick={() => setShowServiceLinks(!showServiceLinks)}
              sx={{
                p: 1.5,
                backgroundColor: 'rgba(156, 39, 176, 0.08)',
                borderRadius: 1,
                '&:hover': {
                  backgroundColor: 'rgba(156, 39, 176, 0.15)',
                }
              }}
            >
              <ListItemText
                primary={
                  <Typography variant="subtitle2" sx={{ color: 'secondary.main', fontWeight: 600 }}>
                    Service Links ({landingPageLinks.length})
                  </Typography>
                }
              />
              {showServiceLinks ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
            <Collapse in={showServiceLinks} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {landingPageLinks.map((link, index) => {
                  const normalizedHref = normalizeHref(link.href);
                  if (!normalizedHref) {
                    return null;
                  }
                  return (
                    <ListItemButton
                      key={index}
                      sx={{ pl: 3, py: 0.5 }}
                      component="a"
                      href={normalizedHref}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ListItemText
                        primary={
                          <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                            {link.title || link.rel || 'Link'}
                          </Typography>
                        }
                        secondary={
                          <>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', display: 'block' }}>
                              {link.rel && `rel: ${link.rel}`}
                              {link.type && ` • type: ${link.type}`}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', display: 'block', wordBreak: 'break-all' }}>
                              {normalizedHref}
                            </Typography>
                          </>
                        }
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            </Collapse>
          </Box>
        )}

        {/* Schema Validation Section */}
        <Box sx={{ mb: 2 }}>
          <ListItemButton
            onClick={() => setShowValidation(!showValidation)}
            sx={{
              p: 1.5,
              backgroundColor: !validationResult.isValid ? 'rgba(237, 108, 2, 0.08)' : 'rgba(46, 125, 50, 0.08)',
              borderRadius: 1,
              '&:hover': {
                backgroundColor: !validationResult.isValid ? 'rgba(237, 108, 2, 0.15)' : 'rgba(46, 125, 50, 0.15)',
              }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
              {!validationResult.isValid ? (
                <ErrorIcon sx={{ fontSize: 20, color: 'warning.main' }} />
              ) : (
                <CheckCircleIcon sx={{ fontSize: 20, color: 'success.main' }} />
              )}
              <ListItemText
                primary={
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Schema Validation Status
                    {!validationResult.isValid && (() => {
                      let failureCount = 0;
                      if (validationResult.landingPageValidation && !validationResult.landingPageValidation.isValid) failureCount++;
                      if (validationResult.collectionsValidation && !validationResult.collectionsValidation.isValid) failureCount++;
                      if (validationResult.conformanceValidation && !validationResult.conformanceValidation.isValid) failureCount++;

                      return failureCount > 0 ? (
                        <Chip
                          label={`${failureCount} issue${failureCount > 1 ? 's' : ''}`}
                          size="small"
                          color="warning"
                          sx={{ ml: 1, height: 20 }}
                        />
                      ) : null;
                    })()}
                  </Typography>
                }
              />
            </Box>
            {showValidation ? <ExpandLess /> : <ExpandMore />}
          </ListItemButton>
          <Collapse in={showValidation} timeout="auto" unmountOnExit>
            <Box sx={{ p: 2 }}>
              <ValidationResults
                validation={validationResult}
                expanded={showValidationDetails}
              />

              {validationResult.errors && validationResult.errors.length > 0 && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => setShowValidationDetails(!showValidationDetails)}
                  sx={{ mt: 1 }}
                >
                  {showValidationDetails ? 'Hide Details' : 'Show Details'}
                </Button>
              )}
            </Box>
          </Collapse>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ServiceInfoPanel;
