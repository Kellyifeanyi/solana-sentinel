import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="sentinel-shell min-h-screen">
      <div className="relative mx-auto max-w-7xl px-6 py-8">
        <div className="flex items-center justify-between">
          <Skeleton className="h-11 w-56" />
          <Skeleton className="h-10 w-28" />
        </div>
        <div className="mx-auto mt-28 max-w-5xl text-center">
          <Skeleton className="mx-auto h-10 w-80 rounded-full" />
          <Skeleton className="mx-auto mt-8 h-20 max-w-4xl" />
          <Skeleton className="mx-auto mt-6 h-8 max-w-2xl" />
          <Skeleton className="mx-auto mt-10 h-14 max-w-2xl" />
        </div>
      </div>
    </main>
  );
}
