const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzlLTBUW6NS324pI-awMIWvzx7LTzmWLRlkZdjiZrG9u-2m7lM96-o-ItBOf3Htw-ecwQ/exec";

const MAX_ITEMS = 5; // La plantilla visual tiene 5 filas dibujadas
let activePin = "";
let signatureLoaded = false;

let items = [
  { cant: 1, desc: "", unit: "" },
  { cant: "", desc: "", unit: "" }
];

const lockScreen = document.getElementById("lockScreen");
const pinInput = document.getElementById("pinInput");
const btnUnlock = document.getElementById("btnUnlock");
const lockError = document.getElementById("lockError");
const btnLockApp = document.getElementById("btnLockApp");

const inputNota = document.getElementById("inputNota");
const inputFecha = document.getElementById("inputFecha");
const inputCliente = document.getElementById("inputCliente");
const inputTelefono = document.getElementById("inputTelefono");
const inputDescuento = document.getElementById("inputDescuento");
const selectDescuentoTipo = document.getElementById("selectDescuentoTipo");
const inputEnvio = document.getElementById("inputEnvio");
const checkFirma = document.getElementById("checkFirma");
const itemsList = document.getElementById("itemsList");
const btnAddItem = document.getElementById("btnAddItem");
const statusMsg = document.getElementById("statusMsg");
const syncStatus = document.getElementById("syncStatus");
const prevFirmaImg = document.getElementById("prevFirmaImg");

async function verifyPinAndSync(pinToTest) {
  if (!pinToTest) {
    lockError.textContent = "Ingresa un PIN.";
    return false;
  }

  btnUnlock.disabled = true;
  btnUnlock.textContent = "Verificando...";
  lockError.textContent = "";

  try {
    const url = `${APPS_SCRIPT_URL}?pin=${encodeURIComponent(pinToTest)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status === "unauthorized") {
      sessionStorage.removeItem("cjs_auth_pin");
      activePin = "";
      lockError.textContent = "PIN incorrecto. Inténtalo de nuevo.";
      pinInput.value = "";
      pinInput.focus();
      return false;
    }

    if (data.status === "ok") {
      activePin = pinToTest;
      sessionStorage.setItem("cjs_auth_pin", pinToTest);

      if (data.nextNumber) {
        inputNota.value = data.nextNumber;
      }

      if (data.signature) {
        prevFirmaImg.onload = () => {
          signatureLoaded = true;
          updatePreview();
        };
        prevFirmaImg.src = data.signature;
      } else {
        signatureLoaded = false;
      }

      syncStatus.textContent = "Sheets Conectado";
      lockScreen.classList.add("hidden");
      updatePreview();
      return true;
    } else {
      lockError.textContent = "Error del servidor: " + (data.message || "Desconocido");
      return false;
    }
  } catch (err) {
    lockError.textContent = "No se pudo conectar con Google Sheets.";
    return false;
  } finally {
    btnUnlock.disabled = false;
    btnUnlock.textContent = "Desbloquear Sistema";
  }
}

function lockSystem() {
  activePin = "";
  signatureLoaded = false;
  prevFirmaImg.removeAttribute("src");
  prevFirmaImg.style.visibility = "hidden";
  sessionStorage.removeItem("cjs_auth_pin");
  pinInput.value = "";
  lockError.textContent = "";
  lockScreen.classList.remove("hidden");
  pinInput.focus();
}

btnUnlock.addEventListener("click", () => verifyPinAndSync(pinInput.value.trim()));
pinInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") verifyPinAndSync(pinInput.value.trim());
});
btnLockApp.addEventListener("click", lockSystem);

function setTodayDate() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  inputFecha.value = `${yyyy}-${mm}-${dd}`;
}

function formatDateDisplay(isoDate) {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

function formatMoney(val) {
  return `$ ${Number(val || 0).toFixed(2)}`;
}

function renderFormItems() {
  itemsList.innerHTML = "";
  items.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
      <input type="number" min="1" placeholder="Cant" value="${item.cant}" data-idx="${idx}" data-field="cant" />
      <input type="text" placeholder="Ej. Vaso Choco Jelly grande" value="${item.desc}" data-idx="${idx}" data-field="desc" />
      <input type="number" min="0" step="0.01" placeholder="P. Unit" value="${item.unit}" data-idx="${idx}" data-field="unit" />
      <button type="button" class="btn-remove" data-idx="${idx}" title="Eliminar fila">×</button>
    `;
    itemsList.appendChild(row);
  });

  btnAddItem.disabled = items.length >= MAX_ITEMS;

  itemsList.querySelectorAll("input").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      const idx = Number(e.target.dataset.idx);
      const field = e.target.dataset.field;
      items[idx][field] = e.target.value;
      updatePreview();
    });
  });

  itemsList.querySelectorAll(".btn-remove").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const idx = Number(e.target.dataset.idx);
      if (items.length > 1) {
        items.splice(idx, 1);
        renderFormItems();
        updatePreview();
      }
    });
  });
}

