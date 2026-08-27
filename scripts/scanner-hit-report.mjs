#!/usr/bin/env node
// Renders the scanner-hit-simulator's full matrix as a clean, readable
// Markdown report instead of a raw tab-separated dump.
//
// Usage: node scripts/scanner-hit-report.mjs > scanner-hit-report.md

import {
  runFullMatrix,
  ORE_SIZES_RAW,
  DROP_SPEEDS,
  LANE_FRACTIONS,
  SCANNERS,
  predictSweepHitChance,
  predictAzureExpectedHitChance,
  SWEEP_DWELL_K,
  AZURE_EXPECTED_INTERCEPT,
  AZURE_EXPECTED_SLOPE,
} from "./scanner-hit-simulator.mjs";

function pct(x) {
  return `${(x * 100).toFixed(1)}%`;
}

function cell(r) {
  if (r.guaranteed) return "**100%** (guaranteed)";
  const spread = r.max - r.min;
  const mean = pct(r.mean);
  if (spread > 0.05) {
    return `${mean} (${pct(r.min)}–${pct(r.max)})`;
  }
  return mean;
}

// "Overall" hit chance regardless of lane: the plain average of the 3 tested
// lane fractions' mean hit rates, for each (oreSize, dropSpeed) cell. This is
// NOT re-simulated — it's an average of the already-simulated per-lane means.
function renderOverall(byLane) {
  const lines = [];
  lines.push(`### Overall (averaged across the 3 lane positions)`);
  lines.push("");
  lines.push(`| Ore size (raw) | ${DROP_SPEEDS.map((s) => `Drop speed ${s}`).join(" | ")} |`);
  lines.push(`|---|${DROP_SPEEDS.map(() => "---").join("|")}|`);
  for (const oreSizeRaw of ORE_SIZES_RAW) {
    const row = [oreSizeRaw.toFixed(3)];
    for (const dropSpeed of DROP_SPEEDS) {
      const cells = LANE_FRACTIONS.map((lf) => byLane[lf][oreSizeRaw][dropSpeed]);
      if (cells.every((c) => c.guaranteed)) {
        row.push("**100%** (guaranteed)");
        continue;
      }
      const avgMean = cells.reduce((a, c) => a + c.mean, 0) / cells.length;
      const avgMin = cells.reduce((a, c) => a + c.min, 0) / cells.length;
      const avgMax = cells.reduce((a, c) => a + c.max, 0) / cells.length;
      row.push(cell({ mean: avgMean, min: avgMin, max: avgMax }));
    }
    lines.push(`| ${row.join(" | ")} |`);
  }
  lines.push("");
  return lines.join("\n");
}

function avgSimulated(byLane, oreSizeRaw) {
  let sum = 0, n = 0;
  for (const lf of LANE_FRACTIONS) {
    for (const ds of DROP_SPEEDS) {
      const c = byLane[lf][oreSizeRaw][ds];
      sum += c.guaranteed ? 1 : c.mean;
      n++;
    }
  }
  return sum / n;
}

// One overall number per scanner: the plain average of every tested cell
// (all ore sizes x all drop speeds x all 3 lanes) — a rough "how good is this
// upgrader on average" figure, NOT weighted by how common any given ore size
// or drop speed actually is in real play.
function renderOverallPerScanner(report) {
  const lines = [];
  lines.push("### Overall hit chance per scanner (averaged across every tested ore size, drop speed, and lane)");
  lines.push("");
  lines.push(
    "This collapses the entire matrix into one number per scanner — useful for a quick side-by-side, but it treats every tested ore size and drop speed as equally likely, which isn't necessarily true in real play."
  );
  lines.push("");
  lines.push("| Scanner | Overall average hit chance |");
  lines.push("|---|---|");
  for (const [name, cfg] of Object.entries(SCANNERS)) {
    let sum = 0, n = 0;
    for (const lf of LANE_FRACTIONS) {
      for (const oreSizeRaw of ORE_SIZES_RAW) {
        for (const dropSpeed of DROP_SPEEDS) {
          const c = report[name][lf][oreSizeRaw][dropSpeed];
          sum += c.guaranteed ? 1 : c.mean;
          n++;
        }
      }
    }
    lines.push(`| ${name} | ${pct(sum / n)} |`);
  }
  lines.push("");
  return lines.join("\n");
}

