import Box from '@mui/material/Box';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import React from 'react';


interface FormatFormProps {
  formats: string[];
  queryUrl: string;
  setQueryUrl: any;
}

const FormatForm = ({ formats, queryUrl, setQueryUrl }: FormatFormProps) => {

  const [format, setFormat] = React.useState('');
  const handleFormat = (event: SelectChangeEvent) => {
    setFormat(event.target.value as string);
    queryUrl = event.target.value as string;
    setQueryUrl(event.target.value);
    console.log(queryUrl);
  };

  return (
    <Box sx={{ padding: 0, minWidth: 120 }}>
      <Alert severity="success"><AlertTitle>I: OUTPUT_FORMATS</AlertTitle>{formats.join(', ')}</Alert>
      <>
        {formats ?
          <FormControl fullWidth>
            <InputLabel id="format-select-label">Format</InputLabel>
            <Select
              labelId="format-select-label"
              id="format-select"
              value={format}
              label="Format"
              onChange={handleFormat}
            >
              {formats.map((format) => (
                <MenuItem value={format}>{format}</MenuItem>
              ))}
            </Select>
          </FormControl>
          : null}
      </>
    </Box>
  );
};

export default FormatForm;
