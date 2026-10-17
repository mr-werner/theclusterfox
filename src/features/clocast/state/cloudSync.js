import { createCloudSync } from "../../../lib/cloudSync";

// Row-level security on clocast_user_data (db/migrations/002_clocast_user_data.sql)
// limits every request to the signed-in user's own row.
export { SyncUnavailableError } from "../../../lib/cloudSync";
export const { fetchRemoteData, pushRemoteData } = createCloudSync("clocast_user_data");
