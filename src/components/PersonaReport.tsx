import { ChartPieSlice, DownloadSimple, Fingerprint, ShieldCheck } from '@phosphor-icons/react';
import { analyzePersona, PERSONAS } from '../game/persona';
import type { GameSnapshot, PersonaId } from '../game/types';
import { PandaMark } from './PandaMark';

const dimensionNames = { risk: '风险意识', validation: '证据验证', tempo: '决策节奏', iteration: '协同迭代' } as const;

function DimensionRadar({ values }: { values: Record<keyof typeof dimensionNames, number> }) {
  const keys = Object.keys(dimensionNames) as (keyof typeof dimensionNames)[];
  const center = { x: 140, y: 116 }, radius = 76;
  const point = (index: number, scale = 1) => {
    const angle = -Math.PI / 2 + index * Math.PI / 2;
    return { x: center.x + Math.cos(angle) * radius * scale, y: center.y + Math.sin(angle) * radius * scale };
  };
  const polygon = keys.map((key, i) => { const p = point(i, Math.max(.06, values[key] / 100)); return `${p.x},${p.y}`; }).join(' ');
  return <svg className="dimension-radar" viewBox="0 0 280 235" role="img" aria-label="四维交易人格雷达图">
    {[1, .66, .33].map(scale => <polygon key={scale} points={keys.map((_, i) => { const p = point(i, scale); return `${p.x},${p.y}`; }).join(' ')} fill="none" stroke="currentColor" opacity=".16" />)}
    {keys.map((key, i) => { const p = point(i); return <line key={key} x1={center.x} y1={center.y} x2={p.x} y2={p.y} stroke="currentColor" opacity=".13" />; })}
    <polygon points={polygon} fill="#75c9b5" fillOpacity=".2" stroke="#8ad8c3" strokeWidth="2" />
    {keys.map((key, i) => { const p = point(i, Math.max(.06, values[key] / 100)); return <circle key={key} cx={p.x} cy={p.y} r="3" fill="#b4eadb" />; })}
    <text x="140" y="18" textAnchor="middle">风险意识 {values.risk}</text><text x="268" y="120" textAnchor="end">证据验证 {values.validation}</text><text x="140" y="222" textAnchor="middle">决策节奏 {values.tempo}</text><text x="12" y="120">协同迭代 {values.iteration}</text>
  </svg>;
}

function identityNumber(state: GameSnapshot) {
  const source = `${Math.round(state.elapsed)}|${state.shots}|${state.hits}|${state.market.trades}|${state.metrics.intel}|${Math.round(state.market.equity)}`;
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) { hash ^= source.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return `PA-${(hash >>> 0).toString(36).toUpperCase().padStart(7, '0').slice(0, 7)}`;
}

