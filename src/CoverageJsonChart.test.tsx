import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import CoverageJsonChart from './CoverageJsonChart';
import hidrografico from './utils/__fixtures__/hidrografico-collection-parameters.json';
import fmiPosition from './utils/__fixtures__/fmi-position-pointseries.json';

// Rendered to HTML on the server: enough to tell a chart from the error and warning alerts
const render = (data: unknown) => renderToStaticMarkup(<CoverageJsonChart data={data} />);

describe('CoverageJsonChart', () => {
  it("charts a CoverageCollection whose parameters are defined on the collection", () => {
    const html = render(hidrografico);
    expect(html).not.toContain('No parameters or ranges found');
    expect(html).toContain('Water surface height above reference datum');
    expect(html).toContain('<svg');
  });

  it('charts a coverage with its own parameters (FMI)', () => {
    const html = render(fmiPosition);
    expect(html).not.toContain('No parameters or ranges found');
    expect(html).toContain('<svg');
  });

  it('explains what it cannot chart', () => {
    expect(render({ type: 'CoverageCollection', coverages: [] })).toContain('CoverageCollection is empty');
    expect(render({ type: 'Domain' })).toContain('Unsupported type: Domain');
    const noParameters = { ...hidrografico, parameters: undefined };
    expect(render(noParameters)).toContain('No parameters or ranges found');
  });
});
