import React, { Suspense, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import UnlimitedScroll from "./UnlimitedScroll";

const Home = React.lazy(() => import("./Home"));
const About = React.lazy(() => import("./About"));
function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<p>Lazy Loading Page</p>}>
        <Routes>
          <Route path="/" element={<Home />}></Route>
          <Route path="/about-page" element={<About />}></Route>
          <Route path="/scrolling-page" element={<UnlimitedScroll />}></Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
