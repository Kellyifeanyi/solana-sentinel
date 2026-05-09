import { Skeleton } from "@/components/ui/skeleton";

export default function WalletLoading() {
  return (
    <main className="sentinel-shell min-h-screen">
      <div className="relative mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-center lg:justify-between">
          <Skeleton className="h-12 w-72" />
          <Skeleton className="h-10 w-full lg:w-[430px]" />
        </div>
        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </section>
        <section className="mt-4 grid gap-4 lg:grid-cols-[380px_1fr]">
          <Skeleton className="h-[430px]" />
          <Skeleton className="h-[430px]" />
        </section>
        <section className="mt-4 grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-[520px] lg:col-span-2" />
          <div className="space-y-4">
            <Skeleton className="h-64" />
            <Skeleton className="h-56" />
          </div>
        </section>
      </div>
    </main>
  );
}
