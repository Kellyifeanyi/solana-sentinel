import { Skeleton } from "@/components/ui/skeleton";

export default function AlertsLoading() {
  return (
    <main className="sentinel-shell min-h-screen">
      <div className="relative mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-center justify-between border-b border-white/10 pb-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-10 w-28" />
        </div>
        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </section>
        <Skeleton className="mt-4 h-[560px]" />
      </div>
    </main>
  );
}
