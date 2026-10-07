import { Moon, Sun } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/useTheme";
import {
  randomGeographyNavRoom,
  type GeographyLocationState,
} from "@/lib/geographyNav";
import { cn } from "@/lib/utils";

const links = [
  { to: "/search", label: "Search" },
  { to: "/explore", label: "Explore" },
  { to: "/geography", label: "Geography" },
  { to: "/random", label: "Random" },
  { to: "/about", label: "About" },
];

export function Nav() {
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  return (
    <header className="border-b border-[var(--line)]">
      <div className="mx-auto flex w-full max-w-[96rem] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="font-mono text-xs uppercase tracking-[0.25em] text-[var(--muted)] no-underline hover:text-[var(--mark)]"
        >
          The Library
        </Link>
        <nav className="flex flex-wrap items-center gap-1 sm:gap-3">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={
                link.to === "/geography"
                  ? (e) => {
                      e.preventDefault();
                      navigate("/geography", {
                        state: {
                          roomKey: randomGeographyNavRoom(),
                        } satisfies GeographyLocationState,
                      });
                    }
                  : undefined
              }
              className={({ isActive }) =>
                cn(
                  "font-mono text-xs uppercase tracking-wider no-underline px-2 py-1",
                  isActive ? "text-[var(--mark)]" : "text-[var(--muted)] hover:text-[var(--fg)]"
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Toggle theme"
            onClick={toggle}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </Button>
        </nav>
      </div>
    </header>
  );
}
