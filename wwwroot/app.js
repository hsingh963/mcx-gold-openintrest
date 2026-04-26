const compareToggle = document.getElementById("compareToggle");
const singleView = document.getElementById("singleView");
const compareView = document.getElementById("compareView");

const commodityDropdown = document.getElementById("commodityDropdown");
const expiryDropdown = document.getElementById("expiryDropdown");
const loadBtn = document.getElementById("loadBtn");
const refreshBtn = document.getElementById("refreshBtn");

const goldExpiryDropdown = document.getElementById("goldExpiry");
const goldLoadBtn = document.getElementById("goldLoadBtn");
const goldmExpiryDropdown = document.getElementById("goldmExpiry");
const goldmLoadBtn = document.getElementById("goldmLoadBtn");

const chartInstances = new Map();
let isCompareMode = false;

function setDisabled(el, disabled) {
  if (el) {
    el.disabled = disabled;
  }
}

function setSingleLoading(isLoading) {
  setDisabled(loadBtn, isLoading);
  setDisabled(refreshBtn, isLoading);
  setDisabled(commodityDropdown, isLoading);
  setDisabled(expiryDropdown, isLoading);
}

function setCompareLoading(prefix, isLoading) {
  const controls = getPanelControls(prefix);
  setDisabled(controls.loadBtn, isLoading);
  setDisabled(controls.expiryDropdown, isLoading);
}

function getPanelControls(prefix) {
  if (prefix === "gold") {
    return {
      expiryDropdown: goldExpiryDropdown,
      loadBtn: goldLoadBtn,
      explanationBox: document.getElementById("goldExplanationBox"),
      chartId: "goldChart",
      pcrCard: document.getElementById("goldPcrCard"),
      oiCard: document.getElementById("goldOiCard"),
      sentimentCard: document.getElementById("goldSentimentCard")
    };
  }

  if (prefix === "goldm") {
    return {
      expiryDropdown: goldmExpiryDropdown,
      loadBtn: goldmLoadBtn,
      explanationBox: document.getElementById("goldmExplanationBox"),
      chartId: "goldmChart",
      pcrCard: document.getElementById("goldmPcrCard"),
      oiCard: document.getElementById("goldmOiCard"),
      sentimentCard: document.getElementById("goldmSentimentCard")
    };
  }

  return {
    expiryDropdown,
    loadBtn,
    explanationBox: document.getElementById("explanationBox"),
    chartId: "oiChart",
    pcrCard: document.getElementById("pcrCard"),
    oiCard: document.getElementById("oiCard"),
    sentimentCard: document.getElementById("sentimentCard")
  };
}

function setViewMode(compare) {
  isCompareMode = compare;
  if (singleView) {
    singleView.classList.toggle("hidden", compare);
  }
  if (compareView) {
    compareView.classList.toggle("hidden", !compare);
  }
  if (compareToggle) {
    compareToggle.textContent = compare ? "Single Mode" : "Compare Mode";
  }
}

function clearChart(canvasId) {
  const existing = chartInstances.get(canvasId);
  if (existing) {
    existing.destroy();
    chartInstances.delete(canvasId);
  }
}

function getEmoji(text) {
  if (!text) return "⚖️";

  if (text.includes("Strong Bullish")) return "🚀🐂";
  if (text.includes("Bullish")) return "🐂";
  if (text.includes("Strong Bearish")) return "💥🐻";
  if (text.includes("Bearish")) return "🐻";
  if (text.includes("Short Covering")) return "🚀";
  if (text.includes("Long Buildup")) return "📈";
  if (text.includes("Short Buildup")) return "📉";
  if (text.includes("Long Unwinding")) return "⚠️";

  return "⚖️";
}

function getClass(text) {
  const value = String(text || "");
  if (value.includes("Bull")) return "bullish";
  if (value.includes("Bear")) return "bearish";
  return "neutral";
}

function getExplanation(signal) {
  const map = {
    "Long Buildup": "New buying positions are being created. Traders expect prices to rise.",
    "Short Buildup": "New short positions are being created. Traders expect prices to fall.",
    "Short Covering": "Short sellers are exiting positions. This can push prices up.",
    "Long Unwinding": "Buyers are exiting positions. This can push prices down."
  };

  return map[signal] || "";
}

function parseExpiry(expiry) {
  if (typeof expiry !== "string" || expiry.length < 9) {
    return new Date(0);
  }

  const day = parseInt(expiry.substring(0, 2), 10);
  const monthStr = expiry.substring(2, 5).toUpperCase();
  const year = parseInt(expiry.substring(5), 10);

  const months = {
    JAN: 0,
    FEB: 1,
    MAR: 2,
    APR: 3,
    MAY: 4,
    JUN: 5,
    JUL: 6,
    AUG: 7,
    SEP: 8,
    OCT: 9,
    NOV: 10,
    DEC: 11
  };

  if (Number.isNaN(day) || Number.isNaN(year) || !(monthStr in months)) {
    return new Date(0);
  }

  return new Date(year, months[monthStr], day);
}

