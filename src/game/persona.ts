import type { BehaviorMetrics, GameSnapshot, PersonaId, Protocol } from './types';

export interface PersonaProfile {
  id: PersonaId;
  name: string;
  code: string;
  short: string;
  description: string;
  strength: string;
  blindspot: string;
  exercise: string;
  color: string;
}

export const PERSONAS: Record<PersonaId, PersonaProfile> = {
  guardian: {
    id: 'guardian', name: '守门·风控', code: 'CAPITAL PRESERVATION', color: '#7fd1b9',
    short: '先活下来，再谈下一笔。',
    description: '你更在意暴露能否被控制，会先保护退路、队友和平民，再推进目标。你的优势不是回避行动，而是让行动始终留有余量。',
    strength: '风险预算清晰，能在压力下保住决策能力。', blindspot: '守得太死时，机会成本会悄悄变大。',
    exercise: '小仓试错关：用不超过一成的虚拟仓位试跑一次，只记录回撤与踏空，不加码。',
  },
  hunter: {
    id: 'hunter', name: '猎手·趋势', code: 'MOMENTUM PURSUIT', color: '#ef9c68',
    short: '你追的是动能，不是神谕。',
    description: '你愿意在信号出现后迅速推进，用突破和连续行动换取窗口。速度是你的表达，但出场规则决定了这份敏锐能走多远。',
    strength: '对窗口敏感，执行果断，能把观察快速转成行动。', blindspot: '容易在追高中放大暴露，或把动能当成确定性。',
    exercise: '回撤规则关：只补一条停止开新仓的出场规则，对比前后回撤，不新增信号。',
  },
  craftsman: {
    id: 'craftsman', name: '工匠·因子', code: 'EVIDENCE ENGINEERING', color: '#82b8e8',
    short: '边要复核过，才叫边。',
    description: '你倾向先扫描、再交叉验证，让信息变成可以复核的证据。你重视命中质量与验证闭环，而不是最热闹的那次行动。',
    strength: '证据意识强，愿意区分偶然命中与稳定规律。', blindspot: '容易把记得住的曲线当成规律，或因验证过多而延迟行动。',
    exercise: '样本外关：前 70% 只用于调参，后 30% 只验证一次，并写下过拟合疑点。',
  },
  storyteller: {
    id: 'storyteller', name: '说书·宏观', code: 'CONTEXT SYNTHESIS', color: '#c2a6e8',
    short: '先有故事，再把故事收成假设。',
    description: '你会先理解场景、货流与事件之间的联系，再决定如何进入。你擅长搭建全局解释，下一步是让每个情节都有可证伪的观察指标。',
    strength: '上下文整合能力强，能看到单个事件之外的链条。', blindspot: '好听的情节可能被误当成可交易信号。',
    exercise: '概念三行卡：写下假设、观察数据、失败条件；不预测点位，不延伸成买卖建议。',
  },
  mirror: {
    id: 'mirror', name: '跟影·风格', code: 'COORDINATED LEARNING', color: '#e5c779',
    short: '借一双眼睛，但不复制别人的命。',
    description: '你更习惯借助团队与既有范式推进，通过协同和参照降低不确定性。真正重要的是：你能否说出自己认同的是规则，而不只是结果。',
    strength: '善于协同和借助成熟框架，学习路径较短。', blindspot: '容易只像结果、不像原因，把别人的仓位当成自己的答案。',
    exercise: '风格对照关：写下同意与不同意各一条；不同意的规则不跟，不跟单、不晒收益。',
  },
  player: {
    id: 'player', name: '闯关·玩家', code: 'ITERATIVE PLAY', color: '#ec8fa5',
    short: '要反馈，也要完成闭环。',
    description: '你喜欢尝试不同工具，在快速反馈中寻找可行路径。多样的策略是你的优势，但只有留下复盘，尝试才会沉淀成经验。',
    strength: '行动轻快，愿意试验，能从即时反馈中持续迭代。', blindspot: '容易同时开很多任务，把徽章和新鲜感误当成进展。',
    exercise: '单任务专注关：一周每天只改一个参数，记录收益与回撤，其余任务先折叠。',
  },
};

