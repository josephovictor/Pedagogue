export type ScaleRangeMode = '1' | 'multi';
export type MultiOctaveChoice = 'auto' | '2' | '3' | '4';
export type ScaleHandsMode = 'right' | 'left' | 'parallel' | 'contrary' | 'one';
export type ContraryStartMode = 'unison' | 'octave';

export interface ScaleMaxResult {
  /** Max octaves (0..4) guaranteed to fit every root in rootPcs. */
  maxGuaranteed: number;
  /** Max octaves (0..4) that fit at least one root in rootPcs. */
  maxAnyKey: number;
}

export interface ScaleOctaveResolution {
  /** Requested octaves before range clamping (1..4). */
  requestedOctaves: number;
  /** Actual playable octaves (1..4) that fit inside [lo, hi]. */
  effectiveOctaves: number;
  /** Max octaves (0..4) guaranteed across rootPcs. */
  maxGuaranteed: number;
  /** Max octaves (0..4) that fit for the specific active root. */
  maxForRoot: number;
  /** True when the requested count had to be reduced to fit [lo, hi]. */
  wasClamped: boolean;
  /** Effective contrary start (falls back from 'octave' to 'unison' if 1 oct doesn't fit). */
  effectiveContraryStart: ContraryStartMode;
  /** True when 'octave' contrary start couldn't fit even 1 oct on [lo, hi] and fell back to 'unison'. */
  contraryFellBackToUnison: boolean;
}

export interface ScaleSequencesResult {
  rhSeq: number[];
  lhSeq: number[] | null;
  /** Per-step unique MIDI notes (unison steps deduplicated to 1 key). */
  steps: number[][];
  effectiveOctaves: number;
  effectiveContraryStart: ContraryStartMode;
  contraryFellBackToUnison: boolean;
}

export const MAX_UI_SCALE_OCTAVES = 4;

export function normalizePc(pc: number): number {
  return ((pc % 12) + 12) % 12;
}

export function fitsSpanInKeyboard(opts: {
  rootMidi: number;
  minOff: number;
  maxOff: number;
  hands: ScaleHandsMode;
  contraryStart: ContraryStartMode;
  lo: number;
  hi: number;
}): boolean {
  const {rootMidi, minOff, maxOff, hands, contraryStart, lo, hi} = opts;
  if (hands === 'one' || hands === 'right' || hands === 'left') {
    return rootMidi + minOff >= lo && rootMidi + maxOff <= hi;
  }
  if (hands === 'parallel') {
    return rootMidi - 12 + minOff >= lo && rootMidi + maxOff <= hi;
  }
  const lhStartRoot = contraryStart === 'unison' ? rootMidi : rootMidi - 12;
  return lhStartRoot - maxOff >= lo && rootMidi + maxOff <= hi;
}

export function findBestScaleRootMidi(opts: {
  rootPc: number;
  minOff: number;
  maxOff: number;
  hands: ScaleHandsMode;
  contraryStart: ContraryStartMode;
  clef: 'treble' | 'bass' | 'grand';
  lo: number;
  hi: number;
}): number | null {
  const pc = normalizePc(opts.rootPc);
  const candidates: number[] = [];
  for (let m = 0; m <= 127; m++) {
    if (m % 12 !== pc) continue;
    if (
      fitsSpanInKeyboard({
        rootMidi: m,
        minOff: opts.minOff,
        maxOff: opts.maxOff,
        hands: opts.hands,
        contraryStart: opts.contraryStart,
        lo: opts.lo,
        hi: opts.hi,
      })
    ) {
      candidates.push(m);
    }
  }
  if (!candidates.length) return null;

  let targetAnchor: number;
  if (opts.hands === 'left') {
    targetAnchor = 48;
  } else if (opts.hands === 'right') {
    targetAnchor = 60;
  } else if (opts.hands === 'one') {
    targetAnchor = opts.clef === 'bass' ? 48 : 60;
  } else if (opts.hands === 'parallel') {
    targetAnchor = 60;
  } else {
    targetAnchor =
      opts.contraryStart === 'unison'
        ? (opts.lo + opts.hi) / 2
        : (opts.lo + 12 + opts.hi) / 2;
  }

  candidates.sort((a, b) => {
    const da = Math.abs(a - targetAnchor);
    const db = Math.abs(b - targetAnchor);
    if (Math.abs(da - db) > 0.01) return da - db;
    const ca = Math.abs(a - 60);
    const cb = Math.abs(b - 60);
    if (ca !== cb) return ca - cb;
    return a - b;
  });

  return candidates[0];
}