async function fetchExpiries(commodity, selectElement) {
  const url = `/api/options/expiries?commodity=${encodeURIComponent(commodity)}`;
  console.log("Fetching expiries:", url);

  const response = await fetch(url);
  console.log("Expiry response status:", response.status);

  if (!response.ok) {
    const body = await response.text();
    console.error("Expiry response body:", body);
    throw new Error("Failed to load expiries");
  }

  const data = await response.json();
  if (!selectElement) {
    return data;
  }

  const previous = selectElement.value;
  selectElement.innerHTML = "";

  data
    .slice()
    .sort((a, b) => parseExpiry(a) - parseExpiry(b))
    .forEach((exp) => {
    const option = document.createElement("option");
    option.value = exp;
    option.textContent = exp;
    selectElement.appendChild(option);
    });

  if (previous && data.includes(previous)) {
    selectElement.value = previous;
  } else if (data.length > 0) {
    selectElement.value = data[0];
  }

  return data;
}

async function loadSingleExpiries() {
  try {
    setSingleLoading(true);
    const commodity = commodityDropdown?.value || "GOLD";
    await fetchExpiries(commodity, expiryDropdown);
    if (expiryDropdown && expiryDropdown.value) {
      await loadSingleAnalysis();
    }
  } catch (err) {
    console.error("Error loading expiries:", err);
    const box = document.getElementById("explanationBox");
    if (box) {
      box.innerText = "Failed to load expiries";
    }
  } finally {
    setSingleLoading(false);
  }
}

async function loadCompareExpiries() {
  try {
    await Promise.all([
      fetchExpiries("GOLD", goldExpiryDropdown),
      fetchExpiries("GOLDM", goldmExpiryDropdown)
    ]);
    await Promise.all([
      loadPanelAnalysis("GOLD", "gold"),
      loadPanelAnalysis("GOLDM", "goldm")
    ]);
  } catch (err) {
    console.error("Error loading compare expiries:", err);
  }
}

async function fetchAnalysis(commodity, expiry) {
  const url = `/api/options/analysis?commodity=${encodeURIComponent(commodity)}&expiry=${encodeURIComponent(expiry)}&t=${Date.now()}`;
  console.log("Calling API:", url);

  const response = await fetch(url, {
    headers: {
      accept: "application/json, text/plain, */*"
    }
  });

  console.log("Response status:", response.status);

  if (!response.ok) {
    const body = await response.text();
    console.error("Response body:", body);
    throw new Error("Failed to load analysis");
  }

  const data = await response.json();
  if (!data || !data.data || data.data.length === 0) {
    return null;
  }

  return data;
}

function renderCards(data, containerPrefix = "") {
  const controls = getPanelControls(containerPrefix);
  const analysis = data?.analysis || {};
  const pcr = Number(analysis.pcr || 0);
  const oiSignal = String(analysis.oiSignal || "");
  const sentimentLabel = String(analysis.marketSentiment?.label || "Neutral");
  const sentimentReason = String(analysis.marketSentiment?.reason || "");

  if (controls.pcrCard) {
    const pcrClass = getClass(pcr > 1.2 ? "Bull" : pcr < 0.8 ? "Bear" : "Neutral");
    controls.pcrCard.className = `card ${pcrClass}`;
    controls.pcrCard.innerHTML = `<h3>📈 PCR</h3><p>${pcr.toFixed(2)}</p>`;
  }

  if (controls.oiCard) {
    controls.oiCard.className = `card ${getClass(oiSignal)}`;
    controls.oiCard.innerHTML = `<h3>⚡ OI Signal</h3><p>${getEmoji(oiSignal)} ${oiSignal}</p>`;
  }

  if (controls.sentimentCard) {
    controls.sentimentCard.className = `card ${getClass(sentimentLabel)}`;
    controls.sentimentCard.innerHTML =
      `<h3>🧠 Market Sentiment</h3>
       <p>${getEmoji(sentimentLabel)} ${sentimentLabel}</p>
       <small>${sentimentReason}</small>`;
  }

  if (controls.explanationBox) {
    controls.explanationBox.innerText = "📘 Insight: " + getExplanation(oiSignal);
  }
}

