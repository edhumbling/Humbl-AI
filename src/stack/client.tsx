import { StackClientApp } from "@stackframe/stack";

export const stackClientApp = new StackClientApp({
  tokenStore: "nextjs-cookie",
  urls: {
    signIn: "/handler/login",
    signUp: "/handler/signup",
    afterSignIn: "/",
    afterSignUp: "/",
  },
});
