import assert from 'node:assert/strict';
import {
  buildScaleHandSequences,
  computeScaleOctaveCapacity,
  resolveScaleOctaves,
} from './scaleRange';

const C_MAJOR = [0, 2, 4, 5, 7, 9, 11];
const ALL_PCS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

function testCapacityAcrossKeyboardSizes() {
  // Default 5-octave keyboard: C2 (36) to C6 (96)
  const capOne = computeScaleOctaveCapacity({
    lo: 36,
    hi: 96,
    hands: 'one',
    contraryStart: 'unison',
    rootPcs: ALL_PCS,
  });
  assert.equal(capOne.maxGuaranteed, 4);

  const capParallel = computeScaleOctaveCapacity({
    lo: 36,
    hi: 96,
    hands: 'parallel',
    contraryStart: 'unison',
    rootPcs: ALL_PCS,
  });
  assert.equal(capParallel.maxGuaranteed, 3);
  assert.equal(capParallel.maxAnyKey, 4); // C fits 4 octaves (C2-C6)

  const capContraryUnison = computeScaleOctaveCapacity({
    lo: 36,
    hi: 96,
    hands: 'contrary',
    contraryStart: 'unison',
    rootPcs: ALL_PCS,
  });
  assert.equal(capContraryUnison.maxGuaranteed, 2);

  const capContraryOctave = computeScaleOctaveCapacity({
    lo: 36,
    hi: 96,
    hands: 'contrary',
    contraryStart: 'octave',
    rootPcs: ALL_PCS,
  });
  assert.equal(capContraryOctave.maxGuaranteed, 1);
  assert.equal(capContraryOctave.maxAnyKey, 2); // C fits 2 octaves (LH C4->C2, RH C5->C7? wait: C5=72+24=96, C4=60-24=36)

  // 88-key piano: A0 (21) to C8 (108) -> 4 octaves works in ALL modes & keys
  const cap88ContraryOct = computeScaleOctaveCapacity({
    lo: 21,
    hi: 108,
    hands: 'contrary',
    contraryStart: 'octave',
    rootPcs: ALL_PCS,
  });
  assert.equal(cap88ContraryOct.maxGuaranteed, 2);
  assert.equal(cap88ContraryOct.maxAnyKey, 3);
  const cap88ContraryUnison = computeScaleOctaveCapacity({
    lo: 21,
    hi: 108,
    hands: 'contrary',
    contraryStart: 'unison',
    rootPcs: ALL_PCS,
  });
  assert.equal(cap88ContraryUnison.maxGuaranteed, 3);
  assert.equal(cap88ContraryUnison.maxAnyKey, 3);
}

function testDiatonicContraryUnisonAndOctave() {
  // Unison contrary C major 2 octaves ascending on C2-C6
  const unisonUp = buildScaleHandSequences({
    baseInts: C_MAJOR,
    rootPc: 0,
    rangeMode: 'multi',
    multiChoice: '2',
    dir: 'up',
    hands: 'contrary',
    contraryStart: 'unison',
    clef: 'grand',
    lo: 36,
    hi: 96,
  });
  assert.equal(unisonUp.effectiveOctaves, 2);
  assert.equal(unisonUp.rhSeq[0], 60);
  assert.equal(unisonUp.lhSeq?.[0], 60);
  assert.equal(unisonUp.rhSeq.at(-1), 84);
  assert.equal(unisonUp.lhSeq?.at(-1), 36);
  // Step 0 is unison [60], all later steps are [lh, rh]
  assert.deepEqual(unisonUp.steps[0], [60]);
  assert.deepEqual(unisonUp.steps[1], [59, 62]); // B3 & D4 (diatonic C major!)
  assert.deepEqual(unisonUp.steps[2], [57, 64]); // A3 & E4
  assert.ok(
    unisonUp.lhSeq!.every(m => [0, 2, 4, 5, 7, 9, 11].includes(m % 12)),
    'LH contrary motion must stay inside C major',
  );

  // Descending unison contrary is the exact reverse
  const unisonDown = buildScaleHandSequences({
    baseInts: C_MAJOR,
    rootPc: 0,
    rangeMode: 'multi',
    multiChoice: '2',
    dir: 'down',
    hands: 'contrary',
    contraryStart: 'unison',
    clef: 'grand',
    lo: 36,
    hi: 96,
  });
  assert.deepEqual(unisonDown.rhSeq, [...unisonUp.rhSeq].reverse());
  assert.deepEqual(unisonDown.lhSeq, [...unisonUp.lhSeq!].reverse());
  assert.deepEqual(unisonDown.steps.at(-1), [60]);

  // 1 octave apart contrary C major 2 octaves on C2-C6: LH C4->C2, RH C5->C7 (60->36, 72->96)
  const octUp = buildScaleHandSequences({
    baseInts: C_MAJOR,
    rootPc: 0,
    rangeMode: 'multi',
    multiChoice: '2',
    dir: 'up',
    hands: 'contrary',
    contraryStart: 'octave',
    clef: 'grand',
    lo: 36,
    hi: 96,
  });
  assert.equal(octUp.effectiveOctaves, 2);
  assert.equal(octUp.lhSeq?.[0], 60);
  assert.equal(octUp.rhSeq[0], 72);
  assert.equal(octUp.lhSeq?.at(-1), 36);
  assert.equal(octUp.rhSeq.at(-1), 96);
  assert.deepEqual(octUp.steps[0], [60, 72]);
}

function testAutoAndClampingAndTinyKeyboardFallback() {
  // Auto picks max playable for G major parallel on C2-C6 -> 3 octaves
  const resG = resolveScaleOctaves({
    rangeMode: 'multi',
    multiChoice: 'auto',
    hands: 'parallel',
    contraryStart: 'unison',
    rootPc: 7,
    lo: 36,
    hi: 96,
  });
  assert.equal(resG.effectiveOctaves, 3);
  assert.equal(resG.wasClamped, false);

  // Explicit 4 octaves in G major contrary unison on C2-C6 -> clamps cleanly to 2
  const resClamp = resolveScaleOctaves({
    rangeMode: 'multi',
    multiChoice: '4',
    hands: 'contrary',
    contraryStart: 'unison',
    rootPc: 7,
    lo: 36,
    hi: 96,
  });
  assert.equal(resClamp.effectiveOctaves, 2);
  assert.equal(resClamp.wasClamped, true);

  // 25-key controller (C3=48 to C5=72) with contrary 'octave' falls back cleanly to 'unison'
  const tiny = buildScaleHandSequences({
    baseInts: C_MAJOR,
    rootPc: 0,
    rangeMode: '1',
    multiChoice: 'auto',
    dir: 'up',
    hands: 'contrary',
    contraryStart: 'octave',
    clef: 'grand',
    lo: 48,
    hi: 72,
  });
  assert.equal(tiny.contraryFellBackToUnison, true);
  assert.equal(tiny.effectiveContraryStart, 'unison');
  assert.equal(tiny.lhSeq?.[0], 60);
  assert.equal(tiny.rhSeq[0], 60);
  assert.ok(Math.min(...tiny.lhSeq!) >= 48 && Math.max(...tiny.rhSeq) <= 72);
}

testCapacityAcrossKeyboardSizes();
testDiatonicContraryUnisonAndOctave();
testAutoAndClampingAndTinyKeyboardFallback();
console.log('ALL SCALE RANGE TESTS PASSED');
