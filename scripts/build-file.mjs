import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(projectRoot, "dist");
const htmlPath = join(distDir, "index.html");

let html = await readFile(htmlPath, "utf8");

html = await inlineTag(
  html,
  /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["'](?<asset>[^"']+)["'][^>]*>/,
  async (asset) => `<style>\n${await readAsset(asset)}\n</style>`,
);

const scriptMatch = html.match(/<script\b[^>]*type=["']module["'][^>]*src=["'](?<asset>[^"']+)["'][^>]*><\/script>/);
const scriptAsset = scriptMatch?.groups?.asset;
if (!scriptMatch || !scriptAsset) throw new Error("Missing build script asset");
html = html.replace(scriptMatch[0], "");
html = html.replace("</body>", `<script>\n${escapeScript(await readAsset(scriptAsset))}\n</script>\n  </body>`);

html = html.replace(/<link\b[^>]*rel=["']modulepreload["'][^>]*>\s*/g, "");

await writeFile(htmlPath, html);
console.log("Wrote file-openable build to dist/index.html");

async function inlineTag(source, pattern, render) {
  const match = source.match(pattern);
  const asset = match?.groups?.asset;
  if (!asset) throw new Error(`Missing build asset matching ${pattern}`);
  return source.replace(match[0], await render(asset));
}

async function readAsset(asset) {
  return readFile(join(distDir, asset.replace(/^\/?/, "").replace(/^\.\//, "")), "utf8");
}

function escapeScript(source) {
  return source.replace(/<\/script/gi, "<\\/script");
}
