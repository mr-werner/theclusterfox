import { createCloudSync } from "../../../lib/cloudSync";

// Row-level security on plan_user_data (db/migrations/003_plan_user_data.sql)
// limits every request to the signed-in user's own row.
export { SyncUnavailableError } from "../../../lib/cloudSync";
export const { fetchRemoteData, pushRemoteData } = createCloudSync("plan_user_data");
