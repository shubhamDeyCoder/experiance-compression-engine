"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { supabase } from "@/lib/supabase";
import WorkspaceFooter from "@/components/WorkspaceFooter";
import { resolveWorkspaceRole, workspaceHome } from "@/lib/workspaceRole";

const ease = [0.22, 1, 0.36, 1] as const;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.12 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease },
  },
};

export default function LoginPage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const { data, error: authError } = await supabase.auth.getUser();

        if (!active) return;

        if (!data.user) {
          if (
            authError &&
            authError.message !== "Auth session missing!"
          ) {
            setError(authError.message);
          }

          setCheckingSession(false);
          return;
        }

        const role = await resolveWorkspaceRole();

        if (active) {
          router.replace(workspaceHome(role));
          router.refresh();
        }
      } catch {
        if (active) setCheckingSession(false);
      }
    }

    void checkSession();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const { error: signInError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (signInError) throw signInError;

      const role = await resolveWorkspaceRole();

      router.replace(workspaceHome(role));
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "We couldn't sign you in. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setError("");
    setMessage("");

    if (!email.trim()) {
      setError(
        "Enter your work email first, then select Forgot password.",
      );
      return;
    }

    setLoading(true);

    try {
      const { error: resetError } =
        await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/login`,
        });

      if (resetError) throw resetError;

      setMessage(
        "If an account exists for that email, a password reset link will be sent.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not request a password reset.",
      );
    } finally {
      setLoading(false);
    }
  }

  const reveal = reduceMotion
    ? { duration: 0 }
    : { duration: 0.85, ease };

  return (
    <main className="ece-login relative flex min-h-screen flex-col overflow-hidden text-white">
      {/* Ambient animated background */}
      <div className="ece-login-grid pointer-events-none absolute inset-0" />

      <motion.div
        aria-hidden="true"
        className="ece-login-orb ece-login-orb-a"
        animate={
          reduceMotion
            ? {}
            : {
                x: [0, 45, -15, 0],
                y: [0, -35, 25, 0],
                scale: [1, 1.12, 0.95, 1],
              }
        }
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        aria-hidden="true"
        className="ece-login-orb ece-login-orb-b"
        animate={
          reduceMotion
            ? {}
            : {
                x: [0, -35, 20, 0],
                y: [0, 30, -25, 0],
                scale: [1, 0.9, 1.15, 1],
              }
        }
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[1440px] flex-1 items-center px-4 py-8 sm:px-8 lg:px-12">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={reveal}
          className="ece-login-card grid w-full overflow-hidden rounded-[30px] lg:min-h-[690px] lg:grid-cols-[1.08fr_0.92fr]"
        >
          {/* Left: Brand experience */}
          <section className="ece-login-hero relative hidden flex-col justify-between overflow-hidden p-10 lg:flex xl:p-14">
            <div className="ece-hero-light ece-hero-light-one" />
            <div className="ece-hero-light ece-hero-light-two" />

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="relative z-10"
            >
              <motion.div variants={itemVariants}>
                
<div className="relative z-10 flex items-center justify-between gap-4">
  <Link href="/" className="group inline-flex items-center gap-3">
    <div>
      <Image
  src="/ece-logo.png"
  alt="Experience Compression Engine"
  width={44}
  height={44}
  priority
/>
    </div>

    <span className="text-xs font-bold tracking-[0.18em] text-white/90">
      EXPERIENCE
      <br />
      COMPRESSION ENGINE
    </span>
  </Link>

  <Link
    href="/"
    aria-label="Return to homepage"
    className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-4 py-2.5 text-xs font-medium text-slate-300 transition duration-300 hover:border-[#8ee2c4]/50 hover:bg-[#8ee2c4]/10 hover:text-white"
  >
    <span aria-hidden="true">←</span>
    Back to home
  </Link>
</div>

              </motion.div>

              <div className="mt-20 max-w-xl xl:mt-24">
                <motion.div variants={itemVariants}>
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#a7e9d2]/20 bg-[#a7e9d2]/[0.07] px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#a7e9d2]">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#a7e9d2]" />
                    Experience, transferred
                  </span>
                </motion.div>

                <motion.h1
                  variants={itemVariants}
                  className="mt-7 text-5xl font-medium leading-[1.12] tracking-[-0.055em] xl:text-6xl"
                >
                  Learn from
                  <br />
                  <span className="ece-gradient-text">
                    experience.
                  </span>
                  <br />
                  Not just theory.
                </motion.h1>

                <motion.p
                  variants={itemVariants}
                  className="mt-6 max-w-md text-sm leading-7 text-slate-300/80 xl:text-base"
                >
                  Transform expert knowledge into realistic challenges,
                  guided decisions, and measurable professional growth.
                </motion.p>

                <motion.div
                  variants={itemVariants}
                  className="mt-11 grid grid-cols-3 gap-3"
                >
                  {[
                    { number: "01", title: "Capture", detail: "Expert knowledge" },
                    { number: "02", title: "Practice", detail: "Real scenarios" },
                    { number: "03", title: "Improve", detail: "Proven skills" },
                  ].map((step) => (
                    <motion.div
                      key={step.number}
                      whileHover={
                        reduceMotion
                          ? {}
                          : { y: -5, borderColor: "rgba(167,233,210,0.4)" }
                      }
                      className="ece-login-step rounded-2xl p-4"
                    >
                      <span className="text-[10px] font-bold tracking-[0.2em] text-[#a7e9d2]">
                        {step.number}
                      </span>
                      <h3 className="mt-4 text-sm font-semibold text-white">
                        {step.title}
                      </h3>
                      <p className="mt-1.5 text-[10px] leading-4 text-slate-400">
                        {step.detail}
                      </p>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            </motion.div>

            <motion.div
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 0.8 }}
              className="relative z-10 flex items-center justify-between gap-4 text-[10px] tracking-wide text-slate-500"
            >
              <span>BUILT FOR LEARNING THAT MOVES YOU FORWARD</span>
              <span className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#a7e9d2]" />
                EXPERT-GUIDED
              </span>
            </motion.div>
          </section>

          {/* Right: Login form */}
          <section className="ece-login-form flex items-center justify-center px-6 py-10 sm:px-10 lg:px-12 xl:px-16">
            <div className="w-full max-w-[390px]">
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
              >
                <motion.div variants={itemVariants}>
                  <Link
                    href="/"
                    className="mb-10 inline-flex items-center gap-2 text-xs text-slate-400 transition hover:text-[#baf4dc] lg:hidden"
                  >
                    <span aria-hidden="true">←</span>
                    Back to home
                  </Link>

                  <div className="mb-8">
                    <div className="mb-7 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-semibold tracking-widest text-[#a7e9d2] lg:hidden">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#baf4dc] font-black text-[#092327]">
                          E
                        </span>
                        ECE WORKSPACE
                      </div>

                      <span className="ml-auto rounded-full border border-white/[0.09] bg-white/[0.025] px-3 py-1.5 text-[10px] tracking-wider text-slate-400">
                        SECURE ACCESS
                      </span>
                    </div>

                    <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#8ee2c4]">
                      Your workspace
                    </p>

                    <h2 className="mt-3 text-[34px] font-medium tracking-[-0.045em] text-white sm:text-[38px]">
                      Welcome back<span className="text-[#8ee2c4]">.</span>
                    </h2>

                    <p className="mt-3 text-sm leading-6 text-slate-400">
                      Pick up where your next breakthrough begins.
                    </p>
                  </div>
                </motion.div>

                <AnimatePresence mode="wait">
                  {checkingSession ? (
                    <motion.div
                      key="checking"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-sm text-slate-300"
                    >
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#a7e9d2]/25 border-t-[#a7e9d2]" />
                      Checking your session…
                    </motion.div>
                  ) : (
                    <motion.form
                      key="login"
                      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.45, ease }}
                      onSubmit={handleSubmit}
                      className="space-y-5"
                    >
                      <div>
                        <label
                          htmlFor="email"
                          className="mb-2.5 block text-xs font-semibold text-slate-300"
                        >
                          Work email
                        </label>

                        <input
                          id="email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          required
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="you@company.com"
                          className="ece-login-input w-full rounded-xl px-4 py-3.5 text-sm text-white outline-none transition duration-300 placeholder:text-slate-600"
                        />
                      </div>

                      <div>
                        <div className="mb-2.5 flex items-center justify-between gap-3">
                          <label
                            htmlFor="password"
                            className="block text-xs font-semibold text-slate-300"
                          >
                            Password
                          </label>

                          <button
                            type="button"
                            onClick={handleForgotPassword}
                            disabled={loading}
                            className="text-xs font-medium text-[#8ee2c4] transition hover:text-white disabled:opacity-50"
                          >
                            Forgot password?
                          </button>
                        </div>

                        <div className="relative">
                          <input
                            id="password"
                            name="password"
                            type={showPassword ? "text" : "password"}
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="Enter your password"
                            className="ece-login-input w-full rounded-xl px-4 py-3.5 pr-[76px] text-sm text-white outline-none transition duration-300 placeholder:text-slate-600"
                          />

                          <button
                            type="button"
                            onClick={() => setShowPassword((current) => !current)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            className="absolute inset-y-0 right-4 text-[11px] font-semibold text-slate-400 transition hover:text-[#baf4dc]"
                          >
                            {showPassword ? "Hide" : "Show"}
                          </button>
                        </div>
                      </div>

                      <AnimatePresence mode="wait">
                        {error && (
                          <motion.p
                            key="error"
                            role="alert"
                            initial={{ opacity: 0, height: 0, y: -5 }}
                            animate={{ opacity: 1, height: "auto", y: 0 }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden rounded-xl border border-rose-400/20 bg-rose-400/[0.07] p-3 text-xs leading-5 text-rose-200"
                          >
                            {error}
                          </motion.p>
                        )}

                        {message && (
                          <motion.p
                            key="message"
                            role="status"
                            initial={{ opacity: 0, height: 0, y: -5 }}
                            animate={{ opacity: 1, height: "auto", y: 0 }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] p-3 text-xs leading-5 text-emerald-200"
                          >
                            {message}
                          </motion.p>
                        )}
                      </AnimatePresence>

                      <motion.button
                        type="submit"
                        disabled={loading}
                        whileHover={
                          reduceMotion || loading ? {} : { y: -2, scale: 1.005 }
                        }
                        whileTap={reduceMotion || loading ? {} : { scale: 0.985 }}
                        className="ece-login-submit group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-4 py-4 text-sm font-bold text-[#092522] transition disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span className="ece-button-shimmer" />

                        <span className="relative z-10">
                          {loading ? "Please wait…" : "Sign in to your workspace"}
                        </span>

                        {!loading && (
                          <motion.span
                            aria-hidden="true"
                            className="relative z-10"
                            animate={reduceMotion ? {} : { x: [0, 4, 0] }}
                            transition={{
                              duration: 1.5,
                              repeat: Infinity,
                              repeatDelay: 1.5,
                            }}
                          >
                            →
                          </motion.span>
                        )}
                      </motion.button>
                    </motion.form>
                  )}
                </AnimatePresence>

                <motion.div
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  className="my-7 flex items-center gap-3"
                >
                  <span className="h-px flex-1 bg-white/[0.09]" />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                    New to ECE?
                  </span>
                  <span className="h-px flex-1 bg-white/[0.09]" />
                </motion.div>

                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="grid gap-3 sm:grid-cols-2"
                >
                  <motion.div variants={itemVariants}>
                    <Link
                      href="/company/register"
                      className="ece-login-link flex min-h-12 items-center justify-center rounded-xl px-3 py-3 text-center text-xs font-semibold text-slate-200 transition duration-300"
                    >
                      Register a company
                      <span className="ml-1.5 text-[#8ee2c4]">↗</span>
                    </Link>
                  </motion.div>

                  <motion.div variants={itemVariants}>
                    <Link
                      href="/register"
                      className="ece-login-link flex min-h-12 items-center justify-center rounded-xl px-3 py-3 text-center text-xs font-semibold text-slate-200 transition duration-300"
                    >
                      Join a company
                      <span className="ml-1.5 text-[#8ee2c4]">↗</span>
                    </Link>
                  </motion.div>
                </motion.div>

                <motion.p
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  className="mt-7 text-center text-[10px] leading-5 text-slate-500"
                >
                  Access is linked to your company membership
                  <br className="hidden sm:block" /> and assigned permissions.
                </motion.p>
              </motion.div>
            </div>
          </section>
        </motion.div>
      </div>

      <div className="relative z-10">
        <WorkspaceFooter />
      </div>
    </main>
  );
}