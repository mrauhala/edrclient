import { useId, useState } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import ExpandMore from '@mui/icons-material/ExpandMore';
import ExpandLess from '@mui/icons-material/ExpandLess';
import { useSidebar } from './contexts/SidebarContext';

export interface MapSelection {
  title: string;
  items: string[];
  footer?: string;
}

interface MapSelectionInfoProps extends MapSelection {
  borderColor: string;
}

// What the query has from the map: a numbered list under a header that collapses it. It starts
// collapsed on phones, where the list would cover the map, and its list scrolls once it's long
export default function MapSelectionInfo({ title, items, footer, borderColor }: MapSelectionInfoProps) {
  const { isMobile } = useSidebar();
  const [open, setOpen] = useState(!isMobile);
  const listId = useId();
  return (
    <Box
      sx={{
        bgcolor: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        borderRadius: '6px',
        border: `1px solid ${borderColor}`,
        boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
        fontFamily: 'monospace',
        fontSize: 12,
      }}
    >
      <ButtonBase
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen(!open)}
        sx={{ width: '100%', justifyContent: 'space-between', gap: 1, px: 1.5, py: 1, borderRadius: '6px', font: 'inherit', fontSize: 11, fontWeight: 'bold' }}
      >
        <Box component="span" sx={{ opacity: 0.7 }}>{title} ({items.length})</Box>
        {open ? <ExpandMore sx={{ fontSize: 18 }} /> : <ExpandLess sx={{ fontSize: 18 }} />}
      </ButtonBase>
      {open && (
        <Box id={listId} sx={{ px: 1.5, pb: 1 }}>
          <Box sx={{ maxHeight: '30vh', overflowY: 'auto', overscrollBehavior: 'contain' }}>
            {items.map((item, idx) => (
              <div key={idx} style={{ fontSize: '10px', marginTop: idx > 0 ? '4px' : '0' }}>
                {idx + 1}. {item}
              </div>
            ))}
          </Box>
          {footer && (
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.2)', fontWeight: 'bold' }}>
              {footer}
            </div>
          )}
        </Box>
      )}
    </Box>
  );
}
