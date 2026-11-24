export type VLRangeMode = 'locked' | 'unlocked';
export type VLDirectionSetting = 'up' | 'down' | 'auto';
export type VLDirection = 'up' | 'down';
export type VLSeventhMode = 'full' | 'omit5' | 'auto';
export type VLInversionKey =
  | 'root'
  | '1st'
  | '2nd'
  | '3rd'
  | '4th'
  | '5th'
  | '6th';

export interface VLWindow {
  anchorIdx: number;
  winLoIdx: number;
  winHiIdx: number;
}

export interface VLStepInput {
  ints: number[];
  pc: number;
  hand: 'R' | 'L';
  scaleRoot: number;
  scaleIntervals: number[];
  bounds: [number, number];
  rangeMode: VLRangeMode;
  direction: VLDirectionSetting;
  seventhMode?: VLSeventhMode;
  prevNotes?: number[] | null;
  prevFingers?: number[] | null;
  prevAnchorIdx?: number | null;
  prevDirection?: VLDirection | null;
  drop2Base?: number[];
  isSlash?: boolean;
  slashName?: string;
  fixedInv?: number;
  preferredMid?: number;
  noteToScaleIdx?: (midi: number) => number;
}

export interface VLStepOutput {
  notes: number[];
  fingers: number[];
  anchorIdx: number;
  window: VLWindow;
  direction: VLDirection;
  inversion: VLInversionKey;
  inversionLabel: string;
  handShift: number;
  shapeChange: boolean;
  dirFlipped: boolean;
  adjusted: boolean;
  omittedFifth: boolean;
  commonTonesKept: number;
  notRootPosition?: boolean;
  warning?: string;
}

const INV_KEYS: VLInversionKey[] = [
  'root',
  '1st',
  '2nd',
  '3rd',
  '4th',
  '5th',
  '6th',
];

const INV_LABELS = [
  'root position',
  '1st inversion',
  '2nd inversion',
  '3rd inversion',
  '4th inversion',
  '5th inversion',
  '6th inversion',
];

// 7 consecutive scale degrees: [-1 (lower ext), 0 (anchor), +1, +2, +3, +4 (5th slot), +5 (upper ext)]
const RH_SLOT_FINGER: Record<number, number> = {
  [-1]: 1,
  0: 1,
  1: 2,
  2: 3,
  3: 4,
  4: 5,
  5: 5,
};

const LH_SLOT_FINGER: Record<number, number> = {
  [-1]: 5,
  0: 5,
  1: 4,
  2: 3,
  3: 2,
  4: 1,
  5: 1,
};

export function buildVoicingMidi(
  ints: number[],
  pc: number,
  inv: number,
  oct: number,
  drop2Base?: number[],
): number[] {
  if (drop2Base && drop2Base.length >= 4) {
    const close = buildVoicingMidi(drop2Base, 0, inv % drop2Base.length, oct);
    return [close[2] - 12, close[0], close[1], close[3]].map(m => m + pc);
  }
  const rootMidi = 12 * (oct + 1) + pc;
  if (inv <= 0) {
    return [...new Set(ints.map(x => rootMidi + x))].sort((x, y) => x - y);
  }
  const hasCompound = ints.some(x => x < 0 || x >= 12);
  if (!hasCompound) {
    const a = ints.map(x => rootMidi + x);
    for (let i = 0; i < inv; i++) a.push(a.shift()! + 12);
    return [...new Set(a)].sort((x, y) => x - y);
  }
  const targetIdx = inv % ints.length;
  const bassOff = ((ints[targetIdx] % 12) + 12) % 12;
  const offsets = ints.map(x => {
    const p = ((x % 12) + 12) % 12;
    return p >= bassOff ? p : p + 12;
  });
  return [...new Set(offsets.map(o => rootMidi + o))].sort((x, y) => x - y);
}

/**
 * Maps any MIDI pitch to an integer scale-degree index in the current scale.
 * For 7-note modes, consecutive degrees (e.g. C4..B4) map to consecutive integers.
 */
export function buildScaleDegreeLookup(
  scaleRoot: number,
  scaleIntervals: number[],
): (midi: number) => number {
  const len = scaleIntervals.length || 7;
  const table: {idx: number; midi: number}[] = [];
  for (let oct = -2; oct <= 10; oct++) {
    for (let deg = 0; deg < len; deg++) {
      const m = 12 * (oct + 1) + scaleRoot + scaleIntervals[deg];
      table.push({idx: (oct + 1) * len + deg, midi: m});
    }
  }
  table.sort((a, b) => a.midi - b.midi);

  return (midi: number) => {
    let bestIdx = 0;
    let bestDist = 999;
    for (const entry of table) {
      const d = Math.abs(entry.midi - midi);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = entry.idx;
        if (d === 0) break;
      }
    }
    return bestIdx;
  };
}

/**
 * 7-degree window anchored at `anchorIdx`:
 * [-1 (lower extension), 0 (anchor), +1, +2, +3, +4 (5th slot), +5 (upper extension)].
 */
export function windowForAnchor(
  anchorIdx: number,
  chordSize = 3,
  scaleLen = 7,
): VLWindow {
  // Triads and 4-note 7th chords always live inside the 7-degree window [-1..+5].
  // Compound 5+ note chords (9ths/11ths/13ths) expand upper extension only as needed.
  const extraUpper =
    scaleLen === 7 && chordSize >= 5 ? Math.min(2, chordSize - 4) : 0;
  return {
    anchorIdx,
    winLoIdx: anchorIdx - 1,
    winHiIdx: anchorIdx + 5 + extraUpper,
  };
}

function isMonotonicValid(arr: number[], hand: 'R' | 'L'): boolean {
  const dir = hand === 'R' ? 1 : -1;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] < 1 || arr[i] > 5) return false;
    if (i > 0 && (arr[i] - arr[i - 1]) * dir <= 0) return false;
  }
  return true;
}

/**
 * Resolves fingers from the 7-degree window map with explicit extension-clash rules:
 * - Lower extension keeps thumb (RH 1 / LH pinky 5); inner clash moves inward by 1.
 * - Upper extension keeps pinky (RH 5 / LH thumb 1); inner clash moves inward by 1.
 * - Cascades inward by one if needed, flagging `adjusted = true`.
 * - Returns `valid = false` if n <= 5 cannot form distinct strictly monotonic fingers.
 */
export function resolveWindowFingersStrict(
  slotOffsets: number[],
  hand: 'R' | 'L',
): {fingers: number[]; adjusted: boolean; valid: boolean} {
  const n = slotOffsets.length;
  if (n === 0) return {fingers: [], adjusted: false, valid: true};
  if (n === 1) {
    return {fingers: [hand === 'L' ? 5 : 1], adjusted: false, valid: true};
  }

  const baseMap = hand === 'R' ? RH_SLOT_FINGER : LH_SLOT_FINGER;
  const raw = slotOffsets.map(off => {
    if (off in baseMap) return baseMap[off];
    if (off < -1) return hand === 'R' ? 1 : 5;
    return hand === 'R' ? 5 : 1;
  });

  if (n <= 5 && isMonotonicValid(raw, hand)) {
    return {fingers: raw, adjusted: false, valid: true};
  }

  if (n <= 5) {
    const res = [...raw];
    let adjusted = false;

    if (hand === 'R') {
      // Thumb clash (-1 and 0 share 1): lower extension (-1) keeps 1; inner note moves inward to 2
      if (slotOffsets[0] <= -1 && res[0] === 1 && res[1] === 1) {
        res[1] = 2;
        adjusted = true;
      }
      // Pinky clash (+4 and +5 share 5): upper extension (+5) keeps 5; inner note moves inward to 4
      if (
        slotOffsets[n - 1] >= 5 &&
        res[n - 1] === 5 &&
        res[n - 2] === 5
      ) {
        res[n - 2] = 4;
        adjusted = true;
      }

      // Cascade inward from any remaining clashes
      for (let i = 1; i < n; i++) {
        if (res[i] <= res[i - 1]) {
          // Prefer keeping upper extension (5) anchored when resolving at the top
          if (i === n - 1 && slotOffsets[n - 1] >= 5 && res[n - 1] === 5) {
            for (let j = n - 2; j >= 0; j--) {
              if (res[j] >= res[j + 1]) {
                res[j] = res[j + 1] - 1;
                adjusted = true;
              }
            }
          } else {
            res[i] = res[i - 1] + 1;
            adjusted = true;
          }
        }
      }

      if (res[n - 1] > 5) {
        res[n - 1] = 5;
        adjusted = true;
        for (let i = n - 2; i >= 0; i--) {
          if (res[i] >= res[i + 1]) {
            res[i] = res[i + 1] - 1;
            adjusted = true;
          }
        }
      }
    } else {
      // LH mirror: low extension (-1, 0) keeps pinky 5; inner moves inward to 4
      if (slotOffsets[0] <= -1 && res[0] === 5 && res[1] === 5) {
        res[1] = 4;
        adjusted = true;
      }
      // High extension (+4, +5) keeps thumb 1; inner moves inward to 2
      if (
        slotOffsets[n - 1] >= 5 &&
        res[n - 1] === 1 &&
        res[n - 2] === 1
      ) {
        res[n - 2] = 2;
        adjusted = true;
      }

      for (let i = 1; i < n; i++) {
        if (res[i] >= res[i - 1]) {
          if (i === n - 1 && slotOffsets[n - 1] >= 5 && res[n - 1] === 1) {
            for (let j = n - 2; j >= 0; j--) {
              if (res[j] <= res[j + 1]) {
                res[j] = res[j + 1] + 1;
                adjusted = true;
              }
            }
          } else {
            res[i] = res[i - 1] - 1;
            adjusted = true;
          }
        }
      }

      if (res[n - 1] < 1) {
        res[n - 1] = 1;
        adjusted = true;
        for (let i = n - 2; i >= 0; i--) {
          if (res[i] <= res[i + 1]) {
            res[i] = res[i + 1] + 1;
            adjusted = true;
          }
        }
      }
    }

    const ok = isMonotonicValid(res, hand);
    return {fingers: res, adjusted: adjusted || !ok, valid: ok};
  }

  // Fallback for 6+ note single-hand chords
  const f: number[] = [];
  while (f.length < n - 4) f.push(1);
  f.push(2, 3, 4, 5);
  return {
    fingers: hand === 'L' ? [...f].reverse() : f,
    adjusted: true,
    valid: true,
  };
}

