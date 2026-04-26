const expiryDropdown = document.getElementById("expiryDropdown");
const commodityDropdown = document.getElementById("commodityDropdown");
const loadBtn = document.getElementById("loadBtn");
const refreshBtn = document.getElementById("refreshBtn");
const chartCanvas = document.getElementById("oiChart");
const statusText = document.getElementById("status");
const pcrValue = document.getElementById("pcrValue");
const pcrFill = document.getElementById("pcrFill");
const pcrLabel = document.getElementById("pcrLabel");
const pcrCard = document.getElementById("pcrCard");
const oiCard = document.getElementById("oiCard");
const sentimentCard = document.getElementById("sentimentCard");
const explanationBox = document.getElementById("explanationBox");
let oiChart = null;

function setLoading(isLoading, message) {
  loadBtn.disabled = isLoading;
  refreshBtn.disabled = isLoading;
  expiryDropdown.disabled = isLoading;
  commodityDropdown.disabled = isLoading;
  statusText.textContent = message;
}

async function loadExpiries() {
  try {
    setLoading(true, "Loading expiries...");
    const commodity = document.getElementById("commodityDropdown").value || "GOLD";
    const url = `/api/options/expiries?commodity=${encodeURIComponent(commodity)}`;
    console.log("Fetching expiries URL:", url);

    const response = await fetch(url);
    console.log("Expiries response status:", response.status);

    if (!response.ok) {
      const body = await response.text();
      console.error("Failed to load expiries response body:", body);
      throw new Error("Failed to load expiries");
    }

    const data = await response.json();
    const dropdown = document.getElementById("expiryDropdown");
    dropdown.innerHTML = "";

    data.forEach((exp) => {
      const opt = document.createElement("option");
      opt.value = exp;
      opt.text = exp;
      dropdown.appendChild(opt);
    });

    if (data.length === 0) {
      clearChart();
      statusText.textContent = "No expiries found.";
      return;
    }

    statusText.textContent = "";
    await loadAnalysis(true);
  } catch (err) {
    console.error("Error loading expiries:", err);
    setLoading(false, "Failed to load expiries");
  } finally {
    if (!expiryDropdown.options.length) {
      setLoading(false, statusText.textContent || "Ready.");
    }
  }
}

function clearChart() {
  if (oiChart) {
    oiChart.destroy();
    oiChart = null;
  }
}

function renderPCR(pcr) {
  const pcrSentiment = pcr > 1.2 ? "Bullish" : pcr < 0.8 ? "Bearish" : "Sideways";
  const pcrColor = pcr > 1.2 ? "green" : pcr < 0.8 ? "red" : "orange";

  pcrCard.innerHTML = `
    <h3>PCR</h3>
    <div class="value" style="color:${pcrColor}">PCR: ${pcr.toFixed(2)}</div>
    <div class="label" style="color:${pcrColor}">${pcrSentiment}</div>
  `;

  pcrValue.innerText = `PCR: ${pcr.toFixed(2)}`;

  let meterLabel = "Sideways";
  let meterColor = "orange";
  if (pcr > 1.2) {
    meterLabel = "Bullish";
    meterColor = "green";
  } else if (pcr < 0.8) {
    meterLabel = "Bearish";
    meterColor = "red";
  }

  const normalized = Math.min(pcr, 2.0);
  const percent = (normalized / 2.0) * 100;
  pcrFill.style.width = `${percent}%`;
  pcrFill.style.backgroundColor = meterColor;
  pcrLabel.innerText = meterLabel;
  pcrLabel.style.color = meterColor;

  return { pcrColor };
}

function renderOISignal(oiSignal, atm) {
  const oiColor =
    oiSignal === "Long Buildup" || oiSignal === "Short Covering" ? "green" :
    oiSignal === "Short Buildup" || oiSignal === "Long Unwinding" ? "red" : "orange";

  oiCard.innerHTML = `
    <h3>OI Change Analysis</h3>
    <div class="value" style="color:${oiColor}">${oiSignal}</div>
    <div class="label" style="color:${oiColor}">ATM: ${atm ?? "-"}</div>
  `;

  explanationBox.textContent = getExplanation(oiSignal);
}

function renderSentiment(marketSentiment, pcrColor) {
  const label = String(marketSentiment?.label ?? "Neutral");
  const reason = String(marketSentiment?.reason ?? "");

  sentimentCard.innerHTML = `
    <h3>Market Sentiment</h3>
    <div class="value" style="color:${pcrColor}">${label}</div>
    <div class="label">${reason}</div>
  `;
}

function toColorArray(length, baseColor, highlightIndex, highlightColor) {
  return Array.from({ length }, (_, index) => (index === highlightIndex ? highlightColor : baseColor));
}

function buildChart(payload) {
  const rows = payload?.data ?? [];
  const analysis = payload?.analysis ?? {};
  const pcr = Number(analysis.pcr ?? 0);
  const oiSignal = String(analysis.oiSignal ?? "Neutral");
  const marketSentiment = analysis.marketSentiment ?? {};

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

  const { pcrColor } = renderPCR(pcr);
  renderOISignal(oiSignal, analysis.atm);
  renderSentiment(marketSentiment, pcrColor);
}

async function loadAnalysis(force = false) {
  const expiry = expiryDropdown.value;
  if (!expiry) {
    statusText.textContent = "Select an expiry first.";
    return;
  }

  const commodity = commodityDropdown.value || "GOLD";
  const url = `/api/options/analysis?commodity=${encodeURIComponent(commodity)}&expiry=${encodeURIComponent(expiry)}&t=${Date.now()}`;
  console.log("Calling analysis URL:", url);

  setLoading(true, `Loading data for ${commodity} ${expiry}...`);
  const response = await fetch(url, {
    headers: {
      accept: "application/json, text/plain, */*"
    }
  });
  console.log("Analysis response status:", response.status);

  if (!response.ok) {
    const body = await response.text();
    console.error("Failed to load analysis response body:", body);
    throw new Error("Failed to load analysis");
  }

  const payload = await response.json();
  if (!payload || !payload.data || payload.data.length === 0) {
    statusText.textContent = "No data available";
    clearChart();
    setLoading(false, "No data available");
    return;
  }

  const pcr = payload?.analysis?.pcr ?? 0;
  if (!pcr || pcr === 0) {
    console.warn("PCR is zero - check backend calculation");
  }
  buildChart(payload);
  setLoading(false, `Loaded ${expiry}.`);
}

loadBtn.addEventListener("click", () => loadAnalysis(false).catch((err) => {
  console.error("Error loading analysis:", err);
  setLoading(false, "Failed to load analysis");
}));

refreshBtn.addEventListener("click", () => loadAnalysis(true).catch((err) => {
  console.error("Error refreshing analysis:", err);
  setLoading(false, "Failed to load analysis");
}));

expiryDropdown.addEventListener("change", () => {
  statusText.textContent = `Selected ${expiryDropdown.value}.`;
});

commodityDropdown.addEventListener("change", () => {
  statusText.textContent = `Selected ${commodityDropdown.value}.`;
});

document.addEventListener("DOMContentLoaded", () => {
  loadExpiries();
});

function getExplanation(oiSignal) {
  switch (oiSignal) {
    case "Long Buildup":
      return "New buying positions are being created. Traders expect prices to rise.";
    case "Short Buildup":
      return "New short positions are being created. Traders expect prices to fall.";
    case "Short Covering":
      return "Short sellers are exiting positions. This can push prices up.";
    case "Long Unwinding":
      return "Buyers are exiting positions. This can push prices down.";
    default:
      return "No clear OI signal is present for the current ATM strike.";
  }
}
