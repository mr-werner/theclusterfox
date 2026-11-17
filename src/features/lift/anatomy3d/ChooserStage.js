// The muscle picker: BodyFox's muscle model shown front and back, side by
// side. Tap a muscle to pick its LiftFox group; picked groups glow red.
// It only draws when something changes, so a still picker costs nothing.

import * as THREE from "three";

import { fetchLayer } from "../../body/viewer/loadLayer";
import { liftGroupFor } from "../../body/model/liftLink";
import { MAX_SLOTS, muscleMaterial, shade } from "./material";

const GAP = 0.78; // metres between the two bodies

export default class ChooserStage {
  /**
   * @param {HTMLElement} container
   * @param {object} o
   * @param {string[]} o.groups LiftFox group ids, in slot order
   * @param {(group: string) => void} o.onPick
   * @param {(group: string|null) => void} o.onHover
   */
  constructor(container, { groups, lite = false, baseUrl = "/anatomy", onPick, onHover, onStatus }) {
    this.container = container;
    this.groups = groups;
    this.baseUrl = baseUrl;
    this.onPick = onPick;
    this.onHover = onHover;
    this.onStatus = onStatus;
    this.selected = new Set();
    this.hovered = null;
    this.abort = new AbortController();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.camera.position.set(0, 0.84, 4);
    this.camera.lookAt(0, 0.84, 0);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x301010, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 1.3);
    key.position.set(1, 2, 4);
    this.scene.add(key);
    const back = new THREE.DirectionalLight(0xffffff, 0.9);
    back.position.set(-1, 1.5, -4);
    this.scene.add(back);
    const rim = new THREE.DirectionalLight(0xff3020, 0.9);
    rim.position.set(-3, 1, 1);
    this.scene.add(rim);

    this.uniforms = { efforts: { value: new Float32Array(MAX_SLOTS) } };
    this.material = muscleMaterial(this.uniforms);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this.render = this.render.bind(this);
    this.resize = this.resize.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onLeave = this.onLeave.bind(this);
    this.onDown = this.onDown.bind(this);
    this.onUp = this.onUp.bind(this);
    const el = renderer.domElement;
    el.addEventListener("pointermove", this.onMove);
    el.addEventListener("pointerleave", this.onLeave);
    el.addEventListener("pointerdown", this.onDown);
    el.addEventListener("pointerup", this.onUp);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(container);
    this.resize();
    this.load(lite);
  }

  async load(lite) {
    this.onStatus?.("loading");
    try {
      const { signal } = this.abort;
      const [index, layer] = await Promise.all([
        fetch(`${this.baseUrl}/index.json`, { signal }).then(r => {
          if (!r.ok) throw new Error(`index.json ${r.status}`);
          return r.json();
        }),
        fetchLayer(`${this.baseUrl}/muscles${lite ? "-lite" : ""}.bin`, { signal }),
      ]);
      if (this.disposed) return;
      this.build(layer, index.parts.filter(p => p.layer === "muscles"));
      this.onStatus?.("ready");
    } catch (err) {
      if (err.name === "AbortError" || this.disposed) return;
      console.error(err);
      this.onStatus?.("error");
    }
  }

  build({ positions, partIndex, index }, parts) {
    const n = positions.length / 3;
    const slotOf = new Map(this.groups.map((g, i) => [g, i + 1]));
    this.partGroup = parts.map(p => liftGroupFor(p));
    const slot = new Float32Array(n);
    const color = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) {
      const part = parts[partIndex[v]];
      const group = this.partGroup[partIndex[v]];
      slot[v] = group ? slotOf.get(group) ?? 0 : 0;
      const name = part?.name.toLowerCase() ?? "";
      const tendon = /tendon|aponeurosis|fascia|iliotibial|linea alba|raphe|retinaculum/.test(name);
      const k = part ? shade(part.id) : 1;
      const tone = tendon ? [0.9, 0.87, 0.82] : group ? [0.8 * k, 0.775 * k, 0.76 * k] : [0.62 * k, 0.6 * k, 0.6 * k];
      color.set(tone, v * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(color, 3));
    geo.setAttribute("slot", new THREE.BufferAttribute(slot, 1));
    geo.setAttribute("partIndex", new THREE.BufferAttribute(partIndex, 1));
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    this.geometry = geo;

    const front = new THREE.Mesh(geo, this.material);
    front.position.x = -GAP / 2;
    const back = new THREE.Mesh(geo, this.material);
    back.rotation.y = Math.PI;
    back.position.x = GAP / 2;
    this.meshes = [front, back];
    this.scene.add(front, back);
    this.paint();
  }

  setSelected(list) {
    this.selected = new Set(list);
    this.paint();
  }

  setHovered(group) {
    if (group === this.hovered) return;
    this.hovered = group;
    this.paint();
  }

  paint() {
    const arr = this.uniforms.efforts.value;
    this.groups.forEach((g, i) => {
      arr[i] = this.selected.has(g) ? (g === this.hovered ? 0.95 : 0.8) : g === this.hovered ? 0.4 : 0;
    });
    this.requestRender();
  }

  groupAt(event) {
    if (!this.meshes) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.meshes, false)[0];
    if (!hit) return null;
    const part = this.geometry.getAttribute("partIndex").getX(hit.face.a);
    return this.partGroup[part] ?? null;
  }

  onMove(event) {
    if (event.pointerType !== "mouse") return;
    // Ray tests are cheap but not free; one per frame is plenty.
    if (this.moveQueued) return;
    this.moveQueued = true;
    requestAnimationFrame(() => {
      this.moveQueued = false;
      if (this.disposed) return;
      const g = this.groupAt(event);
      this.renderer.domElement.style.cursor = g ? "pointer" : "default";
      this.setHovered(g);
      this.onHover?.(g);
    });
  }

  onLeave() {
    this.setHovered(null);
    this.onHover?.(null);
  }

  onDown(event) {
    this.down = [event.clientX, event.clientY];
  }

  onUp(event) {
    if (!this.down) return;
    const moved = Math.hypot(event.clientX - this.down[0], event.clientY - this.down[1]);
    this.down = null;
    if (moved > 8) return;
    const g = this.groupAt(event);
    if (g) this.onPick?.(g);
  }

  requestRender() {
    if (this.frame == null && !this.disposed) this.frame = requestAnimationFrame(this.render);
  }

  render() {
    this.frame = null;
    if (this.disposed) return;
    this.renderer.render(this.scene, this.camera);
  }

  resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    // Fit both bodies (about 1.5 m wide, 1.75 m tall) with a little margin.
    const halfH = Math.max(0.95, (1.5 / 2) * (h / w) * 1.05);
    const halfW = halfH * (w / h);
    Object.assign(this.camera, { left: -halfW, right: halfW, top: halfH, bottom: -halfH });
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  dispose() {
    this.disposed = true;
    this.abort.abort();
    if (this.frame != null) cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener("pointermove", this.onMove);
    el.removeEventListener("pointerleave", this.onLeave);
    el.removeEventListener("pointerdown", this.onDown);
    el.removeEventListener("pointerup", this.onUp);
    this.geometry?.dispose();
    this.material.dispose();
    this.renderer.dispose();
    el.remove();
  }
}
