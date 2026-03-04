import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';

interface KeywordChipsProps {
  keywords: string[];
  size?: 'small' | 'medium';
}

export default function KeywordChips({ keywords, size = 'small' }: KeywordChipsProps) {
  if (!keywords || keywords.length === 0) return null;

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {keywords.map((keyword) => (
        <Chip
          key={keyword}
          label={keyword}
          size={size}
          variant="outlined"
        />
      ))}
    </Box>
  );
}
