#!/usr/bin/env node
// Balance simulator: plays many automated campaigns per difficulty and prints win rates.
// Usage: node tools/sim.js [games-per-difficulty] [policy: smart|random]
'use strict';
const OC = require('../js/game.js');
const { playCampaign } = require('./policies.js');

const games = Number(process.argv[2] || 1000);
const policy = process.argv[3] || 'smart';

console.log(`Simulating ${games} ${policy} campaigns per difficulty...\n`);
for (const diff of ['easy', 'medium', 'hard']) {
  const st = { won: 0, base: 0, attrition: 0, stalled: 0, days: [], types: {} };
  for (let g = 0; g < games; g++) {
    const s = playCampaign({
      seed: g * 7919 + 3, diff, policy,
      onDay: (state, when) => {
        if (when !== 'after') return;
        state.debrief.forEach(e => { if (e.kind !== 'note') { const k = e.kind === 'mission' ? e.type : e.kind; st.types[k] = (st.types[k] || 0) + 1; } });
      }
    });
    if (s.phase === 'won') { st.won++; st.days.push(s.day - 1); }
    else if (s.phase === 'lost') s.lossReason === 'base' ? st.base++ : st.attrition++;
    else st.stalled++;
  }
  st.days.sort((a, b) => a - b);
  const pct = n => `${Math.round(n / games * 100)}%`;
  const median = st.days.length ? st.days[Math.floor(st.days.length / 2)] : '-';
  console.log(`${OC.DIFFS[diff].label.padEnd(7)} won ${pct(st.won).padStart(4)} | base fell ${pct(st.base).padStart(4)} | attrition ${pct(st.attrition).padStart(4)} | unfinished ${pct(st.stalled).padStart(4)} | median win day ${median}`);
  console.log(`        actions: ${Object.entries(st.types).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}\n`);
}
