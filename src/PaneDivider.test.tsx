import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PaneDivider from './PaneDivider';

describe('PaneDivider', () => {
  it('is a focusable separator that says its width', () => {
    const html = renderToStaticMarkup(<PaneDivider width={520} onChange={() => {}} />);
    expect(html).toContain('role="separator"');
    expect(html).toContain('aria-orientation="vertical"');
    expect(html).toContain('aria-valuenow="520"');
    expect(html).toContain('aria-valuetext="520 pixels"');
    expect(html).toContain('tabindex="0"');
  });
});
