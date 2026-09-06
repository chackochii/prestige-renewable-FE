// Sign-in and other public screens render their own full-page layout.

import { Outlet } from "react-router-dom";
import NotificationBanner from "@/components/NotificationBanner";

export default function PublicLayout() {
  return (
    <>
      <Outlet />
      <NotificationBanner />
    </>
  );
}
