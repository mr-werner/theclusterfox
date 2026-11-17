// The 3D push-up: BodyFox's anatomy, posed by pushupRig, with each muscle
// turning red as it works. Plain three.js, kept out of React.
//
// The muscle model is shared with BodyFox (public/anatomy), so there is
// nothing new to download once someone has opened either app.

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { fetchLayer } from "../../body/viewer/loadLayer";
import { bindVertices, makePushup, skin } from "./pushupRig";
import { efforts, muscleForPart, repAt } from "../data/activation";

const MAX_SLOTS = 24;

// Shader colour ramp, same stops as effortRgb in data/activation.js.
const RAMP = /* glsl */ `
vec3 effortRamp(float v) {
  vec3 c0 = vec3(0.78, 0.76, 0.75);
  vec3 c1 = vec3(0.86, 0.6, 0.55);
  vec3 c2 = vec3(0.93, 0.3, 0.2);
  vec3 c3 = vec3(0.86, 0.07, 0.06);
  vec3 c4 = vec3(0.6, 0.0, 0.04);
  if (v < 0.15) return c0;
  if (v < 0.3) return mix(c0, c1, (v - 0.15) / 0.15);
  if (v < 0.5) return mix(c1, c2, (v - 0.3) / 0.2);
  if (v < 0.75) return mix(c2, c3, (v - 0.5) / 0.25);
  return mix(c3, c4, (v - 0.75) / 0.25);
}`;

function muscleMaterial(uniforms) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, side: THREE.DoubleSide });
  mat.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\nattribute float slot;\nuniform float efforts[${MAX_SLOTS}];\nvarying float vEffort;`)
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nint s = int(slot + 0.5);\nvEffort = s > 0 ? efforts[s - 1] : -1.0;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying float vEffort;\n${RAMP}`)
      .replace(
        "#include <color_fragment>",
        "#include <color_fragment>\nif (vEffort >= 0.0) diffuseColor.rgb = pow(effortRamp(vEffort), vec3(2.2)) * (vColor.r / 0.8);",
      )
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\nif (vEffort > 0.3) totalEmissiveRadiance += vec3(0.5, 0.02, 0.0) * (vEffort - 0.3) * 0.35;",
      );
  };
  mat.customProgramCacheKey = () => "lift-muscle";
  return mat;
}

// A steady tiny brightness change per part so neighbouring muscles read apart.
function shade(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return 0.92 + ((h >>> 0) % 1000) / 1000 * 0.16;
}

