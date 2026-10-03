'use strict';
// Automated players used by the balance simulator and the simulation tests.
// They are deliberately simple; a thoughtful human should beat the "smart" one.
const OC = require('../js/game.js');

const STANCES = ['cautious', 'standard', 'aggressive'];
const PRIORITY = { Hold: -1, Siege: 0, Sabotage: 0.5, Rescue: 1, Recovery: 1, Scout: 2, Intercept: 2, Extraction: 3, Resource: 4 };

// Deterministic pseudo-random numbers for policies, separate from the game's own seeded dice.
function lcg(seed) {
  let r = seed >>> 0 || 1;
  return () => { r = (Math.imul(r, 1103515245) + 12345) & 0x7fffffff; return r / 0x7fffffff; };
}

// A reasonable player: pushes sieges, intercepts armies close to the base, guards when warned,
// spends on buildings, research, gear and artillery, and trains whoever is left over.
function smart(s) {
  s.troops.filter(t => t.level >= 3 && !t.cls).forEach(t => OC.setClass(s, t.id, s.troops.some(x => x.cls === 'Engineer') ? 'Assault' : 'Engineer'));
  if (!s.b.grid) OC.build(s, 'grid');
  if (!s.r.tc1) OC.research(s, 'tc1');
  if (s.waiting.length) OC.build(s, 'barracks');
  if (s.integrity < 50) OC.repair(s);
  if (s.b.grid < 2) OC.build(s, 'grid');
  if (s.r.tc1 && !s.r.tc2) OC.research(s, 'tc2');
  ['sdoc', 'sig', 'art', 'sd', 'jam', 'art2', 'ia'].forEach(k => OC.research(s, k));
  if (!s.fwd) OC.forwardZones(s).slice(0, 1).forEach(z => OC.buildForward(s, z));
  if (s.materials >= 60) OC.build(s, 'infirmary');
  if (s.materials >= 50) OC.build(s, 'barracks');
  s.troops.filter(t => !t.gear && OC.living(t)).sort((a, b) => b.level - a.level).forEach(t => { if (s.tech >= 40) OC.buyGear(s, t.id, 'rifle'); });
  OC.hiddenReports(s).forEach(h => OC.locate(s, h.id));
  // Jam the army closest to the base.
  const close = OC.threats(s).filter(t => !t.raid && t.nights <= 1)[0];
  if (close) OC.jam(s, close.id);
  s.guard.slice().forEach(id => OC.toggleGuard(s, id));
  s.training.slice().forEach(id => OC.toggleTraining(s, id));
  const tonight = OC.threats(s).filter(t => t.nights === 1);
  const need = tonight.length ? Math.max(...tonight.map(t => t.strength)) : 0;
  const pool = s.troops.filter(t => !OC.availability(s, t)).sort((a, b) => a.level - b.level);
  while (need && OC.defense(s).total < need && pool.length && s.guard.length < 3) OC.toggleGuard(s, pool.shift().id);
  const urgent = m => { if (m.type !== 'Intercept') return 0; const t = OC.threats(s).find(x => x.id === m.id); return t && t.nights <= 2 ? 1 : 0; };
  const missions = s.missions.filter(m => OC.visible(s, m)).sort((a, b) => (urgent(b) - urgent(a)) || (PRIORITY[a.type] - PRIORITY[b.type]));
  for (const m of missions) {
    if (OC.slotsFree(s) <= 0) break;
    if (s.deployments.some(d => d.missionId === m.id)) continue;
    const size = OC.sizeOf(m, s);
    const avail = s.troops.filter(t => !OC.availability(s, t)).sort((a, b) => b.level - a.level);
    if (!avail.length || avail.length < size - 1) continue;
    const ids = avail.slice(0, size).map(t => t.id);
    const p = OC.power(s, ids, 'standard', m);
    if (OC.chance(p.total, m.threat) < (urgent(m) ? 25 : 40) && !['Rescue', 'Hold'].includes(m.type)) continue;
    OC.deploy(s, m.id, ids, 'standard');
  }
  // Spare slots go to artillery on the toughest target in range.
  s.missions.filter(m => ['Siege', 'Intercept'].includes(m.type) && OC.visible(s, m) && OC.inRange(s, m))
    .sort((a, b) => b.threat - a.threat)
    .forEach(m => { if (OC.slotsFree(s) > 0 && s.materials >= 40) OC.planFire(s, m.id, s.intel >= 3 ? 1 : 0); });
  s.troops.filter(t => !OC.availability(s, t)).forEach(t => OC.toggleTraining(s, t.id));
}

// A chaotic player that pokes every system at random. Used to shake out rule bugs, not to measure balance.
function random(s, rnd) {
  s.troops.filter(t => t.level >= 3 && !t.cls).forEach(t => OC.setClass(s, t.id, Object.keys(OC.CLASSES)[Math.floor(rnd() * 5)]));
  ['grid', 'barracks', 'infirmary'].forEach(k => { if (rnd() < 0.3) OC.build(s, k); });
  Object.keys(OC.RESEARCH).forEach(k => { if (rnd() < 0.3) OC.research(s, k); });
  if (rnd() < 0.2) OC.repair(s);
  if (rnd() < 0.2) OC.forwardZones(s).forEach(z => OC.buildForward(s, z));
  s.troops.forEach(t => { if (rnd() < 0.05) OC.buyGear(s, t.id, rnd() < 0.5 ? 'armor' : 'rifle'); });
  OC.hiddenReports(s).forEach(h => { if (rnd() < 0.3) OC.locate(s, h.id); });
  s.troops.forEach(t => { if (rnd() < 0.15) OC.toggleGuard(s, t.id); if (rnd() < 0.15) OC.toggleTraining(s, t.id); });
  s.deployments.slice().forEach(d => { if (rnd() < 0.1) OC.recall(s, d.missionId); });
  s.fires.slice().forEach(f => { if (rnd() < 0.2) OC.cancelFire(s, f.missionId); });
  for (const m of s.missions.slice().sort(() => rnd() - 0.5)) {
    if (OC.slotsFree(s) <= 0) break;
    if (rnd() < 0.15) OC.jam(s, m.id);
    if (rnd() < 0.2) { OC.planFire(s, m.id, Math.floor(rnd() * 3)); continue; }
    const avail = s.troops.filter(t => !OC.availability(s, t)).map(t => t.id);
    if (!avail.length) break;
    if (rnd() < 0.3) OC.reveal(s, m.id);
    const ids = avail.sort(() => rnd() - 0.5).slice(0, 1 + Math.floor(rnd() * Math.min(OC.sizeOf(m, s), avail.length)));
    OC.deploy(s, m.id, ids, STANCES[Math.floor(rnd() * 3)]);
  }
}

// Plays one campaign to the end (or maxDay) and returns the final state.
function playCampaign({ seed, diff, policy = 'smart', maxDay = 150, onDay }) {
  const s = OC.newGame(seed, diff);
  const rnd = lcg(seed + 11);
  while (s.phase === 'play' && s.day <= maxDay) {
    policy === 'random' ? random(s, rnd) : smart(s);
    if (onDay) onDay(s, 'before');
    OC.endDay(s);
    if (onDay) onDay(s, 'after');
  }
  return s;
}

module.exports = { smart, random, playCampaign, lcg };
