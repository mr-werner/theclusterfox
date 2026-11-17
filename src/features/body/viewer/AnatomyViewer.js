// The 3D body. Plain three.js, kept out of React so the page can re-render
// freely without touching the scene.
//
// Why it stays fast where other web atlases crawl:
// - Each layer (muscles, skeleton, ...) is ONE mesh and one draw call, not
//   hundreds of separate objects. A number on every vertex says which part
//   it belongs to.
// - Hiding, see-through, highlighting and taking parts apart all happen in
//   the shader, by reading a small per-part texture. Changing one part
//   rewrites a few bytes, not the scene.
// - Picking renders a single pixel with part numbers as colours, instead of
//   ray-testing thousands of meshes.
// - It only draws when something changes. A still body costs nothing.
// - Layers load the first time you switch them on.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { fetchLayer } from "./loadLayer";
import { LAYERS, boxCenter, boxSize, explodeOffset, partColor, partShade, unionBox } from "../model/parts";

const TEX = 64; // part textures are 64 × 64, room for 4,096 parts a layer
const SOLID = 255;
const GHOST = 128;
const HIDDEN = 0;
const HIGHLIGHT = new THREE.Color("#3fd0c9");

const VERTEX_PARS = /* glsl */ `
attribute float partIndex;
uniform highp sampler2D partColor;
uniform highp sampler2D partFx;
uniform float explode;
uniform float ghostPass;
varying vec3 vPartColor;
varying float vHighlight;
varying float vKeep;
`;

const VERTEX_BODY = /* glsl */ `
int pIdx = int(partIndex + 0.5);
ivec2 pCell = ivec2(pIdx % ${TEX}, pIdx / ${TEX});
vec4 pCol = texelFetch(partColor, pCell, 0);
vec4 pFx = texelFetch(partFx, pCell, 0);
transformed += pFx.xyz * explode;
vPartColor = pow(pCol.rgb, vec3(2.2));
vHighlight = pFx.w;
vKeep = ghostPass > 0.5 ? step(0.25, pCol.a) * (1.0 - step(0.75, pCol.a)) : step(0.75, pCol.a);
`;

// Parts not drawn in this pass are thrown outside the screen, so the GPU
// skips them before any pixel work.
const HIDE = /* glsl */ `if (vKeep < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);`;

function bodyMaterial(uniforms, ghost) {
  const mat = new THREE.MeshStandardMaterial({
    roughness: 0.62,
    metalness: 0.0,
    transparent: ghost,
    opacity: ghost ? 0.16 : 1,
    depthWrite: !ghost,
    side: ghost ? THREE.FrontSide : THREE.DoubleSide,
  });
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms, { ghostPass: { value: ghost ? 1 : 0 }, highlight: { value: HIGHLIGHT } });
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${VERTEX_PARS}`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\n${VERTEX_BODY}`)
      .replace("#include <project_vertex>", `#include <project_vertex>\n${HIDE}`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 highlight;\nvarying vec3 vPartColor;\nvarying float vHighlight;")
      .replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb = mix(vPartColor, highlight, vHighlight * 0.45);")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += highlight * vHighlight * 0.28;");
  };
  mat.customProgramCacheKey = () => (ghost ? "body-ghost" : "body-solid");
  return mat;
}

function pickMaterial(uniforms, layerNumber) {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { ...uniforms, ghostPass: { value: 0 }, layerNumber: { value: layerNumber } },
    vertexShader: /* glsl */ `
      ${VERTEX_PARS}
      flat varying float vPart;
      void main() {
        vec3 transformed = position;
        ${VERTEX_BODY}
        vPart = partIndex;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
        ${HIDE}
      }`,
    fragmentShader: /* glsl */ `
      uniform float layerNumber;
      flat varying float vPart;
      out highp vec4 pickColor;
      void main() {
        float p = floor(vPart + 0.5);
        pickColor = vec4(layerNumber / 255.0, mod(p, 256.0) / 255.0, floor(p / 256.0) / 255.0, 1.0);
      }`,
    side: THREE.DoubleSide,
  });
}

