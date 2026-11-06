import type { SxProps, Theme } from '@mui/material/styles';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import DataObjectIcon from '@mui/icons-material/DataObject';
import MapIcon from '@mui/icons-material/Map';
import TuneIcon from '@mui/icons-material/Tune';
import ViewListIcon from '@mui/icons-material/ViewList';
import { usePanes } from './contexts/PanesContext';
import type { Pane } from './panes';

const PANES: { pane: Pane; label: string; shortcut: string; Icon: typeof MapIcon }[] = [
  { pane: 'api', label: 'API', shortcut: 'A', Icon: ViewListIcon },
  { pane: 'request', label: 'Request', shortcut: 'B', Icon: TuneIcon },
  { pane: 'map', label: 'Map', shortcut: 'M', Icon: MapIcon },
  { pane: 'response', label: 'Response', shortcut: 'R', Icon: DataObjectIcon },
];

// Which panes show. Side by side each one opens and closes; on a phone, where one shows at a time, this switches between them
export default function PaneToggles({ sx }: { sx?: SxProps<Theme> }) {
  const { isOpen, isMobile, togglePane, showPane } = usePanes();
  return (
    <ToggleButtonGroup size="small" aria-label="Panes" sx={[{ flexShrink: 0 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      {PANES.map(({ pane, label, shortcut, Icon }) => (
        <Tooltip key={pane} title={isMobile ? label : `${label} (${shortcut})`}>
          <ToggleButton
            value={pane}
            selected={isOpen[pane]}
            aria-label={label}
            onClick={() => (isMobile ? showPane(pane) : togglePane(pane))}
          >
            <Icon fontSize="small" />
          </ToggleButton>
        </Tooltip>
      ))}
    </ToggleButtonGroup>
  );
}
