import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { crap, parseArgs } from "./crap.mjs";

const CLI = fileURLToPath(new URL("./crap.mjs", import.meta.url));

function runCli(args, input) {
  const tmp = mkdtempSync(join(tmpdir(), "crap-"));
  const file = join(tmp, "in.json");
  writeFileSync(file, input ?? "[]");
  try {
    const out = execFileSync("node", [CLI, "--input", file, ...args], {
      encoding: "utf8",
    });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status, out: String(err.stdout ?? "") + String(err.stderr ?? "") };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

test("crap formula: full coverage collapses to complexity", () => {
  assert.equal(crap(1, 1), 1);
  assert.equal(crap(10, 1), 10);
});

test("crap formula: zero coverage is complexity^2 + complexity", () => {
  assert.equal(crap(10, 0), 110); // 100*1 + 10
  assert.equal(crap(1, 0), 2); //   1*1 + 1
});

test("crap formula: known mixed point", () => {
  assert.ok(Math.abs(crap(9, 0.62) - 13.44) < 0.01);
});

test("crap formula: coverage is clamped to [0,1]", () => {
  assert.equal(crap(2, 1.5), crap(2, 1)); // over-1 clamps to 1
  assert.equal(crap(2, -0.5), crap(2, 0)); // below-0 clamps to 0
});

test("parseArgs: defaults and flags", () => {
  assert.deepEqual(parseArgs(["--input", "x.json"]), {
    input: "x.json",
    threshold: 6,
    json: false,
  });
  assert.equal(parseArgs(["--input", "x", "--threshold", "8"]).threshold, 8);
  assert.equal(parseArgs(["--input", "x", "--json"]).json, true);
});

test("CLI: threshold boundary — crap == threshold does not violate", () => {
  // complexity 6, coverage 1 -> crap 6, threshold 6 -> not a violation -> exit 0
  const { code } = runCli(
    ["--threshold", "6"],
    JSON.stringify([{ name: "f", file: "a", complexity: 6, coverage: 1 }]),
  );
  assert.equal(code, 0);
});

test("CLI: a function over threshold exits 1", () => {
  const { code } = runCli(
    ["--threshold", "6"],
    JSON.stringify([{ name: "f", file: "a", complexity: 9, coverage: 0.62 }]),
  );
  assert.equal(code, 1);
});

test("CLI: non-array input exits 2", () => {
  const { code } = runCli([], JSON.stringify({ not: "an array" }));
  assert.equal(code, 2);
});

test("CLI: malformed JSON input exits 2", () => {
  const { code } = runCli([], "{ this is not json");
  assert.equal(code, 2);
});

test("CLI: non-numeric --threshold exits 2", () => {
  const { code } = runCli(
    ["--threshold", "foo"],
    JSON.stringify([{ name: "f", file: "a", complexity: 1, coverage: 1 }]),
  );
  assert.equal(code, 2);
});

test("CLI: malformed row (NaN complexity) counts as a violation, not a pass", () => {
  const { code } = runCli(
    [],
    JSON.stringify([{ name: "f", file: "a", complexity: "oops", coverage: 1 }]),
  );
  assert.equal(code, 1);
});
