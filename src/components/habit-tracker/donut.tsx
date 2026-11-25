"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface DonutProps {
  /** 0..1 completion ratio */
  value: number;
  color: string;
  size?: number;
  thickness?: number;
  /** optional center label */
  centerLabel?: string;
}

export function Donut({ value, color, size = 120, thickness = 14, centerLabel }: DonutProps) {
  const v = Math.max(0, Math.min(1, value));
  const data = [
    { name: "done", value: v },
    { name: "rest", value: Math.max(0.0001, 1 - v) },
  ];
  return (
    <div
      style={{ width: size, height: size, position: "relative" }}
      className="flex items-center justify-center"
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={size / 2 - thickness}
            outerRadius={size / 2}
            startAngle={90}
            endAngle={-270}
            stroke="none"
            paddingAngle={0}
            cornerRadius={thickness / 2}
          >
            <Cell fill={color} />
            <Cell fill="var(--muted)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {centerLabel !== undefined && (
        <div
          className="absolute inset-0 flex items-center justify-center font-semibold"
          style={{ fontSize: size * 0.16 }}
        >
          {centerLabel}
        </div>
      )}
    </div>
  );
}