/**
 * Convenience wrapper returning monotonic finger numbers (1..5) from the 7-degree
 * anchor window finger map.
 */
export function assignWindowFingers(
  slotOffsets: number[],
  hand: 'R' | 'L',
  chordInts?: number[],
): number[] {
  void chordInts;
  const res = resolveWindowFingersStrict(slotOffsets, hand);
  if (res.valid) return res.fingers;
  const n = slotOffsets.length;
  const fallback = Array.from({length: Math.min(5, n)}, (_, i) => i + 1);
  return hand === 'L' ? [...fallback].reverse() : fallback;
}

export function identifyInversion(
  notes: number[],
  rootPc: number,
  ints: number[],
  isSlash?: boolean,
  slashName?: string,
): {inversion: VLInversionKey; inversionLabel: string} {
  if (isSlash && slashName) {
    return {inversion: 'root', inversionLabel: slashName};
  }
  if (!notes.length) {
    return {inversion: 'root', inversionLabel: 'root position'};
  }
  const lowPc = ((notes[0] % 12) + 12) % 12;
  const idx = ints.findIndex(x => ((rootPc + x) % 12 + 12) % 12 === lowPc);
  const k = idx >= 0 ? Math.min(idx, INV_KEYS.length - 1) : 0;
  return {
    inversion: INV_KEYS[k] || 'root',
    inversionLabel: INV_LABELS[k] || 'root position',
  };
}

function allCandidateVoicings(
  ints: number[],
  pc: number,
  bounds: [number, number],
  drop2Base?: number[],
  fixedInv?: number,
): number[][] {
  const seen = new Set<string>();
  const out: number[][] = [];
  const invList =
    fixedInv != null
      ? [fixedInv % ints.length]
      : Array.from({length: ints.length}, (_, i) => i);

  for (const inv of invList) {
    for (let oct = -1; oct <= 8; oct++) {
      const notes = buildVoicingMidi(ints, pc, inv, oct, drop2Base);
      if (notes[0] < bounds[0] || notes[notes.length - 1] > bounds[1]) continue;
      const key = notes.join(',');
      if (!seen.has(key)) {
        seen.add(key);
        out.push(notes);
      }
    }
  }
  return out;
}

function fingerDiffCount(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) {
    let diff = Math.abs(a.length - b.length);
    const minL = Math.min(a.length, b.length);
    for (let i = 0; i < minL; i++) if (a[i] !== b[i]) diff++;
    return diff;
  }
  let c = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) c++;
  return c;
}

function sameShape(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function countCommonTonesSameFinger(
  notes: number[],
  fingers: number[],
  prevNotes?: number[] | null,
  prevFingers?: number[] | null,
): number {
  if (!prevNotes?.length || !prevFingers?.length) return 0;
  let kept = 0;
  for (let i = 0; i < notes.length; i++) {
    const pIdx = prevNotes.indexOf(notes[i]);
    if (pIdx >= 0 && prevFingers[pIdx] === fingers[i]) kept++;
  }
  return kept;
}

function totalMovement(a: number[], b: number[]): number {
  if (!a.length || !b.length) return 0;
  if (a.length === b.length) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
    return s;
  }
  let s = 0;
  for (const n of a) {
    let minD = 99;
    for (const p of b) minD = Math.min(minD, Math.abs(n - p));
    s += minD;
  }
  return s;
}

function isFourNoteSeventh(ints: number[]): boolean {
  return ints.length === 4;
}

function omitFifthInts(ints: number[]): number[] {
  if (ints.length !== 4) return ints;
  return [ints[0], ints[1], ints[3]];
}

