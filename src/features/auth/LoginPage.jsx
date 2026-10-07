import { Link } from "react-router-dom";

export default function LoginPage() {
    return (
        <main className="auth-page">
            <div className="auth-container">
                <Link to="/" className="auth-brand">
                    <img
                        src="/clusterfox-logo.png"
                        alt="The Cluster Fox"
                    />

                    <span>
                        THE CLUSTER <strong>FOX</strong>
                    </span>
                </Link>

                <section className="auth-card">
                    <div className="auth-heading">
                        <p className="eyebrow">WELCOME BACK</p>
                        <h1>Log in</h1>
                        <p>
                            Pick up where you left off and access your saved
                            Cluster Fox settings.
                        </p>
                    </div>

                    <form className="auth-form">
                        <label>
                            Email
                            <input
                                type="email"
                                placeholder="you@example.com"
                                autoComplete="email"
                            />
                        </label>

                        <label>
                            Password
                            <input
                                type="password"
                                placeholder="Enter your password"
                                autoComplete="current-password"
                            />
                        </label>

                        <button type="submit" className="auth-submit">
                            Log In
                        </button>
                    </form>

                    <p className="auth-switch">
                        Don't have an account?{" "}
                        <Link to="/signup">Sign up</Link>
                    </p>
                </section>

                <Link to="/" className="auth-back">
                    ← Continue without an account
                </Link>
            </div>
        </main>
    );
}