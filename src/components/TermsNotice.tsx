'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function TermsNotice() {
  const pathname = usePathname();
  const isSignup = pathname?.includes('signup');
  const isLogin = pathname?.includes('login');
  
  if (!isSignup && !isLogin) {
    return null;
  }
  
  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg px-4 py-3 border border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
          By signing up or logging in, you agree to our{' '}
          <Link 
            href="/terms" 
            className="text-blue-600 dark:text-blue-400 hover:underline"
            target="_blank"
          >
            Terms & Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}

