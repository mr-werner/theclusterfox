// How an app opens from the hub. On a computer each app gets its own
// window, as if it were a separate program. On phones and tablets, and
// inside an installed app, it opens in place with a short launch animation.

const WINDOW = { width: 1240, height: 840 };

export function opensInOwnWindow() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  const installed = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const computer = window.matchMedia("(pointer: fine) and (hover: hover) and (min-width: 900px)").matches;
  return computer && !installed;
}

/**
 * Try to open the app in its own window. Returns true when it did, so the
 * caller can skip in-place navigation. A blocked pop-up returns false and
 * the link simply opens in this window instead.
 */
export function openAppWindow(app) {
  const width = Math.min(WINDOW.width, window.screen.availWidth - 40);
  const height = Math.min(WINDOW.height, window.screen.availHeight - 60);
  const left = Math.max(0, Math.round((window.screen.availWidth - width) / 2));
  const top = Math.max(0, Math.round((window.screen.availHeight - height) / 2));
  // One window per app: tapping it again brings that window forward.
  const win = window.open(app.path, `clusterfox-${app.id}`, `popup=yes,width=${width},height=${height},left=${left},top=${top}`);
  if (!win) return false;
  win.focus();
  return true;
}

/** True when the click asked for the browser's own handling (new tab, etc). */
export const isModifiedClick = event => event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

/**
 * Open a page inside one of the apps, like "/lift?plan=abc&session=w1d1".
 * On a computer it goes to that app's own window (reusing it when it is
 * already open); elsewhere it opens in place.
 */
export function openInApp(appId, href, navigate) {
  if (opensInOwnWindow() && openAppWindow({ id: appId, path: href })) return;
  navigate(href);
}
