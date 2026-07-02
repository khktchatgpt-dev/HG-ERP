import { StatCardSkeleton, TableSkeleton } from '@/components/ui/Skeleton'

/** Default loading state for any /(app)/* route while data is fetching. */
export default function AppLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
        <TableSkeleton rows={6} />
      </div>
    </div>
  )
}
