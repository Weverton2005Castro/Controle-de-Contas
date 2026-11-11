/* ============================================================
   FinanConta — Controle Financeiro
   Persistência: Cloud Firestore | Tema: light/dark
   ============================================================ */

"use strict";

/* ---------- Constantes e categorias ---------- */
const CATEGORIES = {
  income: [
    { value: "Salário",        icon: "💼" },
    { value: "Freelance",      icon: "💻" },
    { value: "Investimentos",  icon: "📈" },
    { value: "Vendas",         icon: "🛒" },
    { value: "Reembolso",      icon: "↩️" },
    { value: "Outros",         icon: "➕" },
  ],
  expense: [
    { value: "Alimentação",    icon: "🍔" },
    { value: "Moradia",        icon: "🏠" },
    { value: "Transporte",     icon: "🚗" },
    { value: "Saúde",          icon: "💊" },
    { value: "Educação",       icon: "📚" },
    { value: "Lazer",          icon: "🎮" },
    { value: "Contas",         icon: "🧾" },
    { value: "Compras",        icon: "🛍️" },
    { value: "Outros",         icon: "📦" },
  ],
};



/* ---------- Estado ---------- */
let items = [];
let currentType = "income";
let editingId = null;
let currentFilter = "all";
let searchTerm = "";
const now = new Date();
let viewYear = now.getFullYear();
let viewMonth = now.getMonth(); // 0-11

/* ---------- DOM ---------- */
const $ = (sel) => document.querySelector(sel);
const transactionsList = $("#transactionsList");
const descItem = $("#desc");
const amountInput = $("#amount");
const categorySelect = $("#category");
const dateInput = $("#date");
const btnNew = $("#btnNew");
const btnCancelEdit = $("#btnCancelEdit");
const btnNewLabel = $("#btnNewLabel");
const formTitle = $("#formTitle");
const typeIncomeBtn = $("#typeIncome");
const typeExpenseBtn = $("#typeExpense");
const monthLabel = $("#monthLabel");
const totalValue = $("#totalValue");
const totalSub = $("#totalSub");
const heroCard = $(".card.hero");
const incomeValue = $("#incomeValue");
const expenseValue = $("#expenseValue");
const chartEl = $("#chart");
const searchInput = $("#search");
const toastEl = $("#toast");
const modal = $("#modal");
const modalTitle = $("#modalTitle");
const modalMsg = $("#modalMsg");
const modalConfirm = $("#modalConfirm");

/* ---------- Utilitários ---------- */
const formatCurrency = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const escapeHTML = (value) => {
  const el = document.createElement("span");
  el.textContent = value;
  return el.innerHTML;
};

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const todayKey = () => monthKey(new Date());

const formatMonthLabel = (y, m) =>
  new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(y, m, 1));

const formatDateBR = (iso) => {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(d);
};

const formatDayLabel = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hoje";
  if (d.toDateString() === yesterday.toDateString()) return "Ontem";
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(d);
};

const parseAmount = (value) => {
  const s = value.trim().replace(/\s/g, "");
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  const normalized = hasComma && hasDot
    ? s.replace(/\./g, "").replace(",", ".")
    : hasComma
      ? s.replace(",", ".")
      : s;
  return Number(normalized);
};

/* Máscara de moeda BRL enquanto digita */
amountInput.addEventListener("input", () => {
  const digits = amountInput.value.replace(/\D/g, "").slice(0, 12);
  if (!digits) { amountInput.value = ""; return; }
  const cents = parseInt(digits, 10);
  const formatted = (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  amountInput.value = formatted;
});

/* ---------- Tema e persistência remota ---------- */
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}
function initTheme(profile) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(profile.theme || (prefersDark ? "dark" : "light"));
}
let cloudStore;
let saving = false;
async function cloudOperation(action, successMessage) {
  if (saving || !applicationInitialized) return false;
  saving = true;
  document.getElementById("mainContent").inert = true;
  toast("Salvando no Firebase…");
  try {
    await action();
    loadItems();
    toast(successMessage);
    return true;
  } catch (error) {
    console.error("Operação no Firebase falhou:", error);
    toast(error.message || "Não foi possível salvar no Firebase. Tente novamente.");
    return false;
  } finally {
    saving = false;
    document.getElementById("mainContent").inert = false;
  }
}
$("#btnTheme").addEventListener("click", async () => {
  const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  await cloudOperation(async () => {
    await cloudStore.saveTheme(next);
    applyTheme(next);
  }, "Tema salvo no Firebase.");
});

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2600);
}

