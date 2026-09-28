/**
 * Boss difficulty, in one table.
 *
 * Each stage's boss is a cycle harder than the last, Returnal-style: it keeps the
 * moves you have already learned and adds new ones, reads its attacks for less
 * time, and gives you shorter openings afterwards. Tune the game here, not in the
 * behaviour code.
 */

export type AttackName =
  | 'burst'   // ring of orbs with a gap aimed at you: slip through the gap
  | 'fan'     // aimed spread of orbs
  | 'wall'    // vertical line of orbs sweeping left, one gap to fly through
  | 'charge'  // locks your height, then rams across the screen
  | 'spiral'  // rotating arms of orbs for a couple of seconds
  | 'flank';  // vanishes and reappears BEHIND you: flip to fight back

export interface BossProfile {
  /** Correct-article hits needed to break it. */
  hp: number;
  /** Seconds of warning before an attack lands (the "tell"). */
  telegraph: number;
  /** Seconds it stays exposed after an attack: the punish window. */
  recover: number;
  /** Seconds of swaying between attacks. */
  idle: number;
  /** Movement and orb speed multiplier. */
  speed: number;
  /** Orb speed in pixels per second. */
  orbSpeed: number;
  /** Moves it may pick from, in the order they unlock. */
  attacks: AttackName[];
  /** Orbs in one burst ring, rings fired per burst, orbs in a fan, arms on the spiral. */
  ringOrbs: number;
  rings: number;
  fanOrbs: number;
  spiralArms: number;
  /** Chance that one attack chains straight into another with no opening between. */
  chainChance: number;
}

/** Indexed by stage (0 = A0 ... 3 = B1). */
export const BOSS_PROFILES: BossProfile[] = [
  { hp: 10, telegraph: 0.95, recover: 1.7, idle: 1.8, speed: 1.0,  orbSpeed: 150,
    attacks: ['burst', 'charge'],
    ringOrbs: 12, rings: 1, fanOrbs: 3, spiralArms: 2, chainChance: 0 },
  { hp: 12, telegraph: 0.8,  recover: 1.4, idle: 1.5, speed: 1.1,  orbSpeed: 170,
    attacks: ['burst', 'charge', 'fan', 'wall'],
    ringOrbs: 14, rings: 2, fanOrbs: 3, spiralArms: 2, chainChance: 0 },
  { hp: 14, telegraph: 0.65, recover: 1.15, idle: 1.25, speed: 1.2, orbSpeed: 185,
    attacks: ['burst', 'charge', 'fan', 'wall', 'flank', 'spiral'],
    ringOrbs: 16, rings: 2, fanOrbs: 5, spiralArms: 3, chainChance: 0.2 },
  { hp: 12, telegraph: 0.5,  recover: 0.9, idle: 1.0, speed: 1.3,  orbSpeed: 200,
    attacks: ['burst', 'charge', 'fan', 'wall', 'flank', 'spiral'],
    ringOrbs: 18, rings: 3, fanOrbs: 5, spiralArms: 4, chainChance: 0.45 },
];

/**
 * Health phases within one fight. Each form (base, diminutive, plural) is angrier:
 * faster, quicker to attack, and shorter tells. Index matches WordEnemy.phase order.
 */
export const PHASE_SCALING = [
  { speed: 1.0,  telegraph: 1.0,  idle: 1.0 },
  { speed: 1.15, telegraph: 0.9,  idle: 0.8 },
  { speed: 1.35, telegraph: 0.8,  idle: 0.6 },
];

/** The final stage fields bosses in waves; later waves shave a little off every tell. */
export const WAVE_TELEGRAPH_SCALE = [1, 0.95, 0.88];

/** A wrong-article hit on a boss provokes it: the next attack comes this much sooner. */
export const PROVOKE_IDLE_CUT = 0.6;
