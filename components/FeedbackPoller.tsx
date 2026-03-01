"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Polls for feedback by triggering a server re-fetch every 2 seconds.
// Unmounts automatically once the parent re-renders with real feedback data.
const FeedbackPoller = () => {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, 2000);

    return () => clearInterval(interval);
  }, [router]);

  return null;
};

export default FeedbackPoller;
