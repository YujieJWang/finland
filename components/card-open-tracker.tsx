"use client";

import { useEffect, useRef } from "react";
import { recordOpen } from "@/app/(private)/cards/actions";

export function CardOpenTracker({ cardId }: { cardId: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (!sent.current) {
      sent.current = true;
      void recordOpen(cardId);
    }
  }, [cardId]);
  return null;
}
