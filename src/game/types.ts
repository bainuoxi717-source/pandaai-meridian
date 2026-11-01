import type * as THREE from 'three';

export type Phase = 'staging' | 'active' | 'paused' | 'complete' | 'failed';
export type Order = 'fall-in' | 'hold' | 'clear';
export type Protocol = 'guard' | 'recon' | 'sync' | 'burst';
export type PersonaId = 'guardian' | 'hunter' | 'craftsman' | 'storyteller' | 'mirror' | 'player';
export type WeaponId = 'stillwater' | 'quietline' | 'beanbag';
export type Menu = 'briefing' | 'loadout' | 'settings' | 'manual' | 'map' | 'method' | null;

export interface Settings {
  volume: number;
  sensitivity: number;
  quality: 'high' | 'balanced';
  radioVoice: boolean;
  invertY: boolean;
}

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  subtitle: string;
  caliber: string;
  capacity: number;
  reserve: number;
  damage: number;
  interval: number;
  reload: number;
  control: number;
  power: number;
  reach: number;
  description: string;
  nonlethal: boolean;
}

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  stillwater: { id: 'stillwater', name: '静水·观测者', subtitle: '精准卡宾枪', caliber: '5.56 × 45 MM', capacity: 30, reserve: 150, damage: 38, interval: .16, reload: 2.25, control: 82, power: 76, reach: 88, nonlethal: false, description: '紧凑、低噪、适合中远距离精确控制。给先观察、再行动的策略留下稳定余量。' },
  quietline: { id: 'quietline', name: '静线·9', subtitle: '近距冲锋枪', caliber: '9 × 19 MM', capacity: 30, reserve: 180, damage: 26, interval: .105, reload: 1.85, control: 95, power: 54, reach: 63, nonlethal: false, description: '操控轻快、射速更高，适合近距突破与快速转移，但需要更严格的仓位管理。' },
  beanbag: { id: 'beanbag', name: '铜扇·非致命', subtitle: '约束霰弹枪', caliber: '12 GA · LESS-LETHAL', capacity: 6, reserve: 24, damage: 8, interval: .75, reload: 2.6, control: 64, power: 42, reach: 38, nonlethal: true, description: '命中活跃嫌疑人可迫使其投降。射速慢、容量小，用节奏换取更高的保护收益。' },
};

export const DEFAULT_SETTINGS: Settings = { volume: 45, sensitivity: 50, quality: 'high', radioVoice: false, invertY: false };

export interface UnitState {
  id: string;
  name: string;
  role: string;
  team: 'alpha' | 'bravo';
  health: number;
  status: string;
  x: number;
  z: number;
}

export interface Marker {
  id: string;
  label: string;
  distance: number;
  x: number;
  y: number;
  visible: boolean;
  kind: 'objective' | 'squad' | 'civilian';
}

export interface LogEntry { id: number; source: string; text: string; time: number; }

export interface BehaviorMetrics {
  protocolSeconds: Record<Protocol, number>;
  orderUse: Record<Order, number>;
  guardSeconds: number;
  nearSquadSeconds: number;
  loneSeconds: number;
  reconScans: number;
  reconContacts: number;
  scanArrests: number;
  burstActivations: number;
  burstKills: number;
  syncAssists: number;
  orderChanges: number;
  adaptiveOrders: number;
  mapChecks: number;
  flashbangs: number;
  intel: number;
  earlyIntel: number;
  evidenceBeforeClear: boolean;
  civiliansBeforeClear: number;
  damageTaken: number;
  squadDamage: number;
  firstShotBeforeScan: boolean;
}

export interface MarketState {
  equity: number;
  peak: number;
  maxDrawdown: number;
  exposure: number;
  averageExposure: number;
  exposureIntegral: number;
  turnover: number;
  trades: number;
  ticks: number[];
  regime: string;
  lastReturn: number;
}

