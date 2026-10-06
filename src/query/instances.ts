import type { Collection } from '../types/api';
import type { QueryIssue } from './types';

// An instance (e.g. a model run) has a collection's shape: its own extent, parameters and data
// queries. The query model builds instance queries against it like against a collection.
export type Instance = Collection;

// When an instance's data starts, for ordering runs; missing or unparsable sorts last
function startOf(instance: Instance): number {
  const start = instance.extent?.temporal?.interval?.[0]?.[0];
  const time = start ? Date.parse(start) : NaN;
  return isNaN(time) ? -Infinity : time;
}

// Latest run first: by when the data starts, then by id (FMI 20261006T000000, MeteoCore ISO times)
export function sortInstancesNewestFirst(instances: Instance[]): Instance[] {
  return [...instances].sort((a, b) =>
    (startOf(b) - startOf(a)) || String(b.id).localeCompare(String(a.id), undefined, { numeric: true }));
}

// The instance's own URL: its self link, else the list URL plus its id (ids may hold ':')
export function instanceUrl(instance: Instance, listHref: string): string {
  const self = (instance.links ?? []).find(link => link.rel === 'self' && typeof link.href === 'string');
  if (self) return self.href as string;
  const url = new URL(listHref);
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/${encodeURIComponent(String(instance.id))}`;
  url.search = '';
  return url.toString();
}

// The request while the instance or its query is still to be picked: the list of instances, or
// the picked instance's description
export function instanceStep(listHref: string, instance: Instance | null): { url: string; issues: QueryIssue[] } {
  if (!instance) {
    return {
      url: listHref,
      issues: [{
        id: 'edr:instance:list', severity: 'info', source: 'edr', field: 'instance', input: 'form',
        message: "No instance picked: the request lists the collection's instances (e.g. model runs). Pick one to query it.",
      }],
    };
  }
  return {
    url: instanceUrl(instance, listHref),
    issues: [{
      id: 'edr:instance-query:required', severity: 'missing', source: 'edr', field: 'instance-query', input: 'form',
      message: 'Pick a query to run on this instance',
    }],
  };
}
