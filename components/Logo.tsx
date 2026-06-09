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
  const logoSrc = tone === "dark" ? "/logo-dark.svg" : "/logo-light.svg";
  const logoAspectRatio = 835 / 260;

  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <span
        className="relative shrink-0"
        style={{
          height: markSize,
          width: iconOnly ? markSize : markSize * logoAspectRatio,
        }}
      >
        <Image
          alt="INConnect"
          className="h-full w-full"
          height={markSize}
          priority
          src={iconOnly ? "/logo-icon.svg" : logoSrc}
          width={iconOnly ? markSize : Math.round(markSize * logoAspectRatio)}
        />
      </span>
      {!iconOnly && (
        <span className="sr-only">
          INConnect
          {showSubtitle ? " - Professional Intelligence Platform" : ""}
        </span>
      )}
    </span>
  );
}
