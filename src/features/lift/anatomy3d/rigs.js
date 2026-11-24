// The 3D rigs, by name. Each one takes a movement's rigOptions and returns
// { pose(depth), ... } for skin() to move BodyFox's anatomy with.
// A movement whose rig isn't listed here shows the 2D view only.

import { makePushup } from "./pushupRig";

export const RIGS_3D = {
  pushup: options => makePushup({ chestGap: 0.08, ...options }),
};
