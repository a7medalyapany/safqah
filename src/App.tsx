import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";

import { router } from "@/app/router";
import { useAuthStore } from "@/store/authSlice";

function App() {
  const bootstrap = useAuthStore((state) => state.bootstrap);

  useEffect(() => {
    void bootstrap().catch(() => {
      // The invoke wrapper already reported the error.
    });
  }, [bootstrap]);

  return <RouterProvider router={router} />;
}

export default App;
