import type { AxiosRequestConfig } from 'axios';
import type { AuthCredentials } from '../types/api';

// Helper function to create axios config with basic auth if credentials are provided
export function getAxiosConfig(auth?: AuthCredentials): AxiosRequestConfig {
  const config: AxiosRequestConfig = {};

  if (auth) {
    // Custom Authorization header (takes precedence over all)
    if (auth.customAuthHeader) {
      config.headers = {
        'Authorization': auth.customAuthHeader
      };
    }
    // Bearer token authentication
    else if (auth.bearerToken) {
      config.headers = {
        'Authorization': `Bearer ${auth.bearerToken}`
      };
    }
    // Basic authentication
    else if (auth.username) {
      config.auth = {
        username: auth.username,
        password: auth.password || ''
      };
    }
  }

  return config;
}

// Helper function to add API key to URL if provided
export function addApiKeyToUrl(url: string, auth?: AuthCredentials): string {
  if (auth && auth.apiKey) {
    const urlObj = new URL(url);
    const paramName = auth.apiKeyParam || 'api-key';
    urlObj.searchParams.set(paramName, auth.apiKey);
    return urlObj.toString();
  }
  return url;
}
