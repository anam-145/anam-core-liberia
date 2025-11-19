import type { SessionOptions } from 'iron-session';

export interface SessionData {
  adminId: string;
  username: string;
  role: 'SYSTEM_ADMIN' | 'STAFF';
  isLoggedIn: boolean;
}

// Extend iron-session types
declare module 'iron-session' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface IronSessionData extends SessionData {}
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters_long',
  cookieName: 'anam_admin_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
};
