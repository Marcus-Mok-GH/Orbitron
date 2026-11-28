import { authClient } from "./auth";

export const emailSecurity = {
  sendVerificationCode(email: string) {
    return authClient.$fetch("/email-otp/send-verification-otp", {
      method: "POST",
      body: { email, type: "email-verification" },
    });
  },
  verifyEmail(email: string, otp: string) {
    return authClient.$fetch("/email-otp/verify-email", {
      method: "POST",
      body: { email, otp },
    });
  },
  sendResetCode(email: string) {
    return authClient.$fetch("/email-otp/request-password-reset", {
      method: "POST",
      body: { email },
    });
  },
  resetPassword(email: string, otp: string, password: string) {
    return authClient.$fetch("/email-otp/reset-password", {
      method: "POST",
      body: { email, otp, password },
    });
  },
};
