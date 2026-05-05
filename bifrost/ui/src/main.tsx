import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

function Home() {
  return (
    <div>
      <h1>Bifrost</h1>
      <p>Welcome to Bifrost</p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("app")!).render(
  <React.StrictMode>
    <Home />
  </React.StrictMode>
);
