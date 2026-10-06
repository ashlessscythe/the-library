export function Footer() {
  return (
    <footer className="mt-auto border-t border-[var(--line)]">
      <div className="mx-auto w-full max-w-[96rem] px-4 py-6 font-mono text-xs text-[var(--dim)] sm:px-6 lg:px-8">
        The Library — GPL-3.0. Mathematics adapted from{" "}
        <a
          href="https://github.com/tdjsnelling/babel"
          className="text-[var(--muted)]"
          target="_blank"
          rel="noreferrer"
        >
          tdjsnelling/babel
        </a>
        .
      </div>
    </footer>
  );
}
