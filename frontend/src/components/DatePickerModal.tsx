import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal, Platform, StyleSheet } from "react-native";
import DatePicker from "react-native-date-picker";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../lib/theme";

type Props = {
  value: string;
  onChange: (date: string) => void;
  label: string;
  minDate?: Date;
  testID?: string;
};

export function DatePickerField({ value, onChange, label, minDate, testID }: Props) {
  const { c, isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    value ? new Date(value) : new Date()
  );

  const handleConfirm = () => {
    const dateStr = selectedDate.toISOString().split("T")[0];
    onChange(dateStr);
    setIsOpen(false);
  };

  return (
    <>
      <View
        style={[
          styles.container,
          {
            backgroundColor: c.surface,
            borderColor: c.border,
          },
        ]}
      >
        <Text style={{ color: c.textSecondary, fontSize: 12, fontWeight: "600" }}>
          {label}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ color: c.textPrimary, fontSize: 14, flex: 1, marginTop: 6 }}>
            {value || "Select date"}
          </Text>
          <TouchableOpacity
            testID={`${testID}-open`}
            onPress={() => setIsOpen(true)}
            style={{ padding: 8 }}
          >
            <Ionicons name="calendar-outline" size={18} color={c.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={[styles.overlay, { backgroundColor: "rgba(0,0,0,0.5)" }]}>
          <View
            style={[
              styles.pickerContainer,
              {
                backgroundColor: c.bg,
              },
            ]}
          >
            <View
              style={[
                styles.header,
                {
                  borderBottomColor: c.border,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: c.textPrimary,
                }}
              >
                {label}
              </Text>
            </View>

            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <DatePicker
                date={selectedDate}
                onDateChange={setSelectedDate}
                mode="date"
                minimumDate={minDate}
              />
            </View>

            <View
              style={[
                styles.footer,
                {
                  borderTopColor: c.border,
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => setIsOpen(false)}
                style={[styles.btn, { backgroundColor: c.surface }]}
              >
                <Text style={{ color: c.textPrimary, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirm}
                style={[styles.btn, { backgroundColor: "#7C5CFF" }]}
              >
                <Text style={{ color: "#fff", fontWeight: "600" }}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  pickerContainer: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "80%",
    paddingBottom: 40,
  },
  header: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    alignItems: "center",
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
});