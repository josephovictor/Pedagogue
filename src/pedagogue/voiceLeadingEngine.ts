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
