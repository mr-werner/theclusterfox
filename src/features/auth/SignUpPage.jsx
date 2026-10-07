import { Link } from "react-router-dom";

export default function SignUpPage() {
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
                        <p className="eyebrow">JOIN THE CLUSTER</p>
                        <h1>Create an account</h1>
                        <p>
                            Save your settings, personalize your apps, and get
                            more out of The Cluster Fox.
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
                                placeholder="Create a password"
                                autoComplete="new-password"
                            />
                        </label>

                        <label>
                            Confirm password
                            <input
                                type="password"
                                placeholder="Confirm your password"
                                autoComplete="new-password"
                            />
                        </label>

                        <button type="submit" className="auth-submit">
                            Create Account
                        </button>
                    </form>

                    <p className="auth-switch">
                        Already have an account?{" "}
                        <Link to="/login">Log in</Link>
                    </p>
                </section>

                <Link to="/" className="auth-back">
                    ← Continue without an account
                </Link>
            </div>
        </main>
    );
}