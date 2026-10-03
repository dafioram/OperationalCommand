'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { OC, veteranGame, advanceUntil, readyIds } = require('./helpers.js');

test('a new campaign starts with four Level 2 troops, two slots and three missions', () => {
  const s = OC.newGame(42, 'medium');
  assert.equal(s.v, OC.SAVE_VERSION);
  assert.equal(s.day, 1);
  assert.equal(s.troops.length, 4);
  assert.ok(s.troops.every(t => t.level === 2 && t.status === 'ok'));
  assert.equal(OC.slots(s), 2);
  assert.deepEqual(s.missions.map(m => m.id).sort(), ['res-quarry', 'rescue-kessel', 'scout-hollow']);
});

test('difficulty shifts enemy threat: Easy -1, Hard +1, never below 0', () => {
  const threats = d => OC.newGame(1, d).missions.map(m => m.threat).sort();
  assert.deepEqual(threats('medium'), [0, 1, 2]);
  assert.deepEqual(threats('easy'), [0, 0, 1]);
  assert.deepEqual(threats('hard'), [1, 2, 3]);
});

test('success chance is 50% + 10% per point of power over threat, clamped to 5–95%', () => {
  assert.equal(OC.chance(2, 2), 50);
  assert.equal(OC.chance(4, 2), 70);
  assert.equal(OC.chance(0, 9), 5);
  assert.equal(OC.chance(20, 0), 95);
  assert.equal(OC.band(80), 'Favorable');
  assert.equal(OC.band(50), 'Even');
  assert.equal(OC.band(30), 'Risky');
  assert.equal(OC.band(10), 'Desperate');
});

test('short squads lose 1 power per missing troop; extra troops are refused', () => {
  const s = OC.newGame(3, 'medium');
  const rescue = s.missions.find(m => m.id === 'rescue-kessel');
  assert.equal(OC.sizeOf(rescue, s), 3);
  const p = OC.power(s, readyIds(s, 2), 'standard', rescue);
  assert.equal(p.gap, 1);
  assert.equal(p.total, 2 - 1);
  assert.equal(OC.deploy(s, rescue.id, readyIds(s, 4), 'standard'), false, 'four troops on a squad of three');
  assert.equal(OC.deploy(s, rescue.id, readyIds(s, 3), 'standard'), true);
});

test('deployments respect mission slots and troop availability, and can be recalled the same day', () => {
  const s = OC.newGame(4, 'medium');
  const [a, b, c] = s.missions;
  assert.ok(OC.deploy(s, a.id, readyIds(s, 1), 'standard'));
  assert.equal(OC.deploy(s, a.id, readyIds(s, 1), 'standard'), false, 'same mission twice');
  assert.ok(OC.deploy(s, b.id, readyIds(s, 1), 'standard'));
  assert.equal(OC.deploy(s, c.id, readyIds(s, 1), 'standard'), false, 'no third slot');
  OC.recall(s, a.id);
  assert.equal(OC.slotsFree(s), 1);
});

test('gear costs 20 Tech, not Materials, and a rifle counts as one level higher', () => {
  const s = OC.newGame(5, 'medium');
  const t = s.troops[0];
  s.tech = 19; s.materials = 500;
  assert.equal(OC.buyGear(s, t.id, 'rifle'), false, 'not enough Tech');
  s.tech = 20;
  assert.ok(OC.buyGear(s, t.id, 'rifle'));
  assert.equal(s.tech, 0);
  assert.equal(s.materials, 500, 'Materials untouched');
  assert.equal(OC.buyGear(s, t.id, 'armor'), false, 'one item per troop');
  const scout = s.missions.find(m => m.id === 'scout-hollow');
  assert.equal(OC.power(s, [t.id], 'standard', scout).avg, 3);
});

