import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authClient } from "../../lib/auth";
import { useAuth } from "../../context/AuthContext";

export default function LoginPage() {
    const navigate = useNavigate();
    const { refreshSession } = useAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    async function handleSubmit(event) {
        event.preventDefault();

        setError("");

        const cleanEmail = email.trim();

        if (!cleanEmail) {
            setError("Please enter your email address.");
            return;
        }

        if (!password) {
            setError("Please enter your password.");
            return;
        }

        setIsSubmitting(true);

        try {
            const { error } = await authClient.signIn.email({
                email: cleanEmail,
                password,
            });

            if (error) {
                setError(
                    error.message ||
                    "We couldn't log you in. Check your email and password."
                );
                return;
            }

            await refreshSession();
            navigate("/");
        } catch (err) {
            console.error("Login error:", err);

            setError(
                err?.message ||
                "Something went wrong while logging in."
            );
        } finally {
            setIsSubmitting(false);
        }
    }

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
                        <p className="eyebrow">
                            WELCOME BACK
                        </p>

                        <h1>Log in</h1>

                        <p>
                            Pick up where you left off and access your
                            saved Cluster Fox settings.
                        </p>
                    </div>

                    <form
                        className="auth-form"
                        onSubmit={handleSubmit}
                    >
                        <label>
                            Email

                            <input
                                type="email"
                                placeholder="you@example.com"
                                autoComplete="email"
                                value={email}
                                onChange={(event) =>
                                    setEmail(event.target.value)
                                }
                                disabled={isSubmitting}
                                required
                            />
                        </label>

                        <label>
                            Password

                            <input
                                type="password"
                                placeholder="Enter your password"
                                autoComplete="current-password"
                                value={password}
                                onChange={(event) =>
                                    setPassword(event.target.value)
                                }
                                disabled={isSubmitting}
                                required
                            />
                        </label>

                        <div className="auth-forgot">
                            <Link to="/forgot-password">
                                Forgot your password?
                            </Link>
                        </div>

                        {error && (
                            <p className="auth-error">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            className="auth-submit"
                            disabled={isSubmitting}
                        >
                            {isSubmitting
                                ? "Logging In..."
                                : "Log In"}
                        </button>
                    </form>

                    <p className="auth-switch">
                        Don't have an account?{" "}
                        <Link to="/signup">
                            Sign up
                        </Link>
                    </p>
                </section>

                <Link to="/" className="auth-back">
                    ← Continue without an account
                </Link>
            </div>
        </main>
    );
}