function computeSingleModeVoiceLed(
  input: VLStepInput,
  activeInts: number[],
  fullIntsForInversion: number[],
  omittedFifth: boolean,
): VLStepOutput {
  const {
    pc,
    hand,
    scaleRoot,
    scaleIntervals,
    bounds,
    rangeMode,
    direction,
    prevNotes,
    prevFingers,
    prevAnchorIdx,
    prevDirection,
    drop2Base,
    isSlash,
    slashName,
    fixedInv,
    preferredMid,
  } = input;

  const scaleLen = scaleIntervals.length || 7;
  const toScaleIdx =
    input.noteToScaleIdx || buildScaleDegreeLookup(scaleRoot, scaleIntervals);
  const prevSlots = prevNotes ? prevNotes.map(toScaleIdx) : null;
  const isFourNoteChord = fullIntsForInversion.length === 4;

  const activeDrop2Base = omittedFifth ? undefined : drop2Base;
  const candidates = allCandidateVoicings(
    activeInts,
    pc,
    bounds,
    activeDrop2Base,
    fixedInv,
  );

  // =========================================================================
  // STARTING PRIMARY CHORD (no previous chord)
  // =========================================================================
  if (!prevNotes || !prevNotes.length || prevAnchorIdx == null) {
    const rootCands = allCandidateVoicings(
      activeInts,
      pc,
      bounds,
      activeDrop2Base,
      fixedInv ?? 0,
    );
    const targetMid = preferredMid ?? (hand === 'R' ? 67 : 52);
    const chosenRoot =
      (rootCands.length ? rootCands : candidates).sort((a, b) => {
        const avgA = a.reduce((s, x) => s + x, 0) / a.length;
        const avgB = b.reduce((s, x) => s + x, 0) / b.length;
        return Math.abs(avgA - targetMid) - Math.abs(avgB - targetMid);
      })[0] ||
      buildVoicingMidi(
        activeInts,
        pc,
        fixedInv ?? 0,
        hand === 'R' ? 4 : 3,
        activeDrop2Base,
      );

    const rootSlots = chosenRoot.map(toScaleIdx);
    const rootAnchorIdx = rootSlots[0];
    const rootSpan = rootSlots[rootSlots.length - 1] - rootSlots[0];

    // Locked mode + primary 7th chord (Rule 5):
    // A root-position 7th spans 6 degrees (e.g. E4..D5), which exceeds +5 above anchor E4.
    // Voice the primary chord as the locked 7-degree window [anchor-1 .. anchor+5] dictates,
    // and mark it as not in root position.
    if (rangeMode === 'locked' && (rootSpan > 5 || fullIntsForInversion.length >= 4)) {
      const win = windowForAnchor(rootAnchorIdx, activeInts.length, scaleLen);
      const primaryPool =
        fixedInv != null && !isSlash
          ? allCandidateVoicings(activeInts, pc, bounds, activeDrop2Base, undefined)
          : candidates;
      const inside = primaryPool
        .filter(c => {
          const s = c.map(toScaleIdx);
          return s[0] >= win.winLoIdx && s[s.length - 1] <= win.winHiIdx;
        })
        .map(c => {
          const wSlots = c.map(toScaleIdx);
          const res = resolveWindowFingersStrict(
            wSlots.map(s => s - rootAnchorIdx),
            hand,
          );
          return {c, res};
        })
        .filter(item => item.res.valid);

      if (inside.length) {
        inside.sort((a, b) => {
          const invA = identifyInversion(a.c, pc, fullIntsForInversion).inversion === 'root' ? 0 : 1;
          const invB = identifyInversion(b.c, pc, fullIntsForInversion).inversion === 'root' ? 0 : 1;
          if (invA !== invB) return invA - invB;
          if (a.res.adjusted !== b.res.adjusted) return a.res.adjusted ? 1 : -1;
          const avgA = a.c.reduce((s, x) => s + x, 0) / a.c.length;
          const avgB = b.c.reduce((s, x) => s + x, 0) / b.c.length;
          return Math.abs(avgA - targetMid) - Math.abs(avgB - targetMid);
        });
        const {c: winChosen, res} = inside[0];
        const invInfo = identifyInversion(
          winChosen,
          pc,
          fullIntsForInversion,
          isSlash,
          slashName,
        );
        const notRoot = invInfo.inversion !== 'root';
        const warnBits: string[] = [];
        if (notRoot) {
          warnBits.push(
            `Primary 7th chord is not in root position (${invInfo.inversionLabel} fits inside locked window)`,
          );
        }
        if (omittedFifth) {
          warnBits.push('5th omitted — no 4-finger ascending assignment fit in window');
        }
        return {
          notes: winChosen,
          fingers: res.fingers,
          anchorIdx: rootAnchorIdx,
          window: win,
          direction: prevDirection || (direction === 'down' ? 'down' : 'up'),
          inversion: invInfo.inversion,
          inversionLabel: invInfo.inversionLabel,
          handShift: 0,
          shapeChange: false,
          dirFlipped: false,
          adjusted: res.adjusted,
          omittedFifth,
          commonTonesKept: 0,
          notRootPosition: notRoot,
          warning: warnBits.length ? warnBits.join(' · ') : undefined,
        };
      } else if (!omittedFifth && isFourNoteChord) {
        return {
          notes: chosenRoot,
          fingers: [],
          anchorIdx: rootAnchorIdx,
          window: win,
          direction: prevDirection || (direction === 'down' ? 'down' : 'up'),
          inversion: 'root',
          inversionLabel: 'root position',
          handShift: 0,
          shapeChange: false,
          dirFlipped: false,
          adjusted: true,
          omittedFifth: false,
          commonTonesKept: 0,
          warning: '__NEED_OMIT5__',
        };
      }
    }

    // Standard primary chord (triad or unlocked 7th chord) in root position:
    // If root-position 7th spans 6 degrees [0..6], anchor sits 1 degree above root so [root=-1 .. 7th=+5].
    const anchorIdx =
      rootSpan === 6 && scaleLen === 7 ? rootSlots[0] + 1 : rootSlots[0];
    const win = windowForAnchor(anchorIdx, chosenRoot.length, scaleLen);
    const res = resolveWindowFingersStrict(
      rootSlots.map(s => s - anchorIdx),
      hand,
    );
    const invInfo = identifyInversion(
      chosenRoot,
      pc,
      fullIntsForInversion,
      isSlash,
      slashName,
    );
    return {
      notes: chosenRoot,
      fingers: res.valid
        ? res.fingers
        : assignWindowFingers(
            rootSlots.map(s => s - anchorIdx),
            hand,
            activeInts,
          ),
      anchorIdx,
      window: win,
      direction: prevDirection || (direction === 'down' ? 'down' : 'up'),
      inversion: invInfo.inversion,
      inversionLabel: invInfo.inversionLabel,
      handShift: 0,
      shapeChange: false,
      dirFlipped: false,
      adjusted: res.adjusted,
      omittedFifth,
      commonTonesKept: 0,
      notRootPosition: invInfo.inversion !== 'root',
    };
  }

  const prevWin = windowForAnchor(
    prevAnchorIdx,
    Math.max(prevNotes.length, activeInts.length),
    scaleLen,
  );

  // =========================================================================
  // LOCKED MODE: choose valid voicing inside the fixed 7-degree window
  // =========================================================================
  if (rangeMode === 'locked') {
    const inside = candidates.filter(c => {
      const s = c.map(toScaleIdx);
      return s[0] >= prevWin.winLoIdx && s[s.length - 1] <= prevWin.winHiIdx;
    });
    const pool = inside.length ? inside : candidates;
    const prevAvg = prevNotes.reduce((a, b) => a + b, 0) / prevNotes.length;

    interface LockedOption {
      notes: number[];
      fingers: number[];
      fDiff: number;
      commonKept: number;
      stepMov: number;
      adjusted: boolean;
      sameShp: boolean;
      avgDist: number;
    }

    const validOpts: LockedOption[] = [];

    for (const c of pool) {
      const slots = c.map(toScaleIdx);
      const res = resolveWindowFingersStrict(
        slots.map(s => s - prevAnchorIdx),
        hand,
      );
      if (!res.valid && inside.length) continue;

      const fingers = res.valid
        ? res.fingers
        : assignWindowFingers(
            slots.map(s => s - prevAnchorIdx),
            hand,
            activeInts,
          );
      const fDiff = prevFingers ? fingerDiffCount(fingers, prevFingers) : 0;
      const commonKept = countCommonTonesSameFinger(
        c,
        fingers,
        prevNotes,
        prevFingers,
      );
      const stepMov = prevSlots
        ? totalMovement(slots, prevSlots)
        : totalMovement(c, prevNotes);
      const sameShp = prevFingers ? sameShape(fingers, prevFingers) : true;
      const avgC = c.reduce((a, b) => a + b, 0) / c.length;

      validOpts.push({
        notes: c,
        fingers,
        fDiff,
        commonKept,
        stepMov,
        adjusted: res.adjusted,
        sameShp,
        avgDist: Math.abs(avgC - prevAvg),
      });
    }

    // Rule 4: if no valid 4-finger ascending assignment exists in locked mode, return sentinel so caller omits 5th
    if (!validOpts.length && !omittedFifth && isFourNoteChord) {
      return {
        notes: prevNotes,
        fingers: [],
        anchorIdx: prevAnchorIdx,
        window: prevWin,
        direction: prevDirection || 'up',
        inversion: 'root',
        inversionLabel: 'root position',
        handShift: 0,
        shapeChange: true,
        dirFlipped: false,
        adjusted: true,
        omittedFifth: false,
        commonTonesKept: 0,
        warning: '__NEED_OMIT5__',
      };
    }

    validOpts.sort((a, b) => {
      if (a.stepMov !== b.stepMov) return a.stepMov - b.stepMov;
      if (a.fDiff !== b.fDiff) return a.fDiff - b.fDiff;
      if (a.commonKept !== b.commonKept) return b.commonKept - a.commonKept;
      if (a.adjusted !== b.adjusted) return a.adjusted ? 1 : -1;
      if (a.sameShp !== b.sameShp) return a.sameShp ? -1 : 1;
      return a.avgDist - b.avgDist;
    });

    const best = validOpts[0];
    const chosen = best?.notes || prevNotes;
    const fingers =
      best?.fingers ||
      assignWindowFingers(
        chosen.map(m => toScaleIdx(m) - prevAnchorIdx),
        hand,
        activeInts,
      );
    const avgNew = chosen.reduce((a, b) => a + b, 0) / chosen.length;
    const dir: VLDirection =
      avgNew > prevAvg ? 'up' : avgNew < prevAvg ? 'down' : prevDirection || 'up';
    const invInfo = identifyInversion(
      chosen,
      pc,
      fullIntsForInversion,
      isSlash,
      slashName,
    );

    return {
      notes: chosen,
      fingers,
      anchorIdx: prevAnchorIdx,
      window: prevWin,
      direction: dir,
      inversion: invInfo.inversion,
      inversionLabel: invInfo.inversionLabel,
      handShift: 0,
      shapeChange: prevFingers ? !sameShape(fingers, prevFingers) : false,
      dirFlipped: false,
      adjusted: best?.adjusted ?? false,
      omittedFifth,
      commonTonesKept: best?.commonKept ?? 0,
      warning: omittedFifth
        ? '5th omitted — no valid 4-finger ascending assignment in locked window'
        : undefined,
    };
  }

  // =========================================================================
  // UNLOCKED MODE (sliding window)
  // =========================================================================

  // 7th-chord cost-based sliding window (Rules 1-5 of Seventh Chords spec)
  if (isFourNoteChord) {
    interface SeventhOpt {
      notes: number[];
      slots: number[];
      fingers: number[];
      anchorIdx: number;
      win: VLWindow;
      handShift: number;
      absShift: number;
      fDiff: number;
      commonKept: number;
      stepMov: number;
      adjusted: boolean;
      rootPen: number;
      sameShp: boolean;
      invInfo: {inversion: VLInversionKey; inversionLabel: string};
    }

    const evalSeventhDir = (
      dir: VLDirection,
      allowBoundaryRestart: boolean,
    ): (VLStepOutput & {_costOpt?: SeventhOpt}) | null => {
      const options: SeventhOpt[] = [];

      for (const c of candidates) {
        const slots = c.map(toScaleIdx);
        const cMin = slots[0];
        const cMax = slots[slots.length - 1];
        const span = cMax - cMin;
        if (span > 6) continue; // Cannot fit in a 7-degree window [A-1 .. A+5]

        const invInfo = identifyInversion(
          c,
          pc,
          fullIntsForInversion,
          isSlash,
          slashName,
        );
        const isRoot = invInfo.inversion === 'root';

        // All anchors A where [cMin .. cMax] fits inside [A - 1 .. A + 5]
        // => cMax - 5 <= A <= cMin + 1
        const minA = cMax - 5;
        const maxA = cMin + 1;

        for (let A = minA; A <= maxA; A++) {
          const shift = A - prevAnchorIdx;
          // 3b. Never shift against direction of travel
          if (dir === 'up' && shift < 0) continue;
          if (dir === 'down' && shift > 0) continue;

          const res = resolveWindowFingersStrict(
            slots.map(s => s - A),
            hand,
          );
          if (!res.valid) continue;

          const fDiff = prevFingers ? fingerDiffCount(res.fingers, prevFingers) : 0;
          const commonKept = countCommonTonesSameFinger(
            c,
            res.fingers,
            prevNotes,
            prevFingers,
          );
          const stepMov = prevSlots
            ? totalMovement(slots, prevSlots)
            : totalMovement(c, prevNotes);
          const sameShp = prevFingers ? sameShape(res.fingers, prevFingers) : true;
          // Rule 2 & 3g: Penalize root position unless the window already aligns with it
          const rootPen = isRoot && shift !== 0 ? 1 : 0;

          options.push({
            notes: c,
            slots,
            fingers: res.fingers,
            anchorIdx: A,
            win: windowForAnchor(A, c.length, scaleLen),
            handShift: shift,
            absShift: Math.abs(shift),
            fDiff,
            commonKept,
            stepMov,
            adjusted: res.adjusted,
            rootPen,
            sameShp,
            invInfo,
          });
        }
      }

      if (!options.length) {
        if (!allowBoundaryRestart) return null;
        const flippedDir: VLDirection = dir === 'up' ? 'down' : 'up';
        const revOpt = evalSeventhDir(flippedDir, false);
        if (revOpt) {
          return {
            ...revOpt,
            dirFlipped: true,
            warning:
              flippedDir === 'down'
                ? 'Reached upper keyboard bound — direction flipped ↓'
                : 'Reached lower keyboard bound — direction flipped ↑',
          };
        }
        return null;
      }

      // Priority order 3a-3g + Rule 4 tie-breaker:
      // a. anchor shift needed (0 is best)
      // b. direction violation (already excluded)
      // c. number of finger changes vs previous chord
      // d. common tones kept on same finger (reward => higher is better)
      // e. total stepwise voice movement (scale-degree distance)
      // f. duplicate-finger adjustments (penalty)
      // g. root position (small penalty unless window already aligned)
      // tie: keep previous finger shape
      options.sort((x, y) => {
        if (x.absShift !== y.absShift) return x.absShift - y.absShift;
        if (x.fDiff !== y.fDiff) return x.fDiff - y.fDiff;
        if (x.commonKept !== y.commonKept) return y.commonKept - x.commonKept;
        if (x.stepMov !== y.stepMov) return x.stepMov - y.stepMov;
        if (x.adjusted !== y.adjusted) return x.adjusted ? 1 : -1;
        if (x.rootPen !== y.rootPen) return x.rootPen - y.rootPen;
        if (x.sameShp !== y.sameShp) return x.sameShp ? -1 : 1;
        return 0;
      });

      const best = options[0];
      const avgNew = best.notes.reduce((a, b) => a + b, 0) / best.notes.length;
      const avgOld = prevNotes.reduce((a, b) => a + b, 0) / prevNotes.length;
      const resolvedDir: VLDirection =
        direction === 'auto'
          ? best.handShift > 0
            ? 'up'
            : best.handShift < 0
              ? 'down'
              : avgNew > avgOld
                ? 'up'
                : avgNew < avgOld
                  ? 'down'
                  : prevDirection || 'up'
          : dir;

      return {
        notes: best.notes,
        fingers: best.fingers,
        anchorIdx: best.anchorIdx,
        window: best.win,
        direction: resolvedDir,
        inversion: best.invInfo.inversion,
        inversionLabel: best.invInfo.inversionLabel,
        handShift: best.handShift,
        shapeChange: !best.sameShp,
        dirFlipped: false,
        adjusted: best.adjusted,
        omittedFifth,
        commonTonesKept: best.commonKept,
        warning: omittedFifth
          ? '5th omitted — no valid 4-finger ascending assignment'
          : undefined,
        _costOpt: best,
      };
    };

    if (direction === 'up' || direction === 'down') {
      const out = evalSeventhDir(direction, true);
      if (out) {
        delete out._costOpt;
        return out;
      }
      if (!omittedFifth) {
        return {
          notes: prevNotes,
          fingers: [],
          anchorIdx: prevAnchorIdx,
          window: prevWin,
          direction,
          inversion: 'root',
          inversionLabel: 'root position',
          handShift: 0,
          shapeChange: true,
          dirFlipped: false,
          adjusted: true,
          omittedFifth: false,
          commonTonesKept: 0,
          warning: '__NEED_OMIT5__',
        };
      }
    } else {
      const upOut = evalSeventhDir('up', false);
      const downOut = evalSeventhDir('down', false);
      if (upOut && downOut) {
        const a = upOut._costOpt!;
        const b = downOut._costOpt!;
        let pickUp: boolean;
        if (a.absShift !== b.absShift) pickUp = a.absShift < b.absShift;
        else if (a.fDiff !== b.fDiff) pickUp = a.fDiff < b.fDiff;
        else if (a.commonKept !== b.commonKept) pickUp = a.commonKept > b.commonKept;
        else if (a.stepMov !== b.stepMov) pickUp = a.stepMov < b.stepMov;
        else if (a.adjusted !== b.adjusted) pickUp = !a.adjusted;
        else if (a.rootPen !== b.rootPen) pickUp = a.rootPen < b.rootPen;
        else if (a.sameShp !== b.sameShp) pickUp = a.sameShp;
        else pickUp = prevDirection !== 'down';

        const chosen = pickUp ? upOut : downOut;
        delete upOut._costOpt;
        delete downOut._costOpt;
        return chosen;
      }
      if (upOut) {
        delete upOut._costOpt;
        return upOut;
      }
      if (downOut) {
        delete downOut._costOpt;
        return downOut;
      }
    }
  }

  // =========================================================================
  // TRIADS & GENERAL CHORDS UNLOCKED MODE (directional travel along scale)
  // =========================================================================
  const evaluateDir = (dir: VLDirection, allowBoundaryRestart = true): VLStepOutput | null => {
    const prevLow = prevNotes[0];
    const prevHigh = prevNotes[prevNotes.length - 1];

    let dirCandidates: number[][] = [];
    if (dir === 'up') {
      const above = candidates.filter(c => c[0] > prevLow);
      if (above.length) {
        const minLow = Math.min(...above.map(c => c[0]));
        dirCandidates = above.filter(c => c[0] === minLow);
      }
    } else {
      const below = candidates.filter(c => c[c.length - 1] < prevHigh);
      if (below.length) {
        const maxHigh = Math.max(...below.map(c => c[c.length - 1]));
        dirCandidates = below.filter(c => c[c.length - 1] === maxHigh);
      }
    }

    // Rule 6: If next voicing would go beyond keyboard bounds, flip direction and restart
    if (!dirCandidates.length) {
      if (!allowBoundaryRestart) return null;
      const flippedDir: VLDirection = dir === 'up' ? 'down' : 'up';
      let restartVoicings: number[][] = [];
      if (flippedDir === 'down') {
        const maxH = Math.max(...candidates.map(c => c[c.length - 1]));
        const underPrev = candidates.filter(c => c[c.length - 1] < prevHigh);
        const targetPool = underPrev.length ? underPrev : candidates;
        const bestH = underPrev.length
          ? Math.max(...targetPool.map(c => c[c.length - 1]))
          : maxH;
        restartVoicings = targetPool.filter(c => c[c.length - 1] === bestH);
      } else {
        const minL = Math.min(...candidates.map(c => c[0]));
        const overPrev = candidates.filter(c => c[0] > prevLow);
        const targetPool = overPrev.length ? overPrev : candidates;
        const bestL = overPrev.length
          ? Math.min(...targetPool.map(c => c[0]))
          : minL;
        restartVoicings = targetPool.filter(c => c[0] === bestL);
      }
      const chosen =
        restartVoicings.sort(
          (a, b) => totalMovement(a, prevNotes) - totalMovement(b, prevNotes),
        )[0] || candidates[0];
      const slots = chosen.map(toScaleIdx);
      const upperOff =
        scaleLen === 7 && chosen.length >= 5 ? Math.min(2, chosen.length - 4) : 0;
      const newAnchorIdx =
        flippedDir === 'down'
          ? slots[0] + 1
          : slots[slots.length - 1] - (5 + upperOff);
      const finalAnchor = Math.min(
        slots[0] + 1,
        Math.max(slots[slots.length - 1] - (5 + upperOff), newAnchorIdx),
      );
      const win = windowForAnchor(finalAnchor, chosen.length, scaleLen);
      const res = resolveWindowFingersStrict(
        slots.map(s => s - finalAnchor),
        hand,
      );
      const fingers = res.valid
        ? res.fingers
        : assignWindowFingers(slots.map(s => s - finalAnchor), hand, activeInts);
      const invInfo = identifyInversion(
        chosen,
        pc,
        fullIntsForInversion,
        isSlash,
        slashName,
      );
      return {
        notes: chosen,
        fingers,
        anchorIdx: finalAnchor,
        window: win,
        direction: flippedDir,
        inversion: invInfo.inversion,
        inversionLabel: invInfo.inversionLabel,
        handShift: finalAnchor - prevAnchorIdx,
        shapeChange: prevFingers ? !sameShape(fingers, prevFingers) : false,
        dirFlipped: true,
        adjusted: res.adjusted,
        omittedFifth,
        commonTonesKept: countCommonTonesSameFinger(
          chosen,
          fingers,
          prevNotes,
          prevFingers,
        ),
        warning:
          flippedDir === 'down'
            ? 'Reached upper keyboard bound — direction flipped ↓'
            : 'Reached lower keyboard bound — direction flipped ↑',
      };
    }

    interface EvaluatedOption {
      notes: number[];
      fingers: number[];
      anchorIdx: number;
      win: VLWindow;
      handShift: number;
      fingerDiffs: number;
      absShift: number;
      sameShp: boolean;
      adjusted: boolean;
      commonKept: number;
    }

    const options: EvaluatedOption[] = [];

    for (const c of dirCandidates) {
      const slots = c.map(toScaleIdx);
      const cMin = slots[0];
      const cMax = slots[slots.length - 1];
      const upperOff =
        scaleLen === 7 && c.length >= 5 ? Math.min(2, c.length - 4) : 0;

      // Fits inside previous window => shift 0
      if (cMin >= prevWin.winLoIdx && cMax <= prevWin.winLoIdx + 6 + upperOff) {
        const res = resolveWindowFingersStrict(
          slots.map(s => s - prevAnchorIdx),
          hand,
        );
        const fingers = res.valid
          ? res.fingers
          : assignWindowFingers(slots.map(s => s - prevAnchorIdx), hand, activeInts);
        options.push({
          notes: c,
          fingers,
          anchorIdx: prevAnchorIdx,
          win: prevWin,
          handShift: 0,
          fingerDiffs: prevFingers ? fingerDiffCount(fingers, prevFingers) : 0,
          absShift: 0,
          sameShp: prevFingers ? sameShape(fingers, prevFingers) : true,
          adjusted: res.adjusted,
          commonKept: countCommonTonesSameFinger(c, fingers, prevNotes, prevFingers),
        });
        continue;
      }

      const minA = cMax - (5 + upperOff);
      const maxA = cMin + 1;

      for (let A = minA; A <= maxA; A++) {
        const shift = A - prevAnchorIdx;
        if (dir === 'up' && shift < 0) continue;
        if (dir === 'down' && shift > 0) continue;

        const win = windowForAnchor(A, c.length, scaleLen);
        const res = resolveWindowFingersStrict(
          slots.map(s => s - A),
          hand,
        );
        const fingers = res.valid
          ? res.fingers
          : assignWindowFingers(slots.map(s => s - A), hand, activeInts);
        options.push({
          notes: c,
          fingers,
          anchorIdx: A,
          win,
          handShift: shift,
          fingerDiffs: prevFingers ? fingerDiffCount(fingers, prevFingers) : 0,
          absShift: Math.abs(shift),
          sameShp: prevFingers ? sameShape(fingers, prevFingers) : true,
          adjusted: res.adjusted,
          commonKept: countCommonTonesSameFinger(c, fingers, prevNotes, prevFingers),
        });
      }
    }

    if (!options.length && dirCandidates.length) {
      const c = dirCandidates[0];
      const slots = c.map(toScaleIdx);
      const upperOff =
        scaleLen === 7 && c.length >= 5 ? Math.min(2, c.length - 4) : 0;
      const A =
        dir === 'up' ? slots[slots.length - 1] - (5 + upperOff) : slots[0] + 1;
      const res = resolveWindowFingersStrict(
        slots.map(s => s - A),
        hand,
      );
      const fingers = res.valid
        ? res.fingers
        : assignWindowFingers(slots.map(s => s - A), hand, activeInts);
      options.push({
        notes: c,
        fingers,
        anchorIdx: A,
        win: windowForAnchor(A, c.length, scaleLen),
        handShift: A - prevAnchorIdx,
        fingerDiffs: prevFingers ? fingerDiffCount(fingers, prevFingers) : 0,
        absShift: Math.abs(A - prevAnchorIdx),
        sameShp: prevFingers ? sameShape(fingers, prevFingers) : true,
        adjusted: res.adjusted,
        commonKept: countCommonTonesSameFinger(c, fingers, prevNotes, prevFingers),
      });
    }

    options.sort((x, y) => {
      const xZero = x.absShift === 0 ? 0 : 1;
      const yZero = y.absShift === 0 ? 0 : 1;
      if (xZero !== yZero) return xZero - yZero;
      if (x.fingerDiffs !== y.fingerDiffs) return x.fingerDiffs - y.fingerDiffs;
      if (x.absShift !== y.absShift) return x.absShift - y.absShift;
      if (x.sameShp !== y.sameShp) return x.sameShp ? -1 : 1;
      return 0;
    });

    const best = options[0];
    const invInfo = identifyInversion(
      best.notes,
      pc,
      fullIntsForInversion,
      isSlash,
      slashName,
    );
    return {
      notes: best.notes,
      fingers: best.fingers,
      anchorIdx: best.anchorIdx,
      window: best.win,
      direction: dir,
      inversion: invInfo.inversion,
      inversionLabel: invInfo.inversionLabel,
      handShift: best.handShift,
      shapeChange: !best.sameShp,
      dirFlipped: false,
      adjusted: best.adjusted,
      omittedFifth,
      commonTonesKept: best.commonKept,
    };
  };

  if (direction === 'up' || direction === 'down') {
    return evaluateDir(direction, true)!;
  }

  const upOpt = evaluateDir('up', false);
  const downOpt = evaluateDir('down', false);

  if (upOpt && downOpt) {
    const movUp = totalMovement(upOpt.notes, prevNotes);
    const movDown = totalMovement(downOpt.notes, prevNotes);
    if (movUp < movDown) return upOpt;
    if (movDown < movUp) return downOpt;
    return prevDirection === 'down' ? downOpt : upOpt;
  }
  if (upOpt) return upOpt;
  if (downOpt) return downOpt;
  return evaluateDir(prevDirection || 'up', true)!;
}

