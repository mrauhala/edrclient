// What the colour scale and the notes are built on: a parameter's values in figures. No DOM.

export interface SliceFigures {
  numbers: number;
  nulls: number;
  min: number | null;
  max: number | null;
  mean: number | null;
}

// Values cut off from the rest, which get their own colour and not the end of the scale
export interface SetApart {
  min: number;
  max: number;
  count: number;
  low: boolean;
}

export interface Spike {
  value: number;
  count: number;
  share: number;
  atLow: boolean;
}

export interface CellFigures {
  total: number;
  numbers: number;
  nulls: number;
  mean: number | null;
  perSlice: SliceFigures[];
  min: number | null;
  max: number | null;
  spike: Spike | null;
  apart: SetApart[];
  // The range without what's set apart
  lo: number | null;
  hi: number | null;
  oneValue: boolean;
}

// The same value in this share of cells is worth a sentence
const SHARE_NOTED = 0.2;
const MOST_SORTED = 1000000;
// A scattered few values can be far from the rest, not half the grid
const FAR_SHARE = 0.01;
// How many times the rest's own span a gap has to be. Among a handful of values a natural gradient looks like a gap, so
// it takes more there: 5 isn't far off from -2 and 0, and -9999 is from 12 and 14
const FAR_GAP = 2;
const FAR_GAP_AMONG_A_FEW = 10;
const A_FEW = 10;

// Never 100% or 0% for what isn't
export function shareText(share: number): string {
  const percent = share * 100;
  if (percent > 99 && percent < 100) return `${percent.toFixed(1)}%`;
  if (percent > 0 && percent < 1) return `${percent.toFixed(2)}%`;
  return `${Math.round(percent)}%`;
}

// Half way across a gap: what's beyond it is set apart, among all the values and not only those sampled
const middleOf = (sorted: Float32Array, at: number) => (sorted[at] + sorted[at + 1]) / 2;

const isFewOrOne = (span: number, count: number, size: number) => span === 0 || count / size <= FAR_SHARE;

// The widest gap didn't cut anything off by itself. Is there a second one, with the two ends both cut off from the middle?
function bothEnds(sorted: Float32Array, lo: number, hi: number, widest: number, size: number, farGap: number) {
  let second = -1;
  let secondGap = -1;
  for (let i = lo; i < hi; i++) {
    const distance = sorted[i + 1] - sorted[i];
    if (i !== widest && distance > secondGap) {
      secondGap = distance;
      second = i;
    }
  }
  if (second < 0) return null;
  const left = Math.min(widest, second);
  const right = Math.max(widest, second);
  const middle = sorted[right] - sorted[left + 1];
  const spanLeft = sorted[left] - sorted[lo];
  const spanRight = sorted[hi] - sorted[right + 1];
  const countLeft = left - lo + 1;
  const countRight = hi - right;
  if (middle <= 0 || secondGap <= farGap * middle) return null;
  if (!isFewOrOne(spanLeft, countLeft, size) || !isFewOrOne(spanRight, countRight, size)) return null;
  const apart: SetApart[] = [
    { min: sorted[lo], max: sorted[left], count: countLeft, low: true },
    { min: sorted[right + 1], max: sorted[hi], count: countRight, low: false },
  ];
  return { apart, cuts: [middleOf(sorted, left), middleOf(sorted, right)], lo: left + 1, hi: right };
}

interface Found {
  apart: SetApart[];
  // Half way across each one's gap, in the same order
  cuts: number[];
  lo: number;
  hi: number;
}

// Set apart only what's cut off from the rest by a gap wider than twice the rest's own span, and is one value or a
// scattered few. So -1e34 goes, and a long tail of heavy rain stays on the scale
function findApart(sorted: Float32Array, farGap: number): Found {
  const size = sorted.length;
  const found: Found = { apart: [], cuts: [], lo: 0, hi: size - 1 };
  for (let round = 0; round < 4 && found.hi > found.lo; round++) {
    const { lo, hi } = found;
    let gap = -1;
    let at = lo;
    for (let i = lo; i < hi; i++) {
      const distance = sorted[i + 1] - sorted[i];
      if (distance > gap) {
        gap = distance;
        at = i;
      }
    }
    const leftSpan = sorted[at] - sorted[lo];
    const rightSpan = sorted[hi] - sorted[at + 1];
    const leftCount = at - lo + 1;
    const rightCount = hi - at;
    const cutLeft = leftSpan < rightSpan || (leftSpan === rightSpan && leftCount < rightCount);
    const span = cutLeft ? leftSpan : rightSpan;
    const count = cutLeft ? leftCount : rightCount;
    const rest = cutLeft ? rightSpan : leftSpan;
    if (rest === 0 || gap <= farGap * rest || (span !== 0 && count / size > FAR_SHARE)) {
      // Both ends can be far off at once, and then each counts the other as part of the rest
      const both = bothEnds(sorted, lo, hi, at, size, farGap);
      if (!both) break;
      found.apart.push(...both.apart);
      found.cuts.push(...both.cuts);
      found.lo = both.lo;
      found.hi = both.hi;
      continue;
    }
    found.apart.push({ min: cutLeft ? sorted[lo] : sorted[at + 1], max: cutLeft ? sorted[at] : sorted[hi], count, low: cutLeft });
    found.cuts.push(middleOf(sorted, at));
    if (cutLeft) found.lo = at + 1;
    else found.hi = at;
  }
  return found;
}

