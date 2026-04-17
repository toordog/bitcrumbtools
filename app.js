// TapIn Schema Studio - Working Build with NUMBER digit-length validation

const INDEX_KEY = "tapin.schemas.index";
const SCHEMA_KEY_PREFIX = "tapin.schema.";

let schemaIndex = [];
let currentSchemaId = null;
let currentSchema = null;
let editingFieldName = null;

let schemaModal;
let schemaEditModal;
let fieldOffcanvas;
let jsonModal;

/* ---------- Toasts ---------- */
function showToast(message, isError = false) {
  const id = "toast-" + Date.now();
  $("#toastContainer").append(`
    <div id="${id}" class="toast text-bg-${isError ? "danger" : "success"} border-0 mb-2">
      <div class="d-flex">
        <div class="toast-body">${message}</div>
        <button class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    </div>
  `);
  const el = document.getElementById(id);
  bootstrap.Toast.getOrCreateInstance(el, { delay: 2500 }).show();
}

/* ---------- Storage ---------- */
function storageKeyFor(id) {
  return SCHEMA_KEY_PREFIX + id;
}

function loadSchemaIndex() {
  try {
    schemaIndex = JSON.parse(localStorage.getItem(INDEX_KEY)) || [];
  } catch {
    schemaIndex = [];
  }
}

function saveSchemaIndex() {
  localStorage.setItem(INDEX_KEY, JSON.stringify(schemaIndex));
}

function loadSchema(id) {
  const raw = localStorage.getItem(storageKeyFor(id));
  return raw ? JSON.parse(raw) : null;
}

function saveCurrentSchema(showMsg = true) {
  if (!currentSchemaId || !currentSchema) return;

  currentSchema.version = parseInt($("#metaSchemaVersion").val(), 10) || 1;
  localStorage.setItem(storageKeyFor(currentSchemaId), JSON.stringify(currentSchema));
  if (!schemaIndex.includes(currentSchemaId)) {
    schemaIndex.push(currentSchemaId);
    saveSchemaIndex();
  }
  populateSchemaSelectors();
  renderSchemasGrid();
  if (showMsg) showToast("Schema saved.");
}

/* ---------- Views ---------- */
function showView(view) {
  $(".app-view").addClass("d-none");
  $("#view-" + view).removeClass("d-none");

  $("#sidebarNav .nav-link").removeClass("active");
  $(`#sidebarNav .nav-link[data-view="${view}"]`).addClass("active");

  const titles = {
    builder: "Schema Builder",
    schemas: "Schemas",
    tester: "Schema Tester"
  };
  $("#pageTitle").text(titles[view] || "Schema Builder");

  if (view === "tester" && currentSchemaId) {
    $("#testerSchemaSelect").val(currentSchemaId);
    buildTesterForm(currentSchemaId);
  }

  if ((view === "builder" || view === "tester") && currentSchema) {
    $("#builderJsonBtn").removeClass("d-none");
  } else {
    $("#builderJsonBtn").addClass("d-none");
  }
}

/* ---------- Schema Selectors ---------- */
function populateSchemaSelectors() {
  const builderSel = $("#builderSchemaSelect").empty();
  const testerSel = $("#testerSchemaSelect").empty();

  builderSel.append(`<option value="">(Select schema)</option>`);
  testerSel.append(`<option value="">(Select schema)</option>`);

  schemaIndex.forEach(id => {
    builderSel.append(`<option value="${id}">${id}</option>`);
    testerSel.append(`<option value="${id}">${id}</option>`);
  });

  if (currentSchemaId) {
    builderSel.val(currentSchemaId);
    testerSel.val(currentSchemaId);
  }
}