function exportIdentity(state: GameSnapshot) {
  const analysis = analyzePersona(state), p = analysis.primary;
  const esc = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!);
  const id = identityNumber(state), pnl = (state.market.equity / 100000 - 1) * 100;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" viewBox="0 0 1200 700"><rect width="1200" height="700" fill="#101c24"/><rect x="34" y="34" width="1132" height="632" rx="8" fill="#162831" stroke="${p.color}" stroke-width="2"/><path d="M34 34H1166V52H34Z" fill="${p.color}"/><circle cx="1020" cy="190" r="145" fill="${p.color}" opacity=".06"/><circle cx="1020" cy="190" r="104" fill="none" stroke="${p.color}" opacity=".22"/><text x="84" y="116" fill="#ecf3f1" font-size="34" font-family="'Noto Sans CJK SC','Microsoft YaHei','PingFang SC',sans-serif" font-weight="700">pandaAI</text><text x="84" y="151" fill="#8da4aa" font-size="17" font-family="'Noto Sans CJK SC','Microsoft YaHei','PingFang SC',sans-serif" letter-spacing="4">交易人格身份证 / TRADING PERSONA ID</text><text x="84" y="266" fill="${p.color}" font-size="72" font-family="'Noto Sans CJK SC','Microsoft YaHei','PingFang SC',sans-serif" font-weight="700">${esc(p.name)}</text><text x="88" y="310" fill="#9db1b6" font-size="19" font-family="'Noto Sans CJK SC','Microsoft YaHei','PingFang SC',sans-serif" letter-spacing="3">${esc(p.code)}</text><text x="84" y="375" fill="#edf3f1" font-size="28" font-family="'Noto Sans CJK SC','Microsoft YaHei','PingFang SC',sans-serif">${esc(p.short)}</text><text x="84" y="434" fill="#8da4aa" font-size="19" font-family="'Noto Sans CJK SC','Microsoft YaHei','PingFang SC',sans-serif">副型 ${esc(analysis.secondary.name)}  ·  证据覆盖 ${analysis.coverage}%  ·  虚拟收益 ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}%</text><text x="84" y="520" fill="#eaf2ef" font-size="24" font-family="monospace">${id}</text><text x="84" y="560" fill="#738b92" font-size="16" font-family="'Noto Sans CJK SC','Microsoft YaHei','PingFang SC',sans-serif">寂静子午线 · 本地行为模拟 · 非真实交易业绩</text><text x="84" y="620" fill="#738b92" font-size="15" font-family="'Noto Sans CJK SC','Microsoft YaHei','PingFang SC',sans-serif">此结果用于理解决策偏好，不构成心理诊断或投资建议。</text><text x="1030" y="585" fill="${p.color}" font-size="100" text-anchor="middle" font-family="'Noto Sans CJK SC','Microsoft YaHei','PingFang SC',sans-serif" opacity=".75">熊</text></svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = `PandaAI-${p.name}-交易人格身份证.svg`; anchor.style.display = 'none';
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function PersonaReport({ state }: { state: GameSnapshot }) {
  const analysis = analyzePersona(state), primary = analysis.primary;
  const pnl = (state.market.equity / 100000 - 1) * 100;
  const accuracy = state.shots ? Math.round(state.hits / state.shots * 100) : 0;
  return <div className="persona-report" style={{ '--persona': primary.color } as React.CSSProperties}>
    <section className="identity-card">
      <div className="identity-watermark"><PandaMark size={250} /></div>
      <header><div className="identity-brand"><PandaMark size={34} /><strong>pandaAI</strong></div><span>交易人格身份证</span><small>TRADING PERSONA ID</small></header>
      <div className="identity-main"><div><div className="eyebrow">{state.extracted ? '行动完成 · 行为样本已封存' : '行动中止 · 初步行为样本'}</div><h2>{primary.name}</h2><p className="identity-code">{primary.code}</p><blockquote>{primary.short}</blockquote></div><div className="identity-seal"><Fingerprint size={42} weight="light" /><span>{analysis.coverage}%</span><small>证据覆盖</small></div></div>
      <div className="identity-bottom"><span><small>身份编号</small><strong>{identityNumber(state)}</strong></span><span><small>副型倾向</small><strong>{analysis.secondary.name}</strong></span><span><small>虚拟账户</small><strong className={pnl >= 0 ? 'positive' : 'negative'}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%</strong></span></div>
    </section>

    <div className="report-heading"><div><span className="eyebrow">BEHAVIOR & VIRTUAL ACCOUNT REPORT</span><h3>对应分析报表</h3></div><button className="secondary-button export-identity" onClick={() => exportIdentity(state)}><DownloadSimple size={17} /> 导出身份卡</button></div>
    <section className="report-overview"><div className="persona-narrative"><span className="section-label">为什么是这个类型</span><p>{primary.description}</p><div className="type-pair"><span>主型 <strong>{primary.name}</strong></span><span>副型 <strong>{analysis.secondary.name}</strong></span>{analysis.separation < 5 && <small>两者得分接近，建议再完成一局观察稳定性。</small>}</div></div><DimensionRadar values={analysis.dimensions} /></section>

    <section className="account-report"><div className="account-item"><span>虚拟净值</span><strong>{Math.round(state.market.equity).toLocaleString('zh-CN')}</strong><small>初始 100,000</small></div><div className="account-item"><span>最大回撤</span><strong>{(state.market.maxDrawdown * 100).toFixed(2)}%</strong><small>按虚拟净值峰值计算</small></div><div className="account-item"><span>平均暴露</span><strong>{Math.round(state.market.averageExposure * 100)}%</strong><small>调仓 {state.market.trades} 次</small></div><div className="account-item"><span>射击命中率</span><strong>{accuracy}%</strong><small>{state.shots} 次射击 · {state.arrested} 次约束</small></div></section>

    <div className="report-columns"><section className="evidence-report"><span className="section-label"><ChartPieSlice size={14} /> 关键行为证据</span><ol>{analysis.evidence.map((item, index) => <li key={item}><b>{String(index + 1).padStart(2, '0')}</b><span>{item}</span></li>)}</ol><div className="coverage-note"><ShieldCheck size={18} /><p>证据覆盖度 {analysis.coverage}%：由战斗、守护、研究、策略切换、任务闭环五类独立样本计算，不等同于心理测量信度。</p></div></section><section className="score-report"><span className="section-label">六型行为得分</span>{analysis.ranked.map((id: PersonaId) => <div className="persona-score" key={id}><span>{PERSONAS[id].name}</span><div><i style={{ transform: `scaleX(${analysis.scores[id] / 100})`, background: PERSONAS[id].color }} /></div><strong>{analysis.scores[id]}</strong></div>)}</section></div>

    <section className="development-report"><div><span className="section-label">你的优势</span><p>{primary.strength}</p></div><div><span className="section-label">需要留意的盲区</span><p>{primary.blindspot}</p></div><div className="next-exercise"><span className="section-label">本周一件事 · 弱项补丁</span><p>{primary.exercise}</p></div></section>
    <p className="report-disclaimer">本报告基于本地虚拟任务中的策略与账户行为，用于研究和学习反馈；不是临床心理量表，不预测真实交易收益，不构成任何投资建议。任务记录仅保存在此浏览器，不会跨设备同步。</p>
  </div>;
}
