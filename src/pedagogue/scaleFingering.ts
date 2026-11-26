export interface ScaleFingeringContext {
  k?: string;
  m?: string;
  sc?: number[];
  r?: number;
  ar?: boolean;
  tech?: boolean;
}

const isBlackKey = (m: number): boolean => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);

/**
 * Repeats a 7-note cyclic scale template across `octaves` and caps with `topFinger`.
 */
function expandSevenNoteTemplate(
  cycle: number[],
  octaves: number,
  topFinger: number,
  startOverride?: number,
): number[] {
  const out: number[] = [];
  for (let o = 0; o < octaves; o++) {
    out.push(...cycle);
  }
  out.push(topFinger);
  if (startOverride != null) out[0] = startOverride;
  return out;
}

function expandFourNoteArpTemplate(
  cycle: number[],
  octaves: number,
  topFinger: number,
  startOverride?: number,
): number[] {
  const out: number[] = [];
  for (let o = 0; o < octaves; o++) {
    out.push(...cycle);
  }
  out.push(topFinger);
  if (startOverride != null) out[0] = startOverride;
  return out;
}

/**
 * Checks if a candidate scale fingering respects basic black-key thumb/pinky ergonomics.
 */
function fitsBlackKeyRules(ms: number[], f: number[]): boolean {
  if (ms.length !== f.length) return false;
  for (let i = 0; i < ms.length; i++) {
    if (isBlackKey(ms[i]) && (f[i] === 1 || f[i] === 5)) {
      return false;
    }
  }
  return true;
}

/**
 * Canonical conservatory fingerings for ascending 7-note diatonic scales
 * (Major, Natural/Harmonic/Melodic Minor, and compatible modes).
 */
