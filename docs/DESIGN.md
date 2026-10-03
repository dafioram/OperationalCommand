# Operational Command — Game Design (Rev 2)

> Exported from the living design doc on Oct 2, 2026. The code in this repo is the source of truth for exact numbers; this document explains the intent. Sections 2–13 describe the full three-sector game; section 14 describes what the playable prototype implements today.

## What changed in Rev 2

Rev 2 gives every day real decisions, makes death rules explicit, and adds an enemy clock that punishes turtling. All numbers are starting tuning values, not final balance.

| Gap in Rev 1 | Fix in Rev 2 | Section |
| --- | --- | --- |
| Best play was "send your strongest squad" | Visible odds, three stances, five graded outcomes | Combat |
| Scout and Medic were mandatory in every squad | 4-slot squads and an Assault class, so utility costs firepower; perks now have limits | Troops |
| Unclear whether troops can die | Injury ladder; death only on a Rout; captured troops spawn recovery missions | Casualties |
| No time pressure | War Clock escalation and roaming enemy armies | Enemy |
| Snowball late, death spiral when losing | Emergency rescues when low; counteroffensives against held territory | Balance valves |
| Base defense was vague | Home Guard squad, raid warnings, Base Integrity meter | Home base |
| Intel, XP, durations and cross-listing undefined | Each now has a rule | Resources, Troops, Missions |
| Economy roles blurred | Materials build, Tech expands capacity, Intel informs | Resources |

## 1. Concept and core fantasy

You are the Commander in a war room: you read the morning's reports, weigh the odds and send squads out, but never fight a gunfight by hand.

- **Genre:** turn-based grand strategy campaign with auto-resolved tactical missions and risk management.
- **Platform:** phone web app, portrait, playable one-handed.
- **Session shape:** a game day takes 1 to 3 minutes; a sitting can run one day or many. A full campaign is about 9 hours.
- **The tension:** veterans are irreplaceable except through rescues, so every deployment is a bet with your best people.

## 2. Core daily loop

Each day has four phases, and the player decides when to end it; all fronts then resolve at once.

1. **Morning Debrief.** One card per event: mission results, injuries, rewards, raid warnings, army sightings and the War Clock change.
2. **Base Phase.** Assign infirmary beds, construct buildings, buy research, choose classes for troops who hit Level 3, edit preset teams.
3. **Deployment Phase.** For each open mission slot, pick a mission, a squad and a stance, and see the odds before committing. Assign or confirm the Home Guard.
4. **End Day.** Missions and complications resolve, armies move, raids hit, the War Clock ticks, and new nodes spawn.

**No daily cap.** Play as many game days per sitting as you like; nothing waits on real-world time.

## 3. Resources and economy

Three resources with separate jobs: Materials build things, Tech expands what your command can do, and Intel tells you what you are walking into.

| Resource | Earned from | Spent on |
| --- | --- | --- |
| Materials | Resource missions, pacified sector income, destroyed armies | Buildings and building levels; repairing Base Integrity |
| Tech | Research caches, completed sieges, destroyed armies | Research upgrades that raise operational capacity (table below) |
| Intel | Scout missions, Commander class, captured outposts | Exact odds (1), locating a hidden army or outpost (2), complication previews, an army's next destination |

Intel is capped in storage (starting cap 10) so it gets spent, not hoarded. Materials stays one generic pool for now; it is designed to split later into Supplies and Construction (see Future hooks).

Each resource has one icon, used everywhere it is earned or spent: stacked logs for Materials, a beaker for Tech, a camera for Intel. Base integrity uses a shield.

**Research (bought with Tech)**

| Upgrade | Effect |
| --- | --- |
| Tactical Command I to IV | +1 mission slot per level (start 2, max 6) |
| Squad Doctrine | Siege and Intercept squads grow from 4 to 5 |
| Field Medicine | Critical troops survive 2 extra days without a bed |
| Signals Network | Every outpost raid is announced, even from forts you haven't scouted |
| Siege Doctrine | Every siege win knocks down 1 extra Fort Point |
| Forward Intelligence | Exact odds shown without spending Intel |
| Intel Archive | Intel storage cap 10 to 20 |
| Field Artillery | Fire missions on armies and outposts in range (v0.5) |
| Heavy Shells | Artillery hits do 2 damage (v0.5) |
| Comms Jamming | Freeze an army for a night; 2 Intel, 3-day recharge (v0.5) |

