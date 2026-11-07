import type { ComponentProps } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ResponseChecks, { ChecksTabLabel } from './ResponseChecks';
import type { ValidationError } from './types/api';

const render = (props: Partial<ComponentProps<typeof ResponseChecks>>) => renderToStaticMarkup(
  <ResponseChecks schemaName={null} findings={[]} lines={[]} onGoToLine={() => {}} {...props} />,
);

const FINDING: ValidationError = { path: '/ranges/t', message: '/ranges/t: must be number', severity: 'error' };

describe('ResponseChecks', () => {
  it('says so when there was nothing to check against', () => {
    expect(render({})).toContain('No schema applies');
  });

  it('says the schema found nothing', () => {
    const html = render({ schemaName: 'CoverageJSON 1.0' });
    expect(html).toContain('CoverageJSON 1.0 schema: 0 errors');
    expect(html).toContain('aria-label="Passed"');
    expect(html).not.toContain('No schema applies');
  });

  it('lists a finding with where it is, without repeating that in the message', () => {
    const html = render({ schemaName: 'CoverageJSON 1.0', findings: [FINDING] });
    expect(html).toContain('>/ranges/t</span>must be number');
    expect(html).toContain('CoverageJSON 1.0 schema: 1 error');
    expect(html).not.toContain('aria-label="Passed"');
  });

  it("leaves just the colon out of a finding at the root, which has no path in its message", () => {
    const html = render({ findings: [{ path: 'root', message: ': must match', severity: 'error' }] });
    expect(html).toContain('>root</span>must match');
  });

  it('keeps a message that does not start with its path whole', () => {
    expect(render({ findings: [{ path: '/a', message: 'odd: really', severity: 'info' }] })).toContain('>/a</span>odd: really');
  });

  it('links a finding to its line in Raw', () => {
    const html = render({ findings: [FINDING], lines: [{ line: 234, errors: [FINDING] }] });
    expect(html).toMatch(/<button[^>]*>line 234<\/button>/);
  });

  it('names no schema when it was not told one', () => {
    const html = render({ findings: [FINDING] });
    expect(html).not.toContain('schema:');
    expect(html).toContain('must be number');
  });

  it('has no link for a finding not on a line', () => {
    expect(render({ findings: [FINDING] })).not.toContain('line ');
  });

  it.each([['error', 'Error'], ['warning', 'Issue'], ['info', 'Note']] as const)('marks a finding as a %s', (severity, label) => {
    expect(render({ findings: [{ ...FINDING, severity }] })).toContain(`aria-label="${label}"`);
  });

  it('counts a finding without a severity as an error', () => {
    expect(render({ findings: [{ message: 'bad' }] })).toContain('aria-label="Error"');
  });

  it('says what the worst finding was on the schema\'s line', () => {
    const html = render({ schemaName: 'CoverageJSON 1.0', findings: [{ ...FINDING, severity: 'info' }, { ...FINDING, severity: 'info' }] });
    expect(html).toContain('CoverageJSON 1.0 schema: 2 notes');
  });

  describe('the data', () => {
    const NOTE = { message: '1 null in t2m, at Nov 5 00:00', line: 234 };

    it('lists what is worth knowing, with its line', () => {
      const html = render({ schemaName: 'CoverageJSON 1.0', dataNotes: [NOTE, { message: 'Time step changes', line: 97 }] });
      expect(html).toContain('>The format<');
      expect(html).toContain('>The data<');
      expect(html).toContain('1 null in t2m, at Nov 5 00:00');
      expect(html).toMatch(/<button[^>]*>line 234<\/button>/);
      expect(html).toMatch(/<button[^>]*>line 97<\/button>/);
      expect(html).toContain('aria-label="Note"');
    });

    it('stands alone with no schema', () => {
      const html = render({ dataNotes: [NOTE] });
      expect(html).toContain('>The data<');
      expect(html).not.toContain('>The format<');
      expect(html).not.toContain('No schema applies');
    });

    it('has no heading with nothing to say', () => {
      expect(render({ schemaName: 'CoverageJSON 1.0' })).not.toContain('>The data<');
    });

    it('puts what rests on the collection under it, with no line where the response has nothing to show', () => {
      const html = render({
        collectionId: 'ecmwf_painepinta',
        dataNotes: [
          { message: "The collection's vrs gives z's unit: hPa", severity: 'pass', source: 'collection' },
          { message: "z 4.8 isn't among the levels in the collection's extent", line: 45, severity: 'warning', source: 'collection' },
          { message: "z's unit, hPa, is only in a description", line: 44, severity: 'warning' },
        ],
      });
      const data = html.indexOf('>The data<');
      const collection = html.indexOf('>Against the collection: ecmwf_painepinta<');
      expect(data).toBeGreaterThan(-1);
      expect(collection).toBeGreaterThan(data);
      // As it's written in HTML
      const at = (text: string) => html.indexOf(text.replace(/'/g, '&#x27;'));
      expect(at("z's unit, hPa, is only in a description")).toBeGreaterThan(data);
      expect(at("z's unit, hPa, is only in a description")).toBeLessThan(collection);
      expect(at("The collection's vrs gives z's unit: hPa")).toBeGreaterThan(collection);
      expect(html.match(/>line \d+</g)).toEqual(['>line 44<', '>line 45<']);
    });

    it('has no heading for the collection with nothing against it, and no name without one', () => {
      expect(render({ dataNotes: [{ message: 'a', line: 1 }] })).not.toContain('Against the collection');
      expect(render({ dataNotes: [{ message: 'a', line: 1, source: 'collection' }] })).toContain('>Against the collection<');
    });

    it('shows each finding as what it is, the worst first and what passed last', () => {
      const html = render({
        dataNotes: [
          { message: 'passed', line: 1, severity: 'pass' },
          { message: 'noted', line: 2, severity: 'info' },
          { message: 'an issue', line: 3, severity: 'warning' },
          { message: 'broken', line: 4, severity: 'error' },
          { message: 'noted too', line: 5 },
        ],
      });
      const order = ['broken', 'an issue', 'noted', 'noted too', 'passed'].map(message => html.indexOf(`>${message}<`));
      expect(order.every((at, i) => at > 0 && (i === 0 || at > order[i - 1]))).toBe(true);
      const icons = [...html.matchAll(/aria-label="(Error|Issue|Note|Passed)"/g)].map(match => match[1]);
      expect(icons).toEqual(['Error', 'Issue', 'Note', 'Note', 'Passed']);
    });
  });

  it('keeps a long list short', () => {
    const findings = Array.from({ length: 103 }, (_, i) => ({ message: `finding ${i}` }));
    const html = render({ findings });
    expect(html).toContain('finding 99');
    expect(html).not.toContain('finding 100');
    expect(html).toContain('And 3 more');
  });
});

describe('ChecksTabLabel', () => {
  it('is just the name with no findings', () => {
    expect(renderToStaticMarkup(<ChecksTabLabel findings={[]} />)).toBe('<span>Checks</span>');
  });

  it('adds the count, coloured by how bad it is', () => {
    const colour = (severity: 'error' | 'warning' | 'info') => {
      const html = renderToStaticMarkup(<ChecksTabLabel findings={[{ severity }]} />);
      const name = html.match(/css-[A-Za-z0-9-]+/)?.[0];
      return html.match(new RegExp(`\\.${name}\\{[^}]*[^-]color:([^;}]+)`))?.[1];
    };
    expect(renderToStaticMarkup(<ChecksTabLabel findings={[{ severity: 'error' }, { severity: 'info' }]} />)).toContain('>1 error<');
    expect(new Set([colour('error'), colour('warning'), colour('info')]).size).toBe(3);
  });
});
