// R4 regression fixture — the exact shape that seeded feature-artist-2 in
// Phase 4B.2 (CinePrint home-discovery): marketing aria-label + manifesto prose.

export function HomeDiscovery() {
  return (
    <section aria-label="CinePrint manifesto" className="discovery">
      <div className="grid">
        <p aria-label="Explore artists" className="cta">
          <Link to="/artists">Browse the curated wall</Link>
        </p>
        <p className="prose">
          CinePrint is a gallery built on the belief that every film
          deserves a physical interpretation and every artist deserves a
          printed stage.
        </p>
      </div>
    </section>
  );
}