/* ---------- Builder Meta ---------- */
function updateBuilderMeta() {
  if (!currentSchema) {
    $("#schemaMetaCard").addClass("d-none");
    $("#builderJsonBtn").addClass("d-none");
    $("#fieldControls").addClass("d-none");
    $("#fieldList").empty();
    return;
  }

  $("#schemaMetaCard").removeClass("d-none");
  $("#builderJsonBtn").removeClass("d-none");
  $("#fieldControls").removeClass("d-none");

  $("#metaSchemaId").text(currentSchema.schemaId);
  $("#metaSchemaVersion").val(currentSchema.version || 1);
  $("#metaSchemaMaxUses").text(currentSchema.maxUses ?? "—");
  $("#metaSchemaVisibility").text(currentSchema.visibility);

  $("#metaSchemaDescription").text(currentSchema.description || "—");
  $("#metaSchemaTags").text(
    (currentSchema.tags && currentSchema.tags.length)
      ? currentSchema.tags.join(", ")
      : "—"
  );
  $("#metaSchemaFlags").html(`
    <span class="badge ${currentSchema.allowMultiOwner ? 'bg-success' : 'badge-dead'} me-1">Multi-Owner</span>
    <span class="badge ${currentSchema.transferable ? 'bg-success' : 'badge-dead'} me-1">Transferable</span>
    <span class="badge ${currentSchema.revocable ? 'bg-success' : 'badge-dead'}">Revocable</span>
  `);
}


/* ---------- Schema Cards ---------- */
function renderSchemasGrid() {
  const grid = $("#schemasGrid").empty();
  if (!schemaIndex.length) {
    grid.append(`<div class="col-12"><div class="alert alert-light border small">No schemas yet.</div></div>`);
    return;
  }

  schemaIndex.forEach(id => {
    const s = loadSchema(id);
    if (!s) return;
    grid.append(`
      <div class="col-12 col-md-6 col-lg-4">
        <div class="card h-100">
          <div class="card-body d-flex flex-column">
            <h6 class="fw-bold">${s.schemaId}</h6>
            <small class="text-muted">v${s.version} · ${s.visibility}</small>
            <p class="small flex-grow-1 mt-2">${s.description || ""}</p>
            <div class="d-flex gap-2 mt-auto">
              <button class="btn btn-sm btn-primary flex-grow-1 btn-edit-schema" data-id="${id}">Edit</button>
              <button class="btn btn-sm btn-outline-secondary btn-json-schema" data-id="${id}">{ }</button>
              <button class="btn btn-sm btn-outline-danger btn-delete-schema" data-id="${id}">🗑</button>
            </div>
          </div>
        </div>
      </div>
    `);
  });
}

/* ---------- Schema Creation ---------- */
function openSchemaModal() {
  $("#schemaIdInput").val("");
  $("#schemaVersionInput").val(1);
  $("#schemaVisibilitySelect").val("private");
  $("#schemaDescriptionInput").val("");
  $("#schemaTagsInput").val("");
  $("#schemaMultiOwner").prop("checked", false);
  $("#schemaTransferable").prop("checked", false);
  $("#schemaRevocable").prop("checked", false);
  schemaModal.show();
}

function handleCreateSchema() {
  const id = $("#schemaIdInput").val().trim();
  if (!id) return showToast("Schema ID required.", true);
  if (schemaIndex.includes(id)) return showToast("Schema already exists.", true);

  const schema = {
    schemaId: id,
    version: parseInt($("#schemaVersionInput").val(), 10) || 1,
    maxUses: parseInt($("#schemaMaxUsesInput").val(), 10) || null,
    description: $("#schemaDescriptionInput").val().trim(),
    visibility: $("#schemaVisibilitySelect").val(),
    tags: ($("#schemaTagsInput").val() || "").split(",").map(v => v.trim()).filter(Boolean),
    allowMultiOwner: $("#schemaMultiOwner").is(":checked"),
    transferable: $("#schemaTransferable").is(":checked"),
    revocable: $("#schemaRevocable").is(":checked"),
    required: {},
    optional: {}
  };

  currentSchemaId = id;
  currentSchema = schema;
  saveCurrentSchema(false);

  schemaModal.hide();
  populateSchemaSelectors();
  loadSchemaIntoBuilder(id);
}

