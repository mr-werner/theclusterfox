import {
    useEffect,
    useRef,
    useState,
} from "react";

import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function SiteHeader() {
    const navigate = useNavigate();

    const {
        user,
        loading,
        isAuthenticated,
        logout,
    } = useAuth();

    const [isAccountMenuOpen, setIsAccountMenuOpen] =
        useState(false);

    const [isLoggingOut, setIsLoggingOut] =
        useState(false);

    const accountMenuRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (
                accountMenuRef.current &&
                !accountMenuRef.current.contains(event.target)
            ) {
                setIsAccountMenuOpen(false);
            }
        }

        function handleEscape(event) {
            if (event.key === "Escape") {
                setIsAccountMenuOpen(false);
            }
        }

        document.addEventListener(
            "mousedown",
            handleClickOutside
        );

        document.addEventListener(
            "keydown",
            handleEscape
        );

        return () => {
            document.removeEventListener(
                "mousedown",
                handleClickOutside
            );

            document.removeEventListener(
                "keydown",
                handleEscape
            );
        };
    }, []);

    async function handleLogout() {
        setIsLoggingOut(true);

        try {
            await logout();

            setIsAccountMenuOpen(false);

            navigate("/");
        } catch (error) {
            console.error("Logout failed:", error);
        } finally {
            setIsLoggingOut(false);
        }
    }

    return (
        <header className="site-header">
            <Link to="/" className="header-brand">
                <img
                    src="/clusterfox-logo.png"
                    alt=""
                    className="header-logo"
                />

                <span className="header-brand-name">
                    THE CLUSTER <strong>FOX</strong>
                </span>
            </Link>

            <nav
                className="header-nav"
                aria-label="Account navigation"
            >
                {!loading && (
                    <>
                        {isAuthenticated ? (
                            <div
                                className="account-menu"
                                ref={accountMenuRef}
                            >
                                <button
                                    type="button"
                                    className="account-menu-trigger"
                                    onClick={() =>
                                        setIsAccountMenuOpen(
                                            (current) => !current
                                        )
                                    }
                                    aria-expanded={
                                        isAccountMenuOpen
                                    }
                                    aria-haspopup="menu"
                                >
                                    <span>
                                        {user?.name || "Account"}
                                    </span>

                                    <span
                                        className={`account-menu-chevron ${
                                            isAccountMenuOpen
                                                ? "open"
                                                : ""
                                        }`}
                                        aria-hidden="true"
                                    >
                                        ▾
                                    </span>
                                </button>

                                {isAccountMenuOpen && (
                                    <div
                                        className="account-menu-dropdown"
                                        role="menu"
                                    >
                                        <div className="account-menu-user">
                                            <strong>
                                                {user?.name ||
                                                    "Account"}
                                            </strong>

                                            <span>
                                                {user?.email}
                                            </span>
                                        </div>

                                        <div className="account-menu-divider" />

                                        <Link
                                            to="/account"
                                            className="account-menu-item"
                                            role="menuitem"
                                            onClick={() =>
                                                setIsAccountMenuOpen(
                                                    false
                                                )
                                            }
                                        >
                                            Account
                                        </Link>

                                        <button
                                            type="button"
                                            className="account-menu-item account-menu-logout"
                                            role="menuitem"
                                            onClick={handleLogout}
                                            disabled={isLoggingOut}
                                        >
                                            {isLoggingOut
                                                ? "Logging Out..."
                                                : "Log Out"}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                <Link
                                    to="/login"
                                    className="login-link"
                                >
                                    Log In
                                </Link>

                                <Link
                                    to="/signup"
                                    className="signup-button"
                                >
                                    Sign Up
                                </Link>
                            </>
                        )}
                    </>
                )}
            </nav>
        </header>
    );
}