#!/usr/bin/env node
// Kinematic hit-chance simulator for scanner beams, driven directly by the
// confirmed geometry in data/item-geometry-worksheet.json. This replaces
// in-game empirical testing for the variables that are pure geometry/motion
// (lane position, ore size, drop speed / ore spacing, conveyor speed) by
// literally simulating a real sequence of dropped ore against the beam's own
// continuous clock and checking for overlap.
//
// Key model decisions (agreed with the user, do not change casually):
// - Ore size unit conversion: raw oreSize/finalSize values from the database
//   are NOT already in tile units. 2.5 raw units == 1 tile. All ore sizes
//   here are raw-database values; convert with ORE_TO_TILE before using them
//   in beam-geometry math.
// - Ore x-position does not drift while on a belt ("facing south" picture) —
//   an ore keeps whatever lane fraction across the conveyor it entered with.
// - Ore spacing on the belt is NOT purely 1/dropSpeed converted to distance —
//   ore can't be packed closer than its own diameter, so the real
//   center-to-center distance is max(oreSizeTiles, conveyorSpeed / dropSpeed).
// - Drop speed does not change ore velocity (a normal belt run precedes every
//   scanner, so ore is already at the belt's target speed on arrival) — it
//   only changes the *spacing/phase* between successive ore relative to the
//   beam's own oscillation. This means hit chance must be computed from an
//   actual deterministic sequence of ore at fixed spacing against a
//   continuously running beam clock, NOT a Monte Carlo average over a
//   uniformly random independent phase per ore (that hides resonance/
//   phase-locking effects between drop rate and beam period).
// - Azure Scanner: any ore with raw size >= 1.2 is a guaranteed hit,
//   independent of geometry — its beam sits ~1.4 tiles up at its most
//   horizontal point, tall enough that big ore always intersects it.
//
// Usage: node scripts/scanner-hit-simulator.mjs

const TAU = Math.PI * 2;
const ORE_TO_TILE = 1 / 2.5; // "ore size 2.5 == 1 tile"

// Both the beam's angle/position (driven by os.clock()) and the ore's position
// are only ever CHECKED against each other once per RunService.Stepped tick —
// not continuously. A rotating beam only grazes a dead-center ore's path for a
// vanishing instant when it's perpendicular to the belt (~90deg/~270deg); a
// real per-tick sample can miss that graze entirely, which is exactly the
// behavior confirmed in-game (misses at 90/270 for small ore, guaranteed hits
// once ore is big enough to cover a full tick's worth of position error).
// Do not replace this with a finer/adaptive dt — that reintroduces a
// continuous-time approximation that hides real, confirmed miss behavior.
const TICK_DT = 1 / 60;

// ---- Single-ore overlap tests, given the beam's absolute clock phase at the
//      moment this ore's own local clock (t=0 == ore center at y=0) began ----

function sweepHitOnce({ convX, convWidth, beamY, beamLenY, beamWidthX, speedCyc, conveyorSpeed, oreSizeTiles, laneX, phase0, dt = TICK_DT }) {
  const oreR = oreSizeTiles / 2;
  const tStart = (beamY - oreR) / conveyorSpeed;
  const tEnd = (beamY + beamLenY + oreR) / conveyorSpeed;
  if (tEnd <= tStart) return false;
  // Sample on the shared global os.clock() tick grid (multiples of dt from a
  // universal t=0), not a grid offset per-ore — every ore and the beam are
  // checked against the same absolute Stepped ticks in the real game.
  const gStart = phase0 + tStart;
  const gEnd = phase0 + tEnd;
  const kStart = Math.ceil(gStart / dt);
  const kEnd = Math.floor(gEnd / dt);
  for (let k = kStart; k <= kEnd; k++) {
    const simTime = k * dt;
    const t = simTime - phase0;
    const oreCenterY = t * conveyorSpeed;
    const oreYLo = oreCenterY - oreR;
    const oreYHi = oreCenterY + oreR;
    if (oreYHi < beamY || oreYLo > beamY + beamLenY) continue;
    const alpha = (Math.sin(TAU * speedCyc * simTime) + 1) / 2;
    const beamCenterX = convX + alpha * convWidth;
    const beamLeft = beamCenterX - beamWidthX / 2;
    const beamRight = beamCenterX + beamWidthX / 2;
    const oreLeft = laneX - oreR;
    const oreRight = laneX + oreR;
    if (beamRight >= oreLeft && beamLeft <= oreRight) return true;
  }
  return false;
}

function distPointToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  const apx = px - ax, apy = py - ay;
  const abLen2 = abx * abx + aby * aby;
  let t = abLen2 === 0 ? 0 : (apx * abx + apy * aby) / abLen2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * abx, cy = ay + t * aby;
  return Math.hypot(px - cx, py - cy);
}

// Azure's beam rotates in a VERTICAL plane (belt-width x, height z), not the
// ground (x,y) plane — confirmed in-game: the pivot sits fixed at one
// belt-length position (pivotY) and one height (pivotHeight, ~1.3-1.4 tiles
// up), and only ever sweeps side to side / up and down at that one slice of
// the belt. It never moves forward/backward along the belt. Ore height is the
// same value as its diameter (oreSizeTiles).
//
// Two things confirmed directly from the real Part dimensions (not the
// earlier one-sided-ray guess):
// - The beam is a FULL DIAMETER through the pivot (2 tiles total reach,
//   confirmed to always touch both belt edges when horizontal) — i.e. it has
//   two live ends, one at pivot + beamHalfLen*(cos,sin) and one at
//   pivot - beamHalfLen*(cos,sin), not just one ray from the pivot outward.
// - The beam Part itself has real thickness along the belt's length (y),
//   beamThicknessY — NOT zero as first assumed. That's a second, independent
//   source of y-tolerance on top of the ore's own size, and matters a lot:
//   without it, an ore only gets a window sized by its own height, which
//   badly underestimates real hit chance.
//
// timeOffset: absolute os.clock() value at which THIS ore's own local clock
// (its y=0 moment) occurs. baseAngleDeg: the beam's angle at the shared
// absolute os.clock()=0 baseline (same for every ore in a sequence — it's
// "what phase Azure happened to be at when the base started running").
function rotateHitOnce({ pivotX, pivotY, pivotHeight, beamHalfLen, beamWidth, beamThicknessY, speedDeg, conveyorSpeed, oreSizeTiles, laneX, timeOffset, baseAngleDeg, dt = TICK_DT }) {
  const oreR = oreSizeTiles / 2;
  const threshold = oreR + beamWidth / 2; // (x,z)-plane tolerance: ore radius + beam's in-plane half-thickness
  // The beam's own y-thickness directly reduces how close the ore needs to be
  // in y (effectiveDy = max(0, |dy| - beamThicknessY/2)), so the widest
  // possible window is threshold + beamThicknessY/2.
  const yWindowHalf = threshold + beamThicknessY / 2;
  const tStart = (pivotY - yWindowHalf) / conveyorSpeed; // local (relative to this ore's own y=0)
  const tEnd = (pivotY + yWindowHalf) / conveyorSpeed;
  if (tEnd <= tStart) return false;
  const gStart = timeOffset + tStart;
  const gEnd = timeOffset + tEnd;
  const kStart = Math.ceil(gStart / dt);
  const kEnd = Math.floor(gEnd / dt);
  const oreZ = oreR; // ore center sits at its own radius above the belt floor
  for (let k = kStart; k <= kEnd; k++) {
    const globalT = k * dt;
    const t = globalT - timeOffset; // local
    const oreY = t * conveyorSpeed;
    const dy = oreY - pivotY;
    if (Math.abs(dy) > yWindowHalf) continue;
    const effectiveDy = Math.max(0, Math.abs(dy) - beamThicknessY / 2);
    const theta = ((baseAngleDeg + speedDeg * globalT) * Math.PI) / 180;
    const cosT = Math.cos(theta), sinT = Math.sin(theta);
    const ax = pivotX - beamHalfLen * cosT, az = pivotHeight - beamHalfLen * sinT;
    const bx = pivotX + beamHalfLen * cosT, bz = pivotHeight + beamHalfLen * sinT;
    const distXZ = distPointToSegment(laneX, oreZ, ax, az, bx, bz);
    const dist = Math.hypot(effectiveDy, distXZ);
    if (dist <= threshold) return true;
  }
  return false;
}

