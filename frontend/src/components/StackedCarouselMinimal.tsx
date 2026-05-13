import React, { useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions } from "react-native";
import { useTheme } from "../lib/theme";
import { currencySymbol } from "../lib/tokens";
import { Ionicons } from "@expo/vector-icons";

const CARD_WIDTH = Dimensions.get("window").width - 48;

export type CarouselTrip = {
  id: string;
  name: string;
  destinations?: string[];
  split_category?: string;
  currency?: string;
  my_net?: number;
};

type Props = {
  trips: CarouselTrip[];
  onPressCard?: (trip: CarouselTrip) => void;
  onIndexChange?: (i: number) => void;
};

export function StackedCarouselMinimal({ trips, onPressCard, onIndexChange }: Props) {
  const { c, isDark } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = React.useRef<FlatList>(null);

  if (!trips || trips.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Ionicons name="wallet-outline" size={40} color={c.textSecondary} />
        <Text style={{ color: c.textPrimary, fontSize: 14, fontWeight: "700", marginTop: 8 }}>
          No splits yet
        </Text>
      </View>
    );
  }

  const handleScroll = (e: any) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
    setCurrentIndex(index);
    onIndexChange?.(index);
  };

  const categoryEmojis: Record<string, string> = {
    trip: "✈️",
    food: "🍽️",
    home: "🏠",
    friends: "🎉",
    shopping: "🛍️",
    bills: "⚡",
  };

  return (
    <View style={styles.container}>
      {/* Carousel */}
      <FlatList
        ref={flatListRef}
        data={trips}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => onPressCard?.(item)}
            activeOpacity={0.85}
            style={{ width: CARD_WIDTH }}
          >
            <View style={[styles.card, { backgroundColor: c.surface, borderColor: isDark ? "rgba(124,92,255,0.25)" : c.border }]}>
              {/* Header */}
              <View style={styles.header}>
                <View style={[styles.emoji, { backgroundColor: isDark ? "rgba(124,92,255,0.15)" : "#F5F5F5" }]}>
                  <Text style={styles.emojiText}>
                    {categoryEmojis[item.split_category || "trip"] || "💰"}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: c.textPrimary }]}>{item.name}</Text>
                  <Text style={[styles.subtitle, { color: c.textSecondary }]}>
                    {item.my_net && item.my_net > 0.5 ? "You are owed" : item.my_net && item.my_net < -0.5 ? "You owe" : "Even"}
                  </Text>
                </View>
              </View>

              {/* Amount */}
              <View style={styles.amountSection}>
                <Text style={[styles.amount, { color: item.my_net && item.my_net > 0.5 ? "#10b981" : item.my_net && item.my_net < -0.5 ? "#ef4444" : c.textSecondary }]}>
                  {currencySymbol(item.currency || "INR")}
                  {Math.abs(item.my_net || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </Text>
              </View>

              {/* Footer */}
              <View style={[styles.footer, { borderTopColor: isDark ? "rgba(255,255,255,0.05)" : c.border }]}>
                <Text style={[styles.location, { color: c.textSecondary }]}>
                  {item.destinations?.[0] || item.split_category || "Expense"}
                </Text>
                <Ionicons name="chevron-forward" size={12} color={c.textMuted} />
              </View>
            </View>
          </TouchableOpacity>
        )}
        horizontal
        pagingEnabled
        scrollEventThrottle={16}
        onScroll={handleScroll}
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 24 }}
        ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
      />

      {/* Dots */}
      {trips.length > 1 && (
        <View style={styles.dots}>
          {trips.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => {
                flatListRef.current?.scrollToIndex({ index: i, animated: true });
                setCurrentIndex(i);
                onIndexChange?.(i);
              }}
              style={[
                styles.dot,
                {
                  backgroundColor: i === currentIndex ? (isDark ? c.indigo : "#0A0A0A") : c.textMuted,
                  width: i === currentIndex ? 16 : 6,
                },
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 12,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  emoji: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiText: {
    fontSize: 22,
  },
  name: {
    fontSize: 14,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  amountSection: {
    marginVertical: 10,
  },
  amount: {
    fontSize: 24,
    fontWeight: "700",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 1,
    marginTop: "auto",
  },
  location: {
    fontSize: 11,
    fontWeight: "600",
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  empty: {
    width: CARD_WIDTH,
    borderRadius: 16,
    borderWidth: 1,
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});