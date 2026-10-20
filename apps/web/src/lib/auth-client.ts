import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * The two-factor plugin reports a pending second factor through this callback; the sign-in
 * response type does not carry a `twoFactorRedirect` field. The auth form registers here while it
 * is mounted, which keeps the client a module singleton the way the rest of the app uses it.
 */
let twoFactorRequired: (() => void) | undefined;

export const setTwoFactorRequiredHandler = (handler?: () => void) => {
  twoFactorRequired = handler;
};

export const authClient = createAuthClient({
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect: () => {
        twoFactorRequired?.();
      },
    }),
  ],
});
