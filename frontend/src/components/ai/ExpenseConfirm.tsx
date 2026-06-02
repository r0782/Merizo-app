import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "../../lib/theme";

export function ExpenseConfirmCard({ expense, onConfirm, onDismiss }: {
  expense: any; onConfirm: () => void; onDismiss: () => void;
}) {
  const { c, isDark } = useTheme();
  return (
    <View style={{
      margin: 12, padding: 16, backgroundColor: c.surface,
      borderRadius: 16, borderWidth: 1, borderColor: c.border,
    }}>
      <Text style={{ color: c.textPrimary, fontWeight: "700", fontSize: 15, marginBottom: 8 }}>Confirm Expense</Text>
      <Text style={{ color: c.textSecondary, fontSize: 13, marginBottom: 4 }}>{expense.title} — ₹{expense.amount}</Text>
      <Text style={{ color: c.textMuted, fontSize: 12, marginBottom: 12 }}>Paid by {expense.paid_by} · Split {expense.split_type}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <TouchableOpacity onPress={onConfirm} style={{ flex: 1, backgroundColor: isDark ? c.indigo : "#0A0A0A", borderRadius: 10, padding: 12, alignItems: "center" }}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>Add Expense</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDismiss} style={{ flex: 1, backgroundColor: c.surface, borderRadius: 10, padding: 12, alignItems: "center", borderWidth: 1, borderColor: c.border }}>
          <Text style={{ color: c.textPrimary, fontWeight: "600" }}>Dismiss</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
