import { useState, useEffect } from "react";

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
    const glucoseCanvas = document.getElementById("glucoseChart") as HTMLCanvasElement;
    const temperatureCanvas = document.getElementById("temperatureChart") as HTMLCanvasElement;
    const glucoseCtx = glucoseCanvas?.getContext("2d");
    const temperatureCtx = temperatureCanvas?.getContext("2d");

    if (!glucoseCtx || !temperatureCtx) return;

    // Clear canvases
    glucoseCtx.clearRect(0, 0, glucoseCanvas.width, glucoseCanvas.height);
    temperatureCtx.clearRect(0, 0, temperatureCanvas.width, temperatureCanvas.height);

    // Canvas dimensions
    const width = glucoseCanvas.width;
    const height = glucoseCanvas.height;

    // Draw grid and labels
    const drawGrid = (ctx: CanvasRenderingContext2D, yLabel: string) => {
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 1;
      // Vertical grid lines (time)
      for (let x = 50; x < width; x += (width - 50) / 5) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height - 30);
        ctx.stroke();
      }
      // Horizontal grid lines (value)
      for (let y = 30; y < height - 30; y += (height - 60) / 5) {
        ctx.beginPath();
        ctx.moveTo(50, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      // Axes
      ctx.strokeStyle = "#374151";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(50, 30);
      ctx.lineTo(50, height - 30);
      ctx.lineTo(width, height - 30);
      ctx.stroke();
      // Labels
      ctx.fillStyle = "#374151";
      ctx.font = "12px sans-serif";
      ctx.fillText(yLabel, 10, 30);
      ctx.fillText("Time", width - 30, height - 10);
    };

    // Draw data points
    const drawData = (
      ctx: CanvasRenderingContext2D,
      data: number[],
      maxValue: number,
      color: string
    ) => {
      if (data.length < 2) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const xStep = (width - 50) / (data.length - 1);
      data.forEach((value, i) => {
        const x = 50 + i * xStep;
        const y = height - 30 - ((value / maxValue) * (height - 60));
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
      // Draw points
      ctx.fillStyle = color;
      data.forEach((value, i) => {
        const x = 50 + i * xStep;
        const y = height - 30 - ((value / maxValue) * (height - 60));
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fill();
      });
    };

    // Normalize data
    const glucoseValues = dataPoints.map((point) => point.glucose);
    const temperatureValues = dataPoints.map((point) => point.temperature);
    const maxGlucose = Math.max(...glucoseValues, 200) || 200; // Default max
    const maxTemperature = Math.max(...temperatureValues, 40) || 40; // Default max

    // Draw charts
    drawGrid(glucoseCtx, "Glucose (mg/dL)");
    drawGrid(temperatureCtx, "Temperature (°C)");
    drawData(glucoseCtx, glucoseValues, maxGlucose, "#3b82f6");
    drawData(temperatureCtx, temperatureValues, maxTemperature, "#ef4444");
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
              <canvas id="glucoseChart" width="400" height="200" className="w-full"></canvas>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg shadow md:col-span-2">
              <h2 className="text-xl font-semibold text-gray-700">🌡️ Temperature Trend</h2>
              <canvas id="temperatureChart" width="400" height="200" className="w-full"></canvas>
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