export function computeNextVoiceLedChord(input: VLStepInput): VLStepOutput {
  const {ints, seventhMode = 'full', prevFingers} = input;

  if (!isFourNoteSeventh(ints)) {
    return computeSingleModeVoiceLed(input, ints, ints, false);
  }

  const omitInts = omitFifthInts(ints);

  if (seventhMode === 'omit5') {
    return computeSingleModeVoiceLed(input, omitInts, ints, true);
  }

  const fullRes = computeSingleModeVoiceLed(input, ints, ints, false);

  // Rule 4 fallback: full 4-note voicing could not find 4 distinct ascending fingers -> use omit-5th + warning
  if (fullRes.warning === '__NEED_OMIT5__') {
    const omitRes = computeSingleModeVoiceLed(input, omitInts, ints, true);
    return {
      ...omitRes,
      omittedFifth: true,
      warning:
        '5th omitted — no valid 4-finger ascending assignment in locked window',
    };
  }

  // 'auto': use full unless it needs a finger adjustment, then compare against omit-5th
  // and pick the one with fewer finger changes from the previous chord.
  if (seventhMode === 'auto' && fullRes.adjusted && prevFingers?.length) {
    const omitRes = computeSingleModeVoiceLed(input, omitInts, ints, true);
    const fullChanges = fingerDiffCount(fullRes.fingers, prevFingers);
    const omitChanges = fingerDiffCount(omitRes.fingers, prevFingers);
    if (omitChanges < fullChanges) {
      return {
        ...omitRes,
        omittedFifth: true,
        warning: 'Auto: omitted 5th for fewer finger changes',
      };
    }
  }

  return fullRes;
}

