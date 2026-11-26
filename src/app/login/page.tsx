'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Gamepad2, KeyRound, Lock, Mail, Sparkles } from 'lucide-react';
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
    <div className="min-h-screen bg-[#202723] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#344039] bg-[#FCFBF7] p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#285943] text-[#FCFBF7]">
            <Gamepad2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-[#202723]">
              Apex Arena Game Zone
            </h1>
            <p className="text-xs text-[#646D67]">
              Interactive Web Demo • HS256 JWT Authentication
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <FieldLabel htmlFor="login-email">Owner Email</FieldLabel>
            <div className="relative">
              <Mail className="h-4 w-4 text-[#8E9690] absolute left-3 top-2.5" />
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
              <Lock className="h-4 w-4 text-[#8E9690] absolute left-3 top-2.5" />
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
            <div className="rounded-lg border border-[#C65D50]/30 bg-[#C65D50]/10 px-3 py-2 text-xs text-[#A74438]">
              {error}
            </div>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            <KeyRound className="h-4 w-4" />
            {loading ? 'Signing JWT...' : 'Sign In with JWT'}
          </Button>
        </form>

        <div className="mt-4">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full"
            onClick={handleOneClickDemo}
            disabled={loading}
          >
            <Sparkles className="h-4 w-4 text-[#285943]" />
            One-Click Demo Access
          </Button>
        </div>

        <div className="mt-5 rounded-xl border border-[#DFD9C8] bg-[#F5F2E9] p-3.5 text-[11px] text-[#5A635D] space-y-1">
          <div className="font-semibold text-[#202723]">Demo Credentials (Zero Backend Needed)</div>
          <div>
            Email: <code className="font-mono text-[#285943]">owner@gamezone.in</code> •
            Password: <code className="font-mono text-[#285943]">demo123</code>
          </div>
          <div>All timers, bookings, and receipts persist locally in your browser.</div>
        </div>
      </div>
    </div>
  );
}
