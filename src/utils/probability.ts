export type MoveType = 'SAFE' | 'AGGRESSIVE';

interface MoveConfig {
  winProbability: number; // 0-1
  multiplier: number;
}

export const ODDS: Record<MoveType, MoveConfig> = {
  SAFE: {
    winProbability: 0.65,
    multiplier: 1.4,
  },
  AGGRESSIVE: {
    winProbability: 0.35,
    multiplier: 2.4,
  },
};

export const COMMISSION_RATE = 0.10; // 10% commission

export const calculateOutcome = (move: MoveType): boolean => {
  const rand = Math.random();
  return rand < ODDS[move].winProbability;
};

export const calculateWinnings = (amount: number, move: MoveType): number => {
    // Note: In Solo mode, the "Pool" is effectively the entry fee.
    // The "Prize" is the multiplier return.
    // The commission is implicit in the odds vs multiplier gap.
    // (e.g. 0.65 * 1.4 = 0.91 RTP => 9% House Edge)
    return Math.floor(amount * ODDS[move].multiplier);
};
