(function (global) {
  const globalPlugins = [];

  class MiniChart {
    constructor(canvas, config) {
      this.canvas = typeof canvas === "string" ? document.getElementById(canvas) : canvas;
      if (!this.canvas) {
        throw new Error("Canvas element not found");
      }

      this.ctx = this.canvas.getContext("2d");
      this.config = config || {};
      this.data = this.config.data || { labels: [], datasets: [] };
      this.options = this.config.options || {};
      this.plugins = [...globalPlugins, ...(this.config.plugins || [])];
      this._resizeHandler = () => this.render();
      window.addEventListener("resize", this._resizeHandler);
      this.render();
    }

    static register(...plugins) {
      plugins.flat().forEach((plugin) => {
        if (!plugin || globalPlugins.includes(plugin)) {
          return;
        }
        globalPlugins.push(plugin);
      });
    }

    static unregister(...plugins) {
      plugins.flat().forEach((plugin) => {
        const index = globalPlugins.indexOf(plugin);
        if (index >= 0) {
          globalPlugins.splice(index, 1);
        }
      });
    }

    destroy() {
      window.removeEventListener("resize", this._resizeHandler);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    _setCanvasSize() {
      const rect = this.canvas.getBoundingClientRect();
      const width = Math.max(300, Math.floor(rect.width));
      const height = Math.max(260, Math.floor(rect.height));
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = Math.floor(width * dpr);
      this.canvas.height = Math.floor(height * dpr);
      this.canvas.style.width = width + "px";
      this.canvas.style.height = height + "px";
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.width = width;
      this.height = height;
    }

    _clear() {
      this.ctx.clearRect(0, 0, this.width, this.height);
      this.ctx.fillStyle = "#12181f";
      this.ctx.fillRect(0, 0, this.width, this.height);
    }

    _getScaleOptions() {
      return (this.options.scales && this.options.scales.x && this.options.scales.x.ticks) || {};
    }

    render() {
      if (!this.canvas) return;
      this._setCanvasSize();
      this._clear();

      const labels = this.data.labels || [];
      const datasets = this.data.datasets || [];
      const left = 64;
      const right = 20;
      const top = 30;
      const bottom = 60;
      const plotWidth = Math.max(1, this.width - left - right);
      const plotHeight = Math.max(1, this.height - top - bottom);
      const originX = left;
      const originY = top + plotHeight;
      const maxValue = Math.max(1, ...datasets.flatMap(d => (d.data || []).map(v => Number(v) || 0)));
      const groupWidth = labels.length ? plotWidth / labels.length : plotWidth;
      const barPadding = Math.max(4, Math.min(10, groupWidth * 0.16));
      const barWidth = Math.max(6, (groupWidth - barPadding * 3) / Math.max(1, datasets.length));
      const labelTicks = this._getScaleOptions();

      this.ctx.save();
      this.ctx.strokeStyle = "rgba(255,255,255,0.18)";
      this.ctx.fillStyle = "#e6eef7";
      this.ctx.font = "12px Arial";

      const tickCount = 5;
      for (let i = 0; i <= tickCount; i++) {
        const y = originY - (plotHeight * i) / tickCount;
        const value = Math.round((maxValue * i) / tickCount);
        this.ctx.beginPath();
        this.ctx.strokeStyle = "rgba(255,255,255,0.08)";
        this.ctx.moveTo(originX, y);
        this.ctx.lineTo(originX + plotWidth, y);
        this.ctx.stroke();
        this.ctx.fillStyle = "#9bb0c4";
        this.ctx.fillText(String(value), 10, y + 4);
      }

      this.ctx.strokeStyle = "rgba(255,255,255,0.35)";
      this.ctx.beginPath();
      this.ctx.moveTo(originX, top);
      this.ctx.lineTo(originX, originY);
      this.ctx.lineTo(originX + plotWidth, originY);
      this.ctx.stroke();

      datasets.forEach((dataset, dsIndex) => {
        const values = dataset.data || [];
        const color = dataset.backgroundColor || "#00ff00";
        values.forEach((value, index) => {
          const numeric = Number(value) || 0;
          const groupX = originX + index * groupWidth;
          const x = groupX + barPadding + dsIndex * (barWidth + barPadding);
          const h = (numeric / maxValue) * (plotHeight - 8);
          const y = originY - h;
          this.ctx.fillStyle = Array.isArray(color) ? color[index] : color;
          this.ctx.fillRect(x, y, barWidth, h);
          this.ctx.strokeStyle = "rgba(255,255,255,0.12)";
          this.ctx.strokeRect(x, y, barWidth, h);
        });
      });

      this.ctx.fillStyle = "#e6eef7";
      this.ctx.font = "11px Arial";
      labels.forEach((label, index) => {
        const cb = labelTicks.callback;
        let text = String(label);
        if (typeof cb === "function") {
          const tickValue = index;
          const tick = { label };
          const result = cb.call(labelTicks, tickValue, index, labels);
          if (result === "") {
            return;
          }
          text = String(result);
        }
        const x = originX + index * groupWidth + groupWidth / 2;
        const metrics = this.ctx.measureText(text);
        this.ctx.fillText(text, x - metrics.width / 2, originY + 22);
      });

      const legend = (this.options.plugins && this.options.plugins.legend) ? this.options.plugins.legend : null;
      if (legend !== null) {
        const legendItems = datasets.map(d => ({ text: d.label, color: d.backgroundColor }));
        const legendX = originX;
        let cursorX = legendX;
        legendItems.forEach(item => {
          this.ctx.fillStyle = Array.isArray(item.color) ? item.color[0] : item.color;
          this.ctx.fillRect(cursorX, 6, 14, 14);
          this.ctx.fillStyle = "#e6eef7";
          this.ctx.fillText(item.text, cursorX + 20, 18);
          cursorX += 110;
        });
      }

      this.ctx.restore();

      const chartArea = { top, bottom: originY, left: originX, right: originX + plotWidth };
      const xScale = {
        getPixelForValue: (index) => originX + index * groupWidth + groupWidth / 2
      };
      const chart = { ctx: this.ctx, chartArea, scales: { x: xScale } };

      this.plugins.forEach((plugin) => {
        if (plugin && typeof plugin.afterDraw === "function") {
          plugin.afterDraw(chart);
        }
      });
    }
  }

  global.Chart = MiniChart;
})(window);
