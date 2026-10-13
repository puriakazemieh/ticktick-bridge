import { access, copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";

const vaultPath = process.argv[2];
if (!vaultPath) {
  throw new Error("Usage: npm run deploy -- <path-to-Obsidian-vault>");
}

const vault = path.resolve(vaultPath);
const obsidianDirectory = path.join(vault, ".obsidian");
try {
  const details = await stat(obsidianDirectory);
  if (!details.isDirectory()) throw new Error("not a directory");
} catch {
  throw new Error(`Obsidian vault was not found at: ${vault}`);
}

const project = process.cwd();
for (const file of ["main.js", "manifest.json", "styles.css"]) {
  await access(path.join(project, file));
}

const pluginDirectory = path.join(obsidianDirectory, "plugins", "ticktick-bridge");
await mkdir(pluginDirectory, { recursive: true });
for (const file of ["main.js", "manifest.json", "styles.css"]) {
  await copyFile(path.join(project, file), path.join(pluginDirectory, file));
}
console.log(`TickTick Bridge installed in ${pluginDirectory}`);
