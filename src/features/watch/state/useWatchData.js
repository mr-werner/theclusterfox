import { useEffect, useState } from "react";
import { loadData, saveData } from "./watchStore";

export function useWatchData() {
  const [data, setData] = useState(loadData);

  useEffect(() => {
    saveData(data);
  }, [data]);

  const update = change => setData(current => (typeof change === "function" ? change(current) : { ...current, ...change }));

  return { data, update };
}