/* =====================================================================
   ANCHOR-FREE SEMITONE-COST ENGINE & CONFIGURABLE FINGERING ENGINE
   ===================================================================== */

export const DEFAULT_VL_RANGE: [number, number] = [48, 84]; // C3 to C6

export interface ChordInput {
  root: number; // MIDI pitch class 0..11 (also accepts full MIDI; normalized % 12)
  quality?: string;
  ints?: number[];
  name?: string;
}

export interface NextVoicingOptions {
  direction?: 'up' | 'down';
  range?: [number, number];
  maxSpan?: number;
}

export interface NextVoicingResult {
  notes: number[];
  inversion: number;
  cost: number;
  rotated?: 'up' | 'down' | false;
  voiceMoves?: number[];
}

export interface FingeringNoteOption {
  midi: number;
  fingers: number[]; // sorted ascending, length 1 or 2
}

export interface FingeringResult {
  hand: 'R' | 'L';
  perNote: FingeringNoteOption[];
  notes: number[];
  primary: number[];
  score: number;
}

export interface ProgStepVoicing {
  chord: ChordInput;
  notes: number[];
  inversion: number;
  cost: number;
  rotated: 'up' | 'down' | false;
  voiceMoves: number[];
  fingering?: FingeringResult;
}

export interface FingeringRulesConfig {
  triadCandidates: number[][];
  penalties: {
    blackThumbOrPinky: number;
    changedHeldFinger: number;
    fingerDistance: number;
    nonDefaultShape: number;
    stretchComfort: number;
  };
  preferredBonus: number;
  alternativeThreshold: number;
  maxOuterSpan: Record<string, number>;
  maxPairSpan: Record<string, number>;
  preferredDefaultShapes: Record<number, number[]>;
}