function getCanonicalAscendingScaleFingering(
  ascMs: number[],
  hand: 'R' | 'L',
): number[] | null {
  const n = ascMs.length;
  if (n < 8 || (n - 1) % 7 !== 0) return null;
  const octaves = (n - 1) / 7;
  const rootPc = ((ascMs[0] % 12) + 12) % 12;

  const candidates: number[][] = [];

  if (hand === 'R') {
    if ([0, 2, 4, 7, 9, 11].includes(rootPc)) {
      // C, D, E, G, A, B (major & minor)
      candidates.push(expandSevenNoteTemplate([1, 2, 3, 1, 2, 3, 4], octaves, 5));
    } else if (rootPc === 5) {
      // F major & F minor
      candidates.push(expandSevenNoteTemplate([1, 2, 3, 4, 1, 2, 3], octaves, 4));
      // F Lydian fallback (B natural allows standard 1-2-3-1-2-3-4-5)
      candidates.push(expandSevenNoteTemplate([1, 2, 3, 1, 2, 3, 4], octaves, 5));
    } else {
      const thirdSemi = ascMs[2] - ascMs[0];
      if (rootPc === 1) {
      // Db / C# major & C# minor
      if (thirdSemi === 3) {
        candidates.push(expandSevenNoteTemplate([3, 4, 1, 2, 3, 1, 2], octaves, 3)); // C# natural/harmonic minor
        candidates.push(expandSevenNoteTemplate([3, 4, 1, 2, 3, 4, 1], octaves, 2)); // C# melodic minor asc
      }
      candidates.push(expandSevenNoteTemplate([2, 3, 1, 2, 3, 4, 1], octaves, 2)); // Db major
      candidates.push(expandSevenNoteTemplate([3, 4, 1, 2, 3, 1, 2], octaves, 3));
      candidates.push(expandSevenNoteTemplate([3, 4, 1, 2, 3, 4, 1], octaves, 2));
    } else if (rootPc === 3) {
      // Eb major & Eb minor
      candidates.push(expandSevenNoteTemplate([3, 1, 2, 3, 4, 1, 2], octaves, 3));
    } else if (rootPc === 6) {
      // F# major & F# minor
      if (thirdSemi === 3) {
        candidates.push(expandSevenNoteTemplate([2, 3, 1, 2, 3, 1, 2], octaves, 3)); // F# natural/harmonic minor
        candidates.push(expandSevenNoteTemplate([2, 3, 1, 2, 3, 4, 1], octaves, 2)); // F# melodic minor asc
      }
      candidates.push(expandSevenNoteTemplate([2, 3, 4, 1, 2, 3, 1], octaves, 2)); // F# major
      candidates.push(expandSevenNoteTemplate([2, 3, 1, 2, 3, 1, 2], octaves, 3));
      candidates.push(expandSevenNoteTemplate([2, 3, 1, 2, 3, 4, 1], octaves, 2));
    } else if (rootPc === 8) {
      // Ab major & G# minor
      candidates.push(expandSevenNoteTemplate([3, 4, 1, 2, 3, 1, 2], octaves, 3));
      candidates.push(expandSevenNoteTemplate([3, 4, 1, 2, 3, 4, 1], octaves, 2)); // G# melodic minor asc
    } else if (rootPc === 10) {
      // Bb major & Bb minor
      if (thirdSemi === 3) {
        if (octaves > 1) {
          const bbMin: number[] = [2, 1, 2, 3, 1, 2, 3];
          for (let o = 1; o < octaves; o++) bbMin.push(4, 1, 2, 3, 1, 2, 3);
          bbMin.push(4);
          candidates.push(bbMin);
        }
        candidates.push(expandSevenNoteTemplate([2, 1, 2, 3, 1, 2, 3], octaves, 4));
      }
      candidates.push(expandSevenNoteTemplate([4, 1, 2, 3, 1, 2, 3], octaves, 4)); // Bb major
      candidates.push(expandSevenNoteTemplate([2, 1, 2, 3, 1, 2, 3], octaves, 4));
      }
    }
  } else {
    // Left hand ascending
    if ([0, 2, 4, 5, 7, 9].includes(rootPc)) {
      // C, D, E, F, G, A (major & minor)
      candidates.push(expandSevenNoteTemplate([5, 4, 3, 2, 1, 3, 2], octaves, 1));
      if (octaves > 1) {
        const fCycle = [5, 4, 3, 2, 1, 3, 2];
        for (let o = 1; o < octaves; o++) fCycle.push(1, 4, 3, 2, 1, 3, 2);
        fCycle.push(1);
        // Replace index 0..6 properly: cycle is actually [5,4,3,2,1,3,2,1] shifted:
        // Correct 2-oct LH C-group: 5-4-3-2-1-3-2-1-4-3-2-1-3-2-1
        const exact: number[] = [5, 4, 3, 2, 1, 3, 2];
        for (let o = 1; o < octaves; o++) exact.push(1, 4, 3, 2, 1, 3, 2);
        exact.push(1);
        candidates.unshift(exact);
      }
    } else if (rootPc === 11) {
      // B major & B minor: 4-3-2-1-4-3-2-1-3-2-1-4-3-2-1
      const exact: number[] = [4, 3, 2, 1, 4, 3, 2];
      for (let o = 1; o < octaves; o++) exact.push(1, 3, 2, 1, 4, 3, 2);
      exact.push(1);
      candidates.push(exact);
    } else if (rootPc === 1) {
      // Db major & C# minor: 3-2-1-4-3-2-1-3-2-1-4-3-2-1-2
      candidates.push(expandSevenNoteTemplate([3, 2, 1, 4, 3, 2, 1], octaves, 2));
      candidates.push(expandSevenNoteTemplate([3, 2, 1, 4, 3, 2, 1], octaves, 3));
    } else if (rootPc === 3) {
      // Eb major (3-2-1-4-3-2-1-3) & Eb minor (2-1-4-3-2-1-3-2)
      // Distinguish Eb major (G natural at +4) vs Eb minor (Gb at +3)
      const thirdSemi = ascMs[2] - ascMs[0];
      if (thirdSemi === 3) {
        candidates.push(expandSevenNoteTemplate([2, 1, 4, 3, 2, 1, 3], octaves, 2));
      }
      candidates.push(expandSevenNoteTemplate([3, 2, 1, 4, 3, 2, 1], octaves, 3));
      candidates.push(expandSevenNoteTemplate([2, 1, 4, 3, 2, 1, 3], octaves, 2));
    } else if (rootPc === 6) {
      // F# major & F# minor: 4-3-2-1-3-2-1-4-3-2-1-3-2-1-2
      candidates.push(expandSevenNoteTemplate([4, 3, 2, 1, 3, 2, 1], octaves, 2));
      candidates.push(expandSevenNoteTemplate([4, 3, 2, 1, 3, 2, 1], octaves, 3));
    } else if (rootPc === 8) {
      // Ab major (3-2-1-4-3-2-1-3) & G# natural/harmonic minor (3-2-1-3-2-1-4-3)
      const thirdSemi = ascMs[2] - ascMs[0];
      if (thirdSemi === 3) {
        candidates.push(expandSevenNoteTemplate([3, 2, 1, 3, 2, 1, 4], octaves, 3));
      }
      candidates.push(expandSevenNoteTemplate([3, 2, 1, 4, 3, 2, 1], octaves, 3));
    } else if (rootPc === 10) {
      // Bb major (3-2-1-4-3-2-1-2) & Bb minor (2-1-3-2-1-4-3-2)
      const thirdSemi = ascMs[2] - ascMs[0];
      if (thirdSemi === 3) {
        candidates.push(expandSevenNoteTemplate([2, 1, 3, 2, 1, 4, 3], octaves, 2));
      }
      candidates.push(expandSevenNoteTemplate([3, 2, 1, 4, 3, 2, 1], octaves, 2));
      candidates.push(expandSevenNoteTemplate([2, 1, 3, 2, 1, 4, 3], octaves, 2));
    }
  }

  for (const cand of candidates) {
    if (cand.length === n && fitsBlackKeyRules(ascMs, cand)) {
      return cand;
    }
  }
  return null;
}