## 4. Troops, squads and classes

Each mission type sets its own squad size, and every specialist takes a slot that could have gone to firepower, so no class is automatic.

**Squad size by mission.** Scout 2, Resource 2, Recovery 2, Sabotage 2, Rescue 3, Hold 3, Extraction 3, Siege 4, Intercept 3 to 4 depending on the army. Each missing troop costs -1 power, and extra troops can't be added. So splitting the roster across missions is the normal play, not a penalty.

**Recruitment.** The campaign starts with 4 unclassified Level 2 troops. After that, troops only come from rescues: Rescue missions, prisoners freed from destroyed armies, and recovered MIA troops. Rescued troops arrive as Level 1 rookies or as leveled specialists with a class already chosen.

**Levels and XP.** Troops run from Level 1 to 10. A mission earns 10 XP on success and 4 on failure, plus 50% at Risky odds or worse. Reaching the next level takes 20 XP times the current level. At Level 3 the Commander picks the troop's class.

**Classes.** Only Assault stacks; every other perk counts once per squad.

| Class | Perk | Limit or cost |
| --- | --- | --- |
| Assault | +1 squad power each | None; it is pure firepower |
| Scout | Previews one complication before deploying; on an Ambush, 70% chance to withdraw the squad unharmed | A withdrawal forfeits all rewards and mission progress |
| Medic | Once per mission, downgrades the worst injury one step | Does not stop the other injuries |
| Engineer | +2 siege momentum; +1 power on Siege and Hold missions | No effect elsewhere |
| Commander | +1 Intel per day deployed; squad can change stance mid-mission | No combat bonus |

Unclassified rookies fill a slot with no perk. Troops have no personality traits; level, class and injuries are what set them apart.

**Preset teams and cross-listing.** A troop can sit in any number of presets but deploys once per day. When a preset has a gap (deployed, injured or dead), the deploy screen marks it and offers two choices: go short-handed at -1 power per empty slot, or fill it with the best available troop as a temp.

**Roster cap** comes from Barracks. Rescues that would exceed it wait at the rescue site for 3 days.

## 5. Casualties and death

Permadeath is real but rare: a troop can die only in a Rout, or by going untreated while Critical.

Healthy → Fatigued → Wounded → Critical → KIA, with MIA as a side branch from a Rout that a Recovery mission can reverse.

Most bad days end in the infirmary; only a Rout or a missing bed moves a troop into the red boxes.

**Injury ladder.** Healthy, Fatigued (sits out 1 day), Wounded (3 days in the infirmary), Critical (needs an infirmary bed; dies after 2 days without one), KIA. Infirmary level sets how many beds you have, so a bad day can overload it.

**Missing in action.** In a Rout, a troop may be captured instead of killed. A Recovery mission then spawns in that sector for 5 days; if it expires, the troop is lost.

| Outcome | Injuries |
| --- | --- |
| Decisive Victory | None |
| Victory | 25% chance one troop is Fatigued |
| Setback | 1 to 2 troops Wounded |
| Defeat | Whole squad Wounded, one Critical |
| Rout | One troop KIA or MIA (50/50), the rest Wounded or Critical |

Stance shifts every injury one step lighter (Cautious) or heavier (Aggressive). A Medic then downgrades the single worst result, which is how a Medic turns a death into a Critical.

**Sieges.** Each siege day is a normal battle with normal injuries. Running out of momentum is still a safe withdrawal with no extra casualties, as in Rev 1.

## 6. Map and missions

Nine mission types, each feeding a different need, so the daily question is which need to serve with your limited slots.

