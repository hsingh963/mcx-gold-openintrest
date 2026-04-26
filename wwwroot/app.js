const compareToggle = document.getElementById("compareToggle");
const singleView = document.getElementById("singleView");
const compareView = document.getElementById("compareView");

const commodityDropdown = document.getElementById("commodityDropdown");
const expiryDropdown = document.getElementById("expiryDropdown");
const rangeSelector = document.getElementById("rangeSelector");
const loadBtn = document.getElementById("loadBtn");
const refreshBtn = document.getElementById("refreshBtn");
const ltpBox = document.getElementById("ltpBox");

const goldExpiryDropdown = document.getElementById("goldExpiry");
const goldLoadBtn = document.getElementById("goldLoadBtn");
const goldmExpiryDropdown = document.getElementById("goldmExpiry");
const goldmLoadBtn = document.getElementById("goldmLoadBtn");

const chartInstances = {};
let isCompareMode = false;

if (typeof Chart !== "undefined" && typeof ChartDataLabels !== "undefined") {
  Chart.register(ChartDataLabels);
}

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
  setDisabled(rangeSelector, isLoading);
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
  const existing = chartInstances[canvasId];
  if (existing) {
    existing.destroy();
    delete chartInstances[canvasId];
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

function generateInsight(analysis) {
  const signal = String(analysis?.oiSignal || "");
  const sentiment = String(analysis?.marketSentiment?.label || "");

  if (sentiment.includes("Bullish")) {
    return "🐂 Bullish sentiment with buying support near ATM.";
  }

  if (sentiment.includes("Bearish")) {
    return "🐻 Bearish pressure with resistance near ATM.";
  }

  if (signal === "Short Covering") {
    return "🚀 Short covering seen -> possible upside move.";
  }

  if (signal === "Long Unwinding") {
    return "⚠️ Long unwinding -> market losing strength.";
  }

  return "📊 Market is balanced around ATM with no strong bias.";
}

function parseExpiry(expiry) {
  if (typeof expiry !== "string" || expiry.length < 9) {
    return new Date(0);
  }

  const day = parseInt(expiry.substring(0, 2), 10);
  const monthStr = expiry.substring(2, 5).toUpperCase();
  const year = parseInt(expiry.substring(5), 10);

  const months = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3,
    MAY: 4, JUN: 5, JUL: 6, AUG: 7,
    SEP: 8, OCT: 9, NOV: 10, DEC: 11
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
    controls.explanationBox.innerText = "📘 Insight: " + generateInsight(analysis);
  }
}

function renderChart(data, canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !data || !data.data) {
    return;
  }

  clearChart(canvasId);

  const rows = [...data.data].sort((a, b) => Number(a.strikePrice) - Number(b.strikePrice));
  const analysis = data.analysis || {};
  const atm = Number(analysis.atm || 0);
  const rangeValue = document.getElementById("rangeSelector")?.value || "10";

  let filteredData = rows;
  const atmIndex = rows.findIndex((x) => Number(x.strikePrice) === atm);

  if (rangeValue !== "all" && atmIndex !== -1) {
    const range = parseInt(rangeValue, 10);
    if (!Number.isNaN(range)) {
      filteredData = rows.slice(Math.max(0, atmIndex - range), atmIndex + range + 1);
    }
  }

  const importantStrikesSet = new Set([
    Number(analysis.atm || 0),
    Number(analysis.maxPain || 0),
    Number(analysis.strongestSupport || 0),
    Number(analysis.strongestResistance || 0)
  ]);

  const importantData = rows.filter((x) => importantStrikesSet.has(Number(x.strikePrice)));

  filteredData = [
    ...filteredData,
    ...importantData
  ].filter((value, index, array) =>
    array.findIndex((entry) => Number(entry.strikePrice) === Number(value.strikePrice)) === index
  );

  filteredData.sort((a, b) => Number(a.strikePrice) - Number(b.strikePrice));

  const currentPrice = analysis.currentPrice;
  if (ltpBox) {
    if (currentPrice) {
      ltpBox.innerText = `💰 ₹ ${Math.round(currentPrice).toLocaleString()}`;
    } else if (analysis.atm) {
      ltpBox.innerText = `ATM ₹ ${Number(analysis.atm).toLocaleString()} (approx)`;
    } else {
      ltpBox.innerText = "₹ --";
    }
  }

  const labels = filteredData.map((x) => `${(Number(x.strikePrice) / 100000).toFixed(2)}L`);
  const callData = filteredData.map((x) => Number(x.callOI || 0));
  const putData = filteredData.map((x) => Number(x.putOI || 0));
  const strongestSupport = Number(analysis.strongestSupport || 0);
  const strongestResistance = Number(analysis.strongestResistance || 0);
  const maxPain = Number(analysis.maxPain || 0);
  const maxPainIndex = filteredData.findIndex((x) => Number(x.strikePrice) === maxPain);
  const atmLabel = `${(atm / 100000).toFixed(2)}L`;

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

  const chart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Call OI",
          data: callData,
          backgroundColor: filteredData.map((x) => {
            const strike = Number(x.strikePrice);
            if (strike === atm) return "#00ffff";
            return "#ff3b3b";
          }),
          borderColor: filteredData.map((x) => {
            const strike = Number(x.strikePrice);
            if (strike === atm) return "#00ffff";
            return "#ff3b3b";
          }),
          borderWidth: 1
        },
        {
          label: "Put OI",
          data: putData,
          backgroundColor: filteredData.map((x) => {
            const strike = Number(x.strikePrice);
            if (strike === atm) return "#00ffff";
            return "#00ff00";
          }),
          borderColor: filteredData.map((x) => {
            const strike = Number(x.strikePrice);
            if (strike === atm) return "#00ffff";
            return "#00ff00";
          }),
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
        datalabels: {
          color: "#e6eef7",
          anchor: "end",
          align: "top",
          font: { size: 10 },
          formatter(value, context) {
            const strike = Number(filteredData[context.dataIndex]?.strikePrice || 0);
            if (importantStrikesSet.has(strike)) {
              return `${(strike / 100000).toFixed(2)}L`;
            }
            return "";
          }
        },
        annotation: {
          annotations: {
            atmLine: {
              type: "line",
              xMin: atmLabel,
              xMax: atmLabel,
              borderColor: "#00ffff",
              borderWidth: 2,
              label: {
                display: true,
                content: `ATM ${atmLabel}`,
                color: "#00ffff",
                backgroundColor: "#000",
                position: "start"
              }
            }
          }
        },
        tooltip: {
          callbacks: {
            title(context) {
              const index = context[0].dataIndex;
              const strike = filteredData[index]?.strikePrice ?? 0;
              return `Strike: ₹ ${Number(strike).toLocaleString()}`;
            },
            label(context) {
              return `${context.dataset.label}: ${context.raw}`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: "#e6eef7",
            autoSkip: true,
            maxTicksLimit: 12,
            minRotation: 45,
            maxRotation: 60,
            callback(value, index) {
              return index % 3 === 0 ? labels[index] : "";
            }
          },
          title: { display: true, text: "Strike Price (₹ Lakhs)", color: "#e6eef7" },
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
  });

  chartInstances[canvasId] = chart;
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

  if (rangeSelector) {
    rangeSelector.addEventListener("change", () => loadSingleAnalysis());
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
