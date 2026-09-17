import { Suspense } from "react";

import { UserProfileView } from "@/features/userprofile";

export default function Page() {
  return (
    <Suspense>
      <UserProfileView />
    </Suspense>
  );
}
