/**
 * ImmersiveComponents.tsx
 *
 * Auto-switching wrapper exports.
 * Every component auto-picks the correct theme variant based on the active theme.
 *
 * Usage in any screen:
 *   import { ImmersiveBalanceCard, ImmersiveTicker, ImmersiveDivider,
 *            ImmersiveSectionHeader, ImmersiveButton, ImmersiveCurrencyDisplay,
 *            ImmersiveExpenseRow } from "../../src/components/immersive/ImmersiveComponents";
 *
 *   Then wrap with isImmersive check:
 *   {isImmersive
 *     ? <ImmersiveBalanceCard name={b.name} net={b.net} ... />
 *     : <YourExistingComponent ... />
 *   }
 */

import React from "react";
import { useTheme } from "../../lib/theme";

// Western imports
import {
  WesternTicker, WesternBalanceCard, WesternExpenseRow,
  WesternSectionHeader, WesternDivider, WesternButton, WesternCurrencyDisplay,
} from "./WesternTheme";

// Festival imports
import {
  FestivalTicker, FestivalBalanceCard, FestivalExpenseRow,
  FestivalSectionHeader, FestivalDivider, FestivalButton, FestivalCurrencyDisplay,
} from "./FestivalTheme";

// Zen imports
import {
  ZenTicker, ZenBalanceCard, ZenExpenseRow,
  ZenSectionHeader, ZenDivider, ZenButton, ZenCurrencyDisplay,
} from "./ZenTheme";

// Roman imports
import {
  RomanTicker, RomanBalanceCard, RomanExpenseRow,
  RomanSectionHeader, RomanDivider, RomanButton, RomanCurrencyDisplay,
} from "./RomanTheme";

// ── Shared prop types ──────────────────────────────────────────────────────────

export type BalanceCardProps = {
  name: string;
  paid: number;
  share: number;
  net: number;
  currency: string;
};

export type ExpenseRowProps = {
  name: string;
  paidBy: string;
  date: string;
  amount: number;
  currency: string;
  emoji?: string;
};

export type TickerProps = {
  value: number;
  currency?: string;
  size?: "balance" | "card" | "small";
};

export type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
};

export type CurrencyDisplayProps = {
  value: number;
  currency: string;
  label?: string;
};

// ── Hook: get active theme id safely ─────────────────────────────────────────
function useThemeId() {
  const { currencyTheme, isImmersive } = useTheme();
  if (!isImmersive || !currencyTheme) return null;
  return currencyTheme.meta.id;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-SWITCHING COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Balance Card ──────────────────────────────────────────────────────────────
export function ImmersiveBalanceCard(props: BalanceCardProps) {
  const id = useThemeId();
  switch (id) {
    case "westernLedger":  return <WesternBalanceCard  {...props} />;
    case "festivalLedger": return <FestivalBalanceCard {...props} />;
    case "zenInk":         return <ZenBalanceCard      {...props} />;
    case "romanTreasury":  return <RomanBalanceCard    {...props} />;
    default:               return null;
  }
}

// ── Number Ticker ─────────────────────────────────────────────────────────────
export function ImmersiveTicker(props: TickerProps) {
  const id = useThemeId();
  switch (id) {
    case "westernLedger":  return <WesternTicker  {...props} />;
    case "festivalLedger": return <FestivalTicker {...props} />;
    case "zenInk":         return <ZenTicker      {...props} />;
    case "romanTreasury":  return <RomanTicker    {...props} />;
    default:               return null;
  }
}

// ── Expense Row ───────────────────────────────────────────────────────────────
export function ImmersiveExpenseRow(props: ExpenseRowProps) {
  const id = useThemeId();
  switch (id) {
    case "westernLedger":  return <WesternExpenseRow  {...props} />;
    case "festivalLedger": return <FestivalExpenseRow {...props} />;
    case "zenInk":         return <ZenExpenseRow      {...props} />;
    case "romanTreasury":  return <RomanExpenseRow    {...props} />;
    default:               return null;
  }
}

// ── Section Header ────────────────────────────────────────────────────────────
export function ImmersiveSectionHeader({ title }: { title: string }) {
  const id = useThemeId();
  switch (id) {
    case "westernLedger":  return <WesternSectionHeader  title={title} />;
    case "festivalLedger": return <FestivalSectionHeader title={title} />;
    case "zenInk":         return <ZenSectionHeader      title={title} />;
    case "romanTreasury":  return <RomanSectionHeader    title={title} />;
    default:               return null;
  }
}

// ── Divider ───────────────────────────────────────────────────────────────────
export function ImmersiveDivider({ style }: { style?: any }) {
  const id = useThemeId();
  switch (id) {
    case "westernLedger":  return <WesternDivider  style={style} />;
    case "festivalLedger": return <FestivalDivider style={style} />;
    case "zenInk":         return <ZenDivider      style={style} />;
    case "romanTreasury":  return <RomanDivider    style={style} />;
    default:               return null;
  }
}

// ── Button ────────────────────────────────────────────────────────────────────
export function ImmersiveButton(props: ButtonProps) {
  const id = useThemeId();
  switch (id) {
    case "westernLedger":  return <WesternButton  {...props} />;
    case "festivalLedger": return <FestivalButton {...props} />;
    case "zenInk":         return <ZenButton      {...props} />;
    case "romanTreasury":  return <RomanButton    {...props} />;
    default:               return null;
  }
}

// ── Currency / Balance Display (hero) ─────────────────────────────────────────
export function ImmersiveCurrencyDisplay(props: CurrencyDisplayProps) {
  const id = useThemeId();
  switch (id) {
    case "westernLedger":  return <WesternCurrencyDisplay  {...props} />;
    case "festivalLedger": return <FestivalCurrencyDisplay {...props} />;
    case "zenInk":         return <ZenCurrencyDisplay      {...props} />;
    case "romanTreasury":  return <RomanCurrencyDisplay    {...props} />;
    default:               return null;
  }
}

// Re-export individual theme components for advanced usage
export {
  WesternTicker, WesternBalanceCard, WesternExpenseRow, WesternSectionHeader, WesternDivider, WesternButton, WesternCurrencyDisplay,
  FestivalTicker, FestivalBalanceCard, FestivalExpenseRow, FestivalSectionHeader, FestivalDivider, FestivalButton, FestivalCurrencyDisplay,
  ZenTicker, ZenBalanceCard, ZenExpenseRow, ZenSectionHeader, ZenDivider, ZenButton, ZenCurrencyDisplay,
  RomanTicker, RomanBalanceCard, RomanExpenseRow, RomanSectionHeader, RomanDivider, RomanButton, RomanCurrencyDisplay,
};