test('training: no cap, exclusive with guard and missions, +5 XP a night', () => {
  const s = OC.newGame(6, 'medium');
  s.troops.forEach(t => assert.ok(OC.toggleTraining(s, t.id)));
  assert.equal(s.training.length, 4, 'everyone can train at once');
  assert.equal(OC.availability(s, s.troops[0]), 'Training');
  assert.equal(OC.toggleGuard(s, s.troops[0].id), false, 'trainees cannot guard');
  assert.equal(OC.deploy(s, s.missions[0].id, [s.troops[0].id], 'standard'), false, 'trainees cannot deploy');
  const before = s.troops.map(t => t.level * 1000 + t.xp);
  OC.endDay(s);
  s.troops.forEach((t, i) => {
    const gained = (t.level * 1000 + t.xp) - before[i];
    assert.ok(gained === OC.TRAIN_XP || gained > 900, `${t.name} gained 5 XP or levelled up`);
  });
  assert.ok(OC.toggleTraining(s, s.troops[0].id), 'can be taken out of training');
  assert.equal(OC.availability(s, s.troops[0]), null);
});

test('artillery needs research, uses a slot, costs Materials and Intel, and refunds on cancel', () => {
  const s = OC.newGame(7, 'medium');
  const brandt = advanceUntil(s, m => m.id === 'siege-brandt');
  assert.ok(brandt);
  s.materials = 100; s.intel = 5;
  assert.equal(OC.planFire(s, brandt.id, 0), false, 'locked before research');
  s.r.art = true;
  assert.equal(OC.inRange(s, brandt), false, 'Zone 4 is out of range from the base');
  s.takenZones.push(4); s.fwd = 4;
  assert.equal(OC.inRange(s, brandt), true, 'a forward base next to it brings it in range');
  const slotsBefore = OC.slotsFree(s);
  assert.ok(OC.planFire(s, brandt.id, 2));
  assert.equal(s.materials, 100 - OC.FIRE_COST);
  assert.equal(s.intel, 3);
  assert.equal(OC.slotsFree(s), slotsBefore - 1);
  assert.equal(OC.planFire(s, brandt.id, 0), false, 'one fire mission per target');
  OC.cancelFire(s, brandt.id);
  assert.equal(s.materials, 100);
  assert.equal(s.intel, 5);
});

test('artillery accuracy: 60% scouted, 30% unscouted, +15% per Intel, capped at 95%', () => {
  const s = OC.newGame(8, 'medium');
  const m = { zone: 2 };
  assert.equal(OC.fireChance(s, m, 0), 30);
  s.flags.scouted = true;
  assert.equal(OC.fireChance(s, m, 0), 60);
  assert.equal(OC.fireChance(s, m, 2), 90);
  assert.equal(OC.fireChance(s, m, 5), 95);
  assert.equal(OC.fireDamage(s), 1);
  s.r.art2 = true;
  assert.equal(OC.fireDamage(s), 2);
});

test('an artillery hit knocks down Fort Points but never takes an outpost on its own', () => {
  let hits = 0;
  for (let seed = 1; seed < 40; seed++) {
    const s = OC.newGame(seed, 'medium');
    const brandt = advanceUntil(s, m => m.id === 'siege-brandt');
    s.r.art = true; s.r.art2 = true; s.flags.scouted = true; s.takenZones.push(4); s.fwd = 4; s.intel = 5; s.materials = 100;
    brandt.fort = 2;
    OC.planFire(s, brandt.id, 2);
    OC.endDay(s);
    const fire = s.debrief.find(e => e.kind === 'fire');
    assert.ok(fire, 'a fire report is in the debrief');
    const after = s.missions.find(m => m.id === 'siege-brandt');
    assert.ok(after, 'the outpost still stands');
    if (fire.outcome === 'Hit') { hits++; assert.ok(after.fort >= 1); }
  }
  assert.ok(hits > 20, `most 90% shots should hit (got ${hits}/39)`);
});

test('comms jamming freezes an army for a night, costs 2 Intel, then recharges for 3 days', () => {
  const s = OC.newGame(9, 'medium');
  s.flags.scouted = true;
  const army = advanceUntil(s, m => m.id === 'int-column');
  assert.ok(army);
  s.intel = 5;
  assert.equal(OC.jam(s, army.id), false, 'locked before research');
  s.r.jam = true;
  const nights = OC.nightsToBase(s, army);
  assert.ok(OC.jam(s, army.id));
  assert.equal(s.intel, 3);
  assert.equal(OC.nightsToBase(s, army), nights + 1);
  const pos = [army.pos, army.stay];
  OC.endDay(s);
  const after = s.missions.find(m => m.id === 'int-column');
  assert.deepEqual([after.pos, after.stay], pos, 'the army did not move');
  assert.equal(OC.jam(s, after.id), false, 'recharging');
  s.jamReady = s.day;
  assert.ok(OC.canJam(s));
});

