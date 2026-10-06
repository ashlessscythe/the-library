export function About() {
  return (
    <article className="space-y-8">
      <div className="space-y-4">
        <h1 className="font-[family-name:var(--font-display)] text-5xl">About</h1>
        <img
          src="/art/about-hexagon.jpg"
          alt="Charcoal hexagonal chamber"
          className="charcoal-art charcoal-art--banner"
        />
      </div>

      <div className="space-y-4 font-serif text-lg leading-relaxed text-[var(--muted)]">
        <p>
          In Jorge Luis Borges’ story, the universe is a library of hexagonal
          galleries. Each wall holds five shelves of thirty-two books; each book
          has four hundred and ten pages of forty lines of eighty characters.
        </p>
        <p>
          This site is an explorable recreation of that idea. Books are never
          stored — each page is computed from its coordinate through a
          reversible mapping. Finding your sentence means a volume containing it
          exists at that address; the surrounding pages are almost always noise.
        </p>
        <p>
          Travel the lattice with the trackball or WASD: walls, shelves, and
          books step along real coordinates. Arrow keys turn pages.
        </p>
        <p className="font-mono text-sm text-[var(--dim)]">
          The Library is free software under GPL-3.0. Its mathematics are adapted
          from{" "}
          <a href="https://github.com/tdjsnelling/babel">tdjsnelling/babel</a> by
          Tom Snelling. Product design, interface, and prose are new.
        </p>
      </div>
    </article>
  );
}
