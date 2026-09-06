export function PredictionTestnetNotice() {
  return (
    <section
      aria-label="Free Stellar Testnet notice"
      className="overflow-hidden rounded-2xl border-2 border-[#b98d20] bg-gradient-to-r from-[#2f1d0e] via-[#5b3919] to-[#2f1d0e] px-5 py-5 text-[#fff7df] shadow-[0_18px_40px_-28px_rgba(59,37,18,0.95)] sm:px-7 sm:py-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        <span className="w-fit rounded-full bg-[#f1cf5b] px-4 py-1.5 text-sm font-black uppercase tracking-[0.14em] text-[#30200f] sm:text-base">
          Free · Stellar Testnet
        </span>
        <div>
          <div className="text-xl font-semibold tracking-tight text-white sm:text-2xl">No real money is required.</div>
          <p className="mt-1 text-sm leading-relaxed text-[#f2dfae] sm:text-base">
            Try predictions with free test USDC. Test tokens and testnet balances have no real-world value.
          </p>
        </div>
      </div>
    </section>
  );
}
