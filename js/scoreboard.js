/**
 * C2CAD-Bench — interactive scoreboard
 * Renders the leaderboard, model controls, phase filters and expandable families.
 */
(function () {
  "use strict";

  var NAMES = {
    "gemini-2.5-flash": "Gemini 2.5 Flash",
    "gemini-2.5-pro": "Gemini 2.5 Pro",
    "gemini-3.1-flash-lite-preview": "Gemini 3.1 Flash-Lite",
    "gemini-3-flash-preview": "Gemini 3 Flash",
    "gemini-3.1-pro-preview": "Gemini 3.1 Pro",
    "claude-opus-4-6": "Claude Opus 4.6",
    "claude-sonnet-4-6": "Claude Sonnet 4.6",
    "deepseek-chat": "DeepSeek V3.2",
    "deepseek-reasoner": "DeepSeek R1",
    "gpt-4.1": "GPT-4.1",
    "gpt-5.4": "GPT-5.4",
    "gpt-5.4-mini": "GPT-5.4 Mini",
    "kimi-k2.5": "Kimi K2.5",
    "di-qwen3.8-flash": "Qwen 3.8 Flash",
    "di-qwen3.8-27b": "Qwen 3.8 27B",
    "di-qwen3.8-max": "Qwen 3.8 Max",
    "di-deepseek-v4.1-flash": "DeepSeek V4.1 Flash",
    "di-mimo-v2.6-flash": "MiMo V2.6 Flash",
    "di-mimo-v2.6-pro": "MiMo V2.6 Pro",
    "di-hy4-preview": "Tencent Hy4 Preview",
    "di-step-5-preview": "Step 5 Preview",
    "di-claude-sonnet-5-5": "Claude Sonnet 5.5",
    "di-claude-opus-5-5": "Claude Opus 5.5",
    "di-kimi-k3": "Kimi K3",
    "di-glm-5.3": "GLM-5.3",
    "di-gemini-3.7-flash": "Gemini 3.7 Flash"
  };

  function escapeHTML(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function round(value) {
    return Math.round(Number(value) || 0);
  }

  function scoreClass(value) {
    if (value > 80) return "good";
    if (value > 40) return "warn";
    return "bad";
  }

  var Scoreboard = {
    initialized: false,
    modelIds: [],
    visible: new Set(),
    stats: {},
    lookup: {},
    phase: 0,
    expanded: null,
    defaultVisible: 8,

    init: function () {
      if (this.initialized) return;
      var db = window.SHOWCASE_DB;
      if (!db || !Array.isArray(db.golden) || !db.models) {
        this.showError("The evaluation database could not be found.");
        return;
      }

      this.db = db;
      this.buildStats();
      this.buildLookup();

      this.modelIds = Object.keys(db.models).sort(function (a, b) {
        return Scoreboard.stats[b].overall - Scoreboard.stats[a].overall;
      });

      var bestKpi = document.getElementById("kpi-best");
      if (bestKpi && this.modelIds.length) {
        bestKpi.textContent = Math.round(this.stats[this.modelIds[0]].overall) + "%";
      }

      this.visible.clear();
      this.modelIds.slice(0, this.defaultVisible).forEach(
        function (model) {
          Scoreboard.visible.add(model);
        }
      );

      this.updateTabCounts();
      this.renderPodium();
      this.renderChips();
      this.renderSummary();
      this.renderHead();
      this.renderBody();
      this.applyColumnVisibility();
      this.updateToggleButton();
      this.bindEvents();

      this.initialized = true;
    },

    buildStats: function () {
      var db = this.db;
      var self = this;
      this.stats = {};

      Object.keys(db.models).forEach(function (model) {
        var entries = (db.models[model] || []).filter(Boolean);
        var total = entries.length || 1;
        var sum = { global: 0, cov: 0, geom: 0, sem: 0 };
        var phases = {};

        entries.forEach(function (entry) {
          sum.global += Number(entry.score_global) || 0;
          sum.cov += Number(entry.score_cov) || 0;
          sum.geom += Number(entry.score_geom) || 0;
          sum.sem += Number(entry.score_sem) || 0;

          var phase = Number(entry.phase);
          if (phase) {
            if (!phases[phase]) phases[phase] = { sum: 0, count: 0 };
            phases[phase].sum += Number(entry.score_global) || 0;
            phases[phase].count += 1;
          }
        });

        var phaseScores = {};
        Object.keys(phases).forEach(function (phase) {
          phaseScores[phase] = round(phases[phase].sum / phases[phase].count);
        });

        self.stats[model] = {
          overall: round(sum.global / total),
          cov: round(sum.cov / total),
          geom: round(sum.geom / total),
          sem: round(sum.sem / total),
          phases: phaseScores
        };
      });
    },

    buildLookup: function () {
      var db = this.db;
      var self = this;
      this.lookup = {};

      Object.keys(db.models).forEach(function (model) {
        var map = {};
        (db.models[model] || []).forEach(function (entry) {
          if (!entry) return;
          map[entry.family + "::" + entry.difficultyID] = entry;
        });
        self.lookup[model] = map;
      });
    },

    findResult: function (model, family, difficultyID) {
      var map = this.lookup[model];
      return map ? map[family + "::" + difficultyID] : undefined;
    },

    getProvider: function (model) {
      if (model.indexOf("di-kimi") === 0) return "kimi";
      if (model.indexOf("di-glm") === 0) return "zhipu";
      if (model.indexOf("di-gemini") === 0) return "gemini";
      if (model.indexOf("di-qwen") === 0) return "qwen";
      if (model.indexOf("di-claude") === 0) return "claude";
      if (model.indexOf("di-deepseek") === 0) return "deepseek";
      if (model.indexOf("di-mimo") === 0) return "xiaomi";
      if (model.indexOf("di-hy4") === 0) return "tencent";
      if (model.indexOf("di-step") === 0) return "stepfun";
      if (model.indexOf("di-") === 0) return "deepinfra";
      if (model.indexOf("gemini") === 0) return "gemini";
      if (model.indexOf("claude") === 0) return "claude";
      if (model.indexOf("deepseek") === 0) return "deepseek";
      if (model.indexOf("gpt") === 0 || model.indexOf("openai") === 0 || model.indexOf("o1") === 0 || model.indexOf("o3") === 0) return "openai";
      if (model.indexOf("mistral") === 0 || model.indexOf("codestral") === 0) return "mistral";
      if (model.indexOf("kimi") === 0 || model.indexOf("moonshot") === 0) return "kimi";
      return "custom";
    },

    getName: function (model) {
      return NAMES[model] || model;
    },

    dot: function (model) {
      return '<span class="provider-dot dot-' + this.getProvider(model) + '" aria-hidden="true"></span>';
    },

    updateTabCounts: function () {
      var counts = { 0: this.db.golden.length, 1: 0, 2: 0, 3: 0, 4: 0 };
      this.db.golden.forEach(function (test) {
        var phase = Number(test.phase);
        if (counts[phase] !== undefined) counts[phase] += 1;
      });

      document.querySelectorAll(".phase-tab").forEach(function (tab) {
        var phase = tab.getAttribute("data-phase");
        var badge = tab.querySelector(".badge");
        if (badge && counts[phase] !== undefined) badge.textContent = String(counts[phase]);
      });
    },

    /* ------------------------------------------------------------------ */
    /* Rendering                                                          */
    /* ------------------------------------------------------------------ */

    renderPodium: function () {
      var host = document.getElementById("podium");
      if (!host) return;

      var self = this;
      var top = this.modelIds.slice(0, 3);
      if (!top.length) {
        host.innerHTML = "";
        return;
      }

      var cards = top
        .map(function (model, index) {
          var stat = self.stats[model];
          function metric(label, value) {
            return (
              '<div class="podium-metric"><span>' + label + "</span>" +
              '<span class="track"><span style="--value:' + value + '%"></span></span>' +
              "<b>" + value + "</b></div>"
            );
          }
          return (
            '<article class="podium-card" data-rank="' + (index + 1) + '">' +
            '<span class="podium-rank">#' + (index + 1) + " overall</span>" +
            '<div class="podium-model">' + self.dot(model) + "<span>" + escapeHTML(self.getName(model)) + "</span></div>" +
            '<div class="podium-score">' + stat.overall + "<small>%</small></div>" +
            '<div class="podium-metrics">' +
            metric("Coverage", stat.cov) +
            metric("Geometry", stat.geom) +
            metric("Semantic", stat.sem) +
            "</div></article>"
          );
        })
        .join("");

      host.innerHTML = '<div class="podium-title">Top 3 models</div><div class="podium-grid">' + cards + "</div>";
    },

    renderChips: function () {
      var bar = document.getElementById("model-toggle-bar");
      if (!bar) return;
      var self = this;
      bar.innerHTML = '<span class="label">Models</span>';

      this.modelIds.forEach(function (model) {
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "model-chip" + (self.visible.has(model) ? " is-active" : "");
        chip.setAttribute("data-model", model);
        chip.setAttribute("aria-pressed", self.visible.has(model) ? "true" : "false");
        chip.innerHTML = self.dot(model) + "<span>" + escapeHTML(self.getName(model)) + "</span>";
        bar.appendChild(chip);
      });
    },

    renderSummary: function () {
      var row = document.getElementById("summary-row");
      if (!row) return;
      var self = this;
      row.innerHTML = "";

      this.modelIds.forEach(function (model, index) {
        var stat = self.stats[model];
        var card = document.createElement("article");
        card.className = "summary-card";
        card.setAttribute("data-model", model);
        if (!self.visible.has(model)) card.hidden = true;

        var phaseTags = [1, 2, 3, 4]
          .filter(function (phase) {
            return stat.phases[phase] !== undefined;
          })
          .map(function (phase) {
            return '<span class="summary-phase">P' + phase + " " + stat.phases[phase] + "</span>";
          })
          .join("");

        function bar(label, value) {
          return (
            '<div class="summary-bar"><span>' + label + "</span>" +
            '<span class="track"><span style="--value:' + value + '%"></span></span>' +
            "<b>" + value + "</b></div>"
          );
        }

        card.innerHTML =
          '<div class="model-name">' + self.dot(model) + "<span>" + escapeHTML(self.getName(model)) + "</span></div>" +
          '<div class="summary-top"><span class="summary-global">' + stat.overall + "<small>%</small></span>" +
          '<span class="summary-rank">#' + (index + 1) + "</span></div>" +
          '<div class="summary-bars">' +
          bar("Cov", stat.cov) +
          bar("Geom", stat.geom) +
          bar("Sem", stat.sem) +
          "</div>" +
          '<div class="summary-phases">' + phaseTags + "</div>";

        row.appendChild(card);
      });
    },

    renderHead: function () {
      var thead = document.getElementById("table-head");
      if (!thead) return;
      var self = this;
      var html = '<tr><th scope="col">Benchmark structure</th>';

      this.modelIds.forEach(function (model, index) {
        var shown = self.visible.has(model);
        html +=
          '<th scope="col" class="col-m-' + index + '"' + (shown ? "" : ' style="display:none"') + ">" +
          '<span class="th-model">' + self.dot(model) + "<span>" + escapeHTML(self.getName(model)) + "</span></span></th>";
      });

      thead.innerHTML = html + "</tr>";
    },

    renderBody: function () {
      var tbody = document.getElementById("table-body");
      if (!tbody) return;
      var self = this;
      var golden = this.db.golden;
      var families = [];
      var current = null;

      golden.forEach(function (test, index) {
        if (!current || current.name !== test.family) {
          current = { name: test.family, phase: Number(test.phase), entries: [] };
          families.push(current);
        }
        current.entries.push({ test: test, index: index });
      });

      var html = "";

      families.forEach(function (family, familyIndex) {
        var fid = "fam-" + familyIndex;
        var levels = family.entries.length;

        html +=
          '<tr class="family-row" data-fid="' + fid + '" data-phase="' + family.phase + '">' +
          "<td>" +
          '<span class="family-line">' +
          '<span class="expand-arrow" aria-hidden="true">' +
          '<svg class="icon" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>' +
          "</span>" +
          '<span class="family-name">' + escapeHTML(family.name) + "</span>" +
          '<span class="family-count">' + levels + " levels</span>" +
          "</span></td>";

        self.modelIds.forEach(function (model, modelIndex) {
          var sum = 0;
          var count = 0;
          family.entries.forEach(function (entry) {
            var result = self.findResult(model, family.name, entry.test.difficultyID);
            if (result) {
              sum += Number(result.score_global) || 0;
              count += 1;
            }
          });
          var avg = count ? round(sum / count) : null;
          var shown = self.visible.has(model);
          html +=
            '<td class="col-m-' + modelIndex + '"' + (shown ? "" : ' style="display:none"') + ">" +
            (avg === null
              ? '<span class="score-empty">—</span>'
              : '<span class="score-pill ' + scoreClass(avg) + '">⊕ ' + avg + "%</span>") +
            "</td>";
        });

        html += "</tr>";

        family.entries.forEach(function (entry) {
          html +=
            '<tr class="detail-row" data-fid="' + fid + '" data-phase="' + family.phase + '">' +
            "<td>" + escapeHTML(entry.test.difficultyLabel || "Level") + "</td>";

          self.modelIds.forEach(function (model, modelIndex) {
            var result = self.findResult(model, entry.test.family, entry.test.difficultyID);
            var shown = self.visible.has(model);
            html +=
              '<td class="col-m-' + modelIndex + '"' + (shown ? "" : ' style="display:none"') + ">" +
              (result ? self.detailHTML(result) : '<span class="score-empty">—</span>') +
              "</td>";
          });

          html += "</tr>";
        });
      });

      tbody.innerHTML = html;
    },

    detailHTML: function (result) {
      var values = [
        { key: "cov", label: "Cov", value: round(result.score_cov) },
        { key: "geom", label: "Geom", value: round(result.score_geom) },
        { key: "sem", label: "Sem", value: round(result.score_sem) }
      ];
      var global = round(result.score_global);

      var cells = values
        .map(function (item) {
          return (
            '<span class="detail-score ' + scoreClass(item.value) + '">' + item.label +
            "<b>" + item.value + "</b></span>"
          );
        })
        .join("");

      return (
        '<div class="detail-scores">' +
        cells +
        '<span class="detail-score is-global ' + scoreClass(global) + '">⊕<b>' + global + "</b></span>" +
        "</div>"
      );
    },

    /* ------------------------------------------------------------------ */
    /* Interaction                                                        */
    /* ------------------------------------------------------------------ */

    bindEvents: function () {
      var self = this;
      var bar = document.getElementById("model-toggle-bar");
      if (bar) {
        bar.addEventListener("click", function (event) {
          var chip = event.target.closest(".model-chip");
          if (!chip) return;
          self.toggleModel(chip.getAttribute("data-model"), chip);
        });
      }

      var tbody = document.getElementById("table-body");
      if (tbody) {
        tbody.addEventListener("click", function (event) {
          var row = event.target.closest(".family-row");
          if (!row) return;
          self.toggleFamily(row.getAttribute("data-fid"));
        });
      }

      var phaseBar = document.getElementById("phase-bar-container");
      if (phaseBar) {
        phaseBar.addEventListener("click", function (event) {
          var tab = event.target.closest(".phase-tab");
          if (!tab) return;
          self.setPhase(parseInt(tab.getAttribute("data-phase"), 10));
        });
      }

      var toggleAll = document.getElementById("toggle-all-btn");
      if (toggleAll) {
        toggleAll.addEventListener("click", function () {
          self.toggleAll();
        });
      }

      var exportButton = document.getElementById("export-csv-btn");
      if (exportButton) {
        exportButton.addEventListener("click", function () {
          self.exportCSV();
        });
      }
    },

    toggleModel: function (model, chip) {
      if (!model) return;
      if (this.visible.has(model)) {
        this.visible.delete(model);
        if (chip) {
          chip.classList.remove("is-active");
          chip.setAttribute("aria-pressed", "false");
        }
      } else {
        this.visible.add(model);
        if (chip) {
          chip.classList.add("is-active");
          chip.setAttribute("aria-pressed", "true");
        }
      }
      this.applyColumnVisibility();
      this.updateToggleButton();
    },

    toggleAll: function () {
      if (this.visible.size === this.modelIds.length) {
        this.visible.clear();
        this.modelIds.slice(0, this.defaultVisible).forEach(
          function (model) {
            Scoreboard.visible.add(model);
          }
        );
      } else {
        this.modelIds.forEach(function (model) {
          Scoreboard.visible.add(model);
        });
      }

      document.querySelectorAll(".model-chip").forEach(
        function (chip) {
          var active = Scoreboard.visible.has(chip.getAttribute("data-model"));
          chip.classList.toggle("is-active", active);
          chip.setAttribute("aria-pressed", active ? "true" : "false");
        }
      );

      this.applyColumnVisibility();
      this.updateToggleButton();
    },

    updateToggleButton: function () {
      var button = document.getElementById("toggle-all-btn");
      if (!button) return;
      var allVisible = this.visible.size === this.modelIds.length;
      button.textContent = allVisible ? "Show top " + this.defaultVisible : "Show all models";
    },

    applyColumnVisibility: function () {
      var self = this;
      this.modelIds.forEach(function (model, index) {
        var show = self.visible.has(model);
        document.querySelectorAll(".col-m-" + index).forEach(function (cell) {
          cell.style.display = show ? "" : "none";
        });
        document.querySelectorAll(".summary-card").forEach(function (card) {
          if (card.getAttribute("data-model") === model) card.hidden = !show;
        });
      });
    },

    setPhase: function (phase) {
      this.phase = phase;
      document.querySelectorAll(".phase-tab").forEach(function (tab) {
        tab.classList.toggle("is-active", parseInt(tab.getAttribute("data-phase"), 10) === phase);
      });
      this.collapseAll();
      this.applyPhaseFilter();
    },

    applyPhaseFilter: function () {
      var phase = this.phase;
      document.querySelectorAll(".family-row").forEach(function (row) {
        var rowPhase = parseInt(row.getAttribute("data-phase"), 10);
        row.style.display = phase === 0 || rowPhase === phase ? "" : "none";
      });
      document.querySelectorAll(".detail-row").forEach(function (row) {
        row.classList.remove("is-visible");
      });
    },

    collapseAll: function () {
      document.querySelectorAll(".family-row.is-expanded").forEach(function (row) {
        row.classList.remove("is-expanded");
      });
      document.querySelectorAll(".detail-row.is-visible").forEach(function (row) {
        row.classList.remove("is-visible");
      });
      this.expanded = null;
    },

    toggleFamily: function (fid) {
      var row = document.querySelector('.family-row[data-fid="' + fid + '"]');
      if (!row) return;

      var wasExpanded = row.classList.contains("is-expanded");
      this.collapseAll();
      if (wasExpanded) return;

      row.classList.add("is-expanded");
      this.expanded = fid;
      document.querySelectorAll('.detail-row[data-fid="' + fid + '"]').forEach(function (detail) {
        detail.classList.add("is-visible");
      });
    },

    exportCSV: function () {
      var rows = [["Family", "Level", "Phase", "Model", "Coverage", "Geometry", "Semantic", "Global"]];
      var self = this;

      this.db.golden.forEach(function (test) {
        self.modelIds.forEach(function (model) {
          var result = self.findResult(model, test.family, test.difficultyID);
          rows.push([
            test.family,
            test.difficultyLabel,
            test.phase,
            self.getName(model),
            result ? round(result.score_cov) : "",
            result ? round(result.score_geom) : "",
            result ? round(result.score_sem) : "",
            result ? round(result.score_global) : ""
          ]);
        });
      });

      var csv = rows
        .map(function (row) {
          return row
            .map(function (cell) {
              var value = String(cell === undefined || cell === null ? "" : cell);
              return '"' + value.replace(/"/g, '""') + '"';
            })
            .join(",");
        })
        .join("\r\n");

      var blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = "c2cad-bench-results.csv";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    },

    showError: function (message) {
      var tbody = document.getElementById("table-body");
      if (tbody) {
        tbody.innerHTML =
          '<tr><td colspan="100%"><div class="data-state">' +
          '<svg class="icon" style="width:28px;height:28px;color:var(--bad)" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>' +
          "<h3>Evaluation data unavailable</h3>" +
          "<p>" + escapeHTML(message || "Could not load the benchmark database.") + "</p>" +
          "</div></td></tr>";
      }
    }
  };

  window.Scoreboard = Scoreboard;

  function boot() {
    if (window.SHOWCASE_DB) {
      Scoreboard.init();
      return;
    }
    if (window.CG3D_DATA_FAILED) {
      Scoreboard.showError("Could not load the benchmark database.");
      return;
    }
    window.addEventListener(
      "CG3D_SCORE_READY",
      function () {
        Scoreboard.init();
      },
      { once: true }
    );
    window.addEventListener(
      "CG3D_DATA_ERROR",
      function (event) {
        if (!Scoreboard.initialized) {
          Scoreboard.showError(event.detail && event.detail.message ? event.detail.message : "Could not load the benchmark database.");
        }
      },
      { once: true }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
