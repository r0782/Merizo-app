import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import * as Contacts from "expo-contacts";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../lib/theme";

type Contact = {
  id: string;
  name: string;
  email: string;
};

type Props = {
  onSelectContacts: (contacts: string[]) => void;
  testID?: string;
};

export function ContactPickerButton({ onSelectContacts, testID }: Props) {
  const { c } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const loadContacts = async () => {
    setLoading(true);
    try {
      // Contacts only work on native, not web
      if (Platform.OS === "web") {
        Alert.alert("Info", "On web, add members by email manually");
        setLoading(false);
        return;
      }

      const { status } = await Contacts.requestPermissionsAsync();

      if (status !== "granted") {
        Alert.alert("Permission Denied", "Need access to contacts");
        setLoading(false);
        return;
      }

      const response = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.Emails],
      });

      if (!response || !response.data || response.data.length === 0) {
        Alert.alert("No contacts found");
        setLoading(false);
        return;
      }

      const withEmails = response.data
        .filter((c) => c.emails && c.emails.length > 0 && c.emails[0].email)
        .map((c) => ({
          id: c.id,
          name: c.name || "Unknown",
          email: c.emails![0].email as string,
        }));

      setContacts(withEmails);
    } catch (error) {
      console.error("Error loading contacts:", error);
      Alert.alert("Error", "Failed to load contacts");
    }
    setLoading(false);
  };

  const handleOpen = async () => {
    setIsOpen(true);
    if (contacts.length === 0) {
      await loadContacts();
    }
  };

  const handleConfirm = () => {
    onSelectContacts(Array.from(selected));
    setIsOpen(false);
  };

  const toggleContact = (email: string) => {
    const newSelected = new Set(selected);
    if (newSelected.has(email)) {
      newSelected.delete(email);
    } else {
      newSelected.add(email);
    }
    setSelected(newSelected);
  };

  return (
    <>
      <TouchableOpacity
        testID={testID}
        onPress={handleOpen}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
          backgroundColor: c.surface,
          borderColor: c.border,
          borderWidth: 1,
          borderRadius: 8,
          marginBottom: 12,
        }}
      >
        <Ionicons name="people-outline" size={16} color={c.textPrimary} />
        <Text style={{ color: c.textPrimary, fontWeight: "600", fontSize: 14 }}>
          Add from Contacts
        </Text>
      </TouchableOpacity>

      <Modal visible={isOpen} transparent animationType="slide">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: c.bg,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              maxHeight: "80%",
              paddingBottom: 40,
            }}
          >
            <View
              style={{
                paddingVertical: 16,
                paddingHorizontal: 16,
                borderBottomColor: c.border,
                borderBottomWidth: 1,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: c.textPrimary }}>
                Select Contacts ({selected.size})
              </Text>
              <TouchableOpacity onPress={() => setIsOpen(false)}>
                <Ionicons name="close" size={24} color={c.textPrimary} />
              </TouchableOpacity>
            </View>

            {loading ? (
              <ActivityIndicator size="large" color="#7C5CFF" style={{ marginTop: 40 }} />
            ) : (
              <FlatList
                data={contacts}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => toggleContact(item.email)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderBottomColor: c.border,
                      borderBottomWidth: 0.5,
                    }}
                  >
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 4,
                        borderColor: c.border,
                        borderWidth: 2,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: selected.has(item.email) ? "#7C5CFF" : "transparent",
                      }}
                    >
                      {selected.has(item.email) && (
                        <Ionicons name="checkmark" size={16} color="#fff" />
                      )}
                    </View>
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={{ fontWeight: "600", color: c.textPrimary }}>
                        {item.name}
                      </Text>
                      <Text style={{ fontSize: 12, color: c.textSecondary, marginTop: 2 }}>
                        {item.email}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}

            <View
              style={{
                flexDirection: "row",
                gap: 12,
                paddingHorizontal: 16,
                paddingTop: 12,
                borderTopColor: c.border,
                borderTopWidth: 1,
              }}
            >
              <TouchableOpacity
                onPress={() => setIsOpen(false)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 8,
                  backgroundColor: c.surface,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: c.textPrimary, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirm}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 8,
                  backgroundColor: "#7C5CFF",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>Add Selected</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}