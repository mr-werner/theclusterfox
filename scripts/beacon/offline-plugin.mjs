// Builds BeaconFox's offline worker. After Vite bundles the site, this finds
// every file the /beacon page needs (the main bundle, BeaconFox's own chunk,
// what they import, their CSS) and writes /beacon-sw.js with that list, so a
// phone that has opened BeaconFox once can open it again with no signal.
import fs from "node:fs";
import crypto from "node:crypto";

const TEMPLATE = new URL("../../src/features/beacon/offline/sw.template.js", import.meta.url);
const PAGE = /features\/beacon\/BeaconPage\.jsx$/;
const EXTRA = [
  "/apps/beaconfox.webmanifest",
  "/apps/beaconfox-180.png",
  "/apps/beaconfox-192.png",
  "/apps/beaconfox-512.png",
  "/clusterfox-logo.png",
  "/clusterfox-logo.svg",
];

export function filesFor(bundle) {
  const chunks = Object.values(bundle).filter(c => c.type === "chunk");
  const starts = chunks.filter(c => c.isEntry || (c.facadeModuleId && PAGE.test(c.facadeModuleId.replaceAll("\\", "/"))));
  if (!starts.some(c => !c.isEntry)) throw new Error("beacon offline: BeaconPage chunk not found");
  const files = new Set();
  const seen = new Set();
  const visit = name => {
    if (seen.has(name)) return;
    seen.add(name);
    const chunk = bundle[name];
    if (!chunk) return;
    files.add(name);
    if (chunk.type !== "chunk") return;
    chunk.imports.forEach(visit);
    chunk.viteMetadata?.importedCss?.forEach(css => files.add(css));
    chunk.viteMetadata?.importedAssets?.forEach(a => files.add(a));
  };
  starts.forEach(c => visit(c.fileName));
  return [...files].sort().map(f => `/${f}`);
}

export function renderWorker(files) {
  const version = crypto.createHash("sha256").update(files.join("\n")).digest("hex").slice(0, 12);
  const all = [...files, ...EXTRA];
  return fs
    .readFileSync(TEMPLATE, "utf8")
    .replace('"dev"; /*__VERSION__*/', `${JSON.stringify(version)};`)
    .replace("[]; /*__FILES__*/", `${JSON.stringify(all)};`);
}

export default function beaconOffline() {
  return {
    name: "beacon-offline",
    apply: "build",
    generateBundle(_options, bundle) {
      this.emitFile({ type: "asset", fileName: "beacon-sw.js", source: renderWorker(filesFor(bundle)) });
    },
  };
}
