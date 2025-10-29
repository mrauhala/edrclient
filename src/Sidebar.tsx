import Paper from '@mui/material/Paper';
import List from '@mui/material/List';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import Collapse from '@mui/material/Collapse';
import LayersIcon from '@mui/icons-material/Layers';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import Box from '@mui/material/Box';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import FormControl from '@mui/material/FormControl';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Button from '@mui/material/Button';
import Select, { SelectChangeEvent } from '@mui/material/Select';
import React, { useEffect, useState } from 'react';
import { getCollections, Collection, ValidationResult, normalizeBbox } from './DataRetrievalAPI';
import FormatForm from './FormatForm';
import ParameterForm from './ParameterForm';
import QueryForm from './QueryForm';
import ValidationResults from './ValidationResult';
import SchemaInspector from './SchemaInspector';

interface SidebarProps {
  open: boolean;
  boundingBox: [number, number, number, number];
  setBoundingBox: any;
  onClose: () => void;
  onCollectionExtentChange?: (extents: [number, number, number, number][] | null) => void;
}

const Sidebar = ({ open, onClose, boundingBox, setBoundingBox, onCollectionExtentChange }: SidebarProps) => {
  const [apiUrl, setApiUrl] = useState('https://opendata.fmi.fi/edr/collections');
  const [queryUrl, setQueryUrl] = useState('https://opendata.fmi.fi/edr/collections');
  const [collections, setCollections] = useState<Collection[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult>({ isValid: true, errors: null });
  const [showValidationDetails, setShowValidationDetails] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadCollections() {
      setIsLoading(true);
      try {
        const result = await getCollections(apiUrl);
        
        // Always update collections if they exist, even if validation fails
        if (result.collections && result.collections.length > 0) {
          setCollections(result.collections);
        }
        
        // Update validation result
        setValidationResult(result.validation);
      } catch (error) {
        console.error('Error loading collections:', error);
        setValidationResult({
          isValid: false,
          errors: [{ message: error instanceof Error ? error.message : 'Unknown error loading collections' }]
        });
        // Don't clear collections on error - keep previous state
      } finally {
        setIsLoading(false);
      }
    }

    loadCollections();
  }, [apiUrl]);

  const [menuOpen, setMenuOpen] = useState(Array(collections.length).fill(false));

  function handleApiUrlChange(event: React.ChangeEvent<HTMLInputElement>) {
    setApiUrl(event.target.value);
  }

  const handleItemClick = (index: number, key: string) => {
    const newOpen = [...menuOpen];
    newOpen[index] = !newOpen[index];
    setMenuOpen(newOpen);
    setQueryUrl(apiUrl+"/"+key);
    
    // Find the collection and trigger extent change
    const collection = collections[index];
    if (collection && collection.extent && collection.extent.spatial && collection.extent.spatial.bbox) {
      const normalizedBboxes = normalizeBbox(collection.extent.spatial.bbox);
      if (normalizedBboxes && onCollectionExtentChange) {
        onCollectionExtentChange(normalizedBboxes);
      }
    } else if (onCollectionExtentChange) {
      // Clear extent if collection doesn't have valid bbox
      onCollectionExtentChange(null);
    }
  };

  const [crs, setCRS] = React.useState('');
  const handleCRS = (event: SelectChangeEvent) => {
    setCRS(event.target.value as string);
  };

  const toggleValidationDetails = () => {
    setShowValidationDetails(!showValidationDetails);
  };

  return (
    <Paper style={{minWidth: 200, maxHeight: '100vh', overflow: 'auto'}}>
      <Card sx={{ minWidth: 275 }}>
        <CardContent>
          <Box sx={{ mb: 2 }}>
            Current query URL: {queryUrl}
          </Box>
          
          <ValidationResults 
            validation={validationResult} 
            expanded={showValidationDetails} 
          />
          
          {validationResult.errors && validationResult.errors.length > 0 && (
            <Button 
              variant="outlined" 
              size="small" 
              onClick={toggleValidationDetails}
              sx={{ mb: 2 }}
            >
              {showValidationDetails ? 'Hide Details' : 'Show Details'}
            </Button>
          )}
        </CardContent>
      </Card>
      
      <Box sx={{ padding: 1, minWidth: 120 }}>
        <TextField 
          sx={{ padding: 1, width: '90%' }} 
          id="apiUrl" 
          label="API URL" 
          value={apiUrl}
          variant="outlined" 
          onChange={handleApiUrlChange}
        />
        <Button 
          variant="contained" 
          sx={{ mt: 1, mr: 1 }}
          disabled={isLoading}
          onClick={() => getCollections(apiUrl)}
        >
          {isLoading ? 'Loading...' : 'Validate'}
        </Button>
        <SchemaInspector />
      </Box>
      
      <List component="nav">
        {collections.map((collection, index) => (
          <React.Fragment key={collection.id || index}>
            <ListItemButton onClick={() => handleItemClick(index, collection.id)}>
              <ListItemIcon>
                <LayersIcon />
              </ListItemIcon>
              <ListItemText 
                primary={collection.title ? collection.title : collection.id} 
                secondary={collection.description ? collection.description : null} 
              />
              {menuOpen[index] ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
            
            <Collapse in={menuOpen[index]} timeout="auto" unmountOnExit>
              {typeof collection.id == "undefined" 
                ? <Alert severity="error"><AlertTitle>A: ID</AlertTitle>"Every Collection within a collections array MUST have a unique (within the array) id parameter.</Alert>
                : <Alert severity="success"><AlertTitle>A: ID</AlertTitle>{collection.id}</Alert>
              }

              {/* Rest of your existing collection properties alerts */}
              { typeof collection.title == "undefined" 
                ? <Alert severity="warning"><AlertTitle>B: TITLE</AlertTitle>Every Collection within a collections array SHOULD have a title parameter.</Alert> 
                : <Alert severity="success"><AlertTitle>B: TITLE</AlertTitle>{collection.title}</Alert>
              }

              { typeof collection.description == "undefined" 
                ? <Alert severity="warning"><AlertTitle>C: DESCRIPTION</AlertTitle>Every Collection within a collections array SHOULD have a description parameter.</Alert> 
                : <Alert severity="success"><AlertTitle>C: DESCRIPTION</AlertTitle>{collection.description}</Alert>
              }

              { typeof collection.keywords == "undefined" 
                ? <Alert severity="warning"><AlertTitle>D: KEYWORDS</AlertTitle>Every Collection within a collections array SHOULD have a keywords parameter.</Alert> 
                : <Alert severity="success"><AlertTitle>D: KEYWORDS</AlertTitle>{collection.keywords.join(', ')}</Alert>
              }

              { typeof collection.links == "undefined" 
                ? <Alert severity="error"><AlertTitle>E: LINKS</AlertTitle>Every Collection within a collections array MUST have a links parameter.</Alert> 
                : <Alert severity="success"><AlertTitle>E: LINKS</AlertTitle>{collection.links.map((link, i) => (<div key={i}><Link href={link.href}>{link.title ? link.title : link.rel}</Link> ({link.rel})</div> ))}</Alert>
              }

              { typeof collection.data_queries == "undefined"
                ? <Alert severity="error"><AlertTitle>F: DATA_QUERIES</AlertTitle>Every collection within a collections array MUST have a data_queries parameter.</Alert>
                : <QueryForm queryUrl={queryUrl} queries={collection.data_queries} setQueryUrl={setQueryUrl}/> 
              }
              
              
              { typeof collection.extent != "undefined" && collection.extent.spatial.bbox && collection.extent.spatial.crs ?
              <Box sx={{ padding: 0, minWidth: 120 }}>
                <Alert severity="success"><AlertTitle>G: EXTENT</AlertTitle>
                  {collection.extent.spatial.crs}<br/>
                  {Array.isArray(collection.extent.spatial.bbox[0]) 
                    ? (collection.extent.spatial.bbox as number[][]).map((bbox, idx) => (
                        <div key={idx}>
                          Bbox {idx + 1}: [{bbox.join(', ')}]
                        </div>
                      ))
                    : `[${(collection.extent.spatial.bbox as number[]).join(', ')}]`
                  }
                </Alert>
                {!Array.isArray(collection.extent.spatial.bbox[0]) && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    <AlertTitle>Legacy bbox format</AlertTitle>
                    This collection uses a flat array format instead of the EDR standard array-of-bbox-arrays format.
                  </Alert>
                )}
                <Button 
                  variant="outlined" 
                  size="small" 
                  sx={{ mt: 1, mb: 1 }}
                  onClick={() => {
                    if (onCollectionExtentChange) {
                      const normalizedBboxes = normalizeBbox(collection.extent.spatial.bbox);
                      if (normalizedBboxes) {
                        onCollectionExtentChange(normalizedBboxes);
                      }
                    }
                  }}
                >
                  Zoom to Extent{Array.isArray(collection.extent.spatial.bbox[0]) && collection.extent.spatial.bbox.length > 1 ? 's' : ''}
                </Button>
                <FormControl fullWidth>
                  <InputLabel id="crs-select-label">CRS</InputLabel>
                  <Select
                    labelId="crs-select-label"
                    id="crs-select"
                    value={crs}
                    label="CRS"
                    onChange={handleCRS}
                  >
                      <MenuItem value={collection.extent.spatial.crs}>{collection.extent.spatial.crs}</MenuItem>
                  </Select>
                </FormControl>
              </Box> : <Alert severity="error"><AlertTitle>G: EXTENT</AlertTitle>Every collection within a collections array MUST have an extent parameter.</Alert> }

              { typeof collection.crs == "undefined" 
                ? <Alert severity="error"><AlertTitle>H: CRS</AlertTitle>Every collection within a collections array MUST have a crs parameter.</Alert> 
                : <Alert severity="success"><AlertTitle>H: CRS</AlertTitle>{collection.crs}</Alert>
              }
              
              { typeof collection.output_formats == "undefined" 
                ? <Alert severity="error"><AlertTitle>I: OUTPUT_FORMATS</AlertTitle>Every collection within a collections array MUST have an output_formats parameter.</Alert>
                : <FormatForm queryUrl={queryUrl} formats={collection.output_formats} setQueryUrl={setQueryUrl}/> 
              }

              { typeof collection.parameter_names == "undefined"
                ? <Alert severity="error"><AlertTitle>J: PARAMETER_NAMES</AlertTitle>Every collection within a collections array MUST have a parameter_names parameter.</Alert>
                : <ParameterForm queryUrl={queryUrl} parameters={collection.parameter_names} setQueryUrl={setQueryUrl}/> 
              }
            </Collapse>
          </React.Fragment>
        ))}
      </List>
    </Paper>
  );
};

export default Sidebar;