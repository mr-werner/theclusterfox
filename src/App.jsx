import { Routes, Route } from "react-router-dom";

import HomePage from "./features/home/HomePage";
import F4TPage from "./features/f4t/F4TPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/f4t" element={<F4TPage />} />
    </Routes>
  );
}