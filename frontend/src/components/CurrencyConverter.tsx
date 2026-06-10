import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useTheme } from "../lib/theme";
import { getExchangeRates, POPULAR_CURRENCIES } from "../lib/externalApis";

export function CurrencyRateCard({ base = "INR" }: { base?: string }) {
  const { c, isDark } = useTheme();
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState("");

  useEffect(() => {
    getExchangeRates(base).then(r => {
      setRates(r);
      setLastUpdated(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
      setLoading(false);
    });
  }, [base]);

  const displayCurrencies = POPULAR_CURRENCIES.filter(c => c.code !== base).slice(0, 5);

  return (
    <View style={{ backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF", borderRadius: 18, overflow: "hidden", borderWidth: 0.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
      <View style={{ padding: 14, borderBottomWidth: 0.5, borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 13, fontWeight: "500", color: c.textPrimary }}>Live exchange rates</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#00C48C" }} />
          <Text style={{ fontSize: 11, color: c.textSecondary }}>Updated {lastUpdated}</Text>
        </View>
      </View>
      {loading ? (
        <View style={{ padding: 20, alignItems: "center" }}>
          <ActivityIndicator size="small" color="#6D5DFC" />
        </View>
      ) : (
        displayCurrencies.map((cur, i) => (
          <View key={cur.code} style={{ flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: i < displayCurrencies.length - 1 ? 0.5 : 0, borderBottomColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}>
            <Text style={{ fontSize: 18, marginRight: 10 }}>{cur.flag}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: "500", color: c.textPrimary }}>{cur.code}</Text>
              <Text style={{ fontSize: 11, color: c.textSecondary }}>{cur.name}</Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: "500", color: c.textPrimary }}>
              {cur.symbol}{(rates[cur.code] || 0).toFixed(4)}
            </Text>
          </View>
        ))
      )}
      <View style={{ padding: 10, alignItems: "center" }}>
        <Text style={{ fontSize: 10, color: c.textMuted }}>Powered by Frankfurter · European Central Bank data</Text>
      </View>
    </View>
  );
}
