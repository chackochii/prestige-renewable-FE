// Root application component: Redux Provider + Router

import { Suspense } from "react";
import { Provider } from "react-redux";
import { RouterProvider } from "react-router-dom";
import { store } from "@/store";
import { router } from "@/routes";
import LoadingState from "@/components/LoadingState";

export default function App() {
  return (
    <Provider store={store}>
      <Suspense fallback={<LoadingState screen label="Loading…" />}>
        <RouterProvider router={router} />
      </Suspense>
    </Provider>
  );
}
