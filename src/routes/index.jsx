// Route root

import { createBrowserRouter } from "react-router-dom";
import { publicRoutes } from "./publicRoutes";
import { adminRoutes } from "./adminRoutes";

export const router = createBrowserRouter([...publicRoutes, ...adminRoutes]);
