// Every user-facing string, in one place. English only.
export const strings = {
  appName: "Panna",
  somethingWentWrong: "Something went wrong. Please try again.",
  cancel: "Cancel",

  auth: {
    email: "Email",
    password: "Password",
    passwordHint: "At least 8 characters.",
    signInTitle: "Welcome back",
    signInSubtitle: "Sign in to open your pad.",
    signUpTitle: "Create your account",
    signUpSubtitle: "Only invited emails can sign up.",
    logIn: "Log in",
    signUp: "Sign up",
    logOut: "Log out",
    noAccount: "No account yet? Sign up",
    haveAccount: "Already have an account? Log in",
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
    settings: "Settings",
    clearTitle: "Clear the pad?",
    clearDescription: "This deletes all the text on every device. It can't be undone.",
    tooLong: "Limit reached. Delete some text to keep typing.",
    size: (kb: string, maxKb: string) => `${kb} / ${maxKb} KB`,
  },

  settings: {
    title: "Settings",
    account: "Account",
    signedInAs: "Signed in as",
    appearance: "Theme",
    themes: { light: "Light", dark: "Dark", system: "System" },
  },

  // Server error codes (plain-string ConvexErrors).
  errors: {
    notAuthenticated: "Your session has expired. Please log in again.",
    notAllowed: "This account isn't allowed to use this app.",
    textTooLong: "The text is over the 100 KB limit.",
    invalidEmail: "Enter a valid email address.",
    passwordTooShort: "The password must be at least 8 characters.",
    invalidCredentials: "Wrong email or password.",
    accountExists: "An account with this email already exists. Log in instead.",
  } as Record<string, string>,
};
