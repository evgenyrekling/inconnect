import Image from "next/image";

type LogoProps = {
  className?: string;
  iconOnly?: boolean;
  markSize?: number;
  showSubtitle?: boolean;
};

export function Logo({
  className = "",
  iconOnly = false,
  markSize = 40,
  showSubtitle = true,
}: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <span
        className="relative shrink-0"
        style={{ height: markSize, width: markSize }}
      >
        <Image
          alt="INConnect"
          className="h-full w-full"
          height={markSize}
          priority
          src="/inconnect-icon.svg"
          width={markSize}
        />
      </span>
      {!iconOnly && (
        <span className="leading-none">
          <span className="block text-lg font-semibold tracking-normal text-white">
            INConnect
          </span>
          {showSubtitle && (
            <span className="mt-1 block text-xs font-medium text-slate-400">
              Visibility intelligence
            </span>
          )}
        </span>
      )}
    </span>
  );
}