// Which of what's set apart a value belongs to. They're cut off outer first, so on each side it's the first it's beyond
const beyond = ({ apart, cuts }: Found, value: number) => apart.find((each, i) => (each.low ? value < cuts[i] : value > cuts[i]));

// What's set apart and the range, counted from every value, each on its side of the gaps found in the sample
function recount(figures: CellFigures, found: Found, numbers: Float32Array) {
  figures.apart = found.apart.map(apart => ({ ...apart, count: 0, min: Infinity, max: -Infinity }));
  const fresh: Found = { ...found, apart: figures.apart };
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < numbers.length; i++) {
    const value = numbers[i];
    const apart = beyond(fresh, value);
    if (!apart) {
      if (value < lo) lo = value;
      if (value > hi) hi = value;
      continue;
    }
    apart.count++;
    if (value < apart.min) apart.min = value;
    if (value > apart.max) apart.max = value;
  }
  figures.lo = lo;
  figures.hi = hi;
}

export function analyse(data: Float32Array, slices: number, cells: number): CellFigures {
  const total = data.length;
  const numbers = new Float32Array(total);
  let n = 0;
  let sum = 0;
  let nulls = 0;
  const perSlice: SliceFigures[] = new Array(slices);
  let trueMin = Infinity;
  let trueMax = -Infinity;
  for (let s = 0; s < slices; s++) {
    let count = 0;
    let sliceSum = 0;
    let min = Infinity;
    let max = -Infinity;
    let sliceNulls = 0;
    const offset = s * cells;
    for (let i = 0; i < cells; i++) {
      const value = data[offset + i];
      if (value !== value) {
        sliceNulls++;
        continue;
      }
      numbers[n++] = value;
      count++;
      sliceSum += value;
      if (value < min) min = value;
      if (value > max) max = value;
    }
    nulls += sliceNulls;
    sum += sliceSum;
    if (count) {
      if (min < trueMin) trueMin = min;
      if (max > trueMax) trueMax = max;
    }
    perSlice[s] = { numbers: count, nulls: sliceNulls, min: count ? min : null, max: count ? max : null, mean: count ? sliceSum / count : null };
  }
  const figures: CellFigures = {
    total, numbers: n, nulls, mean: n ? sum / n : null, perSlice,
    min: null, max: null, spike: null, apart: [], lo: null, hi: null, oneValue: false,
  };
  if (n === 0) return figures;

  // Sorting is what grows with size, and the rules below only need the shape of the values. Above this they get a
  // regular sample with the true ends in it, and whatever falls outside the range is still drawn apart and counted
  let sorted: Float32Array;
  let sampled = false;
  if (n > MOST_SORTED) {
    const stride = Math.ceil(n / MOST_SORTED);
    const sample = new Float32Array(Math.ceil(n / stride) + 2);
    let m = 0;
    for (let i = 0; i < n; i += stride) sample[m++] = numbers[i];
    sample[m++] = trueMin;
    sample[m++] = trueMax;
    sorted = sample.subarray(0, m).sort();
    sampled = true;
  } else {
    sorted = numbers.subarray(0, n).sort();
  }
  const size = sorted.length;
  figures.min = trueMin;
  figures.max = trueMax;
  figures.oneValue = trueMin === trueMax;

  // The value most cells share, if it's at an end of the range: a code as often as a measurement
  let best = 0;
  let bestAt = 0;
  let run = 1;
  for (let i = 1; i <= size; i++) {
    if (i < size && sorted[i] === sorted[i - 1]) {
      run++;
      continue;
    }
    if (run > best) {
      best = run;
      bestAt = i - run;
    }
    run = 1;
  }
  if (!figures.oneValue && best / size >= SHARE_NOTED && (bestAt === 0 || bestAt + best === size)) {
    let count = best;
    if (sampled) {
      count = 0;
      const value = sorted[bestAt];
      for (let i = 0; i < n; i++) if (numbers[i] === value) count++;
    }
    figures.spike = { value: sorted[bestAt], count, share: count / n, atLow: bestAt === 0 };
  }

  const farGap = size < A_FEW ? FAR_GAP_AMONG_A_FEW : FAR_GAP;
  let found = findApart(sorted, farGap);
  if (sampled) {
    // A sample can miss a far value as easily as the rest's own ends. What's beyond the rest it saw, and not beyond a gap
    // it found, is looked at again with the sample, if it's a few
    const seenLo = sorted[found.lo];
    const seenHi = sorted[found.hi];
    const missed: number[] = [];
    for (let i = 0; i < n && missed.length <= n * FAR_SHARE; i++) {
      const value = numbers[i];
      if ((value < seenLo || value > seenHi) && !beyond(found, value)) missed.push(value);
    }
    if (missed.length > 0 && missed.length <= n * FAR_SHARE) {
      const more = new Float32Array(size + missed.length);
      more.set(sorted);
      more.set(missed, size);
      found = findApart(more.sort(), farGap);
    }
    recount(figures, found, numbers.subarray(0, n));
  } else {
    figures.apart = found.apart;
    figures.lo = sorted[found.lo];
    figures.hi = sorted[found.hi];
  }
  return figures;
}
