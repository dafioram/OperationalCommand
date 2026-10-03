'use strict';
/* Operational Command: UI. Renders state from js/game.js and handles input. */
(() => {
  const $app = document.getElementById('app');
  const KEY_NEW = 'operational-command-v5', OLD_KEYS = ['operational-command-proto-v4', 'operational-command-proto-v3'];
  let S = null;
  let saves = [];
  const freshUi = () => ({ tab: 'debrief', open: null, plan: null, confirm: false, savesOpen: false, confirmNew: false, openReports: {}, picking: false });
  let ui = freshUi();
  const DIFF_ORDER = ['easy', 'medium', 'hard'];

  const esc = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = x => String(Math.round(x * 10) / 10);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const BAND_CLS = { Favorable: 'b-fav', Even: 'b-even', Risky: 'b-risky', Desperate: 'b-desp' };
  const BAND_IDX = { Desperate: 0, Risky: 1, Even: 2, Favorable: 3 };
  const whenText = n => n === 1 ? 'Tonight' : n === 2 ? 'Tomorrow night' : `In ${n} nights`;
  const size = m => OC.sizeOf(m, S);

  // Resource icons: wood logs (Materials), beaker (Tech), camera (Intel), shield (Base)
  const svg = (k, label, body) => `<svg class="ico ico-${k}" viewBox="0 0 16 16" role="img" aria-label="${label}"><title>${label}</title>${body}</svg>`;
  const ICON = {
    materials: svg('materials', 'Materials', '<g fill="currentColor" fill-opacity=".18" stroke="currentColor" stroke-width="1.3"><circle cx="4.4" cy="11.3" r="3"/><circle cx="11.6" cy="11.3" r="3"/><circle cx="8" cy="5" r="3"/></g><g fill="none" stroke="currentColor" stroke-width="1"><circle cx="4.4" cy="11.3" r="1.2"/><circle cx="11.6" cy="11.3" r="1.2"/><circle cx="8" cy="5" r="1.2"/></g>'),
    tech: svg('tech', 'Tech', '<path d="M4.5 10h7l1.5 2.6c.5.9-.1 1.9-1.1 1.9H4.1c-1 0-1.6-1-1.1-1.9z" fill="currentColor" fill-opacity=".35"/><path d="M5.8 1.8h4.4M6.8 1.8v4.3L3 12.6c-.5.9.1 1.9 1.1 1.9h7.8c1 0 1.6-1 1.1-1.9L9.2 6.1V1.8" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round"/>'),
    intel: svg('intel', 'Intel', '<path d="M2.4 5h2.3l1.2-1.8h4.2l1.2 1.8h2.3c.6 0 1 .4 1 1v6.4c0 .6-.4 1-1 1H2.4c-.6 0-1-.4-1-1V6c0-.6.4-1 1-1z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><circle cx="8" cy="9.1" r="2.4" fill="currentColor" fill-opacity=".18" stroke="currentColor" stroke-width="1.3"/>'),
    base: svg('base', 'Base integrity', '<path d="M8 1.8l5 1.9v4c0 3.2-2.1 5.6-5 6.6-2.9-1-5-3.4-5-6.6v-4z" fill="currentColor" fill-opacity=".18" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>')
  };
  const cost = (k, n) => `<span class="cost">${ICON[k]}${n}</span>`;
  const iconize = html => html.replace(/([+−-]?\d+) (Materials|Tech|Intel)\b/g, (_, n, k) => cost(k.toLowerCase(), n));

  function persist() {
    try { localStorage.setItem(KEY_NEW, JSON.stringify({ state: S, saves })); } catch (e) { /* storage blocked: keep playing in memory */ }
  }
  const upgrade = st => OC.migrate(st);
  function loadPersisted() {
    for (const key of [KEY_NEW].concat(OLD_KEYS)) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const d = JSON.parse(raw);
        if (d && d.state && d.state.v >= 3 && Array.isArray(d.saves)) {
          d.state = upgrade(d.state);
          d.saves = d.saves.map(sv => ({ day: sv.day, json: JSON.stringify(upgrade(JSON.parse(sv.json))) }));
          return d;
        }
      } catch (e) { /* ignore unreadable saves */ }
    }
    return null;
  }
  function freshCampaign(diff) {
    S = OC.newGame((Date.now() ^ Math.floor(Math.random() * 1e9)) | 0, diff);
    saves = [{ day: 1, json: JSON.stringify(S) }];
    ui = freshUi();
  }

  function picker() {
    const cards = DIFF_ORDER.map((k, i) => {
      const d = OC.DIFFS[k];
      let meter = '';
      for (let j = 0; j < 3; j++) meter += `<i class="${j <= i ? 'on' : ''}"></i>`;
      return `<button class="diff" data-act="pickdiff" data-d="${k}">
        <span class="diff-top"><span class="diff-name">${d.label}</span>${k === 'medium' ? '<span class="diff-tag">Standard</span>' : `<span class="skull" aria-hidden="true">${meter}</span>`}</span>
        <span>${esc(d.blurb)}</span>
        <span class="diff-rules">${d.rules.map(r => `<span>${esc(r)}</span>`).join('')}</span>
      </button>`;
    }).join('');
    return `<main class="stack">
      <section class="pick-head">
        <div class="eyebrow">Operational Command · Prototype</div>
        <h1 class="pick-title">New campaign</h1>
        <p class="muted">Pacify Sector 1 by taking all five of its outposts, and keep your base standing. You’ll find three in the first ten days; the enemy builds two more later. There’s no day limit, but the enemy grows stronger the longer you take. Choose a difficulty; it stays fixed for the whole campaign.</p>
      </section>
      <div class="diffs">${cards}</div>
      ${S ? '<div class="btnrow"><button class="btn ghost" data-act="cancelpick">Back to current campaign</button></div>' : ''}
    </main>`;
  }

  function pips(n) {
    let h = '<span class="pips" aria-hidden="true">';
    for (let i = 0; i < 5; i++) h += `<i class="pip${i < n ? ' on' : ''}"></i>`;
    return h + '</span>';
  }
  const recText = R => `${esc(R.name)} (Level ${R.level}${R.cls ? ' ' + R.cls : ''})`;
  function rewardHtml(m) {
    switch (m.type) {
      case 'Scout': {
        const extra = m.flag && !S.flags[m.flag] ? (m.flag === 'scouted' ? ' Watches the western roads: raid warnings and sightings in Zones 1–4.' : ' Watches the eastern road: sightings in Zones 5–6.') : '';
        return cost('intel', '+' + m.reward.intel) + esc(extra);
      }
      case 'Resource': return Object.keys(m.reward).map(k => cost(k, '+' + m.reward[k])).join(' ');
      case 'Rescue': return m.reward.recruits.map(recText).join(' and ') + (m.reward.recruits.length > 1 ? ' join' : ' joins') + ' your roster.';
      case 'Extraction': return m.reward.recruits ? `${recText(m.reward.recruits[0])}, a veteran specialist, joins your roster. Double XP.` : `${cost('tech', '+' + m.reward.tech)}. Double XP.`;
      case 'Recovery': return 'Your missing troop comes home.';
      case 'Sabotage': {
        const t = S.missions.find(x => x.id === m.target);
        return t && t.type === 'Siege' ? `${esc(t.name)} loses 1 Fort Point and can’t rebuild for 3 days.` : 'The army loses 2 days on its march.';
      }
      case 'Hold': return `Keep ${esc(m.def.name)}. ${cost('materials', '+' + m.reward.materials)} and the War Clock drops 3 on a win.`;
      case 'Siege': return `${cost('tech', '+' + m.reward.techPerPoint)} per Fort Point. ${cost('materials', '+' + m.reward.materials)} when it falls, and its raids stop.`;
      case 'Intercept': return `${cost('materials', '+' + m.reward.materials)} ${cost('tech', '+' + m.reward.tech)}${m.reward.recruits ? ' and a freed prisoner' : ''} when destroyed. The War Clock drops 8.`;
      default: return '';
    }
  }
  function alertLine(m) {
    if (!OC.D(S).reinforce || !m.zone) return '';
    const a = OC.alertOf(S, m.zone);
    let p = '';
    for (let i = 1; i <= 3; i++) p += `<i class="${i <= a ? 'on' : ''}"></i>`;
    return `<div class="alert-line a${a}"><span class="apips" aria-hidden="true">${p}</span><span>Zone alert: <b>${OC.ALERT_NAMES[a]}</b> · ${Math.round(OC.reinfChance(S, m.zone) * 100)}% reinforcements</span></div>`;
  }
  function progress(m) {
    let cur, max, label;
    if (m.type === 'Siege') { cur = m.fort; max = m.fortMax; label = 'Fort Points'; }
    else if (m.type === 'Intercept') { cur = m.army; max = m.armyMax; label = 'Army Strength'; }
    else return '';
    let bars = '';
    for (let i = 0; i < max; i++) bars += `<i class="${i < cur ? '' : 'gone'}"></i>`;
    return `<div class="prog"><span class="muted">${label} ${cur}/${max}</span><div class="prog-bar" aria-hidden="true">${bars}</div></div>`;
  }
  function oddsBlock(m, ids, stance) {
    const p = OC.power(S, ids, stance, m);
    if (!p) return `<div class="odds"><span class="muted">Pick at least one troop to see the odds.</span></div>`;
    const ch = OC.chance(p.total, m.threat);
    const b = OC.band(ch);
    const revealed = !!S.r.fi || !!S.revealed[m.id];
    let meter = '';
    for (let i = 0; i < 4; i++) meter += `<i class="${i <= BAND_IDX[b] ? 'on' : ''}"></i>`;
    const parts = [`avg Level ${fmt(p.avg)}`];
    if (p.st) parts.push(`${p.st > 0 ? '+' : '−'}${Math.abs(p.st)} stance`);
    if (p.assault) parts.push(`+${p.assault} Assault`);
    if (p.eng) parts.push('+1 Engineer');
    if (p.fwd) parts.push('+1 forward base');
    if (p.amb) parts.push('+2 ambush');
    if (p.gap) parts.push(`−${p.gap} short-handed`);
    const breakdown = revealed
      ? `<div class="breakdown">Power ${fmt(p.total)} (${parts.join(', ')}) vs Threat ${m.threat}</div>`
      : `<div class="btnrow"><button class="btn small" data-act="reveal" data-m="${m.id}" ${S.intel < OC.REVEAL_COST ? 'disabled' : ''}>Reveal exact odds · ${cost('intel', OC.REVEAL_COST)}</button><span class="small muted" style="align-self:center">You have ${cost('intel', S.intel)}</span></div>`;
    const rc = Math.round(OC.reinfChance(S, m.zone) * 100), am = Math.round(OC.compChance(S) * 100);
    const legs = m.type === 'Extraction' ? ' Rolled twice: once going in, once coming out.' : '';
    return `<div class="odds">
      <span class="label" style="margin:0">Odds</span>
      <div class="odds-top">
        <span class="band ${BAND_CLS[b]}">${b}${revealed ? `<span class="pct">${ch}%</span>` : ''}</span>
        <span class="meter ${BAND_CLS[b]}" aria-hidden="true">${meter}</span>
      </div>
      ${breakdown}
      <div class="small muted">${rc ? `${rc}% chance of enemy reinforcements here, otherwise ${am}% chance of an ambush.` : `${am}% chance of an ambush.`}${legs}${!['Scout', 'Sabotage'].includes(m.type) && OC.D(S).reinforce ? ' Launching this mission raises the zone’s alert.' : ''}${p.gap ? ` The squad is ${plural(p.gap, 'troop', 'troops')} short: −${p.gap} power.` : ''}</div>
    </div>`;
  }
  const effLevel = t => t.level + (t.gear === 'rifle' ? 1 : 0);
  const bestAvailable = n => S.troops.filter(t => !OC.availability(S, t)).sort((a, b) => effLevel(b) - effLevel(a) || b.xp - a.xp).slice(0, n).map(t => t.id);
  function planner(m) {
    const plan = ui.plan;
    const sz = size(m);
    plan.ids = plan.ids.filter(id => { const t = OC.byId(S, id); return t && !OC.availability(S, t); }).slice(0, sz);
    const chips = S.troops.filter(OC.living).map(t => {
      const why = OC.availability(S, t);
      const on = plan.ids.includes(t.id);
      const full = !on && plan.ids.length >= sz;
      return `<button class="tchip" data-act="troop" data-t="${t.id}" aria-pressed="${on}" ${why || full ? 'disabled' : ''}>
        <b>${esc(t.name)}</b><small>Level ${t.level}${t.cls ? ' · ' + t.cls : ''}${t.gear ? ' · ' + (t.gear === 'rifle' ? 'Rifle' : 'Armor') : ''}${why ? ' · ' + why : ''}</small></button>`;
    }).join('');
    const st = OC.STANCES[plan.stance];
    const free = OC.slotsFree(S);
    return `<div class="planner">
      <div>
        <div class="squadline"><span class="label" style="margin:0">Squad · ${plan.ids.length} of ${sz}</span>
          <button class="btn small ghost" data-act="best">Best available</button></div>
        <div class="troops">${chips}</div>
      </div>
      <div>
        <span class="label">Stance</span>
        <div class="seg" role="group" aria-label="Stance">
          ${Object.keys(OC.STANCES).map(k => `<button data-act="stance" data-s="${k}" aria-pressed="${plan.stance === k}">${OC.STANCES[k].label}</button>`).join('')}
        </div>
        <p class="seg-note">${st.note}</p>
      </div>
      ${oddsBlock(m, plan.ids, plan.stance)}
      <div class="btnrow">
        <button class="btn primary" data-act="deploy" data-m="${m.id}" ${!plan.ids.length || free <= 0 ? 'disabled' : ''}>${free <= 0 ? 'No free mission slot' : m.days > 1 ? `Deploy for ${m.days} days` : 'Deploy squad'}</button>
        <button class="btn ghost" data-act="close">Cancel</button>
      </div>
    </div>`;
  }
  // Artillery and comms jamming controls on outpost and army cards (only once researched).
  function supportBlock(m) {
    if (S.phase !== 'play' || !['Siege', 'Intercept'].includes(m.type)) return '';
    const rows = [];
    if (S.r.art) {
      const planned = S.fires.find(f => f.missionId === m.id);
      if (planned) {
        rows.push(`<div class="support-row"><span><b>Fire mission planned</b> · ${OC.fireChance(S, m, planned.intel)}% to hit · ${OC.fireDamage(S)} damage</span><button class="btn small ghost" data-act="unfire" data-m="${m.id}">Cancel</button></div>`);
      } else if (!OC.inRange(S, m)) {
        rows.push(`<div class="support-row"><span class="muted">Out of artillery range. The battery reaches Zones 1–3${S.fwd ? ` and the zones next to your forward base` : ', or further with a forward base'}.</span></div>`);
      } else {
        const free = OC.slotsFree(S);
        const btns = [0, 1, 2].map(i => `<button class="btn small" data-act="fire" data-m="${m.id}" data-i="${i}" ${free <= 0 || S.materials < OC.FIRE_COST || S.intel < i ? 'disabled' : ''}>${OC.fireChance(S, m, i)}% · ${cost('materials', OC.FIRE_COST)}${i ? ' ' + cost('intel', i) : ''}</button>`).join('');
        rows.push(`<div class="support-row"><span><b>Artillery</b> · ${OC.fireDamage(S)} damage on a hit. Uses a mission slot, no troops.${free <= 0 ? ' No free slot.' : ''}</span><div class="btnrow">${btns}</div></div>`);
      }
    }
    if (S.r.jam && m.type === 'Intercept' && OC.D(S).moving) {
      if (m.frozenDay === S.day) rows.push('<div class="support-row"><span><b>Jammed</b> · it won’t move tonight.</span></div>');
      else if (S.day < S.jamReady) rows.push(`<div class="support-row"><span class="muted">Comms jamming recharges on Day ${S.jamReady}.</span></div>`);
      else rows.push(`<div class="support-row"><span><b>Comms jamming</b> · freeze it in place tonight.</span><button class="btn small" data-act="jam" data-m="${m.id}" ${S.intel < OC.JAM_COST ? 'disabled' : ''}>Jam · ${cost('intel', OC.JAM_COST)}</button></div>`);
    }
    return rows.length ? `<div class="support">${rows.join('')}</div>` : '';
  }
  function missionCard(m) {
    const dep = S.deployments.find(d => d.missionId === m.id);
    const free = OC.slotsFree(S);
    let foot;
    if (dep) {
      const p = OC.power(S, dep.squad, dep.stance, m);
      const ch = OC.chance(p.total, m.threat);
      const b = OC.band(ch);
      const who = dep.squad.map(id => OC.byId(S, id).name).join(', ');
      const shown = S.r.fi || S.revealed[m.id];
      const out = dep.startDay < S.day;
      foot = `<div class="deployed"><p><b>${out ? 'In the field' : 'Deployed'}:</b> ${esc(who)}<br><span class="small">${OC.STANCES[dep.stance].label} · <span class="${BAND_CLS[b]}">${b}${shown ? ' ' + ch + '%' : ''}</span>${dep.daysLeft > 1 || out ? ` · returns end of Day ${S.day + dep.daysLeft - 1}` : ''}</span></p>
        ${out ? '' : `<button class="btn small" data-act="recall" data-m="${m.id}">Recall</button>`}</div>`;
    } else if (ui.open === m.id) {
      foot = planner(m);
    } else {
      foot = `<div class="m-actions"><button class="btn" data-act="plan" data-m="${m.id}" ${free <= 0 ? 'disabled' : ''}>${free <= 0 ? 'Mission slots full' : 'Plan mission'}</button></div>`;
    }
    let extra = '';
    if (m.type === 'Intercept') {
      const t = OC.threats(S).find(x => x.id === m.id);
      extra = t ? `<span>Reaches your base: <b>${whenText(t.nights)}</b></span>` : '<span>Holding position</span>';
    }
    if (m.type === 'Siege' && m.raidEvery) extra = `<span>Raids every <b>${m.raidEvery} days</b></span>${m.noRebuild && m.noRebuild > S.day ? `<span>Sabotaged: no rebuilding until <b>Day ${m.noRebuild}</b></span>` : ''}`;
    if (m.days > 1) extra += `<span>Takes <b>${m.days} days</b></span>`;
    if (m.type === 'Hold') extra += '<span><b>Today only</b></span>';
    if (m.type === 'Sabotage') extra += '<span>No zone alert</span>';
    if (m.ambush && S.day <= m.ambushUntil) extra += `<span>Ambush ready: <b>+2 power</b> through Day ${m.ambushUntil}</span>`;
    const trait = m.type === 'Siege' && OC.TRAITS[m.trait] ? `<div class="trait"><b>${OC.TRAITS[m.trait].label}</b>${esc(OC.TRAITS[m.trait].effect)}</div>` : '';
    return `<article class="card" id="m-${m.id}">
      <div class="m-head"><span class="type-tag">${m.type}${m.chain ? '<span class="chain-tag">Follow-up</span>' : ''}</span><span class="threat">Threat ${m.threat} ${pips(m.threat)}</span></div>
      <h3 class="m-name">${esc(m.name)}</h3>
      <div class="m-where">${esc(m.where)}</div>
      <div class="m-meta"><span>Squad of <b>${size(m)}</b></span>${m.until && m.type !== 'Hold' ? `<span>Open through <b>Day ${m.until}</b></span>` : ''}${extra}</div>
      ${alertLine(m)}
      ${trait}
      <p class="m-desc">${esc(m.desc)}</p>
      ${progress(m)}
      <p class="m-reward"><b>Reward</b>${rewardHtml(m)}</p>
      ${supportBlock(m)}
      ${foot}
    </article>`;
  }

  function header() {
    const n = S.debrief.filter(e => e.kind !== 'note').length;
    const dayLabel = S.phase === 'play' ? `Day ${S.day}` : S.phase === 'won' ? 'Victory' : 'Defeat';
    const st = OC.stage(S);
    const dayOf = S.phase === 'play'
      ? `<span class="clockline s${st}">War Clock <b>Stage ${st}</b> · Outposts <b>${S.taken}/${OC.OUTPOSTS}</b></span>`
      : `<span class="dayof">after Day ${S.day - 1}</span>`;
    const tonight = OC.threats(S).filter(t => t.nights === 1).length;
    const tab = (id, label, extra, alarm) => `<button class="tab" role="tab" data-act="tab" data-tab="${id}" aria-selected="${ui.tab === id}">${label}${extra ? `<span class="n${alarm ? ' alarm' : ''}">${extra}</span>` : ''}</button>`;
    return `<header class="top">
      <div class="brandrow">
        <div>
          <div class="eyebrow">Operational Command · ${OC.D(S).label} <button class="linkbtn" data-act="saves">${ui.savesOpen ? 'Close saves' : 'Saves'}</button></div>
          <div class="dayline"><span class="dayno">${dayLabel}</span>${dayOf}</div>
        </div>
        <div class="res">
          <div><b>${ICON.materials}${S.materials}</b><span>Materials</span></div>
          <div><b>${ICON.tech}${S.tech}</b><span>Tech</span></div>
          <div><b>${ICON.intel}${S.intel}</b><span>Intel</span></div>
          <div><b>${ICON.base}${S.integrity}</b><span>Base</span></div>
        </div>
      </div>
      <nav class="tabs" role="tablist">
        ${tab('debrief', 'Debrief', n ? String(n) : '')}
        ${tab('deploy', 'Deploy', S.phase === 'play' ? `${OC.slotsUsed(S)}/${OC.slots(S)}` : '')}
        ${tab('base', 'Base', tonight ? '!' : '', true)}
        ${tab('roster', 'Roster', String(S.troops.filter(OC.living).length))}
      </nav>
    </header>`;
  }
  function savesPanel() {
    if (!ui.savesOpen) return '';
    const rows = saves.map((sv, i) => `<div class="note"><span class="dot"></span><div class="squadline" style="margin:0"><span>Start of Day ${sv.day}</span><button class="btn small" data-act="restore" data-i="${i}">Restore</button></div></div>`).reverse().join('');
    const newBlock = ui.confirmNew
      ? `<p class="small" style="margin-top:12px">Start a new campaign? Both autosaves are cleared.</p><div class="btnrow" style="margin-top:8px"><button class="btn small primary" data-act="newgame">Start over</button><button class="btn small ghost" data-act="cancelnew">Cancel</button></div>`
      : `<div class="btnrow" style="margin-top:12px"><button class="btn small ghost" data-act="asknew">New campaign</button></div>`;
    return `<section class="card">
      <h2>Autosaves</h2>
      <p class="small muted">Saved at the start of each day; the last 2 are kept. A restore replays the same dice, so only different orders change the outcome.</p>
      <div class="notes" style="margin-top:10px">${rows}</div>
      ${newBlock}
    </section>`;
  }
  function reportCard(r, i) {
    const tone = r.tone === 'good' ? 'o-good' : r.tone === 'warn' ? 'o-warn' : 'o-bad';
    const counts = {};
    r.injuries.forEach(x => { counts[x.status] = (counts[x.status] || 0) + 1; });
    const inj = Object.keys(counts).map(k => `${counts[k]} ${OC.STATUS_LABEL[k].toLowerCase()}`).join(', ');
    const parts = [inj || 'No casualties'];
    if (r.rewards.length) parts.push(r.rewards.join(', '));
    if (r.levelups.length) parts.push(plural(r.levelups.length, 'level up', 'level ups'));
    const who = r.squad.length ? r.squad.join(', ') : (r.stance === 'Forward base' || r.stance === 'Artillery' ? r.stance : 'No guard posted');
    const lines = r.log.map(([t, text, hl]) => `<li><time>${t}</time><span${hl ? ' class="hl"' : ''}>${iconize(esc(text))}</span></li>`).join('')
      + r.levelups.map(l => `<li><time>1900</time><span>${esc(l)}</span></li>`).join('');
    return `<details class="report" data-r="${i}" ${ui.openReports[i] ? 'open' : ''}>
      <summary>
        <div class="r-top"><span class="opill ${tone}">${r.outcome}</span><span class="r-title">${esc(r.kind === 'raid' ? 'Raid: ' + r.name : r.name)}</span></div>
        <span class="chev" aria-hidden="true">›</span>
        <span class="r-sum">${esc(r.squad.length ? who + ' · ' + r.stance : who)}. ${iconize(esc(parts.join(' · ')))}.</span>
      </summary>
      <ol class="log">${lines}</ol>
    </details>`;
  }
  function endPanel() {
    const alive = S.troops.filter(OC.living).length;
    const lost = S.troops.filter(t => !OC.living(t)).length;
    const won = S.phase === 'won';
    const title = won ? 'Sector 1 pacified' : S.lossReason === 'base' ? 'The base has fallen' : 'Total attrition';
    const lastSave = saves[saves.length - 1];
    return `<section class="card endpanel">
      <h2>${title}</h2>
      <p class="muted">${won ? `All five outposts taken in ${plural(S.day - 1, 'day', 'days')}. In the full game, Sector 2 opens next.` : `The campaign ends on Day ${S.day - 1}.`}</p>
      <div style="margin-top:6px">
        <div class="check"><i class="${S.taken >= OC.OUTPOSTS ? 'y' : 'n'}">${S.taken >= OC.OUTPOSTS ? '✓' : '✗'}</i><span>Outposts taken: ${S.taken} of ${OC.OUTPOSTS}</span></div>
        <div class="check"><i class="${S.integrity > 0 ? 'y' : 'n'}">${S.integrity > 0 ? '✓' : '✗'}</i><span>Base integrity ${S.integrity} of 100</span></div>
        <div class="check"><i class="${alive ? 'y' : 'n'}">${alive ? '✓' : '✗'}</i><span>${plural(alive, 'troop', 'troops')} fit or recovering, ${lost} lost</span></div>
        <div class="check"><i class="${OC.stage(S) <= 2 ? 'y' : 'n'}">${OC.stage(S) <= 2 ? '✓' : '!'}</i><span>War Clock finished at Stage ${OC.stage(S)}</span></div>
      </div>
      <div class="stats" style="margin-top:12px">
        <div class="stat"><b>${S.stats.run}</b><span>Missions</span></div>
        <div class="stat"><b>${S.stats.won}</b><span>Victories</span></div>
        <div class="stat"><b>${S.stats.repelled}/${S.stats.raids}</b><span>Raids held</span></div>
        <div class="stat"><b>${S.troops.length - 4}</b><span>Rescued</span></div>
      </div>
      <div class="btnrow" style="margin-top:12px">
        ${lastSave ? `<button class="btn primary" data-act="restore" data-i="${saves.length - 1}">Replay Day ${lastSave.day}</button>` : ''}
        <button class="btn ghost" data-act="newgame">New campaign</button>
      </div>
    </section>`;
  }
  function debriefTab() {
    let h = '';
    if (S.phase !== 'play') h += endPanel();
    if (S.day === 1 && S.phase === 'play') {
      h += `<section class="card">
        <span class="label">Orders · Day 1</span>
        <h2>Take Sector 1’s five outposts. Keep the base standing.</h2>
        <p>You have four Level 2 troops and two mission slots. Brandt is the first outpost. Patrols will find two more, and the enemy builds two after that.</p>
        <ul class="plain">
          <li>Each mission has a squad size. Every missing troop costs −1 power, so small squads suit small jobs.</li>
          <li>Every outpost has a type with its own effect, such as artillery or a supply hub. Choose which to take first.</li>
          <li>Outposts raid the base every four days until they fall, and rebuild if left alone. Sabotage missions knock their walls down cheaply. After you take one, the enemy often counterattacks: hold it or lose it.</li>
          <li>${ICON.materials} Materials buy buildings, gear and a forward base. ${ICON.tech} Tech buys research. ${ICON.intel} Intel reveals exact odds and finds hidden armies and outposts.</li>
          <li>The War Clock rises every day and whenever a raid hurts you. Each stage makes every enemy stronger.</li>
          <li>Research unlocks artillery fire missions and comms jamming. Troops left at the base can train for XP. Some wins lead to follow-up missions.</li>
        </ul>
        <p class="small muted" style="margin-top:8px">${OC.D(S).label}: ${esc(OC.D(S).rules.join('. '))}.</p>
        <div class="btnrow" style="margin-top:12px"><button class="btn primary" data-act="tab" data-tab="deploy">Go to deployment</button></div>
      </section>`;
    }
    const reports = S.debrief.filter(e => e.kind !== 'note');
    const notes = S.debrief.filter(e => e.kind === 'note');
    if (S.debrief.length) {
      const from = S.day - 1;
      h += `<p class="section-label">Reports from Day ${from}</p>`;
      if (!reports.length) h += `<section class="card"><p class="muted">No squads came back on Day ${from}, and the base was quiet.</p></section>`;
      h += reports.map(reportCard).join('');
      if (notes.length) h += `<section class="card"><span class="label">Situation</span><div class="notes">${notes.map(n => `<div class="note"><span class="dot ${n.tone}"></span><span>${iconize(esc(n.text))}</span></div>`).join('')}</div></section>`;
      if (S.phase === 'play') h += `<div class="btnrow"><button class="btn primary" data-act="tab" data-tab="deploy">Plan Day ${S.day}</button><button class="btn ghost" data-act="tab" data-tab="base">Check the base</button></div>`;
    }
    return h;
  }
  function statusPill(t) {
    const why = t.status === 'ok' ? OC.availability(S, t) : null;
    const map = {
      ok: why ? [why, 'o-warn'] : ['Ready', 'o-good'],
      fatigued: ['Fatigued', 'o-warn'], wounded: ['Wounded', 'o-warn'], critical: ['Critical', 'o-bad'],
      kia: ['KIA', 'o-bad'], mia: ['MIA', 'o-bad'], lost: ['Lost', 'o-bad']
    };
    const [txt, cls] = map[t.status];
    let sub = '';
    if (t.status === 'fatigued') sub = `Back in ${plural(t.days, 'day', 'days')}`;
    if (t.status === 'wounded') sub = `Infirmary, ${plural(t.days, 'day', 'days')}`;
    if (t.status === 'critical') sub = t.bed ? `In bed, ${plural(t.days, 'day', 'days')}` : `No bed: dies in ${plural(t.crit, 'day', 'days')}`;
    if (t.status === 'mia') sub = `${plural(t.days, 'day', 'days')} to find`;
    return `<span class="spill ${cls}">${txt}</span>${sub ? `<span class="sub">${sub}</span>` : ''}`;
  }
  function rosterTab() {
    const ready = S.troops.filter(t => t.status === 'ok').length;
    const hurt = S.troops.filter(t => ['fatigued', 'wounded', 'critical'].includes(t.status)).length;
    const bedsUsed = S.troops.filter(t => t.status === 'critical' && t.bed).length;
    const order = t => (OC.living(t) ? 0 : 1);
    const rows = S.troops.slice().sort((a, b) => order(a) - order(b)).map(t => {
      const need = 20 * t.level;
      const pick = t.level >= 3 && !t.cls && t.status !== 'kia' && t.status !== 'lost'
        ? `<div class="cls-pick"><span class="label">Choose a class for ${esc(t.name)}</span><div class="cls-grid">${Object.keys(OC.CLASSES).map(c => `<button class="cls-opt" data-act="cls" data-t="${t.id}" data-c="${c}"><b>${c}</b><span>${esc(OC.CLASSES[c])}</span></button>`).join('')}</div></div>`
        : '';
      const gear = !OC.living(t) ? '' : t.gear
        ? `<div class="gear-row">Gear: <b style="color:var(--ink)">${OC.GEAR[t.gear].name}</b> · ${esc(OC.GEAR[t.gear].effect)}</div>`
        : `<div class="gear-row">Equip: ${Object.keys(OC.GEAR).map(g => `<button class="btn small ghost" data-act="gear" data-t="${t.id}" data-k="${g}" title="${esc(OC.GEAR[g].effect)}" ${S.tech < OC.GEAR_COST || S.phase !== 'play' ? 'disabled' : ''}>${OC.GEAR[g].name} · ${cost('tech', OC.GEAR_COST)}</button>`).join('')}</div>`;
      return `<div class="troop">
        <div>
          <div class="troop-name">${esc(t.name)}${t.cls ? `<span class="ctag cls">${t.cls}</span>` : ''}</div>
          <div class="xpline">Level ${t.level} · ${t.xp}/${need} XP</div>
          <div class="xp" aria-hidden="true"><i style="width:${Math.min(100, Math.round(t.xp / need * 100))}%"></i></div>
        </div>
        ${statusPill(t)}
        ${gear}
        ${pick}
      </div>`;
    }).join('');
    const waiting = S.waiting.length
      ? `<section class="card"><span class="label">Waiting at rescue sites</span><p>${S.waiting.map(w => `${esc(w.rec.name)} (${plural(w.days, 'day', 'days')} left)`).join(', ')}. Upgrade the Barracks to bring them in.</p></section>`
      : '';
    return `<div class="stats">
        <div class="stat"><b>${ready}</b><span>Ready</span></div>
        <div class="stat"><b>${hurt}</b><span>Injured</span></div>
        <div class="stat"><b>${bedsUsed}/${OC.beds(S)}</b><span>Beds</span></div>
        <div class="stat"><b>${OC.rosterCount(S)}/${OC.rosterCap(S)}</b><span>Roster</span></div>
      </div>
      ${waiting}
      <section class="card">${rows}</section>
      <section class="card"><details class="rules"><summary>How injuries, classes and gear work</summary>
        <ul class="plain">
          <li>Fatigued: sits out 1 day. Wounded: in the infirmary for a few days.</li>
          <li>Critical: needs an infirmary bed within ${plural(OC.D(S).critDays + (S.r.fm ? 2 : 0), 'day', 'days')} or dies. Beds go to the most urgent case automatically.</li>
          <li>Only a Rout can kill outright or leave a troop missing. A missing troop can be found with a Recovery mission.</li>
          <li>At Level 3, a troop without a class picks one. Only Assault stacks within a squad.</li>
          <li>Each troop can carry one piece of gear, bought with Tech. It’s lost if the troop dies.</li>
          <li>Troops in training earn XP every night on the Base tab.</li>
        </ul>
      </details></section>`;
  }
  function baseTab() {
    const def = OC.defense(S);
    const th = OC.threats(S);
    const st = OC.stage(S);
    const lvl = S.integrity > 60 ? '' : S.integrity > 30 ? 'mid' : 'low';
    let clock = '';
    for (let i = 0; i < 5; i++) { const fill = Math.max(0, Math.min(20, S.clock - i * 20)) / 20 * 100; clock += `<div><i style="width:${fill}%"></i></div>`; }
    const threatRows = th.length
      ? th.map(t => `<div class="threat-row"><div><b>${esc(t.name)}</b><div class="small muted">Strength ${t.strength} · ${def.total >= t.strength ? 'Your defense holds' : def.total >= t.strength - 2 ? 'The base would be damaged' : 'The base would be breached'}${t.raid && S.fwd ? ' · may hit the forward base instead' : ''}</div></div><span class="spill ${t.nights === 1 ? 'o-bad' : 'o-warn'}">${whenText(t.nights)}</span></div>`).join('')
      : '<p class="muted">No known threats.</p>';
    const hidden = OC.hiddenReports(S).map(h => `<div class="threat-row"><div><b>${h.kind === 'army' ? 'Unconfirmed enemy movement' : 'Unconfirmed enemy outpost'}</b><div class="small muted">${h.jammed ? 'Radar jamming hides it from your scouts.' : `Somewhere along the ${h.side}. Nobody is watching.`}</div></div>
      <button class="btn small" data-act="locate" data-m="${h.id}" ${S.intel < OC.LOCATE_COST || S.phase !== 'play' ? 'disabled' : ''}>Locate · ${cost('intel', OC.LOCATE_COST)}</button></div>`).join('');
    const blind = [];
    if (!S.flags.scouted) blind.push('the western roads');
    if (!S.flags.scoutedEast) blind.push('the eastern road');
    const chips = S.troops.filter(OC.living).map(t => {
      const on = S.guard.includes(t.id);
      const why = on ? null : OC.availability(S, t);
      const full = !on && S.guard.length >= OC.GUARD_MAX;
      return `<button class="tchip" data-act="guard" data-t="${t.id}" aria-pressed="${on}" ${(why || full) && !on ? 'disabled' : ''}>
        <b>${esc(t.name)}</b><small>Level ${t.level}${t.cls ? ' · ' + t.cls : ''}${why ? ' · ' + why : ` · +${fmt(OC.guardValue(t))}`}</small></button>`;
    }).join('');
    const trainChips = S.troops.filter(OC.living).map(t => {
      const on = S.training.includes(t.id);
      const why = on ? null : OC.availability(S, t);
      return `<button class="tchip" data-act="train" data-t="${t.id}" aria-pressed="${on}" ${why && !on ? 'disabled' : ''}>
        <b>${esc(t.name)}</b><small>Level ${t.level} · ${t.xp}/${20 * t.level} XP${why ? ' · ' + why : ''}</small></button>`;
    }).join('');
    const buildRows = Object.keys(OC.BUILD).map(k => {
      const b = OC.BUILD[k], l = S.b[k], next = l + 1, maxed = l >= b.max, c = b.cost[next];
      return `<div class="urow"><div><span class="nm">${b.name}</span><span class="lvl">Level ${l}</span>
        <div class="small muted">Now: ${b.effect(l)}${maxed ? '' : ` · Next: ${b.effect(next)}`}</div></div>
        ${maxed ? '<span class="done-tag">Max</span>' : `<button class="btn small" data-act="build" data-k="${k}" ${S.materials < c || S.phase !== 'play' ? 'disabled' : ''}>Build · ${cost('materials', c)}</button>`}</div>`;
    }).join('');
    const fz = OC.forwardZones(S);
    const fwdRow = S.fwd
      ? `<div class="urow"><div><span class="nm">Forward base</span><span class="lvl">Zone ${S.fwd}</span>
          <div class="small muted">+1 power on missions in Zones ${Math.max(1, S.fwd - 1)}–${Math.min(6, S.fwd + 1)}. ${cost('materials', '+5')} a night. Half of all outpost raids hit it instead of the main base; it falls to any raid above strength ${OC.FORWARD_DEF}.</div></div>
          <span class="done-tag">Built</span></div>`
      : `<div class="urow"><div><span class="nm">Forward base</span>
          <div class="small muted">Build in a zone where you took an outpost. +1 power on missions in that zone and its neighbors, ${cost('materials', '+5')} a night. Half of all outpost raids hit it instead of the main base; it falls to any raid above strength ${OC.FORWARD_DEF}.</div></div>
          <div class="btnrow" style="justify-content:flex-end">${fz.length ? fz.map(z => `<button class="btn small" data-act="fwd" data-k="${z}" ${S.materials < OC.FORWARD_COST || S.phase !== 'play' ? 'disabled' : ''}>Zone ${z} · ${cost('materials', OC.FORWARD_COST)}</button>`).join('') : '<span class="small muted">Take an outpost first</span>'}</div></div>`;
    const resRow = k => {
      const r = OC.RESEARCH[k], have = !!S.r[k], locked = r.req && !S.r[r.req];
      return `<div class="urow"><div><span class="nm">${r.name}</span>
        <div class="small muted">${esc(r.effect)}${locked ? ` · Needs ${OC.RESEARCH[r.req].name}` : ''}</div></div>
        ${have ? '<span class="done-tag">Done</span>' : `<button class="btn small" data-act="research" data-k="${k}" ${locked || S.tech < r.cost || S.phase !== 'play' ? 'disabled' : ''}>Research · ${cost('tech', r.cost)}</button>`}</div>`;
    };
    const keys = Object.keys(OC.RESEARCH);
    const tier1 = keys.filter(k => OC.RESEARCH[k].tier === 1).map(resRow).join('');
    const tier2 = keys.filter(k => OC.RESEARCH[k].tier === 2).map(resRow).join('');
    const outposts = S.missions.filter(m => m.type === 'Siege');
    const outpostRows = outposts.map(m => `<div class="threat-row"><div><b>${OC.visible(S, m) ? esc(m.name) : 'Unconfirmed outpost'}</b><div class="small muted">${OC.visible(S, m) && OC.TRAITS[m.trait] ? `${OC.TRAITS[m.trait].label}: ${esc(OC.TRAITS[m.trait].effect)}` : 'Type unknown until located.'}</div></div><span class="small muted" style="font-family:var(--f-mono)">${OC.visible(S, m) ? `FP ${m.fort}/${m.fortMax}` : '?'}</span></div>`).join('');
    return `<section class="card">
        <div class="twocol">
          <div><span class="label">War Clock</span><div class="bigstat"><b>Stage ${st}</b><span>${Math.floor(S.clock)} of 100</span></div></div>
          <div class="small muted" style="text-align:right">Outposts taken<br><b style="font-family:var(--f-mono);font-size:20px;color:var(--ink)">${S.taken} of ${OC.OUTPOSTS}</b></div>
        </div>
        <div class="clockbar" aria-hidden="true">${clock}</div>
        <div class="clockstages" aria-hidden="true"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div>
        <p class="small muted" style="margin-top:8px">${OC.D(S).clockRate ? `Rises ${OC.D(S).clockRate} a day` : 'No daily rise on Easy'}, and 5 for every raid that hurts you. Destroying an army takes off 8; taking an outpost, 5; holding one, 3. Each stage adds 1 threat to every enemy.</p>
        ${outposts.length ? `<p class="sub-label">Standing outposts</p><div class="notes">${outpostRows}</div>` : ''}
      </section>
      <section class="card">
        <span class="label">Base integrity</span>
        <div class="bigstat"><b>${S.integrity}</b><span>of 100</span></div>
        <div class="bar ${lvl}" aria-hidden="true"><i style="width:${S.integrity}%"></i></div>
        <div class="squadline" style="margin:0"><span class="small muted">Repairs itself by 7 each night. At 0, the base falls.</span>
          <button class="btn small" data-act="repair" ${S.materials < OC.REPAIR_COST || S.integrity >= 100 || S.phase !== 'play' ? 'disabled' : ''}>Repair +${OC.REPAIR_AMT} · ${cost('materials', OC.REPAIR_COST)}</button></div>
      </section>
      <section class="card">
        <span class="label">Known threats</span>
        <div class="notes">${threatRows}${hidden}</div>
        ${blind.length ? `<p class="small muted" style="margin-top:8px">Nobody is watching ${blind.join(' or ')}. Raids and armies from there arrive without warning.</p>` : ''}
      </section>
      <section class="card">
        <span class="label">Home Guard</span>
        <div class="defense"><span>Base defense <b>${fmt(def.total)}</b></span><span class="small muted">Grid ${def.grid} + guard ${fmt(def.guard)}</span></div>
        <p class="small muted" style="margin-bottom:10px">Each guard adds 1 plus half their level. Guards stay home and can’t deploy. Raids that beat your defense by 1–2 damage the base; by 3 or more they break in, steal Materials and wound the guard.</p>
        <div class="troops">${chips}</div>
      </section>
      <section class="card">
        <span class="label">Training</span>
        <p class="small muted" style="margin-bottom:10px">Each trainee earns ${OC.TRAIN_XP} XP a night. Trainees can’t deploy or guard. No limit on how many train at once.</p>
        <div class="troops">${trainChips}</div>
      </section>
      <section class="card"><span class="label">Buildings · ${cost('materials', S.materials)}</span>${buildRows}${fwdRow}</section>
      <section class="card"><span class="label">Research · ${cost('tech', S.tech)}</span>${tier1}<p class="sub-label">Advanced</p>${tier2}</section>`;
  }
  function deployTab() {
    if (S.phase !== 'play') return `<section class="card"><h2>Operations closed</h2><p class="muted">Replay the last day or start a new campaign from the Debrief tab.</p></section>`;
    const idle = S.troops.filter(t => t.status === 'ok' && !OC.availability(S, t)).length;
    const list = S.missions.filter(m => OC.visible(S, m));
    const rank = { Hold: 0, Siege: 1, Intercept: 2, Sabotage: 3, Rescue: 4, Recovery: 4, Extraction: 5, Scout: 6, Resource: 7 };
    list.sort((a, b) => (rank[a.type] - rank[b.type]) || ((a.until || 999) - (b.until || 999)));
    return `<p class="section-label">Mission slots: ${OC.slotsUsed(S)} of ${OC.slots(S)} used · ${plural(idle, 'troop', 'troops')} available</p>`
      + (list.length ? list.map(missionCard).join('') : '<section class="card"><p class="muted">No missions open today.</p></section>');
  }
  function warnings() {
    const w = [];
    const free = OC.slotsFree(S);
    const idle = S.troops.filter(t => t.status === 'ok' && !OC.availability(S, t)).length;
    const open = S.missions.filter(m => OC.visible(S, m) && !S.deployments.some(d => d.missionId === m.id)).length;
    if (free > 0 && idle > 0 && open > 0) w.push(`${plural(free, 'mission slot is', 'mission slots are')} unused, with ${plural(idle, 'troop', 'troops')} available.`);
    S.missions.filter(m => m.type === 'Hold' && !S.deployments.some(d => d.missionId === m.id)).forEach(m => w.push(`Nobody is holding ${m.def.name}. The enemy will retake it tonight.`));
    const def = OC.defense(S).total;
    OC.threats(S).filter(t => t.nights === 1 && def < t.strength).forEach(t => w.push(`${t.name} hit tonight at strength ${t.strength}. Your defense is ${fmt(def)}.`));
    S.troops.filter(t => t.level >= 3 && !t.cls && OC.living(t)).forEach(t => w.push(`${t.name} hasn’t chosen a class yet.`));
    return w;
  }
  function ordersBar() {
    if (S.phase !== 'play') return '';
    const free = OC.slotsFree(S);
    const confirm = ui.confirm ? `<div class="card confirm"><b>Before you end Day ${S.day}</b><ul>${warnings().map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <div class="btnrow"><button class="btn small primary" data-act="endconfirm">End Day ${S.day}</button><button class="btn small ghost" data-act="endcancel">Keep planning</button></div></div>` : '';
    return `<div class="orders">${confirm}<div class="orders-in">
      <span class="orders-status"><b>${OC.slotsUsed(S)}/${OC.slots(S)}</b> slots used${S.fires.length ? ` (${S.fires.length} artillery)` : ''} · guard <b>${S.guard.length}</b> · training <b>${S.training.length}</b></span>
      <button class="btn primary" data-act="end">End Day ${S.day}</button>
    </div></div>`;
  }

  function keyOf(el) {
    if (!el || !el.dataset) return null;
    const d = el.dataset;
    return d.act ? [d.act, d.m, d.t, d.s, d.tab, d.i, d.d, d.k, d.c].join('|') : null;
  }
  function render() {
    const active = keyOf(document.activeElement);
    if (!S || ui.picking) { $app.innerHTML = picker(); return; }
    let body = '';
    if (ui.tab === 'debrief') body = debriefTab();
    if (ui.tab === 'deploy') body = deployTab();
    if (ui.tab === 'base') body = baseTab();
    if (ui.tab === 'roster') body = rosterTab();
    $app.innerHTML = header() + `<main class="stack">${savesPanel()}${body}</main>` + ordersBar();
    if (active) {
      const el = [...$app.querySelectorAll('[data-act]')].find(x => keyOf(x) === active);
      if (el && !el.disabled) el.focus({ preventScroll: true });
    }
  }
  function goTab(t) { ui.tab = t; ui.confirm = false; window.scrollTo(0, 0); }

  function act(a, d) {
    switch (a) {
      case 'tab': goTab(d.tab); break;
      case 'plan': {
        const m = S.missions.find(x => x.id === d.m);
        if (m) { ui.open = d.m; ui.plan = { ids: bestAvailable(size(m)), stance: 'standard' }; }
        break;
      }
      case 'close': ui.open = null; ui.plan = null; break;
      case 'troop': {
        const m = S.missions.find(x => x.id === ui.open);
        const ids = ui.plan.ids;
        const i = ids.indexOf(d.t);
        if (i >= 0) ids.splice(i, 1); else if (m && ids.length < size(m)) ids.push(d.t);
        break;
      }
      case 'best': { const m = S.missions.find(x => x.id === ui.open); if (m) ui.plan.ids = bestAvailable(size(m)); break; }
      case 'stance': ui.plan.stance = d.s; break;
      case 'reveal': OC.reveal(S, d.m); persist(); break;
      case 'locate': OC.locate(S, d.m); persist(); break;
      case 'deploy':
        if (OC.deploy(S, d.m, ui.plan.ids, ui.plan.stance)) { ui.open = null; ui.plan = null; persist(); }
        break;
      case 'recall': OC.recall(S, d.m); persist(); break;
      case 'guard': OC.toggleGuard(S, d.t); persist(); break;
      case 'train': OC.toggleTraining(S, d.t); persist(); break;
      case 'fire': OC.planFire(S, d.m, Number(d.i)); persist(); break;
      case 'unfire': OC.cancelFire(S, d.m); persist(); break;
      case 'jam': OC.jam(S, d.m); persist(); break;
      case 'build': OC.build(S, d.k); persist(); break;
      case 'fwd': OC.buildForward(S, Number(d.k)); persist(); break;
      case 'gear': OC.buyGear(S, d.t, d.k); persist(); break;
      case 'research': OC.research(S, d.k); persist(); break;
      case 'repair': OC.repair(S); persist(); break;
      case 'cls': OC.setClass(S, d.t, d.c); persist(); break;
      case 'end':
        if (warnings().length && !ui.confirm) ui.confirm = true; else endDay();
        break;
      case 'endconfirm': endDay(); break;
      case 'endcancel': ui.confirm = false; break;
      case 'saves': ui.savesOpen = !ui.savesOpen; ui.confirmNew = false; if (ui.savesOpen) window.scrollTo(0, 0); break;
      case 'restore': {
        const i = Number(d.i);
        if (!saves[i]) break;
        S = upgrade(JSON.parse(saves[i].json));
        saves = saves.slice(0, i + 1);
        ui = freshUi();
        window.scrollTo(0, 0);
        persist();
        break;
      }
      case 'asknew': ui.confirmNew = true; break;
      case 'cancelnew': ui.confirmNew = false; break;
      case 'newgame': ui.picking = true; ui.confirmNew = false; ui.savesOpen = false; window.scrollTo(0, 0); break;
      case 'pickdiff': if (OC.DIFFS[d.d]) { freshCampaign(d.d); window.scrollTo(0, 0); persist(); } break;
      case 'cancelpick': ui.picking = false; break;
    }
    render();
  }
  function endDay() {
    OC.endDay(S);
    if (S.phase === 'play') { saves.push({ day: S.day, json: JSON.stringify(S) }); saves = saves.slice(-2); }
    ui.tab = 'debrief'; ui.open = null; ui.plan = null; ui.confirm = false; ui.openReports = {};
    window.scrollTo(0, 0);
    persist();
  }

  $app.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    act(b.dataset.act, b.dataset);
  });
  $app.addEventListener('toggle', e => {
    const el = e.target;
    if (el.matches && el.matches('details.report')) ui.openReports[el.dataset.r] = el.open;
  }, true);

  function start(data) {
    if (data && data.state && data.state.v >= 3) {
      S = upgrade(data.state);
      saves = (data.saves || []).map(sv => ({ day: sv.day, json: JSON.stringify(upgrade(JSON.parse(sv.json))) }));
      ui = Object.assign(freshUi(), data.ui || {});
    } else {
      const d = loadPersisted();
      if (d) { S = d.state; saves = d.saves; } else { S = null; saves = []; ui.picking = true; }
    }
    if (S && !saves.length) saves = [{ day: S.day, json: JSON.stringify(S) }];
    render();
  }
  window.claude?.hot?.snapshot?.(() => ({ state: S, saves, ui }));
  window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
})();
