"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        if (data.session) {
          router.push("/dashboard");
          router.refresh();
        } else {
          setMessage(
            "Account created! Check your email to confirm your account, then log in."
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07111f] px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#101d2d] p-8 shadow-2xl">
        <Link
          href="/"
          className="text-sm text-emerald-300 hover:text-emerald-200"
        >
          ← Back to home
        </Link>

        <div className="mt-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
            Experience Compression Engine
          </p>

          <h1 className="mt-4 text-3xl font-bold">
            {isSignUp ? "Create your account" : "Welcome back"}
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-400">
            {isSignUp
              ? "Start learning through expert-guided industry scenarios."
              : "Log in to continue your learning journey."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm text-slate-300"
            >
              Email address
            </label>

            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-white/10 bg-[#07111f] px-4 py-3 outline-none transition focus:border-emerald-400"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm text-slate-300"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              minLength={6}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="w-full rounded-xl border border-white/10 bg-[#07111f] px-4 py-3 outline-none transition focus:border-emerald-400"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"
            >
              {error}
            </p>
          )}

          {message && (
            <p
              role="status"
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200"
            >
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-400 px-4 py-3 font-bold text-[#07111f] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? "Please wait..."
              : isSignUp
                ? "Create account"
                : "Log in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          {isSignUp ? "Already have an account?" : "New to the platform?"}{" "}
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
              setMessage("");
            }}
            className="font-semibold text-emerald-300 hover:text-emerald-200"
          >
            {isSignUp ? "Log in" : "Sign up"}
          </button>
        </p>
      </div>
    </main>
  );
}
