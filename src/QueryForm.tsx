import Box from '@mui/material/Box';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';
import AlertTitle from '@mui/material/AlertTitle';
import React from 'react';
import { DataQueries, getSupportedDataQueries, Collection, normalizeHref } from './DataRetrievalAPI';


interface QueryFormProps {
  queryUrl: string;
  queries: DataQueries;
  setQueryUrl: (url: string) => void;
  collection?: Collection; // Optional: if provided, will use getSupportedDataQueries
}

const QueryForm = ({ queries, queryUrl, setQueryUrl, collection }: QueryFormProps) => {

  const [query, setQuery] = React.useState('');
  
  // Get supported queries - either from the collection helper or by filtering queries object
  const supportedQueryKeys = collection 
    ? getSupportedDataQueries(collection)
    : Object.keys(queries).filter(key => queries[key]?.link?.href);
  
  const handleQuery = (event: SelectChangeEvent) => {
    setQuery(event.target.value as string);
    const selectedKey = event.target.value;
    if (queries[selectedKey]?.link?.href) {
      const normalizedHref = normalizeHref(queries[selectedKey].link.href);
      if (normalizedHref) {
        setQueryUrl(normalizedHref);
      }
    }
  };

  return (
    <Box sx={{ padding: 0, minWidth: 120 }}>
    <Alert severity="success">
      <AlertTitle>F: DATA_QUERIES</AlertTitle>
      {supportedQueryKeys.map((key) => {
        const normalizedHref = normalizeHref(queries[key]?.link?.href);
        return normalizedHref ? (
          <div key={key}>
            <Link href={normalizedHref}>{queries[key].link.title ? queries[key].link.title : queries[key].link.rel}</Link> ({queries[key].link.rel})
          </div>
        ) : null;
      })}
    </Alert>
    <>
      {supportedQueryKeys.length > 0 ?

          <FormControl fullWidth>
                <InputLabel id="query-select-label">Query:</InputLabel>
                <Select
                  labelId="query-select-label"
                  id="query-select"
                  value={query}
                  label="Query"
                  onChange={handleQuery}
                >
                  {supportedQueryKeys.map((key) => (
                    <MenuItem key={key} value={key}>{key}</MenuItem>
                  ))}
                </Select>
              </FormControl>
        : null}
    </>
    </Box>
  );
};

export default QueryForm;
