import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";

import HomePage from "./features/home/HomePage";
import F4TPage from "./features/f4t/F4TPage";
import ClocastPage from "./features/clocast/ClocastPage";
import WatchPage from "./features/watch/WatchPage";
import PlanPage from "./features/plan/PlanPage";
import LiftPage from "./features/lift/LiftPage";
import LoginPage from "./features/auth/LoginPage";
import SignUpPage from "./features/auth/SignUpPage";
import ForgotPasswordPage from "./features/auth/ForgotPasswordPage";
import AccountPage from "./features/account/AccountPage";

// Brand icons make this page heavy, so it loads on demand.
const FreeAppsPage = lazy(() => import("./features/free/FreeAppsPage"));
// Engineering ToolFox carries a lot of reference data, so it loads on demand too.
const ToolsPage = lazy(() => import("./features/tools/ToolsPage"));
// CalmFox carries its scripts and audio engine, so it loads on demand as well.
const CalmPage = lazy(() => import("./features/calm/CalmPage"));
// MathFox brings its own solver and KaTeX, so it loads on demand too.
const MathPage = lazy(() => import("./features/math/MathPage"));
// CookFox carries its recipe library, so it loads on demand too.
const CookPage = lazy(() => import("./features/cook/CookPage"));

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/f4t" element={<F4TPage />} />
            <Route path="/clocast" element={<ClocastPage />} />
            <Route path="/watch" element={<WatchPage />} />
            <Route path="/plan" element={<PlanPage />} />
            <Route path="/lift" element={<LiftPage />} />
            <Route
                path="/calm"
                element={
                    <Suspense fallback={null}>
                        <CalmPage />
                    </Suspense>
                }
            />
            <Route
                path="/cook"
                element={
                    <Suspense fallback={null}>
                        <CookPage />
                    </Suspense>
                }
            />
            <Route
                path="/math"
                element={
                    <Suspense fallback={null}>
                        <MathPage />
                    </Suspense>
                }
            />
            <Route
                path="/tools/*"
                element={
                    <Suspense fallback={null}>
                        <ToolsPage />
                    </Suspense>
                }
            />
            <Route
                path="/free"
                element={
                    <Suspense fallback={null}>
                        <FreeAppsPage />
                    </Suspense>
                }
            />

            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route
                path="/forgot-password"
                element={<ForgotPasswordPage />}
            />

            <Route path="/account" element={<AccountPage />} />
        </Routes>
    );
}