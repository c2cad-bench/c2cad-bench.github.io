/**
 * C2CAD-Bench — 3D visualizer
 * Compares parametric ground truth with model outputs across phases, families and levels.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

const NAMES = {
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
  "di-claude-opus-5-5": "Claude Opus 5.5"
};

const PALETTE = {
  box: { color: 0x6366f1, emissive: 0x312e81, metalness: 0.18, roughness: 0.32 },
  cylinder: { color: 0x0ea5e9, emissive: 0x0c4a6e, metalness: 0.2, roughness: 0.26 },
  sphere: { color: 0xec4899, emissive: 0x831843, metalness: 0.12, roughness: 0.36 },
  pipe: { color: 0xf59e0b, emissive: 0x78350f, metalness: 0.32, roughness: 0.2 },
  beam: { color: 0x14b8a6, emissive: 0x134e4a, metalness: 0.14, roughness: 0.3 },
  cone: { color: 0x8b5cf6, emissive: 0x4c1d95, metalness: 0.16, roughness: 0.28 },
  torus: { color: 0xef4444, emissive: 0x7f1d1d, metalness: 0.26, roughness: 0.22 },
  default: { color: 0x94a3b8, emissive: 0x334155, metalness: 0.08, roughness: 0.4 }
};

const AXIS_MAP = {
  x: [1, 0, 0],
  "+x": [1, 0, 0],
  "-x": [-1, 0, 0],
  y: [0, 1, 0],
  "+y": [0, 1, 0],
  "-y": [0, -1, 0],
  z: [0, 0, 1],
  "+z": [0, 0, 1],
  "-z": [0, 0, -1]
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

const Visualizer = {
  renderer: null,
  scenes: [],
  phase: 1,
  modelId: null,
  initialized: false,
  blocks: [],
  familyTarget: null,

  init() {
    if (this.initialized) return;
    const canvas = document.getElementById("main-canvas");
    const content = document.getElementById("content");
    if (!canvas || !content) return;

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        logarithmicDepthBuffer: true,
        powerPreference: "high-performance"
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(window.innerWidth, window.innerHeight, false);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.08;
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.localClippingEnabled = true;

      this.bindControls();
      this.bindStaticEvents();
      this.resolveDeepLink();

      const data = this.phaseData();
      if (data && data.models) {
        this.ensureModelSelector(data.models);
        this.modelId = this.modelId || this.bestModel(data.models);
      }

      this.switchPhase(this.phase, true);
      this.animate();
      this.initialized = true;
      window.addEventListener("resize", () => this.resize(), { passive: true });
    } catch (error) {
      console.error("Visualizer: initialization failed", error);
      this.showError("The 3D renderer could not be initialized on this device.");
    }
  },

  resize() {
    if (!this.renderer) return;
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
  },

  phaseData(phase) {
    return window["CG3D_P" + (phase || this.phase)];
  },

  bindStaticEvents() {
    document.querySelectorAll(".viz-phase-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const phase = parseInt(tab.getAttribute("data-phase"), 10);
        if (!Number.isNaN(phase)) this.switchPhase(phase);
      });
    });

    const selector = document.getElementById("modelSelector");
    if (selector) {
      selector.addEventListener("change", () => {
        this.modelId = selector.value;
        this.updateUrl();
        this.render();
      });
    }

    const reload = document.querySelector("[data-action='reload']");
    if (reload) {
      reload.addEventListener("click", () => window.location.reload());
    }
  },

  bindControls() {
    const content = document.getElementById("content");
    if (!content) return;

    content.addEventListener("click", (event) => {
      const levelButton = event.target.closest("[data-action='level']");
      if (levelButton) {
        const block = levelButton.closest(".family-block");
        const index = parseInt(levelButton.getAttribute("data-level"), 10);
        if (block && !Number.isNaN(index)) this.switchLevel(block, index);
        return;
      }

      const promptButton = event.target.closest("[data-action='prompt']");
      if (promptButton) {
        const prompt = promptButton.parentElement.querySelector(".prompt-content");
        if (!prompt) return;
        const open = prompt.classList.toggle("is-open");
        promptButton.setAttribute("aria-expanded", open ? "true" : "false");
        const label = promptButton.querySelector("span");
        if (label) label.textContent = open ? "Hide prompt" : "View prompt";
      }
    });
  },

  resolveDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const phase = parseInt(params.get("phase"), 10);
    if (phase >= 1 && phase <= 4) this.phase = phase;

    const model = params.get("model");
    if (model) this.modelId = model;

    const family = params.get("family");
    if (family) this.familyTarget = family;
  },

  updateUrl() {
    if (!window.history || !window.history.replaceState) return;
    const params = new URLSearchParams();
    params.set("phase", String(this.phase));
    if (this.modelId) params.set("model", this.modelId);
    window.history.replaceState(null, "", window.location.pathname + "?" + params.toString());
  },

  switchPhase(phase, initial) {
    const data = this.phaseData(phase);
    this.phase = phase;

    document.querySelectorAll(".viz-phase-tab").forEach((tab) => {
      tab.classList.toggle("is-active", parseInt(tab.getAttribute("data-phase"), 10) === phase);
    });

    if (!data || !data.models) {
      this.showWaiting(phase);
      return;
    }

    this.ensureModelSelector(data.models);
    if (!data.models[this.modelId]) {
      this.modelId = this.bestModel(data.models);
      const selector = document.getElementById("modelSelector");
      if (selector) selector.value = this.modelId;
    }

    this.updateUrl();
    this.render(initial);
  },

  ensureModelSelector(models) {
    const selector = document.getElementById("modelSelector");
    if (!selector) return;

    const ids = Object.keys(models);
    const signature = ids.slice().sort().join("|");
    if (selector.getAttribute("data-signature") === signature) {
      if (this.modelId) selector.value = this.modelId;
      return;
    }

    const providerOrder = ["gemini", "claude", "openai", "deepseek", "kimi", "mistral", "qwen", "xiaomi", "tencent", "stepfun", "deepinfra", "custom"];
    const grouped = {};
    ids.forEach((id) => {
      const provider = this.getProvider(id);
      if (!grouped[provider]) grouped[provider] = [];
      grouped[provider].push(id);
    });

    selector.innerHTML = "";
    providerOrder.forEach((provider) => {
      if (!grouped[provider] || !grouped[provider].length) return;
      const group = document.createElement("optgroup");
      group.label = provider.charAt(0).toUpperCase() + provider.slice(1);
      grouped[provider]
        .sort((a, b) => this.getName(a).localeCompare(this.getName(b)))
        .forEach((id) => {
          const option = document.createElement("option");
          option.value = id;
          option.textContent = this.getName(id);
          group.appendChild(option);
        });
      selector.appendChild(group);
    });

    selector.setAttribute("data-signature", signature);
    if (this.modelId && models[this.modelId]) selector.value = this.modelId;
  },

  bestModel(models) {
    const ids = Object.keys(models);
    const average = (id) => {
      const entries = (models[id] || []).filter(Boolean);
      if (!entries.length) return 0;
      return entries.reduce((sum, entry) => sum + (Number(entry.score_global) || 0), 0) / entries.length;
    };
    return ids.sort((a, b) => average(b) - average(a))[0] || ids[0];
  },

  showWaiting(phase) {
    const content = document.getElementById("content");
    if (!content) return;
    content.innerHTML =
      '<div class="viz-empty"><div class="spinner"></div>' +
      "<h3>Preparing phase " + escapeHTML(phase) + "</h3>" +
      "<p>Loading benchmark geometry…</p></div>";
  },

  showError(message) {
    const content = document.getElementById("content");
    if (!content) return;
    content.innerHTML =
      '<div class="viz-empty">' +
      '<svg class="icon" style="width:30px;height:30px;color:var(--bad)" viewBox="0 0 24 24" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>' +
      "<h3>Unable to load the visualizer</h3>" +
      "<p>" + escapeHTML(message || "The benchmark database could not be loaded.") + "</p>" +
      '<button class="btn btn-primary" type="button" data-action="reload">Retry</button>' +
      "</div>";
    const retry = content.querySelector("[data-action='reload']");
    if (retry) retry.addEventListener("click", () => window.location.reload());
  },

  /* ------------------------------------------------------------------ */
  /* Rendering                                                          */
  /* ------------------------------------------------------------------ */

  render(initial) {
    const content = document.getElementById("content");
    const data = this.phaseData();
    if (!content || !data || !data.golden) return;

    this.clearScenes();
    content.innerHTML = "";
    this.blocks = [];

    const modelData = (data.models && data.models[this.modelId]) || [];
    const provider = this.getProvider(this.modelId);

    const familyMap = new Map();
    data.golden.forEach((golden, index) => {
      if (!familyMap.has(golden.family)) familyMap.set(golden.family, []);
      familyMap.get(golden.family).push({
        golden,
        ai: modelData[index] || null,
        index
      });
    });

    if (!familyMap.size) {
      content.innerHTML =
        '<div class="viz-empty"><h3>No cases in this phase</h3><p>Try another phase.</p></div>';
      return;
    }

    familyMap.forEach((entries, familyName) => {
      entries.sort((a, b) => (Number(a.golden.difficultyID) || 0) - (Number(b.golden.difficultyID) || 0));
      this.renderFamilyBlock(familyName, entries, provider);
    });

    this.updateOverallBadge(modelData);

    if (this.familyTarget) {
      const target = this.blocks.find(
        (block) => block.element.getAttribute("data-family") === this.familyTarget
      );
      if (target) {
        window.setTimeout(() => {
          target.element.scrollIntoView({ behavior: initial ? "auto" : "smooth", block: "start" });
        }, 120);
      }
      this.familyTarget = null;
    }
  },

  renderFamilyBlock(name, entries, provider) {
    const content = document.getElementById("content");
    const blockId = "fb-" + name.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const block = document.createElement("section");
    block.className = "family-block";
    block.setAttribute("data-family", name);
    block.setAttribute("data-block-id", blockId);

    const levelButtons = entries
      .map(
        (entry, index) =>
          '<button class="lvl-btn' + (index === 0 ? " is-active" : "") + '" type="button" data-action="level" data-level="' +
          index + '" aria-pressed="' + (index === 0 ? "true" : "false") + '">L' +
          escapeHTML(entry.golden.difficultyID || index + 1) + "</button>"
      )
      .join("");

    block.innerHTML =
      '<div class="family-header">' +
      '<div class="family-title"><span class="family-name">' + escapeHTML(name) + "</span>" +
      '<span class="fam-phase-pill">Phase ' + escapeHTML(entries[0].golden.phase) + "</span></div>" +
      '<span class="fam-count">' + entries.length + " levels</span>" +
      '<div class="level-switcher" role="group" aria-label="Difficulty level">' + levelButtons + "</div>" +
      "</div>";

    entries.forEach((entry, index) => {
      block.appendChild(this.createRow(entry, index, provider));
    });

    content.appendChild(block);

    const record = { element: block, entries, loaded: new Set() };
    this.blocks.push(record);
    this.loadLevel(record, 0);
  },

  createRow(entry, index, provider) {
    const golden = entry.golden;
    const ai = entry.ai;
    const row = document.createElement("div");
    row.className = "vp-row" + (index === 0 ? " is-active" : "");
    row.setAttribute("data-level", String(index));

    const goldShapes = Array.isArray(golden.shapes) ? golden.shapes : [];
    const aiShapes = ai && Array.isArray(ai.shapes) ? ai.shapes : [];

    let scoreTags = "";
    if (ai) {
      const cov = round(ai.score_cov);
      const geom = round(ai.score_geom);
      const sem = round(ai.score_sem);
      const global = round(ai.score_global);
      scoreTags =
        '<span class="score-tags">' +
        '<span class="score-badge" style="color:' + this.scoreColor(cov) + '">Cov ' + cov + "</span>" +
        '<span class="score-badge" style="color:' + this.scoreColor(geom) + '">Geom ' + geom + "</span>" +
        '<span class="score-badge" style="color:' + this.scoreColor(sem) + '">Sem ' + sem + "</span>" +
        '<span class="score-badge global-badge" style="color:' + this.scoreColor(global) + '">⊕ ' + global + "</span>" +
        "</span>";
    }

    const goldTitle =
      '<div class="card-title"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg>' +
      "<span>Ground truth</span></div>";

    const aiTitle =
      '<div class="card-title is-ai">' + this.dot(provider) + "<span>" + escapeHTML(this.getName(this.modelId)) + "</span></div>";

    row.innerHTML =
      '<article class="viewport-card">' +
      '<div class="card-header">' + goldTitle +
      '<span class="card-meta">' + escapeHTML(golden.difficultyLabel) + " · " + goldShapes.length + " parts</span>" +
      "</div>" +
      this.toolbarHTML() +
      '<div class="viewport" data-vp="gold" aria-label="Ground truth 3D viewport"></div>' +
      '<div class="prompt-container">' +
      '<button class="prompt-toggle" type="button" data-action="prompt" aria-expanded="false">' +
      '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg><span>View prompt</span></button>' +
      '<div class="prompt-content"></div>' +
      "</div>" +
      "</article>" +
      '<article class="viewport-card">' +
      '<div class="card-header"><div class="card-title is-ai">' + this.dot(provider) +
      "<span>" + escapeHTML(this.getName(this.modelId)) + "</span>" + scoreTags + "</div>" +
      '<span class="card-meta">' + aiShapes.length + " parts</span>" +
      "</div>" +
      this.toolbarHTML() +
      '<div class="viewport" data-vp="ai" aria-label="Model output 3D viewport"></div>' +
      "</article>";

    const prompt = row.querySelector(".prompt-content");
    if (prompt) prompt.textContent = golden.prompt || "No prompt available for this case.";

    return row;
  },

  toolbarHTML() {
    return (
      '<div class="vp-toolbar">' +
      '<button class="vp-btn" type="button" data-tool="xray" aria-pressed="false">' +
      '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>X-Ray</button>' +
      '<button class="vp-btn" type="button" data-tool="wire" aria-pressed="false">' +
      '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5 3.5 7.4v9.2L12 21.5l8.5-4.9V7.4L12 2.5Z"/><path d="m3.5 7.4 8.5 4.9 8.5-4.9M12 12.3v9.2"/></svg>Wire</button>' +
      '<button class="vp-btn" type="button" data-tool="cut" aria-pressed="false">' +
      '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/></svg>Cut</button>' +
      '<button class="vp-btn" type="button" data-tool="reset">' +
      '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>Reset</button>' +
      '<span class="vp-zoom"><span>Zoom</span><input type="range" min="0.4" max="4" step="0.1" value="1" data-zoom aria-label="Zoom"></span>' +
      "</div>"
    );
  },

  loadLevel(record, index) {
    if (record.loaded.has(index)) return;
    record.loaded.add(index);

    const row = record.element.querySelector('.vp-row[data-level="' + index + '"]');
    if (!row) return;

    const entry = record.entries[index];
    if (!entry) return;

    const goldEl = row.querySelector('[data-vp="gold"]');
    const aiEl = row.querySelector('[data-vp="ai"]');

    if (goldEl) {
      const state = this.createViewport(goldEl, entry.golden.shapes || []);
      this.bindToolbar(row.querySelectorAll(".viewport-card")[0], state);
    }
    if (aiEl) {
      const shapes = entry.ai && Array.isArray(entry.ai.shapes) ? entry.ai.shapes : [];
      const state2 = this.createViewport(aiEl, shapes);
      this.bindToolbar(row.querySelectorAll(".viewport-card")[1], state2);
    }
  },

  switchLevel(block, index) {
    const record = this.blocks.find((item) => item.element === block);
    if (!record) return;

    block.querySelectorAll(".lvl-btn").forEach((button) => {
      const active = parseInt(button.getAttribute("data-level"), 10) === index;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });

    block.querySelectorAll(".vp-row").forEach((row) => {
      row.classList.toggle("is-active", parseInt(row.getAttribute("data-level"), 10) === index);
    });

    this.loadLevel(record, index);
  },

  /* ------------------------------------------------------------------ */
  /* Three.js viewports                                                 */
  /* ------------------------------------------------------------------ */

  createViewport(element, shapes) {
    const scene = new THREE.Scene();
    scene.background = null;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe5f4, 1.05));
    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(110, 90, 160);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9fb4ff, 0.7);
    fill.position.set(-90, -70, 50);
    scene.add(fill);
    scene.add(new THREE.AmbientLight(0xffffff, 0.22));

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000000);
    camera.up.set(0, 0, 1);

    const controls = new OrbitControls(camera, element);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.enableZoom = false;
    controls.enablePan = true;
    controls.rotateSpeed = 0.8;

    const group = new THREE.Group();
    const box = new THREE.Box3();
    const materialSet = new Set();

    shapes.forEach((shape) => {
      try {
        const material = this.makeMaterial(shape.type);
        materialSet.add(material);
        const mesh = this.buildMesh(shape, material);
        if (!mesh) return;
        group.add(mesh);
        box.expandByObject(mesh);
      } catch (error) {
        console.warn("Visualizer: skipped malformed primitive", error);
      }
    });

    if (group.children.length === 0 || box.isEmpty()) {
      element.classList.add("is-empty");
    }

    scene.add(group);

    const center = new THREE.Vector3();
    const size = new THREE.Vector3();

    if (!box.isEmpty()) {
      box.getCenter(center);
      box.getSize(size);
    }

    const maxDim = Math.max(size.x, size.y, size.z, 1);
    const fov = (camera.fov * Math.PI) / 180;
    const distance = (Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.8) || 200;

    const direction = new THREE.Vector3(1, 0.72, 0.9).normalize();
    const homePosition = center.clone().add(direction.multiplyScalar(distance));
    const homeTarget = center.clone();

    camera.position.copy(homePosition);
    camera.near = Math.max(distance / 1200, 0.01);
    camera.far = distance * 40;
    camera.updateProjectionMatrix();

    controls.target.copy(homeTarget);
    controls.update();

    if (!box.isEmpty()) {
      const gridSize = Math.max(maxDim * 2.6, 10);
      const grid = new THREE.GridHelper(gridSize, 20, 0x8b95ad, 0xc3c9da);
      grid.rotation.x = Math.PI / 2;
      grid.position.set(center.x, center.y, box.min.z - 0.01);
      grid.material.transparent = true;
      grid.material.opacity = 0.22;
      scene.add(grid);
    }

    const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), center.y);
    const state = {
      scene,
      camera,
      controls,
      element,
      aspect: 0,
      objects: group.children,
      materials: materialSet,
      homePosition,
      homeTarget,
      flags: { xray: false, wire: false, cut: false },
      clipPlane
    };

    this.scenes.push(state);
    return state;
  },

  bindToolbar(card, state) {
    if (!card || !state) return;

    const apply = () => {
      state.materials.forEach((material) => {
        material.wireframe = state.flags.wire;
        material.transparent = state.flags.xray || state.flags.wire;
        material.opacity = state.flags.xray ? 0.22 : state.flags.wire ? 0.58 : 1;
        material.clippingPlanes = state.flags.cut ? [state.clipPlane] : null;
        material.needsUpdate = true;
      });
    };

    const toggle = (tool) => {
      const button = card.querySelector('[data-tool="' + tool + '"]');
      if (!button) return;

      if (tool === "reset") {
        state.flags.xray = false;
        state.flags.wire = false;
        state.flags.cut = false;
        state.camera.zoom = 1;
        state.camera.position.copy(state.homePosition);
        state.camera.updateProjectionMatrix();
        state.controls.target.copy(state.homeTarget);
        state.controls.update();
        const zoom = card.querySelector("[data-zoom]");
        if (zoom) zoom.value = "1";
        card.querySelectorAll("[data-tool]").forEach((el) => {
          el.classList.remove("is-active");
          if (el.hasAttribute("aria-pressed")) el.setAttribute("aria-pressed", "false");
        });
        apply();
        return;
      }

      state.flags[tool] = !state.flags[tool];
      if (tool === "xray") state.flags.wire = false;
      if (tool === "wire") state.flags.xray = false;

      card.querySelectorAll("[data-tool]").forEach((el) => {
        const name = el.getAttribute("data-tool");
        if (name === "reset") return;
        const active = !!state.flags[name];
        el.classList.toggle("is-active", active);
        el.setAttribute("aria-pressed", active ? "true" : "false");
      });

      apply();
    };

    card.querySelectorAll("[data-tool]").forEach((button) => {
      button.addEventListener("click", () => toggle(button.getAttribute("data-tool")));
    });

    const zoom = card.querySelector("[data-zoom]");
    if (zoom) {
      zoom.addEventListener("input", () => {
        state.camera.zoom = Math.max(0.1, parseFloat(zoom.value) || 1);
        state.camera.updateProjectionMatrix();
      });
    }
  },

  makeMaterial(type) {
    const palette = PALETTE[type] || PALETTE.default;
    return new THREE.MeshStandardMaterial({
      color: palette.color,
      emissive: palette.emissive,
      emissiveIntensity: 0.14,
      metalness: palette.metalness,
      roughness: palette.roughness,
      side: THREE.DoubleSide
    });
  },

  buildMesh(shape, material) {
    const center = this.parseCenter(shape.center);
    const type = String(shape.type || "").toLowerCase();

    if (type === "box") {
      let size = shape.size || shape.dimensions || shape.dim || [10, 10, 10];
      if (typeof size === "object" && !Array.isArray(size)) {
        size = [
          Number(size.x || size.width || 10),
          Number(size.y || size.depth || 10),
          Number(size.z || size.height || 10)
        ];
      }
      const dimensions = (Array.isArray(size) ? size : [10, 10, 10]).map((value) => Math.max(Math.abs(Number(value) || 0.1), 0.1));
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(dimensions[0], dimensions[1], dimensions[2]), material);
      mesh.position.set(center[0], center[1], center[2]);
      return mesh;
    }

    if (type === "sphere") {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(Math.max(Number(shape.radius) || 1, 0.1), 24, 24), material);
      mesh.position.set(center[0], center[1], center[2]);
      return mesh;
    }

    if (type === "cylinder") {
      const radius = Math.max(Number(shape.radius) || 1, 0.1);
      const height = Math.max(Number(shape.height || shape.length) || 2, 0.1);
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 28), material);
      mesh.position.set(center[0], center[1], center[2]);
      this.orient(mesh, this.parseAxis(shape.axis), new THREE.Vector3(0, 1, 0));
      return mesh;
    }

    if (type === "pipe") {
      const inner = Math.max(Number(shape.inner_radius) || 2, 0.05);
      const outer = Math.max(Number(shape.outer_radius) || 4, inner + 0.05);
      const height = Math.max(Number(shape.height || shape.length) || 8, 0.1);
      const group = new THREE.Group();

      group.add(new THREE.Mesh(new THREE.CylinderGeometry(outer, outer, height, 32, 1, true), material));
      group.add(new THREE.Mesh(new THREE.CylinderGeometry(inner, inner, height, 32, 1, true), material));

      const top = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 32), material);
      top.rotation.x = Math.PI / 2;
      top.position.y = height / 2;
      group.add(top);

      const bottom = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 32), material);
      bottom.rotation.x = -Math.PI / 2;
      bottom.position.y = -height / 2;
      group.add(bottom);

      group.position.set(center[0], center[1], center[2]);
      this.orient(group, this.parseAxis(shape.axis), new THREE.Vector3(0, 1, 0));
      return group;
    }

    if (type === "cone") {
      const base = Math.max(Number(shape.base_radius || shape.radius || shape.start_radius) || 2, 0.1);
      const top = Math.max(Number(shape.top_radius || shape.end_radius) || 0, 0);
      const height = Math.max(Number(shape.height || shape.length) || 4, 0.1);
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, base, height, 28), material);
      mesh.position.set(center[0], center[1], center[2]);
      this.orient(mesh, this.parseAxis(shape.axis), new THREE.Vector3(0, 1, 0));
      return mesh;
    }

    if (type === "torus") {
      const major = Math.max(Number(shape.ring_radius || shape.major_radius) || 5, 0.1);
      const tube = Math.max(Number(shape.tube_radius || shape.minor_radius) || 1, 0.05);
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(major, tube, 18, 40), material);
      mesh.position.set(center[0], center[1], center[2]);
      this.orient(mesh, this.parseAxis(shape.axis || shape.normal), new THREE.Vector3(0, 0, 1));
      return mesh;
    }

    if (type === "beam") {
      const start = new THREE.Vector3(...(shape.start || [0, 0, 0]).map(Number));
      const end = new THREE.Vector3(...(shape.end || [10, 0, 0]).map(Number));
      const length = Math.max(start.distanceTo(end), 0.1);
      const width = Math.max(Number(shape.width) || 2, 0.1);
      const height = Math.max(Number(shape.height) || 2, 0.1);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, length), material);
      mesh.position.copy(new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5));
      mesh.lookAt(end);
      return mesh;
    }

    const start = new THREE.Vector3(...((shape.start || shape.points?.[0] || center) || [0, 0, 0]).map(Number));
    const end = new THREE.Vector3(
      ...((shape.end || shape.points?.[shape.points?.length - 1] || [center[0] + 5, center[1], center[2]]) || [0, 0, 0]).map(Number)
    );
    const length = Math.max(start.distanceTo(end), 0.1);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, length, 10), material);
    mesh.position.copy(new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5));
    this.orient(mesh, new THREE.Vector3().subVectors(end, start).toArray(), new THREE.Vector3(0, 1, 0));
    return mesh;
  },

  orient(object, axis, defaultAxis) {
    const vector = new THREE.Vector3(axis[0], axis[1], axis[2]);
    if (vector.lengthSq() === 0) vector.copy(defaultAxis);
    vector.normalize();
    object.setRotationFromQuaternion(
      new THREE.Quaternion().setFromUnitVectors(defaultAxis.clone().normalize(), vector)
    );
  },

  parseCenter(center) {
    if (Array.isArray(center)) return center.map((value) => Number(value) || 0);
    if (center && typeof center === "object" && "x" in center) {
      return [Number(center.x) || 0, Number(center.y) || 0, Number(center.z) || 0];
    }
    return [0, 0, 0];
  },

  parseAxis(axis) {
    if (!axis) return [0, 0, 1];
    if (typeof axis === "string") return AXIS_MAP[axis.toLowerCase().trim()] || [0, 0, 1];
    if (Array.isArray(axis)) return axis.map((value) => Number(value) || 0);
    return [0, 0, 1];
  },

  clearScenes() {
    this.scenes.forEach((state) => {
      state.controls.dispose();
      const disposed = new Set();
      state.scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
        materials.forEach((material) => {
          if (!disposed.has(material)) {
            disposed.add(material);
            material.dispose();
          }
        });
      });
    });
    this.scenes = [];
    this.blocks = [];
  },

  animate() {
    window.requestAnimationFrame(() => this.animate());
    if (!this.renderer) return;

    this.renderer.setScissorTest(false);
    this.renderer.clear(true, true, true);
    this.renderer.setScissorTest(true);

    this.scenes.forEach((state) => {
      const rect = state.element.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      if (rect.right < 0 || rect.left > window.innerWidth) return;

      const aspect = rect.width / rect.height;
      if (Math.abs(aspect - state.aspect) > 0.001) {
        state.aspect = aspect;
        state.camera.aspect = aspect;
        state.camera.updateProjectionMatrix();
      }

      state.controls.update();

      const x = rect.left;
      const y = window.innerHeight - rect.bottom;
      this.renderer.setViewport(x, y, rect.width, rect.height);
      this.renderer.setScissor(x, y, rect.width, rect.height);
      this.renderer.render(state.scene, state.camera);
    });
  },

  /* ------------------------------------------------------------------ */
  /* Helpers                                                            */
  /* ------------------------------------------------------------------ */

  updateOverallBadge(entries) {
    const badge = document.getElementById("overallScore");
    if (!badge) return;
    const valid = (entries || []).filter(Boolean);
    if (!valid.length) {
      badge.style.display = "none";
      return;
    }
    const average = round(
      valid.reduce((sum, entry) => sum + (Number(entry.score_global) || 0), 0) / valid.length
    );
    badge.textContent = "Phase average " + average + "%";
    badge.classList.add("is-visible");
  },

  getProvider(model) {
    if (!model) return "custom";
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

  getName(model) {
    return NAMES[model] || model || "Model";
  },

  dot(provider) {
    return '<span class="provider-dot dot-' + provider + '" aria-hidden="true"></span>';
  },

  scoreColor(value) {
    if (value > 80) return "var(--good)";
    if (value > 40) return "var(--warn)";
    return "var(--bad)";
  }
};

function boot() {
  const hasData = window.CG3D_P1 && window.CG3D_P2 && window.CG3D_P3 && window.CG3D_P4;
  if (hasData) {
    Visualizer.init();
    return;
  }
  if (window.CG3D_DATA_FAILED) {
    Visualizer.showError("The benchmark database could not be loaded.");
    return;
  }

  window.addEventListener(
    "CG3D_DATA_READY",
    function () {
      Visualizer.init();
    },
    { once: true }
  );

  window.addEventListener(
    "CG3D_DATA_ERROR",
    function (event) {
      Visualizer.showError(event.detail && event.detail.message ? event.detail.message : "The benchmark database could not be loaded.");
    },
    { once: true }
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
