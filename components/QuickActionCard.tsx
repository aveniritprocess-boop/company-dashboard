"use client";

import Link from "next/link";
import { LucideIcon } from "lucide-react";

type ColorTheme = "blue" | "green" | "orange" | "purple" | "gray";

interface QuickActionCardProps {
    name: string;
    href: string;
    icon: LucideIcon;
    theme: ColorTheme;
    description?: string;
}

const themeMap: Record<
    ColorTheme,
    { bg: string; iconBg: string; iconColor: string; border: string }
> = {
    blue: {
        bg: "hover:bg-blue-50 dark:hover:bg-blue-900/10",
        iconBg: "bg-blue-100 dark:bg-blue-900/30",
        iconColor: "text-blue-600 dark:text-blue-400",
        border: "border-blue-100 dark:border-blue-500/20",
    },
    green: {
        bg: "hover:bg-emerald-50 dark:hover:bg-emerald-900/10",
        iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
        iconColor: "text-emerald-600 dark:text-emerald-400",
        border: "border-emerald-100 dark:border-emerald-500/20",
    },
    orange: {
        bg: "hover:bg-orange-50 dark:hover:bg-orange-900/10",
        iconBg: "bg-orange-100 dark:bg-orange-900/30",
        iconColor: "text-orange-600 dark:text-orange-400",
        border: "border-orange-100 dark:border-orange-500/20",
    },
    purple: {
        bg: "hover:bg-purple-50 dark:hover:bg-purple-900/10",
        iconBg: "bg-purple-100 dark:bg-purple-900/30",
        iconColor: "text-purple-600 dark:text-purple-400",
        border: "border-purple-100 dark:border-purple-500/20",
    },
    gray: {
        bg: "hover:bg-gray-50 dark:hover:bg-gray-800/40",
        iconBg: "bg-gray-100 dark:bg-gray-800",
        iconColor: "text-gray-600 dark:text-gray-400",
        border: "border-gray-100 dark:border-gray-700",
    },
};

export function QuickActionCard({
    name,
    href,
    icon: Icon,
    theme,
    description,
}: QuickActionCardProps) {
    const t = themeMap[theme];

    return (
        <Link
            href={href}
            className={`
        group flex flex-col items-center justify-center gap-3 p-5
        rounded-2xl border ${t.border} ${t.bg}
        bg-white dark:bg-gray-900
        transition-all duration-200
        hover:shadow-lg hover:scale-[1.04] hover:-translate-y-0.5
        cursor-pointer
      `}
        >
            <div
                className={`p-3 rounded-2xl ${t.iconBg} group-hover:scale-110 transition-transform duration-200`}
            >
                <Icon className={`h-6 w-6 ${t.iconColor}`} />
            </div>
            <div className="text-center">
                <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 block">
                    {name}
                </span>
                {description && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 block">
                        {description}
                    </span>
                )}
            </div>
        </Link>
    );
}
