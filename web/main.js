"use strict";

const examples = {
  users: {
    label: "Users",
    rootName: "Root",
    value: {
      users: [
        {
          id: 1,
          name: "Ada Lovelace",
          email: "ada@example.com",
          role: "admin",
          profile: { bio: "Mathematician", website: null },
        },
        {
          id: 2,
          name: "Grace Hopper",
          email: null,
          role: "engineer",
          active: true,
          profile: { bio: "Rear admiral", website: "https://example.com", title: "Dr." },
        },
      ],
      "next-page": 2,
      tags: ["json", "types"],
    },
  },
  release: {
    label: "Release",
    rootName: "Release",
    value: {
      "release-name": "1.4.0",
      published: true,
      commit: null,
      channel: "stable",
      artifacts: [
        { os: "linux", arch: "x64", bytes: 1048576 },
        { os: "darwin", arch: "arm64", bytes: 2097152, signed: true },
      ],
    },
  },
  events: {
    label: "Events",
    rootName: "Events",
    value: [
      { type: "click", x: 12, y: 40, target: "button" },
      { type: "key", key: "Enter", target: "input" },
      { type: "click", x: 1, y: 2, target: null, meta: { shift: true } },
    ],
  },
};

const HINT = "Nested objects become named types. Fields missing from a sample are optional.";
const EMPTY = "Paste a JSON sample to generate types.";
const STORAGE_KEY = "json-to-types.v1";

const jsonInput = document.getElementById("json");
const typesOutput = document.getElementById("types");
const rootNameInput = document.getElementById("root-name");
const exportedInput = document.getElementById("exported");
const exampleSelect = document.getElementById("example");
const copyButton = document.getElementById("copy");
const downloadButton = document.getElementById("download");
const status = document.getElementById("status");

let timer = 0;
let statusTimer = 0;

function required(element, name) {
  if (!element) throw new Error(`Missing #${name}`);
  return element;
}

required(jsonInput, "json");
required(typesOutput, "types");
required(rootNameInput, "root-name");
required(exportedInput, "exported");
required(exampleSelect, "example");
required(copyButton, "copy");
required(downloadButton, "download");
required(status, "status");

function pretty(value) {
  return JSON.stringify(value, null, 2);
}

function selectedFormat() {
  const checked = document.querySelector('input[name="format"]:checked');
  return checked && checked.value === "type" ? "type" : "interface";
}

function setFormat(format) {
  const input = document.querySelector(`input[name="format"][value="${format}"]`);
  if (input) input.checked = true;
}

function setStatus(message, tone) {
  const nextTone = tone || "";
  if (status.textContent === message && (status.dataset.tone || "") === nextTone) return;
  window.clearTimeout(statusTimer);
  status.textContent = message;
  if (nextTone) status.dataset.tone = nextTone;
  else delete status.dataset.tone;
}

function setBusy(disabled) {
  copyButton.disabled = disabled;
  downloadButton.disabled = disabled;
}

function matchingExample(text) {
  for (const [key, example] of Object.entries(examples)) {
    if (pretty(example.value) === text) return key;
  }
  return "custom";
}

function fillExamples() {
  const custom = document.createElement("option");
  custom.value = "custom";
  custom.textContent = "Custom";
  exampleSelect.append(custom);
  for (const [key, example] of Object.entries(examples)) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = example.label;
    exampleSelect.append(option);
  }
}

function loadExample(key) {
  const example = examples[key];
  if (!example) return;
  jsonInput.value = pretty(example.value);
  rootNameInput.value = example.rootName;
  exampleSelect.value = key;
  jsonInput.setCustomValidity("");
  jsonInput.removeAttribute("aria-invalid");
  convertNow();
  save();
}

function convertNow() {
  const text = jsonInput.value;
  if (text.trim() === "") {
    typesOutput.value = "";
    setBusy(true);
    jsonInput.removeAttribute("aria-invalid");
    setStatus(EMPTY, "");
    return;
  }

  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    typesOutput.value = "";
    setBusy(true);
    jsonInput.setAttribute("aria-invalid", "true");
    const message = error instanceof Error ? error.message : "Invalid JSON";
    setStatus(message, "error");
    return;
  }

  try {
    const api = globalThis.JsonToTypes;
    if (!api || typeof api.jsonToTypes !== "function") {
      throw new Error("The converter failed to load. Rebuild the page and refresh.");
    }
    const rootName = rootNameInput.value.trim();
    typesOutput.value = api.jsonToTypes(value, {
      rootName: rootName || "Root",
      format: selectedFormat(),
      exported: exportedInput.checked,
    });
    jsonInput.removeAttribute("aria-invalid");
    setBusy(false);
    setStatus(HINT, "");
  } catch (error) {
    typesOutput.value = "";
    setBusy(true);
    const message = error instanceof Error ? error.message : "Could not convert this JSON.";
    setStatus(message, "error");
  }
}

function scheduleConvert() {
  window.clearTimeout(timer);
  timer = window.setTimeout(convertNow, 60);
}

function save() {
  try {
    const state = {
      json: jsonInput.value,
      rootName: rootNameInput.value,
      format: selectedFormat(),
      exported: exportedInput.checked,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode and full storage can reject writes. The page still works.
  }
}

function restore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const state = JSON.parse(raw);
    if (!state || typeof state.json !== "string") return false;
    jsonInput.value = state.json;
    if (typeof state.rootName === "string") rootNameInput.value = state.rootName;
    if (state.format === "type" || state.format === "interface") setFormat(state.format);
    exportedInput.checked = state.exported !== false;
    exampleSelect.value = matchingExample(state.json);
    return true;
  } catch {
    return false;
  }
}

async function copyTypes() {
  const text = typesOutput.value;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    typesOutput.focus();
    typesOutput.select();
    document.execCommand("copy");
  }
  const previous = status.textContent;
  const previousTone = status.dataset.tone || "";
  setStatus("Copied to clipboard.", "good");
  window.clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => setStatus(previous, previousTone), 1400);
}

function downloadTypes() {
  const text = typesOutput.value;
  if (!text) return;
  const raw = rootNameInput.value.trim() || "types";
  const safe = raw.replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "types";
  const blob = new Blob([text], { type: "text/typescript;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safe}.ts`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

fillExamples();
if (!restore()) loadExample("users");
else convertNow();

jsonInput.addEventListener("input", () => {
  exampleSelect.value = matchingExample(jsonInput.value);
  scheduleConvert();
  save();
});

rootNameInput.addEventListener("input", () => {
  scheduleConvert();
  save();
});

for (const input of document.querySelectorAll('input[name="format"]')) {
  input.addEventListener("change", () => {
    convertNow();
    save();
  });
}

exportedInput.addEventListener("change", () => {
  convertNow();
  save();
});

exampleSelect.addEventListener("change", () => {
  if (exampleSelect.value === "custom") return;
  loadExample(exampleSelect.value);
});

copyButton.addEventListener("click", () => {
  void copyTypes();
});

downloadButton.addEventListener("click", downloadTypes);
