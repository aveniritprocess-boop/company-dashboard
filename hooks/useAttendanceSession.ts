"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getActiveSession, AttendanceSession } from "@/lib/attendance";
import { Timestamp } from "firebase/firestore";

export function useAttendanceSession() {
  const { user } = useAuth();
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSession = async () => {
    if (!user) return;
    try {
      const session = await getActiveSession(user.uid);
      setActiveSession(session);
      if (session && session.clockInAt) {
        updateElapsed(session.clockInAt);
      } else {
        setElapsedSeconds(0);
      }
    } catch (err) {
      console.error("Failed to fetch active session", err);
    } finally {
      setLoading(false);
    }
  };

  const updateElapsed = (startTime: Timestamp) => {
    const start = startTime.toDate().getTime();
    const now = new Date().getTime();
    setElapsedSeconds(Math.floor((now - start) / 1000));
  };

  useEffect(() => {
    if (user) {
      fetchSession();
    }
  }, [user]);

  useEffect(() => {
    if (activeSession && activeSession.status === "active") {
      // Start timer
      timerRef.current = setInterval(() => {
        if (activeSession.clockInAt) {
          updateElapsed(activeSession.clockInAt);
        }
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [activeSession]);

  return {
    activeSession,
    elapsedSeconds,
    loading,
    refreshSession: fetchSession
  };
}
