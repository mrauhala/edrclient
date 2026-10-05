import type { Collection, ValidationError } from '../../types/api';
import { normalizeHref } from '../../utils/href';
import { EDR_QUERY_RULES } from '../../query/edrRules';
import { effectiveOutputFormats, parameterIdsOf, queryTypeOf, queryVariables, unitsFor } from '../../query/queryTypes';
import { findBrokenLocalRefs } from './refs';
import { matchOperation, type OperationIndex, type ResolvedParam } from './operationIndex';

const SCHEMA = 'EDR consistency';
const UNIT_PARAMS = new Set(['within-units', 'width-units', 'height-units']);
const MAX_LISTED = 3;

type Severity = NonNullable<ValidationError['severity']>;

// Findings keyed by rule and subject, so a problem shared by many collections (generic paths,
// or the same flaw repeated on hundreds of per-collection paths) is reported once
class Findings {
  private findings = new Map<string, { error: ValidationError; collections: Set<string> }>();

  add(key: string, severity: Severity, keyword: string, path: string, message: string, collectionId?: string) {
    let finding = this.findings.get(key);
    if (!finding) {
      finding = { error: { message, path, keyword, severity, section: 'OpenAPI', schema: SCHEMA, type: 'schema' }, collections: new Set() };
      this.findings.set(key, finding);
    }
    if (collectionId) finding.collections.add(collectionId);
  }

  list(): ValidationError[] {
    return [...this.findings.values()].map(({ error, collections }) => {
      if (collections.size === 0) return error;
      const ids = [...collections];
      const listed = ids.slice(0, MAX_LISTED).join(', ') + (ids.length > MAX_LISTED ? ` +${ids.length - MAX_LISTED} more` : '');
      return {
        ...error,
        message: `${error.message} (${ids.length === 1 ? 'collection' : `${ids.length} collections`}: ${listed})`,
        params: { collections: ids },
      };
    });
  }
}

const sameValue = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

// Values the collection offers that the parameter's enum doesn't allow
function notInEnum(param: ResolvedParam, offered: string[]) {
  const allowed = param.enumValues ?? [];
  return {
    missing: offered.filter(value => !allowed.some(option => sameValue(option, value))),
    caseOnly: offered.filter(value => !allowed.includes(value) && allowed.some(option => sameValue(option, value))),
  };
}

function lintParameterSchemas(index: OperationIndex, findings: Findings) {
  for (const entry of index.entries) {
    for (const param of entry.params) {
      const schema = param.schema;
      if (!schema) continue;
      if (schema.items !== undefined && schema.type === undefined) {
        findings.add(`items-without-array:${param.name}`, 'warning', 'schema-items-without-array', param.pointer,
          `Parameter ${param.name}: the schema has "items" but no "type": "array"`);
      }
      const type = schema.type;
      const types = Array.isArray(type) ? type : type === undefined ? [] : [type];
      if (UNIT_PARAMS.has(param.name) && types.length > 0 && !types.includes('string')) {
        findings.add(`unit-type:${param.name}`, 'warning', 'unit-not-string', param.pointer,
          `Parameter ${param.name} is typed ${types.join(' | ')}, but units are strings (e.g. km)`);
      }
    }
  }
}