// ---- Deterministic sequential-drop simulation ------------------------------------
// Simulates a real stream of nOre ore at fixed spacing against the beam's own
// continuous clock, for one arbitrary "session start" phase. Repeated across
// many random session-start phases to see whether the outcome is stable or
// resonance-locked to when the base happened to start running.

function laneX(convX, convWidth, laneFrac) {
  return convX + laneFrac * convWidth;
}

function sweepSequenceHitRate(cfg, { oreSizeRaw, dropSpeed, laneFrac, nOre = 300, sessionOffset }) {
  const oreSizeTiles = oreSizeRaw * ORE_TO_TILE;
  const spacing = Math.max(oreSizeTiles, cfg.conveyorSpeed / dropSpeed);
  const lx = laneX(cfg.convX, cfg.convWidth, laneFrac);
  let hits = 0;
  for (let i = 0; i < nOre; i++) {
    const oreStartDelay = (i * spacing) / cfg.conveyorSpeed;
    const phase0 = sessionOffset + oreStartDelay;
    if (sweepHitOnce({ ...cfg, oreSizeTiles, laneX: lx, phase0 })) hits++;
  }
  return hits / nOre;
}

function rotateSequenceHitRate(cfg, { oreSizeRaw, dropSpeed, laneFrac, nOre = 300, sessionOffsetDeg }) {
  const oreSizeTiles = oreSizeRaw * ORE_TO_TILE;
  const spacing = Math.max(oreSizeTiles, cfg.conveyorSpeed / dropSpeed);
  const lx = laneX(cfg.convX, cfg.convWidth, laneFrac);
  let hits = 0;
  for (let i = 0; i < nOre; i++) {
    const timeOffset = (i * spacing) / cfg.conveyorSpeed;
    if (rotateHitOnce({ ...cfg, oreSizeTiles, laneX: lx, timeOffset, baseAngleDeg: sessionOffsetDeg })) hits++;
  }
  return hits / nOre;
}

function summarizeAcrossOffsets(fn, cfg, params, { nOffsets = 20, offsetPeriod }) {
  const rates = [];
  for (let i = 0; i < nOffsets; i++) {
    const offsetVal = Math.random() * offsetPeriod;
    const offsetKey = fn === sweepSequenceHitRate ? "sessionOffset" : "sessionOffsetDeg";
    rates.push(fn(cfg, { ...params, [offsetKey]: offsetVal }));
  }
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  return { mean, min, max };
}

// ---- Scanner geometry, taken from data/item-geometry-worksheet.json "confirmed" ----

// conveyorSpeed is stored raw (studs/sec, 3 studs == 1 tile) — divide by 3 to
// get tile-grid speed matching the rest of this file's coordinates.
const STUDS_PER_TILE = 3;

const SCANNERS = {
  "Ancient Scanner": {
    kind: "sweep",
    convX: 1, convWidth: 2,
    beamY: 1.4, beamLenY: 0.125, beamWidthX: 0.2,
    speedCyc: 1.0345,
    conveyorSpeed: 15 / STUDS_PER_TILE,
  },
  "Star Scanner": {
    kind: "sweep",
    convX: 1, convWidth: 2,
    beamY: 1.3, beamLenY: 0.125, beamWidthX: 0.2,
    speedCyc: 0.159,
    conveyorSpeed: 12 / STUDS_PER_TILE,
  },
  "Precision Ore Scanner": {
    kind: "sweep",
    convX: 2, convWidth: 2,
    beamY: 1, beamLenY: 0.125, beamWidthX: 0.1,
    speedCyc: 1.0345,
    conveyorSpeed: 12 / STUDS_PER_TILE,
  },
  "Azure Scanner": {
    kind: "rotate",
    pivotX: 2, pivotY: 1, pivotHeight: 1.1, // eyeballed from a screenshot against a known ore size (2.464 raw = 0.985 tiles); imprecise, needs a firmer number
    beamHalfLen: 1, beamWidth: 0.2, beamThicknessY: 0.125, // total beam length is 2 (edge to edge); halfLen is pivot-to-tip in each direction
    speedDeg: 180,
    conveyorSpeed: 10 / STUDS_PER_TILE,
    convX: 1, convWidth: 2,
    guaranteedHitAtOrAboveRaw: 1.25,
  },
};