function calculateTotals() {
  let subtotal = 0;
  const validRows = [];

  items.forEach((it) => {
    const c = parseFloat(it.cant);
    const u = parseFloat(it.unit);
    const d = (it.desc || "").trim();

    if (d || (!isNaN(c) && !isNaN(u))) {
      const qty = !isNaN(c) && c > 0 ? c : 0;
      const price = !isNaN(u) && u >= 0 ? u : 0;
      const rowTotal = qty * price;
      subtotal += rowTotal;
      validRows.push({
        cant: qty || "",
        desc: d,
        unit: price,
        total: rowTotal
      });
    }
  });

  const rawDisc = Math.max(0, parseFloat(inputDescuento.value) || 0);
  const discType = selectDescuentoTipo.value;
  let descuento = discType === "%"
    ? subtotal * (Math.min(100, rawDisc) / 100)
    : Math.min(subtotal, rawDisc);

  const envio = Math.max(0, parseFloat(inputEnvio.value) || 0);
  const total = Math.max(0, subtotal - descuento + envio);

  return { validRows, subtotal, descuento, envio, total };
}

function updatePreview() {
  document.getElementById("prevFecha").textContent = formatDateDisplay(inputFecha.value);
  document.getElementById("prevNota").textContent = inputNota.value.trim();
  document.getElementById("prevCliente").textContent = inputCliente.value.trim();
  document.getElementById("prevTelefono").textContent = inputTelefono.value.trim();

  const { validRows, subtotal, descuento, envio, total } = calculateTotals();

  const rowsContainer = document.getElementById("prevRowsContainer");
  rowsContainer.innerHTML = "";

  for (let i = 0; i < MAX_ITEMS; i++) {
    const r = validRows[i];
    const rowDiv = document.createElement("div");
    rowDiv.className = "overlay-row";

    if (r) {
      rowDiv.innerHTML = `
        <div class="cell-cant">${r.cant}</div>
        <div class="cell-desc">${r.desc}</div>
        <div class="cell-unit">${r.unit > 0 || r.cant ? formatMoney(r.unit) : ""}</div>
        <div class="cell-tot">${r.total > 0 || r.cant ? formatMoney(r.total) : ""}</div>
      `;
    } else {
      rowDiv.innerHTML = `
        <div class="cell-cant"></div>
        <div class="cell-desc"></div>
        <div class="cell-unit"></div>
        <div class="cell-tot"></div>
      `;
    }
    rowsContainer.appendChild(rowDiv);
  }

  document.getElementById("prevSubtotal").textContent = formatMoney(subtotal);
  document.getElementById("prevDescuento").textContent = formatMoney(descuento);
  document.getElementById("prevEnvio").textContent = formatMoney(envio);
  document.getElementById("prevTotal").textContent = formatMoney(total);

  prevFirmaImg.style.visibility = checkFirma.checked && signatureLoaded ? "visible" : "hidden";
}

