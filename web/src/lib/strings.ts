// Every user-facing string, in one place. English only.
export const strings = {
  appName: "Panna",
  somethingWentWrong: "Something went wrong. Please try again.",
  cancel: "Cancel",

  auth: {
    email: "Email",
    password: "Password",
    passwordHint: "At least 8 characters.",
    signInTitle: "Sign in",
    signInSubtitle: "Sign in to open your pad.",
    signUpTitle: "Create account",
    signUpSubtitle: "Only invited emails can sign up.",
    logIn: "Sign in",
    signUp: "Create account",
    logOut: "Sign out",
    noAccount: "First time? Create your account",
    haveAccount: "Already have an account? Sign in",
  },

  pad: {
    placeholder: "Start typing…",
    saving: "Saving…",
    saved: "Saved",
    offline: "Offline",
    loading: "Loading…",
    copyAll: "Copy all",
    copied: "Copied",
    clear: "Clear",
    account: "Account",
    signedInAs: "Signed in as",
    clearTitle: "Clear the pad?",
    clearDescription: "This deletes all the text on every device. It can't be undone.",
    tooLong: "Limit reached. Delete some text to keep typing.",
    size: (kb: string, maxKb: string) => `${kb} / ${maxKb} KB`,
  },

  // Server error codes (plain-string ConvexErrors).
  errors: {
    notAuthenticated: "Your session has expired. Please sign in again.",
    notAllowed: "This account isn't allowed to use this app.",
    textTooLong: "The text is over the 100 KB limit.",
    invalidEmail: "Enter a valid email address.",
    passwordTooShort: "The password must be at least 8 characters.",
    invalidCredentials: "Wrong email or password.",
    accountExists: "An account with this email already exists. Sign in instead.",
  } as Record<string, string>,
};
