/**
 * C2CAD-Bench — homepage 3D showcase
 * Renders eight landmark cases with ground truth and the four strongest models.
 */
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

THREE.Object3D.DEFAULT_UP.set(0, 0, 1);

const FEATURED_CASES = [
  { family: "Spiral Staircase", difficultyID: 1 },
  { family: "Suspension Bridge", difficultyID: 1 },
  { family: "DNA Helix", difficultyID: 2 },
  { family: "Voxel Grid", difficultyID: 2 },
  { family: "Planetary Array", difficultyID: 2 },
  { family: "Flanged Pipe Joint", difficultyID: 2 },
  { family: "Fractal Y-Tree", difficultyID: 2 },
  { family: "Radiolarian Skeleton", difficultyID: 1 }
];

const PALETTE = {
  box: { color: 0x33506e, emissive: 0x1b2a3a },
  cylinder: { color: 0x4f7285, emissive: 0x2a3d47 },
  sphere: { color: 0x7a4b4b, emissive: 0x3d2424 },
  pipe: { color: 0x8a6d3b, emissive: 0x443519 },
  beam: { color: 0x556b5b, emissive: 0x2a352d },
  cone: { color: 0x6b5a4a, emissive: 0x352d25 },
  torus: { color: 0x7a3f3f, emissive: 0x3d1f1f },
  default: { color: 0x77746d, emissive: 0x3a3833 }
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
  "di-claude-opus-5-5": "Claude Opus 5.5",
    "di-kimi-k3": "Kimi K3",
    "di-glm-5.3": "GLM-5.3",
    "di-gemini-3.7-flash": "Gemini 3.7 Flash",
    "di-deepseek-v4-pro-0813": "DeepSeek V4 Pro 0813"
};

