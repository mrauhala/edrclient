import { describe, expect, it } from 'vitest';
import { ServiceType } from '../types/ServiceType';
import services from './services.json';

describe('service presets', () => {
  it('have a label, an https URL and a known type', () => {
    for (const service of services) {
      expect(service.label.trim(), service.url).not.toBe('');
      expect(new URL(service.url).protocol, service.label).toBe('https:');
      expect(Object.values(ServiceType), service.label).toContain(service.type);
    }
  });

  it('are listed once', () => {
    expect(new Set(services.map(service => service.label)).size).toBe(services.length);
    const normalized = services.map(service => service.url.replace(/\/+$/, ''));
    expect(new Set(normalized).size).toBe(services.length);
  });

  it("keep DMI's trailing slash: without it DMI redirects, and the redirect has no CORS header", () => {
    expect(services).toContainEqual({ label: 'DMI Forecast', url: 'https://opendataapi.dmi.dk/v1/forecastedr/', type: 'EDR' });
  });

  it('include Instituto Hidrográfico', () => {
    expect(services).toContainEqual({ label: 'Instituto Hidrográfico (PT)', url: 'https://ogcapi.hidrografico.pt', type: 'EDR' });
  });
});