/* ---------- Fields ---------- */
function renderFieldList() {
  const list = $("#fieldList").empty();
  if (!currentSchema) return;

  const addCard = (name, field, required) => {
    list.append(`
      <div class="card p-2 d-flex justify-content-between flex-row align-items-center">
        <div>
          <strong>${name}</strong>
          <small class="text-muted">(${field.type}${required ? ", required" : ""})</small><br>
          ${field.label ? `<small>${field.label}</small>` : ""}
          <table class='field-details-table'>
          ${
            (field.minLength || field.maxLength || field.pattern || field.patternStandard || 
             (field.allowedEnumValues && field.allowedEnumValues.length))
            ?
            `
              <tr><td>Type</td><td>${field.type}</td></tr>
              ${field.minLength?`<tr><td>Min Length</td><td>${field.minLength}</td></tr>`:''}
              ${field.maxLength?`<tr><td>Max Length</td><td>${field.maxLength}</td></tr>`:''}
              ${field.pattern?`<tr><td>Pattern</td><td>${field.pattern}</td></tr>`:''}
              ${field.patternStandard?`<tr><td>Standard</td><td>${field.patternStandard}</td></tr>`:''}
              ${
                field.allowedEnumValues && field.allowedEnumValues.length
                ? `<tr><td>Enum</td><td>${field.allowedEnumValues.join(", ")}</td></tr>`
                : ''
              }
            `
            :
            `
              <tr><td colspan="2" class="text-muted" style="border-bottom: none;">No options</td></tr>
            `
          }
        </table>
        </div>
        <div class="d-flex gap-1">
          <button class="btn btn-sm btn-outline-secondary btn-edit-field" data-name="${name}">✏</button>
          <button class="btn btn-sm btn-outline-danger btn-del-field" data-name="${name}">✖</button>
        </div>
      </div>
    `);
  };

  Object.entries(currentSchema.required || {}).forEach(([name, field]) =>
    addCard(name, field, true)
  );
  Object.entries(currentSchema.optional || {}).forEach(([name, field]) =>
    addCard(name, field, false)
  );
}

function renderFieldExtraOptions(type, existing = {}) {
  const box = $("#fieldExtraOptions").empty();

  if (type === "STRING") {
    box.append(`
      <div><strong>String options</strong></div>
      <div class="mb-2">
        <label class="form-label">Regex (optional)</label>
        <input id="fieldRegex" class="form-control form-control-sm" placeholder="e.g. ^[A-Za-z ]+$">
      </div>
      <div class="mb-2">
        <label class="form-label">Regex standard (optional)</label>
        <input id="fieldPatternStandard" class="form-control form-control-sm" placeholder="e.g. EMAIL, PHONE_US">
      </div>
    `);
    if (existing.pattern) $("#fieldRegex").val(existing.pattern);
    if (existing.patternStandard) $("#fieldPatternStandard").val(existing.patternStandard);
  } else if (type === "NUMBER") {
    box.append(`
      <div><strong>Number options</strong></div>
      <div class="row g-2 mb-2">
        <div class="col-6">
          <label class="form-label">Min (digits)</label>
          <input id="fieldMin" type="number" class="form-control form-control-sm">
        </div>
        <div class="col-6">
          <label class="form-label">Max (digits)</label>
          <input id="fieldMax" type="number" class="form-control form-control-sm">
        </div>
      </div>
    `);
    if (existing.min !== undefined) $("#fieldMin").val(existing.min);
    if (existing.max !== undefined) $("#fieldMax").val(existing.max);
  } else if (type === "ENUM") {
    box.append(`
      <div><strong>Enum options</strong></div>
      <div class="mb-2">
        <label class="form-label">Values (one per line)</label>
        <textarea id="fieldEnumValues" rows="3" class="form-control form-control-sm"></textarea>
      </div>
    `);
    let enums = existing.allowedEnumValues || existing.enumOptions;
    if (Array.isArray(enums)) {
      $("#fieldEnumValues").val(enums.join("\n"));
    }
  } else {
    box.append(`<div class="text-muted">No extra options for this type.</div>`);
  }
}