**Map.** The campaign starts with 3 sectors, generated fresh each campaign, each about 3 hours of real play (roughly 90 game days at 2 minutes a day). A sector holds about 6 zones, and each zone holds mission nodes. Scouting a sector's border reveals the next; the Citadel lies beyond the third. Sector count and length can grow after playtests.

**Tutorial sector.** Sector 1 is easier: enemy threat runs 1 lower, and new systems are introduced one at a time. Players can skip the tutorial, and Sector 1 then plays at normal threat.

A mission slot is one squad in the field. A squad on a multi-day mission holds its slot until it returns, so Tactical Command research directly sets how much you can do per day.

| Mission | Duration | Purpose | Main reward |
| --- | --- | --- | --- |
| Scout | 1 day | Reveal nodes, armies and neighboring zones | Intel, map |
| Resource | 1 to 2 days | Gather supplies | Materials or Tech |
| Rescue | 1 to 2 days; node expires in 4 days | Find new personnel | 1 to 2 troops |
| Recovery | 1 day; open 5 days | Bring back MIA troops | The captured troop |
| Siege | Until the fort falls or momentum ends (base 3 days) | Destroy a fortified outpost | Tech, progress toward pacification |
| Intercept | 1 day per engagement | Attack a roaming army | Materials, Tech, freed prisoners, War Clock drops |
| Hold | 1 day, that day only | Defend an outpost you just took from a counterattack | Keeps the outpost; losing gives it back with 2 Fort Points |
| Sabotage | 1 day | Knock 1 Fort Point off an outpost and stop it rebuilding for 3 days, or delay an army 2 days; doesn't raise zone alert | Easier siege or more time |
| Extraction | 2 days | Pull a high-value specialist or tech cache out of deep territory | Rare troop or large Tech |

**Sieges.** A fort has Fort Points. Each siege day's result removes points (Victory 1, Decisive Victory 2). The fort falls at zero. If momentum runs out first, the squad withdraws safely; the fort regains 1 point after every 2 days without an attack, so a second siege can finish the job.

**Extraction** rolls complications on the way in and on the way out, which makes a Scout worth taking.

Intercept details are in the Enemy section.

## 7. Combat and risk

The player always sees the odds before committing, and chooses how much risk to take with a stance.

**Squad power** = average level + 1 per Assault + class and research bonuses + stance modifier - 1 per troop below the mission's squad size.

```latex
\text{Success chance} = \operatorname{clamp}\big(50\% + 10\% \times (\text{Power} - \text{Threat}),\ 5\%,\ 95\%\big)
```

**Odds display.** By default the deploy screen shows a band: Favorable (75% or more), Even (45 to 74%), Risky (25 to 44%), Desperate (under 25%). Spending 1 Intel, or owning Forward Intelligence, shows the exact percentage.

**Fog of war.** In a zone not scouted in the last 5 days, the band is an estimate shown one step worse and marked with "?". A Scout visit or 1 Intel reveals the true band. The unknown feels dangerous, but the game never shows a false number.

**Stances**

| Stance | Power | Injuries | Rewards | Other |
| --- | --- | --- | --- | --- |
| Cautious | -1 | One step lighter | -25% | Squad withdraws after the first complication |
| Standard | 0 | Normal | Normal | None |
| Aggressive | +1 | One step heavier | +25% | Multi-day missions finish 1 day early |

**Graded outcomes.** A roll at or under the success chance is a Victory; under a third of it is a Decisive Victory. Failures split 50% Setback, 35% Defeat, 15% Rout. At Desperate odds the split becomes 30/40/30.

**Complications.** Each deployed squad has a 15% chance per day of a complication, +5% per War Clock stage. The Scout's preview or 1 Intel reveals one in advance.

| Complication | Effect |
| --- | --- |
| Ambush | -2 power today; a Scout can try to withdraw |
| Reinforcements | Rolled from zone Alert, not this roll (see Enemy section). Node threat +2 for the rest of the mission |
| Army nearby | A roaming army joins the fight; this becomes an Intercept |
| Rough ground | Mission takes 1 extra day |
| Raid at home | Resolved against the base (see Home base) |

