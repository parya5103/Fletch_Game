#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "js", "game.js");
const outputPath = path.join(root, "android-native", "app", "src", "main", "assets", "arrow-levels.v1.json");
const source = fs.readFileSync(sourcePath, "utf8");
const sandbox = {};
vm.runInNewContext(source + "\n;globalThis.__GameCore = GameCore;", sandbox, {
  filename: "js/game.js",
  timeout: 30_000
});
const core = sandbox.__GameCore;
if (!core || typeof core.genLevel !== "function" || typeof core.validateBoardSolution !== "function") {
  throw new Error("GameCore level generator API is unavailable");
}

const levels = [];
for (let level = 1; level <= core.DESIGN_LEVELS; level++) {
  const generated = core.genLevel(level);
  if (generated.level !== level ||
      !core.validateBoardSolution(generated.cols, generated.rows, generated.arrows) ||
      generated.arrows.length !== core.levelConfig(level).pieces) {
    throw new Error("Level " + level + " failed deterministic validation");
  }
  levels.push({
    level,
    cols: generated.cols,
    rows: generated.rows,
    shape: Array.from(generated.shape),
    arrows: generated.arrows.map((arrow) => ({
      cells: arrow.cells.map((cell) => [cell.x, cell.y]),
      dir: arrow.dir,
      color: arrow.c,
      step: arrow.step
    }))
  });
}
if (levels.length !== core.DESIGN_LEVELS) {
  throw new Error("Expected " + core.DESIGN_LEVELS + " levels, generated " + levels.length);
}
const dailyChallenges = [];
const startUtc = new Date(Date.now() - 24 * 60 * 60 * 1000);
for (let offset = 0; offset < 730; offset++) {
  const date = new Date(Date.UTC(startUtc.getUTCFullYear(), startUtc.getUTCMonth(), startUtc.getUTCDate() + offset));
  const daily = core.genDailyChallenge(date);
  if (!core.validateBoardSolution(daily.cols, daily.rows, daily.arrows)) {
    throw new Error("Daily challenge " + daily.date + " failed solver validation");
  }
  dailyChallenges.push({
    date: daily.date,
    cols: daily.cols,
    rows: daily.rows,
    shape: Array.from(daily.shape),
    arrows: daily.arrows.map((arrow) => ({
      cells: arrow.cells.map((cell) => [cell.x, cell.y]),
      dir: arrow.dir,
      color: arrow.c,
      step: arrow.step
    }))
  });
}
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify({ version: 1, generator: "GameCore", levels, dailyChallenges }));
const bytes = fs.statSync(outputPath).size;
process.stdout.write("Generated and solver-validated " + levels.length + " Arrow Out levels (" + bytes + " bytes)\n");
