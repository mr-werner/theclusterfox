import { Link, useLocation } from "react-router-dom";

export default function SiteFooter() {
    const { pathname, search } = useLocation();
    const from = encodeURIComponent(pathname + search);
    return (
        <footer className="site-footer">
            <Link className="footer-link" to={`/feedback?from=${from}`}>
                Send feedback
            </Link>
            <span className="footer-dot">•</span>
            <Link className="footer-link footer-link--donate" to="/donate">
                Donate
            </Link>
            <span className="footer-dot">•</span>
            <span>The Cluster Fox</span>
            <span className="footer-dot">•</span>
            <span>Build. Learn. Tinker.</span>
            <span className="footer-dot">•</span>
            <a
                className="footer-credit"
                href="https://www.blueprintwebstudio.com/"
                target="_blank"
                rel="noreferrer"
            >
                <img
                    src="/blueprint-webstudio-logo.png"
                    alt=""
                    width="15"
                    height="20"
                />
                <span>Built by Blueprint WebStudio</span>
            </a>
        </footer>
    );
}
