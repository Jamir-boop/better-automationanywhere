#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const rawArgs = process.argv.slice(2).filter((arg) => arg !== "--");

const userArgs = addAuditBase(rawArgs);
const args = [
  ...userArgs,
  "--format",
  "json",
  "--quiet",
  "--explain",
];

const child = spawn(process.execPath, [join(root, "node_modules", "fallow", "bin", "fallow"), ...args], {
  cwd: root,
  stdio: ["ignore", "pipe", "ignore"],
});

child.stdout.pipe(process.stdout);

child.on("error", () => {
  process.exit(2);
});

child.on("close", (code) => {
  process.exit(code === 1 ? 0 : code ?? 2);
});

function addAuditBase(args) {
  if (args[0] !== "audit" || hasArg(args, "--base")) return args;

  const base =
    process.env.FALLOW_BASE ||
    git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]) ||
    git(["rev-parse", "--verify", "HEAD~1"]);

  return base ? [...args, "--base", base] : args;
}

function hasArg(args, name) {
  return args.includes(name) || args.some((arg) => arg.startsWith(`${name}=`));
}

function git(args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  return result.status === 0 ? result.stdout.trim() : "";
}