## 8. Enemy escalation and roaming armies

The enemy grows stronger every day you don't push back, and its armies move, so waiting is never free.

**War Clock.** A meter from 0 to 100, in five stages of 20 points.

| Raises the clock | Lowers the clock |
| --- | --- |
| +1 every 3 days | -8 per army destroyed |
| +5 per successful raid on your base | -5 per siege completed |
| +3 per zone the enemy retakes | -3 per Sabotage mission |
| Base rate doubles after the 1st pacified sector and triples after the 2nd (enemy desperation) |  |

Each new stage raises every enemy node's threat by 1, spawns armies more often, makes raids bigger and adds 5% to complication chance. Stage 5 is the Final Offensive: the Citadel sends an army at your base every few days until you take it. Rates are tuned so an average player reaches Stage 5 during the third sector.

**Roaming armies.** Each army has a Strength (hit points), a Threat level and a target: a pacified sector to retake, or your base.

- **Movement.** It moves one zone per day (heavy armies every 2 days). You see it only in scouted zones, or next to them with Signals Network.
- **Prediction.** Spending 1 Intel reveals its next destination.
- **Intercept today or ambush tomorrow.** Fight it where it is now, or deploy to where it's heading. A correct guess gives +1 power. A wrong guess leaves the squad waiting, free to redeploy the next day.
- **Wearing it down.** Each Victory removes 1 Strength and a Decisive Victory removes 2. Several squads can hit the same army on the same day.
- **If it arrives.** In a zone of a pacified sector, the whole sector turns Contested after 1 day unless a Hold squad is there: income stops and outposts can respawn. At your base, it becomes a raid at the army's full Strength.
- **Destroyed.** You get Materials and Tech, the War Clock drops 8, and 1 to 2 prisoners are freed and join your roster.

**Army cap.** The map holds at most as many armies as the War Clock stage, from 1 to 5. When a new army would exceed the cap, the pressure goes elsewhere: a new outpost appears in an empty zone, or node threat rises by 1 across one sector.

**Zone Alert.** The enemy responds to where you fight, while the War Clock tracks how long you take. Each zone has an Alert level from 0 to 3.

- **Rises:** +1 for each mission launched in the zone. Scout missions don't count; scouts go unnoticed.
- **Falls:** -1 for each day with no mission in the zone.
- Reinforcements are rolled from Alert, separately from other complications, at the start of each mission day.

| Alert | Name | Reinforcement chance (Medium) | Other effects |
| --- | --- | --- | --- |
| 0 | Calm | 0% | None |
| 1 | Wary | 10% | None |
| 2 | Alert | 20% | New nodes in the zone spawn at +1 threat |
| 3 | Lockdown | 30% | Roaming armies within 2 zones divert toward it |

The two pressures pull against each other. Hammering one zone brings a stronger response there. Spreading out or pausing lets zones cool, but the War Clock keeps climbing.

**Outpost types.** Every outpost has a type whose effect lasts until it falls, so the order you take them in is a real choice.

| Type | Effect while standing |
| --- | --- |
| Garrison | None; the baseline fort |
| Artillery | Its raids hit 2 harder |
| Supply hub | Other outposts rebuild a Fort Point after every quiet day instead of every two |
| Radar station | Scouting can't see armies; only Intel can locate them |
| Army depot | Sends an extra army toward the base every 8 days |

**Counterattacks.** On Medium and Hard, after you take an outpost there is a 60% chance the enemy counterattacks it two days later. That spawns a one-day Hold mission. Lose it or ignore it, and the enemy retakes the fort with 2 Fort Points and resumes raids.

The Rev 1 "wandering patrol" is now simply a small army.

## 9. Home base and defense

The base has a health bar, Base Integrity (100), and one raid rarely ends the game; a string of undefended ones does.

**Buildings (bought with Materials)**

| Building | Effect per level |
| --- | --- |
| Infirmary | +1 bed; at Level 3, Wounded recovery drops from 3 days to 2 |
| Barracks | +3 roster capacity |
| Defensive Grid | +2 base defense |

