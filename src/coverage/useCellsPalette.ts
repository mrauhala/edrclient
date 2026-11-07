import { useMemo } from 'react';
import { useTheme } from '@mui/material/styles';
import type { CellsPalette } from './paintCells';

// The theme's colours for what's painted on a canvas
export function useCellsPalette(): CellsPalette {
  const { palette } = useTheme();
  return useMemo(() => ({
    mode: palette.mode,
    plot: palette.mode === 'dark' ? '#1a1a1a' : '#f7f7f7',
    text: palette.text.primary,
    textSecondary: palette.text.secondary,
    border: palette.divider,
    primary: palette.primary.main,
  }), [palette]);
}
