import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    // accessToken is intentionally NOT in Session — kept server-side in JWT only
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      login?: string;
      avatarUrl?: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    login?: string;
    avatarUrl?: string;
  }
}
