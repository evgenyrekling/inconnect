import Image from "next/image";

type LogoProps = {
  className?: string;
  iconOnly?: boolean;
  markSize?: number;
  showSubtitle?: boolean;
  tone?: "light" | "dark";
};

export function Logo({
  className = "",
  iconOnly = false,
  markSize = 40,
  showSubtitle = true,
  tone = "light",
}: LogoProps) {
  const textClass = tone === "dark" ? "text-white" : "text-[#191919]";
  const subtitleClass = tone === "dark" ? "text-white/70" : "text-[#666666]";
  const logoSrc = tone === "dark" ? "/logo-dark.svg" : "/logo-light.svg";

  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <span
        className="relative shrink-0"
        style={{ height: markSize, width: iconOnly ? markSize : markSize * 3.95 }}
      >
        <Image
          alt="INConnect"
          className="h-full w-full"
          height={markSize}
          priority
          src={iconOnly ? "/logo-icon.svg" : logoSrc}
          width={iconOnly ? markSize : Math.round(markSize * 3.95)}
        />
      </span>
      {!iconOnly && (
        <span className="sr-only leading-none">
          <span className={`block text-lg font-semibold tracking-normal ${textClass}`}>
            INConnect
          </span>
          {showSubtitle && (
            <span className={`mt-1 block text-xs font-medium ${subtitleClass}`}>
              Your AI LinkedIn Growth Assistant
            </span>
          )}
        </span>
      )}
    </span>
  );
}
