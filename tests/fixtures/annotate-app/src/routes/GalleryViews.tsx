import React from "react";

// R2 + R3 regression fixture — real 4B.2 failure shapes (CinePrint gallery).

export function GalleryEmptyState() {
  return (
    <section aria-label="Gallery results">
      <Link
        to="/gallery"
        title="No posters found"
        className="empty-state"
      >
        <p>Plot Twist: No Matches Found!</p>
        <p className="hint">Explore the full collection</p>
        <button>Clear search</button>
      </Link>
    </section>
  );
}

export class BrowseErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error in gallery content:", error, errorInfo);
  }

  render() {
    return (
      <div className="flex w-full min-h-[40vh] flex-col items-center">
        <a className="inline-flex items-center gap-2 rounded-full px-6 py-2.5">
          <RotateCw />
          RETRY PREVIEW
        </a>
      </div>
    );
  }
}
