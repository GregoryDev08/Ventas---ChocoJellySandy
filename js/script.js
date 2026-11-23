const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzlLTBUW6NS324pI-awMIWvzx7LTzmWLRlkZdjiZrG9u-2m7lM96-o-ItBOf3Htw-ecwQ/exec";

let activePin = "";
let signatureLoaded = false;
let whatsappManuallyEdited = false;

let items = [
  { cant: 1, desc: "", unit: "" },
  { cant: "", desc: "", unit: "" }
];

const lockScreen = document.getElementById("lockScreen");
const pinInput = document.getElementById("pinInput");
const btnUnlock = document.getElementById("btnUnlock");
const lockError = document.getElementById("lockError");
const btnLockApp = document.getElementById("btnLockApp");

const historyModal = document.getElementById("historyModal");
const historySummary = document.getElementById("historySummary");
const historyTableBody = document.getElementById("historyTableBody");
const btnOpenHistory = document.getElementById("btnOpenHistory");
const btnCloseHistory = document.getElementById("btnCloseHistory");
const btnRenumber = document.getElementById("btnRenumber");

const inputNota = document.getElementById("inputNota");
const inputFecha = document.getElementById("inputFecha");
const inputCliente = document.getElementById("inputCliente");
const inputTelefono = document.getElementById("inputTelefono");
const inputWhatsapp = document.getElementById("inputWhatsapp");
const inputDescuento = document.getElementById("inputDescuento");
const selectDescuentoTipo = document.getElementById("selectDescuentoTipo");
const inputEnvio = document.getElementById("inputEnvio");
const checkFirma = document.getElementById("checkFirma");
const selectWaFormat = document.getElementById("selectWaFormat");
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

      syncStatus.textContent = "Conectado";
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
  historyModal.classList.add("hidden");
  lockScreen.classList.remove("hidden");
  pinInput.focus();
}

