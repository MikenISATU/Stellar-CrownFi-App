export function PredictionTestnetNotice() {
  return (
    <section
      aria-label="Free Stellar Testnet notice"
      className="overflow-hidden rounded-2xl border-2 border-[#b98d20] bg-gradient-to-r from-[#2f1d0e] via-[#5b3919] to-[#2f1d0e] px-4 py-4 text-[#fff7df] shadow-[0_18px_40px_-28px_rgba(59,37,18,0.95)] sm:px-6"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-5">
        <span className="w-fit rounded-full bg-[#f1cf5b] px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-[#30200f]">
          Free · Stellar Testnet
        </span>
        <div>
          <div className="text-lg font-semibold tracking-tight text-white">No real money is required.</div>
          <p className="mt-0.5 text-xs leading-relaxed text-[#f2dfae] sm:text-sm">
            Try predictions with free test USDC. Test tokens and testnet balances have no real-world value.
          </p>
        </div>
      </div>
    </section>
  );
}
