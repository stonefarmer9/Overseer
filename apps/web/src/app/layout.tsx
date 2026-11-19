import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { connection } from 'next/server';
import { listCampaigns } from '@/entities/campaign/server';
import { AppShell } from '@/widgets/app-shell';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Warmaster',
  description: 'Warmaster web application',
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  await connection();
  const campaigns = await listCampaigns();

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <AppShell campaigns={campaigns}>{children}</AppShell>
      </body>
    </html>
  );
}