// ---- Closed-form formulas, fit against the simulated data -----------------------
// These approximate the full deterministic-sequence simulation without having
// to actually run one. Fit quality (RMSE against the simulated averages,
// across all 3 sweep scanners, 11 ore sizes, 3 lanes): ~5.7 percentage points.
//
// Sweep derivation: the beam's center X(t) = convX + convWidth*(sin(2*pi*
// speedCyc*t)+1)/2 is a sinusoid, so at a uniformly random arrival phase its
// position follows an arcsine distribution (lingers longest at the belt's
// edges, fastest through the middle — this is exactly why "confirmed" notes
// on every sweep scanner mention that easing). P(hit) is then the arcsine-CDF
// measure of the beam positions that overlap the ore's (inflated) footprint:
//   P(hit) = (asin(uHi) - asin(uLo)) / pi
// where uLo/uHi map the overlap interval [laneX -/+ halfWidthEff] (clipped to
// the belt) onto [-1, 1]. halfWidthEff = oreR + beamWidthX/2 is the naive
// static overlap margin; SWEEP_DWELL_K (~0.33, fit empirically) inflates that
// further to account for the beam continuing to move during the ore's
// non-negligible dwell window in the beam's y-band (dwell time isn't
// negligible relative to the beam's own period — that's why a purely
// instantaneous/static overlap check underestimates hit chance by ~2x).
const SWEEP_DWELL_K = 0.32;

function predictSweepHitChance(cfg, oreSizeRaw, laneFrac) {
  const oreSizeTiles = oreSizeRaw * ORE_TO_TILE;
  const oreR = oreSizeTiles / 2;
  const laneX = cfg.convX + laneFrac * cfg.convWidth;
  const dwell = (oreSizeTiles + cfg.beamLenY) / cfg.conveyorSpeed;
  const peakBeamSpeed = Math.PI * cfg.speedCyc * cfg.convWidth;
  const halfWidthEff = oreR + cfg.beamWidthX / 2 + SWEEP_DWELL_K * dwell * peakBeamSpeed;
  let lo = Math.max(laneX - halfWidthEff, cfg.convX);
  let hi = Math.min(laneX + halfWidthEff, cfg.convX + cfg.convWidth);
  if (hi <= lo) return 0;
  const uLo = (2 * (lo - cfg.convX)) / cfg.convWidth - 1;
  const uHi = (2 * (hi - cfg.convX)) / cfg.convWidth - 1;
  return (Math.asin(uHi) - Math.asin(uLo)) / Math.PI;
}

// Azure derivation: NOT a clean geometric formula — hit/miss below the
// guaranteed threshold is genuinely resonance/phase-lock sensitive (same ore
// size + drop speed can range from 0% to 100% depending on when the base
// started running), so this is only the EXPECTED VALUE across random session
// phases, fit as a straight line against the simulated averages (R^2 = 0.98
// over the tested range) — not a per-config exact answer the way the sweep
// formula is. Always defer to guaranteedHitAtOrAboveRaw for size >= threshold.
const AZURE_EXPECTED_INTERCEPT = 1.81; // percent
const AZURE_EXPECTED_SLOPE = 28.47; // percent per raw ore-size unit