export function maxOctavesForRoot(opts: {
  rootPc: number;
  hands: ScaleHandsMode;
  contraryStart: ContraryStartMode;
  lo: number;
  hi: number;
  maxCap?: number;
}): number {
  const cap = opts.maxCap ?? MAX_UI_SCALE_OCTAVES;
  for (let oct = cap; oct >= 1; oct--) {
    const root = findBestScaleRootMidi({
      rootPc: opts.rootPc,
      minOff: 0,
      maxOff: 12 * oct,
      hands: opts.hands,
      contraryStart: opts.contraryStart,
      clef: 'grand',
      lo: opts.lo,
      hi: opts.hi,
    });
    if (root !== null) return oct;
  }
  return 0;
}

export function computeScaleOctaveCapacity(opts: {
  lo: number;
  hi: number;
  hands: ScaleHandsMode;
  contraryStart: ContraryStartMode;
  rootPcs: number[];
  maxCap?: number;
}): ScaleMaxResult {
  const pcs = opts.rootPcs.length
    ? opts.rootPcs
    : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  let maxGuaranteed = opts.maxCap ?? MAX_UI_SCALE_OCTAVES;
  let maxAnyKey = 0;

  for (const pc of pcs) {
    const m = maxOctavesForRoot({
      rootPc: pc,
      hands: opts.hands,
      contraryStart: opts.contraryStart,
      lo: opts.lo,
      hi: opts.hi,
      maxCap: opts.maxCap,
    });
    maxGuaranteed = Math.min(maxGuaranteed, m);
    maxAnyKey = Math.max(maxAnyKey, m);
  }

  return {maxGuaranteed, maxAnyKey};
}

export function resolveScaleOctaves(opts: {
  rangeMode: ScaleRangeMode;
  multiChoice: MultiOctaveChoice;
  hands: ScaleHandsMode;
  contraryStart: ContraryStartMode;
  rootPc: number;
  allRootPcs?: number[];
  lo: number;
  hi: number;
}): ScaleOctaveResolution {
  let effectiveContraryStart = opts.contraryStart;
  let contraryFellBackToUnison = false;

  let maxForRoot = maxOctavesForRoot({
    rootPc: opts.rootPc,
    hands: opts.hands,
    contraryStart: effectiveContraryStart,
    lo: opts.lo,
    hi: opts.hi,
  });

  if (
    maxForRoot === 0 &&
    opts.hands === 'contrary' &&
    effectiveContraryStart === 'octave'
  ) {
    const unisonMax = maxOctavesForRoot({
      rootPc: opts.rootPc,
      hands: opts.hands,
      contraryStart: 'unison',
      lo: opts.lo,
      hi: opts.hi,
    });
    if (unisonMax >= 1) {
      effectiveContraryStart = 'unison';
      contraryFellBackToUnison = true;
      maxForRoot = unisonMax;
    }
  }

  const {maxGuaranteed} = computeScaleOctaveCapacity({
    lo: opts.lo,
    hi: opts.hi,
    hands: opts.hands,
    contraryStart: effectiveContraryStart,
    rootPcs: opts.allRootPcs || [opts.rootPc],
  });

  if (opts.rangeMode === '1') {
    return {
      requestedOctaves: 1,
      effectiveOctaves: 1,
      maxGuaranteed,
      maxForRoot,
      wasClamped: false,
      effectiveContraryStart,
      contraryFellBackToUnison,
    };
  }

  const safeMax = Math.max(1, maxForRoot);
  const requestedOctaves =
    opts.multiChoice === 'auto'
      ? safeMax
      : Math.max(2, Math.min(MAX_UI_SCALE_OCTAVES, Number(opts.multiChoice) || 2));
  const effectiveOctaves = Math.max(1, Math.min(requestedOctaves, safeMax));

  return {
    requestedOctaves,
    effectiveOctaves,
    maxGuaranteed,
    maxForRoot,
    wasClamped: effectiveOctaves < requestedOctaves,
    effectiveContraryStart,
    contraryFellBackToUnison,
  };
}

