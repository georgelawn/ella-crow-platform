import { existsSync, readFileSync, statSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const failures = [];

function fail(message) {
  failures.push(message);
}

function requireNonEmpty(relativePath) {
  const path = resolve(root, relativePath);
  if (!existsSync(path)) {
    fail(`Missing required file: ${relativePath}`);
  } else if (statSync(path).size === 0) {
    fail(`Required file is empty: ${relativePath}`);
  }
}

async function filesUnder(relativeDirectory) {
  const directory = resolve(root, relativeDirectory);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = `${relativeDirectory}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...await filesUnder(relativePath));
    } else {
      files.push(relativePath);
    }
  }

  return files;
}

const rootFiles = await readdir(root);
const javascriptFiles = rootFiles.filter((file) => extname(file) === ".js");

for (const file of javascriptFiles) {
  const result = spawnSync(process.execPath, ["--check", resolve(root, file)], {
    encoding: "utf8"
  });
  if (result.status !== 0) {
    fail(`JavaScript syntax failed for ${file}:\n${result.stderr.trim()}`);
  }
}

const htmlFiles = [
  ...rootFiles.filter((file) => extname(file) === ".html"),
  ...(await filesUnder("squarespace-bio-links"))
    .filter((file) => extname(file) === ".html")
];

for (const file of htmlFiles) {
  const html = readFileSync(resolve(root, file), "utf8");
  const references = html.matchAll(/<(?:script|link)\b[^>]+(?:src|href)=["']([^"']+)["']/gi);

  for (const [, reference] of references) {
    if (/^(?:https?:)?\/\//.test(reference) || reference.startsWith("data:")) {
      continue;
    }

    const cleanReference = reference.split(/[?#]/, 1)[0];
    if (!cleanReference || cleanReference.startsWith("/")) {
      continue;
    }

    const referencedPath = resolve(root, file, "..", cleanReference);
    if (!existsSync(referencedPath)) {
      fail(`${file} references missing local file: ${reference}`);
    }
  }
}

[
  "README.md",
  "AGENTS.md",
  "PROJECT_CONTEXT.md",
  "cloud-config.js",
  "supabase/config.toml",
  "assets/ella-crow-logo.svg"
].forEach(requireNonEmpty);

const cloudConfig = readFileSync(resolve(root, "cloud-config.js"), "utf8");
const supabaseConfig = readFileSync(resolve(root, "supabase/config.toml"), "utf8");
const projectId = supabaseConfig.match(/project_id\s*=\s*"([^"]+)"/)?.[1];

if (!projectId) {
  fail("supabase/config.toml does not define project_id");
} else if (!cloudConfig.includes(projectId)) {
  fail("cloud-config.js and supabase/config.toml use different Supabase projects");
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(
  `Static checks passed: ${javascriptFiles.length} JavaScript files, ` +
  `${htmlFiles.length} HTML files, project configuration, and required assets.`
);
