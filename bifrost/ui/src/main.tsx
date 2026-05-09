import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

const Home = (): JSX.Element => (
  <div>
    <h1>Bifrost</h1>
    <p>Welcome to Bifrost</p>
  </div>
);

ReactDOM.createRoot(document.getElementById("app") ?? document.createElement("div")).render(
  <React.StrictMode>
    <Home />
  </React.StrictMode>,
);
