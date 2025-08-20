import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import {
  ClerkProvider,
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
} from "@clerk/nextjs";
import ClientUserButton from "../components/ClientUserButton";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Travelers - Your AI Travel Assistant",
  description: "Plan your next adventure with AI-powered travel recommendations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="flex h-14 items-center justify-between px-6">
                <div className="flex">
                  <Link href="/" className="flex items-center space-x-2">
                    <span className="font-bold">Travelers</span>
                  </Link>
                </div>
                <nav className="flex items-center space-x-6">
                  <Link href="/discover">
                    <Button variant="ghost">Discover</Button>
                  </Link>
                  <div className="flex items-center space-x-2">
                    <SignedOut>
                      <SignInButton mode="modal">
                        <Button variant="ghost" size="sm">
                          Sign In
                        </Button>
                      </SignInButton>
                      <SignUpButton mode="modal">
                        <Button variant="default" size="sm">
                          Get Started
                        </Button>
                      </SignUpButton>
                    </SignedOut>
                    <SignedIn>
                      <div suppressHydrationWarning>
                        <ClientUserButton
                          afterSignOutUrl="/"
                          appearance={{
                            elements: { avatarBox: "w-8 h-8" },
                          }}
                        />
                      </div>
                    </SignedIn>
                  </div>
                </nav>
              </div>
            </header>
            <main className="flex-1">{children}</main>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
