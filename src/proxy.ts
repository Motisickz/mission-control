import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isAuthPage = createRouteMatcher(["/connexion"]);
const isProtectedRoute = createRouteMatcher([
  "/missions(.*)",
  "/calendrier(.*)",
  "/communication(.*)",
  "/profils(.*)",
  "/idees(.*)",
  "/notifications(.*)",
]);

export const proxy = convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  if (isAuthPage(request) && (await convexAuth.isAuthenticated())) {
    return nextjsMiddlewareRedirect(request, "/missions");
  }

  if (isProtectedRoute(request) && !(await convexAuth.isAuthenticated())) {
    return nextjsMiddlewareRedirect(request, "/connexion");
  }
});

export default proxy;

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
