import Box from '@mui/material/Box';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';
import AlertTitle from '@mui/material/AlertTitle';
import React, { useEffect, useState } from 'react';
import { dataQueries } from './DataRetrievalAPI';


interface QueryFormProps {
  queries: dataQueries[];
  queryUrl: string;
  setQueryUrl: any;
}

const QueryForm = ({ queries, queryUrl, setQueryUrl }: QueryFormProps) => {

  const [query, setQuery] = React.useState('');
  const handleQuery = (event: SelectChangeEvent) => {
    setQuery(event.target.value as string);
    setQueryUrl(event.target.value);
    console.log(queryUrl);
  };

  return (
    <Box sx={{ padding: 0, minWidth: 120 }}>
    <Alert severity="success">
      <AlertTitle>F: DATA_QUERIES</AlertTitle>
      {Object.entries(queries).map(([key, q]) => (<div><Link href={q.link.href}>{q.link.title ? q.link.title : q.link.rel}</Link> ({q.link.rel})</div>))}
    </Alert>
    <>
      {queries ?

          <FormControl fullWidth>
                <InputLabel id="query-select-label">Query:</InputLabel>
                <Select
                  labelId="query-select-label"
                  id="query-select"
                  value={query}
                  label="Query"
                  onChange={handleQuery}
                >
                  {Object.entries(queries).map(([key,q]) => (
                    <MenuItem value={key}>{key}</MenuItem>
                  ))}
                </Select>
              </FormControl>
        : null}
    </>
    </Box>
  );
};

export default QueryForm;
