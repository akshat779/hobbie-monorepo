import { describe, expect, it } from 'vitest';

/**
 * Pure mathematical algorithms governing StepSlider and RangeSlider bounds,
 * snap stepping, and collision avoidance per AGENTS.md clean architecture directive.
 */

function calculateSteppedValue(
  rawRatio: number,
  min: number,
  max: number,
  step: number
): number {
  const rawVal = min + rawRatio * (max - min);
  const stepped = Math.round(rawVal / step) * step;
  return Math.max(min, Math.min(max, stepped));
}

function calculateRangeValues(
  activeThumb: 'min' | 'max',
  rawRatio: number,
  currentMin: number,
  currentMax: number,
  min: number,
  max: number,
  step: number,
  minGap: number
): [number, number] {
  const rawVal = min + rawRatio * (max - min);
  const stepped = Math.round(rawVal / step) * step;

  if (activeThumb === 'min') {
    const clampedMin = Math.max(min, Math.min(currentMax - minGap, stepped));
    return [clampedMin, currentMax];
  } else {
    const clampedMax = Math.min(max, Math.max(currentMin + minGap, stepped));
    return [currentMin, clampedMax];
  }
}

describe('StepSlider math logic', () => {
  it('correctly clamps and steps squad capacity from 2 to 20', () => {
    // 0 ratio -> min (2)
    expect(calculateSteppedValue(0, 2, 20, 1)).toBe(2);

    // 1 ratio -> max (20)
    expect(calculateSteppedValue(1, 2, 20, 1)).toBe(20);

    // 0.5 ratio -> exactly midpoint: 2 + 0.5 * 18 = 11
    expect(calculateSteppedValue(0.5, 2, 20, 1)).toBe(11);

    // Sub-step values round to nearest integer
    expect(calculateSteppedValue(0.12, 2, 20, 1)).toBe(4); // 2 + 2.16 = 4.16 -> 4
  });

  it('never outputs values below min or above max even with out-of-bounds ratios', () => {
    expect(calculateSteppedValue(-0.5, 2, 20, 1)).toBe(2);
    expect(calculateSteppedValue(1.5, 2, 20, 1)).toBe(20);
  });
});

describe('RangeSlider dual-thumb collision avoidance math', () => {
  const min = 18;
  const max = 65;
  const step = 1;
  const minGap = 1;

  it('prevents minimum thumb from crossing or matching maximum thumb', () => {
    // Current range: 25 to 30. User tries to drag min thumb to 40 (beyond max thumb)
    const ratioFor40 = (40 - min) / (max - min);
    const [newMin, newMax] = calculateRangeValues(
      'min',
      ratioFor40,
      25,
      30,
      min,
      max,
      step,
      minGap
    );

    // Min must clamp to currentMax - minGap = 29
    expect(newMin).toBe(29);
    expect(newMax).toBe(30);
    expect(newMin).toBeLessThan(newMax);
  });

  it('prevents maximum thumb from crossing or matching minimum thumb', () => {
    // Current range: 25 to 30. User tries to drag max thumb to 20 (below min thumb)
    const ratioFor20 = (20 - min) / (max - min);
    const [newMin, newMax] = calculateRangeValues(
      'max',
      ratioFor20,
      25,
      30,
      min,
      max,
      step,
      minGap
    );

    // Max must clamp to currentMin + minGap = 26
    expect(newMin).toBe(25);
    expect(newMax).toBe(26);
    expect(newMin).toBeLessThan(newMax);
  });

  it('handles valid within-bounds adjustments for both thumbs', () => {
    // Drag min thumb to 21
    const ratioFor21 = (21 - min) / (max - min);
    const [minResult] = calculateRangeValues('min', ratioFor21, 18, 35, min, max, step, minGap);
    expect(minResult).toBe(21);

    // Drag max thumb to 45
    const ratioFor45 = (45 - min) / (max - min);
    const [, maxResult] = calculateRangeValues('max', ratioFor45, 21, 35, min, max, step, minGap);
    expect(maxResult).toBe(45);
  });
});
