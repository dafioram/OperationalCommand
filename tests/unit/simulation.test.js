'use strict';
// Plays hundreds of automated campaigns and checks that no rule is ever broken.
// Also guards the rough balance so a change that makes Medium trivial or impossible fails CI.
const test = require('node:test');
const assert = require('node:assert/strict');
const OC = require('../../js/game.js');
const { playCampaign } = require('../../tools/policies.js');

const STATUSES = ['ok', 'fatigued', 'wounded', 'critical', 'kia', 'mia', 'lost'];

function outpostsExpected(dayDone) {
  return dayDone >= 22 ? 5 : dayDone >= 14 ? 4 : dayDone >= 9 ? 3 : dayDone >= 5 ? 2 : dayDone >= 2 ? 1 : 0;
}

function checkInvariants(s) {
  const fail = msg => { throw new Error(`Day ${s.day} (${s.diff}, seed ${s.seed}): ${msg}`); };
  if (s.materials < 0 || s.tech < 0 || s.intel < 0) fail('negative resource');
  if (s.intel > OC.intelCap(s)) fail('Intel over cap');
  if (s.integrity < 0 || s.integrity > 100) fail('base integrity out of range');
  if (s.clock < 0 || s.clock > 100) fail('War Clock out of range');
  if (s.taken < 0 || s.taken > OC.OUTPOSTS) fail('outposts taken out of range');
  s.troops.forEach(t => {
    if (!STATUSES.includes(t.status)) fail(`bad status ${t.status}`);
    if (t.xp < 0 || (t.level < 10 && t.xp >= 20 * t.level)) fail(`bad XP on ${t.name}`);
  });
  if (new Set(s.troops.map(t => t.id)).size !== s.troops.length) fail('duplicate troop');
  if (new Set(s.missions.map(m => m.id)).size !== s.missions.length) fail('duplicate mission');
  if (OC.rosterCount(s) > OC.rosterCap(s)) fail('roster over cap');
  if (s.troops.filter(t => t.status === 'critical' && t.bed).length > OC.beds(s)) fail('more patients than beds');
  if (OC.slotsUsed(s) > OC.slots(s)) fail('more missions than slots');
  const busy = s.deployments.flatMap(d => d.squad).concat(s.guard, s.training);
  if (new Set(busy).size !== busy.length) fail('a troop has two jobs');
  s.deployments.forEach(d => { if (!s.missions.some(m => m.id === d.missionId)) fail('deployment without a mission'); });
  s.missions.filter(m => m.type === 'Siege').forEach(m => { if (m.fort < 0 || m.fort > m.fortMax) fail('Fort Points out of range'); });
  const outposts = s.missions.filter(m => m.type === 'Siege').length + s.taken;
  if (outposts > OC.OUTPOSTS) fail('too many outposts');
  if (s.phase === 'play' && outposts < outpostsExpected(s.day - 1)) fail(`an outpost went missing (${outposts})`);
  JSON.parse(JSON.stringify(s));
}

for (const policy of ['random', 'smart']) {
  for (const diff of ['easy', 'medium', 'hard']) {
    test(`${policy} player on ${diff}: 80 campaigns never break a rule`, () => {
      for (let g = 0; g < 80; g++) {
        const s = playCampaign({ seed: g * 104729 + 17, diff, policy, maxDay: 120, onDay: checkInvariants });
        assert.ok(['won', 'lost', 'play'].includes(s.phase));
      }
    });
  }
}

test('balance guard: the automated player wins Easy most of the time and Medium sometimes', () => {
  const rate = diff => {
    let won = 0;
    for (let g = 0; g < 150; g++) if (playCampaign({ seed: g * 7919 + 3, diff }).phase === 'won') won++;
    return won / 150;
  };
  const easy = rate('easy'), medium = rate('medium');
  assert.ok(easy > 0.8, `Easy win rate ${easy}`);
  assert.ok(medium > 0.3 && medium < 0.85, `Medium win rate ${medium}`);
});