const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export default class AnatomyViewer {
  /**
   * @param {HTMLElement} container
   * @param {object} opts
   * @param {Array} opts.parts every part from index.json
   * @param {boolean} opts.lite load the lighter models (phones)
   * @param {"male"|"female"} opts.sex which body to show
   * @param {(ref) => void} opts.onSelect a part was tapped (null for empty space)
   * @param {(ref, x, y) => void} opts.onHover
   * @param {(layerId, status) => void} opts.onLayerStatus "loading" | "ready" | "error"
   */
  constructor(container, { parts, lite = false, sex = "male", baseUrl = "/anatomy", onSelect, onHover, onLayerStatus }) {
    this.container = container;
    this.sex = sex;
    this.parts = parts;
    this.lite = lite;
    this.baseUrl = baseUrl;
    this.onSelect = onSelect;
    this.onHover = onHover;
    this.onLayerStatus = onLayerStatus;

    this.body = unionBox(parts.map(p => p.box));
    this.layers = new Map();
    for (const [n, def] of LAYERS.entries()) {
      const layerParts = parts.filter(p => p.layer === def.id);
      this.layers.set(def.id, { def, number: n + 1, parts: layerParts, mode: "off", mesh: null, ghost: null, pick: null, loading: null });
    }
    this.hidden = new Set();
    this.isolated = null; // Set of part ids, or null
    this.selected = null;
    this.hovered = null;
    this.explode = 0;
    this.explodeTarget = 0;

    this.insetBottom = 0;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lite ? 1.5 : 2));
    this.renderer.setClearColor(0x000000, 0);
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.className = "bf-canvas";

    this.scene = new THREE.Scene();
    this.pickScene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.01, 30);
    this.scene.add(this.camera);
    this.scene.add(new THREE.HemisphereLight(0xfff8f0, 0x40342c, 1.35));
    const key = new THREE.DirectionalLight(0xffffff, 1.9);
    key.position.set(0.6, 0.9, 1);
    this.camera.add(key);
    const rim = new THREE.DirectionalLight(0x9fd8ff, 0.55);
    rim.position.set(-1, 0.3, -1.2);
    this.camera.add(rim);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.rotateSpeed = 0.8;
    this.controls.minDistance = 0.06;
    this.controls.maxDistance = 6;
    this.controls.screenSpacePanning = true;
    this.controls.addEventListener("change", () => this.requestRender());
    this.controls.addEventListener("start", () => { this.flight = null; });

    this.pickTarget = new THREE.WebGLRenderTarget(1, 1);
    this.pickPixel = new Uint8Array(4);

    this.resize = this.resize.bind(this);
    this.frame = this.frame.bind(this);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(container);
    this.bindPointer();
    this.resize();
    this.view("front", { instant: true });
  }

  // ---------- Loading ----------

  async ensureLayer(id) {
    const layer = this.layers.get(id);
    if (!layer || layer.mesh) return layer;
    if (!layer.loading) {
      this.onLayerStatus?.(id, "loading");
      const file = this.fileFor(id);
      layer.loading = fetchLayer(`${this.baseUrl}/${file}${this.lite ? "-lite" : ""}.bin`)
        .then(data => {
          if (this.disposed) return;
          // The body was switched while this loaded; the other file is coming.
          if (file !== this.fileFor(id)) return;
          layer.file = file;
          this.buildLayer(layer, data);
          this.onLayerStatus?.(id, "ready");
        })
        .catch(err => {
          layer.loading = null;
          this.onLayerStatus?.(id, "error");
          throw err;
        });
    }
    await layer.loading;
    return layer;
  }

  buildLayer(layer, { positions, partIndex, index }) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("partIndex", new THREE.BufferAttribute(partIndex, 1));
    geometry.setIndex(new THREE.BufferAttribute(index, 1));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    // Parts move when taken apart; keep the bounds generous so nothing is culled.
    geometry.boundingSphere.radius *= 2.5;

    const colorData = new Uint8Array(TEX * TEX * 4);
    const fxData = new Float32Array(TEX * TEX * 4);
    layer.parts.forEach((p, i) => {
      const c = new THREE.Color(partColor(p)).multiplyScalar(partShade(p.id));
      colorData.set([Math.min(255, c.r * 255), Math.min(255, c.g * 255), Math.min(255, c.b * 255), SOLID], i * 4);
      const off = explodeOffset(p, this.body);
      fxData.set([off[0], off[1], off[2], 0], i * 4);
    });
    const partColorTex = new THREE.DataTexture(colorData, TEX, TEX, THREE.RGBAFormat, THREE.UnsignedByteType);
    const partFxTex = new THREE.DataTexture(fxData, TEX, TEX, THREE.RGBAFormat, THREE.FloatType);
    for (const t of [partColorTex, partFxTex]) {
      t.magFilter = t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      t.needsUpdate = true;
    }
    layer.colorData = colorData;
    layer.fxData = fxData;
    layer.colorTex = partColorTex;
    layer.fxTex = partFxTex;
    layer.uniforms = { partColor: { value: partColorTex }, partFx: { value: partFxTex }, explode: { value: this.explode } };

    layer.mesh = new THREE.Mesh(geometry, bodyMaterial(layer.uniforms, false));
    layer.ghost = new THREE.Mesh(geometry, bodyMaterial(layer.uniforms, true));
    layer.ghost.renderOrder = 10;
    layer.pick = new THREE.Mesh(geometry, pickMaterial(layer.uniforms, layer.number));
    for (const m of [layer.mesh, layer.ghost, layer.pick]) m.frustumCulled = false;
    this.scene.add(layer.mesh, layer.ghost);
    this.pickScene.add(layer.pick);
    layer.partIndexById = new Map(layer.parts.map((p, i) => [p.id, i]));
    this.refreshLayer(layer);
  }

  /** The model file for a layer: only the skin differs between the bodies. */
  fileFor(id) {
    return id === "skin" && this.sex === "female" ? "skin-female" : id;
  }

  /** Switch between the male and female body. */
  async setSex(sex) {
    if (sex === this.sex) return;
    this.sex = sex;
    for (const layer of this.layers.values()) {
      const stale = layer.mesh ? layer.file !== this.fileFor(layer.def.id) : layer.loading && layer.def.id === "skin";
      if (!stale) continue;
      if (layer.mesh) this.dropLayer(layer);
      layer.loading = null;
      if (layer.mode !== "off") this.ensureLayer(layer.def.id).then(() => this.refreshLayer(layer)).catch(() => {});
    }
    if (this.selected && !this.partShown(this.selected)) this.selected = null;
    this.refreshAll();
  }

  /** Does this part exist in the body being shown? */
  partShown(part) {
    return !part.sex || part.sex === (this.sex === "female" ? "f" : "m");
  }

  dropLayer(layer) {
    this.scene.remove(layer.mesh, layer.ghost);
    this.pickScene.remove(layer.pick);
    layer.mesh.geometry.dispose();
    for (const m of [layer.mesh, layer.ghost, layer.pick]) m.material.dispose();
    layer.colorTex.dispose();
    layer.fxTex.dispose();
    layer.mesh = layer.ghost = layer.pick = null;
    layer.loading = null;
  }

  // ---------- What is shown ----------

  /** mode: "solid" | "ghost" | "off" */
  async setLayerMode(id, mode) {
    const layer = this.layers.get(id);
    layer.mode = mode;
    if (mode !== "off") await this.ensureLayer(id);
    this.refreshLayer(layer);
  }

  stateOf(layer, part) {
    if (layer.mode === "off" || this.hidden.has(part.id) || !this.partShown(part)) return HIDDEN;
    if (this.isolated) return this.isolated.has(part.id) ? SOLID : layer.mode === "off" ? HIDDEN : GHOST;
    return layer.mode === "ghost" ? GHOST : SOLID;
  }

  refreshLayer(layer) {
    if (!layer.mesh) return;
    let anyGhost = false;
    let anySolid = false;
    layer.parts.forEach((p, i) => {
      const s = this.stateOf(layer, p);
      layer.colorData[i * 4 + 3] = s;
      if (s === GHOST) anyGhost = true;
      if (s === SOLID) anySolid = true;
      layer.fxData[i * 4 + 3] = this.selected?.id === p.id ? 1 : this.hovered?.id === p.id ? 0.45 : 0;
    });
    layer.colorTex.needsUpdate = true;
    layer.fxTex.needsUpdate = true;
    layer.mesh.visible = anySolid;
    layer.pick.visible = anySolid;
    layer.ghost.visible = anyGhost;
    this.requestRender();
  }

  refreshAll() {
    for (const layer of this.layers.values()) {
      // Fainter see-through when one part is shown alone, so it stands out.
      if (layer.ghost) layer.ghost.material.opacity = this.isolated ? 0.07 : 0.16;
      this.refreshLayer(layer);
    }
  }

  hidePart(part) {
    this.hidden.add(part.id);
    if (this.selected?.id === part.id) this.selected = null;
    this.refreshLayer(this.layers.get(part.layer));
  }

  unhide(ids) {
    for (const id of ids) this.hidden.delete(id);
    this.refreshAll();
  }

  showAll() {
    this.hidden.clear();
    this.isolated = null;
    this.refreshAll();
  }

  /** Show only these parts solid; everything else on goes see-through. */
  isolate(parts) {
    this.isolated = parts ? new Set(parts.map(p => p.id)) : null;
    this.refreshAll();
  }

  select(part) {
    const before = this.selected;
    this.selected = part;
    for (const p of [before, part]) if (p) this.refreshLayer(this.layers.get(p.layer));
  }

  setHover(part) {
    if (this.hovered?.id === part?.id) return;
    const before = this.hovered;
    this.hovered = part;
    for (const p of [before, part]) if (p) this.refreshLayer(this.layers.get(p.layer));
  }

  /** 0 = together, 1 = fully taken apart. */
  setExplode(amount, { instant = false } = {}) {
    this.explodeTarget = amount;
    if (instant) this.explode = amount;
    this.requestRender();
  }

  // ---------- Camera ----------

  /** Pixels at the bottom covered by a panel (phones), so framing aims above it. */
  setInsetBottom(px) {
    this.insetBottom = Math.max(0, px || 0);
  }

  visibleFraction() {
    const h = Math.max(1, this.container.clientHeight);
    return Math.min(1, Math.max(0.35, (h - this.insetBottom) / h));
  }

  fitDistance(height, width = height) {
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const fitH = height / 2 / Math.tan(fov / 2) / this.visibleFraction();
    const fitW = width / 2 / Math.tan(fov / 2) / Math.max(0.2, this.camera.aspect);
    return Math.max(fitH, fitW) * 1.15;
  }

  /** Camera spot for looking at `center` from `dir` at distance d, nudged so it sits in the uncovered area. */
  aim(center, dir, d) {
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const shift = (1 - this.visibleFraction()) * d * Math.tan(fov / 2);
    const up = new THREE.Vector3(0, 1, 0).addScaledVector(dir, -dir.y);
    const target = center.clone();
    if (up.lengthSq() > 1e-4) target.addScaledVector(up.normalize(), -shift);
    return [target, target.clone().addScaledVector(dir, d)];
  }

  flyTo(target, position, { instant = false } = {}) {
    if (instant) {
      this.controls.target.copy(target);
      this.camera.position.copy(position);
      this.controls.update();
      this.requestRender();
      return;
    }
    this.flight = {
      start: performance.now(),
      fromT: this.controls.target.clone(),
      fromP: this.camera.position.clone(),
      toT: target.clone(),
      toP: position.clone(),
    };
    this.requestRender();
  }

  view(name, opts) {
    const c = new THREE.Vector3(...boxCenter(this.body));
    const d = this.fitDistance(this.body[1][1] - this.body[0][1], this.body[1][0] - this.body[0][0]);
    const dirs = {
      front: [0, 0.05, 1],
      back: [0, 0.05, -1],
      left: [-1, 0.05, 0], // the body's right side faces you
      right: [1, 0.05, 0],
      top: [0, 1, 0.001],
    };
    const dir = new THREE.Vector3(...(dirs[name] ?? dirs.front)).normalize();
    const [target, position] = this.aim(c, dir, d);
    this.flyTo(target, position, opts);
  }

  /** Look at a box (in body space), keeping the current viewing direction. */
  focusBox(box, opts) {
    const c = new THREE.Vector3(...boxCenter(box));
    // Follow the part to where it sits when taken apart.
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    const d = Math.max(0.12, this.fitDistance(boxSize(box)) * 1.25);
    const [target, position] = this.aim(c, dir, d);
    this.flyTo(target, position, opts);
  }

  focusParts(parts, opts) {
    if (!parts.length) return;
    const box = unionBox(parts.map(p => p.box));
    if (this.explode > 0.01) {
      const offs = parts.map(p => explodeOffset(p, this.body));
      const avg = [0, 1, 2].map(a => offs.reduce((s, o) => s + o[a], 0) / offs.length * this.explode);
      box[0] = box[0].map((v, a) => v + avg[a]);
      box[1] = box[1].map((v, a) => v + avg[a]);
    }
    this.focusBox(box, opts);
  }

  // ---------- Pointer and picking ----------

  bindPointer() {
    const el = this.renderer.domElement;
    let down = null;
    this.onPointerDown = e => {
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    this.onPointerUp = e => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const quick = performance.now() - down.t < 600;
      down = null;
      if (moved > 6 || !quick) return;
      const ref = this.pickAt(e.clientX, e.clientY);
      this.onSelect?.(ref);
    };
    this.onPointerMove = e => {
      if (e.pointerType !== "mouse" || e.buttons) return;
      this.hoverAt = { x: e.clientX, y: e.clientY };
      if (!this.hoverQueued) {
        this.hoverQueued = true;
        requestAnimationFrame(() => {
          this.hoverQueued = false;
          if (!this.hoverAt || this.disposed) return;
          const ref = this.pickAt(this.hoverAt.x, this.hoverAt.y);
          this.setHover(ref);
          this.onHover?.(ref, this.hoverAt.x, this.hoverAt.y);
        });
      }
    };
    this.onPointerLeave = () => {
      this.hoverAt = null;
      this.setHover(null);
      this.onHover?.(null);
    };
    el.addEventListener("pointerdown", this.onPointerDown);
    el.addEventListener("pointerup", this.onPointerUp);
    el.addEventListener("pointermove", this.onPointerMove);
    el.addEventListener("pointerleave", this.onPointerLeave);
  }

  /** The part under a screen point, or null. One pixel is drawn, with part numbers as colours. */
  pickAt(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = Math.round(clientX - rect.left);
    const y = Math.round(clientY - rect.top);
    if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return null;
    this.camera.setViewOffset(rect.width, rect.height, x, y, 1, 1);
    const r = this.renderer;
    const before = r.getRenderTarget();
    const clear = r.getClearAlpha();
    r.setRenderTarget(this.pickTarget);
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(this.pickScene, this.camera);
    r.readRenderTargetPixels(this.pickTarget, 0, 0, 1, 1, this.pickPixel);
    r.setRenderTarget(before);
    r.setClearColor(0x000000, clear);
    this.camera.clearViewOffset();
    const [layerNumber, lo, hi, a] = this.pickPixel;
    if (!a || !layerNumber) return null;
    const layer = [...this.layers.values()].find(l => l.number === layerNumber);
    return layer?.parts[lo + hi * 256] ?? null;
  }

  // ---------- Drawing ----------

  resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  requestRender() {
    if (this.queued || this.disposed) return;
    this.queued = true;
    requestAnimationFrame(this.frame);
  }

  frame(now) {
    this.queued = false;
    let again = false;

    if (this.flight) {
      const t = Math.min(1, (now - this.flight.start) / 650);
      const k = ease(t);
      this.controls.target.lerpVectors(this.flight.fromT, this.flight.toT, k);
      this.camera.position.lerpVectors(this.flight.fromP, this.flight.toP, k);
      if (t >= 1) this.flight = null;
      again = true;
    }

    if (Math.abs(this.explode - this.explodeTarget) > 0.0005) {
      this.explode += (this.explodeTarget - this.explode) * 0.18;
      again = true;
    } else {
      this.explode = this.explodeTarget;
    }
    for (const layer of this.layers.values()) if (layer.uniforms) layer.uniforms.explode.value = this.explode;

    if (this.controls.update()) again = true;
    this.renderer.render(this.scene, this.camera);
    if (again) this.requestRender();
  }

  /** Triangles currently loaded, for the footer. */
  stats() {
    let triangles = 0;
    for (const l of this.layers.values()) if (l.mesh) triangles += l.mesh.geometry.index.count / 3;
    return { triangles };
  }

  dispose() {
    this.disposed = true;
    this.resizeObserver.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener("pointerdown", this.onPointerDown);
    el.removeEventListener("pointerup", this.onPointerUp);
    el.removeEventListener("pointermove", this.onPointerMove);
    el.removeEventListener("pointerleave", this.onPointerLeave);
    this.controls.dispose();
    for (const l of this.layers.values()) {
      if (!l.mesh) continue;
      l.mesh.geometry.dispose();
      for (const m of [l.mesh, l.ghost, l.pick]) m.material.dispose();
      l.colorTex.dispose();
      l.fxTex.dispose();
    }
    this.pickTarget.dispose();
    this.renderer.dispose();
    el.remove();
  }
}
