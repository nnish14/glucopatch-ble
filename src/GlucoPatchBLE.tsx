import { useState } from "react";

interface GlucoseData {
  timestamp: string;
  glucose_mg_dL: number;
  temperature_C: number;
}

export default function GlucoPatchBLE() {
  const [glucoseData, setGlucoseData] = useState<GlucoseData | null>(null);
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
  const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

  const log = (msg: string) => {
    console.log(msg);
    setLogs((prev) => [...prev, msg]);
  };

  const connectToBLE = async () => {
    log("🔍 Checking BLE support...");

    if (!navigator.bluetooth) {
      log("❌ Web Bluetooth not supported in this browser.");
      return;
    }

    try {
      log("🔎 Requesting BLE device...");

      const device = (await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: "ESP32" }],
        optionalServices: [SERVICE_UUID],
      })) as BluetoothDevice & { name?: string };

      log(`✅ Device found: ${device.name || "Unnamed device"}`);

      (device as any).addEventListener("gattserverdisconnected", () => {
        log("⚠️ BLE disconnected.");
        setConnected(false);
      });

      const server = await device.gatt?.connect();
      log("🔗 Connected to GATT server.");

      const service = await server?.getPrimaryService(SERVICE_UUID);
      log(`📡 Got primary service: ${SERVICE_UUID}`);

      const characteristic = await service?.getCharacteristic(CHARACTERISTIC_UUID);
      log(`✅ Got characteristic: ${CHARACTERISTIC_UUID}`);

      await characteristic?.startNotifications();
      log("🔔 Started notifications.");

      characteristic?.addEventListener("characteristicvaluechanged", (event: Event) => {
        const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
        if (!value) {
          log("⚠️ No value received.");
          return;
        }

        const decoded = new TextDecoder().decode(value.buffer);
        log("📨 Received: " + decoded);

        try {
          const parsed = JSON.parse(decoded);
          setGlucoseData(parsed);
        } catch (err) {
          log("💥 JSON parsing failed: " + decoded);
        }
      });

      setConnected(true);
    } catch (err: any) {
      log("❌ BLE connect error: " + (err?.message || err));
    }
  };

  return (
    <div style={{ fontFamily: "sans-serif", padding: 20 }}>
      <h1>🩺 GlucoPatch BLE Debugger</h1>
      <button onClick={connectToBLE} disabled={connected}>
        {connected ? "✅ Connected" : "🔗 Connect to ESP32"}
      </button>

      {glucoseData && (
        <div style={{ marginTop: 20 }}>
          <h2>🧪 Glucose: {glucoseData.glucose_mg_dL} mg/dL</h2>
          <p>🌡️ Temperature: {glucoseData.temperature_C.toFixed(2)} °C</p>
          <p>🕒 Timestamp: {glucoseData.timestamp}</p>
        </div>
      )}

      <div style={{ marginTop: 30 }}>
        <h3>🪵 Debug Log:</h3>
        <pre style={{ background: "#111", color: "#0f0", padding: "1em", maxHeight: "300px", overflowY: "scroll" }}>
          {logs.map((line, idx) => (
            <div key={idx}>{line}</div>
          ))}
        </pre>
      </div>
    </div>
  );
}