Mission capacity is no longer a building; it comes from Tactical Command research, bought with Tech.

**Gear.** Each troop can carry one item, bought with 20 Tech: body armor (their injuries are one step lighter) or a marksman rifle (counts as 1 level higher for squad power). Gear is lost if the troop dies.

**Forward base.** Built for 60 Materials in a zone where you took an outpost; one at a time. It gives +1 power on missions in that zone and its neighbors, plus 5 Materials a night. Half of all outpost raids hit it instead of the main base, and it falls to any raid above strength 3. It is also lost if the enemy retakes that zone.

**Home Guard.** One squad can be assigned to guard the base. It does not use a mission slot, but its troops cannot deploy. Each guard adds 1 plus half their level to the Defensive Grid's rating, and an Engineer adds 1 more.

**Raid warnings.** Scouting a zone next to the base, or owning Signals Network, gives a warning in the Morning Debrief the day before a raid. Without coverage, raids arrive unannounced.

| Raid result | When | Effect |
| --- | --- | --- |
| Repelled | Defense at or above raid strength | No damage; Home Guard earns XP |
| Damaged | Defense up to 2 below | -15 Integrity; one building offline for 2 days |
| Breached | Defense 3 or more below | -35 Integrity; Materials stolen; Home Guard takes Defeat injuries |

Integrity recovers 5 per day, or faster by spending Materials.

## 10. Balance valves

A losing player gets a way back, and a winning player keeps facing pressure.

**Catch-up (stops the death spiral)**

- **Emergency Rescue.** When 3 or fewer troops are healthy, an Emergency Rescue node appears every 2 days. Its threat is 1 below your average level and it cannot roll an Ambush.
- **Recovery missions** turn most Rout losses into a second chance rather than a permanent loss.
- **Beds go to the Critical first,** automatically, so a bad day doesn't kill by oversight.

**Late-game pressure (stops the snowball)**

- Each pacified sector speeds up the War Clock (see Enemy section).
- Armies target pacified sectors, so held territory needs Hold missions and interceptions.
- Enemy node threat rises with War Clock stage, not only with map depth, so veterans never face trivial fights.

**Difficulty.** The player picks Easy, Medium or Hard when starting a campaign, and it stays fixed for that campaign. Medium is the rules as written in this doc. The tutorial's -1 threat in Sector 1 applies on top of any difficulty.

| Rule | Easy | Medium | Hard |
| --- | --- | --- | --- |
| Enemy node threat | −1 (minimum 0) | As written | +1 |
| Complication chance (not counting reinforcements) | 10% | 15% | 20% |
| Reinforcements | Off; zone Alert isn't tracked | 10% per Alert level | 15% per Alert level |
| Roaming armies | Hold position; never retake zones or march on the base | Move 1 zone per day | Move 1 zone per day, heavy armies included |
| War Clock | No daily rise; only raids move it | +1 every 3 days | +1 every 2 days |
| Critical troop without a bed | Dies after 2 days | Dies after 2 days | Dies after 1 day |

On Easy, the world is static: the enemy never grows on its own, and nothing you have already taken is lost. The challenge comes from the odds and the injury ladder alone.

## 11. Win and loss conditions

You win by taking the Citadel; you lose if the base falls or no living troops remain.

**Win.** Pacify all 3 sectors to unlock the Citadel. The Citadel siege has three stages (Outer Walls, Inner Defenses, Command), each its own siege with Fort Points. Several squads can besiege at once. Taking Command wins the campaign.

**Loss**

1. **Base Fall.** Base Integrity reaches 0.
2. **Total Attrition.** No living troops at base: everyone is dead or MIA. Wounded troops still count as living, because they will recover.

## 12. Mobile UX notes

Every screen is built for a portrait phone and a thumb, with the most important fact visible before any tap.

