'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';

export function Header() {
  const { data: session, status } = useSession();

  return (
    <header className="border-b bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold text-gray-900 hover:text-gray-700 flex items-center gap-2">
            <span>⚙️</span>
            <span>BizTalk Calculator</span>
          </Link>
          {session && (
            <nav className="hidden sm:flex items-center gap-4 text-sm">
              <Link href="/clients" className="text-gray-600 hover:text-gray-900 transition-colors">
                Clients
              </Link>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          {status === 'loading' && (
            <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
          )}
          {status === 'unauthenticated' && (
            <button
              onClick={() => signIn('github')}
              className="text-sm bg-gray-900 text-white px-4 py-1.5 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              Sign in
            </button>
          )}
          {status === 'authenticated' && session.user && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 hidden sm:block">
                {session.user.login ?? session.user.name}
              </span>
              {(session.user.avatarUrl ?? session.user.image) ? (
                <Image
                  src={session.user.avatarUrl ?? session.user.image ?? ''}
                  alt="avatar"
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm font-medium">
                  {(session.user.name ?? 'U')[0]}
                </div>
              )}
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
