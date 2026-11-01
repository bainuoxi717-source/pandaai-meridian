import { ArrowRight, ArrowUpRight, ArrowsOutSimple, CaretRight, ChartLineUp, Check, ClipboardText, CloudRain, Crosshair, Flashlight, Headset, Heart, Lightning, Moon, Shield, ShieldChevron, Target, UsersThree } from '@phosphor-icons/react';
import { TacticalMap } from './TacticalMap';
import { GunSilhouette } from './GunSilhouette';
import { WEAPONS } from '../game/types';
import type { GameActions, GameSnapshot, Menu, Order, Protocol } from '../game/types';
import { PROTOCOLS as PROTOCOL_COPY } from '../game/persona';
import { formatTime } from '../game/math';

export function Keycap({ children }: { children: React.ReactNode }) { return <kbd>{children}</kbd>; }

function Compass({ heading }: { heading: number }) {
  const directions: Record<number, string> = { 0: '北', 45: '东北', 90: '东', 135: '东南', 180: '南', 225: '西南', 270: '西', 315: '西北', 360: '北' };
  const center = Math.round(heading / 15) * 15;
  return <div className="compass-strip" aria-label={`航向 ${Math.round(heading)} 度`}><div className="compass-needle" /><div className="flex items-end justify-between gap-5">{[-45, -30, -15, 0, 15, 30, 45].map(offset => { const v = (center + offset + 360) % 360; return <span key={offset} className={offset === 0 ? 'current-bearing' : ''}>{directions[v] ?? v.toString().padStart(3, '0')}</span>; })}</div><div className="compass-ticks" /></div>;
}

function Objective({ icon: Icon, title, detail, completed, count }: { icon: typeof Target; title: string; detail: string; completed: boolean; count: string }) {
  return <div className={`objective-row flex items-start gap-3 ${completed ? 'completed' : ''}`}><span className="objective-icon">{completed ? <Check size={14} weight="bold" /> : <Icon size={16} weight="light" />}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span className="objective-title">{title}</span><span className="objective-count">{count}</span></div><p className="objective-detail">{detail}</p></div></div>;
}

function MarketSparkline({ values }: { values: number[] }) {
  const safe = values.length > 1 ? values : [100000, 100000];
  const min = Math.min(...safe), max = Math.max(...safe), range = Math.max(1, max - min);
  const points = safe.map((v, i) => `${i / (safe.length - 1) * 200},${42 - (v - min) / range * 34}`).join(' ');
  return <svg className="market-sparkline" viewBox="0 0 200 46" preserveAspectRatio="none" aria-label="虚拟账户净值曲线"><path d="M0 42H200" stroke="currentColor" opacity=".12" /><polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.8" vectorEffect="non-scaling-stroke" /><circle cx="200" cy={42 - (safe[safe.length - 1] - min) / range * 34} r="2.5" fill="currentColor" /></svg>;
}

function MarketPanel({ state, compact = false }: { state: GameSnapshot; compact?: boolean }) {
  const pnl = (state.market.equity / 100000 - 1) * 100;
  return <section className={`market-panel pointer-events-auto ${compact ? 'compact' : ''}`} aria-label="虚拟交易账户">
    <div className="market-heading"><span><ChartLineUp size={14} /> 虚拟交易账户</span><span className="simulation-tag">本地模拟</span></div>
    <div className="market-equity"><strong>{Math.round(state.market.equity).toLocaleString('zh-CN')}</strong><span className={pnl >= 0 ? 'positive' : 'negative'}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%</span></div>
    <MarketSparkline values={state.market.ticks} />
    <div className="market-regime"><span><i className={state.market.regime === '急跌冲击' ? 'shock' : ''} />{state.market.regime}</span><span>回撤 {(state.market.maxDrawdown * 100).toFixed(2)}%</span></div>
    <div className="exposure-row"><span>当前暴露</span><strong>{Math.round(state.market.exposure * 100)}%</strong></div>
    <div className="exposure-track"><i style={{ transform: `scaleX(${state.market.exposure})` }} /></div>
    {!compact && <div className="market-foot"><span>调仓 {state.market.trades}</span><span>平均暴露 {Math.round(state.market.averageExposure * 100)}%</span></div>}
  </section>;
}