- **Debrief as cards.** Each card has a one-line headline ("Team A: Victory at Ridge Depot, 1 Wounded") and expands into the full combat log.
- **Deploying in two taps.** Pick a preset and a node, then confirm. The odds band is color-coded, the stance is one toggle, and gaps in a team are highlighted with a suggested temp.
- **End Day check.** Confirming End Day warns about empty mission slots, an unguarded base with a raid warning, and Critical troops without beds.
- **Always resumable.** State saves after every action, since mobile browser tabs close without warning. Separately, an autosave at the start of each day keeps 2 restore points (today and yesterday); there are no manual saves.

## 13. Future hooks and decisions

Materials is one pool today but is designed to split once the core loop is proven.

- **Supplies (ammo, food).** Spent per squad per mission day. Aggressive stance costs more, and a squad out of Supplies must return. Held back until playtests show Materials piling up with nothing to spend it on.
- **Construction.** Builds forward bases in pacified sectors. A forward base shortens nearby missions by 1 day, but becomes a second raid target.

**Built in prototype v0.5 (formerly the backlog)**

- [x] Troop gear costs 20 Tech instead of 35 Materials.
- [x] Training on the Base tab: assign troops to training the same way as the Home Guard, with no cap on how many. Trainees earn 5 XP a day and can't deploy or guard.
- [x] Artillery (research unlock): a fire mission uses a mission slot but no troops and costs 15 Materials a shot. It hits an army (-1 Strength) or an outpost (-1 Fort Point). Accuracy: 60% in a scouted zone, +15% per Intel spent, 30% if unscouted. Range from the base covers Zones 1 to 3; a forward base extends it. A later upgrade raises damage to 2.
- [x] Comms jamming (research unlock): freeze one army in place for a day. Costs 2 Intel per use, with a 3-day cooldown.
- [x] Mission chains: some wins unlock a follow-up. Examples: captured orders reveal a depot's next army, which can be ambushed at +2 power; a rescued engineer knows a fort's weak spot, which opens a cheap Sabotage there.

**Decided**

- No real-world cap on game days per sitting.
- 3 generated sectors at about 3 hours of real play each; both can grow after playtests.
- Start with 4 troops.
- No personality traits.
- Armies are capped by War Clock stage; extra pressure becomes outposts, higher threat or fogged odds.
- Autosave at the start of each day, keeping today and yesterday.
- Sector 1 is an easier tutorial, and can be skipped.
- Easy, Medium and Hard difficulty, chosen at campaign start.

No open questions right now.

## 14. Prototype scope

The playable prototype is an open-ended campaign in Sector 1. Days 1 to 10 are handmade; after that, missions, armies and two new outposts are generated. You win by taking all five outposts, with no day limit.

| In the prototype | Left for later |
| --- | --- |
| Difficulty picker, zone Alert, odds, stances, graded outcomes, injury ladder | Sectors 2 and 3, the Citadel, map layout |
| Handmade Days 1 to 10, then a daily hand of four varied missions | Decision events in the debrief |
| Five outposts with types: Garrison, Artillery, Supply hub, Radar station, Army depot | Armies diverting to Lockdown zones |
| Sabotage, Hold (counterattacks) and 2-day Extraction missions | Pacification income |
| War Clock at a faster rate (+1 a day on Medium, +1.5 on Hard) | Supplies (ammo and food) |
| Home Guard, Defensive Grid, Base Integrity, repairs, forward base | Complication previews, predicting an army's next move |
| Two research tiers, troop gear, class choice at Level 3, roster cap | Tutorial flow, fog of war |
| Training, artillery fire missions, comms jamming, mission chains (v0.5) | Veteran specializations, nemesis, weather, final stronghold |

**Balance from simulated campaigns.** A simple automated player wins about 96% of the time on Easy, 54% on Medium and 9% on Hard. A typical win takes 23 to 32 days. Nearly every loss is the base falling. Hard is deliberately punishing and is the first candidate for tuning after human playtests.

**Saving.** The game saves to localStorage after every action and keeps two start-of-day restore points. If storage is blocked (some private windows and embedded previews), it keeps running from memory.
