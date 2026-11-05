import { useMemo } from 'react';
import Box from '@mui/material/Box';
import { DataGrid, type GridColDef, type GridRenderCellParams } from '@mui/x-data-grid';
import type { CoverageSeries } from './coverage/coverageSummary';

export type CoverageRow = { id: string; time: string; location: string } & Record<string, unknown>;

// A null marked as one, so that it can't be taken for zero or a blank
const NullMark = () => <Box component="span" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>null</Box>;

// Exactly what the API sent: the grid would otherwise round a number to its locale's few digits
const renderValue = ({ value }: GridRenderCellParams) => (value === null || value === undefined ? <NullMark /> : String(value));

// Enough for text in the grid's monospace, and for a header's sort icon. These are what one looks a
// value up by, and a time's end is often what differs
const CHARACTER = 7.5;
const widthOf = (text: string, room = 24) => Math.ceil(text.length * CHARACTER) + room;
const longest = (texts: string[]) => texts.reduce((a, b) => (b.length > a.length ? b : a), '');

export function coverageColumns({ locations, parameters, rawTimes }: CoverageSeries): GridColDef[] {
  return [
    { field: 'time', headerName: 'Time', width: widthOf(longest(rawTimes)) },
    ...(locations.length > 1 ? [{ field: 'location', headerName: 'Location', width: widthOf(longest(['Location', ...locations])) }] : []),
    ...parameters.map(({ id, unit }, index): GridColDef => {
      const headerName = unit ? `${id} (${unit})` : id;
      return {
        // Not the id, which may have characters a field can't
        field: `p${index}`,
        headerName,
        type: 'number',
        minWidth: widthOf(headerName, 48),
        flex: 1,
        renderCell: renderValue,
      };
    }),
  ];
}

// One row per time, per location, in the order they came
export function coverageRows({ locations, parameters, rawTimes }: CoverageSeries): CoverageRow[] {
  return locations.flatMap((location, place) => rawTimes.map((time, index) => {
    const row: CoverageRow = { id: `${place}:${index}`, time, location };
    parameters.forEach(({ raw }, column) => {
      row[`p${column}`] = raw[place][index];
    });
    return row;
  }));
}

// The most the free grid shows at a time
const MOST_PER_PAGE = 100;

export default function CoverageTable({ series }: { series: CoverageSeries }) {
  const columns = useMemo(() => coverageColumns(series), [series]);
  const rows = useMemo(() => coverageRows(series), [series]);

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', borderTop: '1px solid', borderColor: 'divider' }}>
      <DataGrid
        rows={rows}
        columns={columns}
        density="compact"
        disableRowSelectionOnClick
        disableColumnMenu
        hideFooter={rows.length <= MOST_PER_PAGE}
        initialState={{ pagination: { paginationModel: { pageSize: MOST_PER_PAGE } } }}
        pageSizeOptions={[25, 50, MOST_PER_PAGE]}
        sx={{ border: 0, borderRadius: 0, flex: 1, minHeight: 0, fontFamily: 'monospace', fontSize: '0.75rem', '& .MuiDataGrid-columnHeaderTitle': { fontFamily: 'monospace' } }}
      />
    </Box>
  );
}
