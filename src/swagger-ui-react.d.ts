declare module 'swagger-ui-react' {
  import { Component } from 'react';

  interface SwaggerUIProps {
    url?: string;
    spec?: object;
    [key: string]: any;
  }

  export default class SwaggerUI extends Component<SwaggerUIProps> {}
}
