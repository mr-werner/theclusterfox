import { Cloud, CloudFog, CloudLightning, CloudMoon, CloudRain, CloudSnow, CloudSun, Moon, Sun } from "lucide-react";

// Picks an icon for a WMO weather code.
export default function WeatherIcon({ code, isDay = true, size = 20, className }) {
  const props = { size, className, "aria-hidden": true };
  if (code >= 95) return <CloudLightning {...props} />;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return <CloudSnow {...props} />;
  if (code >= 51) return <CloudRain {...props} />;
  if (code >= 45) return <CloudFog {...props} />;
  if (code === 3) return <Cloud {...props} />;
  if (code >= 1) return isDay ? <CloudSun {...props} /> : <CloudMoon {...props} />;
  return isDay ? <Sun {...props} /> : <Moon {...props} />;
}
