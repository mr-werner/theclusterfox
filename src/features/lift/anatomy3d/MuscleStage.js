// The 3D push-up: BodyFox's anatomy, posed by pushupRig, with each muscle
// turning red as it works. Plain three.js, kept out of React.
//
// The muscle model is shared with BodyFox (public/anatomy), so there is
// nothing new to download once someone has opened either app.

import * as THREE from "three";
import { TrackballControls } from "three/addons/controls/TrackballControls.js";

import { fetchLayer } from "../../body/viewer/loadLayer";
import { bindVertices, skin } from "./pushupRig";
import { RIGS_3D } from "./rigs";
import { efforts, muscleForPart, repFor } from "../data/activation";
import { MAX_SLOTS, muscleMaterial, shade } from "./material";

// Where the camera starts, from the body's centre: front-left and a little above.
const START_VIEW = new THREE.Vector3(1.8, 0.44, 0.68);

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
    this.rig = RIGS_3D[movement.rig](movement.rigOptions);
    const focus = new THREE.Vector3(...(this.rig.focus?.toArray?.() ?? [0, 0.28, 0.82]));
    const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 20);
    camera.position.copy(START_VIEW).add(focus);
    this.camera = camera;

    scene.add(new THREE.HemisphereLight(0xfff4ee, 0x2a0d0a, 1.25));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(2, 3, 2.5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xff3b2a, 1.6);
    rim.position.set(-2.5, 1.2, -1.5);
    scene.add(rim);
    // A soft light from below, so the body isn't a silhouette when you turn it over.
    const under = new THREE.DirectionalLight(0xffffff, 0.7);
    under.position.set(0.5, -3, 1);
    scene.add(under);

    // Floor: a soft red pool of light under the body.
    const floorTex = this.floorTexture();
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(1.25, 64),
      new THREE.MeshBasicMaterial({ map: floorTex, transparent: true, depthWrite: false }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.001, focus.z - 0.22);
    scene.add(floor);

    // Benches and steps the movement uses: plain dark blocks.
    this.props = (this.rig.props ?? []).map(p => {
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(...p.size),
        new THREE.MeshStandardMaterial({ color: 0x2b2524, roughness: 0.85, metalness: 0 }),
      );
      box.position.set(...p.center);
      scene.add(box);
      return box;
    });

    // Trackball, not orbit: you can turn the body any way at all, over the
    // top and underneath as well as round the sides. "Reset view" puts it
    // back upright.
    const controls = new TrackballControls(camera, renderer.domElement);
    controls.target.copy(focus);
    controls.rotateSpeed = 3;
    controls.zoomSpeed = 1;
    controls.noPan = true;
    controls.dynamicDampingFactor = 0.15;
    controls.minDistance = 1.2;
    controls.maxDistance = 4.2;
    controls.keys = []; // no A/S/D shortcuts: they'd fire while typing elsewhere
    // Trackball only moves the camera inside update(), so keep drawing while
    // a finger or mouse is down. "change" keeps it going while it glides.
    controls.addEventListener("change", () => this.requestRender());
    controls.addEventListener("start", () => {
      this.userMoved = true;
      this.dragging = true;
      this.requestRender();
    });
    controls.addEventListener("end", () => {
      this.dragging = false;
      this.requestRender();
    });
    this.controls = controls;

    this.uniforms = { efforts: { value: new Float32Array(MAX_SLOTS) } };
    this.material = muscleMaterial(this.uniforms);

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
      : repFor(this.movement, this.clock);
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
    // A hold is posed once, when it loads; nothing moves after that.
    const moving = this.playing && this.visible && this.layers && this.movement.hold == null;
    if (moving) {
      if (this.last != null) this.clock += (now - this.last) * this.speed;
      this.last = now;
      this.applyFrame();
    } else {
      this.last = null;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (moving || this.dragging) this.requestRender();
  }

  resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = 30;
    // Step back on narrower screens so the whole body (about 1.8 m long) fits,
    // until someone moves the camera themselves.
    if (!this.userMoved) this.placeCamera(this.camera.position.clone().sub(this.controls.target));
    this.camera.updateProjectionMatrix();
    this.controls.handleResize();
    this.requestRender();
  }

  placeCamera(direction) {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    // A taller pose (hands on a bench, hips up) needs a little more room.
    const tall = Math.max(1, 0.6 + 0.6 * (this.rig.height ?? 0.64));
    const dist = 2.45 * tall * Math.max(1, 1.75 / (w / h));
    this.camera.position.copy(this.controls.target).add(direction.normalize().multiplyScalar(Math.min(dist, 4.1)));
  }

  /** Back to the starting view: upright, from the front and a little above. */
  resetView() {
    this.userMoved = false;
    this.camera.up.set(0, 1, 0);
    this.placeCamera(START_VIEW.clone());
    this.camera.lookAt(this.controls.target);
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
    this.props.forEach(b => {
      b.geometry.dispose();
      b.material.dispose();
    });
    this.material.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
