'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { useUser } from '@stackframe/stack';

export default function TermsPage() {
  const router = useRouter();
  const user = useUser();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showSidebar, setShowSidebar] = useState(false);

  useEffect(() => {
    // Get theme from localStorage or default to dark
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: theme === 'dark' ? '#151514' : '#ffffff' }}>
      <Sidebar
        isOpen={showSidebar}
        onClose={() => setShowSidebar(false)}
        theme={theme}
        setTheme={setTheme}
        onShowInfo={() => {}}
        user={user}
        onNewConversation={() => router.push('/')}
        onSelectConversation={(id) => router.push(`/c/${id}`)}
      />

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b px-4 sm:px-6 py-4 flex items-center gap-4"
          style={{ borderColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)' }}>
          <button
            onClick={() => router.back()}
            className="p-2 rounded-lg transition-colors duration-200"
            style={{
              backgroundColor: theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)',
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(75, 85, 99, 0.6)' : 'rgba(209, 213, 219, 0.6)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = theme === 'dark' ? 'rgba(55, 65, 81, 0.6)' : 'rgba(229, 231, 235, 0.6)')
            }
          >
            <ArrowLeft size={20} style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }} />
          </button>
          <h1 className="text-xl sm:text-2xl font-semibold transition-colors duration-300"
            style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>
            Terms & Privacy Policy
          </h1>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-8 max-w-4xl mx-auto w-full">
          <div className="space-y-8">
            {/* Terms of Service */}
            <section>
              <h2 className="text-2xl font-bold mb-4 transition-colors duration-300"
                style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>
                Terms of Service
              </h2>
              <div className="space-y-4 text-sm sm:text-base leading-relaxed transition-colors duration-300"
                style={{ color: theme === 'dark' ? '#d1d5db' : '#374151' }}>
                <p>
                  <strong className="font-semibold">Last Updated:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <p>
                  Welcome to Humbl AI. By accessing or using our service, you agree to be bound by these Terms of Service. 
                  Please read them carefully.
                </p>
                <h3 className="text-lg font-semibold mt-6 mb-3"
                  style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>
                  1. Acceptance of Terms
                </h3>
                <p>
                  By accessing and using Humbl AI, you accept and agree to be bound by the terms and provision of this agreement.
                </p>
                <h3 className="text-lg font-semibold mt-6 mb-3"
                  style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>
                  2. Use License
                </h3>
                <p>
                  Permission is granted to temporarily use Humbl AI for personal, non-commercial transitory viewing only. 
                  This is the grant of a license, not a transfer of title, and under this license you may not:
                </p>
                <ul className="list-disc list-inside ml-4 space-y-2 mt-2">
                  <li>Modify or copy the materials</li>
                  <li>Use the materials for any commercial purpose or for any public display</li>
                  <li>Attempt to reverse engineer any software contained in Humbl AI</li>
                  <li>Remove any copyright or other proprietary notations from the materials</li>
                </ul>
                <h3 className="text-lg font-semibold mt-6 mb-3"
                  style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>
                  3. User Accounts
                </h3>
                <p>
                  You are responsible for maintaining the confidentiality of your account and password. You agree to accept 
                  responsibility for all activities that occur under your account.
                </p>
                <h3 className="text-lg font-semibold mt-6 mb-3"
                  style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>
                  4. Content and Conduct
                </h3>
                <p>
                  You agree not to use the service to transmit any harmful, offensive, or illegal content. We reserve the 
                  right to remove any content that violates these terms.
                </p>
              </div>
            </section>

            {/* Privacy Policy */}
            <section className="mt-12">
              <h2 className="text-2xl font-bold mb-4 transition-colors duration-300"
                style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>
                Privacy Policy
              </h2>
              <div className="space-y-4 text-sm sm:text-base leading-relaxed transition-colors duration-300"
                style={{ color: theme === 'dark' ? '#d1d5db' : '#374151' }}>
                <p>
                  <strong className="font-semibold">Last Updated:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <p>
                  Your privacy is important to us. This Privacy Policy explains how we collect, use, and protect your 
                  information when you use Humbl AI.
                </p>
                <h3 className="text-lg font-semibold mt-6 mb-3"
                  style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>
                  1. Information We Collect
                </h3>
                <p>
                  We collect information that you provide directly to us, such as when you create an account, use our services, 
                  or contact us for support.
                </p>
                <h3 className="text-lg font-semibold mt-6 mb-3"
                  style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>
                  2. How We Use Your Information
                </h3>
                <p>
                  We use the information we collect to provide, maintain, and improve our services, process transactions, 
                  and communicate with you.
                </p>
                <h3 className="text-lg font-semibold mt-6 mb-3"
                  style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>
                  3. Information Sharing
                </h3>
                <p>
                  We do not sell, trade, or rent your personal information to third parties. We may share your information 
                  only in the circumstances described in this policy.
                </p>
                <h3 className="text-lg font-semibold mt-6 mb-3"
                  style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>
                  4. Data Security
                </h3>
                <p>
                  We implement appropriate security measures to protect your personal information. However, no method of 
                  transmission over the internet is 100% secure.
                </p>
                <h3 className="text-lg font-semibold mt-6 mb-3"
                  style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>
                  5. Your Rights
                </h3>
                <p>
                  You have the right to access, update, or delete your personal information at any time. You can do this 
                  through your account settings or by contacting us.
                </p>
                <h3 className="text-lg font-semibold mt-6 mb-3"
                  style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>
                  6. Cookies
                </h3>
                <p>
                  We use cookies to enhance your experience, analyze site usage, and assist in our marketing efforts. You can 
                  control cookies through your browser settings.
                </p>
                <h3 className="text-lg font-semibold mt-6 mb-3"
                  style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>
                  7. Changes to This Policy
                </h3>
                <p>
                  We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new 
                  Privacy Policy on this page.
                </p>
                <h3 className="text-lg font-semibold mt-6 mb-3"
                  style={{ color: theme === 'dark' ? '#e5e7eb' : '#111827' }}>
                  8. Contact Us
                </h3>
                <p>
                  If you have any questions about this Privacy Policy, please contact us through the feedback form in the 
                  Help menu.
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

