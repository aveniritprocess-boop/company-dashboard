"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface GrowthChartProps {
  data: {
    name: string; // Date label
    tasks: number; // Number of tasks
  }[];
}

export function GrowthChart({ data }: GrowthChartProps) {
  if (data.length === 0) {
      return (
          <div className="flex h-[300px] w-full items-center justify-center text-sm text-gray-500">
              No activity data available
          </div>
      );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{
            top: 10,
            right: 30,
            left: 0,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
          <XAxis 
            dataKey="name" 
            stroke="#9CA3AF" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false}
          />
          <YAxis 
            stroke="#9CA3AF" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
            allowDecimals={false}
          />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            cursor={{ stroke: '#6366f1', strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="tasks"
            stroke="#6366f1"
            fillOpacity={1}
            fill="url(#colorTasks)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
