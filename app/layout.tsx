import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Playfair_Display, Fraunces, Varela_Round } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair-display',
  display: 'swap',
  weight: ['500', '600', '700'],
})

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  weight: ['300'],
  style: ['normal', 'italic'],
})

const varelaRound = Varela_Round({
  subsets: ['latin'],
  variable: '--font-varela-round',
  display: 'swap',
  weight: '400',
})

export const metadata: Metadata = {
  title: 'Sumear — Assistant Shopping Intelligent',
  description: 'Comparez vos produits e-commerce avec l\'IA.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${plusJakartaSans.variable} ${playfairDisplay.variable} ${fraunces.variable} ${varelaRound.variable}`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var k='sumear-theme';var t=localStorage.getItem(k);if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);if(t==='dark')document.documentElement.classList.add('dark');else document.documentElement.classList.remove('dark');}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`,
          }}
        />
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}