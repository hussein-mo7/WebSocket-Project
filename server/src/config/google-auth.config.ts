import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import prisma from "./db";
import { config } from "./env.config";

// Validate Google credentials
if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) {
  console.warn("⚠️  Google OAuth credentials not configured. Google authentication will not work.");
}

passport.use(
  new GoogleStrategy(
    {
      clientID: config.GOOGLE_CLIENT_ID || "not-configured",
      clientSecret: config.GOOGLE_CLIENT_SECRET || "not-configured",
      callbackURL: `${config.SERVER_URL}/api/v1/auth/google/callback`,
      passReqToCallback: false,
      scope: ["email", "profile"],
    },
    async (_accessToken: string, _refreshToken: string | undefined, profile: any, done: any) => {
      try {
        // Extract user info from Google profile
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value;
        const name = profile.displayName;
        const avatar = profile.photos?.[0]?.value;

        if (!email) {
          return done(new Error("No email provided by Google"));
        }

        // Check if user already exists
        let user = await prisma.user.findUnique({
          where: { email },
        });

        if (user) {
          // User exists - update Google ID if not already set
          if (!user.googleId) {
            user = await prisma.user.update({
              where: { email },
              data: { googleId },
            });
          }
        } else {
          // Create new user from Google profile
          // Email is auto-verified for Google accounts
          user = await prisma.user.create({
            data: {
              email,
              name: name || email.split("@")[0],
              avatar: avatar || null,
              googleId,
              emailVerified: true, // Google email is trusted
              role: "USER", // Default role
            },
          });
        }
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
      },
    });

    done(null, user);
  } catch (error) {
    done(error);
  }
});

export default passport;
