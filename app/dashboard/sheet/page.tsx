"use client";

export default function SharedSheetPage() {
    const SHEET_URL =
        "https://docs.google.com/spreadsheets/d/1ySPmQtjOeMMbkH-df6D-P9_dhxoMtDRudvuRoFhnH5w/edit?usp=sharing&rm=minimal";

    return (
        <div className="flex flex-col h-full w-full">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                        {/* Google Sheets Icon */}
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 48 48"
                            className="h-5 w-5"
                        >
                            <path
                                fill="#43A047"
                                d="M37,45H11c-1.657,0-3-1.343-3-3V6c0-1.657,1.343-3,3-3h19l10,10v29C40,43.657,38.657,45,37,45z"
                            />
                            <path fill="#C8E6C9" d="M40,13H30V3L40,13z" />
                            <path fill="#2E7D32" d="M30,3l10,10h-10V3z" />
                            <path
                                fill="#fff"
                                d="M31,23H17v-2h14V23z M31,27H17v-2h14V27z M31,31H17v-2h14V31z M25,35H17v-2h8V35z"
                            />
                        </svg>
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Shared Google Sheet
                        </h1>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            Live — edits sync instantly in both directions
                        </p>
                    </div>
                </div>

                <a
                    href={SHEET_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 transition-colors"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                    >
                        <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                        <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                    </svg>
                    Open in Google Sheets
                </a>
            </div>

            {/* Embedded Sheet */}
            <div className="flex-1 overflow-hidden">
                <iframe
                    src={SHEET_URL}
                    title="Shared Google Sheet"
                    className="w-full h-full border-0"
                    allow="clipboard-read; clipboard-write"
                />
            </div>
        </div>
    );
}