/**
 * Canonical fingerings for ascending 3-note triad & 4-note 7th arpeggios.
 */
function getCanonicalAscendingArpFingering(
  ascMs: number[],
  hand: 'R' | 'L',
): number[] | null {
  const n = ascMs.length;
  const firstBlack = isBlackKey(ascMs[0]);
  const allBlack = ascMs.every(isBlackKey);

  // 3-note triad arpeggio: 1 oct = 4 notes, 2 oct = 7 notes, 3 oct = 10, 4 oct = 13
  if (n >= 4 && (n - 1) % 3 === 0) {
    const octaves = (n - 1) / 3;
    const step1 = ascMs[1] - ascMs[0];
    const step2 = ascMs[2] - ascMs[1];

    if (hand === 'R') {
      // Standard white-root or all-black triad:
      // Use 1-2-4 when the middle interval is wide (e.g. 1st inv E-G-C has +5 between 2nd & 3rd note)
      if (!firstBlack || allBlack) {
        const rhShape = step2 >= 5 ? [1, 2, 4] : [1, 2, 3];
        return expandFourNoteArpTemplate(rhShape, octaves, 5);
      }
      // Black-root with white 3rd (Db, Eb, Ab, Bb major; F#m, C#m, G#m): 2-1-2-4-1-2-4
      if (!isBlackKey(ascMs[1])) {
        const res = expandFourNoteArpTemplate([4, 1, 2], octaves, 4, 2);
        if (fitsBlackKeyRules(ascMs, res)) return res;
      }
      // Black-root with black 3rd & white 5th (e.g., Bbm = Bb-Db-F): 2-3-1-2-3-1-2
      if (isBlackKey(ascMs[1]) && !isBlackKey(ascMs[2])) {
        const res = expandFourNoteArpTemplate([2, 3, 1], octaves, 2);
        if (fitsBlackKeyRules(ascMs, res)) return res;
      }
    } else {
      // Left hand triad arpeggio:
      // Root C-E-G (4,3) -> 5-4-2-1; Minor C-Eb-G (3,4) -> 5-3-2-1;
      // 1st inv E-G-C (3,5) -> 5-4-2-1; 2nd inv G-C-E (5,4) -> 5-3-2-1
      if (!firstBlack || allBlack) {
        const lhShape =
          step2 >= 5 || (step1 === 4 && step2 === 3) ? [5, 4, 2] : [5, 3, 2];
        const out = [5, lhShape[1], lhShape[2]];
        for (let o = 1; o < octaves; o++) out.push(1, lhShape[1], lhShape[2]);
        out.push(1);
        return out;
      }
      // Black-root with white 3rd: 2-1-4-2-1-4-2
      if (!isBlackKey(ascMs[1]) && isBlackKey(ascMs[2])) {
        const res = expandFourNoteArpTemplate([2, 1, 4], octaves, 2);
        if (fitsBlackKeyRules(ascMs, res)) return res;
      }
      // Black-root with white 3rd & white 5th (e.g. Bb major = Bb-D-F): 3-2-1-3-2-1-3
      if (!isBlackKey(ascMs[1]) && !isBlackKey(ascMs[2])) {
        const res = expandFourNoteArpTemplate([3, 2, 1], octaves, 3);
        if (fitsBlackKeyRules(ascMs, res)) return res;
      }
      // Black-root with black 3rd & white 5th (e.g. Bbm = Bb-Db-F): 3-2-1-3-2-1-3
      if (isBlackKey(ascMs[1]) && !isBlackKey(ascMs[2])) {
        const res = expandFourNoteArpTemplate([3, 2, 1], octaves, 3);
        if (fitsBlackKeyRules(ascMs, res)) return res;
      }
    }
  }

  // 4-note 7th arpeggio: 1 oct = 5 notes, 2 oct = 9 notes, etc.
  if (n >= 5 && (n - 1) % 4 === 0) {
    const octaves = (n - 1) / 4;
    if (hand === 'R') {
      if (!firstBlack || allBlack) {
        return expandFourNoteArpTemplate([1, 2, 3, 4], octaves, 5);
      }
      if (!isBlackKey(ascMs[1])) {
        const res = expandFourNoteArpTemplate([4, 1, 2, 3], octaves, 4, 2);
        if (fitsBlackKeyRules(ascMs, res)) return res;
      }
    } else {
      if (!firstBlack || allBlack) {
        const out = [5, 4, 3, 2];
        for (let o = 1; o < octaves; o++) out.push(1, 4, 3, 2);
        out.push(1);
        return out;
      }
      if (!isBlackKey(ascMs[1])) {
        const res = expandFourNoteArpTemplate([2, 1, 4, 3], octaves, 2);
        if (fitsBlackKeyRules(ascMs, res)) return res;
      }
    }
  }

  return null;
}

