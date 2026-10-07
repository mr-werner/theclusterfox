import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";

import { authClient } from "../../lib/auth";
import { useAuth } from "../../context/AuthContext";
import SiteHeader from "../../components/SiteHeader";

export default function AccountPage() {

    const {
        user,
        loading,
        isAuthenticated,
        refreshSession,
    } = useAuth();

    const [displayName, setDisplayName] = useState("");
    const [isEditingName, setIsEditingName] = useState(false);
    const [isSavingName, setIsSavingName] = useState(false);
    const [nameError, setNameError] = useState("");
    const [nameSuccess, setNameSuccess] = useState("");


    useEffect(() => {
        if (user?.name) {
            setDisplayName(user.name);
        }
    }, [user]);

    async function handleSaveName(event) {
        event.preventDefault();

        setNameError("");
        setNameSuccess("");

        const cleanName = displayName.trim();

        if (!cleanName) {
            setNameError("Please enter a display name.");
            return;
        }

        if (cleanName.length > 50) {
            setNameError(
                "Display name must be 50 characters or fewer."
            );
            return;
        }

        setIsSavingName(true);

        try {
            const { error } = await authClient.updateUser({
                name: cleanName,
            });

            if (error) {
                throw new Error(
                    error.message ||
                    "We couldn't update your display name."
                );
            }

            await refreshSession();

            setIsEditingName(false);
            setNameSuccess("Display name updated.");
        } catch (error) {
            console.error("Update display name error:", error);

            setNameError(
                error?.message ||
                "We couldn't update your display name."
            );
        } finally {
            setIsSavingName(false);
        }
    }

    function handleCancelName() {
        setDisplayName(user?.name || "");
        setIsEditingName(false);
        setNameError("");
        setNameSuccess("");
    }

    if (loading) {
        return (
            <main className="account-page">
                <div className="account-container">
                    <p className="account-loading">
                        Loading your account...
                    </p>
                </div>
            </main>
        );
    }

    if (!isAuthenticated) {
        return (
            <Navigate
                to="/login"
                replace
            />
        );
    }

    return (
        <main className="account-page">
            <SiteHeader />

            <div className="account-container">
                <section className="account-heading">
                    <p className="eyebrow">
                        YOUR CLUSTER
                    </p>

                    <h1>Account</h1>

                    <p>
                        Manage your Cluster Fox profile,
                        security, and preferences.
                    </p>
                </section>

                <div className="account-grid">
                    <section className="account-card">
                        <div className="account-card-heading">
                            <div>
                                <p className="account-card-label">
                                    PROFILE
                                </p>

                                <h2>Your profile</h2>
                            </div>
                        </div>

                        <div className="account-details">
                            <div className="account-detail account-detail-editable">
                                <span className="account-detail-label">
                                    Display name
                                </span>

                                {!isEditingName ? (
                                    <div className="account-detail-action">
                                        <span className="account-detail-value">
                                            {user?.name || "Not set"}
                                        </span>

                                        <button
                                            type="button"
                                            className="account-edit-button"
                                            onClick={() => {
                                                setDisplayName(
                                                    user?.name || ""
                                                );
                                                setNameError("");
                                                setNameSuccess("");
                                                setIsEditingName(true);
                                            }}
                                        >
                                            Edit
                                        </button>
                                    </div>
                                ) : (
                                    <form
                                        className="account-name-form"
                                        onSubmit={handleSaveName}
                                    >
                                        <input
                                            type="text"
                                            value={displayName}
                                            onChange={(event) =>
                                                setDisplayName(
                                                    event.target.value
                                                )
                                            }
                                            maxLength={50}
                                            autoFocus
                                            disabled={isSavingName}
                                        />

                                        <div className="account-name-actions">
                                            <button
                                                type="submit"
                                                className="account-save-button"
                                                disabled={isSavingName}
                                            >
                                                {isSavingName
                                                    ? "Saving..."
                                                    : "Save"}
                                            </button>

                                            <button
                                                type="button"
                                                className="account-cancel-button"
                                                onClick={handleCancelName}
                                                disabled={isSavingName}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>

                            {nameError && (
                                <p className="auth-error account-message">
                                    {nameError}
                                </p>
                            )}

                            {nameSuccess && (
                                <p className="auth-success account-message">
                                    {nameSuccess}
                                </p>
                            )}

                            <div className="account-detail">
                                <span className="account-detail-label">
                                    Email
                                </span>

                                <span className="account-detail-value">
                                    {user?.email}
                                </span>
                            </div>

                            <div className="account-detail">
                                <span className="account-detail-label">
                                    Email status
                                </span>

                                <span className="account-detail-value">
                                    {user?.emailVerified
                                        ? "Verified"
                                        : "Not verified"}
                                </span>
                            </div>
                        </div>
                    </section>

                    <section className="account-card">
                        <div className="account-card-heading">
                            <div>
                                <p className="account-card-label">
                                    SECURITY
                                </p>

                                <h2>Password</h2>
                            </div>
                        </div>

                        <p className="account-card-description">
                            Change your password by verifying
                            your identity through your email.
                        </p>

                        <Link
                            to="/forgot-password"
                            className="account-secondary-button"
                        >
                            Change Password
                        </Link>
                    </section>

                    <section className="account-card account-card-wide">
                        <div className="account-card-heading">
                            <div>
                                <p className="account-card-label">
                                    THE CLUSTER FOX
                                </p>

                                <h2>Your apps</h2>
                            </div>
                        </div>

                        <p className="account-card-description">
                            Your account lets Cluster Fox apps save
                            preferences and data across devices.
                        </p>

                        <div className="account-app-placeholder">
                            <span>F4T</span>

                            <p>
                                Saved meals, favorite foods,
                                activity preferences, and history
                                will appear here as we add account
                                features to F4T.
                            </p>
                        </div>
                    </section>
                </div>
            </div>

            <footer className="site-footer">
                <span>The Cluster Fox</span>
                <span className="footer-dot">•</span>
                <span>Build. Learn. Tinker.</span>
            </footer>
        </main>
    );
}