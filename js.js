// Elementos do DOM
const transactionsList = document.querySelector("#transactionsList");
const descItem = document.querySelector("#desc");
const amount = document.querySelector("#amount");
const type = document.querySelector("#type");
const btnNew = document.querySelector("#btnNew");

const incomes = document.querySelector(".incomes");
const expenses = document.querySelector(".expenses");
const total = document.querySelector(".total");

let items = [];

// Formatação de moeda para Real (pt-BR)
const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

// Formatação de data
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
};

const parseAmount = (value) => {
  const sanitizedValue = value.trim().replace(/\s/g, "");
  const hasComma = sanitizedValue.includes(",");
  const hasDot = sanitizedValue.includes(".");
  const normalizedValue = hasComma && hasDot
    ? sanitizedValue.replace(/\./g, "").replace(",", ".")
    : sanitizedValue.replace(",", ".");

  return Number(normalizedValue);
};

const escapeHTML = (value) => {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
};

// Adicionar nova transação
btnNew.addEventListener("click", () => {
  const parsedAmount = parseAmount(amount.value);

  if (descItem.value.trim() === "" || amount.value.trim() === "" || type.value === "") {
    return alert("Preencha todos os campos!");
  }

  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return alert("Informe um valor maior que zero.");
  }

  const newTransaction = {
    desc: descItem.value.trim(),
    amount: Math.abs(parsedAmount),
    type: type.value,
    date: new Date().toISOString()
  };

  items.unshift(newTransaction);
  setItensBD();
  loadItens();

  descItem.value = "";
  amount.value = "";
  descItem.focus();
});

// Confirmar e excluir transação
function deleteItem(index) {
  const item = items[index];
  const confirmation = confirm(`Deseja realmente excluir a transação "${item.desc}"?`);
  
  if (confirmation) {
    items.splice(index, 1);
    setItensBD();
    loadItens();
  }
}

// Criar card de transação
function createTransactionCard(item, index) {
  const card = document.createElement("div");
  card.className = `transaction-card ${item.type === "Entrada" ? "income" : "expense"}`;
  
  const formattedAmount = item.type === "Entrada" 
    ? `+ ${formatCurrency(item.amount)}`
    : `- ${formatCurrency(item.amount)}`;

  card.innerHTML = `
    <div class="transaction-info">
      <span class="transaction-desc">${escapeHTML(item.desc)}</span>
      <span class="transaction-amount">${formattedAmount}</span>
      <span class="transaction-date">${formatDate(item.date)}</span>
    </div>
    <div class="transaction-actions">
      <button onclick="deleteItem(${index})" aria-label="Excluir transação" title="Excluir">
        <span aria-hidden="true">x</span>
      </button>
    </div>
  `;

  return card;
}

// Exibir estado vazio
function showEmptyState() {
  transactionsList.innerHTML = `
    <div class="empty-state">
      <span class="empty-icon" aria-hidden="true">$</span>
      <p>Nenhuma transação cadastrada</p>
    </div>
  `;
}

// Carregar transações
function loadItens() {
  items = getItensBD();
  transactionsList.innerHTML = "";

  if (items.length === 0) {
    showEmptyState();
  } else {
    items.forEach((item, index) => {
      const card = createTransactionCard(item, index);
      transactionsList.appendChild(card);
    });
  }

  getTotals();
}

// Calcular totais
function getTotals() {
  const amountIncomes = items
    .filter((item) => item.type === "Entrada")
    .map((transaction) => transaction.amount);

  const amountExpenses = items
    .filter((item) => item.type === "Saída")
    .map((transaction) => transaction.amount);

  const totalIncomes = amountIncomes.reduce((acc, cur) => acc + cur, 0);
  const totalExpenses = Math.abs(amountExpenses.reduce((acc, cur) => acc + cur, 0));
  const totalItems = totalIncomes - totalExpenses;

  incomes.textContent = formatCurrency(totalIncomes);
  expenses.textContent = formatCurrency(totalExpenses);
  total.textContent = formatCurrency(totalItems);
}

// LocalStorage
let memoryItems = [];

const getItensBD = () => {
  try {
    const savedItems = JSON.parse(localStorage.getItem("db_items")) ?? [];
    return Array.isArray(savedItems) ? savedItems : [];
  } catch (error) {
    return memoryItems;
  }
};

const setItensBD = () => {
  try {
    localStorage.setItem("db_items", JSON.stringify(items));
  } catch (error) {
    memoryItems = [...items];
  }
};

// Inicializar
loadItens();
