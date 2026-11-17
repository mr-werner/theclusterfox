// The muscle material shared by the push-up demo and the muscle picker:
// each vertex carries a slot number, and a uniform array says how red each
// slot is right now.

import * as THREE from "three";

export const MAX_SLOTS = 24;

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

export function muscleMaterial(uniforms) {
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
export function shade(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return 0.92 + ((h >>> 0) % 1000) / 1000 * 0.16;
}