export interface GameSnapshot {
  ready: boolean;
  phase: Phase;
  elapsed: number;
  health: number;
  armor: number;
  ammo: number;
  reserve: number;
  weapon: WeaponId;
  reloading: boolean;
  reloadProgress: number;
  grenades: number;
  order: Order;
  protocol: Protocol;
  protocolCooldown: number;
  protocolActive: number;
  scanPulse: number;
  intel: number;
  market: MarketState;
  metrics: BehaviorMetrics;
  squad: UnitState[];
  threats: number;
  arrested: number;
  neutralized: number;
  civilians: number;
  civilianLosses: number;
  evidence: boolean;
  extracted: boolean;
  score: number;
  shots: number;
  hits: number;
  x: number;
  z: number;
  heading: number;
  crouching: boolean;
  flashlight: boolean;
  nightVision: boolean;
  aiming: boolean;
  prompt: string;
  promptKey: string;
  markers: Marker[];
  radio: LogEntry[];
  hitMarker: number;
  damage: number;
  flash: number;
  locked: boolean;
  doorOpen: boolean;
  enemies: { id: string; x: number; z: number; state: string; visible: boolean }[];
}

export const SQUAD_ROSTER: UnitState[] = [
  { id: 'A1', name: 'IRIS', role: '前锋观测', team: 'alpha', health: 100, status: 'READY', x: -2.2, z: 13 },
  { id: 'A2', name: 'TAL', role: '突破支援', team: 'alpha', health: 100, status: 'READY', x: -2.5, z: 8.7 },
  { id: 'B1', name: 'BRAN', role: '火力协同', team: 'bravo', health: 100, status: 'READY', x: 3.0, z: 7.4 },
  { id: 'B2', name: 'MERA', role: '后卫守护', team: 'bravo', health: 100, status: 'READY', x: 3.3, z: 15.5 },
];

export function initialSnapshot(): GameSnapshot {
  return {
    ready: false, phase: 'staging', elapsed: 0, health: 100, armor: 100,
    ammo: 30, reserve: 150, weapon: 'stillwater', reloading: false, reloadProgress: 0,
    grenades: 3, order: 'fall-in', protocol: 'recon', protocolCooldown: 0, protocolActive: 0, scanPulse: 0,
    intel: 0,
    market: { equity: 100000, peak: 100000, maxDrawdown: 0, exposure: 0, averageExposure: 0, exposureIntegral: 0, turnover: 0, trades: 0, ticks: [100000], regime: '观察期', lastReturn: 0 },
    metrics: {
      protocolSeconds: { guard: 0, recon: 0, sync: 0, burst: 0 }, orderUse: { 'fall-in': 0, hold: 0, clear: 0 },
      guardSeconds: 0, nearSquadSeconds: 0, loneSeconds: 0, reconScans: 0, reconContacts: 0, scanArrests: 0,
      burstActivations: 0, burstKills: 0, syncAssists: 0, orderChanges: 0, adaptiveOrders: 0, mapChecks: 0,
      flashbangs: 0, intel: 0, earlyIntel: 0, evidenceBeforeClear: false, civiliansBeforeClear: 0,
      damageTaken: 0, squadDamage: 0, firstShotBeforeScan: false,
    },
    squad: SQUAD_ROSTER.map(s => ({ ...s })),
    threats: 0, arrested: 0, neutralized: 0, civilians: 0, civilianLosses: 0,
    evidence: false, extracted: false, score: 0, shots: 0, hits: 0,
    x: .7, z: 20, heading: 0, crouching: false, flashlight: false,
    nightVision: false, aiming: false, prompt: '', promptKey: 'E', markers: [],
    radio: [{ id: 0, source: 'PANDA', text: '先观察，再下令。你的策略会留下可解释的行为轨迹。', time: 0 }],
    hitMarker: 0, damage: 0, flash: 0, locked: false, doorOpen: false, enemies: [],
  };
}

export interface Collider {
  box: THREE.Box3;
  enabled: boolean;
  kind: 'wall' | 'cover' | 'door' | 'wood';
}

export interface Door {
  group: THREE.Group;
  collider: Collider;
  open: boolean;
  angle: number;
}

export interface GameActions {
  deploy: () => void;
  resume: () => void;
  pause: () => void;
  restart: () => void;
  order: (order: Order) => void;
  protocol: (protocol: Protocol) => void;
  reload: () => void;
  interact: () => void;
  shout: () => void;
  flashbang: () => void;
  setWeapon: (id: WeaponId) => void;
  setSettings: (settings: Settings) => void;
  setMenuOpen: (open: boolean) => void;
  noteMapCheck: () => void;
  toggleFlashlight: () => void;
  toggleNightVision: () => void;
  toggleCrouch: () => void;
  focus: () => void;
  input: (key: string, down: boolean) => void;
  look: (x: number, y: number) => void;
  shoot: () => void;
}
