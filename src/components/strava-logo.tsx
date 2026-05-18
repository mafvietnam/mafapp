/** Official Strava chevron logo. Use #FC4C02 brand color where appropriate. */
export function StravaLogo({ className = 'w-5 h-5', color = '#FC4C02' }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={color} aria-label="Strava">
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
    </svg>
  );
}

/** "Powered by Strava" attribution badge for use under any UI showing Strava-sourced data. */
export function PoweredByStrava({ className = '' }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <StravaLogo className="w-3.5 h-3.5" />
      <span className="text-white/50 text-[11px] font-medium tracking-wide uppercase">
        Powered by Strava
      </span>
    </div>
  );
}
