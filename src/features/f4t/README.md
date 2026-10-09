# F4T — audited explicit activity groups

## Install

Replace:
- `src/features/f4t/data/activityGroups.js`
- `src/features/f4t/components/ExerciseResults.jsx`

Add:
- `src/features/f4t/data/activityGroupManifest.json`

Keep existing `src/features/f4t/data/activities.js`, `compendiumActivities.json`, and `src/domain/exercise/energy.js` if they match the previous F4T unit-safe release. They are included under `data/` for convenience.

The new grouping engine uses a reviewed manifest, not fuzzy grouping. It validates unique codes, categories, and distinct adjustment values. Other records remain standalone.

## Verify

Run `node tests/validate.mjs` from this extracted folder; then run `npm run build` inside your actual Vite project. The complete application was not provided, so a full project build could not be performed here.

## Notes

- Source contains 1,111 extracted records; earlier discrepancy with original PDF (~1,114) has not been reconciled.
- 61 explicitly audited groups cover 214 records; 897 entries remain standalone, including unresolved candidates.
- Existing browser selections are stored under a new versioned key, so older group IDs do not mis-select records.
- Keep all 22 categories and original MET values.
- Some selected source descriptions mix effort and speed, but the *adjustment* within each group changes only the designated measurement. Conditions are fixed as far as source descriptions allow.
- Source entries that vary multiple dimensions or have contradictory descriptions are deliberately excluded pending review.
