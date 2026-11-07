import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import { DataGrid, type GridColDef, type GridRenderCellParams, type GridSortModel } from '@mui/x-data-grid';
import { useResponseCells } from '../contexts/responseCells';
import { cellRows, sortedCells } from './cellSelection';
import StepBars from './StepBars';

const PAGE = 100;
const CHARACTER = 7.5;
const ROOM = 24;
const SORT_ICON = 24;

const NullMark = () => <Box component="span" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>null</Box>;
const renderValue = ({ value }: GridRenderCellParams) => (value === null || value === undefined ? <NullMark /> : String(value));

// One row per cell at this step, in exact values. Rows are built only for the page, so a million cells cost one page,
// and sorting by value is the fast way to the worst cells
export default function CellsTable({ onOpenCell }: { onOpenCell: () => void }) {
  const { picture, choices, choose } = useResponseCells();
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<GridSortModel>([]);
  const { flip } = choices;
  const cells = picture?.cells;
  const slice = picture?.slice ?? 0;

  const order = useMemo(() => {
    const [by] = sort;
    const parameter = by && cells ? cells.parameters[Number(by.field.slice(1))] : undefined;
    return parameter && cells ? sortedCells(parameter, cells, slice, by.sort === 'desc' ? -1 : 1) : null;
  }, [sort, cells, slice]);

  const rows = useMemo(() => (cells ? cellRows(cells, page * PAGE, (page + 1) * PAGE, order, slice, flip) : []), [cells, page, order, slice, flip]);

  // Wide enough for the exact values on this page, which are what a table is for
  const columns = useMemo((): GridColDef[] => {
    if (!cells) return [];
    const g = cells.geometry;
    const widest = (field: string, header: string) => rows.reduce((most, row) => Math.max(most, String(row[field] ?? '').length), header.length);
    const place = (field: string, headerName: string): GridColDef => ({ field, headerName, width: Math.ceil(widest(field, headerName) * CHARACTER) + ROOM, sortable: false });
    const where = g.kind === 'grid'
      ? [place('yi', 'y index'), place('xi', 'x index'), place('y', 'y'), place('x', 'x')]
      : g.kind === 'samples'
        ? [place('coverage', 'coverage'), place('x', 'x'), place('y', 'y')]
        : [place('composite', 'composite')];
    return [
      ...where,
      ...cells.parameters.map(({ id, unit }, index): GridColDef => {
        const headerName = unit ? `${id} (${unit})` : id;
        const field = `p${index}`;
        return { field, headerName, type: 'number', minWidth: Math.ceil(widest(field, headerName) * CHARACTER) + ROOM + SORT_ICON, flex: 1, renderCell: renderValue };
      }),
    ];
  }, [cells, rows]);

  if (!cells) return null;
  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', borderTop: '1px solid', borderColor: 'divider' }}>
      <StepBars />
      <DataGrid
        rows={rows}
        columns={columns}
        density="compact"
        disableColumnMenu
        disableRowSelectionOnClick
        paginationMode="server"
        sortingMode="server"
        rowCount={cells.cells}
        pageSizeOptions={[PAGE]}
        paginationModel={{ page, pageSize: PAGE }}
        onPaginationModelChange={next => setPage(next.page)}
        sortModel={sort}
        onSortModelChange={next => {
          setSort(next);
          setPage(0);
        }}
        onRowClick={({ id }) => {
          choose({ pin: Number(id) });
          onOpenCell();
        }}
        sx={{ border: 0, borderRadius: 0, flex: 1, minHeight: 0, fontFamily: 'monospace', fontSize: '0.75rem', '& .MuiDataGrid-columnHeaderTitle': { fontFamily: 'monospace' }, '& .MuiDataGrid-row': { cursor: 'pointer' } }}
      />
    </Box>
  );
}
