import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useCollectionKeyboardNav } from './useCollectionKeyboardNav';

// The server renderer skips effects, and the key handler is set up in one: run them as they come
const state = vi.hoisted(() => ({
  collections: [] as unknown[],
  selected: null as unknown,
  open: vi.fn(),
}));
vi.mock('react', async importOriginal => ({
  ...(await importOriginal<typeof import('react')>()),
  useEffect: (effect: () => void) => effect(),
}));
vi.mock('../contexts/CollectionContext', () => ({ useCollection: () => ({ collections: state.collections, selectedCollection: state.selected }) }));
vi.mock('../contexts/OpenCollectionContext', () => ({ useOpenCollection: () => ({ openCollection: state.open }) }));

const [ONE, TWO, THREE] = [{ id: 'one' }, { id: 'two' }, { id: 'three' }];
const list = { clientHeight: 100, scrollBy: vi.fn() };

function setup(listShowing: boolean) {
  const handlers: ((event: unknown) => void)[] = [];
  vi.stubGlobal('document', {
    addEventListener: (_: string, handler: (event: unknown) => void) => handlers.push(handler),
    removeEventListener: () => {},
    getElementById: (id: string) => (id === 'api-pane' ? list : null),
  });
  function Nav() {
    useCollectionKeyboardNav(listShowing);
    return null;
  }
  renderToStaticMarkup(<Nav />);
  return (key: string, tagName = 'BODY') => {
    const preventDefault = vi.fn();
    handlers.at(-1)!({ key, target: { tagName }, preventDefault });
    return preventDefault;
  };
}

describe('useCollectionKeyboardNav', () => {
  beforeEach(() => {
    state.collections = [ONE, TWO, THREE];
    state.selected = TWO;
    state.open.mockClear();
    list.scrollBy.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  describe('on a collection', () => {
    it('goes to the next and the previous one, in place of the page scrolling', () => {
      const press = setup(false);
      expect(press('PageDown')).toHaveBeenCalled();
      expect(state.open).toHaveBeenLastCalledWith(THREE);
      expect(press('PageUp')).toHaveBeenCalled();
      expect(state.open).toHaveBeenLastCalledWith(ONE);
    });

    it('stops at either end', () => {
      state.selected = THREE;
      expect(setup(false)('PageDown')).not.toHaveBeenCalled();
      state.selected = ONE;
      expect(setup(false)('PageUp')).not.toHaveBeenCalled();
      expect(state.open).not.toHaveBeenCalled();
    });

    it('starts at the first with none open', () => {
      state.selected = null;
      setup(false)('PageDown');
      expect(state.open).toHaveBeenCalledWith(ONE);
    });

    it('does nothing without collections', () => {
      state.collections = [];
      state.selected = null;
      expect(setup(false)('PageDown')).not.toHaveBeenCalled();
      expect(state.open).not.toHaveBeenCalled();
    });
  });

  describe("on the API's list", () => {
    it('scrolls the list by most of a page, and opens nothing', () => {
      const press = setup(true);
      expect(press('PageDown')).toHaveBeenCalled();
      expect(list.scrollBy).toHaveBeenLastCalledWith({ top: 90 });
      expect(press('PageUp')).toHaveBeenCalled();
      expect(list.scrollBy).toHaveBeenLastCalledWith({ top: -90 });
      expect(state.open).not.toHaveBeenCalled();
    });
  });

  it('ignores other keys', () => {
    for (const listShowing of [true, false]) {
      expect(setup(listShowing)('ArrowDown')).not.toHaveBeenCalled();
    }
    expect(state.open).not.toHaveBeenCalled();
    expect(list.scrollBy).not.toHaveBeenCalled();
  });

  it('leaves a field being typed in alone', () => {
    for (const listShowing of [true, false]) {
      const press = setup(listShowing);
      for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) expect(press('PageDown', tag)).not.toHaveBeenCalled();
    }
    expect(state.open).not.toHaveBeenCalled();
    expect(list.scrollBy).not.toHaveBeenCalled();
  });
});
