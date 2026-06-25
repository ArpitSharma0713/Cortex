import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { createOrUpdateGoogleUser } from "../services/authService.js";

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;

        if (!email) {
          return done(new Error("Google profile did not include an email"));
        }

        const user = await createOrUpdateGoogleUser({
          googleId: profile.id,
          email,
          fullName: profile.displayName,
        });

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    },
  ),
);

export default passport;
