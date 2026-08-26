import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../../src/lib/theme";
import { useAuth } from "../../src/lib/auth";
import { api } from "../../src/lib/api";
import { ROUTES } from "../../src/lib/routes";

type TripInfo = {
  trip_id: string;
  trip_name: string;
  member_count: number;
  currency: string;
  invited_by?: string;
};

type InviteResponse = TripInfo;

export default function JoinTripPage() {
  const { c } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  const params = useLocalSearchParams<{
    token?: string | string[];
  }>();

  const token = useMemo(() => {
    if (Array.isArray(params.token)) {
      return params.token[0];
    }

    return params.token;
  }, [params.token]);

  const [tripInfo, setTripInfo] = useState<TripInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);
  const [joinError, setJoinError] = useState("");

  // Fetch invite information from backend
  useEffect(() => {
    let mounted = true;

    const fetchInvite = async () => {
      if (!token) {
        if (mounted) {
          setFetchError("This invite link is missing a token.");
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        setFetchError("");

        const response = await api.get<InviteResponse>(
          `/invite/${encodeURIComponent(token)}`,
          {
            skipAuth: true,
          } as any
        );

        if (!mounted) return;

        setTripInfo(response.data);
      } catch (error: any) {
        if (!mounted) return;

        const status = error?.response?.status;

        if (status === 410) {
          setFetchError("This invite link has expired.");
        } else if (status === 409) {
          setFetchError(
            "This invite link is no longer available."
          );
        } else if (status === 404) {
          setFetchError("This invite link was not found.");
        } else {
          setFetchError("This invite link is invalid.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchInvite();

    return () => {
      mounted = false;
    };
  }, [token]);

  // Join trip
  const join = async () => {
    if (!token || !tripInfo) {
      return;
    }

    // Login first if user is not authenticated
    if (!user) {
      router.push({
        pathname: ROUTES.LOGIN,
        params: {
          redirect: `/join/${token}`,
        },
      });

      return;
    }

    try {
      setJoining(true);
      setJoinError("");

      const response = await api.post(
        `/invite/${encodeURIComponent(token)}/join`,
        {}
      );

      setAlreadyMember(
        Boolean(response.data?.already_member)
      );

      setJoined(true);

      setTimeout(() => {
        router.replace({
          pathname: ROUTES.SPLIT_DETAIL,
          params: {
            id: tripInfo.trip_id,
          },
        });
      }, 1200);
    } catch (error: any) {
      const status = error?.response?.status;

      if (status === 410) {
        setJoinError("This invite link has expired.");
      } else if (status === 409) {
        setJoinError(
          "This invite link is no longer available."
        );
      } else if (status === 401) {
        setJoinError(
          "Please log in before joining this group."
        );
      } else {
        setJoinError(
          error?.response?.data?.detail ||
            "Could not join. Please try again."
        );
      }
    } finally {
      setJoining(false);
    }
  };

  // Dynamic trip information
  const infoRows = useMemo(() => {
    if (!tripInfo) {
      return [];
    }

    return [
      {
        icon: "people-outline" as const,
        label: "Members",
        value: `${tripInfo.member_count} ${
          tripInfo.member_count === 1
            ? "person"
            : "people"
        }`,
      },
      {
        icon: "cash-outline" as const,
        label: "Currency",
        value: tripInfo.currency,
      },
      {
        icon: "shield-checkmark-outline" as const,
        label: "Privacy",
        value: "Invite-only group",
      },
    ];
  }, [tripInfo]);

  const goHome = () => {
    router.replace("/(tabs)/" as any);
  };

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: c.bg,
      }}
    >
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 32,
        }}
      >
        {/* Header Icon */}
        <View
          style={{
            width: 64,
            height: 64,
            backgroundColor: c.surface,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
            borderWidth: 1,
            borderColor: c.border,
          }}
        >
          <Ionicons
            name="people"
            size={30}
            color={c.textPrimary}
          />
        </View>

        {/* Error */}
        {fetchError ? (
          <View
            style={{
              alignItems: "center",
              gap: 12,
              width: "100%",
            }}
          >
            <Text
              style={{
                fontSize: 22,
                fontWeight: "800",
                color: c.textPrimary,
                textAlign: "center",
              }}
            >
              Invalid Link
            </Text>

            <Text
              style={{
                fontSize: 15,
                color: c.textSecondary,
                textAlign: "center",
                lineHeight: 22,
              }}
            >
              {fetchError}
            </Text>

            <TouchableOpacity
              onPress={goHome}
              activeOpacity={0.8}
              style={{
                marginTop: 16,
                backgroundColor: c.textPrimary,
                paddingHorizontal: 28,
                paddingVertical: 14,
              }}
            >
              <Text
                style={{
                  color: c.bg,
                  fontSize: 15,
                  fontWeight: "700",
                }}
              >
                Go Home
              </Text>
            </TouchableOpacity>
          </View>
        ) : loading ? (
          /* Loading */
          <View
            style={{
              alignItems: "center",
              gap: 12,
            }}
          >
            <ActivityIndicator
              size="large"
              color={c.textPrimary}
            />

            <Text
              style={{
                color: c.textMuted,
                fontSize: 14,
              }}
            >
              Loading invite…
            </Text>
          </View>
        ) : joined && tripInfo ? (
          /* Success */
          <View
            style={{
              alignItems: "center",
              gap: 12,
            }}
          >
            <View
              style={{
                width: 64,
                height: 64,
                backgroundColor: c.surface,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: c.border,
              }}
            >
              <Ionicons
                name="checkmark"
                size={34}
                color={c.textPrimary}
              />
            </View>

            <Text
              style={{
                fontSize: 22,
                fontWeight: "800",
                color: c.textPrimary,
              }}
            >
              {alreadyMember
                ? "Already a member"
                : "Joined!"}
            </Text>

            <Text
              style={{
                fontSize: 15,
                color: c.textSecondary,
                textAlign: "center",
              }}
            >
              You&apos;re in{" "}
              <Text
                style={{
                  fontWeight: "700",
                  color: c.textPrimary,
                }}
              >
                {tripInfo.trip_name}
              </Text>
            </Text>

            <ActivityIndicator
              size="small"
              color={c.textMuted}
              style={{ marginTop: 8 }}
            />

            <Text
              style={{
                fontSize: 12,
                color: c.textMuted,
              }}
            >
              Opening group…
            </Text>
          </View>
        ) : tripInfo ? (
          /* Invite */
          <View
            style={{
              width: "100%",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                color: c.textSecondary,
                fontWeight: "600",
                letterSpacing: 1.2,
              }}
            >
              YOU&apos;VE BEEN INVITED
            </Text>

            {/* Dynamic Trip Name */}
            <Text
              style={{
                fontSize: 28,
                fontWeight: "800",
                color: c.textPrimary,
                textAlign: "center",
                letterSpacing: -0.5,
                marginBottom: 4,
              }}
            >
              {tripInfo.trip_name}
            </Text>

            {/* Dynamic Member Count */}
            <Text
              style={{
                fontSize: 14,
                color: c.textSecondary,
                textAlign: "center",
                lineHeight: 20,
              }}
            >
              {tripInfo.member_count}{" "}
              {tripInfo.member_count === 1
                ? "member"
                : "members"}{" "}
              already splitting expenses
              {tripInfo.invited_by
                ? ` · invited by ${tripInfo.invited_by}`
                : ""}
            </Text>

            {/* Dynamic Information Card */}
            <View
              style={{
                width: "100%",
                marginTop: 20,
                marginBottom: 8,
                backgroundColor: c.surface,
                padding: 18,
                borderWidth: 1,
                borderColor: c.border,
                gap: 12,
              }}
            >
              {infoRows.map(
                ({ icon, label, value }) => (
                  <View
                    key={label}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    <View
                      style={{
                        width: 36,
                        height: 36,
                        backgroundColor: c.bg,
                        borderWidth: 1,
                        borderColor: c.border,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons
                        name={icon}
                        size={17}
                        color={c.textSecondary}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 11,
                          color: c.textMuted,
                        }}
                      >
                        {label}
                      </Text>

                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "600",
                          color: c.textPrimary,
                        }}
                      >
                        {value}
                      </Text>
                    </View>
                  </View>
                )
              )}
            </View>

            {/* Join Error */}
            {joinError ? (
              <Text
                style={{
                  color: c.textPrimary,
                  fontSize: 13,
                  textAlign: "center",
                  fontWeight: "600",
                  marginTop: 4,
                }}
              >
                {joinError}
              </Text>
            ) : null}

            {/* Join Button */}
            <TouchableOpacity
              onPress={join}
              disabled={joining}
              activeOpacity={0.8}
              style={{
                width: "100%",
                backgroundColor: c.textPrimary,
                paddingVertical: 16,
                alignItems: "center",
                opacity: joining ? 0.7 : 1,
                marginTop: 4,
              }}
            >
              {joining ? (
                <ActivityIndicator
                  color={c.bg}
                  size="small"
                />
              ) : (
                <Text
                  style={{
                    color: c.bg,
                    fontSize: 16,
                    fontWeight: "800",
                  }}
                >
                  {user
                    ? `Join ${tripInfo.trip_name}`
                    : "Log in to join"}
                </Text>
              )}
            </TouchableOpacity>

            {!user && (
              <Text
                style={{
                  fontSize: 12,
                  color: c.textMuted,
                  textAlign: "center",
                  marginTop: 4,
                }}
              >
                You&apos;ll be taken back here after logging in
              </Text>
            )}
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}