export function buildScaleHandSequences(opts: {
  baseInts: number[];
  rootPc: number;
  rangeMode: ScaleRangeMode;
  multiChoice: MultiOctaveChoice;
  dir: 'up' | 'down';
  hands: ScaleHandsMode;
  contraryStart: ContraryStartMode;
  clef: 'treble' | 'bass' | 'grand';
  lo: number;
  hi: number;
  isFixedPattern?: boolean;
}): ScaleSequencesResult {
  const res = opts.isFixedPattern
    ? {
        effectiveOctaves: 1,
        effectiveContraryStart: opts.contraryStart,
        contraryFellBackToUnison: false,
      }
    : resolveScaleOctaves({
        rangeMode: opts.rangeMode,
        multiChoice: opts.multiChoice,
        hands: opts.hands,
        contraryStart: opts.contraryStart,
        rootPc: opts.rootPc,
        lo: opts.lo,
        hi: opts.hi,
      });

  const fullInts: number[] = [];
  if (opts.isFixedPattern) {
    fullInts.push(...opts.baseInts);
  } else {
    for (let o = 0; o < res.effectiveOctaves; o++) {
      fullInts.push(...opts.baseInts.map(x => x + 12 * o));
    }
    fullInts.push(12 * res.effectiveOctaves);
  }

  const minOff = Math.min(...fullInts);
  const maxOff = Math.max(...fullInts);
  const span = fullInts[fullInts.length - 1] - fullInts[0];

  let chosenContraryStart = res.effectiveContraryStart;
  let contraryFellBack = res.contraryFellBackToUnison;

  let rootMidi = findBestScaleRootMidi({
    rootPc: opts.rootPc,
    minOff,
    maxOff,
    hands: opts.hands,
    contraryStart: chosenContraryStart,
    clef: opts.clef,
    lo: opts.lo,
    hi: opts.hi,
  });

  if (
    rootMidi === null &&
    opts.hands === 'contrary' &&
    chosenContraryStart === 'octave'
  ) {
    const unisonRoot = findBestScaleRootMidi({
      rootPc: opts.rootPc,
      minOff,
      maxOff,
      hands: opts.hands,
      contraryStart: 'unison',
      clef: opts.clef,
      lo: opts.lo,
      hi: opts.hi,
    });
    if (unisonRoot !== null) {
      rootMidi = unisonRoot;
      chosenContraryStart = 'unison';
      contraryFellBack = true;
    }
  }

  // Last-resort fallback for ultra-narrow ranges (< 2 octaves)
  if (rootMidi === null) {
    const center = (opts.lo + opts.hi) / 2;
    const pc = normalizePc(opts.rootPc);
    let best = 60 + pc;
    let bestDist = Infinity;
    for (let m = 24; m <= 96; m++) {
      if (m % 12 !== pc) continue;
      const d = Math.abs(m - center);
      if (d < bestDist) {
        bestDist = d;
        best = m;
      }
    }
    rootMidi = best;
  }

  const rhAsc = fullInts.map(off => rootMidi + off);
  const rhSeq = opts.dir === 'up' ? rhAsc : [...rhAsc].reverse();

  if (opts.hands === 'one' || opts.hands === 'right' || opts.hands === 'left') {
    return {
      rhSeq,
      lhSeq: null,
      steps: rhSeq.map(m => [m]),
      effectiveOctaves: res.effectiveOctaves,
      effectiveContraryStart: chosenContraryStart,
      contraryFellBackToUnison: contraryFellBack,
    };
  }

  if (opts.hands === 'parallel') {
    const lhSeq = rhSeq.map(m => m - 12);
    const steps = rhSeq.map((rm, i) =>
      [lhSeq[i], rm].sort((a, b) => a - b),
    );
    return {
      rhSeq,
      lhSeq,
      steps,
      effectiveOctaves: res.effectiveOctaves,
      effectiveContraryStart: chosenContraryStart,
      contraryFellBackToUnison: contraryFellBack,
    };
  }

  // Diatonic contrary motion:
  // Both hands stay strictly within the selected scale/arpeggio degrees.
  const lhStartRoot =
    chosenContraryStart === 'unison' ? rootMidi : rootMidi - 12;
  const last = fullInts.length - 1;
  const isMonotonic = fullInts.every((v, i) => i === 0 || v >= fullInts[i - 1]);
  const lhAscOutward = isMonotonic
    ? fullInts.map((_, i) => {
        const degOff = fullInts[last - i] - fullInts[0];
        return lhStartRoot - (span - degOff);
      })
    : fullInts.map(off => lhStartRoot - (off - fullInts[0]));
  const lhSeq = opts.dir === 'up' ? lhAscOutward : [...lhAscOutward].reverse();

  const steps = rhSeq.map((rm, i) => {
    const lm = lhSeq[i];
    if (lm === rm) return [rm];
    return [lm, rm].sort((a, b) => a - b);
  });

  return {
    rhSeq,
    lhSeq,
    steps,
    effectiveOctaves: res.effectiveOctaves,
    effectiveContraryStart: chosenContraryStart,
    contraryFellBackToUnison: contraryFellBack,
  };
}
