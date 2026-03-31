'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';

export function Header() {
  const { data: session, status } = useSession();

  return (
    <header className="bg-[#1a1f2e] text-white sticky top-0 z-50 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-md bg-[#0078D4] flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="font-semibold text-sm tracking-tight text-white group-hover:text-blue-200 transition-colors">
              BizTalk <span className="text-[#0078D4]">→</span> Azure
            </span>
          </Link>

          {session && (
            <nav className="hidden sm:flex items-center gap-1">
              <Link
                href="/clients"
                className="text-sm text-gray-300 hover:text-white hover:bg-white/10 px-3 py-1.5 rounded-md transition-colors"
              >
                Clients
              </Link>
            </nav>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {status === 'loading' && (
            <div className="w-7 h-7 rounded-full bg-white/10 animate-pulse" />
          )}

          {status === 'unauthenticated' && (
            <button
              onClick={() => signIn('github')}
              className="flex items-center gap-2 text-sm bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-md transition-colors border border-white/10"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              Sign in with GitHub
            </button>
          )}

          {status === 'authenticated' && session?.user && (
            <div className="flex items-center gap-2.5">
              <span className="text-xs text-gray-400 hidden sm:block">
                {session.user.login ?? session.user.name}
              </span>
              {(session.user.avatarUrl ?? session.user.image) ? (
                <Image
                  src={session.user.avatarUrl ?? session.user.image ?? ''}
                  alt="avatar"
                  width={28}
                  height={28}
                  className="rounded-full ring-1 ring-white/20"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#0078D4] flex items-center justify-center text-xs font-semibold">
                  {(session.user.name ?? 'U')[0]}
                </div>
              )}
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="text-xs text-gray-400 hover:text-white transition-colors hidden sm:block"
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
