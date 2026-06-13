"use client";

import { useState, useRef } from "react";
import { AppUserSummary } from "@/lib/users";

interface MentionTextareaProps {
    value: string;
    onChange: (value: string) => void;
    users: AppUserSummary[];
    placeholder?: string;
    className?: string;
    rows?: number;
}

export function MentionTextarea({
    value,
    onChange,
    users,
    placeholder = "",
    className = "",
    rows = 3
}: MentionTextareaProps) {
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [cursorPos, setCursorPos] = useState<number>(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        onChange(val);

        const selectionStart = e.target.selectionStart;
        setCursorPos(selectionStart);

        // Find the word currently being typed
        const textBeforeCursor = val.slice(0, selectionStart);
        const match = textBeforeCursor.match(/(?:\s|^)@(\w*)$/);

        if (match) {
            setMentionQuery(match[1].toLowerCase());
        } else {
            setMentionQuery(null);
        }
    };

    const handleSelectUser = (user: AppUserSummary) => {
        if (mentionQuery === null || !textareaRef.current) return;

        const textBeforeCursor = value.slice(0, cursorPos);
        const textAfterCursor = value.slice(cursorPos);
        
        // Find where the @ starts
        const lastAtPos = textBeforeCursor.lastIndexOf('@');
        
        const newName = user.name ? user.name.replace(/\s+/g, '') : (user.email ?? "").split('@')[0];
        const newTextBefore = textBeforeCursor.slice(0, lastAtPos) + `@${newName} `;
        
        onChange(newTextBefore + textAfterCursor);
        setMentionQuery(null);
        
        // Focus back
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.selectionStart = newTextBefore.length;
                textareaRef.current.selectionEnd = newTextBefore.length;
            }
        }, 0);
    };

    const filteredUsers = mentionQuery !== null 
        ? users.filter(u => 
            (u.name && u.name.toLowerCase().includes(mentionQuery)) || 
            (u.email && u.email.toLowerCase().includes(mentionQuery))
          )
        : [];

    return (
        <div className="relative w-full">
            <textarea
                ref={textareaRef}
                value={value}
                onChange={handleChange}
                rows={rows}
                placeholder={placeholder}
                className={`w-full resize-none ${className}`}
            />
            {mentionQuery !== null && filteredUsers.length > 0 && (
                <div className="absolute z-50 mt-1 w-64 max-h-48 overflow-y-auto bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700">
                    <ul className="py-1">
                        {filteredUsers.map(user => (
                            <li key={user.uid}>
                                <button
                                    type="button"
                                    onClick={() => handleSelectUser(user)}
                                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                >
                                    {user.name || user.email}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

// Utility to extract mentioned user IDs before saving
export function extractMentionedUsers(text: string, users: AppUserSummary[]): string[] {
    const mentionedIds = new Set<string>();
    
    users.forEach(user => {
        const checkName = user.name ? user.name.replace(/\s+/g, '') : (user.email ?? "").split('@')[0];
        if (text.includes(`@${checkName}`)) {
            mentionedIds.add(user.uid);
        }
    });
    
    return Array.from(mentionedIds);
}
