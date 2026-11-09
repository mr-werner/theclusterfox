import { useEffect, useState } from "react";
import { useAccountSync } from "../../../lib/useAccountSync";
import { emptyData, loadData, normalizeData, saveData } from "./sportsStore";

export function useSportsData() {
  const [data, setData] = useState(loadData);

  useEffect(() => {
    saveData(data);
  }, [data]);

  const update = change => setData(current => (typeof change === "function" ? change(current) : { ...current, ...change }));

  const syncStatus = useAccountSync("sports_user_data", data, doc => setData(normalizeData(doc)), emptyData());

  return { data, update, syncStatus };
}
