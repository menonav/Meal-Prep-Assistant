"use client";

import { createAuthClient } from "@neondatabase/auth/next";

// Requests go to our same-origin /api/auth route, not directly to Neon.
export const authClient = createAuthClient();
