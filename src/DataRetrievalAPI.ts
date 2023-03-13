import axios from 'axios';

export interface dataQueries {
    link: Link;
  }

export interface Link {
    title?: string;
    href: string;
    rel: string;
    type: string;
    variables: any;
}

export interface Spatial {
    bbox: number[];
    crs: string;
} 

export interface Extent {
    spatial: Spatial;
    temporal: any;
} 

export interface parameterNames {
    id: string;
    type: string;
    label?: string;
    description?: string;
    observedProperty: any;
}

export interface Collection {
  id: string;
  title?: string;
  description?: string;
  keywords?: string[];
  links: Link[];
  data_queries: dataQueries[];
  extent: Extent;
  crs: string[];
  output_formats: string[];
  parameter_names: parameterNames[];
}

interface CollectionsResponse {
  collections: Collection[];
}

export async function getCollections(apiUrl: string): Promise<Collection[]> {

  //const response = await axios.get<CollectionsResponse>(apiUrl,{ headers: {'Authorization': 'eyJvcmciOiI1ZTU1NGUxOTI3NGE5NjAwMDEyYTNlYjEiLCJpZCI6ImQ3NmZjMDUwNzI0ZjQ0ZmVhMzU5Y2FmNmI0MjQ0OWJhIiwiaCI6Im11cm11cjEyOCJ9'}});
  const response = await axios.get<CollectionsResponse>(apiUrl);
  return response.data.collections;
}