function openFieldDrawer(name) {
  if (!currentSchema) {
    showToast("Select or create a schema first.", true);
    return;
  }

  editingFieldName = name || null;
  let existing = {};

  if (name) {
    existing =
      currentSchema.required?.[name] ||
      currentSchema.optional?.[name] ||
      {};
    $("#fieldOffcanvasLabel").text("Edit Field");
    $("#fieldName").val(name);
    $("#fieldLabel").val(existing.label || "");
    $("#fieldDescription").val(existing.description || "");
    $("#fieldType").val(existing.type || "STRING");
    
    const isReq = currentSchema.required && currentSchema.required[name] !== undefined;
    $("#fieldRequired").prop("checked", isReq);
  } else {
    $("#fieldOffcanvasLabel").text("Add Field");
    $("#fieldName").val("");
    $("#fieldLabel").val("");
    $("#fieldDescription").val("");
    $("#fieldType").val("STRING");
    $("#fieldRequired").prop("checked", false);
  }

  renderFieldExtraOptions($("#fieldType").val(), existing);
  fieldOffcanvas.show();
}

function saveField() {
  if (!currentSchema) return;

  const name = $("#fieldName").val().trim();
  if (!name) return showToast("Field name required.", true);

  const type = $("#fieldType").val();
  const required = $("#fieldRequired").is(":checked");

  if (
    !editingFieldName &&
    (currentSchema.required?.[name] || currentSchema.optional?.[name])
  ) {
    return showToast("Field name already exists.", true);
  }

  if (editingFieldName && editingFieldName !== name) {
    delete currentSchema.required?.[editingFieldName];
    delete currentSchema.optional?.[editingFieldName];
  }

  const field = {
    label: $("#fieldLabel").val().trim(),
    description: $("#fieldDescription").val().trim(),
    type
  };

  const regexInput = $("#fieldRegex");
  const patternStandardInput = $("#fieldPatternStandard");
  const minInput = $("#fieldMin");
  const maxInput = $("#fieldMax");
  const enumInput = $("#fieldEnumValues");

  if (regexInput.length) {
    const v = regexInput.val().trim();
    if (v) field.pattern = v;
  }
  if (patternStandardInput.length) {
    const v = patternStandardInput.val().trim();
    if (v) field.patternStandard = v;
  }
  if (minInput.length) {
    const v = minInput.val().trim();
    if (v !== "") field.minLength = Number(v);
  }
  if (maxInput.length) {
    const v = maxInput.val().trim();
    if (v !== "") field.maxLength = Number(v);
  }
  if (enumInput.length) {
    const values = enumInput
      .val()
      .split("\n")
      .map(v => v.trim())
      .filter(Boolean);
    field.allowedEnumValues = values;
  }

  if (required) {
    currentSchema.required = currentSchema.required || {};
    currentSchema.required[name] = field;
    if (currentSchema.optional) delete currentSchema.optional[name];
  } else {
    currentSchema.optional = currentSchema.optional || {};
    currentSchema.optional[name] = field;
    if (currentSchema.required) delete currentSchema.required[name];
  }

  saveCurrentSchema(false);
  renderFieldList();
  fieldOffcanvas.hide();
  showToast("Field saved.");
}

/* ---------- Delete Field ---------- */
function deleteField(name) {
  if (!currentSchema) return;
  if (!confirm(`Delete field "${name}"?`)) return;
  if (currentSchema.required) delete currentSchema.required[name];
  if (currentSchema.optional) delete currentSchema.optional[name];
  saveCurrentSchema(false);
  renderFieldList();
}

/* ---------- Load Schema into Builder ---------- */
function loadSchemaIntoBuilder(id) {
  const sch = loadSchema(id);
  if (!sch) {
    showToast("Failed to load schema.", true);
    return;
  }
  currentSchemaId = id;
  currentSchema = sch;
  showView("builder");
  populateSchemaSelectors();
  updateBuilderMeta();
  renderFieldList();
}

