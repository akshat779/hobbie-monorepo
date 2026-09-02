import { describe, it, expect } from 'vitest';
import { PALETTE } from '../theme/colors';

describe('Design Tokens & Theme', () => {
  it('defines all Nocturnal Pulse brand colors', () => {
    expect(PALETTE.void).toBe('#0D0B14');
    expect(PALETTE.ink).toBe('#17131F');
    expect(PALETTE.signalViolet).toBe('#7B2FF7');
    expect(PALETTE.pulseLilac).toBe('#C77DFF');
    expect(PALETTE.ember).toBe('#FF6B5E');
    expect(PALETTE.moonlight).toBe('#F5F0FF');
    expect(PALETTE.dusk).toBe('#A99BC2');
  });
});