/* ---------- Modal ---------- */
let modalCallback = null;
function confirmDialog(title, msg, onConfirm) {
  modalTitle.textContent = title;
  modalMsg.textContent = msg;
  modalCallback = onConfirm;
  modal.classList.remove("hidden");
}
$("#modalCancel").addEventListener("click", () => {
  modal.classList.add("hidden");
  modalCallback = null;
});
modalConfirm.addEventListener("click", () => {
  modal.classList.add("hidden");
  const cb = modalCallback;
  modalCallback = null;
  if (cb) cb();
});
modal.addEventListener("click", (e) => {
  if (e.target === modal) { modal.classList.add("hidden"); modalCallback = null; }
});

/* ---------- Categorias no select ---------- */
function renderCategoryOptions() {
  categorySelect.innerHTML = CATEGORIES[currentType]
    .map((c) => `<option value="${c.value}">${c.icon} ${c.value}</option>`)
    .join("");
}
function categoryIcon(name, type) {
  const list = CATEGORIES[type] || CATEGORIES.expense;
  return (list.find((c) => c.value === name) || list[list.length - 1]).icon;
}

/* ---------- Tipo (Entrada/Saída) ---------- */
function setType(type) {
  currentType = type;
  typeIncomeBtn.classList.toggle("active", type === "income");
  typeExpenseBtn.classList.toggle("active", type === "expense");
  typeIncomeBtn.setAttribute("aria-pressed", type === "income");
  typeExpenseBtn.setAttribute("aria-pressed", type === "expense");
  renderCategoryOptions();
}
typeIncomeBtn.addEventListener("click", () => setType("income"));
typeExpenseBtn.addEventListener("click", () => setType("expense"));

/* ---------- Adicionar / Editar ---------- */
function resetForm() {
  editingId = null;
  descItem.value = "";
  amountInput.value = "";
  dateInput.value = new Date().toISOString().slice(0, 10);
  setType("income");
  formTitle.textContent = "Nova transação";
  btnNewLabel.textContent = "Adicionar";
  btnCancelEdit.classList.add("hidden");
  descItem.focus();
}

btnCancelEdit.addEventListener("click", resetForm);

btnNew.addEventListener("click", async () => {
  const desc = descItem.value.trim();
  const parsed = parseAmount(amountInput.value);

  if (!desc) return toast("Informe uma descrição.");
  if (!Number.isFinite(parsed) || parsed <= 0) return toast("Informe um valor maior que zero.");

  const dateVal = dateInput.value || new Date().toISOString().slice(0, 10);
  const payload = {
    desc,
    amount: Math.abs(parsed),
    type: currentType,
    category: categorySelect.value,
    date: new Date(dateVal + "T12:00:00").toISOString(),
  };

  const item = { id: editingId || uid(), ...payload };
  const saved = await cloudOperation(async () => {
    await cloudStore.saveTransaction(item);
    items = [item, ...items.filter(t => t.id !== item.id)];
  }, editingId ? "Transação atualizada!" : "Transação adicionada!");
  if (saved) resetForm();
});

// Enter no formulário salva
document.querySelector(".form-panel").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.tagName !== "SELECT") btnNew.click();
});

/* ---------- Excluir / Editar ---------- */
function deleteItem(id) {
  const item = items.find((t) => t.id === id);
  if (!item) return;
  confirmDialog(
    "Excluir transação",
    `Deseja realmente excluir "${item.desc}" (${formatCurrency(item.amount)})?`,
    async () => {
      const saved = await cloudOperation(async () => {
        await cloudStore.removeTransaction(id);
        items = items.filter(t => t.id !== id);
      }, "Transação excluída.");
      if (saved && editingId === id) resetForm();
    }
  );
}