/* ---------- JSON ---------- */
function showSchemaJsonForCurrent() {
  if (!currentSchema) return showToast("No schema selected.", true);
  $("#schemaJsonOutput").text(JSON.stringify(currentSchema, null, 2));
  jsonModal.show();
}

function showSchemaJsonForId(id) {
  const sch = loadSchema(id);
  if (!sch) return showToast("Failed to load schema.", true);
  $("#schemaJsonOutput").text(JSON.stringify(sch, null, 2));
  jsonModal.show();
}

/* ---------- Delete Schema ---------- */
function deleteSchema(id) {
  if (!confirm("Delete this schema?")) return;
  schemaIndex = schemaIndex.filter(x => x !== id);
  saveSchemaIndex();
  localStorage.removeItem(storageKeyFor(id));
  if (currentSchemaId === id) {
    currentSchemaId = null;
    currentSchema = null;
    updateBuilderMeta();
  }
  populateSchemaSelectors();
  renderSchemasGrid();
  showToast("Schema deleted.");
}

/* ---------- Reset All ---------- */
function resetAllSchemas() {
  if (!confirm("Delete ALL schemas?")) return;
  schemaIndex.forEach(id => localStorage.removeItem(storageKeyFor(id)));
  localStorage.removeItem(INDEX_KEY);
  schemaIndex = [];
  currentSchemaId = null;
  currentSchema = null;
  populateSchemaSelectors();
  renderSchemasGrid();
  updateBuilderMeta();
  $("#testResultBox").addClass("d-none");
  $("#testResultJson").text("");
  showToast("All schemas cleared.");
}

/* ---------- Tester ---------- */
function buildTesterForm(id) {
  const sch = loadSchema(id);
  if (!sch) {
    showToast("Failed to load schema.", true);
    return;
  }

  currentSchemaId = id;
  currentSchema = sch;
  populateSchemaSelectors();
  updateBuilderMeta();
  renderFieldList();

  const requiredContainer = $("#testerRequiredFields").empty();
  const optionalContainer = $("#testerOptionalFields").empty();

  const addInput = (container, name, field, requiredFromMap) => {
    const effectiveRequired = requiredFromMap || !!field.required;

    const group = $(`
      <div>
        <label class="form-label mb-1">
          ${field.label || name}${effectiveRequired ? ' <span class="text-danger">*</span>' : ""}
        </label>
        <div class="mb-1"></div>
        ${field.description ? `<div class="form-text small">${field.description}</div>` : ""}
      </div>
    `);
    const inputContainer = group.children("div").eq(0);
    let input;

    switch (field.type) {
      case "NUMBER":
        input = $(`<input type="number" class="form-control form-control-sm">`);
        if (field.minLength !== undefined) {
          input.attr("min", field.minLength);
          input.attr("data-min", field.minLength);
        }
        if (field.maxLength !== undefined) {
          input.attr("max", field.maxLength);
          input.attr("data-max", field.maxLength);
        }
        break;
      case "DATE":
        input = $(`<input type="date" class="form-control form-control-sm">`);
        break;
      case "BOOLEAN":
        input = $(`
          <select class="form-select form-select-sm">
            <option value="">(none)</option>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        `);
        break;
      case "ENUM":
        input = $(`
          <select class="form-select form-select-sm">
            <option value="">(Select one)</option>
          </select>
        `);
        (field.allowedEnumValues || field.enumOptions || []).forEach(v =>
          input.append(`<option value="${v}">${v}</option>`)
        );
        break;
      default:
        input = $(`<input type="text" class="form-control form-control-sm">`);
        break;
    }

    input.attr("data-field-name", name);
    input.attr("data-required", effectiveRequired ? "true" : "false");
    if (effectiveRequired) input.prop("required", true);
    input.attr("data-type", field.type);
    if (field.pattern) input.attr("data-pattern", field.pattern);

    inputContainer.append(input);
    container.append(group);
  };

  Object.entries(sch.required || {}).forEach(([name, field]) =>
    addInput(requiredContainer, name, field, true)
  );

  Object.entries(sch.optional || {}).forEach(([name, field]) =>
    addInput(optionalContainer, name, field, false)
  );

  $("#testerFormCard").removeClass("d-none");
}

