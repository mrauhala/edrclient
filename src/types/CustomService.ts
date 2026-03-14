export interface CustomService {
  id: string;
  name: string;
  url: string;
  username?: string;
  password?: string;
  apiKey?: string;
  apiKeyParam?: string; // The query parameter name for the API key (default: 'api-key')
  bearerToken?: string;
  customAuthHeader?: string; // Custom Authorization header value
}