export const PROTOCOLS: Record<Protocol, { name: string; english: string; detail: string; effect: string }> = {
  guard: { name: '稳态守护', english: 'GUARD · 20% 暴露', detail: '低暴露守护，靠近队友或平民记录有效风控', effect: '减伤 35% · 移速略降' },
  recon: { name: '证据扫描', english: 'RECON · 空仓观察', detail: '等待确认；再次按 5 发射扫描脉冲', effect: '揭示威胁与线索 · 12 秒冷却' },
  sync: { name: '协同演算', english: 'SYNC · 45% 暴露', detail: '参照小队节奏，共享目标与风险', effect: '小队射速与机动提升' },
  burst: { name: '动能突破', english: 'BURST · 35/80% 暴露', detail: '再次按 7 启动 6 秒高暴露突破', effect: '移速与射速提升 · 受击增加' },
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const round = (value: number) => Math.round(Math.max(0, Math.min(100, value)));

export function emptyMetrics(): BehaviorMetrics {
  return {
    protocolSeconds: { guard: 0, recon: 0, sync: 0, burst: 0 },
    orderUse: { 'fall-in': 0, hold: 0, clear: 0 },
    guardSeconds: 0, nearSquadSeconds: 0, loneSeconds: 0,
    reconScans: 0, reconContacts: 0, scanArrests: 0,
    burstActivations: 0, burstKills: 0, syncAssists: 0,
    orderChanges: 0, adaptiveOrders: 0, mapChecks: 0, flashbangs: 0,
    intel: 0, earlyIntel: 0, evidenceBeforeClear: false, civiliansBeforeClear: 0,
    damageTaken: 0, squadDamage: 0, firstShotBeforeScan: false,
  };
}

export function analyzePersona(state: GameSnapshot) {
  const m = state.metrics;
  const duration = Math.max(45, state.elapsed);
  const capitalControl = 1 - clamp(state.market.maxDrawdown / .08);
  const lowExposure = 1 - clamp(state.market.averageExposure / .8);
  const marketEngagement = clamp(state.market.averageExposure / .8);
  const aliveSquad = state.squad.filter(s => s.health > 0).length / 4;
  const accuracy = state.shots ? state.hits / state.shots : 0;
  const protocolVariety = Object.values(m.protocolSeconds).filter(v => v >= 4).length;
  const orderVariety = Object.values(m.orderUse).filter(v => v > 0).length;
  const completionSpeed = clamp((360 - state.elapsed) / 240);
  const nearSquadRatio = clamp(m.nearSquadSeconds / duration * 2.5);
  const guardRatio = clamp(m.guardSeconds / duration * 5);
  const burstRatio = clamp(m.protocolSeconds.burst / duration * 7);

  const protection = clamp(state.civilians / 2 * .42 + aliveSquad * .2 + state.arrested / 4 * .18 + (1 - clamp(m.damageTaken / 130)) * .1 + guardRatio * .1);
  const research = clamp(m.intel / 3 * .4 + Math.min(1, m.reconScans / 3) * .22 + Math.min(1, m.scanArrests / 2) * .2 + (m.evidenceBeforeClear ? .1 : 0) + accuracy * .08);
  const narrative = clamp(m.earlyIntel / 2 * .38 + Math.min(1, m.mapChecks / 3) * .18 + (m.evidenceBeforeClear ? .2 : 0) + m.intel / 3 * .16 + (state.evidence ? .08 : 0));
  const momentum = clamp(Math.min(1, m.burstKills / 3) * .28 + state.neutralized / 4 * .18 + completionSpeed * .2 + accuracy * .16 + (m.firstShotBeforeScan ? .08 : 0) + Math.min(1, m.burstActivations / 3) * .1);
  const collaboration = clamp(Math.min(1, m.syncAssists / 3) * .24 + nearSquadRatio * .26 + Math.min(1, m.orderChanges / 5) * .15 + aliveSquad * .2 + Math.min(1, m.orderUse['fall-in'] / 25) * .15);
  const play = clamp(protocolVariety / 4 * .28 + orderVariety / 3 * .2 + Math.min(1, m.flashbangs / 2) * .14 + m.intel / 3 * .14 + Math.min(1, m.adaptiveOrders / 3) * .14 + (state.extracted ? .1 : 0));

  const dimensions = {
    risk: round((protection * .45 + capitalControl * .25 + lowExposure * .12 + (1 - momentum) * .1 + guardRatio * .08) * 100),
    validation: round((research * .68 + narrative * .32) * 100),
    tempo: round((momentum * .46 + burstRatio * .2 + marketEngagement * .2 + (1 - guardRatio) * .14) * 100),
    iteration: round((play * .48 + collaboration * .27 + Math.min(1, m.adaptiveOrders / 3) * .25) * 100),
  };

  const scores: Record<PersonaId, number> = {
    guardian: round(protection * 43 + capitalControl * 18 + lowExposure * 10 + guardRatio * 13 + collaboration * 8 + (1 - momentum) * 8),
    hunter: round(momentum * 54 + burstRatio * 15 + marketEngagement * 15 + play * 8 + accuracy * 8),
    craftsman: round(research * 66 + Math.min(1, m.scanArrests / 2) * 12 + accuracy * 10 + play * 12),
    storyteller: round(narrative * 68 + research * 17 + (m.evidenceBeforeClear ? 8 : 0) + protection * 7),
    mirror: round(collaboration * 66 + nearSquadRatio * 17 + protection * 17),
    player: round(play * 62 + Math.min(1, m.adaptiveOrders / 3) * 18 + momentum * 20),
  };

  const order: PersonaId[] = ['guardian', 'hunter', 'craftsman', 'storyteller', 'mirror', 'player'];
  const ranked = order.sort((a, b) => scores[b] - scores[a]);
  const primary = PERSONAS[ranked[0]];
  const secondary = PERSONAS[ranked[1]];
  const channels = [
    state.threats > 0 || state.shots >= 3,
    state.civilians > 0 || m.guardSeconds >= 8,
    m.intel > 0 || m.reconScans > 0,
    m.orderChanges >= 2 || protocolVariety >= 2,
    state.evidence || state.extracted,
  ];
  const coverage = Math.round(channels.filter(Boolean).length / channels.length * 82 + (state.extracted ? 18 : 0));
  const separation = scores[ranked[0]] - scores[ranked[1]];

  const evidence = [
    state.civilians ? `保护 ${state.civilians}/2 名平民，${state.arrested} 名嫌疑人被约束而非击倒` : '尚未完成平民保护，守护证据仍不足',
    m.reconScans ? `执行 ${m.reconScans} 次扫描，收集 ${m.intel}/3 条线索，形成 ${m.scanArrests} 次验证后约束` : `未使用扫描；${m.firstShotBeforeScan ? '首次接触选择直接开火' : '尚未形成验证链'}`,
    m.burstActivations ? `启动 ${m.burstActivations} 次动能突破，突破中解决 ${m.burstKills} 个威胁` : '未依赖突破窗口，行动节奏相对克制',
    m.orderChanges ? `调整 ${m.orderChanges} 次小队命令，${m.adaptiveOrders} 次发生在接触或受击后` : '小队指令较单一，协同与应变样本较少',
    `虚拟账户平均暴露 ${Math.round(state.market.averageExposure * 100)}%，最大回撤 ${(state.market.maxDrawdown * 100).toFixed(2)}%，调仓 ${state.market.trades} 次`,
    `任务命中率 ${state.shots ? Math.round(accuracy * 100) : 0}%，自身承伤 ${Math.round(m.damageTaken)}，证据覆盖 ${coverage}%`,
  ];

  return { primary, secondary, scores, ranked, dimensions, coverage, separation, evidence, protocolVariety, orderVariety };
}

export type PersonaAnalysis = ReturnType<typeof analyzePersona>;
