import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BriefAI — Assistant Shopping Intelligent',
  description: 'Comparez vos produits e-commerce avec l\'IA.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={inter.className}>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('briefai-theme');if(t==='light')document.documentElement.classList.remove('dark');else document.documentElement.classList.add('dark');})();`,
          }}
        />
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}