import { useCallback, useEffect, useState } from "react";

import { apps } from "../../app/apps";
import AddAppSheet from "./components/AddAppSheet";
import DesktopHome from "./components/DesktopHome";
import PhoneHome from "./components/PhoneHome";
import Splash from "./components/Splash";
import { isOriginalKey } from "./state/homeStore";
import { useAlternatives } from "./state/useAlternatives";
import { useHomeLayout } from "./state/useHomeLayout";
import "./home.css";

const PHONE_QUERY = "(max-width: 700px)";
const SPLASH_KEY = "clusterfox:splash-seen";
const originalsById = new Map(apps.map(app => [app.id, app]));

function useIsPhone() {
  const [isPhone, setIsPhone] = useState(() => window.matchMedia(PHONE_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(PHONE_QUERY);
    const onChange = () => setIsPhone(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return isPhone;
}

function splashSeen() {
  try {
    return sessionStorage.getItem(SPLASH_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * The home screen. On a computer it is a page: the welcome at the top, then
 * search and your apps as you scroll. On a phone it opens with a short
 * splash, then becomes an app grid like a phone's own home screen.
 */
export default function HomePage() {
  const isPhone = useIsPhone();
  const home = useHomeLayout();
  const [sheet, setSheet] = useState(null); // null | { focus: boolean }
  const [wantAlts, setWantAlts] = useState(false);
  const [showSplash, setShowSplash] = useState(() => isPhone && !splashSeen());

  const hasPinnedAlts = home.keys.some(key => !isOriginalKey(key));
  const alts = useAlternatives(wantAlts || hasPinnedAlts || Boolean(sheet));

  const onWantAlts = useCallback(() => setWantAlts(true), []);
  const openAdd = useCallback(() => setSheet({ focus: false }), []);
  const openSearch = useCallback(() => setSheet({ focus: true }), []);
  const closeSheet = useCallback(() => setSheet(null), []);
  const endSplash = useCallback(() => {
    setShowSplash(false);
    try {
      sessionStorage.setItem(SPLASH_KEY, "1");
    } catch {
      // Ignore.
    }
  }, []);

  return (
    <>
      {isPhone ? (
        <PhoneHome home={home} alts={alts} originalsById={originalsById} onAdd={openAdd} onSearch={openSearch} />
      ) : (
        <DesktopHome home={home} alts={alts} originalsById={originalsById} onWantAlts={onWantAlts} onAdd={openAdd} />
      )}

      {sheet && <AddAppSheet open onClose={closeSheet} home={home} alts={alts} autoFocus={sheet.focus} />}

      {isPhone && showSplash && <Splash onDone={endSplash} />}
    </>
  );
}
