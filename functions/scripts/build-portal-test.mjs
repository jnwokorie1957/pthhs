import {copyFile, cp, mkdir, readFile, writeFile} from "node:fs/promises";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const out = path.join(root, "portal-test-build");
const compile = spawnSync(process.execPath, ["node_modules/typescript/bin/tsc", "--outDir", path.join(out, "lib")], {cwd: root, stdio: "inherit"});
if (compile.status !== 0) process.exit(compile.status ?? 1);
await mkdir(out, {recursive: true});
await cp(path.join(root, "assets"), path.join(out, "assets"), {recursive: true});
const manifest = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
manifest.main = "lib/portalTestEntry.js";
delete manifest.scripts;
await writeFile(path.join(out, "package.json"), JSON.stringify(manifest, null, 2) + "\n");
await copyFile(path.join(root, "package-lock.json"), path.join(out, "package-lock.json"));
