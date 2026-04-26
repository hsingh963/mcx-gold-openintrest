const expiryDropdown = document.getElementById("expiryDropdown");
const loadBtn = document.getElementById("loadBtn");
const refreshBtn = document.getElementById("refreshBtn");
const chartCanvas = document.getElementById("oiChart");
const statusText = document.getElementById("status");
let oiChart = null;

function setLoading(isLoading, message) {
  loadBtn.disabled = isLoading;
  refreshBtn.disabled = isLoading;
  expiryDropdown.disabled = isLoading;
  statusText.textContent = message;
}

async function loadExpiries() {
  setLoading(true, "Loading expiries...");
  const response = await fetch("/api/options/expiries");
  if (!response.ok) {
    throw new Error(`Failed to load expiries (${response.status})`);
  }

  const expiries = await response.json();
  expiryDropdown.innerHTML = "";

  expiries.forEach((expiry) => {
    const option = document.createElement("option");
    option.value = expiry;
    option.textContent = expiry;
    expiryDropdown.appendChild(option);
  });

  if (expiries.length === 0) {
    setLoading(false, "No expiries found.");
    clearChart();
    return;
  }

  setLoading(false, "Ready.");
  await loadAnalysis(true);
}

function clearChart() {
  if (oiChart) {
    oiChart.destroy();
    oiChart = null;
  }
}

function toColorArray(length, baseColor, highlightIndex, highlightColor) {
  return Array.from({ length }, (_, index) => (index === highlightIndex ? highlightColor : baseColor));
}

function buildChart(payload) {
  const rows = payload?.data ?? [];
  const analysis = payload?.analysis ?? {};

  const labels = rows.map((row) => String(row.strikePrice));
  const callData = rows.map((row) => Number(row.callOI));
  const putData = rows.map((row) => Number(row.putOI));

  const supportIndex = labels.findIndex((label) => label === String(analysis.strongestSupport));
  const resistanceIndex = labels.findIndex((label) => label === String(analysis.strongestResistance));
  const maxPainIndex = labels.findIndex((label) => label === String(analysis.maxPain));

  const callColors = toColorArray(
    labels.length,
    "rgba(239, 68, 68, 0.45)",
    resistanceIndex,
    "rgba(220, 38, 38, 0.95)"
  );

  const putColors = toColorArray(
    labels.length,
    "rgba(34, 197, 94, 0.45)",
    supportIndex,
    "rgba(22, 163, 74, 0.95)"
  );

  clearChart();

  const maxPainLinePlugin = {
    id: "maxPainLine",
    afterDraw(chart) {
      if (maxPainIndex < 0) {
        return;
      }

      const { ctx, chartArea, scales } = chart;
      const x = scales.x.getPixelForValue(maxPainIndex);

      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = "rgba(37, 99, 235, 0.95)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(37, 99, 235, 0.95)";
      ctx.font = "12px Arial";
      ctx.fillText(`Max Pain: ${analysis.maxPain}`, x + 8, chartArea.top + 16);
      ctx.restore();
    }
  };

  oiChart = new Chart(chartCanvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Call OI",
          data: callData,
          backgroundColor: callColors,
          borderColor: callColors,
          borderWidth: 1
        },
        {
          label: "Put OI",
          data: putData,
          backgroundColor: putColors,
          borderColor: putColors,
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false
      },
      plugins: {
        legend: {
          position: "top"
        },
        tooltip: {
          callbacks: {
            title(items) {
              const index = items[0].dataIndex;
              return `Strike Price: ${labels[index]}`;
            },
            label(context) {
              const index = context.dataIndex;
              const call = callData[index];
              const put = putData[index];
              return [
                `Call OI: ${call.toLocaleString()}`,
                `Put OI: ${put.toLocaleString()}`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "Strike Price"
          }
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Open Interest"
          }
        }
      }
    },
    plugins: [maxPainLinePlugin]
  });

  statusText.textContent =
    `Loaded ${rows.length} strikes | Max Pain ${analysis.maxPain ?? "-"} | ` +
    `Support ${analysis.strongestSupport ?? "-"} | Resistance ${analysis.strongestResistance ?? "-"}`;
}

async function loadAnalysis(force = false) {
  const expiry = expiryDropdown.value;
  if (!expiry) {
    statusText.textContent = "Select an expiry first.";
    return;
  }

  const url = `/api/options/gold/analysis?expiry=${encodeURIComponent(expiry)}&t=${Date.now()}`;

  setLoading(true, `Loading data for ${expiry}...`);
  const response = await fetch(url, {
    headers: {
      accept: "application/json, text/plain, */*"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to load analysis (${response.status})`);
  }

  const payload = await response.json();
  buildChart(payload);
  setLoading(false, `Loaded ${expiry}.`);
}

loadBtn.addEventListener("click", () => loadAnalysis(false).catch((err) => {
  setLoading(false, err.message);
}));

refreshBtn.addEventListener("click", () => loadAnalysis(true).catch((err) => {
  setLoading(false, err.message);
}));

expiryDropdown.addEventListener("change", () => {
  statusText.textContent = `Selected ${expiryDropdown.value}.`;
});

loadExpiries().catch((err) => {
  setLoading(false, err.message);
});
