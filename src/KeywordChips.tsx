import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';

interface KeywordChipsProps {
  keywords: string[];
  size?: 'small' | 'medium';
  /** When set, only show this many keywords and a "+N more" chip for the rest. */
  maxVisible?: number;
}

export default function KeywordChips({ keywords, size = 'small', maxVisible }: KeywordChipsProps) {
  if (!keywords || keywords.length === 0) return null;

  const hasOverflow = maxVisible != null && keywords.length > maxVisible;
  const visibleKeywords = hasOverflow ? keywords.slice(0, maxVisible) : keywords;
  const overflowCount = hasOverflow ? keywords.length - maxVisible : 0;

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {visibleKeywords.map((keyword) => (
        <Chip
          key={keyword}
          label={keyword}
          size={size}
          variant="outlined"
        />
      ))}
      {hasOverflow && (
        <Chip
          label={`+${overflowCount} more`}
          size={size}
          variant="outlined"
          disabled
        />
      )}
    </Box>
  );
}