function escapeHTML(value) {
  return String(value === undefined || value === null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const HomeTable = {
  renderer: null,
  scenes: [],
  top4: [],
  ready: false,
  failed: false,

  init() {
    if (this.ready || this.failed) return;
    const container = document.getElementById("home-showcase-container");
    if (!container) return;

    if (!window.SHOWCASE_DB || !window.SHOWCASE_DB.models || !window.SHOWCASE_DB.golden) {
      if (window.CG3D_DATA_FAILED) {
        this.showError();
        return;
      }
      window.addEventListener("CG3D_DATA_READY", () => this.init(), { once: true });
      window.addEventListener("CG3D_DATA_ERROR", () => this.showError(), { once: true });
      return;
    }

    try {
      this.findTopModels();
      this.setupRenderer();
      this.renderTable();
      this.ready = true;
      this.animate();
    } catch (error) {
      console.error("HomeTable: initialization failed", error);
      this.showError();
    }
  },

  findTopModels() {
    const { models } = window.SHOWCASE_DB;
    const ids = Object.keys(models);

    const average = (model) => {
      const entries = (models[model] || []).filter(Boolean);
      if (!entries.length) return 0;
      return entries.reduce((sum, entry) => sum + (Number(entry.score_global) || 0), 0) / entries.length;
    };

    this.top4 = ids
      .sort((a, b) => average(b) - average(a))
      .slice(0, 4);
  },

  setupRenderer() {
    const canvas = document.createElement("canvas");
    canvas.id = "home-table-canvas";
    canvas.style.position = "fixed";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "60";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setClearColor(0x000000, 0);
    this.resize();
    window.addEventListener("resize", () => this.resize(), { passive: true });
  },

  resize() {
    if (!this.renderer) return;
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
  },

  getCases() {
    const { golden } = window.SHOWCASE_DB;
    let cases = FEATURED_CASES.map((wanted) =>
      golden.find((item) => item.family === wanted.family && item.difficultyID === wanted.difficultyID)
    ).filter(Boolean);

    if (cases.length < 6) {
      const stride = Math.max(1, Math.floor(golden.length / 8));
      const fallback = [];
      for (let i = 0; i < golden.length && fallback.length < 8; i += stride) fallback.push(golden[i]);
      cases = fallback;
    }

    return cases;
  },

  renderTable() {
    const container = document.getElementById("home-showcase-container");
    const { golden, models } = window.SHOWCASE_DB;
    const cases = this.getCases();

    if (!cases.length) {
      this.showError("No showcase cases were found in the benchmark data.");
      return;
    }

    const medals = ["1", "2", "3", "4"];

    let html = '<div class="table-container"><table class="showcase-table"><thead><tr>';
    html += '<th class="task-info" scope="col">Benchmark task</th>';
    html += '<th class="is-gold" scope="col">Ground truth</th>';
    this.top4.forEach((model, index) => {
      html +=
        '<th scope="col"><span class="model-head">' +
        '<span class="rank-medal rank-' + (index + 1) + '">' + medals[index] + "</span>" +
        escapeHTML(NAMES[model] || model) +
        "</span></th>";
    });
    html += "</tr></thead><tbody>";

    cases.forEach((goldenCase, rowIndex) => {
      const goldenIndex = golden.indexOf(goldenCase);
      const parts = (goldenCase.shapes || []).length;

      html += "<tr>";
      html +=
        '<td class="task-info"><div class="task-name">' + escapeHTML(goldenCase.family) + "</div>" +
        '<div class="task-meta"><span class="task-level">' + escapeHTML(goldenCase.difficultyLabel) + "</span>" +
        '<span class="task-parts">' + parts + " parts</span></div></td>";

      html +=
        '<td><div class="home-vp" id="home-vp-gold-' + rowIndex + '" data-type="gold" data-idx="' +
        goldenIndex + '" aria-label="Ground truth geometry for ' + escapeHTML(goldenCase.family) + '"></div></td>';

      this.top4.forEach((model, modelIndex) => {
        html +=
          '<td><div class="home-vp" id="home-vp-top' + (modelIndex + 1) + "-" + rowIndex +
          '" data-type="ai" data-m="' + escapeHTML(model) + '" data-idx="' + goldenIndex +
          '" aria-label="' + escapeHTML(NAMES[model] || model) + ' output for ' + escapeHTML(goldenCase.family) + '"></div></td>';
      });

      html += "</tr>";
    });

    html += "</tbody></table></div>";
    container.innerHTML = html;

    container.querySelectorAll(".home-vp").forEach((el) => {
      const type = el.getAttribute("data-type");
      const index = parseInt(el.getAttribute("data-idx"), 10);
      const model = el.getAttribute("data-m");
      const goldenCase = golden[index];
      let shapes = [];

      if (!goldenCase) {
        el.classList.add("is-empty");
        return;
      }

      if (type === "gold") {
        shapes = goldenCase.shapes || [];
      } else {
        const result = (models[model] || []).find(
          (entry) =>
            entry &&
            entry.family === goldenCase.family &&
            Number(entry.difficultyID) === Number(goldenCase.difficultyID)
        );
        shapes = result && Array.isArray(result.shapes) ? result.shapes : [];
      }

      if (!shapes.length) {
        el.classList.add("is-empty");
        return;
      }

      this.createViewport(el, shapes);
    });
  },

  createViewport(el, shapes) {
    const scene = new THREE.Scene();
    scene.background = null;

    scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe5f4, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 2.1);
    key.position.set(120, 90, 150);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9fb4ff, 0.8);
    fill.position.set(-100, -80, 60);
    scene.add(fill);
    scene.add(new THREE.AmbientLight(0xffffff, 0.25));

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100000);
    camera.up.set(0, 0, 1);

    const controls = new OrbitControls(camera, el);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.rotateSpeed = 0.75;

    const group = new THREE.Group();
    const box = new THREE.Box3();

    shapes.forEach((shape) => {
      try {
        const material = this.makeMaterial(shape.type);
        const mesh = this.buildMesh(shape, material);
        if (!mesh) return;
        group.add(mesh);
        box.expandByObject(mesh);
      } catch (error) {
        console.warn("HomeTable: skipped malformed primitive", error);
      }
    });

    if (group.children.length === 0 || box.isEmpty()) {
      el.classList.add("is-empty");
      return;
    }

    scene.add(group);

    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z, 1);
    const fov = (camera.fov * Math.PI) / 180;
    const distance = (Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.75) || maxDim;

    const direction = new THREE.Vector3(1, 0.82, 0.92).normalize();
    camera.position.copy(center).add(direction.multiplyScalar(distance));
    camera.near = Math.max(distance / 1000, 0.01);
    camera.far = distance * 20;
    camera.updateProjectionMatrix();

    controls.target.copy(center);
    controls.update();

    this.scenes.push({ scene, camera, controls, element: el, aspect: 0 });
  },

  makeMaterial(type) {
    const palette = PALETTE[type] || PALETTE.default;
    return new THREE.MeshStandardMaterial({
      color: palette.color,
      emissive: palette.emissive,
      emissiveIntensity: 0.16,
      metalness: 0.18,
      roughness: 0.34,
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
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(Math.max(Number(shape.radius) || 1, 0.1), 32, 32), material);
      mesh.position.set(center[0], center[1], center[2]);
      return mesh;
    }

    if (type === "cylinder") {
      const radius = Math.max(Number(shape.radius) || 1, 0.1);
      const height = Math.max(Number(shape.height || shape.length) || 2, 0.1);
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 32), material);
      mesh.position.set(center[0], center[1], center[2]);
      this.orient(mesh, this.parseAxis(shape.axis), new THREE.Vector3(0, 1, 0));
      return mesh;
    }

    if (type === "pipe") {
      const inner = Math.max(Number(shape.inner_radius) || 2, 0.05);
      const outer = Math.max(Number(shape.outer_radius) || 4, inner + 0.05);
      const height = Math.max(Number(shape.height || shape.length) || 8, 0.1);
      const group = new THREE.Group();

      group.add(new THREE.Mesh(new THREE.CylinderGeometry(outer, outer, height, 40, 1, true), material));
      group.add(new THREE.Mesh(new THREE.CylinderGeometry(inner, inner, height, 40, 1, true), material));

      const top = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 40), material);
      top.rotation.x = Math.PI / 2;
      top.position.y = height / 2;
      group.add(top);

      const bottom = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 40), material);
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
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, base, height, 32), material);
      mesh.position.set(center[0], center[1], center[2]);
      this.orient(mesh, this.parseAxis(shape.axis), new THREE.Vector3(0, 1, 0));
      return mesh;
    }

    if (type === "torus") {
      const major = Math.max(Number(shape.ring_radius || shape.major_radius) || 5, 0.1);
      const tube = Math.max(Number(shape.tube_radius || shape.minor_radius) || 1, 0.05);
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(major, tube, 20, 48), material);
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

  animate() {
    window.requestAnimationFrame(() => this.animate());
    if (!this.renderer) return;

    this.renderer.setScissorTest(false);
    this.renderer.clear(true, true, true);
    this.renderer.setScissorTest(true);

    this.scenes.forEach((entry) => {
      const rect = entry.element.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      if (rect.right < 0 || rect.left > window.innerWidth) return;

      const container = entry.element.closest(".table-container");
      if (container) {
        const containerRect = container.getBoundingClientRect();
        if (rect.right < containerRect.left + 2 || rect.left > containerRect.right - 2) return;
      }

      const aspect = rect.width / rect.height;
      if (Math.abs(aspect - entry.aspect) > 0.001) {
        entry.aspect = aspect;
        entry.camera.aspect = aspect;
        entry.camera.updateProjectionMatrix();
      }

      entry.controls.update();

      const x = rect.left;
      const y = window.innerHeight - rect.bottom;
      this.renderer.setViewport(x, y, rect.width, rect.height);
      this.renderer.setScissor(x, y, rect.width, rect.height);
      this.renderer.render(entry.scene, entry.camera);
    });
  },

  showError(message) {
    this.failed = true;
    const container = document.getElementById("home-showcase-container");
    if (!container) return;
    container.innerHTML =
      '<div class="showcase-loading">' +
      '<svg class="icon" style="width:26px;height:26px;color:var(--bad)" viewBox="0 0 24 24" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>' +
      "<p>" + escapeHTML(message || "Could not load the benchmark geometry.") + "</p>" +
      "</div>";
  }
};

function boot() {
  HomeTable.init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
