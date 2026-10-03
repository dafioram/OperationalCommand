# Changelog

## 0.5.0 — Training, artillery and mission chains

- **Training:** put any number of troops into training on the Base tab. Each earns 5 XP a night and can't deploy or guard.
- **Artillery** (Field Artillery research): fire missions use a mission slot but no troops and cost 15 Materials a shot.
  - Hits knock 1 Strength off an army or 1 Fort Point off an outpost; Heavy Shells research raises damage to 2.
  - Accuracy is 60% on the scouted side of the map and 30% on the unscouted side, plus 15% per Intel spent.
  - Range covers Zones 1–3, or the zones next to a forward base.
- **Comms jamming** (research): freeze an army in place for a night for 2 Intel, with a 3-day recharge.
- **Mission chains:** some wins unlock a follow-up mission.
  - A won Scout can spot an unguarded cache.
  - A rescued survivor can know a fort's weak spot, opening a sabotage that removes 2 Fort Points.
  - A destroyed army can drop orders that reveal the next army and give +2 power to ambush it.
- **Gear** now costs 20 Tech instead of 35 Materials.
- Project split into separate files, with unit, simulation and browser tests, CI, and GitHub Pages deployment.
- Saves from earlier versions upgrade automatically.

## 0.4.0 — Outpost types, new missions, new spending

- Outposts have types: Garrison, Artillery, Supply hub, Radar station, Army depot.
- New missions: Sabotage, Hold (counterattacks on taken outposts), 2-day Extraction.
- Advanced research tier, troop gear and a forward base.
- Fixed a bug where an ignored counterattack could remove an outpost from the game.

## 0.3.0 — Open-ended campaign

- No day limit: take all five outposts to win. Missions, armies and two outposts are generated after Day 10.
- War Clock with five stages; every enemy gets stronger as it rises.
- Resource icons. Intel can locate hidden armies and outposts.
- Generated missions never repeat a kind, zone or name on the same day.

## 0.2.0 — Ten-day campaign

- Squad sizes per mission type, buildings, research, Home Guard, raids, base integrity, classes at Level 3.
- Difficulty picker and zone Alert.

## 0.1.0 — Two-day prototype

- Combat odds, stances, graded outcomes, injury ladder, infirmary, debrief logs, autosaves.