export default class MuscleStage {
  constructor(container, { movement, lite = false, baseUrl = "/anatomy", onFrame, onStatus }) {
    this.container = container;
    this.movement = movement;
    this.lite = lite;
    this.baseUrl = baseUrl;
    this.onFrame = onFrame;
    this.onStatus = onStatus;
    this.playing = true;
    this.speed = 1;
    this.clock = 0;
    this.last = null;
    this.frame = null;
    this.visible = true;
    this.manualDepth = null;
    this.abort = new AbortController();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lite ? 1.75 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    this.scene = scene;
    const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
    camera.position.set(2.35, 0.95, 1.85);
    this.camera = camera;

    scene.add(new THREE.HemisphereLight(0xfff4ee, 0x2a0d0a, 1.25));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(2, 3, 2.5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xff3b2a, 1.6);
    rim.position.set(-2.5, 1.2, -1.5);
    scene.add(rim);

    // Floor: a soft red pool of light under the body.
    const floorTex = this.floorTexture();
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.25, 64),
      new THREE.MeshBasicMaterial({ map: floorTex, transparent: true, depthWrite: false }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.001, 0.6);
    scene.add(floor);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.28, 0.82);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 1.2;
    controls.maxDistance = 4.2;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.addEventListener("change", () => this.requestRender());
    this.controls = controls;

    this.uniforms = { efforts: { value: new Float32Array(MAX_SLOTS) } };
    this.material = muscleMaterial(this.uniforms);
    this.rig = makePushup({ chestGap: 0.08 });

    this.resize = this.resize.bind(this);
    this.tick = this.tick.bind(this);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(container);
    this.io = new IntersectionObserver(entries => {
      this.visible = entries.some(e => e.isIntersecting);
      if (this.visible) this.requestRender();
    });
    this.io.observe(container);
    this.resize();
    this.load();
  }

  floorTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(128, 128, 4, 128, 128, 128);
    grad.addColorStop(0, "rgba(255,40,30,0.32)");
    grad.addColorStop(0.55, "rgba(140,10,10,0.14)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = "rgba(255,255,255,0.05)";
    for (let i = 0; i <= 256; i += 16) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, 256);
      g.moveTo(0, i);
      g.lineTo(256, i);
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  async load() {
    this.onStatus?.("loading");
    try {
      const { signal } = this.abort;
      const suffix = this.lite ? "-lite" : "";
      const [index, muscles, skeleton] = await Promise.all([
        fetch(`${this.baseUrl}/index.json`, { signal }).then(r => {
          if (!r.ok) throw new Error(`index.json ${r.status}`);
          return r.json();
        }),
        fetchLayer(`${this.baseUrl}/muscles${suffix}.bin`, { signal }),
        fetchLayer(`${this.baseUrl}/skeleton-lite.bin`, { signal }),
      ]);
      if (this.disposed) return;
      const partsOf = layer => index.parts.filter(p => p.layer === layer);
      this.layers = [this.build(muscles, partsOf("muscles"), true), this.build(skeleton, partsOf("skeleton"), false)];
      this.applyFrame();
      this.onStatus?.("ready");
      this.requestRender();
    } catch (err) {
      if (err.name === "AbortError" || this.disposed) return;
      console.error(err);
      this.onStatus?.("error");
    }
  }

  // One layer (muscles or bones) as a mesh that can be posed every frame.
  build(layer, parts, isMuscle) {
    const { positions, partIndex, index } = layer;
    const n = positions.length / 3;
    const slotOfMuscle = new Map(this.movement.muscles.map((m, i) => [m.id, i + 1]));
    const partSlot = parts.map(p => (isMuscle ? slotOfMuscle.get(muscleForPart(this.movement, p.name)?.id) ?? 0 : 0));
    const partTone = parts.map(p => {
      const name = p.name.toLowerCase();
      if (!isMuscle) return /cartilage|disk|meniscus/.test(name) ? [0.5, 0.52, 0.55] : [0.6, 0.56, 0.5];
      const tendon = /tendon|aponeurosis|fascia|iliotibial|linea alba|raphe|retinaculum/.test(name);
      const k = shade(p.id);
      return tendon ? [0.93, 0.9, 0.85] : [0.8 * k, 0.775 * k, 0.76 * k];
    });

    const slot = new Float32Array(n);
    const color = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) {
      const part = partIndex[v];
      slot[v] = partSlot[part] ?? 0;
      const tone = partTone[part] ?? [0.8, 0.78, 0.76];
      color[v * 3] = tone[0];
      color[v * 3 + 1] = tone[1];
      color[v * 3 + 2] = tone[2];
    }

    const restGeo = new THREE.BufferGeometry();
    restGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    restGeo.setIndex(new THREE.BufferAttribute(index, 1));
    restGeo.computeVertexNormals();
    const restNormals = restGeo.getAttribute("normal").array;
    restGeo.dispose();

    const geo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage);
    const normAttr = new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("position", posAttr);
    geo.setAttribute("normal", normAttr);
    geo.setAttribute("color", new THREE.BufferAttribute(color, 3));
    geo.setAttribute("slot", new THREE.BufferAttribute(slot, 1));
    geo.setIndex(new THREE.BufferAttribute(index, 1));

    const mesh = new THREE.Mesh(geo, this.material);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    return { rest: positions, restNormals, binding: bindVertices(positions, partIndex, parts), posAttr, normAttr, geo };
  }

  /** Pose and colour the body for the current moment of the rep. */
  applyFrame() {
    if (!this.layers) return;
    const rep = this.manualDepth != null
      ? { depth: this.manualDepth, pressing: false, label: "Paused" }
      : repAt(this.clock, this.movement.cycleMs);
    const posed = this.rig.pose(rep.depth);
    for (const l of this.layers) {
      skin(l.rest, l.restNormals, l.binding, posed, l.posAttr.array, l.normAttr.array);
      l.posAttr.needsUpdate = true;
      l.normAttr.needsUpdate = true;
    }
    const e = efforts(this.movement, rep);
    const arr = this.uniforms.efforts.value;
    this.movement.muscles.forEach((m, i) => {
      arr[i] = e[m.id];
    });
    this.onFrame?.(rep, e);
  }

  setPlaying(playing) {
    this.playing = playing;
    this.last = null;
    this.requestRender();
  }

  setSpeed(speed) {
    this.speed = speed;
  }

  /** Jump to a point in the rep (0 to 1 of the cycle) and hold there. */
  seek(fraction) {
    this.clock = fraction * this.movement.cycleMs;
    this.applyFrame();
    this.requestRender();
  }

  requestRender() {
    if (this.frame == null && !this.disposed) this.frame = requestAnimationFrame(this.tick);
  }

  tick(now) {
    this.frame = null;
    if (this.disposed) return;
    const moving = this.playing && this.visible && this.layers;
    if (moving) {
      if (this.last != null) this.clock += (now - this.last) * this.speed;
      this.last = now;
      this.applyFrame();
    } else {
      this.last = null;
    }
    const damping = this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (moving || damping) this.requestRender();
  }

  resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Keep the whole body in view on narrow screens.
    this.camera.fov = w / h < 1 ? 30 / Math.max(0.62, w / h) : 30;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  dispose() {
    this.disposed = true;
    this.abort.abort();
    if (this.frame != null) cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.io.disconnect();
    this.controls.dispose();
    this.layers?.forEach(l => l.geo.dispose());
    this.material.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
