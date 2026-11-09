import { Link } from "react-router-dom";

import { isModifiedClick, openAppWindow, opensInOwnWindow } from "../../../lib/launchApp";

// Opens a ClusterFox original the way the hub launches apps: its own window
// on a computer, in place with a launch animation on phones and tablets.
export default function AppLink({ app, onClick, ...props }) {
  function launch(event) {
    onClick?.(event);
    if (event.defaultPrevented || isModifiedClick(event) || !opensInOwnWindow()) return;
    if (openAppWindow(app)) event.preventDefault();
  }

  return <Link to={app.path} onClick={launch} viewTransition {...props} />;
}
