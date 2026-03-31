import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

interface Concept {
  id: string;
  title?: string;
  description?: string;
  url?: string;
}

interface Theme {
  concepts: Concept[];
  scheme?: string;
}

interface ThemeChipsProps {
  themes: Theme[];
  size?: 'small' | 'medium';
}

export default function ThemeChips({ themes, size = 'small' }: ThemeChipsProps) {
  if (!themes || themes.length === 0) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {themes.map((theme, themeIndex) => (
        <Box key={themeIndex}>
          {theme.scheme && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              {theme.scheme}
            </Typography>
          )}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {theme.concepts.map((concept) => {
              const label = concept.title || concept.id;

              const chip = concept.url ? (
                <Chip
                  key={concept.id}
                  label={label}
                  size={size}
                  variant="outlined"
                  color="primary"
                  component="a"
                  href={concept.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  clickable
                  icon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                />
              ) : (
                <Chip
                  key={concept.id}
                  label={label}
                  size={size}
                  variant="outlined"
                  color="primary"
                />
              );

              if (concept.description) {
                return (
                  <Tooltip key={concept.id} title={concept.description} arrow>
                    {chip}
                  </Tooltip>
                );
              }

              return chip;
            })}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

/** Type guard to check if a value looks like a themes array */
export function isThemesArray(value: unknown): value is Theme[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      'concepts' in item &&
      Array.isArray((item as Theme).concepts)
  );
}
