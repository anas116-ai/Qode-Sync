import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { routeTree } from "./routeTree.gen";
import { queryClient } from "./lib/query";
import { AuthProvider, useAuth } from "./lib/providers/auth-provider";
import "./index.css";

// Default auth shape used before <AuthProvider> mounts (so beforeLoad
// guards don't crash on `undefined.auth`).
const defaultAuth = {
  user: null,
  profile: null,
  loading: true,
  signUpWithPAT: async () => ({}),
  signOut: async () => {},
  refreshProfile: async () => {},
};

const router = createRouter({
  routeTree,
  // Default context (overridden in <App> below once AuthProvider is mounted).
  context: { auth: defaultAuth },
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function App() {
  const auth = useAuth();
  return <RouterProvider router={router} context={{ auth }} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
        <Toaster position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
