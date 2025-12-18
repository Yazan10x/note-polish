import { Db, ObjectId } from "mongodb";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

import { ConnectionManager } from "@/lib/ConnectionManager";
import type { SignupInput, LoginInput, PublicUser } from "@/lib/models/user";
import type { UserDb } from "@/server/models/userDb";
import { toPublicUser } from "@/server/models/userDb";

type SessionDb = {
  _id: ObjectId;
  user_id: ObjectId;
  token: string;
  created_at: Date;
  expires_at: Date;
};

type AuthResult = {
  user: PublicUser;
  sessionToken: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}





function createSessionToken(): string {
  return randomBytes(32).toString("hex");
}

function createSessionExpiry(days: number): Date {
  const ms = days * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + ms);
}

const SCRYPT_KEYLEN = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt}:${derived.toString("hex")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 6) return false;
  if (parts[0] !== "scrypt") return false;

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = parts[4];
  const hashHex = parts[5];

  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  const derived = scryptSync(password, salt, SCRYPT_KEYLEN, { N, r, p });
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== derived.length) return false;

  return timingSafeEqual(expected, derived);
}

export class UserAPI {
  static async signup(input: SignupInput): Promise<AuthResult> {
    const db = await ConnectionManager.getDb();
    const users = db.collection<UserDb>("users");
    const sessions = db.collection<SessionDb>("sessions");

    const email = normalizeEmail(input.email);

    const existing = await users.findOne({ email }, { projection: { _id: 1 } });
    if (existing) {
      throw new Error("Email already in use");
    }

    const now = new Date();
    const doc: Omit<UserDb, "_id"> = {
      full_name: input.full_name.trim(),
      email,
      password_hash: hashPassword(input.password),
      created_at: now,
      updated_at: now,
    };

    const insert = await users.insertOne(doc as UserDb);
    const created = await users.findOne({ _id: insert.insertedId });
    if (!created) throw new Error("Failed to create user");

    const sessionToken = createSessionToken();
    await sessions.insertOne({
      _id: new ObjectId(),
      user_id: created._id,
      token: sessionToken,
      created_at: now,
      expires_at: createSessionExpiry(30),
    });

    return { user: toPublicUser(created), sessionToken };
  }

  static async login(input: LoginInput): Promise<AuthResult> {
    const db = await ConnectionManager.getDb();
    const users = db.collection<UserDb>("users");
    const sessions = db.collection<SessionDb>("sessions");

    const email = normalizeEmail(input.email);
    const user = await users.findOne({ email });

    if (!user) throw new Error("Invalid email or password");
    if (!verifyPassword(input.password, user.password_hash)) {
      throw new Error("Invalid email or password");
    }

    const now = new Date();
    const sessionToken = createSessionToken();

    await sessions.insertOne({
      _id: new ObjectId(),
      user_id: user._id,
      token: sessionToken,
      created_at: now,
      expires_at: createSessionExpiry(30),
    });

    return { user: toPublicUser(user), sessionToken };
  }

  static async getMe(sessionToken: string): Promise<PublicUser | null> {
    const db = await ConnectionManager.getDb();
    const sessions = db.collection<SessionDb>("sessions");
    const users = db.collection<UserDb>("users");

    const session = await sessions.findOne({
      token: sessionToken,
      expires_at: { $gt: new Date() },
    });

    if (!session) return null;

    const user = await users.findOne({ _id: session.user_id });

    if (!user) return null;
    return toPublicUser(user);
  }

  static async logout(sessionToken: string): Promise<void> {
    const db: Db = await ConnectionManager.getDb();
    const sessions = db.collection<SessionDb>("sessions");
    await sessions.deleteOne({ token: sessionToken });
  }
}