async function saveToGoogleSheets() {
  if (!activePin) {
    lockSystem();
    throw new Error("Sesión bloqueada. Ingresa tu PIN.");
  }

  const { validRows, subtotal, descuento, envio, total } = calculateTotals();
  const detalleTexto = validRows
    .map((r) => `${r.cant}x ${r.desc} ($${r.unit.toFixed(2)}) = $${r.total.toFixed(2)}`)
    .join(" | ");

  const payload = {
    pin: activePin,
    numeroNota: inputNota.value.trim().padStart(6, "0"),
    fecha: formatDateDisplay(inputFecha.value),
    cliente: inputCliente.value.trim() || "Consumidor Final",
    telefono: inputTelefono.value.trim(),
    detalleTexto,
    subtotal,
    descuento,
    envio,
    total
  };

  statusMsg.style.color = "#555";
  statusMsg.textContent = "Guardando venta en Google Sheets...";

  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });

  const result = await res.json();
  if (result.status === "unauthorized") {
    lockSystem();
    throw new Error("PIN inválido o modificado.");
  }

  if (result.status === "ok") {
    statusMsg.style.color = "#155724";
    statusMsg.textContent = `✓ Nota N° ${payload.numeroNota} registrada en Google Sheets.`;
    if (result.nextNumber) {
      inputNota.value = result.nextNumber;
    }
    return true;
  } else {
    throw new Error(result.message || "Error al guardar");
  }
}

async function captureReceiptCanvas() {
  const node = document.getElementById("nota-canvas");
  return await html2canvas(node, {
    scale: 2.5,
    useCORS: true,
    backgroundColor: "#f9f5eb"
  });
}

function getFileName(ext) {
  const num = (inputNota.value.trim() || "000065").padStart(6, "0");
  const clientSlug = (inputCliente.value.trim() || "Cliente")
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  return `Nota_Venta_${num}_${clientSlug}.${ext}`;
}

async function downloadPNG() {
  const canvas = await captureReceiptCanvas();
  const link = document.createElement("a");
  link.download = getFileName("png");
  link.href = canvas.toDataURL("image/png");
  link.click();
}

async function downloadPDF() {
  const canvas = await captureReceiptCanvas();
  const imgData = canvas.toDataURL("image/png");
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "px",
    format: [800, 800]
  });
  pdf.addImage(imgData, "PNG", 0, 0, 800, 800);
  pdf.save(getFileName("pdf"));
}

async function handleSaveAndExport(format) {
  const btnPng = document.getElementById("btnSavePng");
  const btnPdf = document.getElementById("btnSavePdf");
  btnPng.disabled = true;
  btnPdf.disabled = true;

  try {
    await saveToGoogleSheets();
    if (format === "png") await downloadPNG();
    if (format === "pdf") await downloadPDF();
    updatePreview();
  } catch (err) {
    statusMsg.style.color = "#c92a5b";
    statusMsg.textContent = "Error: " + err.message;
  } finally {
    btnPng.disabled = false;
    btnPdf.disabled = false;
  }
}

btnAddItem.addEventListener("click", () => {
  if (items.length < MAX_ITEMS) {
    items.push({ cant: 1, desc: "", unit: "" });
    renderFormItems();
  }
});

document.getElementById("btnSavePng").addEventListener("click", () => handleSaveAndExport("png"));
document.getElementById("btnSavePdf").addEventListener("click", () => handleSaveAndExport("pdf"));
document.getElementById("btnOnlyPng").addEventListener("click", downloadPNG);
document.getElementById("btnOnlyPdf").addEventListener("click", downloadPDF);
document.getElementById("btnRefreshNum").addEventListener("click", () => verifyPinAndSync(activePin));

document.getElementById("btnReset").addEventListener("click", () => {
  inputCliente.value = "";
  inputTelefono.value = "";
  inputDescuento.value = "0";
  inputEnvio.value = "0";
  items = [{ cant: 1, desc: "", unit: "" }, { cant: "", desc: "", unit: "" }];
  statusMsg.textContent = "";
  setTodayDate();
  renderFormItems();
  verifyPinAndSync(activePin);
});

[inputNota, inputFecha, inputCliente, inputTelefono, inputDescuento, selectDescuentoTipo, inputEnvio, checkFirma].forEach((el) => {
  el.addEventListener("input", updatePreview);
  el.addEventListener("change", updatePreview);
});

setTodayDate();
renderFormItems();
updatePreview();

const savedSessionPin = sessionStorage.getItem("cjs_auth_pin");
if (savedSessionPin) {
  verifyPinAndSync(savedSessionPin);
} else {
  pinInput.focus();
}