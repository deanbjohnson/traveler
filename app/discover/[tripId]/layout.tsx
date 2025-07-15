"use client"

export default function DiscoverLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="h-full">
      {children}
    </div>
  );
}