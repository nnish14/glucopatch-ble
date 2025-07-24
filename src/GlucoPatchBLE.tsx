import { useState, useEffect } from "react";
import { Chart } from "chart.js/auto";
import "chartjs-adapter-date-fns";

interface GlucoseData {
  timestamp?: string;
  glucose_mg_dL: number;
  temperature_C: number;
  uptime: string;
}

const GlucoPatchBLE: React.FC = () => {
  const [glucoseData, setGlucoseData] = useState<GlucoseData | null>(null);
  const [connected, setConnected] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [dataPoints, setDataPoints] = useState<{ time: string; glucose: number; temperature: number }[]>([]);

  const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
  const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

  const log = (msg: string) => {
    console.log(msg);
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  const connectToBLE = async () => {
    log("🔍 Checking BLE support...");
    if (!navigator.bluetooth) {
      log("❌ Web Bluetooth not supported in this browser.");
      return;
    }
    try {
      log("🔎 Requesting BLE device...");
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [SERVICE_UUID],
      }) as BluetoothDevice;

      (device as any).ongattserverdisconnected = () => {
        log("⚠️ BLE disconnected.");
        setConnected(false);
      };

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
          setDataPoints((prev) => [
            ...prev,
            {
              time: new Date().toISOString(),
              glucose: parsed.glucose_mg_dL,
              temperature: parsed.temperature_C,
            },
          ]);
        } catch (err) {
          log("💥 JSON parsing failed: " + decoded);
        }
      });
      setConnected(true);
    } catch (err: any) {
      log("❌ BLE connect error: " + (err?.message || err));
    }
  };

  useEffect(() => {
    const ctxGlucose = document.getElementById("glucoseChart") as HTMLCanvasElement;
    const ctxTemperature = document.getElementById("temperatureChart") as HTMLCanvasElement;

    const glucoseChart = new Chart(ctxGlucose, {
      type: "line",
      data: {
        datasets: [{
          label: "Glucose (mg/dL)",
          data: dataPoints.map((point) => ({ x: point.time, y: point.glucose })),
          borderColor: "#3b82f6",
          backgroundColor: "rgba(59, 130, 246, 0.2)",
          fill: true,
          tension: 0.4,
        }],
      },
      options: {
        scales: {
          x: { type: "time", time: { unit: "minute" }, title: { display: true, text: "Time" } },
          y: { title: { display: true, text: "Glucose (mg/dL)" }, beginAtZero: false },
        },
        plugins: { legend: { display: true } },
      },
    });

    const temperatureChart = new Chart(ctxTemperature, {
      type: "line",
      data: {
        datasets: [{
          label: "Temperature (°C)",
          data: dataPoints.map((point) => ({ x: point.time, y: point.temperature })),
          borderColor: "#ef4444",
          backgroundColor: "rgba(239, 68, 68, 0.2)",
          fill: true,
          tension: 0.4,
        }],
      },
      options: {
        scales: {
          x: { type: "time", time: { unit: "minute" }, title: { display: true, text: "Time" } },
          y: { title: { display: true, text: "Temperature (°C)" }, beginAtZero: false },
        },
        plugins: { legend: { display: true } },
      },
    });

    return () => {
      glucoseChart.destroy();
      temperatureChart.destroy();
    };
  }, [dataPoints]);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">🩺 GlucoPatch BLE Monitor</h1>
        <button
          onClick={connectToBLE}
          disabled={connected}
          className={`w-full py-3 rounded-lg text-white font-semibold transition-colors ${
            connected ? "bg-green-500" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {connected ? "✅ Connected" : "🔗 Connect to ESP32"}
        </button>

        {glucoseData && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg shadow">
              <h2 className="text-xl font-semibold text-gray-700">🧪 Glucose</h2>
              <p className="text-2xl text-blue-600">{glucoseData.glucose_mg_dL} mg/dL</p>
              <p className="text-sm text-gray-500">🌡️ Temperature: {glucoseData.temperature_C.toFixed(2)} °C</p>
              <p className="text-sm text-gray-500">🕒 Last Sync: {new Date().toLocaleTimeString()}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg shadow">
              <h2 className="text-xl font-semibold text-gray-700">📊 Glucose Trend</h2>
              <canvas id="glucoseChart" className="w-full h-64"></canvas>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg shadow md:col-span-2">
              <h2 className="text-xl font-semibold text-gray-700">🌡️ Temperature Trend</h2>
              <canvas id="temperatureChart" className="w-full h-64"></canvas>
            </div>
          </div>
        )}

        <div className="mt-6">
          <h3 className="text-xl font-semibold text-gray-700">🪵 Debug Log</h3>
          <div className="bg-gray-900 text-green-400 p-4 rounded-lg max-h-64 overflow-y-auto font-mono text-sm">
            {logs.map((line, idx) => (
              <div key={idx} className="mb-1">{line}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlucoPatchBLE;
