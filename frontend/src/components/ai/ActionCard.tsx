import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useTheme } from "../../lib/theme";
import { currencySymbol } from "../../lib/tokens";

interface ActionCardProps {
  actionType: string;
  data: Record<string, any>;
  onNavigate?: (groupId: string) => void;
}

function Row({ label, value }: { label: string; value: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
      <Text style={{ color: c.textMuted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: c.textSecondary, fontSize: 12, fontWeight: "600", maxWidth: "60%", textAlign: "right" }}>
        {value}
      </Text>
    </View>
  );
}

export function ActionCard({ actionType, data, onNavigate }: ActionCardProps) {
  const { c, isDark } = useTheme();
  const sym = currencySymbol(data.currency);

  const card = (content: React.ReactNode, icon: string, label: string) => (
    <View style={{
      marginTop: 6, backgroundColor: c.surface,
      borderRadius: 14, borderWidth: 1, borderColor: c.border,
      paddingHorizontal: 14, paddingVertical: 12, overflow: "hidden",
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 6 }}>
        <Text style={{ fontSize: 15 }}>{icon}</Text>
        <Text style={{ color: c.textPrimary, fontSize: 13, fontWeight: "700" }}>{label}</Text>
        <View style={{
          marginLeft: "auto", backgroundColor: isDark ? "#1F1F1F" : "#E8F5E9",
          borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2,
        }}>
          <Text style={{ color: "#27AE60", fontSize: 10, fontWeight: "700" }}>DONE</Text>
        </View>
      </View>
      {content}
    </View>
  );

  switch (actionType) {
    case "expense_added":
      return card(
        <>
          <Row label="Amount" value={`${sym}${Number(data.amount || 0).toLocaleString()}`} />
          <Row label="Paid by" value={String(data.paid_by || "")} />
          <Row
            label="Split"
            value={Array.isArray(data.split_among) ? data.split_among.join(", ") : String(data.split_among || "everyone")}
          />
          {data.date && <Row label="Date" value={data.date} />}
          {onNavigate && data.group_id && (
            <TouchableOpacity
              onPress={() => onNavigate(data.group_id)}
              style={{ marginTop: 10, paddingVertical: 7, alignItems: "center",
                borderTopWidth: 1, borderTopColor: c.border }}
            >
              <Text style={{ color: c.textSecondary, fontSize: 12, fontWeight: "600" }}>View in group →</Text>
            </TouchableOpacity>
          )}
        </>,
        "💸", data.title || "Expense"
      );

    case "group_created":
      return card(
        <>
          <Row label="Currency" value={data.currency || "INR"} />
          {data.members_added?.length > 0 && (
            <Row label="Members" value={data.members_added.join(", ")} />
          )}
        </>,
        "👥", data.name || "New Group"
      );

    case "group_renamed":
      return card(
        <Row label="New name" value={data.new_name || ""} />,
        "✏️", "Group Renamed"
      );

    case "member_added":
      return card(
        <Row label="Added to group" value={data.group_id ? "this group" : ""} />,
        "➕", `${data.member_name || "Member"} added`
      );

    case "member_removed":
      return card(
        <Text style={{ color: c.textMuted, fontSize: 12 }}>Member removed from group.</Text>,
        "➖", `${data.member_name || "Member"} removed`
      );

    case "debt_settled":
      return card(
        <>
          <Row label="From" value={String(data.from || "")} />
          <Row label="To" value={String(data.to || "")} />
          <Row label="Amount" value={`${sym}${Number(data.amount || 0).toLocaleString()}`} />
        </>,
        "✅", "Settlement Recorded"
      );

    case "balance_shown":
      return card(
        <>
          <Row label="Total spent" value={`${sym}${Number(data.total_spent || 0).toLocaleString()}`} />
          {(data.settlement_transactions || []).slice(0, 3).map((t: any, i: number) => (
            <Row key={i} label={`${t.from} → ${t.to}`} value={`${sym}${t.amount}`} />
          ))}
          {!data.settlement_transactions?.length && (
            <Text style={{ color: c.textMuted, fontSize: 12, marginTop: 4 }}>All settled up!</Text>
          )}
        </>,
        "⚖️", data.group_name || "Balances"
      );

    case "expense_deleted":
      return card(
        <Text style={{ color: c.textMuted, fontSize: 12 }}>Expense removed from the group.</Text>,
        "🗑️", "Expense Deleted"
      );

    case "group_deleted":
      return card(
        <Text style={{ color: c.textMuted, fontSize: 12 }}>Group and all expenses permanently deleted.</Text>,
        "🗑️", "Group Deleted"
      );

    case "expenses_listed":
    case "expenses_found": {
      const exps: any[] = (data.expenses || []).slice(0, 4);
      return card(
        <>
          {exps.map((e: any, i: number) => (
            <Row
              key={i}
              label={e.name || "Expense"}
              value={`${sym}${Number(e.amount || 0).toLocaleString()}`}
            />
          ))}
          {data.count > 4 && (
            <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 4 }}>
              +{data.count - 4} more
            </Text>
          )}
        </>,
        "📋", `${data.count || 0} Expenses`
      );
    }

    case "group_summarized": {
      const cats = Object.entries(data.by_category || {}).slice(0, 3);
      return card(
        <>
          <Row label="Total spent" value={`${sym}${Number(data.total_spent || 0).toLocaleString()}`} />
          <Row label="Expenses" value={String(data.expense_count || 0)} />
          {cats.map(([cat, amt]: [string, any], i) => (
            <Row key={i} label={cat} value={`${sym}${Number(amt).toLocaleString()}`} />
          ))}
        </>,
        "📊", data.name || "Summary"
      );
    }

    case "statistics_shown":
      return card(
        <>
          <Row label="Total" value={`${sym}${Number(data.total || 0).toLocaleString()}`} />
          <Row label="Owed to you" value={`${sym}${Number(data.owed_to_you || 0).toLocaleString()}`} />
          <Row label="You owe" value={`${sym}${Number(data.you_owe || 0).toLocaleString()}`} />
        </>,
        "📈", `Stats — ${data.period || "month"}`
      );

    case "groups_listed": {
      const gs: any[] = (data.groups || []).slice(0, 4);
      return card(
        <>
          {gs.map((g: any, i: number) => (
            <Row
              key={i}
              label={g.name}
              value={g.my_net >= 0 ? `+${sym}${Math.abs(g.my_net).toFixed(0)}` : `-${sym}${Math.abs(g.my_net).toFixed(0)}`}
            />
          ))}
        </>,
        "👥", `${data.count || 0} Groups`
      );
    }

    default:
      return null;
  }
}