/* ---------- VALIDATION UPDATE APPLIED HERE ---------- */
function validateTesterForm() {
  if (!currentSchema) {
    showToast("Select a schema in Tester.", true);
    return;
  }

  const form = $("#testerForm");
  const inputs = form.find("[data-field-name]");
  let hasError = false;
  const data = {};

  if (!form[0].checkValidity()) {
    form[0].reportValidity();
    return;
  }

  inputs.each(function () {
    const input = $(this);
    const name = input.data("field-name");
    const required = input.data("required") === "true";

    const type = (input.data("type") || "").toUpperCase(); // 🎯 Fix #1: normalize type
    const pattern = input.data("pattern");
    let raw = (input.val() || "").trim();

    input.removeClass("is-invalid");

    if (!required && raw === "") return;

    if (pattern) {
      try {
        const re = new RegExp(pattern);
        if (!re.test(raw)) {
          hasError = true;
          input.addClass("is-invalid");
          return;
        }
      } catch {}
    }

    if (type === "NUMBER") {
      if (!/^\d*$/.test(raw)) { // 🎯 Fix #2: digits only
        hasError = true;
        input.addClass("is-invalid");
        return;
      }

      const digits = raw;
      const length = digits.length;

      let min = input.attr("data-min");
      let max = input.attr("data-max");

      min = (min !== undefined && min !== "") ? Number(min) : null;
      max = (max !== undefined && max !== "") ? Number(max) : null;

      if (required && length === 0) {
        hasError = true;
        input.addClass("is-invalid");
        return;
      }

      if (!required && length === 0) return;

      if (min !== null && length < min) {
        hasError = true;
        input.addClass("is-invalid");
        return;
      }

      if (max !== null && length > max) {
        hasError = true;
        input.addClass("is-invalid");
        return;
      }

      data[name] = digits;
      return;
    }

    if (type === "BOOLEAN") {
      data[name] = (raw === "true");
      return;
    }

    if (type === "ENUM") {
      if (required && raw === "") {
        hasError = true;
        input.addClass("is-invalid");
        return;
      }
      if (raw !== "") data[name] = raw;
      return;
    }

    data[name] = raw;
  });

  if (hasError) {
    showToast("Validation failed — correct fields highlighted.", true);
    return;
  }

  const payload = {
    schemaId: currentSchemaId,
    version: currentSchema?.version || 1,
    data
  };

  $("#testResultPopupJson").text(JSON.stringify(payload, null, 2));
  bootstrap.Modal.getOrCreateInstance("#testResultModal").show();
  showToast("Validation succeeded.");
}