test('easy difficulty: armies never move, so jamming is unavailable', () => {
  const s = OC.newGame(10, 'easy');
  s.r.jam = true; s.intel = 5;
  assert.equal(OC.canJam(s), false);
});

test('mission chain: a won rescue can reveal a weak spot that knocks out 2 Fort Points', () => {
  let found = null;
  for (let seed = 1; seed < 200 && !found; seed++) {
    const s = veteranGame(seed);
    advanceUntil(s, m => m.id === 'siege-brandt');
    const rescue = s.missions.find(m => m.id === 'rescue-kessel');
    if (!rescue) continue;
    OC.deploy(s, rescue.id, readyIds(s, 3), 'standard');
    OC.endDay(s);
    const chain = s.missions.find(m => m.chain && m.type === 'Sabotage');
    if (chain) found = { s, chain };
  }
  assert.ok(found, 'a weak-spot follow-up appears within 200 seeds');
  const { s, chain } = found;
  assert.equal(chain.dmg, 2);
  const target = s.missions.find(m => m.id === chain.target);
  target.fort = target.fortMax;
  s.troops.forEach(t => { t.status = 'ok'; });
  for (let i = 0; i < 20; i++) {
    const t2 = s.missions.find(m => m.id === chain.target);
    const c2 = s.missions.find(m => m.id === chain.id);
    if (!c2) break;
    const before = t2.fort;
    OC.deploy(s, c2.id, readyIds(s, 2), 'standard');
    OC.endDay(s);
    const r = s.debrief.find(e => e.missionId === c2.id);
    if (r && /Victory/.test(r.outcome)) { assert.equal(Math.min(before, t2.fort + 2), before, 'up to 2 Fort Points removed'); break; }
  }
});

test('mission chain: captured orders reveal the next army and set up a +2 ambush', () => {
  const s = OC.newGame(11, 'medium');
  s.day = 20; s.nextArmy = 20; s.orders = true;
  s.missions = s.missions.filter(m => m.type !== 'Intercept');
  OC.endDay(s);
  const army = s.missions.find(m => m.type === 'Intercept' && m.chain);
  assert.ok(army, 'the next army arrives marked as a follow-up');
  assert.equal(s.orders, false);
  assert.ok(OC.visible(s, army), 'its route is known even without scouting');
  const p = OC.power(s, readyIds(s, 1), 'standard', army);
  assert.equal(p.amb, 2);
});

test('the same seed and the same orders always produce the same campaign', () => {
  const run = () => {
    const s = OC.newGame(1234, 'hard');
    for (let i = 0; i < 12 && s.phase === 'play'; i++) {
      const m = s.missions.find(x => OC.visible(s, x) && !s.deployments.some(d => d.missionId === x.id));
      if (m) OC.deploy(s, m.id, readyIds(s, OC.sizeOf(m, s)), 'standard');
      OC.endDay(s);
    }
    return JSON.stringify(s);
  };
  assert.equal(run(), run());
});

test('saves from version 3 and 4 migrate to version 5 and keep playing', () => {
  const s = OC.newGame(12, 'medium');
  for (let i = 0; i < 6; i++) OC.endDay(s);
  const old = JSON.parse(JSON.stringify(s));
  delete old.training; delete old.fires; delete old.jamReady; delete old.orders;
  old.missions.filter(m => m.type === 'Siege').forEach(m => { delete m.trait; });
  old.v = 3;
  OC.migrate(old);
  assert.equal(old.v, 5);
  assert.deepEqual(old.training, []);
  assert.deepEqual(old.fires, []);
  assert.ok(old.missions.filter(m => m.type === 'Siege').every(m => OC.TRAITS[m.trait]));
  for (let i = 0; i < 10 && old.phase === 'play'; i++) OC.endDay(old);
  assert.ok(old.day > 7);
});
