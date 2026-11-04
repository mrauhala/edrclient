import { afterEach, describe, expect, it, vi } from 'vitest';
import type View from 'ol/View';
import { fromLonLat } from 'ol/proj';
import { zoomToExtents, zoomToLocations, zoomToOverview, zoomToPoint } from './mapView';

const fakeView = () => {
  const view = { fit: vi.fn(), setCenter: vi.fn(), setZoom: vi.fn() };
  return { view, olView: view as unknown as View };
};

const expectWorld = (view: ReturnType<typeof fakeView>['view']) => {
  expect(view.setCenter).toHaveBeenCalledWith([0, 0]);
  expect(view.setZoom).toHaveBeenCalledWith(2);
  expect(view.fit).not.toHaveBeenCalled();
};

const untouched = (view: ReturnType<typeof fakeView>['view']) => {
  expect(view.fit).not.toHaveBeenCalled();
  expect(view.setCenter).not.toHaveBeenCalled();
  expect(view.setZoom).not.toHaveBeenCalled();
};

afterEach(() => vi.restoreAllMocks());

describe('zoomToExtents', () => {
  it('fits around all the extents', () => {
    const { view, olView } = fakeView();
    zoomToExtents(olView, [[10, 50, 20, 60], [15, 40, 30, 55]]);
    expect(view.fit).toHaveBeenCalledWith([...fromLonLat([10, 40]), ...fromLonLat([30, 60])], { padding: [50, 50, 50, 50], duration: 1000 });
    expect(view.setZoom).not.toHaveBeenCalled();
  });

  it('shows the world for a global extent', () => {
    const { view, olView } = fakeView();
    zoomToExtents(olView, [[-180, -90, 180, 90]]);
    expectWorld(view);
  });

  it('fits an extent short of global on any one side', () => {
    for (const bbox of [[-170, -90, 180, 90], [-180, -80, 180, 90], [-180, -90, 170, 90], [-180, -90, 180, 80]]) {
      const { view, olView } = fakeView();
      zoomToExtents(olView, [bbox as [number, number, number, number]]);
      expect(view.fit).toHaveBeenCalled();
    }
  });

  it('stays put for an extent without an area, or none at all', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const extents of [[[10, 50, 10, 60]], [[10, 50, 20, 50]], []] as [number, number, number, number][][]) {
      const { view, olView } = fakeView();
      zoomToExtents(olView, extents);
      untouched(view);
    }
  });
});

describe('zoomToLocations', () => {
  it('fits around the locations, not too close', () => {
    const { view, olView } = fakeView();
    zoomToLocations(olView, [1, 2, 3, 4]);
    expect(view.fit).toHaveBeenCalledWith([1, 2, 3, 4], { padding: [50, 50, 50, 50], duration: 1000, maxZoom: 10 });
  });

  it('centres on a single location', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { view, olView } = fakeView();
    zoomToLocations(olView, [5, 7, 5, 7]);
    expect(view.setCenter).toHaveBeenCalledWith([5, 7]);
    expect(view.setZoom).toHaveBeenCalledWith(10);
    expect(view.fit).not.toHaveBeenCalled();
  });

  it('centres on locations in a line, which have no area to fit', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const [extent, center] of [[[5, 7, 9, 7], [7, 7]], [[5, 7, 5, 11], [5, 9]]]) {
      const { view, olView } = fakeView();
      zoomToLocations(olView, extent);
      expect(view.setCenter).toHaveBeenCalledWith(center);
      expect(view.fit).not.toHaveBeenCalled();
    }
  });

  it('stays put without locations', () => {
    const { view, olView } = fakeView();
    zoomToLocations(olView, [Infinity, Infinity, -Infinity, -Infinity]);
    untouched(view);
  });
});

describe('zoomToPoint', () => {
  it('fits about half a degree around the point, at once', () => {
    const { view, olView } = fakeView();
    zoomToPoint(olView, [25, 60]);
    expect(view.fit).toHaveBeenCalledWith([...fromLonLat([24.5, 59.5]), ...fromLonLat([25.5, 60.5])], { padding: [10, 10, 10, 10] });
  });

  it('stays put for coordinates that are not numbers', () => {
    const { view, olView } = fakeView();
    zoomToPoint(olView, [NaN, 60]);
    untouched(view);
  });
});

describe('zoomToOverview', () => {
  it('goes to the collection when it has extents, even with locations', () => {
    const { view, olView } = fakeView();
    zoomToOverview(olView, [[10, 50, 20, 60]], [1, 2, 3, 4]);
    expect(view.fit).toHaveBeenCalledWith([...fromLonLat([10, 50]), ...fromLonLat([20, 60])], { padding: [50, 50, 50, 50], duration: 1000 });
  });

  it('goes to the locations when the collection has no extents', () => {
    for (const extents of [null, []]) {
      const { view, olView } = fakeView();
      zoomToOverview(olView, extents, [1, 2, 3, 4]);
      expect(view.fit).toHaveBeenCalledWith([1, 2, 3, 4], expect.objectContaining({ maxZoom: 10 }));
    }
  });

  it('goes to the world with nothing chosen', () => {
    // An empty source reports this extent
    for (const locationExtent of [undefined, [Infinity, Infinity, -Infinity, -Infinity]]) {
      const { view, olView } = fakeView();
      zoomToOverview(olView, null, locationExtent);
      expectWorld(view);
    }
  });
});
