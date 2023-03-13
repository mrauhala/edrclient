import Box from '@mui/material/Box';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import React, { useEffect, useState } from 'react';
import { parameterNames } from './DataRetrievalAPI';


interface ParameterFormProps {
  parameters: parameterNames[];
  queryUrl: string;
  setQueryUrl: any;
}

const FormatForm = ({ parameters, queryUrl, setQueryUrl }: ParameterFormProps) => {

  const [parameter, setParameter] = React.useState('');
  const handleParameter = (event: SelectChangeEvent) => {
    setParameter(event.target.value as string);
    setQueryUrl(event.target.value);
    console.log(queryUrl);
  };

  return (
    <>
      {parameters ?
        <Box sx={{ padding: 0, minWidth: 120 }}>
          <Alert severity="success"><AlertTitle>J: PARAMETER_NAMES</AlertTitle>{Object.keys(parameters).join(', ')}</Alert>
          <FormControl fullWidth>
            <InputLabel id="parameter-select-label">Parameter</InputLabel>
            <Select
              labelId="parameter-select-label"
              id="parameter-select"
              value={parameter}
              label="Parameter"
              onChange={handleParameter}
            >
              {Object.keys(parameters).map((par) => (
                <MenuItem value={par}>{par}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box> : null}
    </>
  );
};

export default FormatForm;
