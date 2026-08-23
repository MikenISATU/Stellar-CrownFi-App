import Link from "next/link";

// Branded 404 — keeps lost visitors inside the experience instead of a bare error page.
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo.png" alt="CrownFi" className="h-14 w-14 object-contain opacity-80" />
      <div className="mt-5 font-display text-6xl font-semibold text-[#c8a233]">404</div>
      <h1 className="mt-2 tracking-tight text-2xl font-semibold text-[#23252f]">This page didn’t make the <span className="font-display italic text-[#c8a233]">cut</span></h1>
      <p className="mt-2 text-sm text-[#5f6172]">The page you’re looking for doesn’t exist or has moved.</p>
      <div className="mt-6 flex gap-3">
        <Link href="/" className="btn-gold">Back to home</Link>
        <Link href="/vote" className="btn-ghost">Cast a vote</Link>
      </div>
    </div>
  );
}
