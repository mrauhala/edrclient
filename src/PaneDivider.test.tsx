import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PaneDivider from './PaneDivider';

const render = (side: 'left' | 'right', label: string) => renderToStaticMarkup(
  <PaneDivider side={side} label={label} width={520} minWidth={320} minBeside={360} onChange={() => {}} />
);

describe('PaneDivider', () => {
  it('is a focusable separator that says its width', () => {
    const html = render('right', 'Response pane width');
    expect(html).toContain('role="separator"');
    expect(html).toContain('aria-orientation="vertical"');
    expect(html).toContain('aria-valuenow="520"');
    expect(html).toContain('aria-valuetext="520 pixels"');
    expect(html).toContain('tabindex="0"');
  });

  it('says which pane it sizes', () => {
    expect(render('right', 'Response pane width')).toContain('aria-label="Response pane width"');
    expect(render('left', 'Request pane width')).toContain('aria-label="Request pane width"');
  });

  it('shows that it can be dragged, and takes a touch drag rather than scrolling', () => {
    const html = render('left', 'Request pane width');
    expect(html).toContain('cursor:col-resize');
    expect(html).toContain('touch-action:none');
  });
});
