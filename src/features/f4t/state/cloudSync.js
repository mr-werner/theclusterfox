import { createCloudSync } from "../../../lib/cloudSync";

// Row-level security on f4t_user_data (db/migrations/001_f4t_user_data.sql)
// limits every request to the signed-in user's own row.
export { SyncUnavailableError } from "../../../lib/cloudSync";
export const { fetchRemoteData, pushRemoteData } = createCloudSync("f4t_user_data");
