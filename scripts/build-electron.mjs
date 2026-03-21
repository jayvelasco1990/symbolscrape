#!/usr/bin/env node
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: root, ...opts });
}

// ── 1. Next.js production build ──────────────────────────────────────────────
console.log("\n=== Building Next.js (standalone) ===");
run("pnpm run build");

// ── 2. Assemble standalone server into electron-server/ ──────────────────────
console.log("\n=== Assembling server bundle ===");
const serverDir = path.join(root, "electron-server");
if (fs.existsSync(serverDir)) fs.rmSync(serverDir, { recursive: true });

// Copy standalone output — dereference symlinks (pnpm uses symlinks that break macOS signing)
fs.cpSync(path.join(root, ".next", "standalone"), serverDir, { recursive: true, dereference: true });

// Next.js standalone doesn't include static assets — copy them in
fs.cpSync(
  path.join(root, ".next", "static"),
  path.join(serverDir, ".next", "static"),
  { recursive: true, dereference: true }
);

// Copy public/ if it exists
const publicDir = path.join(root, "public");
if (fs.existsSync(publicDir)) {
  fs.cpSync(publicDir, path.join(serverDir, "public"), { recursive: true, dereference: true });
}

// ── 2b. Resolve any remaining absolute symlinks (pnpm leaves some in .next/) ──
function resolveAbsoluteSymlinks(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      const target = fs.readlinkSync(full);
      const isAbsolute = path.isAbsolute(target);
      const resolved = isAbsolute ? target : path.resolve(dir, target);
      if (isAbsolute || !fs.existsSync(resolved)) {
        try {
          const real = fs.realpathSync(full);
          fs.unlinkSync(full);
          const stat = fs.statSync(real);
          if (stat.isDirectory()) {
            fs.cpSync(real, full, { recursive: true, dereference: true });
          } else {
            fs.copyFileSync(real, full);
          }
        } catch {
          try { fs.unlinkSync(full); } catch { /* skip */ }
        }
      }
    } else if (entry.isDirectory()) {
      resolveAbsoluteSymlinks(full);
    }
  }
}
console.log("Resolving remaining symlinks...");
resolveAbsoluteSymlinks(serverDir);

// ── 3. Rebuild better-sqlite3 for Electron's Node ABI ────────────────────────
console.log("\n=== Rebuilding native modules for Electron ===");
const electronPkg = JSON.parse(
  fs.readFileSync(path.join(root, "node_modules", "electron", "package.json"), "utf-8")
);
const electronVersion = electronPkg.version;
console.log(`Electron version: ${electronVersion}`);

run(
  `npx @electron/rebuild --version ${electronVersion} --module-dir "${serverDir}" --which-module better-sqlite3`,
  { env: { ...process.env, npm_config_runtime: "electron", npm_config_target: electronVersion } }
);

// ── 4. Package with electron-builder ─────────────────────────────────────────
console.log("\n=== Packaging with electron-builder ===");
run("npx electron-builder");

console.log("\n✓ Done — installers are in ./dist/");
