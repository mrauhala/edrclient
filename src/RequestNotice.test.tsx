import type { ComponentProps } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import RequestNotice from './RequestNotice';

const render = (props: Partial<ComponentProps<typeof RequestNotice>>) => renderToStaticMarkup(
  <RequestNotice message="Link copied" severity="success" onClose={() => {}} horizontal="right" {...props} />,
);

describe('RequestNotice', () => {
  it('shows nothing without a message', () => {
    expect(render({ message: null })).not.toContain('MuiAlert');
  });

  it('says it where the eye is: below the request line, on the right', () => {
    const html = render({});
    expect(html).toContain('Link copied');
    expect(html).toContain('MuiSnackbar-anchorOriginTopRight');
    expect(html).toContain('calc(var(--safe-top) + 108px)');
    expect(html).toContain('MuiAlert-filled');
  });

  it('stands out as what it is', () => {
    expect(render({ severity: 'success' })).toContain('MuiAlert-colorSuccess');
    expect(render({ severity: 'error' })).toContain('MuiAlert-colorError');
    expect(render({ severity: 'info' })).toContain('MuiAlert-colorInfo');
  });

  it('can sit above a bottom bar', () => {
    const html = render({ atBottom: true });
    expect(html).toContain('MuiSnackbar-anchorOriginBottomRight');
    expect(html).toContain('calc(var(--safe-bottom) + 64px)');
  });

  it('can be centred', () => {
    expect(render({ horizontal: 'center' })).toContain('MuiSnackbar-anchorOriginTopCenter');
  });

  it('can be closed if it stays, and has no need to be if it goes', () => {
    expect(render({})).toContain('aria-label="Close"');
    expect(render({ autoHideMs: 2500 })).not.toContain('aria-label="Close"');
  });
});
