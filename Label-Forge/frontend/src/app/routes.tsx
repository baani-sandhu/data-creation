import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Step1Setup } from "./components/steps/Step1Setup";
import { Step2Extract } from "./components/steps/Step2Extract";
import { Step3Sample } from "./components/steps/Step3Sample";
import { Step4LLMGeneration } from "./components/steps/Step4LLMGeneration";
import { Step5Review } from "./components/steps/Step5Review";
import { Step6Export } from "./components/steps/Step6Export";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Step1Setup },
      { path: "extract", Component: Step2Extract },
      { path: "sample", Component: Step3Sample },
      { path: "generate", Component: Step4LLMGeneration },
      { path: "review", Component: Step5Review },
      { path: "export", Component: Step6Export },
    ],
  },
]);
