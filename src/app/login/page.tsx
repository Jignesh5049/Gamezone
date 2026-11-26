'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Lock, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldLabel, Input } from '@/components/ui/input';
import {
  authenticateDemoCredentials,
  getStoredJwt,
  issueQuickDemoJwt,
  setStoredJwt,
  verifyDemoJwt,
} from '@/lib/jwt';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState('owner@gamezone.in');
  const [password, setPassword] = React.useState('demo123');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    verifyDemoJwt(getStoredJwt()).then((payload) => {
      if (active && payload) {
        router.replace('/');
      }
    });
    return () => {
      active = false;
    };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const auth = await authenticateDemoCredentials(email, password);
      if (!auth) {
        setError('Invalid credentials. Use owner@gamezone.in / demo123');
        return;
      }
      setStoredJwt(auth.token);
      router.replace('/');
    } finally {
      setLoading(false);
    }
  };

  const handleOneClickDemo = async () => {
    setLoading(true);
    setError(null);
    try {
      const auth = await issueQuickDemoJwt();
      setStoredJwt(auth.token);
      router.replace('/');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F2E9] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#1E2420]/10 bg-[#FCFBF7] p-8 shadow-[0_8px_24px_rgba(30,36,32,0.06)]">
        <div className="flex items-center gap-3 mb-6">
          <svg
            viewBox="0 0 40 40"
            className="h-10 w-10 shrink-0"
            aria-hidden="true"
          >
            <rect width="40" height="40" rx="10" fill="#285943" />
            <circle cx="20" cy="20" r="7.5" fill="none" stroke="#F2EFE7" strokeWidth="1.5" />
            <circle cx="20" cy="20" r="2" fill="#F2EFE7" />
          </svg>
          <div>
            <h1 className="text-2xl leading-tight font-medium text-[#1E2420]">
              Apex Arena Game Zone
            </h1>
            <p className="text-sm text-[#525B55] mt-1">
              Owner desk sign-in
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <FieldLabel htmlFor="login-email">Owner email</FieldLabel>
            <div className="relative">
              <Mail
                className="h-4 w-4 text-[#707973] absolute left-3 top-2.5"
                strokeWidth={1.5}
              />
              <Input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <FieldLabel htmlFor="login-password">Password</FieldLabel>
            <div className="relative">
              <Lock
                className="h-4 w-4 text-[#707973] absolute left-3 top-2.5"
                strokeWidth={1.5}
              />
              <Input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-[8px] border border-[#C65D50]/30 bg-[#C65D50]/10 px-3 py-2 text-xs text-[#A74438]">
              {error}
            </div>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? 'Signing in' : 'Sign in'}
          </Button>
        </form>

        <div className="mt-3">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            onClick={handleOneClickDemo}
            disabled={loading}
          >
            Continue with demo account
            <ArrowRight className="h-4 w-4 text-[#707973]" strokeWidth={1.5} />
          </Button>
        </div>

        <div className="mt-6 rounded-[10px] border border-[#1E2420]/10 bg-[#F5F2E9] p-4 text-xs text-[#525B55] space-y-1">
          <div className="font-medium text-[#1E2420]">Demo account</div>
          <div>
            Email: <code className="font-mono text-[#285943]">owner@gamezone.in</code> ·
            Password: <code className="font-mono text-[#285943]">demo123</code>
          </div>
          <div>Timers, bookings, and receipts save locally in your browser</div>
        </div>
      </div>
    </div>
  );
}
