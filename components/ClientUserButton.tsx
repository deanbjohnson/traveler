"use client";

import { UserButton } from "@clerk/nextjs";

// Thin client-only wrapper to avoid SSR hydration mismatches
export default function ClientUserButton(props: React.ComponentProps<typeof UserButton>) {
  return <UserButton {...props} />;
}


