"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, X, User as UserIcon, Calendar, FileText } from "lucide-react";
import { AppNotification, subscribeToNotifications, markNotificationAsRead, markAllNotificationsAsRead, getUnreadNotificationsCount } from "@/lib/notifications";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "./ToastProvider";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export function NotificationDropdown() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const lastSeenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToNotifications(user.uid, (newNotifs) => {
      // Check for strictly new unread notifications to show toast
      const latest = newNotifs[0];
      if (latest && !latest.read && latest.id !== lastSeenRef.current) {
        // Avoid showing toast on initial load if we can, but usually fine
        if (lastSeenRef.current !== null) {
          addToast(latest.message, "notification", latest.title);
        }
        lastSeenRef.current = latest.id;
      }
      setNotifications(newNotifs);
    }, 25);
    return () => unsub();
  }, [user, addToast]);

  useEffect(() => {
    if (!user) return;
    getUnreadNotificationsCount(user.uid).then(setUnreadCount).catch(console.error);
  }, [user, notifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleMarkAllRead = async () => {
    if (!user || unreadCount === 0) return;
    await markAllNotificationsAsRead(user.uid, notifications);
  };

  const handleNotificationClick = async (n: AppNotification) => {
    if (!n.read) {
      await markNotificationAsRead(n.id);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`relative rounded-xl p-2.5 transition-all ${isOpen ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'}`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 border border-white dark:border-slate-950"></span>
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden z-50 transform origin-top-right transition-all">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              Notifications
              {unreadCount > 0 && (
                <span className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 text-xs font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button 
                  onClick={handleMarkAllRead}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
                >
                  Mark all read
                </button>
              )}
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 sm:hidden">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                  <Bell className="h-6 w-6 text-slate-300 dark:text-slate-600" />
                </div>
                <p className="font-medium text-sm">No notifications yet</p>
                <p className="text-xs mt-1 opacity-70">When you receive updates, they&apos;ll appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {notifications.map((notif: AppNotification) => (
                  <div key={notif.id} className={`group p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${!notif.read ? 'bg-indigo-50/30 dark:bg-indigo-900/10' : ''}`}>
                    <div className="flex gap-3">
                      <div className="mt-0.5 relative shrink-0">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center border ${
                          notif.type === "task" ? "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-800" :
                          notif.type === "attendance" ? "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-800" :
                          "bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-900/50 dark:text-slate-400 dark:border-slate-800"
                        }`}>
                          {notif.type === "task" ? <FileText className="h-5 w-5" /> :
                           notif.type === "attendance" ? <Calendar className="h-5 w-5" /> :
                           <Bell className="h-5 w-5" />}
                        </div>
                        {!notif.read && (
                          <div className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-900 shadow-sm" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <Wrapper link={notif.link} onClick={() => handleNotificationClick(notif)}>
                          <div className="flex items-center justify-between gap-2">
                             <p className={`text-sm tracking-tight truncate ${!notif.read ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
                              {notif.title}
                            </p>
                            <p className="text-[10px] font-medium text-slate-400 shrink-0">
                              {notif.createdAt && notif.createdAt.toDate ? formatDistanceToNow(notif.createdAt.toDate(), { addSuffix: true }) : "Just now"}
                            </p>
                          </div>
                          
                          {notif.fromUserName && (
                            <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                              <UserIcon className="h-2.5 w-2.5" />
                              {notif.fromUserName}
                            </p>
                          )}
                          
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                            {notif.message}
                          </p>
                        </Wrapper>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const Wrapper = ({ link, onClick, children }: { link?: string, onClick: () => void, children: React.ReactNode }) => {
  if (link) {
    return (
      <Link href={link} onClick={onClick} className="block w-full text-left">
        {children}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className="block w-full text-left">
      {children}
    </button>
  );
};   
