export type SignalAction = {
  id: string;
  title: string;
  reason: string;
  suggestedAction: string;
  tokenPair: {
    inputSymbol: string;
    inputMint: string;
    inputDecimals: number;
    outputSymbol: string;
    outputMint: string;
    outputDecimals: number;
    amount: number;
  };
  supportingSignals: string[];
};

export type SwapQuotePreview = {
  inputAmount: number;
  outputAmount: number;
  priceImpactPct?: number;
  routeLabel: string;
  rawQuote: unknown;
};
