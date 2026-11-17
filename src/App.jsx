import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import HomePage from "./features/home/HomePage";
import F4TPage from "./features/f4t/F4TPage";
import ClocastPage from "./features/clocast/ClocastPage";
import WatchPage from "./features/watch/WatchPage";
import SportsPage from "./features/sports/SportsPage";
import PlanPage from "./features/plan/PlanPage";
import LiftPage from "./features/lift/LiftPage";
import LoginPage from "./features/auth/LoginPage";
import SignUpPage from "./features/auth/SignUpPage";
import ForgotPasswordPage from "./features/auth/ForgotPasswordPage";
import AccountPage from "./features/account/AccountPage";
import { useHistoryTrail } from "./lib/appBack";
import DevDock from "./features/dev/DevDock";

// Brand icons make the 3rd Party Alternatives directory heavy, so it loads on demand.
const FreeAppsPage = lazy(() => import("./features/free/FreeAppsPage"));
// Engineer ToolFox carries a lot of reference data, so it loads on demand too.
const ToolsPage = lazy(() => import("./features/tools/ToolsPage"));
// Each engineering discipline is also its own app, showing ToolFox's tools.
const DISCIPLINE_APPS = ["fluids", "heat", "hvac", "mechanics", "electrical", "manufacturing"];
// CalmFox carries its scripts and audio engine, so it loads on demand as well.
const CalmPage = lazy(() => import("./features/calm/CalmPage"));
// MathFox brings its own solver and KaTeX, so it loads on demand too.
const MathPage = lazy(() => import("./features/math/MathPage"));
// CookFox carries its recipe library, so it loads on demand too.
const CookPage = lazy(() => import("./features/cook/CookPage"));
// GrowFox carries its plant library, so it loads on demand too.
const GrowPage = lazy(() => import("./features/grow/GrowPage"));
// FlyFox carries its question bank and study notes, so it loads on demand too.
// SnowFox carries its resort list and maps, so it loads on demand too.
const SnowPage = lazy(() => import("./features/snow/SnowPage"));
// FretFox brings its songs, arranger and audio engine, so it loads on demand too.
const GuitarPage = lazy(() => import("./features/guitar/GuitarPage"));
// TrailFox carries its map, tracker and trail tools, so it loads on demand too.
const HikePage = lazy(() => import("./features/hike/HikePage"));
// KeysFox carries its song library and audio engine, so it loads on demand too.
const KeysPage = lazy(() => import("./features/keys/KeysPage"));
const FlyPage = lazy(() => import("./features/fly/FlyPage"));
// MedicFox carries its knowledge base and skill sheets, so it loads on demand too.
// ClimbFox reads routes live from OpenBeta, and loads on demand like the rest.
const ClimbPage = lazy(() => import("./features/climb/ClimbPage"));
const MedicPage = lazy(() => import("./features/medic/MedicPage"));
// RoadFox carries its state outlines and games, so it loads on demand too.
const RoadPage = lazy(() => import("./features/road/RoadPage"));
// BeaconFox is saved for offline use on its own, so it is its own chunk.
const BeaconPage = lazy(() => import("./features/beacon/BeaconPage"));
// PaceFox carries its plan builder and live recorder, so it loads on demand too.
const PacePage = lazy(() => import("./features/pace/PacePage"));
// BodyFox brings three.js and its 3D body, so it loads on demand too.
const BodyPage = lazy(() => import("./features/body/BodyPage"));
// StudyFox loads other apps' material on demand, so it loads on demand too.
const StudyPage = lazy(() => import("./features/study/StudyPage"));

// PilotFox used to be FlyFox at /fly; old links (and saved planner items)
// keep working.
function RedirectToPilot() {
    const { search, hash } = useLocation();
    return <Navigate to={`/pilot${search}${hash}`} replace />;
}

// Feedback, Donate and the developer area are small but rarely opened.
const FeedbackPage = lazy(() => import("./features/site/FeedbackPage"));
const DonatePage = lazy(() => import("./features/site/DonatePage"));
const DevPage = lazy(() => import("./features/dev/DevPage"));

// The directory used to live at /free; old links keep working.
function RedirectToAlternatives() {
    const { search, hash } = useLocation();
    return <Navigate to={`/alternatives${search}${hash}`} replace />;
}

export default function App() {
    // Lets each app's back button tell whether the step before is still
    // inside that app.
    useHistoryTrail();
    return (
        <>
        <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/f4t" element={<F4TPage />} />
            <Route path="/clocast" element={<ClocastPage />} />
            <Route path="/watch" element={<WatchPage />} />
            <Route path="/sports" element={<SportsPage />} />
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
                path="/hike"
                element={
                    <Suspense fallback={null}>
                        <HikePage />
                    </Suspense>
                }
            />
            <Route
                path="/snow"
                element={
                    <Suspense fallback={null}>
                        <SnowPage />
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
                path="/grow"
                element={
                    <Suspense fallback={null}>
                        <GrowPage />
                    </Suspense>
                }
            />
            <Route
                path="/pace"
                element={
                    <Suspense fallback={null}>
                        <PacePage />
                    </Suspense>
                }
            />
            <Route
                path="/pilot"
                element={
                    <Suspense fallback={null}>
                        <FlyPage />
                    </Suspense>
                }
            />
            <Route path="/fly" element={<RedirectToPilot />} />
            <Route
                path="/medic"
                element={
                    <Suspense fallback={null}>
                        <MedicPage />
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
            {/* The ToolFox disciplines as their own apps, same tools. */}
            {DISCIPLINE_APPS.map(id => (
                <Route
                    key={id}
                    path={`/${id}/*`}
                    element={
                        <Suspense fallback={null}>
                            <ToolsPage key={id} discipline={id} />
                        </Suspense>
                    }
                />
            ))}
            <Route
                path="/body"
                element={
                    <Suspense fallback={null}>
                        <BodyPage />
                    </Suspense>
                }
            />
            <Route
                path="/study"
                element={
                    <Suspense fallback={null}>
                        <StudyPage />
                    </Suspense>
                }
            />
            <Route
                path="/beacon"
                element={
                    <Suspense fallback={null}>
                        <BeaconPage />
                    </Suspense>
                }
            />
            <Route
                path="/road"
                element={
                    <Suspense fallback={null}>
                        <RoadPage />
                    </Suspense>
                }
            />
            <Route
                path="/climb"
                element={
                    <Suspense fallback={null}>
                        <ClimbPage />
                    </Suspense>
                }
            />
            <Route
                path="/piano"
                element={
                    <Suspense fallback={null}>
                        <KeysPage />
                    </Suspense>
                }
            />
            <Route
                path="/guitar"
                element={
                    <Suspense fallback={null}>
                        <GuitarPage />
                    </Suspense>
                }
            />
            <Route path="/free" element={<RedirectToAlternatives />} />
            <Route
                path="/alternatives"
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

            <Route
                path="/feedback"
                element={
                    <Suspense fallback={null}>
                        <FeedbackPage />
                    </Suspense>
                }
            />
            <Route
                path="/donate"
                element={
                    <Suspense fallback={null}>
                        <DonatePage />
                    </Suspense>
                }
            />
            {["/dev", "/dev/catalog", "/dev/catalog/:appId"].map(path => (
                <Route
                    key={path}
                    path={path}
                    element={
                        <Suspense fallback={null}>
                            <DevPage />
                        </Suspense>
                    }
                />
            ))}
        </Routes>
        {/* Only shows for the developer account. */}
        <DevDock />
        </>
    );
}