/**
 * General direction-aware DP fallback for modes, pentatonics, Hanon, 5-finger patterns, and melodies.
 */
export function runScaleDP(ms: number[], h: 'R' | 'L'): number[] {
  const n = ms.length;
  if (!n) return [];
  if (n === 1) return [h === 'R' ? 1 : 5];

  const s = h === 'R' ? 1 : -1;
  const anyWhite = ms.some(m => !isBlackKey(m));
  const bkThumbPenalty = anyWhite ? 8 : 0.6;
  const bkPinkyPenalty = anyWhite ? 5 : 0.5;

  const isOverallAsc = ms[n - 1] >= ms[0];
  // Anatomical direction in finger space: +1 means finger number increases (1->5), -1 means decreases (5->1)
  const overallFingerDir = (isOverallAsc ? 1 : -1) * s;

  const startPrefs =
    overallFingerDir > 0
      ? [0, 0.3, 0.7, 1.0, 2.2] // starting upward on RH or downward on LH -> favor thumb/2/3
      : [2.2, 1.0, 0.7, 0.4, 0]; // starting downward on RH or upward on LH -> favor pinky/4/3

  const endPrefs =
    overallFingerDir > 0
      ? [2.0, 0.8, 0.6, 0.3, 0] // ending at top of RH or bottom of LH -> favor pinky/4/3
      : [0, 0.4, 0.7, 1.0, 2.0]; // ending at bottom of RH or top of LH -> favor thumb/2/3

  const cost = (a: number, b: number, m1: number, m2: number) => {
    const d = (m2 - m1) * s;
    const dl = b - a;
    const ad = Math.abs(d);
    let c = 0;

    if (d === 0) {
      c = a === b ? 0 : 1.0;
    } else if (ad > 10) {
      c = 2.0;
    } else if (Math.sign(d) === Math.sign(dl)) {
      const fSpan = Math.abs(dl);
      const hasThumb = a === 1 || b === 1;
      const maxComfort = hasThumb ? fSpan * 3 + 2 : fSpan * 2 + 1;
      const minComfort = fSpan * 1.1;
      c =
        Math.max(0, ad - maxComfort) * 2.8 +
        Math.max(0, minComfort - ad) * 0.6;
    } else if ((d > 0 && b === 1) || (d < 0 && a === 1)) {
      const o = d > 0 ? a : b;
      c = 2.6 + (o === 3 || o === 4 ? 0 : o === 2 ? 1.8 : 4.0);
    } else {
      return 99;
    }

    if (b === 1 && isBlackKey(m2)) c += bkThumbPenalty;
    if (b === 5 && isBlackKey(m2)) c += bkPinkyPenalty;
    return c;
  };

  const dp: [number, number][][] = [
    [1, 2, 3, 4, 5].map(f => [
      startPrefs[f - 1] +
        (f === 1 && isBlackKey(ms[0]) ? bkThumbPenalty : 0) +
        (f === 5 && isBlackKey(ms[0]) ? bkPinkyPenalty : 0),
      0,
    ]),
  ];

  for (let i = 1; i < n; i++) {
    dp.push(
      [1, 2, 3, 4, 5].map(b => {
        let best: [number, number] = [1e9, 0];
        for (let a = 1; a <= 5; a++) {
          const v = dp[i - 1][a - 1][0] + cost(a, b, ms[i - 1], ms[i]);
          if (v < best[0]) best = [v, a];
        }
        return best;
      }),
    );
  }

  const last = dp[n - 1].map((x, i) => x[0] + endPrefs[i]);
  let f = last.indexOf(Math.min(...last)) + 1;
  const out = [f];
  for (let i = n - 1; i > 0; i--) {
    f = dp[i][f - 1][1];
    out.unshift(f);
  }
  return out;
}

