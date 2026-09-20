export const XP = {
  generate: 10, name: 5, rarityCorrect: 10, symbol: 5,
  symbolBadge: 20, quiz: 15, fanArt: 30, followX: 10,
  joinDiscord: 10, share: 5, referral: 20,
} as const;

export const GTD_TOTAL = 700;
export const FCFS_TOTAL = 1500;
export const TOTAL_GAME_WL = GTD_TOTAL + FCFS_TOTAL;

export type WobbleWLStats = {
  playersAttempted: number;
  gtdClaimed: number;
  fcfsClaimed: number;
};

export function deriveWobbleWLStats(stats: WobbleWLStats) {
  const gtdClaimed = Math.max(0, stats.gtdClaimed);
  const fcfsClaimed = Math.max(0, stats.fcfsClaimed);
  const totalClaimed = gtdClaimed + fcfsClaimed;
  return {
    ...stats,
    gtdClaimed,
    fcfsClaimed,
    gtdRemaining: Math.max(GTD_TOTAL - gtdClaimed, 0),
    fcfsRemaining: Math.max(FCFS_TOTAL - fcfsClaimed, 0),
    totalClaimed,
    totalRemaining: Math.max(TOTAL_GAME_WL - totalClaimed, 0),
  };
}

export const LEVELS = [
  { min: 300, name: 'Legendary Wobbler' },
  { min: 150, name: 'Trait Hunter' },
  { min: 50, name: 'Wobble Friend' },
  { min: 0, name: 'Sketchling' },
];

export const CHALLENGES = [
  { id: 1, rarity: 'common' }, { id: 6, rarity: 'uncommon' },
  { id: 17, rarity: 'legendary' }, { id: 204, rarity: 'uncommon' },
  { id: 317, rarity: 'rare' }, { id: 445, rarity: 'uncommon' },
  { id: 1031, rarity: 'legendary' }, { id: 1240, rarity: 'legendary' },
  { id: 1367, rarity: 'rare' }, { id: 1870, rarity: 'rare' },
  { id: 2327, rarity: 'rare' }, { id: 3094, rarity: 'rare' },
] as const;

export const MANUAL_TASKS = ['followX', 'joinDiscord', 'share', 'fanArt'] as const;
export const TASK_KEYS = ['followX', 'joinDiscord', 'generate', 'name', 'rarity', 'symbolBadge', 'share', 'fanArt', 'quiz', 'referral'] as const;
export type ManualTask = typeof MANUAL_TASKS[number];
export const safeDisplay = (name: string) => name.trim().slice(0, 32).replace(/[<>]/g, '');
export const shortWallet = (wallet: string) => wallet.length > 12 ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : wallet;
export const levelFor = (xp: number) => LEVELS.find((level) => xp >= level.min)?.name ?? 'Sketchling';

export function validWallet(value: string, blockchain = 'evm') {
  if (blockchain.toLowerCase() === 'solana') return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}
