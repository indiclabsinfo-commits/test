// Global economy policy for house-managed games.
export const DEFAULT_HOUSE_EDGE = 0.05;
export const DEFAULT_RTP_FACTOR = 1 - DEFAULT_HOUSE_EDGE; // 95% RTP

// Plinko tables are authored around ~99% RTP, so scale to the global RTP target.
export const PLINKO_TABLE_BASELINE_RTP = 0.99;
export const PLINKO_RTP_ADJUSTMENT = DEFAULT_RTP_FACTOR / PLINKO_TABLE_BASELINE_RTP;

