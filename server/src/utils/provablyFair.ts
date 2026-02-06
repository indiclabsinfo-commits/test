import crypto from 'crypto';

export class ProvablyFair {
  /**
   * Generate a cryptographically secure random server seed
   */
  static generateServerSeed(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate SHA-256 hash of the server seed
   */
  static hashServerSeed(serverSeed: string): string {
    return crypto.createHash('sha256').update(serverSeed).digest('hex');
  }

  /**
   * Generate client seed (can be user-provided or auto-generated)
   */
  static generateClientSeed(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Combine seeds and nonce to create a deterministic random result
   */
  static generateHash(serverSeed: string, clientSeed: string, nonce: number): string {
    const combined = `${serverSeed}:${clientSeed}:${nonce}`;
    return crypto.createHmac('sha256', serverSeed).update(combined).digest('hex');
  }

  /**
   * Convert hash to a number between 0 and 1
   */
  static hashToNumber(hash: string, index: number = 0): number {
    // Take 8 characters from the hash starting at index
    const subHash = hash.substr(index * 8, 8);
    const decimal = parseInt(subHash, 16);
    return decimal / Math.pow(2, 32);
  }

  /**
   * Generate a random number between min and max (inclusive)
   */
  static generateNumber(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    min: number,
    max: number
  ): number {
    const hash = this.generateHash(serverSeed, clientSeed, nonce);
    const random = this.hashToNumber(hash);
    return Math.floor(random * (max - min + 1)) + min;
  }

  /**
   * Generate a random float between 0 and 1
   */
  static generateFloat(
    serverSeed: string,
    clientSeed: string,
    nonce: number
  ): number {
    const hash = this.generateHash(serverSeed, clientSeed, nonce);
    return this.hashToNumber(hash);
  }

  /**
   * Dice game: Generate result between 0 and 9999
   */
  static generateDiceResult(
    serverSeed: string,
    clientSeed: string,
    nonce: number
  ): number {
    const hash = this.generateHash(serverSeed, clientSeed, nonce);
    const random = this.hashToNumber(hash);
    return Number((random * 10000).toFixed(2));
  }

  /**
   * Crash game: Generate crash point with house edge
   */
  static generateCrashPoint(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    houseEdge: number = 0.01
  ): number {
    const hash = this.generateHash(serverSeed, clientSeed, nonce);
    const h = parseInt(hash.slice(0, 13), 16);
    const e = Math.pow(2, 52);

    // Apply house edge
    const crashPoint = Math.floor((100 * e - h) / (e - h) * (1 - houseEdge)) / 100;

    return Math.max(1.00, Number(crashPoint.toFixed(2)));
  }

  /**
   * Mines game: Generate mine positions
   */
  static generateMinePositions(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    totalTiles: number,
    mineCount: number
  ): number[] {
    const positions: number[] = [];
    const hash = this.generateHash(serverSeed, clientSeed, nonce);

    // Use different parts of the hash for each mine
    for (let i = 0; i < mineCount; i++) {
      let position: number;
      let attempts = 0;

      do {
        const index = (i + attempts) % 4;
        const subHash = hash.substr(index * 16, 16);
        const decimal = parseInt(subHash, 16);
        position = decimal % totalTiles;
        attempts++;
      } while (positions.includes(position) && attempts < 100);

      if (!positions.includes(position)) {
        positions.push(position);
      }
    }

    return positions.sort((a, b) => a - b);
  }

  /**
   * Plinko game: Generate drop path
   */
  static generatePlinkoPath(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    rows: number
  ): number[] {
    const path: number[] = [];
    const hash = this.generateHash(serverSeed, clientSeed, nonce);

    for (let i = 0; i < rows; i++) {
      const random = this.hashToNumber(hash, i);
      path.push(random < 0.5 ? 0 : 1); // 0 = left, 1 = right
    }

    return path;
  }

  /**
   * Limbo game: Generate multiplier
   */
  static generateLimboMultiplier(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    houseEdge: number = 0.01
  ): number {
    const hash = this.generateHash(serverSeed, clientSeed, nonce);
    const random = this.hashToNumber(hash);

    // Generate exponential distribution
    const result = (1 - houseEdge) / random;

    return Math.max(1.00, Number(result.toFixed(2)));
  }

  /**
   * Roulette: Generate winning number (0-36)
   */
  static generateRouletteNumber(
    serverSeed: string,
    clientSeed: string,
    nonce: number
  ): number {
    return this.generateNumber(serverSeed, clientSeed, nonce, 0, 36);
  }

  /**
   * Wheel game: Generate segment
   */
  static generateWheelSegment(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    segments: number
  ): number {
    return this.generateNumber(serverSeed, clientSeed, nonce, 0, segments - 1);
  }

  /**
   * Blackjack: Generate card (1-52)
   */
  static generateCard(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    excludeCards: number[] = []
  ): number {
    let card: number;
    let attempts = 0;

    do {
      card = this.generateNumber(serverSeed, clientSeed, nonce + attempts, 1, 52);
      attempts++;
    } while (excludeCards.includes(card) && attempts < 100);

    return card;
  }

  /**
   * HiLo: Generate card value (1-13)
   */
  static generateHiLoCard(
    serverSeed: string,
    clientSeed: string,
    nonce: number
  ): number {
    return this.generateNumber(serverSeed, clientSeed, nonce, 1, 13);
  }

  /**
   * Dragon Tower: Generate safe tiles for each row
   */
  static generateDragonTowerSafeTiles(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    rows: number,
    difficulty: 'easy' | 'medium' | 'hard'
  ): number[][] {
    const tilesPerRow = difficulty === 'easy' ? 3 : difficulty === 'medium' ? 4 : 5;
    const safeTiles: number[][] = [];

    for (let row = 0; row < rows; row++) {
      const safeTile = this.generateNumber(serverSeed, clientSeed, nonce + row, 0, tilesPerRow - 1);
      safeTiles.push([safeTile]);
    }

    return safeTiles;
  }

  /**
   * Verify game result using seeds and nonce
   */
  static verifyResult(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    expectedHash: string
  ): boolean {
    const generatedHash = this.generateHash(serverSeed, clientSeed, nonce);
    return generatedHash === expectedHash;
  }

  /**
   * Generate complete seed pair for a new user or seed rotation
   */
  static generateSeedPair(): {
    serverSeed: string;
    serverSeedHash: string;
    clientSeed: string;
  } {
    const serverSeed = this.generateServerSeed();
    const serverSeedHash = this.hashServerSeed(serverSeed);
    const clientSeed = this.generateClientSeed();

    return {
      serverSeed,
      serverSeedHash,
      clientSeed
    };
  }
}

export default ProvablyFair;
