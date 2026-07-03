import { Suspense } from "react";
import { PeopleClient } from "./people-client";

export const metadata = { title: "People" };

export default function PeoplePage() {
  return (
    <Suspense fallback={null}>
      <PeopleClient />
    </Suspense>
  );
}
