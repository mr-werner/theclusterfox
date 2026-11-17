// Minimal glTF binary (.glb) reader for the HRA models: plain triangle meshes, no node transforms.
import fs from "node:fs";
export function loadGlb(file) {
  const b = fs.readFileSync(file);
  const jl = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + jl).toString());
  const binStart = 20 + jl + 8;
  return { json, bin: b.subarray(binStart) };
}
function read(g, ai, comps) {
  const a = g.json.accessors[ai], bv = g.json.bufferViews[a.bufferView];
  const off = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const T = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array, 5121: Uint8Array }[a.componentType];
  const stride = bv.byteStride ? bv.byteStride / T.BYTES_PER_ELEMENT : comps;
  const src = new T(g.bin.buffer, g.bin.byteOffset + off, (a.count - 1) * stride + comps);
  const out = new Float64Array(a.count * comps);
  for (let i = 0; i < a.count; i++) for (let c = 0; c < comps; c++) out[i * comps + c] = src[i * stride + c];
  return out;
}
/** Every mesh under nodes whose name matches re: [{name, positions, indices}] */
export function meshes(g, re, { leafOnly = true } = {}) {
  const out = [];
  const nodes = g.json.nodes;
  const walk = (i, inside) => {
    const n = nodes[i];
    const hit = inside || re.test(n.name);
    if (hit && n.mesh != null) {
      const pos = [], idx = [];
      for (const p of g.json.meshes[n.mesh].primitives) {
        const P = read(g, p.attributes.POSITION, 3), base = pos.length / 3;
        for (const v of P) pos.push(v);
        const I = p.indices != null ? read(g, p.indices, 1) : P.map((_, k) => k).slice(0, P.length / 3);
        for (const v of I) idx.push(v + base);
      }
      out.push({ name: n.name, positions: new Float64Array(pos), indices: Uint32Array.from(idx) });
    }
    for (const c of n.children ?? []) walk(c, hit);
  };
  for (const r of g.json.scenes[0].nodes) walk(r, false);
  return out;
}
export function box(list) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const m of list) for (let i = 0; i < m.positions.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], m.positions[i + a]); hi[a] = Math.max(hi[a], m.positions[i + a]); }
  return [lo, hi];
}