function lintDataQueries(index: OperationIndex, collections: Collection[], findings: Findings) {
  for (const collection of collections) {
    for (const queryKey of Object.keys(collection.data_queries ?? {})) {
      const href = normalizeHref(collection.data_queries[queryKey]?.link?.href);
      if (!href) continue;
      const type = queryTypeOf(collection, queryKey);
      const match = matchOperation(index, href);
      if (!match) {
        findings.add(`no-operation:${type}`, 'warning', 'missing-operation', '/paths',
          `The API docs describe no GET operation for ${type} queries`, collection.id);
        continue;
      }
      if (match.via === 'suffix') {
        findings.add('servers-prefix', 'info', 'servers-mismatch', '/servers',
          "Operations match only when the servers URL is ignored: check the document's servers", collection.id);
      }

      // Keyed by query type, not path: per-collection documents repeat the same flaw on every path
      const { entry } = match;
      const queryParam = (name: string) => entry.params.find(param => param.in === 'query' && param.name === name);
      const rule = EDR_QUERY_RULES[type];
      if (rule) {
        for (const name of rule.required) {
          const param = queryParam(name);
          if (!param) {
            findings.add(`undeclared:${type}:${name}`, 'warning', 'edr-required-undeclared', entry.pointer,
              `${type} queries: the API docs don't declare ${name}, which EDR requires`, collection.id);
          } else if (!param.required) {
            findings.add(`optional:${type}:${name}`, 'info', 'edr-required-optional', param.pointer,
              `${type} queries: the API docs mark ${name} optional; EDR requires it`, collection.id);
          }
        }
        for (const param of entry.params) {
          if (param.in === 'query' && param.required && !rule.required.includes(param.name)) {
            findings.add(`over-required:${type}:${param.name}`, 'warning', 'required-beyond-edr', param.pointer,
              `${type} queries: the API docs require ${param.name}, which EDR doesn't`, collection.id);
          }
        }
      }

      const formats = effectiveOutputFormats(collection, queryKey);
      const f = queryParam('f');
      if (!f && formats.length > 1) {
        // A data query without f can't pick its format; for list requests it's only a gap in the docs
        const listsOnly = !rule || rule.geometry === 'none';
        findings.add(`no-f:${type}`, listsOnly ? 'info' : 'warning', 'f-undeclared', entry.pointer,
          `${type} queries: the API docs don't declare f, though the collection offers several output formats`, collection.id);
      }
      if (f?.enumValues) {
        const { missing, caseOnly } = notInEnum(f, formats);
        missing.forEach(format => findings.add(`f-enum:${type}:${format}`, 'warning', 'enum-vs-metadata', f.pointer,
          `${type} queries: f doesn't allow ${format}, which the collection offers`, collection.id));
        caseOnly.forEach(format => findings.add(`f-case:${type}:${format}`, 'info', 'enum-case', f.pointer,
          `${type} queries: f allows ${format} only in different letter case`, collection.id));
      }

      const withinUnits = queryParam('within-units');
      if (type === 'radius' && withinUnits?.enumValues) {
        notInEnum(withinUnits, unitsFor(queryVariables(collection, queryKey), 'within')).missing.forEach(unit =>
          findings.add(`within-units-enum:${unit}`, 'warning', 'enum-vs-metadata', withinUnits.pointer,
            `radius queries: within-units doesn't allow ${unit}, which the collection lists in within_units`, collection.id));
      }

      const parameterName = queryParam('parameter-name');
      if (parameterName?.enumValues) {
        const { missing } = notInEnum(parameterName, parameterIdsOf(collection));
        if (missing.length > 0) {
          findings.add(`parameter-name-enum:${type}`, 'warning', 'enum-vs-metadata', parameterName.pointer,
            `${type} queries: parameter-name doesn't allow all of the collection's parameter_names (e.g. ${missing.slice(0, MAX_LISTED).join(', ')})`,
            collection.id);
        }
      }

      for (const param of entry.params) {
        const value = match.pathParams[param.name];
        if (param.in === 'path' && param.enumValues && value !== undefined && !param.enumValues.includes(value)) {
          findings.add(`path-enum:${type}:${param.name}`, 'warning', 'enum-vs-metadata', param.pointer,
            `${type} queries: path parameter ${param.name} doesn't allow the collection's id`, collection.id);
        }
      }
    }
  }
}

// Check an API definition against EDR and the collections it should describe
export function lintOpenApiForEdr(index: OperationIndex, doc: unknown, collections: Collection[]): ValidationError[] {
  const findings = new Findings();
  findBrokenLocalRefs(doc).forEach(({ at, ref }) =>
    findings.add(`broken-ref:${at}`, 'error', 'broken-ref', at, `$ref ${ref} doesn't resolve`));
  lintParameterSchemas(index, findings);
  lintDataQueries(index, collections, findings);
  return findings.list();
}
