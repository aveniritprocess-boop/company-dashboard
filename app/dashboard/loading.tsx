export default function DashboardLoading() {
  return (
    <div className="flex h-[80vh] w-full items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center space-y-4">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-full border-4 border-gray-200"></div>
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        </div>
        <p className="text-lg font-medium text-gray-600 animate-pulse">Loading dashboard...</p>
      </div>
    </div>
  );
}
