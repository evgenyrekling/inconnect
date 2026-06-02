import Link from "next/link";
import { Logo } from "@/components/Logo";

type BusinessPageSection = {
  title: string;
  body: string[];
};

type BusinessPageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  sections: BusinessPageSection[];
};

const footerLinks = [
  { label: "About", href: "/about" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Contact", href: "/contact" },
];

const primaryCtaClass =
  "rounded-lg bg-[#4A6FD0] px-4 py-2 text-sm font-semibold text-[#FFFFFF] transition-colors duration-200 ease-[ease] hover:bg-[#3859B8]";

export function BusinessPage({ eyebrow, intro, sections, title }: BusinessPageProps) {
  return (
    <main className="min-h-screen bg-[#F3F2EF] text-[#191919]">
      <header className="border-b border-[#D9DDE3] bg-white px-5 py-4 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <Link href="/" aria-label="INConnect home">
            <Logo markSize={42} />
          </Link>
          <Link
            className={primaryCtaClass}
            href="/"
          >
            Back to Assessment
          </Link>
        </div>
      </header>

      <section className="px-5 py-10 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#0A66C2]">
            {eyebrow}
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight text-[#191919] sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#666666]">
            {intro}
          </p>

          <div className="mt-8 grid gap-4">
            {sections.map((section) => (
              <section
                className="rounded-lg border border-[#D9DDE3] bg-white p-5 shadow-[0_8px_24px_rgba(10,25,47,0.06)] sm:p-7"
                key={section.title}
              >
                <h2 className="text-xl font-semibold text-[#191919]">
                  {section.title}
                </h2>
                <div className="mt-4 grid gap-3 text-sm leading-6 text-[#666666]">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-[#D9DDE3] bg-white px-5 py-8 text-[#666666] sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-[#191919]">© INConnect</p>
            <p className="mt-1 text-sm">Profile Intelligence Platform</p>
          </div>
          <nav className="flex flex-wrap gap-4 text-sm font-semibold">
            {footerLinks.map((link) => (
              <Link className="hover:text-[#0A66C2]" href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </main>
  );
}
