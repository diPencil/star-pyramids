import Link from 'next/link'
export default function NotFound(){return <main className="not-found"><div className="not-found-mark">404</div><h1>Page not found</h1><p>The journey you were looking for has taken a different route.</p><Link href="/" className="primary-btn">Back home</Link></main>}
