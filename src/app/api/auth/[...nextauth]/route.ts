import NextAuth, { NextAuthOptions } from 'next-auth';
import GithubProvider from 'next-auth/providers/github';

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
      authorization: {
        params: { scope: 'read:user user:email' },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
      }
      if (profile) {
        token.login = (profile as { login?: string }).login;
        token.avatarUrl = (profile as { avatar_url?: string }).avatar_url;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined;
      session.user.login = token.login as string | undefined;
      session.user.avatarUrl = token.avatarUrl as string | undefined;
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
