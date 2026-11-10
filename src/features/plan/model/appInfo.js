import { apps } from "../../../app/apps";

export const appById = id => apps.find(a => a.id === id) ?? null;
export const appName = id => appById(id)?.subtitle ?? "App";
