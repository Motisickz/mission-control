import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import Resend from "@auth/core/providers/resend";

const resendApiKey = process.env.RESEND_API_KEY;
const resendFrom = process.env.RESEND_FROM;

const resetProvider = resendApiKey
  ? (() => {
      const provider = Resend({ apiKey: resendApiKey });
      if (resendFrom) {
        provider.from = resendFrom;
      }
      return provider;
    })()
  : undefined;

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password(
      resetProvider
        ? {
            reset: resetProvider,
          }
        : {},
    ),
  ],
});
