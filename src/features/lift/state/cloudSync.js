import { createCloudSync } from "../../../lib/cloudSync";

// Row-level security on lift_user_data (db/migrations/004_lift_user_data.sql)
// limits every request to the signed-in user's own row.
export { SyncUnavailableError } from "../../../lib/cloudSync";
export const { fetchRemoteData, pushRemoteData } = createCloudSync("lift_user_data");
