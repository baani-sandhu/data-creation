import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { restoreState } from "./app/state";
import "./styles/index.css";

restoreState();
createRoot(document.getElementById("root")!).render(<App />);
