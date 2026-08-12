import { useState, useMemo, useRef, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  Alert, Platform, Animated, Easing,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  ArrowLeftIcon, MagnifyingGlassIcon, XIcon, CheckIcon, GlobeIcon,
} from "phosphor-react-native";
import { useTheme } from "../src/lib/theme";
import {
  SUPPORTED_LANGUAGES, changeLanguage, getCurrentLanguage,
  type LanguageMeta,
} from "../src/lib/i18n";
import { spacing, radius, type } from "../src/lib/tokens";

// ── Entrance animation for list rows ─────────────────────────────────────────
function AnimRow({ children, index }: { children: React.ReactNode; index: number }) {
  const fade  = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    const delay = 30 + index * 35;
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 260, delay, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 240, delay, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [index]);

  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: slide }] }}>
      {children}
    </Animated.View>
  );
}

export default function LanguageSettings() {
  const { c } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const [query,    setQuery]    = useState("");
  const [selected, setSelected] = useState(getCurrentLanguage());
  const [saving,   setSaving]   = useState(false);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return SUPPORTED_LANGUAGES;
    return SUPPORTED_LANGUAGES.filter(l =>
      l.name.toLowerCase().includes(q) ||
      l.nativeName.toLowerCase().includes(q) ||
      l.code.includes(q)
    );
  }, [query]);

  async function handleSelect(lang: LanguageMeta) {
    if (lang.code === selected || saving) return;
    setSaving(true);
    try {
      setSelected(lang.code);
      await changeLanguage(lang.code);
      Alert.alert(
        lang.nativeName,
        `Language saved. AI chat and voice features will now respond in ${lang.name}.\n\nRestart the app to apply this language to all UI text.`,
      );
    } finally {
      setSaving(false);
    }
  }

  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === selected);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* ── Header ── */}
      <View style={{
        flexDirection: "row", alignItems: "flex-start", gap: spacing["3"],
        paddingHorizontal: spacing["5"],
        paddingTop: Platform.OS === "ios" ? 56 : 44,
        paddingBottom: spacing["4"],
        borderBottomWidth: 1, borderBottomColor: c.border,
      }}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          style={{
            width: 36, height: 36, borderRadius: radius.full,
            backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border,
            alignItems: "center", justifyContent: "center", marginTop: 2,
          }}
        >
          <ArrowLeftIcon size={17} color={c.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: type.family.bold, fontSize: type.size.xl, color: c.textPrimary, letterSpacing: type.tracking.tight }}>
            Language
          </Text>
          <Text style={{ fontFamily: type.family.regular, fontSize: type.size.xs, color: c.textMuted, marginTop: 2 }}>
            {SUPPORTED_LANGUAGES.length} languages supported
          </Text>
        </View>
        <View style={{
          borderRadius: radius.md, backgroundColor: c.surfaceAlt,
          paddingHorizontal: 10, paddingVertical: 6,
          flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2,
        }}>
          <GlobeIcon size={13} color={c.textSecondary} />
          <Text style={{ fontFamily: type.family.semibold, fontSize: 12, color: c.textSecondary }}>
            {currentLang?.nativeName || "—"}
          </Text>
        </View>
      </View>

      {/* ── Search ── */}
      <View style={{
        flexDirection: "row", alignItems: "center",
        backgroundColor: c.surfaceAlt, borderRadius: radius.lg,
        marginHorizontal: spacing["5"], marginTop: spacing["4"], marginBottom: spacing["3"],
        paddingHorizontal: spacing["3"], borderWidth: 1, borderColor: c.border, gap: spacing["2"],
      }}>
        <MagnifyingGlassIcon size={16} color={c.textMuted} />
        <TextInput
          style={{
            flex: 1, height: 44,
            fontFamily: type.family.regular, fontSize: type.size.sm,
            color: c.textPrimary,
          } as any}
          placeholder="Search languages…"
          placeholderTextColor={c.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search languages"
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => setQuery("")}
            accessibilityLabel="Clear search"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <XIcon size={15} color={c.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Preview strip (current language) ── */}
      {currentLang && (
        <View style={{
          marginHorizontal: spacing["5"], marginBottom: spacing["3"],
          backgroundColor: c.surface, borderRadius: radius.lg,
          padding: spacing["3"], borderWidth: 1, borderColor: c.border,
          flexDirection: "row", alignItems: "center", gap: spacing["3"],
        }}>
          <View style={{
            width: 34, height: 34, borderRadius: radius.full,
            backgroundColor: c.surfaceAlt, borderWidth: 1, borderColor: c.border,
            alignItems: "center", justifyContent: "center",
          }}>
            <CheckIcon size={15} color={c.positive} weight="bold" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: type.family.semibold, fontSize: type.size.sm, color: c.textPrimary }}>
              {currentLang.nativeName}
            </Text>
            <Text style={{ fontFamily: type.family.regular, fontSize: type.size.xs, color: c.textSecondary, marginTop: 1 }}>
              {currentLang.name} · {t("language.previewText")}
            </Text>
          </View>
          {currentLang.rtl && (
            <View style={{ backgroundColor: `${c.indigo}20`, borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 3 }}>
              <Text style={{ fontFamily: type.family.bold, fontSize: 9, color: c.indigo, letterSpacing: 0.8 }}>RTL</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Language list ── */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.code}
        contentContainerStyle={{ paddingHorizontal: spacing["5"], paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => {
          const isSelected = item.code === selected;
          return (
            <AnimRow index={index}>
              <TouchableOpacity
                onPress={() => handleSelect(item)}
                disabled={saving}
                activeOpacity={0.7}
                accessibilityRole="radio"
                accessibilityLabel={`${item.name} — ${item.nativeName}`}
                accessibilityState={{ selected: isSelected }}
                style={{
                  flexDirection: "row", alignItems: "center",
                  paddingVertical: 13, gap: spacing["3"],
                  borderBottomWidth: 1, borderBottomColor: c.border,
                  backgroundColor: isSelected ? `${c.textPrimary}06` : "transparent",
                }}
              >
                {/* Selection indicator */}
                <View style={{
                  width: 22, height: 22, borderRadius: 11,
                  borderWidth: 1.5,
                  borderColor: isSelected ? c.textPrimary : c.border,
                  backgroundColor: isSelected ? c.textPrimary : "transparent",
                  alignItems: "center", justifyContent: "center",
                }}>
                  {isSelected && <CheckIcon size={11} color={c.bg} weight="bold" />}
                </View>

                {/* Names */}
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: spacing["2"], flexWrap: "wrap" }}>
                  <Text style={{ fontFamily: type.family.semibold, fontSize: type.size.base, color: c.textPrimary }}>
                    {item.nativeName}
                  </Text>
                  <Text style={{ fontFamily: type.family.regular, fontSize: type.size.sm, color: c.textMuted }}>
                    {item.name}
                  </Text>
                </View>

                {/* RTL badge */}
                {item.rtl && (
                  <View style={{ backgroundColor: `${c.indigo}20`, borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 3 }}>
                    <Text style={{ fontFamily: type.family.bold, fontSize: 9, color: c.indigo, letterSpacing: 0.8 }}>RTL</Text>
                  </View>
                )}
              </TouchableOpacity>
            </AnimRow>
          );
        }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: 48 }}>
            <Text style={{ fontFamily: type.family.medium, fontSize: type.size.sm, color: c.textMuted }}>
              No languages found for "{query}"
            </Text>
          </View>
        }
      />
    </View>
  );
}
