// route.ts — NextAuth v5 catch-all route handler re-exporting the auth handlers.
// Dest: src/app/api/auth/[...nextauth]/route.ts

import { handlers } from "@/auth";

export const { GET, POST } = handlers;
