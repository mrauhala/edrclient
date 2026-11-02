import { describe, expect, it } from 'vitest';
import Ajv, { type ErrorObject } from 'ajv';
import { ajvErrorToValidationError, condenseAjvErrors, groupArrayItemErrors } from './ajvErrors';

const ajv = new Ajv({ allErrors: true, strict: false });
const errorsOf = (schema: object, data: unknown): ErrorObject[] => {
  const validate = ajv.compile(schema);
  validate(data);
  return validate.errors ?? [];
};

const featureCollection = {
  type: 'object',
  properties: {
    features: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id'],
        properties: { properties: { type: 'object', required: ['datetime', 'label'] } },
      },
    },
  },
};

describe('condenseAjvErrors', () => {
  it('drops an umbrella error explained by the errors under it', () => {
    const schema = { type: 'object', properties: { geometry: { oneOf: [{ type: 'string' }, { type: 'number' }] } } };
    const errors = errorsOf(schema, { geometry: true });
    expect(errors.map(error => error.keyword)).toContain('oneOf');
    expect(condenseAjvErrors(errors).map(error => error.message)).toEqual(['must be string', 'must be number']);
  });

  it("merges the oneOf branches' required errors into one", () => {
    const schema = { oneOf: [{ required: ['coords'] }, { required: ['bbox'] }] };
    const [error, ...rest] = condenseAjvErrors(errorsOf(schema, {}));
    expect(rest).toEqual([]);
    expect(error.message).toBe('must have one of: coords, bbox');
  });

  it('caps the list with a last "+N more" error', () => {
    const errors = errorsOf(featureCollection, { features: Array.from({ length: 5 }, () => ({ properties: {} })) });
    const condensed = condenseAjvErrors(errors, 4);
    expect(condensed).toHaveLength(5);
    expect(condensed[4]).toMatchObject({ keyword: 'truncated', message: '+11 more errors not shown' });
  });
});

describe('groupArrayItemErrors', () => {
  it('reports an error repeated across array items once, with a count and the first path', () => {
    const features = Array.from({ length: 3 }, (_, i) => ({ id: `f${i}`, properties: {} }));
    const groups = groupArrayItemErrors(errorsOf(featureCollection, { features }));
    expect(groups.map(({ error, genericPath, array, count }) => [error.instancePath, genericPath, array, count, error.params.missingProperty])).toEqual([
      ['/features/0/properties', '/features/*/properties', 'features', 3, 'datetime'],
      ['/features/0/properties', '/features/*/properties', 'features', 3, 'label'],
    ]);
  });

  it('keeps different problems apart, and single errors as they are', () => {
    const groups = groupArrayItemErrors(errorsOf(featureCollection, { features: [{ properties: { datetime: 'x', label: 'y' } }, { id: 'b', properties: { label: 'y' } }] }));
    expect(groups.map(({ genericPath, count, error }) => [genericPath, count, error.params.missingProperty])).toEqual([
      ['/features/*', 1, 'id'],
      ['/features/*/properties', 1, 'datetime'],
    ]);
  });
});

describe('ajvErrorToValidationError', () => {
  it('prefixes the message with the path and keeps the details', () => {
    const [error] = errorsOf({ required: ['links'] }, {});
    expect(ajvErrorToValidationError(error, { section: 'collections' })).toEqual({
      message: ": must have required property 'links'",
      path: '',
      keyword: 'required',
      params: { missingProperty: 'links' },
      type: 'schema',
      section: 'collections',
    });
  });
});