function predictAzureExpectedHitChance(cfg, oreSizeRaw) {
  if (cfg.guaranteedHitAtOrAboveRaw !== undefined && oreSizeRaw >= cfg.guaranteedHitAtOrAboveRaw) return 1;
  return Math.min(1, Math.max(0, (AZURE_EXPECTED_INTERCEPT + AZURE_EXPECTED_SLOPE * oreSizeRaw) / 100));
}

// Real achievable final ore sizes from data/ore-size-height.index.json (raw units,
// same scale as the database's oreSize field), sampled across the full range.
const ORE_SIZES_RAW = [0.222, 0.488, 0.640, 0.783, 0.930, 1.066, 1.200, 1.445, 1.700, 2.016, 2.464];
const DROP_SPEEDS = [0.25, 1, 1.2, 1.5, 2, 4];
const LANE_FRACTIONS = [0.25, 0.5, 0.75];

function runFullMatrix({ nOre = 300, nOffsets = 20 } = {}) {
  const report = {};
  for (const [name, cfg] of Object.entries(SCANNERS)) {
    report[name] = {};
    for (const laneFrac of LANE_FRACTIONS) {
      report[name][laneFrac] = {};
      for (const oreSizeRaw of ORE_SIZES_RAW) {
        report[name][laneFrac][oreSizeRaw] = {};
        for (const dropSpeed of DROP_SPEEDS) {
          let result;
          if (cfg.guaranteedHitAtOrAboveRaw !== undefined && oreSizeRaw >= cfg.guaranteedHitAtOrAboveRaw) {
            result = { mean: 1, min: 1, max: 1, guaranteed: true };
          } else if (cfg.kind === "sweep") {
            const period = 1 / cfg.speedCyc;
            result = summarizeAcrossOffsets(sweepSequenceHitRate, cfg, { oreSizeRaw, dropSpeed, laneFrac, nOre }, { nOffsets, offsetPeriod: period });
          } else {
            result = summarizeAcrossOffsets(rotateSequenceHitRate, cfg, { oreSizeRaw, dropSpeed, laneFrac, nOre }, { nOffsets, offsetPeriod: 360 });
          }
          report[name][laneFrac][oreSizeRaw][dropSpeed] = result;
        }
      }
    }
  }
  return report;
}

function printReport(report) {
  for (const [name, byLane] of Object.entries(report)) {
    console.log(`\n\n########## ${name} ##########`);
    for (const [laneFrac, byOre] of Object.entries(byLane)) {
      console.log(`\n-- lane fraction ${laneFrac} --`);
      console.log(["oreSize(raw)", ...DROP_SPEEDS.map((s) => `speed=${s}`)].join("\t"));
      for (const [oreSizeRaw, byDrop] of Object.entries(byOre)) {
        const row = [Number(oreSizeRaw).toFixed(3)];
        for (const dropSpeed of DROP_SPEEDS) {
          const r = byDrop[dropSpeed];
          const spread = r.max - r.min;
          const cell = r.guaranteed
            ? "100%(fixed)"
            : `${(r.mean * 100).toFixed(1)}%${spread > 0.05 ? `[${(r.min * 100).toFixed(0)}-${(r.max * 100).toFixed(0)}]` : ""}`;
          row.push(cell);
        }
        console.log(row.join("\t"));
      }
    }
  }
}

import { fileURLToPath } from "url";
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const mode = process.argv[2];
  if (mode === "matrix" || mode === undefined) {
    const report = runFullMatrix();
    printReport(report);
    if (mode === "matrix" && process.argv[3] === "--json") {
      console.log("\n\nJSON:\n" + JSON.stringify(report, null, 2));
    }
  }
}

export {
  sweepHitOnce,
  rotateHitOnce,
  sweepSequenceHitRate,
  rotateSequenceHitRate,
  summarizeAcrossOffsets,
  runFullMatrix,
  predictSweepHitChance,
  predictAzureExpectedHitChance,
  SWEEP_DWELL_K,
  AZURE_EXPECTED_INTERCEPT,
  AZURE_EXPECTED_SLOPE,
  SCANNERS,
  ORE_SIZES_RAW,
  DROP_SPEEDS,
  LANE_FRACTIONS,
  ORE_TO_TILE,
};
