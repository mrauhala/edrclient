import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import TopMenu from './TopMenu';

const state = vi.hoisted(() => ({
  api: {} as { apiUrl: string; title: string | null },
  customServices: [] as { name: string; url: string }[],
}));
vi.mock('./contexts/ApiContext', () => ({ useApi: () => state.api }));
vi.mock('./contexts/ServiceContext', () => ({ useService: () => ({ customServices: state.customServices }) }));
vi.mock('./contexts/CollectionContext', () => ({ useCollection: () => ({ selectedCollection: null }) }));
vi.mock('./contexts/PanesContext', () => ({ usePanes: () => ({ isOpen: {}, isMobile: false, togglePane: () => {} }) }));
vi.mock('./CommandPalette', () => ({ default: () => null }));
vi.mock('./LayerManager', () => ({ default: () => null }));
vi.mock('./ValidationPopover', () => ({ default: () => null }));
vi.mock('./PaneToggles', () => ({ default: () => null }));
// Wide enough for the breadcrumb
vi.mock('@mui/material/useMediaQuery', () => ({ default: () => true }));

const FMI = 'https://opendata.fmi.fi/edr';
const OTHER = 'https://other.example/api';

const render = () => renderToStaticMarkup(<TopMenu onSettingsClick={() => {}} />);

describe('TopMenu', () => {
  beforeEach(() => {
    state.api = { apiUrl: OTHER, title: null };
    state.customServices = [];
  });

  it('calls a listed API by the name it is listed under', () => {
    state.api = { apiUrl: FMI, title: 'What the API calls itself' };
    const html = render();
    expect(html).toContain('FMI Open Data');
    expect(html).not.toContain('What the API calls itself');
  });

  it('calls a saved service by the name it was saved under', () => {
    state.api.title = 'What the API calls itself';
    state.customServices = [{ name: 'Mine', url: OTHER }];
    const html = render();
    expect(html).toContain('Mine');
    expect(html).not.toContain('What the API calls itself');
  });

  it('calls any other API what it calls itself', () => {
    state.api.title = 'What the API calls itself';
    expect(render()).toContain('What the API calls itself');
  });
});
