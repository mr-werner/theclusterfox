import { useState } from "react";
import { Link } from "react-router-dom";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [verificationCode, setVerificationCode] = useState("");

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [step, setStep] = useState("email");

    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isResending, setIsResending] = useState(false);

    async function requestResetCode() {
        const cleanEmail = email.trim();

        if (!cleanEmail) {
            setError("Please enter your email address.");
            return false;
        }

        const authUrl = import.meta.env.VITE_NEON_AUTH_URL;

        const response = await fetch(
            `${authUrl}/email-otp/request-password-reset`,
            {
                method: "POST",
                credentials: "include",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: cleanEmail,
                }),
            }
        );

        let result = {};

        try {
            result = await response.json();
        } catch {
            // Response may not contain JSON.
        }

        if (!response.ok) {
            throw new Error(
                result?.message ||
                result?.error?.message ||
                "We couldn't send a password reset code."
            );
        }

        return true;
    }

    async function handleRequestCode(event) {
        event.preventDefault();

        setError("");
        setMessage("");
        setIsSubmitting(true);

        try {
            const success = await requestResetCode();

            if (!success) {
                return;
            }

            setStep("reset");

            setMessage(
                "We sent a password reset code to your email."
            );
        } catch (err) {
            console.error("Password reset request error:", err);

            setError(
                err?.message ||
                "We couldn't send a password reset code."
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
            const success = await requestResetCode();

            if (!success) {
                return;
            }

            setVerificationCode("");

            setMessage(
                "A new password reset code has been sent."
            );
        } catch (err) {
            console.error("Resend reset code error:", err);

            setError(
                err?.message ||
                "We couldn't send another reset code."
            );
        } finally {
            setIsResending(false);
        }
    }

    async function handleResetPassword(event) {
        event.preventDefault();

        setError("");
        setMessage("");

        const code = verificationCode.trim();

        if (!/^\d{6}$/.test(code)) {
            setError(
                "Please enter the 6-digit verification code."
            );
            return;
        }

        if (!password) {
            setError("Please enter a new password.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Your passwords don't match.");
            return;
        }

        setIsSubmitting(true);

        try {
            const authUrl = import.meta.env.VITE_NEON_AUTH_URL;

            const response = await fetch(
                `${authUrl}/email-otp/reset-password`,
                {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        email: email.trim(),
                        otp: code,
                        password,
                    }),
                }
            );

            let result = {};

            try {
                result = await response.json();
            } catch {
                // Response may not contain JSON.
            }

            if (!response.ok) {
                throw new Error(
                    result?.message ||
                    result?.error?.message ||
                    "The reset code is invalid or has expired."
                );
            }

            setPassword("");
            setConfirmPassword("");
            setVerificationCode("");

            setStep("success");
        } catch (err) {
            console.error("Password reset error:", err);

            setError(
                err?.message ||
                "We couldn't reset your password."
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

                    {step === "email" && (
                        <>
                            <div className="auth-heading">
                                <p className="eyebrow">
                                    ACCOUNT RECOVERY
                                </p>

                                <h1>Reset your password</h1>

                                <p>
                                    Enter the email address associated
                                    with your Cluster Fox account.
                                </p>
                            </div>

                            <form
                                className="auth-form"
                                onSubmit={handleRequestCode}
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
                                        ? "Sending Code..."
                                        : "Send Reset Code"}
                                </button>
                            </form>

                            <p className="auth-switch">
                                Remember your password?{" "}
                                <Link to="/login">
                                    Log in
                                </Link>
                            </p>
                        </>
                    )}

                    {step === "reset" && (
                        <>
                            <div className="auth-heading">
                                <p className="eyebrow">
                                    CHECK YOUR EMAIL
                                </p>

                                <h1>Create a new password</h1>

                                <p>
                                    Enter the 6-digit code sent to{" "}
                                    <strong>{email}</strong> and choose
                                    your new password.
                                </p>
                            </div>

                            <form
                                className="auth-form"
                                onSubmit={handleResetPassword}
                            >
                                <label>
                                    Reset code

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

                                <label>
                                    New password

                                    <input
                                        type="password"
                                        placeholder="Create a new password"
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
                                    Confirm new password

                                    <input
                                        type="password"
                                        placeholder="Confirm your new password"
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
                                        ? "Resetting Password..."
                                        : "Reset Password"}
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
                                    onClick={() => {
                                        setStep("email");
                                        setVerificationCode("");
                                        setPassword("");
                                        setConfirmPassword("");
                                        setError("");
                                        setMessage("");
                                    }}
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
                                    PASSWORD UPDATED
                                </p>

                                <h1>Password reset!</h1>

                                <p>
                                    Your password has been changed.
                                    You can now log in using your new
                                    password.
                                </p>
                            </div>

                            <Link
                                to="/login"
                                className="auth-submit auth-submit-link"
                            >
                                Continue to Log In
                            </Link>
                        </>
                    )}

                </section>

                {step !== "success" && (
                    <Link to="/" className="auth-back">
                        ← Continue without an account
                    </Link>
                )}
            </div>
        </main>
    );
}