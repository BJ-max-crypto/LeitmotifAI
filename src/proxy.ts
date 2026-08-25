import { clerkMiddleware } from "@clerk/nextjs/server";

function isPublicPath(pathname: string) {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/sign-up") ||
    pathname === "/api/setup" ||
    pathname === "/api/supabase-config"
  );
}

export default clerkMiddleware(
  async (auth, req) => {
    if (!isPublicPath(req.nextUrl.pathname)) {
      await auth.protect({
        unauthenticatedUrl: new URL("/login", req.url).toString(),
      });
    }
  },
  {
    signInUrl: "/login",
    signUpUrl: "/sign-up",
  },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk(.*)",
  ],
};