/**
 * Computes pianistically accurate fingering for scales, arpeggios, 5-finger drills, Hanon, and melodies.
 */
export function computeScaleOrMelFingering(
  ms: number[],
  hand: 'R' | 'L',
  ci?: ScaleFingeringContext | null,
): number[] {
  if (!ms.length) return [];

  // Check if strictly monotonic ascending or strictly monotonic descending
  const isStrictAsc = ms.every((v, i) => i === 0 || v > ms[i - 1]);
  const isStrictDesc = ms.every((v, i) => i === 0 || v < ms[i - 1]);

  if (ci?.k === 'scale' && !ci.tech && (isStrictAsc || isStrictDesc)) {
    const ascMs = isStrictAsc ? ms : [...ms].reverse();
    const canonical = ci.ar
      ? getCanonicalAscendingArpFingering(ascMs, hand)
      : getCanonicalAscendingScaleFingering(ascMs, hand);
    if (canonical) {
      return isStrictAsc ? canonical : [...canonical].reverse();
    }
  }

  // For strictly descending monotonic runs without a canonical table entry,
  // compute ascending and reverse so up/down fingerings mirror consistently.
  if (isStrictDesc) {
    return [...runScaleDP([...ms].reverse(), hand)].reverse();
  }

  return runScaleDP(ms, hand);
}
