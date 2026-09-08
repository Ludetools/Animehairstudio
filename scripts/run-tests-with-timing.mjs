import { spawn } from "node:child_process";
import { parseTestTimings } from "./test-timing.mjs";

const threshold = Math.max(0, Number(process.env.AHS_SLOW_TEST_MS) || 1000);
const child = spawn(process.execPath, ["--test", ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: process.env,
  stdio: ["inherit", "pipe", "pipe"]
});

let stdout = "";
child.stdout.on("data", (chunk) => {
  const text = chunk.toString();
  stdout += text;
  process.stdout.write(text);
});
child.stderr.on("data", (chunk) => process.stderr.write(chunk));

child.on("error", (error) => {
  console.error(`[verify] Could not start Node's test runner: ${error.message}`);
  process.exitCode = 1;
});

child.on("close", (code) => {
  const slow = parseTestTimings(stdout)
    .filter(({ duration }) => duration >= threshold)
    .sort((a, b) => b.duration - a.duration);
  if (slow.length) {
    console.log(`[verify] Tests slower than ${threshold} ms:`);
    slow.forEach(({ name, duration }) => console.log(`  ${duration.toFixed(1)} ms  ${name}`));
  } else {
    console.log(`[verify] No tests exceeded the ${threshold} ms slow-test threshold.`);
  }
  process.exitCode = code ?? 1;
});