export const DEFAULT_FINGERING_RULES: FingeringRulesConfig = {
  triadCandidates: [
    [1, 3, 5],
    [1, 2, 5],
    [1, 2, 4],
    [1, 3, 4],
  ],
  penalties: {
    blackThumbOrPinky: 1.1,
    changedHeldFinger: 2.2,
    fingerDistance: 0.08,
    nonDefaultShape: 0.25,
    stretchComfort: 0.45,
  },
  preferredBonus: 0.5,
  alternativeThreshold: 0.35,
  maxOuterSpan: {
    '1,5': 12,
    '1,4': 9,
    '2,5': 8,
    '1,3': 6,
    '2,4': 5,
    '3,5': 5,
    '2,3': 4,
    '3,4': 3,
    '4,5': 3,
    '1,2': 6,
  },
  maxPairSpan: {
    '1,2': 6,
    '1,3': 7,
    '1,4': 9,
    '1,5': 12,
    '2,3': 4,
    '2,4': 6,
    '2,5': 8,
    '3,4': 3,
    '3,5': 5,
    '4,5': 3,
  },
  preferredDefaultShapes: {
    2: [1, 3],
    3: [1, 3, 5],
    4: [1, 2, 3, 5],
    5: [1, 2, 3, 4, 5],
  },
};

