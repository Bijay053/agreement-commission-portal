import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import session from "express-session";
import pgSession from "connect-pg-simple";
import { storage } from "./storage";
import { pool } from "./db";

const PgStore = pgSession(session);

export function setupAuth(app: any) {
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }
  app.use(
    session({
      store: new PgStore({
        pool: pool,
        createTableIfMissing: true,
      }),
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      },
    })
  );
}

declare module "express-session" {
  interface SessionData {
    userId: number;
    userPermissions: string[];
    pendingUserId: number;
    otpRequired: boolean;
    passwordExpired: boolean;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

const PASSWORD_EXPIRY_EXEMPT_PATHS = [
  "/api/auth/me",
  "/api/auth/change-password",
  "/api/auth/logout",
  "/api/auth/heartbeat",
  "/api/auth/sessions",
];

export function requireActivePassword(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) return next();
  if (PASSWORD_EXPIRY_EXEMPT_PATHS.some(p => req.path === p || req.path.startsWith(p + "/"))) return next();
  if (req.session.passwordExpired) {
    return res.status(403).json({ message: "Password expired. Please change your password before continuing." });
  }
  next();
}

export function requirePermission(...codes: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const userPerms = req.session.userPermissions || [];
    const hasPermission = codes.some(code => userPerms.includes(code));
    if (!hasPermission) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    next();
  };
}
