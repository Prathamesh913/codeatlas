import { Link } from 'react-router';

export function SearchControls() {
  return (
    <div className="flex items-center gap-2">
      <input placeholder="Search projects" className="rounded px-3 py-1" />
      <Button aria-label="Close dialog" className="icon-btn">
        <X />
      </Button>
      <Button>Create Collection</Button>
      <Link to="/saved">Saved Posters</Link>
    </div>
  );
}