function renderFormula(report) {
  const lines = [];
  lines.push("## Derived formula");
  lines.push("");
  lines.push(
    "**Sweep scanners (Ancient, Star, Precision):** the beam's center follows a sinusoid, so at a random arrival phase its position follows an arcsine distribution — it lingers longest at the belt's edges, moves fastest through the middle. Hit chance is the arcsine-CDF measure of beam positions overlapping the ore's footprint:"
  );
  lines.push("");
  lines.push("```");
  lines.push("P(hit) = (asin(uHi) - asin(uLo)) / pi");
  lines.push("");
  lines.push("oreR          = (oreSizeRaw / 2.5) / 2        # tile radius");
  lines.push("laneX         = convX + laneFrac * convWidth");
  lines.push("dwell         = (oreSizeTiles + beamLenY) / conveyorSpeed");
  lines.push("peakBeamSpeed = pi * speedCyc * convWidth");
  lines.push(`halfWidthEff  = oreR + beamWidthX/2 + ${SWEEP_DWELL_K} * dwell * peakBeamSpeed`);
  lines.push("lo, hi        = clip([laneX - halfWidthEff, laneX + halfWidthEff], convX, convX+convWidth)");
  lines.push("uLo, uHi      = map [lo, hi] from [convX, convX+convWidth] onto [-1, 1]");
  lines.push("```");
  lines.push("");
  lines.push(
    `The ${SWEEP_DWELL_K} constant corrects for the ore's dwell time in the beam's band not being negligible relative to the beam's own oscillation period — a purely instantaneous overlap check underestimates hit chance by roughly 2x. Fit against the simulated data (all 3 sweep scanners, 11 ore sizes, 3 lanes): **RMSE ≈ 5.7 percentage points** (refit after the beam-thickness/pivot-height corrections; roughly unchanged from before).`
  );
  lines.push("");
  lines.push(
    `**Azure Scanner (rotate):** below its guaranteed threshold, hit/miss is genuinely resonance-sensitive — the *same* ore size and drop speed can land anywhere from 0% to 100% depending purely on when the base started running (see the wide min–max spreads in Azure's tables below). There is no clean per-config formula for this the way there is for sweep scanners. What follows is only the **expected value averaged across random session-start phases** — useful for planning around, not a guarantee for any specific base:`
  );
  lines.push("");
  lines.push("```");
  lines.push(`P(hit) = 1                                   if oreSizeRaw >= 1.25 (guaranteed)`);
  lines.push(`P(hit) = (${AZURE_EXPECTED_INTERCEPT} + ${AZURE_EXPECTED_SLOPE} * oreSizeRaw) / 100      otherwise (expected value)`);
  lines.push("```");
  lines.push("");
  lines.push("Fit as a straight line against the simulated averages below 1.25 (R² = 0.96 over the tested range).");
  lines.push("");
  lines.push(renderOverallPerScanner(report));
  lines.push("### Formula vs. simulation (sanity check)");
  lines.push("");
  lines.push("| Scanner | Ore size (raw) | Simulated avg | Formula predicted | Diff |");
  lines.push("|---|---|---|---|---|");
  for (const [name, cfg] of Object.entries(SCANNERS)) {
    for (const oreSizeRaw of ORE_SIZES_RAW) {
      const actual = avgSimulated(report[name], oreSizeRaw) * 100;
      let predicted;
      if (cfg.kind === "sweep") {
        predicted = (LANE_FRACTIONS.reduce((a, lf) => a + predictSweepHitChance(cfg, oreSizeRaw, lf), 0) / LANE_FRACTIONS.length) * 100;
      } else {
        predicted = predictAzureExpectedHitChance(cfg, oreSizeRaw) * 100;
      }
      const diff = predicted - actual;
      lines.push(`| ${name} | ${oreSizeRaw.toFixed(3)} | ${actual.toFixed(1)}% | ${predicted.toFixed(1)}% | ${diff >= 0 ? "+" : ""}${diff.toFixed(1)}pp |`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

function renderScanner(name, cfg, byLane) {
  const lines = [];
  lines.push(`## ${name}`);
  lines.push("");
  lines.push(`Type: **${cfg.kind}**${cfg.guaranteedHitAtOrAboveRaw !== undefined ? ` — ore size ≥ ${cfg.guaranteedHitAtOrAboveRaw} (raw) is a guaranteed hit` : ""}`);
  lines.push("");
  lines.push(renderOverall(byLane));
  for (const laneFrac of LANE_FRACTIONS) {
    const laneLabel = laneFrac === 0.5 ? "center (0.5)" : laneFrac < 0.5 ? `left (${laneFrac})` : `right (${laneFrac})`;
    lines.push(`### Lane: ${laneLabel}`);
    lines.push("");
    lines.push(`| Ore size (raw) | ${DROP_SPEEDS.map((s) => `Drop speed ${s}`).join(" | ")} |`);
    lines.push(`|---|${DROP_SPEEDS.map(() => "---").join("|")}|`);
    const byOre = byLane[laneFrac];
    for (const oreSizeRaw of ORE_SIZES_RAW) {
      const row = [oreSizeRaw.toFixed(3)];
      for (const dropSpeed of DROP_SPEEDS) {
        row.push(cell(byOre[oreSizeRaw][dropSpeed]));
      }
      lines.push(`| ${row.join(" | ")} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function main() {
  const nOre = Number(process.argv[2]) || 3000;
  const nOffsets = Number(process.argv[3]) || 200;
  const t0 = Date.now();
  const report = runFullMatrix({ nOre, nOffsets });
  const elapsedS = ((Date.now() - t0) / 1000).toFixed(1);
  const out = [];
  out.push("# Scanner hit-chance simulation results");
  out.push("");
  out.push(
    "Simulated (not measured in-game) hit rates from the geometry-based kinematic model in `scripts/scanner-hit-simulator.mjs`, using real ore sizes from `data/ore-size-height.index.json` and real drop speeds from the dropper database."
  );
  out.push("");
  out.push(
    `**How to read a cell:** \`mean% (min%–max%)\` — mean hit rate across ${nOffsets} randomized "session start" phases (representing different times the base could have started running), each phase itself averaged over a real sequential stream of ${nOre} ore at fixed spacing. The min/max is shown only when the spread exceeds 5 points. A wide spread means the real hit rate for that exact ore size/drop speed is sensitive to timing luck (phase-lock with the beam), not a single stable number — that's a real property of the mechanic, not simulation noise.`
  );
  out.push("");
  out.push(`*(${nOre} ore × ${nOffsets} phase offsets per cell, computed in ${elapsedS}s)*`);
  out.push("");
  out.push(`- Ore sizes tested (raw database units, 2.5 raw = 1 tile): ${ORE_SIZES_RAW.join(", ")}`);
  out.push(`- Drop speeds tested (ore/sec): ${DROP_SPEEDS.join(", ")}`);
  out.push(`- Lane fractions tested (position across the belt): ${LANE_FRACTIONS.join(", ")}`);
  out.push("");
  out.push("---");
  out.push("");
  out.push(renderFormula(report));
  out.push("---");
  out.push("");
  for (const [name, cfg] of Object.entries(SCANNERS)) {
    out.push(renderScanner(name, cfg, report[name]));
    out.push("---");
    out.push("");
  }
  process.stdout.write(out.join("\n"));
}

main();
