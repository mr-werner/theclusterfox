import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authClient } from "../../lib/auth";
import { useAuth } from "../../context/AuthContext";
import { nextPath, withNext } from "../../lib/redirect";

export default function SignUpPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const next = nextPath(searchParams);
    const { refreshSession, isAuthenticated } = useAuth();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [displayName, setDisplayName] = useState("");

    const [verificationCode, setVerificationCode] = useState("");
    const [step, setStep] = useState("signup");

    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isResending, setIsResending] = useState(false);

    async function handleSignUp(event) {
        event.preventDefault();

        setError("");
        setMessage("");

        const cleanEmail = email.trim();
        const cleanName = displayName.trim();

        if (!cleanName) {
            setError("Please enter a display name.");
            return;
        }

        if (!cleanEmail) {
            setError("Please enter your email address.");
            return;
        }

        if (cleanName.length > 50) {
            setError("Display name must be 50 characters or fewer.");
            return;
        }

        if (!password) {
            setError("Please enter a password.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Your passwords don't match.");
            return;
        }

        setIsSubmitting(true);

        try {
            const { error } = await authClient.signUp.email({
                email: cleanEmail,
                password,
                name: cleanName,
            });

            if (error) {
                setError(
                    error.message ||
                    "We couldn't create your account. Please try again."
                );
                return;
            }

            setStep("verify");
            setPassword("");
            setConfirmPassword("");
            setVerificationCode("");

            setMessage(
                "We sent a verification code to your email."
            );
        } catch (err) {
            console.error("Sign-up error:", err);

            setError(
                err?.message ||
                "Something went wrong while creating your account."
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleVerification(event) {
        event.preventDefault();

        setError("");
        setMessage("");

        const code = verificationCode.trim();

        if (!/^\d{6}$/.test(code)) {
            setError("Please enter the 6-digit verification code.");
            return;
        }

        setIsSubmitting(true);

        try {
            const authUrl = import.meta.env.VITE_NEON_AUTH_URL;

            const response = await fetch(
                `${authUrl}/email-otp/verify-email`,
                {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        email: email.trim(),
                        otp: code,
                    }),
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result?.message ||
                    result?.error?.message ||
                    "The verification code is invalid or has expired."
                );
            }

            setVerificationCode("");

            // Verifying usually signs you in too; if so, go straight back.
            await refreshSession();
            const session = await authClient.getSession();
            if (session?.data?.user) {
                navigate(next);
                return;
            }

            setStep("success");
        } catch (err) {
            console.error("Verification error:", err);

            setError(
                err?.message ||
                "We couldn't verify your email. Please try again."
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleResendCode() {
        setError("");
        setMessage("");
        setIsResending(true);

        try {
            const authUrl = import.meta.env.VITE_NEON_AUTH_URL;

            const response = await fetch(
                `${authUrl}/email-otp/send-verification-otp`,
                {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        email: email.trim(),
                        type: "email-verification",
                    }),
                }
            );

            let result = {};

            try {
                result = await response.json();
            } catch {
                // Some successful responses may not contain JSON.
            }

            if (!response.ok) {
                throw new Error(
                    result?.message ||
                    result?.error?.message ||
                    "We couldn't send another verification code."
                );
            }

            setVerificationCode("");

            setMessage(
                "A new verification code has been sent. Check your email."
            );
        } catch (err) {
            console.error("Resend verification error:", err);

            setError(
                err?.message ||
                "We couldn't send another verification code. Please try again."
            );
        } finally {
            setIsResending(false);
        }
    }

    function handleGoBack() {
        setStep("signup");
        setVerificationCode("");
        setError("");
        setMessage("");
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
                    {step === "signup" && (
                        <>
                            <div className="auth-heading">
                                <p className="eyebrow">
                                    JOIN THE CLUSTER
                                </p>

                                <h1>Create an account</h1>

                                <p>
                                    Keep your saved meals, favorite activities,
                                    and settings on every device. Everything
                                    still works without an account.
                                </p>
                            </div>

                            <form
                                className="auth-form"
                                onSubmit={handleSignUp}
                            >
                                <label>
                                    Display name

                                    <input
                                        type="text"
                                        placeholder="What should we call you?"
                                        autoComplete="name"
                                        value={displayName}
                                        onChange={(event) =>
                                            setDisplayName(event.target.value)
                                        }
                                        maxLength={50}
                                        disabled={isSubmitting}
                                        required
                                    />
                                </label>


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
                                        placeholder="Create a password"
                                        autoComplete="new-password"
                                        value={password}
                                        onChange={(event) =>
                                            setPassword(event.target.value)
                                        }
                                        disabled={isSubmitting}
                                        required
                                    />
                                </label>

                                <label>
                                    Confirm password

                                    <input
                                        type="password"
                                        placeholder="Confirm your password"
                                        autoComplete="new-password"
                                        value={confirmPassword}
                                        onChange={(event) =>
                                            setConfirmPassword(
                                                event.target.value
                                            )
                                        }
                                        disabled={isSubmitting}
                                        required
                                    />
                                </label>

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
                                        ? "Creating Account..."
                                        : "Create Account"}
                                </button>
                            </form>

                            <p className="auth-switch">
                                Already have an account?{" "}
                                <Link to={withNext("/login", next)}>
                                    Log in
                                </Link>
                            </p>
                        </>
                    )}

                    {step === "verify" && (
                        <>
                            <div className="auth-heading">
                                <p className="eyebrow">
                                    ALMOST THERE
                                </p>

                                <h1>Verify your email</h1>

                                <p>
                                    Enter the 6-digit verification code
                                    sent to <strong>{email}</strong>.
                                    The code expires in 10 minutes.
                                </p>
                            </div>

                            <form
                                className="auth-form"
                                onSubmit={handleVerification}
                            >
                                <label>
                                    Verification code

                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        autoComplete="one-time-code"
                                        placeholder="000000"
                                        maxLength={6}
                                        value={verificationCode}
                                        onChange={(event) => {
                                            const value =
                                                event.target.value
                                                    .replace(/\D/g, "")
                                                    .slice(0, 6);

                                            setVerificationCode(value);
                                        }}
                                        disabled={isSubmitting}
                                        required
                                    />
                                </label>

                                {error && (
                                    <p className="auth-error">
                                        {error}
                                    </p>
                                )}

                                {message && (
                                    <p className="auth-success">
                                        {message}
                                    </p>
                                )}

                                <button
                                    type="submit"
                                    className="auth-submit"
                                    disabled={
                                        isSubmitting ||
                                        verificationCode.length !== 6
                                    }
                                >
                                    {isSubmitting
                                        ? "Verifying..."
                                        : "Verify Email"}
                                </button>
                            </form>

                            <div className="auth-resend">
                                <span>
                                    Didn't receive the code?
                                </span>

                                <button
                                    type="button"
                                    className="auth-text-button"
                                    onClick={handleResendCode}
                                    disabled={
                                        isResending ||
                                        isSubmitting
                                    }
                                >
                                    {isResending
                                        ? "Sending..."
                                        : "Resend code"}
                                </button>
                            </div>

                            <p className="auth-switch">
                                Wrong email?{" "}

                                <button
                                    type="button"
                                    className="auth-text-button"
                                    onClick={handleGoBack}
                                >
                                    Go back
                                </button>
                            </p>
                        </>
                    )}

                    {step === "success" && (
                        <>
                            <div className="auth-heading">
                                <p className="eyebrow">
                                    WELCOME TO THE CLUSTER
                                </p>

                                <h1>Email verified!</h1>

                                <p>
                                    Your Cluster Fox account is verified
                                    and ready to go.
                                </p>
                            </div>

                            <Link
                                to={isAuthenticated ? next : withNext("/login", next)}
                                className="auth-submit auth-submit-link"
                            >
                                {isAuthenticated ? "Continue" : "Continue to Log In"}
                            </Link>
                        </>
                    )}
                </section>

                {step !== "success" && (
                    <Link to={next} className="auth-back">
                        ← Continue without an account
                    </Link>
                )}
            </div>
        </main>
    );
}