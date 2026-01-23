import React from "react";
import ReactDOM from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./components/App";
import Home from "./components/pages/Home";
import Project from "./components/pages/Project";
import Search from "./components/pages/Search";
import NotFound from "./components/pages/NotFound";

import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
} from "react-router-dom";

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route errorElement={<NotFound />} element={<App />}>
      <Route path="/" element={<Home />} />
      <Route path="/project/:projectId" element={<Project />} />
      <Route path="/search" element={<Search />} />
    </Route>
  )
);

// renders React Component "Root" into the DOM element with ID "root"
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

ReactDOM.createRoot(document.getElementById("root")).render(
  <GoogleOAuthProvider clientId={googleClientId}>
    <RouterProvider router={router} />
  </GoogleOAuthProvider>
);
