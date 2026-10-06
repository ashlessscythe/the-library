import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const stored = localStorage.getItem("the-library-theme");
document.documentElement.setAttribute(
  "data-theme",
  stored === "light" ? "light" : "dark"
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
