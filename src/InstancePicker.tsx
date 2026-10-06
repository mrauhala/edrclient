import React from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import ListItemText from '@mui/material/ListItemText';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import type { UseQueryUrlReturn } from './hooks/useQueryUrl';
import type { Instance } from './query/instances';

const idOf = (instance: Instance) => String(instance.id);

// An instances query: pick an instance (e.g. a model run, latest first; lists can hold hundreds)
// and the query to run on it
const InstancePicker: React.FC<{ queryState: UseQueryUrlReturn }> = ({ queryState }) => {
  const { instances, selectedInstance, selectInstance, instanceQueryKey, selectInstanceQuery } = queryState;
  const count = instances.status === 'ready' ? ` (${instances.instances.length}, latest first)` : '';

  return (
    <>
      <Box sx={{ mb: 2 }} id="query-field-instance">
        <Autocomplete
          size="small"
          options={instances.instances}
          value={selectedInstance}
          loading={instances.status === 'loading'}
          loadingText="Loading instances…"
          noOptionsText={instances.status === 'error' ? "Couldn't load the instances" : 'No instances'}
          getOptionLabel={idOf}
          isOptionEqualToValue={(option, value) => idOf(option) === idOf(value)}
          onChange={(_, instance) => selectInstance(instance ? idOf(instance) : '')}
          renderOption={(props, instance) => {
            const { key, ...optionProps } = props;
            return (
              <li key={key} {...optionProps}>
                <ListItemText primary={idOf(instance)} secondary={instance.title && instance.title !== idOf(instance) ? instance.title : undefined} />
              </li>
            );
          }}
          renderInput={params => <TextField {...params} label={`Instance${count}`} />}
        />
        {instances.status === 'error' && <FormHelperText error>Couldn't load the instances: {instances.error}</FormHelperText>}
      </Box>
      {selectedInstance && (
        <FormControl fullWidth size="small" sx={{ mb: 2 }} id="query-field-instance-query">
          <InputLabel id="instance-query-label">Query on this instance</InputLabel>
          <Select labelId="instance-query-label" label="Query on this instance" value={instanceQueryKey}
            onChange={event => selectInstanceQuery(event.target.value)}>
            <MenuItem value=""><em>Select a query</em></MenuItem>
            {Object.keys(selectedInstance.data_queries ?? {}).map(queryKey => (
              <MenuItem key={queryKey} value={queryKey}>{queryKey}</MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
    </>
  );
};

export default InstancePicker;
