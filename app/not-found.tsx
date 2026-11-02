import Link from 'next/link';

export default function NotFound() {
  return (
    <main style={{ color: '#eee', font: '600 18px Rubik, system-ui', padding: 40 }}>
      <h1 style={{ font: '400 48px "Lilita One", system-ui', color: '#ffb02e' }}>Lost in the slag</h1>
      <p>
        That lobby code doesn&apos;t look right.{' '}
        <Link href="/" style={{ color: '#ffb46a' }}>
          Start a new lobby
        </Link>
        .
      </p>
    </main>
  );
}
