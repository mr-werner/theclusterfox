import { createCloudSync } from "../../../lib/cloudSync";

// Row-level security on home_user_data (db/migrations/005_home_user_data.sql)
// keeps each person to their own row.
export { SyncUnavailableError } from "../../../lib/cloudSync";
export const { fetchRemoteData, pushRemoteData } = createCloudSync("home_user_data");
