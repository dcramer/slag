import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="page-plain">
      <h1>Lost in the Slag</h1>
      <p>That lobby code doesn&apos;t look right. Codes are 3–12 letters and numbers.</p>
      <Link href="/" className="btn-link">
        MAIN MENU
      </Link>
    </main>
  );
}
