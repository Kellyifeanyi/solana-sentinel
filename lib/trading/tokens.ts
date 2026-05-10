export const TRADE_TOKENS = {
  SOL: {
    symbol: "SOL",
    mint: "So11111111111111111111111111111111111111112",
    decimals: 9,
  },
  USDC: {
    symbol: "USDC",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
  },
} as const;

export type TradeTokenSymbol = keyof typeof TRADE_TOKENS;

export function tradeToken(symbol: string) {
  const normalized = symbol.toUpperCase();
  return TRADE_TOKENS[normalized as TradeTokenSymbol] ?? null;
}

export function actionPair(input: TradeTokenSymbol, output: TradeTokenSymbol, amount: number) {
  return {
    inputSymbol: TRADE_TOKENS[input].symbol,
    inputMint: TRADE_TOKENS[input].mint,
    inputDecimals: TRADE_TOKENS[input].decimals,
    outputSymbol: TRADE_TOKENS[output].symbol,
    outputMint: TRADE_TOKENS[output].mint,
    outputDecimals: TRADE_TOKENS[output].decimals,
    amount,
  };
}

export function detectedTokenPair({
  input,
  output,
  outputMint,
  outputDecimals,
  amount,
}: {
  input: TradeTokenSymbol;
  output: string;
  outputMint: string;
  outputDecimals?: number;
  amount: number;
}) {
  return {
    inputSymbol: TRADE_TOKENS[input].symbol,
    inputMint: TRADE_TOKENS[input].mint,
    inputDecimals: TRADE_TOKENS[input].decimals,
    outputSymbol: output.toUpperCase(),
    outputMint,
    outputDecimals: outputDecimals ?? 6,
    amount,
  };
}
