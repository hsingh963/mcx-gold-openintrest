const expiryDropdown = document.getElementById("expiryDropdown");
const loadBtn = document.getElementById("loadBtn");
const refreshBtn = document.getElementById("refreshBtn");
const chartImage = document.getElementById("chartImage");
const statusText = document.getElementById("status");

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
    chartImage.removeAttribute("src");
    return;
  }

  setLoading(false, "Ready.");
  await loadGraph(true);
}

async function loadGraph(force = false) {
  const expiry = expiryDropdown.value;
  if (!expiry) {
    statusText.textContent = "Select an expiry first.";
    return;
  }

  const url = `/api/options/gold/graph?expiry=${encodeURIComponent(expiry)}&t=${Date.now()}`;

  setLoading(true, `Loading graph for ${expiry}...`);
  await new Promise((resolve, reject) => {
    chartImage.onload = () => resolve();
    chartImage.onerror = () => reject(new Error("Failed to load graph image."));
    chartImage.src = url;
  });

  setLoading(false, `Loaded ${expiry}.`);
}

loadBtn.addEventListener("click", () => loadGraph(false).catch((err) => {
  setLoading(false, err.message);
}));

refreshBtn.addEventListener("click", () => loadGraph(true).catch((err) => {
  setLoading(false, err.message);
}));

expiryDropdown.addEventListener("change", () => {
  statusText.textContent = `Selected ${expiryDropdown.value}.`;
});

loadExpiries().catch((err) => {
  setLoading(false, err.message);
});
