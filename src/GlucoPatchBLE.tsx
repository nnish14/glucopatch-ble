import React, { useState } from "react";

interface GlucoseData {
  timestamp: string;
  glucose_mg_dL: number;
  temperature_C: number;
}

export default function GlucoPatchBLE() {
  const [glucoseData, setGlucoseData] = useState<GlucoseData | null>(null);
  const [connected, setConnected] = useState(false);

  const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
  const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

  const connectToBLE = async () => {
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: "ESP32" }],
        optionalServices: [SERVICE_UUID],
      });

      const server = await device.gatt?.connect();
      const service = await server?.getPrimaryService(SERVICE_UUID);
      const characteristic = await service?.getCharacteristic(CHARACTERISTIC_UUID);

      await characteristic?.startNotifications();
      characteristic?.addEventListener("characteristicvaluechanged", handleData);
      setConnected(true);
    } catch (err) {
      console.error("BLE connection failed:", err);
    }
  };

  const handleData = (event: Event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
    if (!value) return;

    const jsonStr = new TextDecoder().decode(value.buffer);
    try {
      const parsed = JSON.parse(jsonStr);
      setGlucoseData(parsed);
    } catch (err) {
      console.warn("Invalid JSON from BLE:", jsonStr);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h1>📡 GlucoPatch BLE Monitor</h1>
      {!connected ? (
        <button onClick={connectToBLE}>🔗 Connect to ESP32</button>
      ) : (
        <p>✅ Connected</p>
      )}

      {glucoseData && (
        <div style={{ marginTop: 20 }}>
          <h2>Glucose: {glucoseData.glucose_mg_dL} mg/dL</h2>
          <p>Temperature: {glucoseData.temperature_C} °C</p>
          <p>Timestamp: {glucoseData.timestamp}</p>
        </div>
      )}
    </div>
  );
}

