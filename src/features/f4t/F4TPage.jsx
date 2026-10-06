import { ArrowLeft, Flame } from "lucide-react";
import { Link } from "react-router-dom";

export default function F4TPage() {
  return (
    <main className="f4t-page">
      <nav className="f4t-nav">
        <Link to="/" className="back-link">
          <ArrowLeft size={18} />
          Cluster Fox
        </Link>
      </nav>

      <section className="f4t-placeholder">
        <div className="f4t-logo">
          <Flame size={38} />
        </div>

        <p className="f4t-eyebrow">FUEL 4 THOUGHT</p>

        <h1>F4T</h1>

        <p className="f4t-intro">
          Food, fitness, and the science behind it.
        </p>

        <div className="coming-soon">
          <span>FIRST TOOL</span>
          <h2>Is It Worth It?</h2>

          <p>
            See what your food looks like in movement — and learn what the
            numbers actually mean.
          </p>
        </div>
      </section>
    </main>
  );
}