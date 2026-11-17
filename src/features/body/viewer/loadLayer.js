// Loads one BodyFox layer file (made by scripts/anatomy/build-models.mjs).
//
// File layout: a 4-byte header length, a JSON header, then a meshopt-encoded
// vertex buffer (x, y, z as 16-bit steps across the layer's box, then the
// part number) and a meshopt-encoded index buffer. Decoding takes a few
// milliseconds, far faster than parsing thousands of separate models.

import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

export async function fetchLayer(url, { signal } = {}) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Couldn't load ${url} (${res.status})`);
  return decodeLayer(await res.arrayBuffer());
}

export async function decodeLayer(buffer) {
  await MeshoptDecoder.ready;
  const bytes = new Uint8Array(buffer);
  const headerLength = new DataView(buffer).getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(4, 4 + headerLength)));
  const { vertexCount, indexCount, min, max, vertexBytes, indexBytes } = header;
  const vStart = 4 + headerLength;
  const iStart = vStart + vertexBytes;

  const verts = new Uint16Array(vertexCount * 4);
  MeshoptDecoder.decodeVertexBuffer(new Uint8Array(verts.buffer), vertexCount, 8, bytes.subarray(vStart, vStart + vertexBytes));
  const index = new Uint32Array(indexCount);
  MeshoptDecoder.decodeIndexBuffer(new Uint8Array(index.buffer), indexCount, 4, bytes.subarray(iStart, iStart + indexBytes));

  const positions = new Float32Array(vertexCount * 3);
  const partIndex = new Uint16Array(vertexCount);
  const step = [0, 1, 2].map(a => (max[a] - min[a]) / 65535);
  for (let v = 0; v < vertexCount; v++) {
    positions[v * 3] = min[0] + verts[v * 4] * step[0];
    positions[v * 3 + 1] = min[1] + verts[v * 4 + 1] * step[1];
    positions[v * 3 + 2] = min[2] + verts[v * 4 + 2] * step[2];
    partIndex[v] = verts[v * 4 + 3];
  }
  return { positions, partIndex, index, triangles: indexCount / 3 };
}
