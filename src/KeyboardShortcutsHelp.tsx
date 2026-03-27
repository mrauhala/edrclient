import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';

const shortcuts = [
  { key: 'B', description: 'Toggle sidebar' },
  { key: 'S', description: 'Toggle settings drawer' },
  { key: 'L', description: 'Toggle layers popover' },
  { key: 'V', description: 'Toggle validation popover' },
  { key: 'I', description: 'Toggle collection info' },
  { key: '/', description: 'Toggle search' },
  { key: '?', description: 'Show this help' },
  { key: 'PageUp', description: 'Previous collection' },
  { key: 'PageDown', description: 'Next collection' },
  { key: 'Cmd/Ctrl + Enter', description: 'Fetch data' },
];

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsHelp({ open, onClose }: KeyboardShortcutsHelpProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Keyboard Shortcuts
        <IconButton onClick={onClose} size="small" aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Table size="small">
          <TableBody>
            {shortcuts.map(({ key, description }) => (
              <TableRow key={key}>
                <TableCell sx={{ width: '40%' }}>
                  <Typography
                    component="kbd"
                    sx={{
                      px: 1,
                      py: 0.25,
                      borderRadius: 0.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: 'action.hover',
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                    }}
                  >
                    {key}
                  </Typography>
                </TableCell>
                <TableCell>{description}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