function renderChart(data, canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !data || !data.data) {
    return;
  }

  clearChart(canvasId);

  const rows = [...data.data].sort((a, b) => Number(a.strikePrice) - Number(b.strikePrice));
  const labels = rows.map((x) => x.strikePrice);
  const callData = rows.map((x) => Number(x.callOI || 0));
  const putData = rows.map((x) => Number(x.putOI || 0));
  const strongestSupport = String(data.analysis?.strongestSupport ?? "");
  const strongestResistance = String(data.analysis?.strongestResistance ?? "");
  const maxPain = String(data.analysis?.maxPain ?? "");
  const maxPainIndex = labels.findIndex((x) => String(x) === maxPain);

  const callColors = labels.map((value) =>
    String(value) === strongestResistance ? "rgba(255, 59, 59, 0.95)" : "rgba(255, 59, 59, 0.45)"
  );
  const putColors = labels.map((value) =>
    String(value) === strongestSupport ? "rgba(0, 255, 0, 0.95)" : "rgba(0, 255, 0, 0.45)"
  );

  const maxPainPlugin = {
    id: `maxPainLine-${canvasId}`,
    afterDraw(chart) {
      if (maxPainIndex < 0) {
        return;
      }

      const { ctx, chartArea, scales } = chart;
      const x = scales.x.getPixelForValue(maxPainIndex);

      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = "rgba(59, 130, 246, 0.95)";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(59, 130, 246, 0.95)";
      ctx.font = "12px Arial";
      ctx.fillText(`Max Pain: ${maxPain}`, x + 8, chartArea.top + 16);
      ctx.restore();
    }
  };

  chartInstances.set(
    canvasId,
    new Chart(canvas, {
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
        animation: false,
        interaction: {
          mode: "index",
          intersect: false
        },
        plugins: {
          legend: {
            labels: { color: "#e6eef7" }
          },
          tooltip: {
            callbacks: {
              title(items) {
                const index = items[0].dataIndex;
                return `Strike Price: ${labels[index]}`;
              },
              label(context) {
                const index = context.dataIndex;
                return [
                  `Call OI: ${Number(callData[index] || 0).toLocaleString()}`,
                  `Put OI: ${Number(putData[index] || 0).toLocaleString()}`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: "#e6eef7" },
            title: { display: true, text: "Strike Price", color: "#e6eef7" },
            grid: { color: "rgba(255,255,255,0.06)" }
          },
          y: {
            beginAtZero: true,
            ticks: { color: "#e6eef7" },
            title: { display: true, text: "Open Interest", color: "#e6eef7" },
            grid: { color: "rgba(255,255,255,0.06)" }
          }
        }
      },
      plugins: [maxPainPlugin]
    })
  );
}

async function loadSingleAnalysis() {
  const commodity = commodityDropdown?.value || "GOLD";
  const expiry = expiryDropdown?.value || "";

  if (!expiry) {
    const box = document.getElementById("explanationBox");
    if (box) {
      box.innerText = "Select an expiry first.";
    }
    return;
  }

  const url = `/api/options/analysis?commodity=${encodeURIComponent(commodity)}&expiry=${encodeURIComponent(expiry)}`;
  console.log("Calling API:", commodity, expiry);
  console.log("Analysis URL:", url);

  setSingleLoading(true);
  try {
    const payload = await fetchAnalysis(commodity, expiry);
    if (!payload) {
      const box = document.getElementById("explanationBox");
      if (box) {
        box.innerText = "No data available";
      }
      clearChart("oiChart");
      return;
    }

    renderCards(payload);
    renderChart(payload, "oiChart");
  } catch (err) {
    console.error("Error loading analysis:", err);
    const box = document.getElementById("explanationBox");
    if (box) {
      box.innerText = "Failed to load analysis";
    }
  } finally {
    setSingleLoading(false);
  }
}

async function loadPanelAnalysis(commodity, prefix) {
  const controls = getPanelControls(prefix);
  const expiry = controls.expiryDropdown?.value || "";
  if (!expiry) {
    if (controls.explanationBox) {
      controls.explanationBox.innerText = "Select an expiry first.";
    }
    return;
  }

  setCompareLoading(prefix, true);
  try {
    const payload = await fetchAnalysis(commodity, expiry);
    if (!payload) {
      if (controls.explanationBox) {
        controls.explanationBox.innerText = "No data available";
      }
      clearChart(controls.chartId);
      return;
    }

    renderCards(payload, prefix);
    renderChart(payload, controls.chartId);
  } catch (err) {
    console.error(`Error loading ${commodity} analysis:`, err);
    if (controls.explanationBox) {
      controls.explanationBox.innerText = "Failed to load analysis";
    }
  } finally {
    setCompareLoading(prefix, false);
  }
}

async function loadSingleExpiriesAndAnalysis() {
  await loadSingleExpiries();
}

function wireEvents() {
  if (compareToggle) {
    compareToggle.addEventListener("click", async () => {
      setViewMode(!isCompareMode);
      if (isCompareMode) {
        await loadCompareExpiries();
      } else {
        await loadSingleExpiriesAndAnalysis();
      }
    });
  }

  if (loadBtn) {
    loadBtn.addEventListener("click", () => loadSingleAnalysis());
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => loadSingleAnalysis());
  }

  if (commodityDropdown) {
    commodityDropdown.addEventListener("change", () => loadSingleExpiriesAndAnalysis());
  }

  if (goldLoadBtn) {
    goldLoadBtn.addEventListener("click", () => loadPanelAnalysis("GOLD", "gold"));
  }

  if (goldmLoadBtn) {
    goldmLoadBtn.addEventListener("click", () => loadPanelAnalysis("GOLDM", "goldm"));
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  setViewMode(false);
  wireEvents();
  await loadSingleExpiriesAndAnalysis();
});