export const CHORD_QUALITY_INTERVALS: Record<string, number[]> = {
  '': [0, 4, 7],
  maj: [0, 4, 7],
  major: [0, 4, 7],
  m: [0, 3, 7],
  min: [0, 3, 7],
  minor: [0, 3, 7],
  dim: [0, 3, 6],
  '°': [0, 3, 6],
  aug: [0, 4, 8],
  '+': [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '5': [0, 7],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  maj7: [0, 4, 7, 11],
  '7': [0, 4, 7, 10],
  dom7: [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  min7: [0, 3, 7, 10],
  'm7b5': [0, 3, 6, 10],
  'm7♭5': [0, 3, 6, 10],
  'ø7': [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
  '°7': [0, 3, 6, 9],
  mMaj7: [0, 3, 7, 11],
  'maj7#5': [0, 4, 8, 11],
  'maj7♯5': [0, 4, 8, 11],
  '7#5': [0, 4, 8, 10],
  '7♯5': [0, 4, 8, 10],
  '7b5': [0, 4, 6, 10],
  '7♭5': [0, 4, 6, 10],
  '7sus4': [0, 5, 7, 10],
};

const BLACK_KEY_PCS = new Set([1, 3, 6, 8, 10]);

export function isBlackKeyMidi(midi: number): boolean {
  return BLACK_KEY_PCS.has(((midi % 12) + 12) % 12);
}

const NOTE_NAMES_SHARP = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
const PITCH_LETTER_TO_PC: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

export function parseChordSymbolInput(symbol: string): ChordInput {
  const m = symbol.trim().match(/^([A-Ga-g])([#♯b♭]?)(.*)$/);
  if (!m) {
    return {root: 0, quality: '', ints: [0, 4, 7], name: symbol};
  }
  const basePc = PITCH_LETTER_TO_PC[m[1].toUpperCase()] ?? 0;
  const acc = m[2] === '#' || m[2] === '♯' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0;
  const root = (((basePc + acc) % 12) + 12) % 12;
  const rawQ = m[3].trim();
  const normQ = rawQ.replace(/♭/g, 'b').replace(/♯/g, '#');
  const ints =
    CHORD_QUALITY_INTERVALS[rawQ] ||
    CHORD_QUALITY_INTERVALS[normQ] ||
    [0, 4, 7];
  return {
    root,
    quality: rawQ,
    ints: [...ints],
    name: symbol.trim(),
  };
}

export function resolveChordIntervals(chord: ChordInput): {
  pc: number;
  ints: number[];
} {
  const pc = ((chord.root % 12) + 12) % 12;
  if (chord.ints && chord.ints.length) {
    return {pc, ints: [...chord.ints]};
  }
  const q = (chord.quality || '').trim();
  const normQ = q.replace(/♭/g, 'b').replace(/♯/g, '#');
  const ints = CHORD_QUALITY_INTERVALS[q] || CHORD_QUALITY_INTERVALS[normQ] || [0, 4, 7];
  return {pc, ints: [...ints]};
}

function generateChordCandidatesInRange(
  ints: number[],
  pc: number,
  range: [number, number],
  maxSpan: number,
  fixedInversion?: number,
): {notes: number[]; inversion: number}[] {
  const seen = new Set<string>();
  const out: {notes: number[]; inversion: number}[] = [];
  const rootSpan = Math.max(...ints) - Math.min(...ints);
  const spanCap = Math.max(maxSpan, rootSpan);
  const invIndices =
    fixedInversion != null
      ? [((fixedInversion % ints.length) + ints.length) % ints.length]
      : Array.from({length: ints.length}, (_, i) => i);

  for (const inv of invIndices) {
    for (let oct = -1; oct <= 8; oct++) {
      const notes = buildVoicingMidi(ints, pc, inv, oct);
      if (!notes.length) continue;
      if (notes[0] < range[0] || notes[notes.length - 1] > range[1]) continue;
      if (notes[notes.length - 1] - notes[0] > spanCap) continue;
      const key = notes.join(',');
      if (!seen.has(key)) {
        seen.add(key);
        out.push({notes, inversion: inv});
      }
    }
  }
  return out;
}

export function sortedVoiceCost(prevSorted: number[], candSorted: number[]): number {
  if (!prevSorted.length || !candSorted.length) return 0;
  if (prevSorted.length === candSorted.length) {
    let sum = 0;
    for (let i = 0; i < prevSorted.length; i++) {
      sum += Math.abs(candSorted[i] - prevSorted[i]);
    }
    return sum;
  }
  return totalMovement(candSorted, prevSorted);
}

/**
 * Rotates a voicing by one octave (up: lowest note + 12, down: highest note - 12),
 * shifting whole octaves if needed so the output never leaves `range`.
 */
export function rotateInversionVoicing(
  notes: number[],
  direction: 'up' | 'down',
  range: [number, number] = DEFAULT_VL_RANGE,
): number[] {
  const sorted = [...notes].sort((a, b) => a - b);
  if (sorted.length < 2) return sorted;
  let rotated =
    direction === 'up'
      ? [...sorted.slice(1), sorted[0] + 12].sort((a, b) => a - b)
      : [sorted[sorted.length - 1] - 12, ...sorted.slice(0, -1)].sort((a, b) => a - b);

  while (rotated[rotated.length - 1] > range[1] && rotated[0] - 12 >= range[0]) {
    rotated = rotated.map(n => n - 12);
  }
  while (rotated[0] < range[0] && rotated[rotated.length - 1] + 12 <= range[1]) {
    rotated = rotated.map(n => n + 12);
  }
  return rotated;
}

/**
 * Anchor-free voice-leading step:
 * Generates all inversions across every octave placement inside `range`,
 * chooses the candidate with minimum semitone movement from `previousVoicing`,
 * tie-breaks by `direction` (or distance to center of range when omitted),
 * and wraps via octave rotation if an unconstrained choice would leave `range`.
 */
export function nextVoicing(
  previousVoicing: number[],
  nextChord: ChordInput | string,
  options: NextVoicingOptions = {},
): NextVoicingResult {
  const range: [number, number] = options.range || DEFAULT_VL_RANGE;
  const maxSpan = options.maxSpan ?? 12;
  const direction = options.direction;
  const parsedChord =
    typeof nextChord === 'string' ? parseChordSymbolInput(nextChord) : nextChord;
  const {pc, ints} = resolveChordIntervals(parsedChord);

  const prevSorted = [...previousVoicing].sort((a, b) => a - b);
  const candidates = generateChordCandidatesInRange(ints, pc, range, maxSpan);
  if (!candidates.length) {
    const fallback = generateChordCandidatesInRange(ints, pc, [21, 108], Math.max(24, maxSpan));
    const bestFb = fallback[0] || {notes: buildVoicingMidi(ints, pc, 0, 4), inversion: 0};
    return {
      notes: bestFb.notes,
      inversion: bestFb.inversion,
      cost: sortedVoiceCost(prevSorted, bestFb.notes),
      rotated: false,
      voiceMoves:
        prevSorted.length === bestFb.notes.length
          ? bestFb.notes.map((n, i) => n - prevSorted[i])
          : [],
    };
  }

  const rangeCenter = (range[0] + range[1]) / 2;
  const sumNotes = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const avgNotes = (arr: number[]) => sumNotes(arr) / (arr.length || 1);

  const scoreAndSort = (pool: {notes: number[]; inversion: number}[]) =>
    pool
      .map(c => ({
        ...c,
        cost: sortedVoiceCost(prevSorted, c.notes),
        sum: sumNotes(c.notes),
        centerDist: Math.abs(avgNotes(c.notes) - rangeCenter),
      }))
      .sort((a, b) => {
        if (a.cost !== b.cost) return a.cost - b.cost;
        if (direction === 'up') {
          if (a.sum !== b.sum) return b.sum - a.sum;
        } else if (direction === 'down') {
          if (a.sum !== b.sum) return a.sum - b.sum;
        } else if (Math.abs(a.centerDist - b.centerDist) > 1e-6) {
          return a.centerDist - b.centerDist;
        }
        return a.inversion - b.inversion;
      });

  // Check if unconstrained closest voicing would leave range (for range-wrap reporting)
  const wideCandidates = generateChordCandidatesInRange(ints, pc, [0, 127], maxSpan);
  const wideBest = scoreAndSort(wideCandidates)[0];
  let rotated: 'up' | 'down' | false = false;
  if (wideBest) {
    if (wideBest.notes[wideBest.notes.length - 1] > range[1]) rotated = 'down';
    else if (wideBest.notes[0] < range[0]) rotated = 'up';
  }

  const best = scoreAndSort(candidates)[0];
  const voiceMoves =
    prevSorted.length === best.notes.length
      ? best.notes.map((n, i) => n - prevSorted[i])
      : [];

  return {
    notes: best.notes,
    inversion: best.inversion,
    cost: best.cost,
    rotated,
    voiceMoves,
  };
}

export interface VoiceProgressionOptions {
  direction?: 'up' | 'down';
  range?: [number, number];
  maxSpan?: number;
  hand?: 'R' | 'L';
  startNotes?: number[];
  computeFingering?: boolean;
  fingeringRules?: FingeringRulesConfig;
  preferredShape?: number[];
  rotatePerCycle?: boolean;
}

export function pickStartVoicing(
  startChord: ChordInput | string,
  startInversion = 0,
  range: [number, number] = DEFAULT_VL_RANGE,
  maxSpan = 12,
): {notes: number[]; inversion: number} {
  const parsed =
    typeof startChord === 'string' ? parseChordSymbolInput(startChord) : startChord;
  const {pc, ints} = resolveChordIntervals(parsed);
  const inv = ((startInversion % ints.length) + ints.length) % ints.length;
  const center = (range[0] + range[1]) / 2;
  const cands = generateChordCandidatesInRange(ints, pc, range, maxSpan, inv);
  if (!cands.length) {
    const anyCands = generateChordCandidatesInRange(ints, pc, range, maxSpan);
    if (anyCands.length) {
      anyCands.sort((a, b) => {
        const mA = a.notes.reduce((s, n) => s + n, 0) / a.notes.length;
        const mB = b.notes.reduce((s, n) => s + n, 0) / b.notes.length;
        return Math.abs(mA - center) - Math.abs(mB - center);
      });
      return anyCands[0];
    }
    return {notes: buildVoicingMidi(ints, pc, inv, 4), inversion: inv};
  }
  cands.sort((a, b) => {
    const mA = a.notes.reduce((s, n) => s + n, 0) / a.notes.length;
    const mB = b.notes.reduce((s, n) => s + n, 0) / b.notes.length;
    return Math.abs(mA - center) - Math.abs(mB - center);
  });
  return cands[0];
}

/**
 * Anchor-free progression voicer:
 * Starts on `startChord` in `startInversion` near the center of `range`,
 * then voices each subsequent chord solely by lowest cost from the previous voicing.
 */
export function voiceProgression(
  startChord: ChordInput | string,
  startInversion: number,
  chordSymbols: (ChordInput | string)[],
  options: VoiceProgressionOptions = {},
): ProgStepVoicing[] {
  const range = options.range || DEFAULT_VL_RANGE;
  const maxSpan = options.maxSpan ?? 12;
  const hand = options.hand || 'R';
  const rules = options.fingeringRules || DEFAULT_FINGERING_RULES;
  const wantFingering = options.computeFingering !== false;

  const firstChord =
    typeof startChord === 'string' ? parseChordSymbolInput(startChord) : startChord;
  const start = options.startNotes?.length
    ? {
        notes: [...options.startNotes].sort((a, b) => a - b),
        inversion: identifyInversion(
          [...options.startNotes].sort((a, b) => a - b),
          ((firstChord.root % 12) + 12) % 12,
          resolveChordIntervals(firstChord).ints,
        ).inversion,
      }
    : pickStartVoicing(firstChord, startInversion, range, maxSpan);

  const firstInvIdx =
    typeof start.inversion === 'number'
      ? start.inversion
      : Math.max(0, INV_KEYS.indexOf(start.inversion));

  const out: ProgStepVoicing[] = [];
  let prevNotes = start.notes;
  let prevFing: FingeringResult | undefined = wantFingering
    ? computeVoicingFingering(
        prevNotes,
        hand,
        undefined,
        rules,
        options.preferredShape,
      )
    : undefined;

  out.push({
    chord: firstChord,
    notes: prevNotes,
    inversion: firstInvIdx,
    cost: 0,
    rotated: false,
    voiceMoves: [],
    fingering: prevFing,
  });

  for (const sym of chordSymbols) {
    const ch = typeof sym === 'string' ? parseChordSymbolInput(sym) : sym;
    const res = nextVoicing(prevNotes, ch, {
      direction: options.direction,
      range,
      maxSpan,
    });
    const fing = wantFingering
      ? computeVoicingFingering(
          res.notes,
          hand,
          prevFing ? {notes: prevNotes, primary: prevFing.primary} : undefined,
          rules,
          options.preferredShape,
        )
      : undefined;

    out.push({
      chord: ch,
      notes: res.notes,
      inversion: res.inversion,
      cost: res.cost,
      rotated: res.rotated || false,
      voiceMoves: res.voiceMoves || [],
      fingering: fing,
    });
    prevNotes = res.notes;
    prevFing = fing;
  }

  return out;
}

/* =====================================================================
   DISPLAY-ONLY TEACHING VIEW: SHAPES NEAR A CHORD (3 INVERSION FAMILIES)
   ===================================================================== */

export interface FamilyChordShape {
  degreeIndex: number;
  chordName: string;
  notes: number[];
  inversion: number;
  cost: number;
}

export interface AnchorFamilyGroup {
  familyIndex: number;
  anchorLabel: string;
  anchorNotes: number[];
  shapes: FamilyChordShape[];
}

export function generateShapesNearChord(
  anchorChord: ChordInput,
  scaleRoot: number,
  scaleIntervals: number[],
  degreeChordSpecs: {degreeIndex: number; chordName: string; chord: ChordInput}[],
  range: [number, number] = DEFAULT_VL_RANGE,
): AnchorFamilyGroup[] {
  void scaleRoot;
  void scaleIntervals;
  const {ints} = resolveChordIntervals(anchorChord);
  const invCount = Math.min(3, ints.length);
  const families: AnchorFamilyGroup[] = [];

  for (let inv = 0; inv < invCount; inv++) {
    const start = pickStartVoicing(anchorChord, inv, range);
    const anchorLabel = start.notes
      .map(m => NOTE_NAMES_SHARP[((m % 12) + 12) % 12])
      .join(' ');
    const shapes: FamilyChordShape[] = degreeChordSpecs.map(spec => {
      const res = nextVoicing(start.notes, spec.chord, {range});
      return {
        degreeIndex: spec.degreeIndex,
        chordName: spec.chordName,
        notes: res.notes,
        inversion: res.inversion,
        cost: res.cost,
      };
    });
    families.push({
      familyIndex: inv,
      anchorLabel,
      anchorNotes: start.notes,
      shapes,
    });
  }

  return families;
}

/* =====================================================================
   CONFIGURABLE ERGONOMIC FINGERING ENGINE WITH ALTERNATIVES
   ===================================================================== */

function generateAscending4FingerCombos(): number[][] {
  const res: number[][] = [];
  for (let a = 1; a <= 2; a++) {
    for (let b = a + 1; b <= 3; b++) {
      for (let c = b + 1; c <= 4; c++) {
        for (let d = c + 1; d <= 5; d++) {
          res.push([a, b, c, d]);
        }
      }
    }
  }
  return res;
}

function candidateListForSize(
  n: number,
  rules: FingeringRulesConfig,
): number[][] {
  if (n <= 1) return [[1]];
  if (n === 2) {
    return [
      [1, 3],
      [1, 2],
      [1, 4],
      [1, 5],
      [2, 3],
      [2, 4],
      [2, 5],
      [3, 5],
    ];
  }
  if (n === 3) return rules.triadCandidates.map(c => [...c]);
  if (n === 4) return generateAscending4FingerCombos();
  if (n === 5) return [[1, 2, 3, 4, 5]];
  const arr: number[] = [];
  while (arr.length < n - 4) arr.push(1);
  arr.push(2, 3, 4, 5);
  return [arr];
}

function fitsChordSpan(
  rhCand: number[],
  gaps: number[],
  totalSpan: number,
  rules: FingeringRulesConfig,
): boolean {
  const outerKey = `${rhCand[0]},${rhCand[rhCand.length - 1]}`;
  const maxOuter = rules.maxOuterSpan[outerKey] ?? 12;
  if (totalSpan > maxOuter) return false;
  for (let i = 0; i < gaps.length; i++) {
    const pairKey = `${rhCand[i]},${rhCand[i + 1]}`;
    const maxPair = rules.maxPairSpan[pairKey] ?? 12;
    if (gaps[i] > maxPair) return false;
  }
  return true;
}

/**
 * Evaluates right-hand ergonomic fingerings and mirrors for left hand.
 * Always produces sorted ascending `fingers: number[]` (length 1 or 2) per note.
 */
export function computeVoicingFingering(
  notes: number[],
  hand: 'R' | 'L' = 'R',
  prev?: {notes: number[]; primary: number[]} | null,
  rules: FingeringRulesConfig = DEFAULT_FINGERING_RULES,
  preferredShape?: number[] | null,
): FingeringResult {
  const sorted = [...notes].sort((a, b) => a - b);
  const n = sorted.length;
  if (!n) {
    return {hand, perNote: [], notes: [], primary: [], score: 0};
  }
  if (n === 1) {
    const f = hand === 'L' ? 5 : 1;
    return {
      hand,
      perNote: [{midi: sorted[0], fingers: [f]}],
      notes: sorted,
      primary: [f],
      score: 0,
    };
  }

  // Orient notes thumb-side -> pinky-side so LH is the exact mirror of RH
  const orientedNotes = hand === 'R' ? sorted : [...sorted].reverse();
  const gaps: number[] = [];
  for (let i = 0; i < orientedNotes.length - 1; i++) {
    gaps.push(Math.abs(orientedNotes[i + 1] - orientedNotes[i]));
  }
  const totalSpan = Math.abs(orientedNotes[n - 1] - orientedNotes[0]);

  const orientedPrevNotes = prev?.notes
    ? hand === 'R'
      ? [...prev.notes].sort((a, b) => a - b)
      : [...prev.notes].sort((a, b) => a - b).reverse()
    : null;
  const orientedPrevPrimary = prev?.primary
    ? hand === 'R'
      ? [...prev.primary]
      : [...prev.primary].reverse()
    : null;

  const rawCands = candidateListForSize(n, rules);
  let legalCands = rawCands.filter(c => fitsChordSpan(c, gaps, totalSpan, rules));
  if (!legalCands.length) {
    legalCands = rawCands;
  }

  // Check whether any legal candidate avoids thumb (1) or pinky (5) on a black key
  const hasWhiteOuterOption = legalCands.some(cand => {
    const thumbBad = cand[0] === 1 && isBlackKeyMidi(orientedNotes[0]);
    const pinkyBad = cand[n - 1] === 5 && isBlackKeyMidi(orientedNotes[n - 1]);
    return !thumbBad && !pinkyBad;
  });

  const defShape = rules.preferredDefaultShapes[n];

  const scored = legalCands.map(rhCand => {
    let score = 0;

    // 1. Penalty for thumb or pinky on a black key when a white-key option exists
    if (hasWhiteOuterOption) {
      if (rhCand[0] === 1 && isBlackKeyMidi(orientedNotes[0])) {
        score += rules.penalties.blackThumbOrPinky;
      }
      if (rhCand[n - 1] === 5 && isBlackKeyMidi(orientedNotes[n - 1])) {
        score += rules.penalties.blackThumbOrPinky;
      }
    }

    // 2 & 3. Previous chord continuity: held note finger preservation + travel distance
    if (orientedPrevNotes && orientedPrevPrimary && orientedPrevPrimary.length === orientedPrevNotes.length) {
      for (let i = 0; i < n; i++) {
        const m = orientedNotes[i];
        const prevIdx = orientedPrevNotes.indexOf(m);
        if (prevIdx >= 0) {
          if (orientedPrevPrimary[prevIdx] !== rhCand[i]) {
            score += rules.penalties.changedHeldFinger;
          }
        } else if (i < orientedPrevNotes.length) {
          const fingerTravel = Math.abs(m - orientedPrevNotes[i]);
          const fingerNumDelta = Math.abs(rhCand[i] - orientedPrevPrimary[i]);
          score +=
            (fingerTravel + fingerNumDelta * 1.5) * rules.penalties.fingerDistance;
        }
      }
    }

    // 4. Small penalty for shapes outside the default (e.g. 1-3-5 for triads)
    if (defShape && defShape.length === n) {
      const matchesDef = rhCand.every((f, idx) => f === defShape[idx]);
      if (!matchesDef) {
        score += rules.penalties.nonDefaultShape;
        // Prefer keeping outer 1 and 5 when deviating on inner fingers
        if (rhCand[0] !== defShape[0] || rhCand[n - 1] !== defShape[n - 1]) {
          score += rules.penalties.nonDefaultShape * 1.2;
        }
      }
    }

    // Mild ergonomic comfort check for 3-4 / 3-5 stretch
    for (let i = 0; i < gaps.length; i++) {
      if (rhCand[i] === 3 && rhCand[i + 1] === 4 && gaps[i] >= 3) {
        score += rules.penalties.stretchComfort;
      }
      if (rhCand[i] === 3 && rhCand[i + 1] === 5 && gaps[i] >= 5) {
        score += rules.penalties.stretchComfort * 0.8;
      }
    }

    // 5. Remembered user preferred fingering bonus (mirrored for LH comparison)
    if (preferredShape && preferredShape.length === n) {
      const orientedPref =
        hand === 'R' ? preferredShape : [...preferredShape].reverse();
      if (rhCand.every((f, i) => f === orientedPref[i])) {
        score -= rules.preferredBonus;
      }
    }

    return {rhCand, score};
  });

  scored.sort((a, b) => a.score - b.score);
  const best = scored[0];
  const second = scored[1];

  const primaryOriented = [...best.rhCand];
  const orientedOptions: number[][] = primaryOriented.map(f => [f]);

  if (second && second.score - best.score <= rules.alternativeThreshold) {
    const diffIndices: number[] = [];
    for (let i = 0; i < n; i++) {
      if (best.rhCand[i] !== second.rhCand[i]) diffIndices.push(i);
    }
    if (diffIndices.length === 1) {
      const k = diffIndices[0];
      const pair = [best.rhCand[k], second.rhCand[k]].sort((a, b) => a - b);
      orientedOptions[k] = pair;
    }
  }

  const finalOptions =
    hand === 'R' ? orientedOptions : [...orientedOptions].reverse();
  const finalPrimary =
    hand === 'R' ? primaryOriented : [...primaryOriented].reverse();

  return {
    hand,
    perNote: sorted.map((midi, i) => ({
      midi,
      fingers: finalOptions[i].slice(0, 2).sort((a, b) => a - b),
    })),
    notes: sorted,
    primary: finalPrimary,
    score: best.score,
  };
}

export function formatFingeringText(fingering: FingeringResult): string {
  return fingering.perNote
    .map(p => (p.fingers.length === 2 ? `(${p.fingers[0]}/${p.fingers[1]})` : String(p.fingers[0])))
    .join(' ');
}

export function describeVoiceMovement(
  prevNotes: number[],
  nextNotes: number[],
  noteLabelFn: (midi: number) => string = m =>
    `${NOTE_NAMES_SHARP[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`,
): {moves: number[]; summary: string; heldCount: number; totalCost: number} {
  const a = [...prevNotes].sort((x, y) => x - y);
  const b = [...nextNotes].sort((x, y) => x - y);
  if (!a.length || a.length !== b.length) {
    return {moves: [], summary: '', heldCount: 0, totalCost: sortedVoiceCost(a, b)};
  }
  const moves = a.map((m, i) => b[i] - m);
  let heldCount = 0;
  let totalCost = 0;
  const parts = a.map((m, i) => {
    const d = b[i] - m;
    totalCost += Math.abs(d);
    if (d === 0) {
      heldCount++;
      return `${noteLabelFn(m)} held (0)`;
    }
    const sign = d > 0 ? '+' : '';
    return `${noteLabelFn(m)}→${noteLabelFn(b[i])} (${sign}${d})`;
  });
  return {
    moves,
    summary: parts.join(', '),
    heldCount,
    totalCost,
  };
}

/* =====================================================================
   SETTING INTERACTION: VOICE LEADING & RANDOM OCTAVE
   ===================================================================== */

export interface OctaveVLSettingsState {
  vlead: boolean;
  randomOctave: boolean;
  pinnedRange: [number, number];
  notice: string;
  warning: string;
}

export function resolveOctaveVoiceLeadingSettings(
  prev: {vlead: boolean; randomOctave: boolean},
  change: {vlead?: boolean; randomOctave?: boolean},
  range: [number, number] = DEFAULT_VL_RANGE,
): OctaveVLSettingsState {
  let vlead = change.vlead !== undefined ? change.vlead : prev.vlead;
  let randomOctave =
    change.randomOctave !== undefined ? change.randomOctave : prev.randomOctave;
  let notice = '';
  let warning = '';

  if (change.vlead === true) {
    randomOctave = false;
    notice = 'Random octaves are turned off while Voice Leading is on (register pinned to C3–C6).';
  } else if (vlead && change.randomOctave === true) {
    randomOctave = true;
    warning = 'Warning: Re-enabling random octaves may jump chords outside the voice-leading register.';
  } else if (vlead && !randomOctave) {
    notice = 'Random octaves are turned off while Voice Leading is on (register pinned to C3–C6).';
  }

  return {
    vlead,
    randomOctave,
    pinnedRange: range,
    notice,
    warning,
  };
}

