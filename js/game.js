'use strict';
/* Operational Command: game rules and state. No DOM access, so it runs in the browser and in Node for tests. */
const OC = (() => {
  const GUARD_MAX = 4, SCRIPTED_DAYS = 10, OUTPOSTS = 5, OUTPOST_DAYS = [14, 22], HAND = 4,
    REPAIR_COST = 15, REPAIR_AMT = 20, LOCATE_COST = 2, REVEAL_COST = 1, FORWARD_COST = 60, FORWARD_DEF = 3, GEAR_COST = 20,
    TRAIN_XP = 5, FIRE_COST = 15, FIRE_INTEL_MAX = 2, JAM_COST = 2, JAM_COOLDOWN = 3, SAVE_VERSION = 5;
  const DIFFS = {
    easy:   { label: 'Easy',   threat: -1, comp: 0.10, reinforce: false, reinfPer: 0, critDays: 2, moving: false, clockRate: 0,
              blurb: 'A weaker enemy that can’t reinforce, in a world that holds still.',
              rules: ['Every enemy is −1 threat', 'No enemy reinforcements or counterattacks', 'Armies hold position; the War Clock only moves when raids hurt you'] },
    medium: { label: 'Medium', threat: 0, comp: 0.15, reinforce: true, reinfPer: 0.10, critDays: 2, moving: true, clockRate: 1,
              blurb: 'The standard rules.',
              rules: ['Enemies reinforce zones you keep attacking', 'Armies march on your base; taken outposts get counterattacked', 'The War Clock rises every day'] },
    hard:   { label: 'Hard',   threat: 1, comp: 0.20, reinforce: true, reinfPer: 0.15, critDays: 1, moving: true, clockRate: 1.5,
              blurb: 'A stronger enemy and less room for error.',
              rules: ['Every enemy is +1 threat', 'Faster armies and a faster War Clock', 'Critical troops die after 1 day without a bed'] }
  };
  const D = s => DIFFS[s.diff] || DIFFS.medium;
  const ALERT_NAMES = ['Calm', 'Wary', 'Alert', 'Lockdown'];
  const alertOf = (s, z) => (D(s).reinforce && s.alert && s.alert[z]) || 0;
  const reinfChance = (s, z) => D(s).reinfPer * alertOf(s, z);
  const stage = s => Math.min(5, 1 + Math.floor((s.clock || 0) / 20));
  const escalation = s => stage(s) - 1;
  const compChance = s => D(s).comp + 0.05 * escalation(s);
  const bumpClock = (s, n) => { s.clock = Math.max(0, Math.min(100, (s.clock || 0) + n)); };
  const intelCap = s => (s.r && s.r.ia ? 20 : 10);
  const SIZE = { Scout: 2, Resource: 2, Rescue: 3, Recovery: 2, Siege: 4, Intercept: 4, Sabotage: 2, Hold: 3, Extraction: 3 };
  const QUIET = ['Scout', 'Sabotage'];
  const sizeOf = (m, s) => (m.size || SIZE[m.type] || 4) + (s && s.r && s.r.sd && ['Siege', 'Intercept', 'Hold'].includes(m.type) ? 1 : 0);
  const STANCES = {
    cautious:   { label: 'Cautious',   power: -1, inj: -1, reward: 0.75, note: '−1 power. Injuries one step lighter. −25% rewards. The squad withdraws if anything goes wrong.' },
    standard:   { label: 'Standard',   power: 0,  inj: 0,  reward: 1,    note: 'No modifiers.' },
    aggressive: { label: 'Aggressive', power: 1,  inj: 1,  reward: 1.25, note: '+1 power. Injuries one step heavier. +25% rewards.' }
  };
  const LADDER = ['ok', 'fatigued', 'wounded', 'critical', 'kia'];
  const STATUS_LABEL = { ok: 'Ready', fatigued: 'Fatigued', wounded: 'Wounded', critical: 'Critical', kia: 'KIA', mia: 'MIA', lost: 'Lost' };
  const OUT = {
    dec: { label: 'Decisive Victory', tone: 'good' }, vic: { label: 'Victory', tone: 'good' },
    set: { label: 'Setback', tone: 'warn' }, def: { label: 'Defeat', tone: 'bad' },
    rout: { label: 'Rout', tone: 'bad' }, wd: { label: 'Withdrawn', tone: 'warn' }
  };
  const CLASSES = {
    Assault: '+1 power. Stacks with other Assaults.',
    Scout: 'On an ambush, 70% chance to pull the squad out unharmed.',
    Medic: 'Once per mission, downgrades the worst injury one step.',
    Engineer: '+1 power on sieges and an extra Fort Point on a win. +1 on Home Guard.',
    Commander: '+1 Intel for each day deployed.'
  };
  const GEAR = {
    armor: { name: 'Body armor', effect: 'This troop’s injuries are one step lighter.' },
    rifle: { name: 'Marksman rifle', effect: 'Counts as 1 level higher for squad power.' }
  };
  const TRAITS = {
    garrison:  { label: 'Garrison', effect: 'A standard fort. No special effect.', ends: 'Its garrison surrenders.' },
    artillery: { label: 'Artillery', effect: 'Its raids hit 2 harder than other outposts’.', ends: 'Its guns go quiet; raids from the others hit softer.' },
    hub:       { label: 'Supply hub', effect: 'While it stands, other outposts rebuild a Fort Point after every quiet day instead of every two.', ends: 'The other outposts lose their supply line and rebuild slower.' },
    radar:     { label: 'Radar station', effect: 'While it stands, scouting can’t see armies. Only Intel can locate them.', ends: 'The radar goes dark. Your scouts can see armies again.' },
    depot:     { label: 'Army depot', effect: 'While it stands, it sends an extra army toward your base every 8 days.', ends: 'No more armies will march from the depot.' }
  };
  const BUILD = {
    infirmary: { name: 'Infirmary', max: 3, cost: [0, 0, 40, 70], effect: l => `${l + 1} beds${l >= 3 ? ', Wounded heal in 2 days' : ''}` },
    barracks:  { name: 'Barracks', max: 3, cost: [0, 0, 35, 60], effect: l => `Roster cap ${3 + 3 * l}` },
    grid:      { name: 'Defensive Grid', max: 3, cost: [0, 30, 55, 85], effect: l => l ? `+${2 * l} base defense` : 'Not built' }
  };
  const RESEARCH = {
    tc1:  { tier: 1, name: 'Tactical Command I', cost: 25, effect: '+1 mission slot (2 to 3)' },
    tc2:  { tier: 1, name: 'Tactical Command II', cost: 45, req: 'tc1', effect: '+1 mission slot (3 to 4)' },
    fi:   { tier: 1, name: 'Forward Intelligence', cost: 30, effect: 'Exact odds on every mission without spending Intel' },
    fm:   { tier: 1, name: 'Field Medicine', cost: 15, effect: 'Critical troops last 2 extra days without a bed' },
    sd:   { tier: 2, name: 'Squad Doctrine', cost: 50, req: 'tc1', effect: 'Siege, Intercept and Hold squads grow by 1' },
    sdoc: { tier: 2, name: 'Siege Doctrine', cost: 40, effect: 'Every siege win knocks down 1 extra Fort Point' },
    sig:  { tier: 2, name: 'Signals Network', cost: 35, effect: 'Every outpost raid is announced, even from forts you haven’t scouted' },
    ia:   { tier: 2, name: 'Intel Archive', cost: 20, effect: 'Intel storage 10 to 20' },
    art:  { tier: 2, name: 'Field Artillery', cost: 35, effect: 'Fire missions: shell an army or outpost in range. Uses a mission slot, no troops, 15 Materials a shot' },
    art2: { tier: 2, name: 'Heavy Shells', cost: 40, req: 'art', effect: 'Artillery hits do 2 damage instead of 1' },
    jam:  { tier: 2, name: 'Comms Jamming', cost: 30, effect: 'Freeze an army in place for a night. 2 Intel a use, then 3 days to recharge' }
  };
  const RECRUITS = {
    vasquez: { name: 'Vasquez', level: 3, xp: 0, cls: 'Medic' },
    ibarra:  { name: 'Ibarra', level: 2, xp: 12, cls: null },
    mbeki:   { name: 'Mbeki', level: 2, xp: 20, cls: null },
    dunmore: { name: 'Dunmore', level: 2, xp: 6, cls: null },
    holt:    { name: 'Holt', level: 3, xp: 10, cls: 'Scout' },
    sato:    { name: 'Sato', level: 3, xp: 0, cls: 'Engineer' }
  };
  const NAME_POOL = ['Adeyemi', 'Castellanos', 'Doyle', 'Eriksen', 'Farouk', 'Greaves', 'Halloran', 'Ivanova', 'Jonsson', 'Kowalczyk',
    'Laine', 'Moreau', 'Nakamura', 'Okoro', 'Petrov', 'Quintero', 'Rasmussen', 'Silva', 'Takahashi', 'Umar', 'Vance', 'Whitlock', 'Yilmaz', 'Zeller'];
  const MAT_SITES = ['Abandoned motor pool', 'Lumber yard', 'Supply drop', 'Depot sidings', 'Brickworks', 'Sawmill', 'Collapsed bunker', 'Farm co-op stores'];
  const TECH_SITES = ['Signal mast', 'Radio shack', 'Survey office', 'Weather station', 'Code room', 'Workshop ruins'];
  const RESCUE_SITES = ['Downed pilot', 'Stranded patrol', 'Farmhouse hostages', 'Field hospital', 'Captured medics', 'Lost signal team'];
  const RECON_SITES = ['Church tower', 'Hilltop post', 'Water tower', 'Bell tower', 'Quarry lip'];
  const EXTRACT_SITES = ['Cache behind the dam', 'Captured laboratory', 'Officer’s villa', 'Downed courier plane', 'Mountain relay vault'];
  const ARMY_PATHS = [[3, 1, 'base'], [4, 2, 'base'], [6, 5, 'base'], [5, 'base']];
  const OUTPOST_NAMES = ['Harrow', 'Dornig', 'Selm', 'Pollak'];
  const sideOf = z => (z >= 5 ? 'scoutedEast' : 'scouted');
  const sideName = flag => (flag === 'scoutedEast' ? 'eastern road' : 'western roads');
  const MISSIONS = [
    { from: 1, id: 'scout-hollow', type: 'Scout', name: 'Hollow Ridge relay', where: 'Sector 1 · Zone 2', zone: 2, threat: 0, flag: 'scouted',
      desc: 'Climb the ridge and watch the western roads (Zones 1 to 4). Warns you before Brandt raids the base, and spots armies and outposts in the west.',
      reward: { intel: 2 }, win: 'The ridge is manned. The western roads are under watch.' },
    { from: 1, until: 3, id: 'res-quarry', type: 'Resource', name: 'Quarry supply dump', where: 'Sector 1 · Zone 3', zone: 3, threat: 1,
      desc: 'An abandoned engineer cache. Lightly watched.', reward: { materials: 30 }, win: 'Crates loaded. The trucks roll out full.' },
    { from: 1, until: 3, id: 'rescue-kessel', type: 'Rescue', name: 'Kessel Fork crash site', where: 'Sector 1 · Zone 5', zone: 5, threat: 2,
      desc: 'A downed medevac. One survivor, a field medic, is pinned down in the wreck.',
      reward: { recruits: ['vasquez'] }, win: 'Vasquez is pulled from the wreck and walks out with the squad.' },
    { from: 2, id: 'siege-brandt', type: 'Siege', name: 'Outpost Brandt', where: 'Sector 1 · Zone 4', zone: 4, threat: 2, fort: 3, fortMax: 3, trait: 'garrison',
      raidFirst: 4, raidEvery: 4, raidBase: 3, warn: 'scouted',
      desc: 'The first of the outposts holding Sector 1. It raids your base every four days and rebuilds its walls when left alone.',
      reward: { techPerPoint: 8, materials: 25 }, win: 'The gate line at Brandt gives way.' },
    { from: 2, until: 4, id: 'res-rail', type: 'Resource', name: 'Rail yard salvage', where: 'Sector 1 · Zone 1', zone: 1, threat: 1,
      desc: 'Signal equipment left behind in the sidings.', reward: { tech: 12 }, win: 'Signal gear recovered intact.' },
    { from: 2, id: 'int-column', type: 'Intercept', name: '2nd Armored Column', where: 'Sector 1 · Zone 3, heading for Zone 1', zone: 3, threat: 3,
      army: 2, armyMax: 2, path: [3, 1, 'base'], every: 2, vis: 'scouted',
      desc: 'A heavy army marching on your base. Heavy armies move every second day. Prisoners ride in its trucks.',
      reward: { materials: 40, tech: 15, recruits: ['ibarra'] }, win: 'The column’s lead vehicles burn on the road.' },
    { from: 3, until: 5, id: 'scout-mill', type: 'Scout', name: 'Mill Road lookout', where: 'Sector 1 · Zone 6', zone: 6, threat: 1, flag: 'scoutedEast',
      desc: 'A lookout over the eastern road (Zones 5 and 6). Nothing is watching that road yet.',
      reward: { intel: 2 }, win: 'The lookout is manned. The eastern road is under watch.' },
    { from: 3, until: 5, id: 'res-signal', type: 'Resource', name: 'Relay station cache', where: 'Sector 1 · Zone 6', zone: 6, threat: 1,
      desc: 'Radio parts and a working decoder.', reward: { tech: 15 }, win: 'The decoder comes home in one piece.' },
    { from: 4, until: 6, id: 'rescue-convoy', type: 'Rescue', name: 'Ambushed convoy', where: 'Sector 1 · Zone 1', zone: 1, threat: 2,
      desc: 'Two drivers are holed up in a culvert after an ambush.',
      reward: { recruits: ['mbeki', 'dunmore'] }, win: 'Mbeki and Dunmore climb out of the culvert and into the truck.' },
    { from: 5, id: 'siege-varga', type: 'Siege', name: 'Outpost Varga', where: 'Sector 1 · Zone 6', zone: 6, threat: 3, fort: 5, fortMax: 5, trait: 'artillery',
      raidFirst: 7, raidEvery: 4, raidBase: 4, vis: 'scoutedEast',
      desc: 'A hilltop gun fort over the eastern road. It raids your base every four days.',
      reward: { techPerPoint: 8, materials: 35 }, win: 'Varga’s gun pits fall silent.' },
    { from: 5, until: 7, id: 'res-fuel', type: 'Resource', name: 'Fuel depot', where: 'Sector 1 · Zone 6', zone: 6, threat: 2,
      desc: 'A guarded depot with enough stock to pay for a building.', reward: { materials: 40 }, win: 'Tankers loaded. The depot burns behind you.' },
    { from: 6, id: 'int-company', type: 'Intercept', name: '3rd Rifle Company', where: 'Sector 1 · Zone 6, heading for Zone 5', zone: 6, threat: 2, size: 3,
      army: 2, armyMax: 2, path: [6, 5, 'base'], every: 1, vis: 'scoutedEast',
      desc: 'A fast infantry company moving on your base one zone per day.',
      reward: { materials: 25, tech: 10 }, win: 'The company scatters into the hills.' },
    { from: 7, until: 9, id: 'rescue-pow', type: 'Rescue', name: 'Prisoner transfer', where: 'Sector 1 · Zone 2', zone: 2, threat: 3,
      desc: 'Two specialists are being moved between camps under guard. A hard target with a big payoff.',
      reward: { recruits: ['holt', 'sato'] }, win: 'The guards break. Holt and Sato are free.' },
    { from: 8, until: 10, id: 'res-lab', type: 'Resource', name: 'Field laboratory', where: 'Sector 1 · Zone 2', zone: 2, threat: 2, size: 3,
      desc: 'An enemy research post, lightly held.', reward: { tech: 30 }, win: 'Notebooks and prototypes, all bagged.' },
    { from: 9, id: 'siege-kell', type: 'Siege', name: 'Outpost Kell', where: 'Sector 1 · Zone 1', zone: 1, threat: 3, fort: 5, fortMax: 5, trait: 'hub',
      raidFirst: 11, raidEvery: 4, raidBase: 4, vis: 'scouted',
      desc: 'The rail junction one zone from your base, dug in as the enemy’s supply hub.',
      reward: { techPerPoint: 8, materials: 35 }, win: 'The junction at Kell is yours.' },
    { from: 9, until: 10, id: 'res-train', type: 'Resource', name: 'Stalled supply train', where: 'Sector 1 · Zone 1', zone: 1, threat: 2,
      desc: 'A train stuck on a blown bridge.', reward: { materials: 35 }, win: 'The cars are stripped before the enemy arrives.' }
  ];

  function rand(s) {
    s.seed = (s.seed + 0x6D2B79F5) | 0;
    let t = s.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const pick = (s, arr) => arr[Math.floor(rand(s) * arr.length)];
  function shuffle(s, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand(s) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const fmt = x => String(Math.round(x * 10) / 10);
  const names = list => list.length <= 1 ? list.join('') : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
  const cap1 = k => k.charAt(0).toUpperCase() + k.slice(1);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const ordinal = n => { const sfx = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (sfx[(v - 20) % 10] || sfx[v] || sfx[0]); };
  function troop(rec) {
    return { id: rec.id, name: rec.name, level: rec.level, xp: rec.xp, cls: rec.cls || null, gear: null, status: 'ok', days: 0, crit: 0, bed: false };
  }
  const recObj = k => (typeof k === 'string' ? { id: k, ...RECRUITS[k] } : k);
  const spawnOne = (s, m) => {
    const mm = { ...m, threat: Math.max(0, m.threat + D(s).threat + escalation(s) + (alertOf(s, m.zone) >= 2 ? 1 : 0)), stay: 0, pos: 0, quiet: 0 };
    if (m.reward && m.reward.recruits) mm.reward = { ...m.reward, recruits: m.reward.recruits.map(recObj) };
    if (m.type === 'Intercept' && !D(s).moving) mm.where = `Sector 1 · Zone ${m.zone}, dug in`;
    return mm;
  };
  function newGame(seed, diff) {
    const s = {
      v: SAVE_VERSION, seed: seed | 0, diff: DIFFS[diff] ? diff : 'medium', day: 1, phase: 'play', lossReason: null,
      materials: 20, tech: 5, intel: 1, integrity: 100, clock: 0, taken: 0, takenZones: [], counters: [], fwd: null,
      seq: 0, armyNo: 3, nextArmy: 13, usedNames: [], jamReady: 1, orders: false,
      b: { infirmary: 1, barracks: 1, grid: 0 }, r: {},
      troops: [['reyes', 'Reyes', 34], ['okafor', 'Okafor', 22], ['lindqvist', 'Lindqvist', 30], ['tanaka', 'Tanaka', 12]]
        .map(([id, name, xp]) => troop({ id, name, level: 2, xp })),
      guard: [], training: [], fires: [], missions: [], deployments: [], revealed: {}, debrief: [], flags: {}, waiting: [],
      stats: { run: 0, won: 0, kia: 0, raids: 0, repelled: 0 },
      alert: { 1: 0, 2: 0, 3: 0, 4: 2, 5: 0, 6: 0 }
    };
    MISSIONS.filter(m => m.from === 1).forEach(m => s.missions.push(spawnOne(s, m)));
    return s;
  }
  // Brings older saves up to date. Version 4 gave forts a type; version 5 added training, artillery and jamming.
  function migrate(s) {
    if (!s) return s;
    if ((s.v || 0) < 4) migrate4(s);
    if (s.v < 5) {
      s.training = s.training || [];
      s.fires = s.fires || [];
      if (s.jamReady === undefined) s.jamReady = s.day;
      if (s.orders === undefined) s.orders = false;
      s.v = 5;
    }
    return s;
  }
  function migrate4(s) {
    const fixed = { 'siege-brandt': 'garrison', 'siege-varga': 'artillery', 'siege-kell': 'hub' };
    const spare = ['radar', 'depot'];
    s.missions.filter(m => m.type === 'Siege').forEach(m => {
      m.trait = fixed[m.id] || spare.shift() || 'garrison';
      if (m.trait === 'depot') m.depotNext = s.day + 3;
    });
    s.takenZones = s.takenZones || [];
    s.counters = s.counters || [];
    if (s.fwd === undefined) s.fwd = null;
    s.troops.forEach(t => { if (t.gear === undefined) t.gear = null; });
    s.deployments.forEach(d => { if (!d.daysLeft) { d.daysLeft = 1; d.startDay = s.day; } });
    s.v = 4;
  }

  const byId = (s, id) => s.troops.find(t => t.id === id);
  const living = t => t.status !== 'kia' && t.status !== 'mia' && t.status !== 'lost';
  const onRoster = t => t.status !== 'kia' && t.status !== 'lost';
  const rosterCount = s => s.troops.filter(onRoster).length;
  const rosterCap = s => 3 + 3 * s.b.barracks;
  const beds = s => s.b.infirmary + 1;
  const slots = s => 2 + (s.r.tc1 ? 1 : 0) + (s.r.tc2 ? 1 : 0);
  const woundDays = s => (s.b.infirmary >= 3 ? 2 : 3);
  const critWindow = s => D(s).critDays + (s.r.fm ? 2 : 0);
  const standing = (s, trait) => s.missions.some(m => m.type === 'Siege' && m.trait === trait);
  function visible(s, m) {
    if (m.located) return true;
    if (m.type === 'Intercept' && standing(s, 'radar')) return false;
    return !m.vis || !!s.flags[m.vis];
  }
  const deployedIds = s => s.deployments.flatMap(d => d.squad);
  function availability(s, t) {
    if (t.status !== 'ok') return STATUS_LABEL[t.status];
    if (s.guard.includes(t.id)) return 'Home Guard';
    if ((s.training || []).includes(t.id)) return 'Training';
    if (deployedIds(s).includes(t.id)) return s.deployments.some(d => d.squad.includes(t.id) && d.startDay < s.day) ? 'In the field' : 'Deployed';
    return null;
  }
  const slotsUsed = s => s.deployments.length + (s.fires || []).length;
  const slotsFree = s => slots(s) - slotsUsed(s);
  const fwdBonus = (s, m) => (s.fwd && m.zone && Math.abs(m.zone - s.fwd) <= 1 ? 1 : 0);
  const ambushBonus = (s, m) => (m.ambush && s.day <= m.ambushUntil ? 2 : 0);
  function power(s, ids, stance, m) {
    const ts = ids.map(id => byId(s, id)).filter(Boolean);
    const n = ts.length;
    if (!n) return null;
    const size = sizeOf(m, s);
    const avg = ts.reduce((a, t) => a + t.level + (t.gear === 'rifle' ? 1 : 0), 0) / n;
    const st = STANCES[stance].power;
    const assault = ts.filter(t => t.cls === 'Assault').length;
    const eng = m.type === 'Siege' && ts.some(t => t.cls === 'Engineer') ? 1 : 0;
    const fwd = fwdBonus(s, m);
    const amb = ambushBonus(s, m);
    const gap = Math.max(0, size - n);
    return { avg, st, assault, eng, fwd, amb, gap, n, size, total: avg + st + assault + eng + fwd + amb - gap };
  }
  const chance = (p, threat) => Math.max(5, Math.min(95, Math.round(50 + 10 * (p - threat))));
  const band = ch => ch >= 75 ? 'Favorable' : ch >= 45 ? 'Even' : ch >= 25 ? 'Risky' : 'Desperate';
  const guardValue = t => 1 + t.level / 2 + (t.cls === 'Engineer' ? 1 : 0);
  function defense(s) {
    const guards = s.guard.map(id => byId(s, id)).filter(t => t && t.status === 'ok');
    const g = guards.reduce((a, t) => a + guardValue(t), 0);
    return { grid: 2 * s.b.grid, guard: g, total: 2 * s.b.grid + g, n: guards.length };
  }
  function nightsToBase(s, m) {
    const every = s.diff === 'hard' ? 1 : m.every;
    const steps = m.path.length - 1 - m.pos;
    return Math.max(1, (every - m.stay) + (steps - 1) * every) + (m.frozenDay === s.day ? 1 : 0);
  }
  // Artillery reaches Zones 1 to 3 from the base, or the zones next to a forward base.
  const inRange = (s, m) => !!m.zone && (m.zone <= 3 || (!!s.fwd && Math.abs(m.zone - s.fwd) <= 1));
  const fireChance = (s, m, intel) => Math.min(95, (s.flags[sideOf(m.zone)] ? 60 : 30) + 15 * intel);
  const fireDamage = s => (s.r.art2 ? 2 : 1);
  const canJam = s => !!s.r.jam && D(s).moving && s.day >= (s.jamReady || 0) && s.intel >= JAM_COST;
  const raidStrength = (s, m) => m.raidBase + D(s).threat + escalation(s) + (m.trait === 'artillery' ? 2 : 0);
  const nextRaidDay = (m, day) => day <= m.raidFirst ? m.raidFirst : m.raidFirst + Math.ceil((day - m.raidFirst) / m.raidEvery) * m.raidEvery;
  const raidWarned = (s, m) => !!s.r.sig || (visible(s, m) && (!m.warn || !!s.flags[m.warn]));
  function threats(s) {
    const out = [];
    s.missions.filter(m => m.type === 'Siege' && m.raidEvery && raidWarned(s, m)).forEach(m => {
      out.push({ id: m.id, name: `Raiders from ${visible(s, m) ? m.name : 'an unseen outpost'}`, strength: raidStrength(s, m), nights: nextRaidDay(m, s.day) - s.day + 1, raid: true });
    });
    if (D(s).moving) {
      s.missions.filter(m => m.type === 'Intercept' && visible(s, m))
        .forEach(m => out.push({ id: m.id, name: `The ${m.name}`, strength: m.threat + m.army, nights: nightsToBase(s, m) }));
    }
    return out.sort((a, b) => a.nights - b.nights);
  }
  function hiddenReports(s) {
    return s.missions.filter(m => (m.type === 'Siege' || m.type === 'Intercept') && !visible(s, m)).map(m => ({
      id: m.id, kind: m.type === 'Siege' ? 'outpost' : 'army', side: sideName(m.vis || sideOf(m.zone)),
      jammed: m.type === 'Intercept' && !!s.flags[m.vis] && standing(s, 'radar')
    }));
  }

  function deploy(s, missionId, ids, stance) {
    if (s.phase !== 'play' || slotsFree(s) <= 0) return false;
    const m = s.missions.find(x => x.id === missionId);
    if (!m || !visible(s, m) || !STANCES[stance]) return false;
    if (!ids.length || ids.length > sizeOf(m, s)) return false;
    if (s.deployments.some(d => d.missionId === missionId)) return false;
    if (ids.some(id => !byId(s, id) || availability(s, byId(s, id)))) return false;
    s.deployments.push({ missionId, squad: ids.slice(), stance, daysLeft: m.days || 1, startDay: s.day });
    return true;
  }
  function recall(s, missionId) { s.deployments = s.deployments.filter(d => d.missionId !== missionId || d.startDay < s.day); }
  function reveal(s, missionId) {
    if (s.r.fi || s.intel < REVEAL_COST || s.revealed[missionId]) return false;
    s.intel -= REVEAL_COST; s.revealed[missionId] = true; return true;
  }
  function locate(s, missionId) {
    const m = s.missions.find(x => x.id === missionId);
    if (!m || visible(s, m) || s.intel < LOCATE_COST || s.phase !== 'play') return false;
    s.intel -= LOCATE_COST; m.located = true; return true;
  }
  function toggleGuard(s, id) {
    const i = s.guard.indexOf(id);
    if (i >= 0) { s.guard.splice(i, 1); return true; }
    const t = byId(s, id);
    if (!t || t.status !== 'ok' || deployedIds(s).includes(id) || s.training.includes(id) || s.guard.length >= GUARD_MAX) return false;
    s.guard.push(id); return true;
  }
  function toggleTraining(s, id) {
    const i = s.training.indexOf(id);
    if (i >= 0) { s.training.splice(i, 1); return true; }
    const t = byId(s, id);
    if (!t || t.status !== 'ok' || deployedIds(s).includes(id) || s.guard.includes(id) || s.phase !== 'play') return false;
    s.training.push(id); return true;
  }
  function planFire(s, missionId, intel) {
    const m = s.missions.find(x => x.id === missionId);
    intel = Math.max(0, Math.min(FIRE_INTEL_MAX, intel | 0));
    if (!s.r.art || s.phase !== 'play' || slotsFree(s) <= 0 || !m) return false;
    if (!['Siege', 'Intercept'].includes(m.type) || !visible(s, m) || !inRange(s, m)) return false;
    if (s.fires.some(f => f.missionId === missionId) || s.materials < FIRE_COST || s.intel < intel) return false;
    s.materials -= FIRE_COST; s.intel -= intel;
    s.fires.push({ missionId, intel });
    return true;
  }
  function cancelFire(s, missionId) {
    const f = s.fires.find(x => x.missionId === missionId);
    if (!f) return false;
    s.materials += FIRE_COST; s.intel = Math.min(intelCap(s), s.intel + f.intel);
    s.fires = s.fires.filter(x => x !== f);
    return true;
  }
  function jam(s, missionId) {
    const m = s.missions.find(x => x.id === missionId);
    if (!m || m.type !== 'Intercept' || !visible(s, m) || !canJam(s) || s.phase !== 'play') return false;
    s.intel -= JAM_COST; m.frozenDay = s.day; s.jamReady = s.day + JAM_COOLDOWN;
    return true;
  }
  function build(s, key) {
    const b = BUILD[key]; if (!b) return false;
    const next = s.b[key] + 1;
    if (next > b.max || s.materials < b.cost[next]) return false;
    s.materials -= b.cost[next]; s.b[key] = next; return true;
  }
  function research(s, key) {
    const r = RESEARCH[key]; if (!r || s.r[key]) return false;
    if (r.req && !s.r[r.req]) return false;
    if (s.tech < r.cost) return false;
    s.tech -= r.cost; s.r[key] = true;
    return true;
  }
  function repair(s) {
    if (s.materials < REPAIR_COST || s.integrity >= 100 || s.integrity <= 0) return false;
    s.materials -= REPAIR_COST; s.integrity = Math.min(100, s.integrity + REPAIR_AMT); return true;
  }
  const forwardZones = s => s.takenZones.filter(z => !s.missions.some(m => m.type === 'Siege' && m.zone === z));
  function buildForward(s, zone) {
    if (s.fwd || !forwardZones(s).includes(zone) || s.materials < FORWARD_COST || s.phase !== 'play') return false;
    s.materials -= FORWARD_COST; s.fwd = zone; return true;
  }
  function buyGear(s, id, g) {
    const t = byId(s, id);
    if (!t || !GEAR[g] || t.gear || !living(t) || s.tech < GEAR_COST || s.phase !== 'play') return false;
    s.tech -= GEAR_COST; t.gear = g; return true;
  }
  function setClass(s, id, cls) {
    const t = byId(s, id);
    if (!t || t.cls || t.level < 3 || !CLASSES[cls]) return false;
    t.cls = cls; return true;
  }
  function gainXp(t, amt, r) {
    t.xp += amt;
    while (t.level < 10 && t.xp >= 20 * t.level) {
      t.xp -= 20 * t.level; t.level += 1;
      r.levelups.push(t.level === 3 && !t.cls ? `${t.name} reaches Level 3 and can choose a class on the Roster tab.` : `${t.name} reaches Level ${t.level}.`);
    }
    if (t.level >= 10) t.xp = Math.min(t.xp, 20 * t.level - 1);
  }
  function recruit(s, rec, r) {
    if (byId(s, rec.id) || s.waiting.some(w => w.rec.id === rec.id)) return;
    if (rosterCount(s) < rosterCap(s)) { s.troops.push(troop(rec)); r.rewards.push(`${rec.name} joins (Level ${rec.level}${rec.cls ? ' ' + rec.cls : ''})`); }
    else { s.waiting.push({ rec, days: 3 }); r.rewards.push(`${rec.name} waits at the rescue site: barracks full`); }
  }
  function genRecruit(s, level) {
    const free = NAME_POOL.filter(n => !s.usedNames.includes(n));
    const name = free.length ? pick(s, free) : `${pick(s, NAME_POOL)} ${s.seq}`;
    s.usedNames.push(name);
    const r = rand(s);
    const lv = level || (r < 0.25 ? 1 : r < 0.8 ? 2 : 3);
    s.seq += 1;
    return { id: 'x' + s.seq, name, level: lv, xp: Math.floor(rand(s) * 10 * lv), cls: lv >= 3 ? pick(s, Object.keys(CLASSES)) : null };
  }
  // Deals a varied hand: a new mission never repeats a kind that is already open,
  // avoids zones that already hold an open generated mission, and never reuses an open mission's name.
  function genMission(s) {
    s.seq += 1;
    const id = 'g' + s.seq, until = s.day + 2;
    const blind = ['scouted', 'scoutedEast'].filter(f => !s.flags[f]);
    const open = s.missions.filter(m => m.gen && m.kind);
    const openKinds = open.map(m => m.kind);
    const sabTargets = s.missions.filter(m => (m.type === 'Siege' || (m.type === 'Intercept' && D(s).moving)) && visible(s, m)
      && !s.missions.some(x => x.type === 'Sabotage' && x.target === m.id));
    let kind;
    if (blind.length && !openKinds.includes('recon')) kind = 'recon';
    else {
      const weights = { materials: 4, tech: 3, rescue: 3, recon: blind.length ? 0 : 1, sabotage: sabTargets.length ? 3 : 0, extract: s.day >= 12 ? 2 : 0 };
      const pool = Object.keys(weights).filter(k => weights[k] > 0 && !openKinds.includes(k));
      const choices = pool.length ? pool : ['materials', 'tech', 'rescue'];
      const total = choices.reduce((a, k) => a + weights[k], 0);
      let r = rand(s) * total;
      kind = choices.find(k => (r -= weights[k]) < 0) || choices[0];
    }
    const takenZones = open.map(m => m.zone);
    const zoneFrom = list => { const free = list.filter(z => !takenZones.includes(z)); return pick(s, free.length ? free : list); };
    const nameFrom = list => { const free = list.filter(n => !s.missions.some(m => m.name === n)); return pick(s, free.length ? free : list); };
    let zone = zoneFrom([1, 2, 3, 4, 5, 6]);
    const lv = escalation(s);
    const type = { recon: 'Scout', rescue: 'Rescue', sabotage: 'Sabotage', extract: 'Extraction' }[kind] || 'Resource';
    const base = { id, gen: true, until, type, kind };
    if (type === 'Scout') {
      if (blind.length) zone = zoneFrom(blind[0] === 'scoutedEast' ? [5, 6] : [1, 2, 3, 4]);
      const flag = sideOf(zone);
      return spawnOne(s, { ...base, name: nameFrom(RECON_SITES), where: `Sector 1 · Zone ${zone}`, zone, threat: rand(s) < 0.5 ? 0 : 1, flag,
        desc: `A vantage point over the ${sideName(flag)}.`, reward: { intel: 2 }, win: `The post is manned. The ${sideName(flag)} are under watch.` });
    }
    if (type === 'Sabotage') {
      const t = pick(s, sabTargets);
      const fort = t.type === 'Siege';
      return { ...base, name: `Sabotage ${fort ? t.name : 'the ' + t.name}`, where: `Sector 1 · Zone ${t.zone}`, zone: t.zone, target: t.id,
        threat: Math.max(0, t.threat - 1), until: s.day + 1, stay: 0, pos: 0, quiet: 0, reward: {},
        desc: fort ? 'Slip in at night and blow a hole in the walls. Saboteurs go unnoticed: no zone alert.' : 'Mine the road ahead of the army. Saboteurs go unnoticed: no zone alert.',
        win: fort ? 'Charges go off under the east wall.' : 'The lead vehicles hit the mines and the column stalls.' };
    }
    if (type === 'Extraction') {
      const specialist = rand(s) < 0.5;
      const rec = specialist ? [genRecruit(s, 4)] : undefined;
      return spawnOne(s, { ...base, name: nameFrom(EXTRACT_SITES), where: `Sector 1 · Zone ${zoneFrom([3, 4, 5, 6])}, deep territory`, zone: zoneFrom([3, 4, 5, 6]),
        threat: 3, days: 2, until: s.day + 1,
        desc: 'Two days behind enemy lines. Complications can hit on the way in and again on the way out.',
        reward: specialist ? { recruits: rec } : { tech: 40 + 8 * lv },
        win: specialist ? `${rec[0].name} is out, with everything they knew.` : 'The cache is emptied and carried out on foot.' });
    }
    if (type === 'Rescue') {
      const recs = [genRecruit(s)];
      if (rand(s) < 0.3) recs.push(genRecruit(s));
      return spawnOne(s, { ...base, name: nameFrom(RESCUE_SITES), where: `Sector 1 · Zone ${zone}`, zone, threat: 2 + (rand(s) < 0.35 ? 1 : 0),
        desc: recs.length > 1 ? 'Two survivors are waiting for pickup behind enemy lines.' : 'A survivor is waiting for pickup behind enemy lines.',
        reward: { recruits: recs }, win: `${names(recs.map(x => x.name))} ${recs.length > 1 ? 'are' : 'is'} brought out alive.` });
    }
    const tech = kind === 'tech';
    const threat = 1 + (rand(s) < 0.5 ? 1 : 0);
    return spawnOne(s, { ...base, name: nameFrom(tech ? TECH_SITES : MAT_SITES), where: `Sector 1 · Zone ${zone}`, zone, threat,
      size: threat >= 2 && rand(s) < 0.4 ? 3 : 2,
      desc: tech ? 'Equipment and papers worth carrying home.' : 'Stockpiled supplies, lightly guarded.',
      reward: tech ? { tech: 12 + Math.floor(rand(s) * 10) + 4 * lv } : { materials: 25 + Math.floor(rand(s) * 16) + 6 * lv },
      win: tech ? 'Everything useful is crated and carried out.' : 'The trucks roll home loaded.' });
  }
  function genOutpost(s) {
    const used = s.missions.filter(m => m.type === 'Siege').map(m => m.zone).concat(s.takenZones);
    const zones = [2, 3, 5, 6, 4, 1].filter(z => !used.includes(z));
    const zone = zones.length ? pick(s, zones) : pick(s, [2, 3, 5, 6]);
    const nm = 'Outpost ' + OUTPOST_NAMES.filter(n => !s.missions.some(m => m.name === 'Outpost ' + n))[0];
    const had = s.missions.filter(m => m.type === 'Siege').map(m => m.trait).concat(s.takenTraits || []);
    const trait = ['radar', 'depot'].filter(t => !had.includes(t))[0] || pick(s, ['radar', 'depot']);
    s.seq += 1;
    const m = spawnOne(s, { id: 'op' + s.seq, gen: true, type: 'Siege', name: nm, where: `Sector 1 · Zone ${zone}`, zone, threat: 3, fort: 5, fortMax: 5, trait,
      raidFirst: s.day + 3, raidEvery: 4, raidBase: 4, vis: sideOf(zone),
      desc: 'A fort the enemy built later in the campaign to hold Sector 1. It raids your base every four days.',
      reward: { techPerPoint: 8, materials: 35 }, win: 'The new fort falls before its walls have set.' });
    if (trait === 'depot') m.depotNext = s.day + 3;
    return m;
  }
  function genArmy(s) {
    const path = pick(s, ARMY_PATHS);
    const heavy = rand(s) < 0.4;
    s.armyNo += 1;
    const name = `${ordinal(s.armyNo)} ${heavy ? pick(s, ['Armored Column', 'Motor Battalion']) : pick(s, ['Rifle Company', 'Assault Group', 'Ranger Platoon'])}`;
    const prisoner = rand(s) < 0.5 ? [genRecruit(s)] : undefined;
    const m = spawnOne(s, { id: 'army' + s.armyNo, gen: true, type: 'Intercept', name, zone: path[0], path,
      where: `Sector 1 · Zone ${path[0]}, heading for ${path[1] === 'base' ? 'your base' : 'Zone ' + path[1]}`,
      threat: heavy ? 3 : 2, size: heavy ? 4 : 3, army: heavy ? 3 : 2, armyMax: heavy ? 3 : 2, every: heavy ? 2 : 1, vis: sideOf(path[0]),
      desc: heavy ? 'A heavy army marching on your base. It moves every second day.' : 'A fast force moving on your base one zone per day.',
      reward: { materials: heavy ? 40 : 25, tech: heavy ? 15 : 10, recruits: prisoner },
      win: heavy ? 'The column’s lead vehicles burn on the road.' : 'The enemy force breaks and scatters.' });
    // Mission chain: captured orders from an earlier fight reveal this army and set up an ambush.
    if (s.orders) {
      s.orders = false;
      m.located = true; m.ambush = true; m.ambushUntil = s.day + 1; m.chain = true;
      m.desc += ' Captured orders gave away its route: ambush it in the next two days for +2 power.';
    }
    return m;
  }
  function chainCache(s, near) {
    const lv = escalation(s);
    const tech = rand(s) < 0.4;
    const zone = Math.max(1, Math.min(6, near + (rand(s) < 0.5 ? -1 : 1)));
    s.seq += 1;
    return spawnOne(s, { id: 'chain' + s.seq, chain: true, type: 'Resource', name: tech ? 'Abandoned signal cache' : 'Unguarded supply cache',
      where: `Sector 1 · Zone ${zone}`, zone, threat: 1, until: s.day + 3,
      desc: 'Spotted from a lookout. Lightly guarded, and bigger than the usual pickings.',
      reward: tech ? { tech: 25 + 5 * lv } : { materials: 45 + 8 * lv },
      win: 'The cache is loaded up and hauled home.' });
  }
  function chainWeakSpot(s, t, who) {
    s.seq += 1;
    return { id: 'chain' + s.seq, chain: true, type: 'Sabotage', name: `Weak spot: ${t.name}`, where: `Sector 1 · Zone ${t.zone}`, zone: t.zone,
      target: t.id, dmg: 2, threat: Math.max(0, t.threat - 2), until: s.day + 3, stay: 0, pos: 0, quiet: 0, reward: {},
      desc: `${who} knows where ${t.name}’s walls are weakest. Knocks out 2 Fort Points and stops rebuilding for 3 days. Saboteurs go unnoticed: no zone alert.`,
      win: 'The charges bring down a whole section of wall.' };
  }
  function resolveFire(s, f) {
    const m = s.missions.find(x => x.id === f.missionId);
    if (!m) return null;
    const ch = fireChance(s, m, f.intel);
    const roll = Math.floor(rand(s) * 100) + 1;
    const dmg = fireDamage(s);
    const log = [];
    const r = { kind: 'fire', missionId: m.id, name: `Fire mission: ${m.type === 'Intercept' ? 'the ' : ''}${m.name}`, squad: [], stance: 'Artillery', log,
      injuries: [], rewards: [], levelups: [], outcome: null, tone: null, done: false };
    log.push(['0500', `The battery fires on ${m.type === 'Intercept' ? 'the ' : ''}${m.name} in Zone ${m.zone}${f.intel ? `, guided by ${f.intel} Intel` : ''}.`, true]);
    if (roll > ch) {
      r.outcome = 'Miss'; r.tone = 'warn';
      log.push(['0510', `The shells land wide. Odds ${ch}%, rolled ${roll}.`]);
      return r;
    }
    r.outcome = 'Hit'; r.tone = 'good';
    if (m.type === 'Siege') {
      const before = m.fort; m.fort = Math.max(1, m.fort - dmg); m.quiet = 0;
      log.push(['0510', `Direct hits on the walls: Fort Points ${before} to ${m.fort}. Odds ${ch}%, rolled ${roll}.`]);
    } else {
      m.army = Math.max(0, m.army - dmg);
      log.push(['0510', `Shells rake the column: Army Strength ${m.army} of ${m.armyMax}. Odds ${ch}%, rolled ${roll}.`]);
      if (m.army === 0) {
        bumpClock(s, -8); r.done = true;
        log.push(['0520', `The ${m.name} is wiped out. Nothing is left to salvage. The War Clock drops 8.`, true]);
      }
    }
    return r;
  }
  function injure(s, t, v, r, log, src) {
    if (v === 'mia') {
      t.status = 'mia'; t.days = 5;
      r.injuries.push({ name: t.name, status: 'mia' });
      log.push(['1400', `${t.name} is missing in action. A search mission is open for 5 days.`]);
      if (!s.missions.some(x => x.id === 'rec-' + t.id)) {
        s.missions.push(spawnOne(s, { id: 'rec-' + t.id, type: 'Recovery', name: `Search for ${t.name}`, where: src.where, zone: src.zone, threat: 1,
          desc: `${t.name} was captured near ${src.name}. The trail goes cold in 5 days.`, troopId: t.id, reward: {},
          win: `${t.name} is found alive in a holding pen and brought out.` }));
      }
    } else if (v === 4) {
      t.status = 'kia'; s.stats.kia += 1;
      r.injuries.push({ name: t.name, status: 'kia' });
      log.push(['1400', `${t.name} is killed in action.`]);
    } else if (v === 3) {
      const cw = critWindow(s);
      t.status = 'critical'; t.crit = cw; t.days = 2; t.bed = false;
      r.injuries.push({ name: t.name, status: 'critical' });
      log.push(['1400', `${t.name} is critical and needs an infirmary bed within ${plural(cw, 'day', 'days')}.`]);
    } else if (v === 2) {
      t.status = 'wounded'; t.days = woundDays(s);
      r.injuries.push({ name: t.name, status: 'wounded' });
      log.push(['1400', `${t.name} is wounded: ${plural(t.days, 'day', 'days')} in the infirmary.`]);
    } else if (v === 1) {
      t.status = 'fatigued'; t.days = 1;
      r.injuries.push({ name: t.name, status: 'fatigued' });
      log.push(['1400', `${t.name} is fatigued and sits out tomorrow.`]);
    }
  }
  // The enemy retakes an outpost after a lost or ignored counterattack.
  function retake(s, def, notes) {
    const back = { ...def, fort: Math.min(2, def.fortMax), quiet: 0, noRebuild: 0, raidFirst: s.day + 2, located: def.located };
    s.missions.push(back);
    s.taken = Math.max(0, s.taken - 1);
    s.takenZones = s.takenZones.filter(z => z !== def.zone);
    s.takenTraits = (s.takenTraits || []).filter(t => t !== def.trait);
    notes.push(['bad', `The enemy retakes ${def.name}. It is back with 2 Fort Points and will raid again.`]);
    if (s.fwd === def.zone) { s.fwd = null; notes.push(['bad', `Your forward base in Zone ${def.zone} is overrun.`]); }
  }

  function resolve(s, dep, notes) {
    const m = s.missions.find(x => x.id === dep.missionId);
    if (!m) return null;
    const squad = dep.squad.map(id => byId(s, id));
    const st = STANCES[dep.stance];
    const p = power(s, dep.squad, dep.stance, m);
    let pw = p.total, threat = m.threat;
    const log = [];
    const r = { kind: 'mission', missionId: m.id, type: m.type, name: m.name, stance: st.label,
      squad: squad.map(t => t.name), log, injuries: [], rewards: [], levelups: [],
      outcome: null, tone: null, chance: null, roll: null, comp: null, done: false };
    s.stats.run += 1;
    log.push(['0540', `${names(r.squad)} move out toward ${m.name}. Orders: ${st.label.toLowerCase()}.`]);
    if (m.days > 1) log.push(['0550', `A ${m.days}-day operation: the squad returns at the end of Day ${s.day}.`]);
    if (p.gap) log.push(['0555', `The squad is ${plural(p.gap, 'troop', 'troops')} short of the ${p.size} this mission needs: −${p.gap} power.`]);
    if (p.fwd) log.push(['0600', `Support from the forward base in Zone ${s.fwd}: +1 power.`]);
    if (squad.some(t => t.cls === 'Commander')) {
      const before = s.intel; s.intel = Math.min(intelCap(s), s.intel + (m.days || 1));
      if (s.intel > before) r.rewards.push(`+${s.intel - before} Intel (Commander)`);
    }

    const legs = m.type === 'Extraction' ? 2 : 1;
    for (let i = 0; i < legs; i++) {
      let comp = null;
      const ra = reinfChance(s, m.zone);
      if (ra > 0 && rand(s) < ra) comp = 'reinforcements';
      else if (rand(s) < compChance(s)) comp = 'ambush';
      if (!comp) continue;
      r.comp = comp;
      const leg = legs > 1 ? (i === 0 ? 'On the way in: ' : 'On the way out: ') : '';
      if (comp === 'ambush') { pw -= 2; log.push([i ? '1600' : '0710', `${leg}Ambush. The squad fights at −2 power.`, true]); }
      else { threat += 2; log.push([i ? '1600' : '0930', `${leg}Zone ${m.zone} is on ${ALERT_NAMES[alertOf(s, m.zone)]}: enemy reinforcements arrive. Threat rises by 2.`, true]); }
      let out = null;
      if (dep.stance === 'cautious') out = 'Cautious orders: the squad breaks contact and withdraws. No losses, nothing gained.';
      else if (comp === 'ambush') {
        const sc = squad.find(t => t.cls === 'Scout');
        if (sc) {
          if (rand(s) < 0.7) out = `${sc.name} spots the trap in time and pulls the squad out. No losses, nothing gained.`;
          else log.push([i ? '1610' : '0720', `${sc.name} looks for a way out, but the squad is pinned.`]);
        }
      }
      if (out) {
        r.outcome = OUT.wd.label; r.tone = OUT.wd.tone;
        log.push([i ? '1630' : '0945', out]);
        squad.forEach(t => gainXp(t, 2, r));
        if (m.type === 'Hold') { r.done = true; retake(s, m.def, notes); log.push(['1000', `Without a defense, ${m.def.name} is lost.`, true]); }
        return r;
      }
    }

    const ch = chance(pw, threat);
    const roll = Math.floor(rand(s) * 100) + 1;
    let out;
    if (roll <= ch) out = roll <= Math.max(1, Math.floor(ch / 3)) ? 'dec' : 'vic';
    else {
      const f = rand(s) * 100;
      const split = ch < 25 ? [30, 40] : [50, 35];
      out = f < split[0] ? 'set' : f < split[0] + split[1] ? 'def' : 'rout';
    }
    const win = out === 'dec' || out === 'vic';
    r.chance = ch; r.roll = roll; r.outcome = OUT[out].label; r.tone = OUT[out].tone;
    log.push(['1130', {
      dec: m.win + ' Clean work.', vic: m.win,
      set: m.type === 'Hold' ? 'The line bends but holds. It costs the squad.' : 'Heavy resistance. The squad pulls back with only part of the objective.',
      def: 'The attack stalls under fire. The squad falls back empty-handed.',
      rout: 'The squad is overrun and scatters under fire.'
    }[out], true]);

    const ids = squad.map(t => t.id);
    const inj = {}; ids.forEach(id => { inj[id] = 0; });
    const order = shuffle(s, ids);
    if (out === 'vic' && rand(s) < 0.25) inj[order[0]] = 1;
    if (out === 'set') { const n = Math.min(ids.length, 1 + (rand(s) < 0.5 ? 1 : 0)); order.slice(0, n).forEach(id => { inj[id] = 2; }); }
    if (out === 'def') { ids.forEach(id => { inj[id] = 2; }); inj[order[0]] = 3; }
    if (out === 'rout') { ids.forEach(id => { inj[id] = rand(s) < 0.5 ? 2 : 3; }); inj[order[0]] = rand(s) < 0.5 ? 4 : 'mia'; }
    ids.forEach(id => {
      const v = inj[id];
      if (v === 'mia') { if (st.inj < 0) inj[id] = 3; }
      else if (v > 0) {
        const armor = byId(s, id).gear === 'armor' ? 1 : 0;
        inj[id] = Math.max(0, Math.min(4, v + st.inj - armor));
      }
    });
    const medic = squad.find(t => t.cls === 'Medic' && inj[t.id] !== 'mia');
    if (medic) {
      let worst = null;
      ids.forEach(id => { const v = inj[id]; if (v !== 'mia' && v > 0 && (worst === null || v > inj[worst])) worst = id; });
      if (worst !== null) {
        const before = inj[worst]; inj[worst] = before - 1;
        const who = byId(s, worst);
        const after = inj[worst] === 0 ? 'unhurt' : STATUS_LABEL[LADDER[inj[worst]]].toLowerCase();
        log.push(['1300', `${medic.name} works on ${who.id === medic.id ? 'their own wounds' : who.name}: ${STATUS_LABEL[LADDER[before]].toLowerCase()} becomes ${after}.`, true]);
      }
    }
    squad.forEach(t => injure(s, t, inj[t.id], r, log, m));

    const mult = st.reward * (out === 'set' ? 0.5 : 1) * (out === 'dec' ? 1.5 : 1);
    const give = (key, amt) => {
      let n = Math.round(amt);
      if (key === 'intel') n = Math.min(n, intelCap(s) - s.intel);
      if (n > 0) { s[key] += n; r.rewards.push(`+${n} ${cap1(key)}`); }
    };
    const eng = win && squad.some(t => t.cls === 'Engineer') ? 1 : 0;
    if (m.type === 'Scout') {
      if (win || out === 'set') give('intel', m.reward.intel * mult);
      if (win) {
        r.done = true;
        if (!s.flags[m.flag]) {
          s.flags[m.flag] = true;
          s.missions.filter(x => x.vis === m.flag && !x.located && visible(s, x)).forEach(x => log.push(['1500', `Spotted: ${x.type === 'Siege' ? '' : 'the '}${x.name} in Zone ${x.zone}.`, true]));
          if (standing(s, 'radar') && s.missions.some(x => x.type === 'Intercept' && x.vis === m.flag)) log.push(['1510', 'Radar jamming hides any armies on that side. Only Intel can locate them.']);
        }
        // Mission chain: the lookout spots an unguarded cache.
        if (rand(s) < 0.4) {
          const cache = chainCache(s, m.zone);
          s.missions.push(cache);
          log.push(['1520', `From up there, the squad spots ${cache.name.toLowerCase()} in Zone ${cache.zone}. A follow-up mission is open for 3 days.`, true]);
        }
      }
    } else if (m.type === 'Resource') {
      if (win || out === 'set') Object.keys(m.reward).forEach(k => give(k, m.reward[k] * mult));
      r.done = win;
    } else if (m.type === 'Rescue') {
      if (win) {
        m.reward.recruits.forEach(rec => recruit(s, rec, r)); r.done = true;
        // Mission chain: the survivor knows a weak spot in a fort's walls.
        const forts = s.missions.filter(x => x.type === 'Siege' && visible(s, x) && !s.missions.some(y => y.target === x.id));
        if (forts.length && rand(s) < 0.4) {
          const t = pick(s, forts);
          s.missions.push(chainWeakSpot(s, t, m.reward.recruits[0].name));
          log.push(['1520', `${m.reward.recruits[0].name} knows a weak spot in ${t.name}’s walls. A follow-up mission is open for 3 days.`, true]);
        }
      }
    } else if (m.type === 'Extraction') {
      if (win) {
        if (m.reward.recruits) m.reward.recruits.forEach(rec => recruit(s, rec, r));
        else give('tech', m.reward.tech * mult);
        r.done = true;
      } else if (out === 'set' && m.reward.tech) give('tech', m.reward.tech * 0.5);
      r.done = true;
    } else if (m.type === 'Recovery') {
      if (win) {
        const t = byId(s, m.troopId);
        t.status = 'wounded'; t.days = woundDays(s);
        r.rewards.push(`${t.name} returns (Wounded, ${plural(t.days, 'day', 'days')})`);
        r.done = true;
      }
    } else if (m.type === 'Sabotage') {
      const t = s.missions.find(x => x.id === m.target);
      if (win && t) {
        if (t.type === 'Siege') {
          const before = t.fort; t.fort = Math.max(1, t.fort - (m.dmg || 1)); t.noRebuild = s.day + 3;
          log.push(['1500', `${t.name}: Fort Points ${before} to ${t.fort}. No rebuilding for 3 days.`, true]);
        } else {
          t.stay -= 2;
          log.push(['1500', `The ${t.name} loses 2 days on the road.`, true]);
        }
      }
      r.done = true;
    } else if (m.type === 'Hold') {
      r.done = true;
      if (win || out === 'set') {
        if (win) { give('materials', m.reward.materials * st.reward); bumpClock(s, -3); }
        log.push(['1500', `${m.def.name} stays in your hands.${win ? ' The War Clock drops 3.' : ''}`, true]);
      } else {
        retake(s, m.def, notes);
        log.push(['1500', `${m.def.name} is lost to the counterattack.`, true]);
      }
    } else if (m.type === 'Siege') {
      const pts = (out === 'dec' ? 2 : out === 'vic' ? 1 : 0) + eng + (win && s.r.sdoc ? 1 : 0);
      if (pts) {
        const hit = Math.min(pts, m.fort);
        m.fort -= hit;
        give('tech', m.reward.techPerPoint * hit * st.reward);
        log.push(['1500', `${eng ? 'The Engineer’s charges widen the breach. ' : ''}Fort Points: ${m.fort} of ${m.fortMax} left.`]);
        if (m.fort === 0) {
          give('materials', m.reward.materials * st.reward);
          s.taken += 1; bumpClock(s, -5);
          s.takenZones.push(m.zone);
          s.takenTraits = (s.takenTraits || []).concat(m.trait || []);
          log.push(['1510', `${m.name} falls. ${TRAITS[m.trait] ? TRAITS[m.trait].ends + ' ' : ''}Outposts taken: ${s.taken} of ${OUTPOSTS}.`, true]);
          if (D(s).moving && s.taken < OUTPOSTS && rand(s) < 0.6) {
            const def = { ...m }; delete def.gone;
            s.counters.push({ day: s.day + 2, def });
            log.push(['1520', `Scouts expect a counterattack on ${m.name} in two days.`]);
          }
          r.done = true;
        }
      }
    } else if (m.type === 'Intercept') {
      const pts = out === 'dec' ? 2 : out === 'vic' ? 1 : 0;
      if (pts) {
        m.army = Math.max(0, m.army - pts);
        log.push(['1500', `Army Strength: ${m.army} of ${m.armyMax} left.`]);
        if (m.army === 0) {
          give('materials', m.reward.materials * st.reward); give('tech', m.reward.tech * st.reward);
          (m.reward.recruits || []).forEach(rec => recruit(s, rec, r));
          bumpClock(s, -8);
          log.push(['1510', `The ${m.name} is destroyed.${m.reward.recruits ? ' A prisoner is freed.' : ''} The War Clock drops 8.`, true]);
          // Mission chain: orders found on the wreck reveal the next army before it moves.
          if (!s.orders && rand(s) < 0.5) {
            s.orders = true;
            log.push(['1520', 'Captured orders show where the next army will form. You’ll know its route the day it appears.', true]);
          }
          r.done = true;
        }
      }
    }

    let xp = win ? 10 : 4;
    if (ch < 45) xp = Math.round(xp * 1.5);
    if (m.days > 1) xp *= 2;
    squad.filter(living).forEach(t => gainXp(t, xp, r));
    if (win) s.stats.won += 1;
    log.push(['1800', `Odds ${ch}%. Rolled ${roll}. ${r.outcome}.`]);
    return r;
  }

  function resolveRaid(s, raid) {
    const log = [];
    if (raid.target === 'forward') {
      const r = { kind: 'raid', name: `${raid.name} (forward base)`, squad: [], stance: 'Forward base', log, injuries: [], rewards: [], levelups: [], outcome: null, tone: null };
      s.stats.raids += 1;
      log.push(['2230', `${raid.name} hit your forward base in Zone ${s.fwd}. Raid strength ${raid.strength} against its defense of ${FORWARD_DEF}.`, true]);
      if (raid.strength <= FORWARD_DEF) { r.outcome = 'Repelled'; r.tone = 'good'; s.stats.repelled += 1; log.push(['2300', 'The forward base holds. The main base is untouched.']); }
      else { r.outcome = 'Destroyed'; r.tone = 'bad'; log.push(['2300', `The forward base in Zone ${s.fwd} is destroyed. The main base is untouched.`]); s.fwd = null; bumpClock(s, 5); }
      return r;
    }
    const def = defense(s);
    const guards = s.guard.map(id => byId(s, id)).filter(t => t && t.status === 'ok');
    const r = { kind: 'raid', name: raid.name, squad: guards.map(t => t.name), stance: 'Home Guard', log,
      injuries: [], rewards: [], levelups: [], outcome: null, tone: null };
    s.stats.raids += 1;
    log.push(['2230', `${raid.name} strike the base${raid.warned ? '' : ' without warning'}. Raid strength ${raid.strength} against defense ${fmt(def.total)}.`, true]);
    const gap = def.total - raid.strength;
    if (gap >= 0) {
      r.outcome = 'Repelled'; r.tone = 'good'; s.stats.repelled += 1;
      log.push(['2300', 'The attack breaks on the wire. The base holds.']);
      guards.forEach(t => gainXp(t, 6, r));
    } else if (gap >= -2) {
      r.outcome = 'Damaged'; r.tone = 'warn';
      s.integrity -= 15; bumpClock(s, 5);
      log.push(['2300', 'Fires in the compound before the raiders pull back. Base integrity −15. The War Clock rises 5.']);
    } else {
      r.outcome = 'Breached'; r.tone = 'bad';
      s.integrity -= 30; bumpClock(s, 5);
      const stolen = Math.floor(s.materials * 0.3);
      s.materials -= stolen;
      log.push(['2300', `The raiders break in. Base integrity −30${stolen ? `, and ${stolen} Materials carried off` : ''}. The War Clock rises 5.`]);
      shuffle(s, guards).forEach((t, i) => injure(s, t, i === 0 ? 3 : 2, r, log, { where: 'Home base', zone: 0, name: 'the base' }));
    }
    s.integrity = Math.max(0, s.integrity);
    log.push(['2330', `Base integrity ${s.integrity} of 100.`]);
    return r;
  }

  function endDay(s) {
    if (s.phase !== 'play') return;
    const notes = [];
    const stage0 = stage(s);
    // Healing
    s.troops.forEach(t => {
      if (t.status === 'fatigued') { if (--t.days <= 0) { t.status = 'ok'; notes.push(['good', `${t.name} is rested and ready.`]); } }
      else if (t.status === 'wounded') { if (--t.days <= 0) { t.status = 'ok'; notes.push(['good', `${t.name} returns to duty.`]); } }
      else if (t.status === 'critical') {
        if (t.bed) { if (--t.days <= 0) { t.status = 'wounded'; t.days = 2; t.bed = false; notes.push(['good', `${t.name} is out of danger: Wounded, 2 more days.`]); } }
        else if (--t.crit <= 0) { t.status = 'kia'; s.stats.kia += 1; notes.push(['bad', `${t.name} died of wounds. No infirmary bed was free.`]); }
      }
    });
    const missingBefore = s.troops.filter(t => t.status === 'mia').map(t => t.id);
    // Artillery fires first, at dawn
    const fireReports = (s.fires || []).map(f => resolveFire(s, f)).filter(Boolean);
    const shelledOut = fireReports.filter(r => r.done).map(r => r.missionId);
    s.missions = s.missions.filter(m => !shelledOut.includes(m.id));
    s.deployments.forEach(d => {
      if (shelledOut.includes(d.missionId)) notes.push(['info', `${names(d.squad.map(id => byId(s, id).name))} found nothing left to fight: the artillery got there first.`]);
    });
    // Missions: squads on multi-day operations stay out; the rest resolve tonight
    const hits = {};
    const attacked = new Set(s.deployments.map(d => d.missionId).concat((s.fires || []).map(f => f.missionId)));
    s.deployments.forEach(d => {
      const m = s.missions.find(x => x.id === d.missionId);
      if (m && m.zone && !QUIET.includes(m.type)) hits[m.zone] = (hits[m.zone] || 0) + 1;
    });
    const finishing = s.deployments.filter(d => (d.daysLeft || 1) <= 1);
    const staying = s.deployments.filter(d => (d.daysLeft || 1) > 1 && !shelledOut.includes(d.missionId));
    staying.forEach(d => {
      d.daysLeft -= 1;
      const m = s.missions.find(x => x.id === d.missionId);
      if (m) notes.push(['info', `${names(d.squad.map(id => byId(s, id).name))} ${d.squad.length > 1 ? 'are' : 'is'} still out on ${m.name}. They return tomorrow night.`]);
    });
    const results = finishing.map(d => resolve(s, d, notes)).filter(Boolean);
    const doneIds = results.filter(r => r.done).map(r => r.missionId);
    s.missions = s.missions.filter(m => !doneIds.includes(m.id));
    // Training: every fit trainee earns XP
    const drill = { levelups: [] };
    s.training = (s.training || []).filter(id => { const t = byId(s, id); return t && t.status === 'ok'; });
    s.training.forEach(id => gainXp(byId(s, id), TRAIN_XP, drill));
    if (s.training.length) notes.push(['info', `${names(s.training.map(id => byId(s, id).name))} ${s.training.length > 1 ? 'train' : 'trains'} at the base: +${TRAIN_XP} XP each.`]);
    drill.levelups.forEach(l => notes.push(['good', l]));
    // Sabotage missions whose target is gone disappear
    s.missions = s.missions.filter(m => m.type !== 'Sabotage' || s.missions.some(x => x.id === m.target));
    // Outposts rebuild after quiet days (every day while a supply hub stands)
    const hub = standing(s, 'hub');
    s.missions.filter(m => m.type === 'Siege').forEach(m => {
      if (attacked.has(m.id)) { m.quiet = 0; return; }
      if (m.noRebuild && s.day < m.noRebuild) return;
      m.quiet = (m.quiet || 0) + 1;
      const need = hub && m.trait !== 'hub' ? 1 : 2;
      if (m.quiet >= need && m.fort < m.fortMax) {
        m.fort += 1; m.quiet = 0;
        if (visible(s, m)) notes.push(['warn', `${m.name} rebuilds its defenses: Fort Points ${m.fort} of ${m.fortMax}.`]);
      }
    });
    // Missing troops: the search window shrinks (troops captured today start fresh)
    missingBefore.forEach(id => {
      const t = byId(s, id);
      if (t.status !== 'mia') return;
      if (--t.days <= 0) {
        t.status = 'lost';
        s.missions = s.missions.filter(x => x.id !== 'rec-' + t.id);
        notes.push(['bad', `The trail for ${t.name} has gone cold. ${t.name} is lost.`]);
      }
    });
    // Zone Alert
    if (D(s).reinforce && s.alert) {
      Object.keys(s.alert).forEach(z => {
        const before = s.alert[z];
        const after = hits[z] ? Math.min(3, before + hits[z]) : Math.max(0, before - 1);
        s.alert[z] = after;
        const pct = Math.round(D(s).reinfPer * after * 100);
        if (after > before) notes.push([after >= 2 ? 'bad' : 'warn', `Zone ${z} rises to ${ALERT_NAMES[after]}: ${pct}% chance of reinforcements there.`]);
        else if (after < before) notes.push(['good', `Zone ${z} cools to ${ALERT_NAMES[after]}: ${pct}% chance of reinforcements there.`]);
      });
    }
    // Night: repairs, raids and army movement
    if (s.integrity < 100) s.integrity = Math.min(100, s.integrity + 7);
    if (s.fwd) s.materials += 5;
    const raids = [];
    s.missions.filter(m => m.type === 'Siege' && m.raidEvery && s.day >= m.raidFirst && (s.day - m.raidFirst) % m.raidEvery === 0)
      .forEach(m => raids.push({ name: `Raiders from ${visible(s, m) ? m.name : 'an unseen outpost'}`, strength: raidStrength(s, m), warned: raidWarned(s, m),
        target: s.fwd && rand(s) < 0.5 ? 'forward' : 'base' }));
    if (D(s).moving) {
      s.missions.filter(m => m.type === 'Intercept').forEach(m => {
        const every = s.diff === 'hard' ? 1 : m.every;
        if (m.frozenDay === s.day) { if (visible(s, m)) notes.push(['good', `The ${m.name} sits still tonight, its radios jammed.`]); return; }
        m.stay += 1;
        if (m.stay < every) return;
        m.stay = 0; m.pos += 1;
        const next = m.path[m.pos];
        if (next === 'base') {
          raids.push({ name: `The ${m.name}`, strength: m.threat + m.army, warned: visible(s, m), target: 'base' });
          m.gone = true;
        } else {
          m.zone = next;
          m.where = `Sector 1 · Zone ${next}, heading for ${m.path[m.pos + 1] === 'base' ? 'your base' : 'Zone ' + m.path[m.pos + 1]}`;
          if (visible(s, m)) notes.push(['warn', `The ${m.name} advances to Zone ${next}.`]);
        }
      });
      s.missions = s.missions.filter(m => !m.gone);
      s.missions = s.missions.filter(m => m.type !== 'Sabotage' || s.missions.some(x => x.id === m.target));
      staying.forEach(d => { if (!s.missions.some(x => x.id === d.missionId)) d.gone = true; });
    }
    const raidReports = raids.map(rd => resolveRaid(s, rd));
    bumpClock(s, D(s).clockRate);
    // Beds: critical troops take free beds, most urgent first
    let used = s.troops.filter(t => t.status === 'critical' && t.bed).length;
    s.troops.filter(t => t.status === 'critical' && !t.bed).sort((a, b) => a.crit - b.crit).forEach(t => {
      if (used < beds(s)) { t.bed = true; used += 1; notes.push(['warn', `${t.name} takes an infirmary bed.`]); }
      else notes.push(['bad', `No bed free for ${t.name}. ${plural(t.crit, 'day', 'days')} to live without one.`]);
    });
    // Windows closing (a squad already out on a mission keeps it open).
    // Unheld counterattacks are applied after the list is rebuilt, so the retaken fort isn't dropped.
    const unheld = [];
    s.missions = s.missions.filter(m => {
      if (!m.until || m.until > s.day || staying.some(d => d.missionId === m.id)) return true;
      if (m.type === 'Hold') { unheld.push(m.def); return false; }
      if (visible(s, m)) notes.push(['warn', `${m.name}: the window has closed.`]);
      return false;
    });
    unheld.forEach(def => { notes.push(['bad', `Nobody held ${def.name}.`]); retake(s, def, notes); });
    // Rescued troops waiting for bunks
    s.waiting = s.waiting.filter(w => {
      if (rosterCount(s) < rosterCap(s)) { s.troops.push(troop(w.rec)); notes.push(['good', `${w.rec.name} reaches the base and joins the roster.`]); return false; }
      if (--w.days <= 0) { notes.push(['bad', `${w.rec.name} couldn’t wait any longer. The barracks were full.`]); return false; }
      return true;
    });
    s.guard = s.guard.filter(id => { const t = byId(s, id); return t && t.status === 'ok'; });
    s.training = s.training.filter(id => { const t = byId(s, id); return t && t.status === 'ok'; });
    // War Clock stage change
    const stage1 = stage(s);
    if (stage1 !== stage0) s.missions.forEach(m => { if (m.type !== 'Recovery') m.threat = Math.max(0, m.threat + stage1 - stage0); });
    if (stage1 > stage0) notes.push(['bad', `The War Clock reaches Stage ${stage1}. Every enemy on the map gains ${stage1 - stage0} threat, raids hit harder, and complications are more likely.${stage1 === 5 ? ' Final Offensive: armies now march every 3 days.' : ''}`]);
    else if (stage1 < stage0) notes.push(['good', `The War Clock falls back to Stage ${stage1}. Every enemy on the map loses ${stage0 - stage1} threat.`]);

    // Next day
    s.day += 1;
    s.deployments = staying.filter(d => !d.gone);
    s.fires = [];
    s.revealed = {};
    if (s.integrity <= 0) { s.phase = 'lost'; s.lossReason = 'base'; }
    else if (!s.troops.some(living)) { s.phase = 'lost'; s.lossReason = 'attrition'; }
    else if (s.taken >= OUTPOSTS) s.phase = 'won';
    if (s.phase === 'play') {
      const fresh = [];
      const add = mm => {
        s.missions.push(mm);
        if (visible(s, mm)) fresh.push(mm.name);
        else if (mm.type === 'Siege') notes.push(['warn', `Patrols report a new enemy outpost somewhere along the ${sideName(mm.vis)}. Nobody has eyes on it. Scout that side or locate it with Intel on the Base tab.`]);
        else if (standing(s, 'radar') && s.flags[mm.vis]) notes.push(['warn', `Radar jamming: an enemy force is moving along the ${sideName(mm.vis)}, but your scouts can’t fix its position. Locate it with Intel on the Base tab.`]);
        else notes.push(['warn', `Reports of enemy movement on the ${sideName(mm.vis)}, but nobody is watching. Scout that side or locate it with Intel on the Base tab.`]);
      };
      MISSIONS.filter(m => m.from === s.day).forEach(m => add(spawnOne(s, m)));
      s.counters = s.counters.filter(c => {
        if (c.day > s.day) return true;
        if (s.missions.some(x => x.id === c.def.id)) return false;
        add(spawnOne(s, { id: 'hold-' + c.def.id + '-' + s.day, type: 'Hold', name: `Hold ${c.def.name}`, where: `Sector 1 · Zone ${c.def.zone}`, zone: c.def.zone,
          threat: 1, until: s.day, def: c.def, reward: { materials: 15 },
          desc: `The enemy is counterattacking ${c.def.name} today. Hold it, or they retake the fort with 2 Fort Points and resume raids.`,
          win: 'The counterattack breaks against your new lines.' }));
        notes.push(['bad', `Counterattack on ${c.def.name} today. Send a squad to hold it, or lose it.`]);
        return false;
      });
      if (s.day > SCRIPTED_DAYS) {
        while (s.missions.filter(m => m.gen && m.kind).length < HAND) add(genMission(s));
        if (OUTPOST_DAYS.includes(s.day)) add(genOutpost(s));
        const cap = stage(s) + s.missions.filter(m => m.type === 'Siege' && m.trait === 'depot').length;
        const armies = () => s.missions.filter(m => m.type === 'Intercept').length;
        if (s.day >= s.nextArmy) {
          if (armies() < cap) { add(genArmy(s)); s.nextArmy = s.day + (stage(s) >= 5 ? 3 : 7); }
          else s.nextArmy = s.day + 2;
        }
        s.missions.filter(m => m.type === 'Siege' && m.trait === 'depot' && s.day >= (m.depotNext || 0)).forEach(m => {
          if (armies() < cap) { add(genArmy(s)); notes.push(['warn', `A fresh army marches out of ${visible(s, m) ? m.name : 'an enemy depot'}.`]); }
          m.depotNext = s.day + 8;
        });
      }
      if (fresh.length) notes.push(['info', `New missions: ${fresh.join(', ')}.`]);
      threats(s).forEach(t => {
        if (t.nights === 1) notes.push(['bad', `${t.name} will hit the base tonight, strength ${t.strength}. Current defense: ${fmt(defense(s).total)}. Post a Home Guard on the Base tab.`]);
        else if (t.nights === 2) notes.push(['warn', `${t.name} will reach the base tomorrow night, strength ${t.strength}.`]);
      });
    }
    s.debrief = fireReports.concat(results, raidReports, notes.map(([tone, text]) => ({ kind: 'note', tone, text })));
  }

  return { GUARD_MAX, SCRIPTED_DAYS, OUTPOSTS, REPAIR_COST, REPAIR_AMT, LOCATE_COST, REVEAL_COST, FORWARD_COST, FORWARD_DEF, GEAR_COST,
    TRAIN_XP, FIRE_COST, FIRE_INTEL_MAX, JAM_COST, JAM_COOLDOWN, SAVE_VERSION,
    STANCES, STATUS_LABEL, DIFFS, D, ALERT_NAMES, CLASSES, GEAR, TRAITS, BUILD, RESEARCH,
    alertOf, reinfChance, compChance, stage, sizeOf, intelCap, newGame, migrate, deploy, recall, reveal, locate, toggleGuard, toggleTraining,
    build, research, repair, buildForward, forwardZones, buyGear, setClass, endDay, standing,
    planFire, cancelFire, inRange, fireChance, fireDamage, jam, canJam, nightsToBase,
    power, chance, band, availability, slotsFree, slotsUsed, slots, beds, rosterCount, rosterCap, byId, living, visible, defense, guardValue, threats, hiddenReports };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = OC;
if (typeof window !== 'undefined') window.OC = OC;
