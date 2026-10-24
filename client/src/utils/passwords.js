export const MIN_PASSWORD_LENGTH = 8;

// Returns an error message, or "" when the new password is acceptable.
export const newPasswordError = (password, confirmation) => {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Use both letters and numbers.";
  if (password !== confirmation) return "The passwords do not match.";
  return "";
};

// Friendly messages for the Firebase errors these screens can hit.
export const passwordErrorMessage = (error) => {
  switch (error?.code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
      return "Your current password is incorrect.";
    case "auth/weak-password":
    case "auth/password-does-not-meet-requirements":
      return "That password is too weak. Choose a longer one.";
    case "auth/expired-action-code":
      return "This reset link has expired. Request a new one.";
    case "auth/invalid-action-code":
      return "This reset link is invalid or has already been used. Request a new one.";
    case "auth/user-disabled":
      return "This account has been disabled. Please contact HR.";
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
};
