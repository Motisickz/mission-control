import { query } from "./_generated/server";

export const passwordResetStatus = query({
  args: {},
  handler: async () => {
    return {
      enabled: !!process.env.RESEND_API_KEY,
    };
  },
});

