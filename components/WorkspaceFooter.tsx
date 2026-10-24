import Link from "next/link";

export default function WorkspaceFooter() {
  return (
    <footer className="mt-auto border-t border-white/[0.08] bg-[#08111f]">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-6 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Link href="/" className="font-semibold tracking-wide text-slate-300">
          Experience<span className="text-[#69e2bd]">Engine</span>
          <span className="ml-2 font-normal text-slate-500">© 2026</span>
        </Link>
        <p className="leading-5 text-slate-500">
          Human expertise. Intelligent practice. Measurable growth.
        </p>
      </div>
    </footer>
  );
}
