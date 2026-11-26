import assert from 'node:assert/strict';
import {computeScaleOrMelFingering} from './scaleFingering';

const MAJ = [0, 2, 4, 5, 7, 9, 11];
const HMIN = [0, 2, 3, 5, 7, 8, 11];

function buildScaleNotes(rootMidi: number, ints: number[], octs = 1): number[] {
  const out: number[] = [];
  for (let o = 0; o < octs; o++) {
    out.push(...ints.map(x => rootMidi + 12 * o + x));
  }
  out.push(rootMidi + 12 * octs);
  return out;
}

function testCanonicalMajorScales() {
  const expectedRH: Record<number, number[]> = {
    0: [1, 2, 3, 1, 2, 3, 4, 5], // C
    7: [1, 2, 3, 1, 2, 3, 4, 5], // G
    2: [1, 2, 3, 1, 2, 3, 4, 5], // D
    9: [1, 2, 3, 1, 2, 3, 4, 5], // A
    4: [1, 2, 3, 1, 2, 3, 4, 5], // E
    11: [1, 2, 3, 1, 2, 3, 4, 5], // B
    5: [1, 2, 3, 4, 1, 2, 3, 4], // F
    6: [2, 3, 4, 1, 2, 3, 1, 2], // F#
    1: [2, 3, 1, 2, 3, 4, 1, 2], // Db
    8: [3, 4, 1, 2, 3, 1, 2, 3], // Ab
    3: [3, 1, 2, 3, 4, 1, 2, 3], // Eb
    10: [4, 1, 2, 3, 1, 2, 3, 4], // Bb
  };

  const expectedLH: Record<number, number[]> = {
    0: [5, 4, 3, 2, 1, 3, 2, 1], // C
    7: [5, 4, 3, 2, 1, 3, 2, 1], // G
    2: [5, 4, 3, 2, 1, 3, 2, 1], // D
    9: [5, 4, 3, 2, 1, 3, 2, 1], // A
    4: [5, 4, 3, 2, 1, 3, 2, 1], // E
    5: [5, 4, 3, 2, 1, 3, 2, 1], // F
    11: [4, 3, 2, 1, 4, 3, 2, 1], // B
    6: [4, 3, 2, 1, 3, 2, 1, 2], // F#
    1: [3, 2, 1, 4, 3, 2, 1, 2], // Db
    8: [3, 2, 1, 4, 3, 2, 1, 3], // Ab
    3: [3, 2, 1, 4, 3, 2, 1, 3], // Eb
    10: [3, 2, 1, 4, 3, 2, 1, 2], // Bb
  };

  for (const pc of Object.keys(expectedRH).map(Number)) {
    const rhNotes = buildScaleNotes(60 + pc, MAJ, 1);
    const lhNotes = buildScaleNotes(48 + pc, MAJ, 1);

    const rhUp = computeScaleOrMelFingering(rhNotes, 'R', {k: 'scale'});
    const rhDn = computeScaleOrMelFingering([...rhNotes].reverse(), 'R', {k: 'scale'});
    assert.deepEqual(rhUp, expectedRH[pc], `RH Major pc=${pc}`);
    assert.deepEqual(rhDn, [...expectedRH[pc]].reverse(), `RH Major desc pc=${pc}`);

    const lhUp = computeScaleOrMelFingering(lhNotes, 'L', {k: 'scale'});
    const lhDn = computeScaleOrMelFingering([...lhNotes].reverse(), 'L', {k: 'scale'});
    assert.deepEqual(lhUp, expectedLH[pc], `LH Major pc=${pc}`);
    assert.deepEqual(lhDn, [...expectedLH[pc]].reverse(), `LH Major desc pc=${pc}`);
  }

  // 2-octave B major LH & F major RH
  assert.deepEqual(
    computeScaleOrMelFingering(buildScaleNotes(47, MAJ, 2), 'L', {k: 'scale'}),
    [4, 3, 2, 1, 4, 3, 2, 1, 3, 2, 1, 4, 3, 2, 1],
  );
  assert.deepEqual(
    computeScaleOrMelFingering(buildScaleNotes(65, MAJ, 2), 'R', {k: 'scale'}),
    [1, 2, 3, 4, 1, 2, 3, 1, 2, 3, 4, 1, 2, 3, 4],
  );
}

function testArpeggiosAndFallbackModes() {
  // 2-octave C major triad arpeggio RH & LH
  const cArpRh = [60, 64, 67, 72, 76, 79, 84];
  assert.deepEqual(
    computeScaleOrMelFingering(cArpRh, 'R', {k: 'scale', ar: true}),
    [1, 2, 3, 1, 2, 3, 5],
  );
  assert.deepEqual(
    computeScaleOrMelFingering([...cArpRh].reverse(), 'R', {k: 'scale', ar: true}),
    [5, 3, 2, 1, 3, 2, 1],
  );

  const cArpLh = [48, 52, 55, 60, 64, 67, 72];
  assert.deepEqual(
    computeScaleOrMelFingering(cArpLh, 'L', {k: 'scale', ar: true}),
    [5, 4, 2, 1, 4, 2, 1],
  );
  assert.deepEqual(
    computeScaleOrMelFingering([...cArpLh].reverse(), 'L', {k: 'scale', ar: true}),
    [1, 2, 4, 1, 2, 4, 5],
  );

  // 2-octave C7 arpeggio
  const c7Rh = [60, 64, 67, 70, 72, 76, 79, 82, 84];
  assert.deepEqual(
    computeScaleOrMelFingering(c7Rh, 'R', {k: 'scale', ar: true}),
    [1, 2, 3, 4, 1, 2, 3, 4, 5],
  );

  // Black-root triad (Db major: Db-F-Ab) -> thumb on F, no 1 or 5 on black keys
  const dbArpRh = [61, 65, 68, 73, 77, 80, 85];
  assert.deepEqual(
    computeScaleOrMelFingering(dbArpRh, 'R', {k: 'scale', ar: true}),
    [2, 1, 2, 4, 1, 2, 4],
  );

  // Harmonic minor on black key (F# harmonic minor: F#-G#-A-B-C#-D-E#-F#)
  const fsHmin = buildScaleNotes(66, HMIN, 1);
  assert.deepEqual(
    computeScaleOrMelFingering(fsHmin, 'R', {k: 'scale'}),
    [2, 3, 1, 2, 3, 1, 2, 3],
  );

  // Modes / non-standard scales (e.g. C Dorian via DP fallback)
  const cDorian = buildScaleNotes(60, [0, 2, 3, 5, 7, 9, 10], 1);
  const dorRh = computeScaleOrMelFingering(cDorian, 'R', {k: 'scale'});
  assert.equal(dorRh[0], 1);
  assert.ok(![1, 5].includes(dorRh[2]), 'No thumb/pinky on Eb in C Dorian');
}

testCanonicalMajorScales();
testArpeggiosAndFallbackModes();
console.log('ALL SCALE FINGERING TESTS PASSED');
