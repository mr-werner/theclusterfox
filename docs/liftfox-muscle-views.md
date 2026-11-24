# LiftFox muscle views: five exercises a day

LiftFox's push-up has a "muscle view": a 2D drawing and a 3D body (BodyFox's
anatomy) where every working muscle turns from grey to deep red as it works.
The rest of the library gets the same view **five exercises a day**, so each
day's change stays small enough to build, check and review in one go.

A daily scheduled Claude session does the work. This file is its checklist.

## Where things live

| What | File |
| --- | --- |
| The order, five a day, grouped by how they move | `src/features/lift/data/muscleViewQueue.js` |
| Muscle data per movement (muscles, peak effort, rig) | `src/features/lift/data/activation.js` (`MOVEMENTS`, `BY_EXERCISE`) |
| 3D rigs by name | `src/features/lift/anatomy3d/rigs.js` (push-up rig: `pushupRig.js`) |
| 2D drawings by rig | `VIEWS_2D` and `HAS_3D` in `src/features/lift/components/MotionDemo.jsx` (push-up: `model/pushup2d.js`, `PushupDemo2D.jsx`) |
| Tests | `src/features/lift/tests/muscles.mjs` |

## One day's run

1. Start from the latest `main`. If an earlier "LiftFox muscle views" pull
   request is still open, stop: don't stack a second day on unreviewed work.
2. Take `nextBatch(Object.keys(BY_EXERCISE))` from `muscleViewQueue.js`.
   Its `note` says what the batch needs (a new rig, or options on an old one).
3. For each exercise (at most five):
   - Add a `MOVEMENTS` entry: `name`, `rig`, optional `rigOptions`,
     `cycleMs`, and `muscles` with `group` (a LiftFox muscle id), `role`
     (`mover` or `brace`), `peak` (0–1, rounded from published surface EMG
     where it exists; otherwise a conservative estimate, said so in a
     comment) and `match` (a regex that finds the parts in
     `public/anatomy/index.json`).
   - Map it in `BY_EXERCISE`.
   - If the rig is new, add the 2D drawing to `VIEWS_2D` first. Add the 3D
     rig to `RIGS_3D` and `HAS_3D` only once it looks right; until then the
     exercise shows the 2D view only, which is fine to ship.
4. Run `node src/features/lift/tests/muscles.mjs`,
   `node src/features/lift/tests/validate.mjs`, `npx eslint src/features/lift`
   and `npm run build`.
5. Screenshot each new exercise in 2D and 3D (phone and computer width) and
   look at them: limbs in the right place, no torn or stretched mesh, the
   right muscles going red.
6. Open one pull request titled "LiftFox muscle views: <batch note's first
   words>" listing the five exercises, with the screenshots described.

If a batch's new rig is too big for one day, ship the 2D views for all five
and the 3D for as many as look right; the next day finishes the rest before
moving on (the queue picks up any exercise still missing).