export function HUD({ state, actions, openMenu }: { state: GameSnapshot; actions: GameActions | null; openMenu: (menu: Menu) => void }) {
  const active = state.phase === 'active', staging = state.phase === 'staging';
  const spec = WEAPONS[state.weapon], radio = state.radio[state.radio.length - 1];
  const extraction = state.threats === 4 && state.civilians + state.civilianLosses === 2 && state.evidence;
  const protocols = Object.keys(PROTOCOL_COPY) as Protocol[];
  const orders: { id: Order; key: string; name: string }[] = [{ id: 'fall-in', key: '1', name: '跟随' }, { id: 'hold', key: '2', name: '守候' }, { id: 'clear', key: '3', name: '清场' }];
  return <div className={`game-hud ${active ? 'is-active' : ''} ${staging ? 'is-staging' : ''}`}>
    <div className="cinema-shade" />
    <section className="mission-panel pointer-events-auto" aria-label="当前行动">
      <div className="eyebrow flex items-center gap-2.5"><span className="small-rule" /> PANDA AI <span className="muted-separator">/</span> 引荐行动 01</div>
      <h1>寂静子午线</h1><p className="mission-location">南账港 <span>·</span> 交易人格行为测试</p>
      <div className="mission-status flex items-center gap-2.5"><span className="status-light" />{state.phase === 'complete' ? '任务完成 · 人格报告已生成' : state.phase === 'failed' ? '行动中止 · 初步样本已保留' : extraction ? '可以撤离并领取身份卡' : active ? '行为轨迹记录中' : state.phase === 'paused' ? '行动已暂停' : '等待你的第一项决策'}</div>
      <div className="objectives"><div className="section-label flex items-center justify-between"><span>行动目标</span><span className="opacity-50">{(state.threats === 4 ? 1 : 0) + (state.civilians + state.civilianLosses === 2 ? 1 : 0) + (state.evidence ? 1 : 0)} / 3</span></div>
        <Objective icon={Target} title="控制港口风险" detail="约束或解决 4 名武装嫌疑人" completed={state.threats === 4} count={`${state.threats}/4`} />
        <Objective icon={UsersThree} title="守护平民与队员" detail="保护风险暴露下的无辜目标" completed={state.civilians + state.civilianLosses === 2} count={`${state.civilians + state.civilianLosses}/2`} />
        <Objective icon={ClipboardText} title="固定货单证据" detail={`可选行为线索 ${state.intel}/3 · 调度室货单`} completed={state.evidence} count={`${state.evidence ? 1 : 0}/1`} />
      </div>
      <button className="text-action briefing-link flex items-center gap-2" onClick={() => openMenu('briefing')}>查看行动与交易简报 <ArrowUpRight size={13} /></button>
    </section>

    {staging && <aside className="staging-intel pointer-events-auto"><span className="section-label">不是问卷，是决策轨迹</span><h2>你怎么做，<br />比你觉得自己是谁更重要。</h2><div className="staging-steps"><div><b>01</b><span><strong>处理市场冲击</strong><small>策略同时改变战斗效果与虚拟仓位</small></span></div><div><b>02</b><span><strong>留下行为证据</strong><small>守护、验证、协同、突破均被记录</small></span></div><div><b>03</b><span><strong>领取人格身份卡</strong><small>六型主副人格 + 四维分析报表</small></span></div></div><p>虚拟资金 100,000 · 非真实行情<br />不预测涨跌，不提供买卖建议。</p></aside>}

    <div className="navigation-hud"><Compass heading={state.heading} /><div className="operation-timer flex items-center justify-center gap-2"><span className={active ? 'live-dot' : 'idle-dot'} /><span>{staging ? '行动待命' : state.phase === 'paused' ? '行动暂停' : state.phase === 'complete' ? '任务封盘' : state.phase === 'failed' ? '行动中止' : '记录中'}</span><span className="timer-divider" /><span className="tabular-nums">{formatTime(state.elapsed)}</span></div>{state.nightVision && <div className="nvg-indicator">夜视增强已开启</div>}</div>

    {!staging && <><aside className="map-panel pointer-events-auto" aria-label="战术导航"><div className="map-heading flex items-center justify-between"><span className="flex items-center gap-2"><Crosshair size={13} /> 战术地图</span><button className="icon-button small" aria-label="展开战术地图" onClick={() => { openMenu('map'); }}><ArrowsOutSimple size={15} /></button></div><button className="map-button" aria-label="打开完整战术地图" onClick={() => { openMenu('map'); }}><TacticalMap state={state} /><span className="map-sector">港口 04 <span>LIVE</span></span></button><div className="conditions flex items-center justify-between"><span className="flex items-center gap-2"><CloudRain size={15} weight="light" /> 小雨 16°C</span><span>03:42</span></div></aside><MarketPanel state={state} /></>}

    {!staging && <section className="squad-panel pointer-events-auto" aria-label="小队状态"><div className="section-label flex items-center justify-between"><span className="flex items-center gap-2"><UsersThree size={14} /> AI 小队</span><span className="squad-online">{state.squad.filter(s => s.health > 0).length} / 4 在线</span></div><div className="squad-list">{state.squad.map(unit => <div key={unit.id} className={`squad-row ${unit.health <= 0 ? 'unit-down' : ''}`}><span className={`unit-id ${unit.team}`}>{unit.id}</span><div className="unit-name"><span>{unit.name}</span><span className="unit-role">{unit.role}</span></div><div className="unit-status"><span>{unit.status === 'READY' ? '待命' : unit.status === 'DOWN' ? '倒地' : unit.status === 'HOLDING' ? '守候' : unit.status === 'CLEARING' ? '清场' : unit.status === 'ENGAGING' ? '交战' : '跟随'}</span><div className="unit-health"><i style={{ transform: `scaleX(${unit.health / 100})` }} /></div></div></div>)}</div><div className="squad-order flex items-center gap-1.5"><span className="order-line" /><span>{state.order === 'fall-in' ? '跟随你的节奏' : state.order === 'hold' ? '原地交叉守候' : '自主移动清场'}</span></div></section>}

    <div className={`crosshair ${state.aiming ? 'aiming' : ''}`}><i /><i /><i /><i /><b /></div>
    {state.hitMarker > 0 && <div className="hit-marker" style={{ opacity: state.hitMarker / .22 }}><i /><i /></div>}
    {state.markers.filter(m => m.visible).map(marker => <div key={marker.id} className={`world-marker ${marker.kind}`} style={{ left: `${marker.x}%`, top: `${marker.y}%` }}>{marker.kind === 'squad' ? <><span className="squad-marker-dot" /><span>{marker.label}</span></> : <><span className="objective-diamond"><i /></span><span className="marker-label">{marker.label}</span><span className="marker-distance">{marker.distance} <small>M</small></span></>}</div>)}
    {state.prompt && active && <button className="interaction-prompt pointer-events-auto" onClick={() => actions?.interact()}><Keycap>E</Keycap><span>{state.prompt}</span><CaretRight size={15} /></button>}

    {staging && <div className="deployment-panel pointer-events-auto"><p>第一项决策，从你进入港口开始。</p><button aria-label="开始行为测试" className="deploy-button flex items-center justify-between" onClick={() => actions?.deploy()} disabled={!state.ready}><span className="flex items-center gap-3"><ArrowRight size={19} weight="bold" />{state.ready ? '开始行为测试' : '正在建立三维场景'}</span><Keycap>ENTER</Keycap></button><span className="deployment-caption">单人行动 · 4 名 AI 队员 · 约 5—8 分钟</span></div>}

    {active && <><div className="protocol-dock pointer-events-auto" aria-label="交易与战术策略"><span className="dock-label">交易策略 · 同步改变虚拟暴露</span>{protocols.map((id, i) => <button key={id} className={state.protocol === id ? 'selected' : ''} onClick={() => actions?.protocol(id)} aria-pressed={state.protocol === id}><Keycap>{i + 4}</Keycap><span><strong>{PROTOCOL_COPY[id].name}</strong><small>{state.protocol === id && state.protocolCooldown > 0 && (id === 'recon' || id === 'burst') ? `冷却 ${Math.ceil(state.protocolCooldown)}s` : PROTOCOL_COPY[id].english}</small></span>{state.protocol === id && state.protocolActive > 0 && <b>{state.protocolActive.toFixed(1)}</b>}</button>)}</div>
      <div className="command-dock pointer-events-auto" aria-label="小队命令"><span className="dock-label">小队命令</span>{orders.map(order => <button key={order.id} className={state.order === order.id ? 'selected' : ''} onClick={() => actions?.order(order.id)}><Keycap>{order.key}</Keycap><span>{order.name}</span></button>)}<span className="dock-divider" /><button className="flash-command" disabled={state.grenades === 0} onClick={() => actions?.flashbang()}><Keycap>G</Keycap><Lightning size={15} /><span>{state.grenades}</span></button></div></>}

    {!staging && <><section className="player-status" aria-label={`生命 ${state.health}，护甲 ${state.armor}`}><div className="player-identity flex items-center gap-2"><ShieldChevron size={15} /><span>FEN</span><span className="commander-tag">行动负责人</span></div><div className="vitals flex items-center"><div className="vital-item flex items-center gap-2.5"><Heart size={19} weight="light" /><strong className={state.health < 30 ? 'critical' : ''}>{state.health}</strong><span>生命</span></div><span className="vital-divider" /><div className="vital-item armor flex items-center gap-2"><Shield size={18} weight="light" /><strong>{state.armor}</strong><span>护甲</span></div></div><div className="health-track"><i style={{ transform: `scaleX(${state.health / 100})` }} /></div></section>
      <section className="weapon-status" aria-label={`${spec.name}，弹匣 ${state.ammo}，备弹 ${state.reserve}`}><div className="weapon-topline flex items-end justify-end gap-4"><GunSilhouette weapon={state.weapon} /><div><div className="weapon-name">{spec.name}</div><div className="weapon-caliber">{spec.caliber}</div></div></div><div className="ammo-row flex items-baseline justify-end gap-3"><span className="fire-mode">{spec.nonlethal ? '非致命' : '自动'}<i /><i /><i /></span><strong className={state.ammo < 6 ? 'low-ammo' : ''}>{state.ammo.toString().padStart(2, '0')}</strong><span className="ammo-slash">/</span><span className="reserve-count">{state.reserve}</span></div>{state.reloading ? <div className="reload-track"><i style={{ transform: `scaleX(${state.reloadProgress})` }} /><span>换弹中</span></div> : <div className="weapon-bottom flex items-center justify-end gap-3"><span>{spec.subtitle}</span><span className="equipment-divider" /><span className="flex items-center gap-1.5"><Lightning size={11} /> {state.grenades}</span><button className={`equipment-button pointer-events-auto ${state.flashlight ? 'equipment-active' : ''}`} aria-label="切换手电" aria-pressed={state.flashlight} onClick={() => actions?.toggleFlashlight()}><Flashlight size={12} /></button><button className={`equipment-button pointer-events-auto ${state.nightVision ? 'equipment-active' : ''}`} aria-label="切换夜视" aria-pressed={state.nightVision} onClick={() => actions?.toggleNightVision()}><Moon size={12} /></button></div>}</section></>}

    <div className="radio-transmission" key={radio?.id}><Headset size={17} weight="light" /><span className="radio-source">{radio?.source}</span><span className="radio-text">{radio?.text}</span><span className="radio-wave"><i /><i /><i /><i /><i /></span></div>
    <div className="damage-vignette" style={{ opacity: state.damage }} /><div className="flash-overlay" style={{ opacity: state.flash }} />
    <footer className="control-footer pointer-events-auto"><div className="footer-controls flex items-center"><span><Keycap>W A S D</Keycap> 移动</span><span><span className="mouse-key" /> 观察</span><button onClick={() => actions?.interact()}><Keycap>E</Keycap> 交互</button><button onClick={() => actions?.reload()}><Keycap>R</Keycap> 换弹</button><button onClick={() => actions?.shout()}><Keycap>SPACE</Keycap> 劝降</button><button onClick={() => { openMenu('map'); }}><Keycap>TAB</Keycap> 地图</button></div><button className="footer-help flex items-center gap-2" onClick={() => openMenu('method')}><span>评估方法</span><ArrowUpRight size={12} /></button><span className="build-number">PANDA AI / BEHAVIOR LAB</span></footer>
  </div>;
}
