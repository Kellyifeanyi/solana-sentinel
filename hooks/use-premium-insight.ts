"use client";

import { useState } from "react";

export function usePremiumInsight(wallet: string) {
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [requiresPayment, setRequiresPayment] = useState(false);

  async function unlock() {
    setLoading(true);
    try {
      const probe = await fetch(`/api/premium-insight/${encodeURIComponent(wallet)}`);
      if (probe.status === 402) {
        setRequiresPayment(true);
      }
      const paid = await fetch(`/api/premium-insight/${encodeURIComponent(wallet)}?paid=true`);
      const payload = (await paid.json()) as { insight?: string };
      setInsight(payload.insight ?? "Insufficient chain evidence for premium intelligence.");
    } finally {
      setLoading(false);
    }
  }

  return { loading, insight, requiresPayment, unlock };
}
