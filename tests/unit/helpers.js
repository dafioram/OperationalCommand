'use strict';
const OC = require('../../js/game.js');

// A fresh campaign with every starting troop raised to a high level, for tests that need wins.
function veteranGame(seed = 1, diff = 'medium', level = 10) {
  const s = OC.newGame(seed, diff);
  s.troops.forEach(t => { t.level = level; t.xp = 0; });
  return s;
}

// Plays forward with no orders until a mission matching the predicate is visible, or gives up.
function advanceUntil(s, pred, maxDays = 30) {
  for (let i = 0; i < maxDays && s.phase === 'play'; i++) {
    if (s.missions.some(m => OC.visible(s, m) && pred(m))) return s.missions.find(m => OC.visible(s, m) && pred(m));
    OC.endDay(s);
  }
  return null;
}

const readyIds = (s, n) => s.troops.filter(t => !OC.availability(s, t)).slice(0, n).map(t => t.id);

module.exports = { OC, veteranGame, advanceUntil, readyIds };
