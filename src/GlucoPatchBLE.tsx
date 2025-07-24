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

    if (!glucoseCtx || !temperatureCtx || !glucoseCanvas || !temperatureCanvas) {
      log("❌ Canvas context or element not found.");
      return;
    }

    // Set canvas size to match CSS dimensions
    const dpr = window.devicePixelRatio || 1;
    glucoseCanvas.width = glucoseCanvas.offsetWidth * dpr;
    glucoseCanvas.height = 200 * dpr;
    temperatureCanvas.width = temperatureCanvas.offsetWidth * dpr;
    temperatureCanvas.height = 200 * dpr;
    glucoseCtx.scale(dpr, dpr);
    temperatureCtx.scale(dpr, dpr);

    // Clear canvases
    glucoseCtx.clearRect(0, 0, glucoseCanvas.width / dpr, glucoseCanvas.height / dpr);
    temperatureCtx.clearRect(0, 0, temperatureCanvas.width / dpr, temperatureCanvas.height / dpr);

    // Canvas dimensions (CSS pixels)
    const width = glucoseCanvas.offsetWidth;
    const height = 200;

    // Draw grid and labels
    const drawGrid = (ctx: CanvasRenderingContext2D, yLabel: string, maxValue: number) => {
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 1;
      // Vertical grid lines (time)
      for (let x = 50; x <= width - 10; x += (width - 60) / 5) {
        ctx.beginPath();
        ctx.moveTo(x, 20);
        ctx.lineTo(x, height - 20);
        ctx.stroke();
      }
      // Horizontal grid lines (value)
      for (let y = 20; y <= height - 20; y += (height - 40) / 5) {
        ctx.beginPath();
        ctx.moveTo(50, y);
        ctx.lineTo(width - 10, y);
        ctx.stroke();
        // Y-axis value labels
        const value = maxValue - ((y - 20) / (height - 40)) * maxValue;
        ctx.fillStyle = "#374151";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(value.toFixed(0), 45, y + 3);
      }
      // Axes
      ctx.strokeStyle = "#374151";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(50, 20);
      ctx.lineTo(50, height - 20);
      ctx.lineTo(width - 10, height - 20);
      ctx.stroke();
      // Labels
      ctx.fillStyle = "#374151";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(yLabel, 10, 20);
      ctx.textAlign = "center";
      ctx.fillText("Time", width - 30, height - 5);
    };

    // Draw data points
    const drawData = (
      ctx: CanvasRenderingContext2D,
      data: number[],
      maxValue: number,
      color: string
    ) => {
      if (data.length < 1) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const xStep = data.length > 1 ? (width - 60) / (data.length - 1) : 0;
      data.forEach((value, i) => {
        const x = 50 + i * xStep;
        const y = height - 20 - ((value / maxValue) * (height - 40));
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
        const y = height - 20 - ((value / maxValue) * (height - 40));
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fill();
        // Data point labels
        ctx.fillStyle = "#374151";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(value.toFixed(1), x, y - 10);
      });
    };

    // Normalize data
    const glucoseValues = dataPoints.map((point) => point.glucose);
    const temperatureValues = dataPoints.map((point) => point.temperature);
    const maxGlucose = Math.max(...(glucoseValues.length ? glucoseValues : [200]), 200);
    const maxTemperature = Math.max(...(temperatureValues.length ? temperatureValues : [40]), 40);

    // Draw charts
    drawGrid(glucoseCtx, "Glucose (mg/dL)", maxGlucose);
    drawGrid(temperatureCtx, "Temperature (°C)", maxTemperature);
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
              <canvas id="glucoseChart" style={{ width: '100%', height: '200px' }}></canvas>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg shadow md:col-span-2">
              <h2 className="text-xl font-semibold text-gray-700">🌡️ Temperature Trend</h2>
              <canvas id="temperatureChart" style={{ width: '100%', height: '200px' }}></canvas>
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