/* ---------- Init ---------- */
$(function () {
  schemaModal = new bootstrap.Modal("#schemaModal");
  schemaEditModal = new bootstrap.Modal("#schemaEditModal");
  fieldOffcanvas = new bootstrap.Offcanvas("#fieldOffcanvas");
  jsonModal = new bootstrap.Modal("#schemaJsonModal");

  loadSchemaIndex();
  populateSchemaSelectors();
  renderSchemasGrid();
  updateBuilderMeta();
  showView("builder");

  $("#sidebarNav").on("click", ".nav-link", function () {
    const targetView = $(this).data("view");
    showView(targetView);

    if ((targetView === "builder" || targetView === "tester") && currentSchema) {
      $("#builderJsonBtn").removeClass("d-none");
    } else {
      $("#builderJsonBtn").addClass("d-none");
    }
  });

  $("#createSchemaBtn").click(openSchemaModal);
  $("#editSchemaBtn").click(openSchemaEditModal);
  $("#schemaEditModalSaveBtn").click(handleEditSchemaSave);
  $("#schemaModalSaveBtn").click(handleCreateSchema);
  $("#saveSchemaBtn").click(() => saveCurrentSchema(true));

  $("#builderSchemaSelect").on("change", function () {
    const id = $(this).val();
    if (!id) {
      currentSchemaId = null;
      currentSchema = null;
      updateBuilderMeta();
      $("#fieldList").empty();
      return;
    }
    loadSchemaIntoBuilder(id);
  });

  $("#addFieldBtn").click(() => openFieldDrawer(null));
  $("#fieldList").on("click", ".btn-edit-field", function () {
    openFieldDrawer($(this).data("name"));
  });
  $("#fieldList").on("click", ".btn-del-field", function () {
    deleteField($(this).data("name"));
  });
  $("#fieldType").on("change", function () {
    let existing = {};
    if (editingFieldName && currentSchema) {
      existing =
        currentSchema.required?.[editingFieldName] ||
        currentSchema.optional?.[editingFieldName] ||
        {};
    }
    renderFieldExtraOptions($(this).val(), existing);
  });
  $("#fieldSaveBtn").click(saveField);

  $("#builderJsonBtn").click(showSchemaJsonForCurrent);

  $("#schemasGrid").on("click", ".btn-edit-schema", function () {
    loadSchemaIntoBuilder($(this).data("id"));
  });
  $("#schemasGrid").on("click", ".btn-json-schema", function () {
    showSchemaJsonForId($(this).data("id"));
  });
  $("#schemasGrid").on("click", ".btn-delete-schema", function () {
    deleteSchema($(this).data("id"));
  });

  $("#jsonCopyBtn").click(() => {
    navigator.clipboard
      .writeText($("#schemaJsonOutput").text())
      .then(() => showToast("Copied."))
      .catch(() => showToast("Copy failed.", true));
  });

  $("#testerSchemaSelect").on("change", function () {
    const id = $(this).val();
    if (!id) {
      $("#testerFormCard").addClass("d-none");
      $("#testerRequiredFields").empty();
      $("#testerOptionalFields").empty();
      return;
    }
    buildTesterForm(id);
  });
  $("#testerValidateBtn").click(validateTesterForm);

  $("#clearTestResultBtn").click(() => {
    $("#testResultBox").addClass("d-none");
    $("#testResultJson").text("");
  });

  $("#resetAllBtn").click(resetAllSchemas);
});


function openSchemaEditModal() {
  if (!currentSchema) return showToast("No schema selected.", true);

  $("#editSchemaId").val(currentSchema.schemaId);
  $("#editSchemaVersion").val(currentSchema.version || 1);
  $("#editSchemaMaxUses").val(
    currentSchema.maxUses !== undefined && currentSchema.maxUses !== null
      ? currentSchema.maxUses
      : 0
  );
  $("#editSchemaVisibility").val(currentSchema.visibility || "private");
  $("#editSchemaDescription").val(currentSchema.description || "");
  $("#editSchemaTags").val((currentSchema.tags || []).join(", "));
  $("#editSchemaMultiOwner").prop("checked", !!currentSchema.allowMultiOwner);
  $("#editSchemaTransferable").prop("checked", !!currentSchema.transferable);
  $("#editSchemaRevocable").prop("checked", !!currentSchema.revocable);

  schemaEditModal.show();
}

function handleEditSchemaSave() {
  if (!currentSchema) return;

  currentSchema.version = parseInt($("#editSchemaVersion").val(), 10) || 1;

  const maxVal = parseInt($("#editSchemaMaxUses").val(), 10);
  currentSchema.maxUses = !isNaN(maxVal) ? maxVal : null;

  currentSchema.visibility = $("#editSchemaVisibility").val();
  currentSchema.description = $("#editSchemaDescription").val().trim();
  currentSchema.tags = ($("#editSchemaTags").val() || "")
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);

  currentSchema.allowMultiOwner = $("#editSchemaMultiOwner").is(":checked");
  currentSchema.transferable = $("#editSchemaTransferable").is(":checked");
  currentSchema.revocable = $("#editSchemaRevocable").is(":checked");

  saveCurrentSchema(false);
  updateBuilderMeta();
  renderSchemasGrid();
  schemaEditModal.hide();
  showToast("Schema updated.");
}
