import { useState } from 'react';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import InputBase from '@mui/material/InputBase';
import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import Popover from '@mui/material/Popover';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { useResponseCells } from '../contexts/responseCells';
import { shareText } from './cellFigures';
import CellThumb from './CellThumb';

const FILTER_FROM = 12;
const MONO = { fontFamily: 'monospace', fontSize: '0.75rem', lineHeight: '17px' };

// Which parameter's cells are drawn. Switching keeps the cell, the step and the zoom
export default function ParameterPicker() {
  const { picture, choose } = useResponseCells();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [filter, setFilter] = useState('');
  if (!picture) return null;
  const { cells, parameter } = picture;
  const list = cells.parameters;

  const name = (
    <Box component="span" sx={{ ...MONO, overflowWrap: 'anywhere', textAlign: 'left' }}>
      {parameter.id}{parameter.unit && <Box component="span" sx={{ color: 'text.secondary' }}> {parameter.unit}</Box>}
    </Box>
  );
  if (list.length === 1) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 30, minWidth: 0 }}>
        <CellThumb parameter={parameter} width={28} height={20} />
        {name}
      </Box>
    );
  }

  const shown = list.filter(each => each.id.toLowerCase().includes(filter.toLowerCase()));
  return (
    <>
      <ButtonBase
        aria-haspopup="listbox"
        aria-expanded={anchor !== null}
        onClick={event => {
          setFilter('');
          setAnchor(event.currentTarget);
        }}
        sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 30, minWidth: 0, px: 0.75, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
      >
        <CellThumb parameter={parameter} width={28} height={20} />
        {name}
        <Box component="span" sx={{ fontSize: '0.6875rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>{list.indexOf(parameter) + 1} of {list.length}</Box>
        <ArrowDropDownIcon fontSize="small" />
      </ButtonBase>
      <Popover
        open={anchor !== null}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { maxHeight: 420, minWidth: 260 } } }}
      >
        {list.length > FILTER_FROM && (
          <Box sx={{ px: 1.5, py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
            <InputBase autoFocus fullWidth placeholder="Find a parameter" value={filter} onChange={event => setFilter(event.target.value)} sx={{ fontSize: '0.8125rem' }} />
          </Box>
        )}
        <MenuList dense role="listbox">
          {shown.map(each => {
            const none = each.figures.numbers === 0;
            const share = each.figures.nulls / each.figures.total;
            return (
              <MenuItem
                key={each.id}
                role="option"
                selected={each.id === parameter.id}
                aria-selected={each.id === parameter.id}
                onClick={() => {
                  choose({ parameterId: each.id, litHover: null, litPinned: null, range: 'auto', setLo: null, setHi: null });
                  setAnchor(null);
                }}
                sx={{ gap: 1 }}
              >
                <CellThumb parameter={each} width={44} height={30} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ ...MONO, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{each.id}</Box>
                  {each.unit && <Box sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>{each.unit}</Box>}
                </Box>
                <Box sx={{ fontSize: '0.6875rem', color: none ? 'warning.main' : 'text.secondary', whiteSpace: 'nowrap' }}>
                  {none ? 'All null' : share > 0 ? `${shareText(share)} null` : ''}
                </Box>
              </MenuItem>
            );
          })}
        </MenuList>
      </Popover>
    </>
  );
}