function editItem(id) {
  const item = items.find((t) => t.id === id);
  if (!item) return;
  editingId = id;
  descItem.value = item.desc;
  const cents = Math.round(item.amount * 100);
  amountInput.value = (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
  dateInput.value = item.date.slice(0, 10);
  setType(item.type);
  categorySelect.value = item.category;
  formTitle.textContent = "Editar transação";
  btnNewLabel.textContent = "Salvar";
  btnCancelEdit.classList.remove("hidden");
  descItem.focus();
  document.querySelector(".form-panel").scrollIntoView({ behavior: "smooth", block: "center" });
}

/* ---------- Renderização da lista ---------- */
function visibleItems() {
  const key = monthKey(new Date(viewYear, viewMonth, 1));
  return items
    .filter((t) => monthKey(new Date(t.date)) === key)
    .filter((t) => currentFilter === "all" || t.type === currentFilter)
    .filter((t) => {
      if (!searchTerm) return true;
      const hay = `${t.desc} ${t.category}`.toLowerCase();
      return hay.includes(searchTerm);
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function renderTransactions() {
  const list = visibleItems();
  transactionsList.innerHTML = "";

  if (!list.length) {
    const msg = searchTerm || currentFilter !== "all"
      ? "Nenhuma transação encontrada com esses filtros."
      : items.length
        ? "Nenhuma transação neste mês."
        : "Nenhuma transação cadastrada ainda.";
    transactionsList.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>
        </svg>
        <p>${escapeHTML(msg)}</p>
        <span>Adicione sua primeira transação acima.</span>
      </div>`;
    return;
  }

  // Agrupa por dia
  const groups = new Map();
  for (const t of list) {
    const day = t.date.slice(0, 10);
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(t);
  }

  for (const [day, txs] of groups) {
    const label = document.createElement("div");
    label.className = "tx-group-label";
    label.textContent = formatDayLabel(day + "T12:00:00");
    transactionsList.appendChild(label);

    for (const t of txs) {
      const card = document.createElement("div");
      card.className = `tx-card ${t.type}`;
      card.innerHTML = `
        <div class="tx-icon" aria-hidden="true">${categoryIcon(t.category, t.type)}</div>
        <div class="tx-main">
          <div class="tx-desc">${escapeHTML(t.desc)}</div>
          <div class="tx-meta">
            <span class="tx-cat">${escapeHTML(t.category)}</span>
            <span>${formatDateBR(t.date)}</span>
          </div>
        </div>
        <div class="tx-amount">${t.type === "income" ? "+" : "−"} ${formatCurrency(t.amount)}</div>
        <div class="tx-actions">
          <button class="edit" data-edit="${t.id}" title="Editar" aria-label="Editar transação">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          </button>
          <button data-del="${t.id}" title="Excluir" aria-label="Excluir transação">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>`;
      transactionsList.appendChild(card);
    }
  }
}

transactionsList.addEventListener("click", (e) => {
  const editBtn = e.target.closest("[data-edit]");
  const delBtn = e.target.closest("[data-del]");
  if (editBtn) editItem(editBtn.dataset.edit);
  if (delBtn) deleteItem(delBtn.dataset.del);
});

/* ---------- Totais ---------- */
function updateTotals() {
  const key = monthKey(new Date(viewYear, viewMonth, 1));
  const monthItems = items.filter((t) => monthKey(new Date(t.date)) === key);

  const inc = monthItems.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const exp = monthItems.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const bal = inc - exp;

  incomeValue.textContent = formatCurrency(inc);
  expenseValue.textContent = formatCurrency(exp);
  totalValue.textContent = formatCurrency(bal);
  totalSub.textContent = bal >= 0 ? "Superávit no mês" : "Déficit no mês";
  heroCard.classList.toggle("negative", bal < 0);
}

/* ---------- Gráfico (últimos 6 meses) ---------- */
function renderChart() {
  chartEl.innerHTML = "";
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(viewYear, viewMonth - i, 1);
    months.push({ y: d.getFullYear(), m: d.getMonth() });
  }

  const data = months.map(({ y, m }) => {
    const key = `${y}-${String(m + 1).padStart(2, "0")}`;
    const inc = items.filter((t) => t.type === "income" && monthKey(new Date(t.date)) === key)
      .reduce((s, t) => s + t.amount, 0);
    const exp = items.filter((t) => t.type === "expense" && monthKey(new Date(t.date)) === key)
      .reduce((s, t) => s + t.amount, 0);
    return { y, m, inc, exp };
  });

  const max = Math.max(1, ...data.flatMap((d) => [d.inc, d.exp]));
  const monthFmt = new Intl.DateTimeFormat("pt-BR", { month: "short" });

  for (const d of data) {
    const col = document.createElement("div");
    col.className = "chart-col";
    col.title = `${monthFmt.format(new Date(d.y, d.m, 1))}: +${formatCurrency(d.inc)} / −${formatCurrency(d.exp)}`;
    col.innerHTML = `
      <div class="chart-bar-wrap">
        <div class="chart-bar income" style="height:${(d.inc / max) * 100}%"></div>
        <div class="chart-bar expense" style="height:${(d.exp / max) * 100}%"></div>
      </div>
      <span class="chart-month">${monthFmt.format(new Date(d.y, d.m, 1)).replace(".", "")}</span>`;
    chartEl.appendChild(col);
  }
}

/* ---------- Navegação de mês ---------- */
function updateMonthLabel() {
  monthLabel.textContent = formatMonthLabel(viewYear, viewMonth);
}
function shiftMonth(delta) {
  const d = new Date(viewYear, viewMonth + delta, 1);
  viewYear = d.getFullYear();
  viewMonth = d.getMonth();
  updateMonthLabel();
  loadItems();
}
$("#btnPrevMonth").addEventListener("click", () => shiftMonth(-1));
$("#btnNextMonth").addEventListener("click", () => shiftMonth(1));
$("#btnToday").addEventListener("click", () => {
  viewYear = now.getFullYear();
  viewMonth = now.getMonth();
  updateMonthLabel();
  loadItems();
});

/* ---------- Busca e filtros ---------- */
searchInput.addEventListener("input", () => {
  searchTerm = searchInput.value.trim().toLowerCase();
  renderTransactions();
});
document.querySelectorAll("#filterChips .chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll("#filterChips .chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    currentFilter = chip.dataset.filter;
    renderTransactions();
  });
});

/* ---------- Exportar / Importar ---------- */
$("#btnExport").addEventListener("click", () => {
  if (!items.length) return toast("Não há dados para exportar.");
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `financonta_${todayKey()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast("Dados exportados!");
});

$("#btnImport").addEventListener("click", () => $("#fileImport").click());
$("#fileImport").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error("Formato inválido");
      const valid = data.filter((t) =>
        t && typeof t.desc === "string" && Number.isFinite(Number(t.amount)) && Number(t.amount) > 0 &&
        ["income", "expense"].includes(t.type) && typeof t.date === "string" && Number.isFinite(Date.parse(t.date))
      ).map((t) => ({
        id: uid(),
        desc: t.desc,
        amount: Math.abs(Number(t.amount)),
        type: t.type,
        category: typeof t.category === "string" ? t.category : "Outros",
        date: t.date,
      }));
      if (!valid.length) return toast("Nenhuma transação válida encontrada no arquivo.");
      confirmDialog(
        "Importar dados",
        `Encontradas ${valid.length} transações. Deseja adicionar aos dados atuais?`,
        async () => {
          await cloudOperation(async () => {
            await cloudStore.importTransactions(valid);
            items = [...valid, ...items];
          }, `${valid.length} transações importadas!`);
        }
      );
    } catch {
      toast("Arquivo inválido. Use um JSON exportado pelo app.");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

/* ---------- Limpar tudo ---------- */
$("#btnClear").addEventListener("click", () => {
  if (!items.length) return toast("Não há dados para apagar.");
  confirmDialog(
    "Apagar tudo",
    `Tem certeza? Todas as ${items.length} transações serão excluídas permanentemente.`,
    async () => {
      const saved = await cloudOperation(async () => {
        await cloudStore.clearTransactions(items.map(t => t.id));
        items = [];
      }, "Todos os dados foram apagados.");
      if (saved) resetForm();
    }
  );
});

/* ---------- Init ---------- */
function loadItems() {
  updateMonthLabel();
  renderTransactions();
  updateTotals();
  renderChart();
}

// Executada após a conta Firebase e a entrada WebAuthn.
let applicationInitialized = false;
async function inicializarAplicacao(profile) {
  if (applicationInitialized) return;
  cloudStore = await window.firebaseService;
  const remoteItems = await cloudStore.listTransactions();
  initTheme(profile);
  setType("income");
  dateInput.value = new Date().toISOString().slice(0, 10);
  items = remoteItems;
  loadItems();
  applicationInitialized = true;
}
