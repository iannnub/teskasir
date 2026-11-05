import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  themeColor: '#f8f6f2',
  width: 'device-width',
  initialScale: 1
};

export const metadata: Metadata = {
  metadataBase: new URL('https://kollabora-cafe.vercel.app'),
  title: 'KOLLABORA - The Best Thematic Cafe & Restaurant in Indonesia',
  description: 'Pesan menu kopi espresso, minuman coklat, pasta carbonara, dan camilan nikmat khas Kollabora Cafe di Surabaya.',
  keywords: ['kollabora cafe', 'cafe surabaya', 'kopi surabaya', 'kasir cafe', 'thematic cafe'],
  authors: [{ name: 'Kollabora Cafe' }],
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/icon.png',
  },
  openGraph: {
    title: 'KOLLABORA - The Best Thematic Cafe & Restaurant',
    description: 'Pesan menu kopi espresso, coklat spesial, makanan, dan camilan nikmat khas Kollabora Cafe.',
    url: 'https://kollabora-cafe.vercel.app',
    siteName: 'Kollabora Cafe',
    images: [
      {
        url: '/assets/americano.png',
        width: 800,
        height: 600,
        alt: 'Kollabora Cafe Menu'
      }
    ],
    locale: 'id_ID',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KOLLABORA - The Best Thematic Cafe & Restaurant',
    description: 'Pesan menu kopi espresso, coklat spesial, makanan, dan camilan nikmat khas Kollabora Cafe.',
    images: ['/assets/americano.png']
  }
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'CafeOrRestaurant',
  name: 'Kollabora Cafe',
  image: '/assets/americano.png',
  description: 'The Best Thematic Cafe & Restaurant in Indonesia',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Jl. Raya Kupang Indah No.51, Sonokwijenan, Kec. Sukomanunggal',
    addressLocality: 'Surabaya',
    addressRegion: 'Jawa Timur',
    postalCode: '60225',
    addressCountry: 'ID'
  },
  telephone: '+6281234567890',
  servesCuisine: ['Coffee', 'Cafe', 'Pasta', 'Snacks'],
  priceRange: 'Rp 18.000 - Rp 35.000'
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-screen bg-[#f8f6f2] text-stone-900 antialiased selection:bg-[#d4af37] selection:text-black">
        {children}
      </body>
    </html>
  );
}