function renderHistoryTable(records) {
  historyTableBody.innerHTML = "";
  if (!records || records.length === 0) {
    historySummary.textContent = "No hay registros almacenados.";
    historyTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#6b6367;padding:20px;">Sin registros aún</td></tr>`;
    return;
  }

  const totalGanancias = records.reduce((acc, r) => acc + (Number(r.total) || 0), 0);
  historySummary.textContent = `Total registros: ${records.length} | Ganancias acumuladas: $${totalGanancias.toFixed(2)}`;

  records.forEach((rec) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${rec.numeroNota}</strong></td>
      <td>${rec.fecha}</td>
      <td>${rec.cliente}</td>
      <td>${rec.detalle || "-"}</td>
      <td><strong>$${Number(rec.total).toFixed(2)}</strong></td>
      <td>
        <button type="button" class="btn-del-row" data-row="${rec.rowIndex}" data-nota="${rec.numeroNota}">Eliminar</button>
      </td>
    `;
    historyTableBody.appendChild(tr);
  });

  historyTableBody.querySelectorAll(".btn-del-row").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      const target = e.currentTarget;
      const rowIndex = Number(target.dataset.row);
      const numeroNota = target.dataset.nota;
      if (!confirm(`¿Eliminar definitivamente la Nota N° ${numeroNota}?`)) return;
      target.disabled = true;
      target.textContent = "...";
      await deleteRecordFromSheets(rowIndex, numeroNota);
    });
  });
}

async function openHistoryModal() {
  if (!activePin) return;
  historyModal.classList.remove("hidden");
  historySummary.textContent = "Cargando registros desde Google Sheets...";
  historyTableBody.innerHTML = "";

  try {
    const url = `${APPS_SCRIPT_URL}?pin=${encodeURIComponent(activePin)}&action=list`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === "ok") {
      renderHistoryTable(data.records);
      if (data.nextNumber) {
        inputNota.value = data.nextNumber;
        updatePreview();
      }
    } else {
      historySummary.textContent = "Error al cargar registros.";
    }
  } catch (err) {
    historySummary.textContent = "Error de conexión con Google Sheets.";
  }
}

async function deleteRecordFromSheets(rowIndex, numeroNota) {
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        pin: activePin,
        action: "delete",
        rowIndex,
        numeroNota,
        renumber: false
      })
    });
    const result = await res.json();
    if (result.status === "ok") {
      renderHistoryTable(result.records);
      if (result.nextNumber) {
        inputNota.value = result.nextNumber;
        updatePreview();
      }
    }
  } catch (err) {
    alert("Error al eliminar el registro.");
  }
}

async function renumberRecordsInSheets() {
  if (!confirm("¿Reordenar todos los números de nota consecutivamente desde 000065?")) return;
  btnRenumber.disabled = true;
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        pin: activePin,
        action: "renumber"
      })
    });
    const result = await res.json();
    if (result.status === "ok") {
      renderHistoryTable(result.records);
      if (result.nextNumber) {
        inputNota.value = result.nextNumber;
        updatePreview();
      }
    }
  } finally {
    btnRenumber.disabled = false;
  }
}

btnUnlock.addEventListener("click", () => verifyPinAndSync(pinInput.value.trim()));
pinInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") verifyPinAndSync(pinInput.value.trim());
});
btnLockApp.addEventListener("click", lockSystem);
btnOpenHistory.addEventListener("click", openHistoryModal);
btnCloseHistory.addEventListener("click", () => historyModal.classList.add("hidden"));
btnRenumber.addEventListener("click", renumberRecordsInSheets);

inputTelefono.addEventListener("input", () => {
  if (!whatsappManuallyEdited) {
    inputWhatsapp.value = inputTelefono.value;
  }
  updatePreview();
});

inputWhatsapp.addEventListener("input", () => {
  whatsappManuallyEdited = inputWhatsapp.value.trim().length > 0;
});

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

function normalizeWhatsAppPhone(raw) {
  let digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0") && digits.length === 10) {
    return "593" + digits.slice(1);
  }
  if (digits.startsWith("9") && digits.length === 9) {
    return "593" + digits;
  }
  return digits;
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

  const tbody = document.getElementById("prevTableBody");
  tbody.innerHTML = "";

  const totalRows = Math.max(5, validRows.length);
  for (let i = 0; i < totalRows; i++) {
    const r = validRows[i];
    const tr = document.createElement("tr");
    if (r) {
      tr.innerHTML = `
        <td class="col-cant">${r.cant}</td>
        <td class="col-desc">${r.desc}</td>
        <td class="col-unit">${r.unit > 0 || r.cant ? formatMoney(r.unit) : ""}</td>
        <td class="col-tot">${r.total > 0 || r.cant ? formatMoney(r.total) : ""}</td>
      `;
    } else {
      tr.innerHTML = `
        <td class="col-cant"></td>
        <td class="col-desc"></td>
        <td class="col-unit"></td>
        <td class="col-tot"></td>
      `;
    }
    tbody.appendChild(tr);
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
    action: "create",
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
    backgroundColor: "#faf6ec"
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

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

async function createPngBlob() {
  const canvas = await captureReceiptCanvas();
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

async function createPdfBlob() {
  const node = document.getElementById("nota-canvas");
  const canvas = await captureReceiptCanvas();
  const imgData = canvas.toDataURL("image/png");
  const { jsPDF } = window.jspdf;
  const w = node.offsetWidth;
  const h = node.offsetHeight;
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "px",
    format: [w, h]
  });
  pdf.addImage(imgData, "PNG", 0, 0, w, h);
  return pdf.output("blob");
}

async function downloadPNG() {
  const blob = await createPngBlob();
  triggerBlobDownload(blob, getFileName("png"));
}

async function downloadPDF() {
  const blob = await createPdfBlob();
  triggerBlobDownload(blob, getFileName("pdf"));
}

function buildWhatsAppMessage(noteNumber) {
  const clientName = inputCliente.value.trim();
  const greeting = clientName ? `¡Hola *${clientName}*!` : "¡Hola!";
  const dateStr = formatDateDisplay(inputFecha.value);
  const { total } = calculateTotals();

  return [
    `${greeting} \u{1F36B}\u{1F353}\u{2728}`,
    `Muchas gracias por tu compra en *Choco Jelly Sandy*. ¡Ha sido un gusto endulzar tu día!`,
    ``,
    `\u{1F9FE} *Nota de Venta N°:* ${noteNumber}`,
    `\u{1F4C5} *Fecha:* ${dateStr}`,
    `\u{1F4B0} *Total:* $${total.toFixed(2)}`,
    ``,
    `Adjunto te enviamos tu comprobante de compra. ¡Esperamos verte pronto! \u{1F495}`
  ].join("\n");
}

async function sendViaWhatsApp(shouldSaveFirst) {
  const rawPhone = inputWhatsapp.value.trim() || inputTelefono.value.trim();
  const cleanPhone = normalizeWhatsAppPhone(rawPhone);

  if (!cleanPhone || cleanPhone.length < 10) {
    statusMsg.style.color = "#c92a5b";
    statusMsg.textContent = "Ingresa un número de WhatsApp válido antes de enviar.";
    inputWhatsapp.focus();
    return;
  }

  const btnWa = document.getElementById("btnSaveWa");
  const btnPng = document.getElementById("btnSavePng");
  const btnPdf = document.getElementById("btnSavePdf");
  btnWa.disabled = true;
  btnPng.disabled = true;
  btnPdf.disabled = true;

  try {
    const currentNoteNumber = (inputNota.value.trim() || "000065").padStart(6, "0");
    const format = selectWaFormat.value;
    const filename = getFileName(format);
    const message = buildWhatsAppMessage(currentNoteNumber);

    let fileBlob;
    let copiedToClipboard = false;

    if (format === "png") {
      fileBlob = await createPngBlob();
      try {
        if (navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": fileBlob })
          ]);
          copiedToClipboard = true;
        }
      } catch (e) {
        copiedToClipboard = false;
      }
    } else {
      fileBlob = await createPdfBlob();
    }

    if (shouldSaveFirst) {
      await saveToGoogleSheets();
      updatePreview();
    }

    triggerBlobDownload(fileBlob, filename);

    const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
    window.open(waUrl, "_blank");

    statusMsg.style.color = "#155724";
    statusMsg.textContent = copiedToClipboard
      ? `✓ WhatsApp abierto y PNG copiado al portapapeles: presiona Ctrl+V en el chat para pegarlo.`
      : `✓ WhatsApp abierto y ${format.toUpperCase()} descargado (${filename}) listo para adjuntar.`;
  } catch (err) {
    statusMsg.style.color = "#c92a5b";
    statusMsg.textContent = "Error: " + err.message;
  } finally {
    btnWa.disabled = false;
    btnPng.disabled = false;
    btnPdf.disabled = false;
  }
}

async function handleSaveAndExport(format) {
  const btnWa = document.getElementById("btnSaveWa");
  const btnPng = document.getElementById("btnSavePng");
  const btnPdf = document.getElementById("btnSavePdf");
  btnWa.disabled = true;
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
    btnWa.disabled = false;
    btnPng.disabled = false;
    btnPdf.disabled = false;
  }
}

btnAddItem.addEventListener("click", () => {
  items.push({ cant: 1, desc: "", unit: "" });
  renderFormItems();
});

document.getElementById("btnSaveWa").addEventListener("click", () => sendViaWhatsApp(true));
document.getElementById("btnOnlyWa").addEventListener("click", () => sendViaWhatsApp(false));
document.getElementById("btnSavePng").addEventListener("click", () => handleSaveAndExport("png"));
document.getElementById("btnSavePdf").addEventListener("click", () => handleSaveAndExport("pdf"));
document.getElementById("btnOnlyPng").addEventListener("click", downloadPNG);
document.getElementById("btnOnlyPdf").addEventListener("click", downloadPDF);
document.getElementById("btnRefreshNum").addEventListener("click", () => verifyPinAndSync(activePin));

document.getElementById("btnReset").addEventListener("click", () => {
  inputCliente.value = "";
  inputTelefono.value = "";
  inputWhatsapp.value = "";
  whatsappManuallyEdited = false;
  inputDescuento.value = "0";
  inputEnvio.value = "0";
  items = [{ cant: 1, desc: "", unit: "" }, { cant: "", desc: "", unit: "" }];
  statusMsg.textContent = "";
  setTodayDate();
  renderFormItems();
  verifyPinAndSync(activePin);
});

[inputNota, inputFecha, inputCliente, inputDescuento, selectDescuentoTipo, inputEnvio, checkFirma].forEach((el) => {
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