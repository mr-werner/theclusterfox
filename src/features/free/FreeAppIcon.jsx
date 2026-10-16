// Brand mark from Simple Icons when available, otherwise a lettered badge.

function relativeLuminance(hex) {
    const [r, g, b] = [0, 2, 4].map((offset) => {
        const channel =
            parseInt(hex.slice(offset, offset + 2), 16) / 255;

        return channel <= 0.03928
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4;
    });

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export default function FreeAppIcon({ app }) {
    const hex = (app.logo?.hex || app.color || "#2a2f2b")
        .replace("#", "")
        .toUpperCase();

    const luminance = relativeLuminance(hex);

    // Near-black brand colors disappear on the dark theme,
    // so they get a neutral tile instead.
    const background =
        luminance < 0.03 ? "#2a2f2b" : `#${hex}`;

    const foreground =
        luminance > 0.45 ? "#111311" : "#ffffff";

    return (
        <span
            className="free-app-icon"
            style={{ background, color: foreground }}
            aria-hidden="true"
        >
            {app.logo ? (
                <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    role="img"
                >
                    <path d={app.logo.path} />
                </svg>
            ) : (
                <span className="free-app-mark">
                    {app.mark}
                </span>
            )}
        </span>
    );
}
