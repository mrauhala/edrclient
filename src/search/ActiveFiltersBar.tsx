import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';

interface ActiveFiltersBarProps {
  filters: Record<string, string>;
  onRemove: (property: string) => void;
  onClearAll: () => void;
}

export function ActiveFiltersBar({ filters, onRemove, onClearAll }: ActiveFiltersBarProps) {
  const entries = Object.entries(filters);
  if (entries.length === 0) return null;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.5, borderBottom: 1, borderColor: 'divider', flexWrap: 'wrap' }}>
      <Typography
        variant="caption"
        sx={{ fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'text.secondary', flexShrink: 0 }}
      >
        Filters
      </Typography>
      {entries.map(([key, value]) => (
        <Chip
          key={key}
          label={`${key} = ${value}`}
          size="small"
          onDelete={() => onRemove(key)}
          sx={{
            height: 22,
            fontSize: '0.7rem',
            fontWeight: 500,
            bgcolor: 'primary.50',
            color: 'primary.dark',
            borderColor: 'primary.light',
            '& .MuiChip-deleteIcon': { fontSize: 14, color: 'primary.dark' },
          }}
        />
      ))}
      <Link
        component="button"
        variant="caption"
        onClick={onClearAll}
        sx={{ ml: 'auto', fontSize: '0.65rem', color: 'text.secondary', textDecoration: 'underline', flexShrink: 0 }}
      >
        Clear all
      </Link>
    </Box>
  );
}
