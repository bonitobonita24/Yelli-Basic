import React from "react";
import { createRoot } from "react-dom/client";
import Mockup from "../../MOCKUP.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Mockup />
  </React.StrictMode>
);
