import React from "react";

export function CardGridSkeleton({ count = 6 }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-full bg-slate-200 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-200 rounded-md w-3/4" />
              <div className="h-3 bg-slate-100 rounded-md w-1/2" />
            </div>
            <div className="h-5 w-16 bg-slate-100 rounded-full" />
          </div>
          <div className="space-y-2 pt-3 border-t border-slate-100">
            <div className="h-3 bg-slate-100 rounded-md w-full" />
            <div className="h-3 bg-slate-100 rounded-md w-2/3" />
          </div>
          <div className="flex gap-2 mt-4">
            <div className="h-8 bg-slate-100 rounded-xl flex-1" />
            <div className="h-8 bg-slate-100 rounded-xl flex-1" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl border border-[#E2E8F0] p-4 shadow-sm flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-xl bg-slate-200 shrink-0" />
            <div className="space-y-2 flex-1 max-w-xs">
              <div className="h-4 bg-slate-200 rounded-md w-3/4" />
              <div className="h-3 bg-slate-100 rounded-md w-1/2" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-6 w-20 bg-slate-100 rounded-full" />
            <div className="h-8 w-24 bg-slate-200 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MetricsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 border border-[#E2E8F0] shadow-sm flex flex-col items-center">
            <div className="h-3 w-16 bg-slate-100 rounded mb-3" />
            <div className="h-7 w-24 bg-slate-200 rounded-lg mb-2" />
            <div className="h-3 w-14 bg-slate-100 rounded" />
          </div>
        ))}
      </div>
      <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#E2E8F0] shadow-sm">
        <div className="h-5 w-48 bg-slate-200 rounded-md mb-6" />
        <div className="h-52 bg-slate-100 rounded-2xl w-full" />
      </div>
    </div>
  );
}
