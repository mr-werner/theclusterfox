// The 3D rigs, by name. Each one takes a movement's rigOptions and returns
// { pose(depth, rep), bind, skin, ... }: bind ties each vertex to the
// skeleton once, and skin moves BodyFox's anatomy into each pose.
// A movement whose rig isn't listed here shows the 2D view only.

import { bindVertices, makePushup, skin } from "./pushupRig";
import { makeBody } from "./bodyRig";

export const RIGS_3D = {
  pushup: options => ({ bind: bindVertices, skin, ...makePushup({ chestGap: 0.08, ...options }) }),
  // Standing and lying moves (squats, hinges, bridges): options.pose names the pose.
  body: options => makeBody(options),
};
