export default function SiteFooter() {
    return (
        <footer className="site-footer">
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
