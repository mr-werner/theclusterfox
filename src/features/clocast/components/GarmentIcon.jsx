// Simple line drawings of clothes, drawn on a 32 × 32 grid in the current
// text color so they sit next to the temperature like weather icons do.

const SHAPES = {
  tee: (
    <path d="M11 4 6 6.5 3 11l4 2 2-2v17h14V11l2 2 4-2-3-4.5L21 4c-1 2-3 3-5 3s-4-1-5-3Z" />
  ),
  longsleeve: (
    <path d="M11 4 6 6 3 26h4l2-14v16h14V12l2 14h4L26 6l-5-2c-1 2-3 3-5 3s-4-1-5-3Z" />
  ),
  sweater: (
    <>
      <path d="M11 4 6 6 3 26h4l2-14v16h14V12l2 14h4L26 6l-5-2c-1 2-3 3-5 3s-4-1-5-3Z" />
      <path d="M9 24.5h14M12 4.5c1 3 7 3 8 0" />
    </>
  ),
  jacket: (
    <>
      <path d="M11 4 6 6 3 26h4l2-14v16h14V12l2 14h4L26 6l-5-2" />
      <path d="M11 4l5 6 5-6M16 10v18" />
    </>
  ),
  coat: (
    <>
      <path d="M11 5 6 7 3 27h4l2-14v17h14V13l2 14h4L26 7l-5-2" />
      <path d="M11 5c0-4 10-4 10 0M16 8v22M9 15h14M9 20h14M9 25h14" />
    </>
  ),
  vest: (
    <>
      <path d="M11 4 8 6v22h16V6l-3-2c-1 3-3 5-5 5s-4-2-5-5Z" />
      <path d="M16 9v19" />
    </>
  ),
  shorts: (
    <>
      <path d="M7 5h18l2 16h-9l-2-8-2 8H5Z" />
      <path d="M7 8.5h18" />
    </>
  ),
  pants: (
    <>
      <path d="M8 3h16l2 26h-7l-3-17-3 17H6Z" />
      <path d="M8 6.5h16" />
    </>
  ),
  beanie: (
    <>
      <path d="M7 22c0-9 4-13 9-13s9 4 9 13" />
      <path d="M6 22h20v4H6Z" />
      <circle cx="16" cy="6" r="2.2" />
    </>
  ),
  gloves: (
    <>
      <path d="M10 28V14c0-4 2-6 5-6s5 2 5 6v3l3-4c1.5-1.5 4 0 2.5 2L20 23v5Z" />
      <path d="M10 24h10" />
    </>
  ),
  umbrella: (
    <>
      <path d="M4 16C4 9 9.5 5 16 5s12 4 12 11c-2-2-4-2-6 0-2-2-4-2-6 0-2-2-4-2-6 0-2-2-4-2-6 0Z" />
      <path d="M16 16v9c0 3-4 3-4 0" />
    </>
  ),
  sunglasses: (
    <>
      <path d="M3 12h26" />
      <path d="M5 12h9v3c0 3-2 4-4.5 4S5 18 5 15ZM18 12h9v3c0 3-2 4-4.5 4S18 18 18 15Z" />
    </>
  ),
};

export default function GarmentIcon({ kind, size = 40, title }) {
  const shape = SHAPES[kind];
  if (!shape) return null;
  return (
    <svg
      className="cc-garment-icon"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : "true"}
    >
      {title && <title>{title}</title>}
      {shape}
    </svg>
  );
}
