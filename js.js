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

// Adicionar nova transação
btnNew.onclick = () => {
  if (descItem.value === "" || amount.value === "" || type.value === "") {
    return alert("Preencha todos os campos!");
  }

  const newTransaction = {
    desc: descItem.value,
    amount: Math.abs(parseFloat(amount.value)),
    type: type.value,
    date: new Date().toISOString()
  };

  items.unshift(newTransaction);
  setItensBD();
  loadItens();

  descItem.value = "";
  amount.value = "";
  descItem.focus();
};

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
      <span class="transaction-desc">${item.desc}</span>
      <span class="transaction-amount">${formattedAmount}</span>
      <span class="transaction-date">${formatDate(item.date)}</span>
    </div>
    <div class="transaction-actions">
      <button onclick="deleteItem(${index})" aria-label="Excluir transação">
        <i class='bx bx-trash'></i>
      </button>
    </div>
  `;

  return card;
}

// Exibir estado vazio
function showEmptyState() {
  transactionsList.innerHTML = `
    <div class="empty-state">
      <i class='bx bx-receipt'></i>
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
const getItensBD = () => JSON.parse(localStorage.getItem("db_items")) ?? [];
const setItensBD = () => localStorage.setItem("db_items", JSON.stringify(items));

// Inicializar
loadItens();