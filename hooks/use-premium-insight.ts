"use client";

import { useState } from "react";

export function usePremiumInsight(wallet: string) {
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [requiresPayment, setRequiresPayment] = useState(false);

  async function requestInsight() {
    setLoading(true);
    try {
      const probe = await fetch(`/api/premium-insight/${encodeURIComponent(wallet)}`);
      if (probe.status === 402) {
        setRequiresPayment(true);
        setInsight(null);
        return;
      }
      const payload = (await probe.json()) as { insight?: string | null };
      setInsight(payload.insight ?? null);
    } finally {
      setLoading(false);
    }
  }

  return { loading, insight, requiresPayment, requestInsight };
}
