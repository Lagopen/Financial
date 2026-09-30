import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";
import { createUserWithEmailAndPassword, getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { collection, deleteDoc, doc, getDoc, getDocs, getFirestore, runTransaction, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// Firebase Web App 設定；資料存取權限仍由 Firestore Security Rules 控制。
const firebaseConfig = {
  apiKey: "AIzaSyA5ZR1q3A5JE88dChPoCz4H7OlJ39Lp26w",
  authDomain: "financial-e3fc4.firebaseapp.com",
  projectId: "financial-e3fc4",
  storageBucket: "financial-e3fc4.firebasestorage.app",
  messagingSenderId: "201770286989",
  appId: "1:201770286989:web:bb628396eedb2677d107c4",
  measurementId: "G-X81ZKMRT8C"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const elements = {
  pages: [...document.querySelectorAll("[data-page]")],
  pageLinks: [...document.querySelectorAll("[data-page-link]")],
  menuToggle: document.querySelector(".menu-toggle"),
  nav: document.querySelector(".primary-nav"),
  searchForm: document.querySelector("#store-search-form"),
  searchInput: document.querySelector("#store-search"),
  categoryFilters: document.querySelector("#store-category-filters"),
  storeList: document.querySelector("#store-list"),
  resultsCount: document.querySelector("#results-count"),
  notice: document.querySelector("#app-notice"),
  paymentList: document.querySelector("#payment-list"),
  paymentSearch: document.querySelector("#payment-search"),
  setupGuide: document.querySelector("#setup-guide"),
  selectionCount: document.querySelector("#selection-count"),
  saveButton: document.querySelector("#save-payments"),
  saveStatus: document.querySelector("#save-status"),
  authTrigger: document.querySelector("#auth-trigger"),
  authLogout: document.querySelector("#auth-logout"),
  authDialog: document.querySelector("#auth-dialog"),
  authClose: document.querySelector("#auth-close"),
  authForm: document.querySelector("#auth-form"),
  authTitle: document.querySelector("#auth-title"),
  authModeButtons: [...document.querySelectorAll("[data-auth-mode]")],
  nicknameField: document.querySelector("#nickname-field"),
  nicknameInput: document.querySelector("#auth-nickname"),
  emailInput: document.querySelector("#auth-email"),
  passwordInput: document.querySelector("#auth-password"),
  authSubmit: document.querySelector("#auth-submit"),
  authError: document.querySelector("#auth-error"),
  googleSignin: document.querySelector("#google-signin"),
  profileForm: document.querySelector("#profile-form"),
  profileNickname: document.querySelector("#profile-nickname"),
  profileStatus: document.querySelector("#profile-status"),
  profileUid: document.querySelector("#profile-uid"),
  adminAccess: document.querySelector("#admin-access"),
  adminAccessStatus: document.querySelector("#admin-access-status"),
  adminModeToggle: document.querySelector("#admin-mode-toggle"),
  adminModeBanner: document.querySelector("#admin-mode-banner"),
  storeManager: document.querySelector("#store-manager"),
  storeManagerForm: document.querySelector("#store-manager-form"),
  storeManagerName: document.querySelector("#store-manager-name"),
  storeManagerKeywords: document.querySelector("#store-manager-keywords"),
  storeManagerCategory: document.querySelector("#store-manager-category"),
  storeManagerOffers: document.querySelector("#store-manager-offers"),
  storeManagerStatus: document.querySelector("#store-manager-status"),
  storeManagerSubmit: document.querySelector("#store-manager-submit"),
  storeManagerCancel: document.querySelector("#store-manager-cancel"),
  storeManagerList: document.querySelector("#store-manager-list"),
  storeManagerCount: document.querySelector("#store-manager-count"),
  paymentManager: document.querySelector("#payment-manager"),
  paymentManagerForm: document.querySelector("#payment-manager-form"),
  paymentManagerName: document.querySelector("#payment-manager-name"),
  paymentManagerKeywords: document.querySelector("#payment-manager-keywords"),
  paymentManagerCategory: document.querySelector("#payment-manager-category"),
  paymentManagerOffers: document.querySelector("#payment-manager-offers"),
  paymentManagerStatus: document.querySelector("#payment-manager-status"),
  paymentManagerSubmit: document.querySelector("#payment-manager-submit"),
  paymentManagerCancel: document.querySelector("#payment-manager-cancel"),
  paymentManagerList: document.querySelector("#payment-manager-list"),
  paymentManagerCount: document.querySelector("#payment-manager-count")
};

let stores = [];
let paymentMethods = [];
const editingCatalogIds = { Store: null, PaymentMethods: null };
let selectedStoreCategory = "全部";
let authMode = "login";
let currentUser = null;
let isAdmin = false;
let isAdminMode = false;
let isAdminCheckPending = false;
let adminAccessMessage = "開啟個人資料頁時，會測試資料庫讀寫權限。";
let pendingSignupNickname = "";
let savedMethods = [];
let hasSavedRecord = false;
let paymentSettingsLoaded = false;

function setNotice(message = "") {
  elements.notice.textContent = message;
  elements.notice.hidden = !message;
}

function setPage(pageName) {
  const validPages = ["home", "payments", "profile"];
  const validPage = validPages.includes(pageName) ? pageName : "home";
  elements.pages.forEach(page => { page.hidden = page.dataset.page !== validPage; });
  elements.pageLinks.forEach(link => {
    const active = link.dataset.pageLink === validPage;
    link.classList.toggle("is-active", active);
    if (link.matches(".nav-link")) {
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
  });
  closeMenu();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function closeMenu() {
  elements.menuToggle.setAttribute("aria-expanded", "false");
  elements.menuToggle.setAttribute("aria-label", "開啟導覽選單");
  elements.nav.classList.remove("is-open");
}

function normalizeText(value) {
  return String(value ?? "").trim().toLocaleLowerCase("zh-Hant");
}

// 支援逗號分隔字串或字串陣列，並將相鄰的名稱與回饋配對。
function parseOffers(value) {
  const entries = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[，,]/)
      : [];
  const offers = [];
  for (let index = 0; index < entries.length; index += 2) {
    const method = entries[index];
    if (typeof method !== "string" || !method.trim()) continue;
    const reward = index + 1 < entries.length && entries[index + 1] != null
      ? String(entries[index + 1]).trim()
      : "未提供";
    offers.push({ method: method.trim(), reward: reward || "未提供" });
  }
  return offers;
}

function normalizeKeywords(value) {
  const values = Array.isArray(value) ? value : [value];
  return values
    .filter(keyword => typeof keyword === "string")
    .flatMap(keyword => keyword.split(/[，,]/))
    .map(keyword => keyword.trim())
    .filter(Boolean);
}

function extractStoreData(snapshot) {
  return snapshot.docs.map(document => {
    const data = document.data();
    return {
      id: document.id,
      name: document.id,
      keywords: normalizeKeywords(data.Keyword ?? data.keyword),
      category: typeof data.category === "string" && data.category.trim() ? data.category.trim() : "其他",
      offers: parseOffers(data.offers)
    };
  });
}

async function loadFirestoreData() {
  const [methodsSnapshot, storesSnapshot] = await Promise.all([
    getDocs(collection(db, "PaymentMethods")),
    getDocs(collection(db, "Store"))
  ]);

  paymentMethods = methodsSnapshot.docs.map(document => {
    const data = document.data();
    return {
      id: document.id,
      name: document.id,
      keywords: normalizeKeywords(data.Keyword ?? data.keyword),
      category: typeof data.category === "string" && data.category.trim() ? data.category.trim() : "其他",
      offers: parseOffers(data.offers)
    };
  }).sort((left, right) => left.category.localeCompare(right.category, "zh-Hant") || left.name.localeCompare(right.name, "zh-Hant"));

  stores = extractStoreData(storesSnapshot);
  stores.sort((left, right) => left.name.localeCompare(right.name, "zh-Hant"));
  renderPayments();
  renderStoreCategoryFilters();
  renderStores();
  renderStoreManager();
  renderPaymentManager();
}

async function loadUserPaymentMethods(user) {
  paymentSettingsLoaded = false;
  savedMethods = [];
  hasSavedRecord = false;
  renderPayments();
  renderStores();

  try {
    const profile = await getDoc(doc(db, "users", user.uid));
    if (currentUser?.uid !== user.uid) return;
    const profileData = profile.exists() ? profile.data() : {};
    hasSavedRecord = Object.prototype.hasOwnProperty.call(profileData, "PaymentMethods");
    savedMethods = normalizeKeywords(profileData.PaymentMethods);
    elements.saveStatus.textContent = hasSavedRecord ? "已載入雲端支付設定" : "尚未儲存支付設定";
  } catch (error) {
    console.error("讀取雲端支付設定失敗。", error);
    if (currentUser?.uid === user.uid) {
      elements.saveStatus.textContent = "讀取支付設定失敗，請檢查 Firestore 權限。";
    }
  } finally {
    if (currentUser?.uid === user.uid) {
      paymentSettingsLoaded = true;
      renderPayments();
      renderStores();
      updateSelectionStatus();
    }
  }
}

function makeEmptyState(title, message) {
  const container = document.createElement("div");
  container.className = "empty-state";
  const heading = document.createElement("strong");
  heading.textContent = title;
  const detail = document.createElement("p");
  detail.textContent = message;
  container.append(heading, detail);
  return container;
}

function getSearchTerms(query) {
  const cleanQuery = normalizeText(query);
  if (!cleanQuery) return [];
  return cleanQuery.split(/[.\s,，]+/).filter(term => term && term !== "store");
}

function storeMatches(store, terms) {
  if (terms.length === 0) return true;
  const searchable = [store.id, store.name, store.category, ...store.keywords]
    .map(normalizeText);
  return terms.some(term => searchable.some(value => value.includes(term)));
}

function offerMatchesSavedPayment(offer) {
  return savedMethods.some(method => normalizeText(method) === normalizeText(offer.method));
}

function storeHasSavedPayment(store) {
  return store.offers.some(offerMatchesSavedPayment);
}

function renderStoreCategoryFilters() {
  const categories = [...new Set(stores.map(store => store.category))]
    .sort((left, right) => left.localeCompare(right, "zh-Hant"));
  const options = ["全部", ...categories];
  elements.categoryFilters.replaceChildren();

  options.forEach(category => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "category-filter";
    button.textContent = category;
    button.setAttribute("aria-pressed", String(selectedStoreCategory === category));
    if (selectedStoreCategory === category) button.classList.add("is-selected");
    button.addEventListener("click", () => {
      selectedStoreCategory = category;
      elements.categoryFilters.querySelectorAll(".category-filter").forEach(filter => {
        const selected = filter.textContent === selectedStoreCategory;
        filter.classList.toggle("is-selected", selected);
        filter.setAttribute("aria-pressed", String(selected));
      });
      renderStores();
    });
    elements.categoryFilters.append(button);
  });
}

function createOfferRow(offer) {
  const row = document.createElement("div");
  row.className = "offer-row";
  const name = document.createElement("span");
  name.className = "offer-name";
  name.textContent = offer.method;
  const reward = document.createElement("strong");
  reward.className = "offer-reward";
  reward.textContent = offer.reward;
  if (offerMatchesSavedPayment(offer)) row.classList.add("highlight");
  row.append(name, reward);
  return row;
}

function createStoreCard(store) {
  const card = document.createElement("article");
  card.className = "store-card";
  const header = document.createElement("div");
  header.className = "store-card-head";
  const titleBlock = document.createElement("div");
  const kicker = document.createElement("p");
  kicker.className = "store-kicker";
  kicker.textContent = store.category;
  const title = document.createElement("h3");
  title.textContent = store.name;
  titleBlock.append(title, kicker);
  const count = document.createElement("span");
  count.className = "offer-count";
  count.textContent = `${store.offers.length} 種回饋`;
  header.append(titleBlock, count);

  const offerList = document.createElement("div");
  offerList.className = "offer-list";
  if (store.offers.length === 0) {
    offerList.append(makeEmptyState("尚無回饋資料", "此商店尚未新增支付回饋資訊。"));
  } else {
    const orderedOffers = [...store.offers].sort((left, right) =>
      Number(offerMatchesSavedPayment(right)) - Number(offerMatchesSavedPayment(left))
    );
    orderedOffers.forEach(offer => offerList.append(createOfferRow(offer)));
  }
  card.append(header, offerList);
  return card;
}

function renderStores() {
  const terms = getSearchTerms(elements.searchInput.value);
  const matches = stores.filter(store =>
    (selectedStoreCategory === "全部" || store.category === selectedStoreCategory) &&
    storeMatches(store, terms)
  );
  matches.sort((left, right) => {
    const savedPaymentOrder = Number(storeHasSavedPayment(right)) - Number(storeHasSavedPayment(left));
    return savedPaymentOrder || left.name.localeCompare(right.name, "zh-Hant");
  });
  elements.storeList.replaceChildren();
  elements.resultsCount.textContent = `${matches.length} 間商店`;
  if (matches.length === 0) {
    elements.storeList.append(makeEmptyState(
      stores.length ? "找不到符合的商店" : "目前沒有商店資料",
      stores.length ? "試試店名、類別或其他關鍵字。" : "請確認資料庫是否正常。"
    ));
    return;
  }
  matches.forEach(store => elements.storeList.append(createStoreCard(store)));
}

function renderCatalogDeleteList(container, items, collectionName, statusElement) {
  container.replaceChildren();
  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "admin-list-empty";
    empty.textContent = "目前沒有可管理的項目。";
    container.append(empty);
    return;
  }

  items.forEach(item => {
    const row = document.createElement("div");
    row.className = "admin-delete-row";
    const label = document.createElement("button");
    label.type = "button";
    label.className = "admin-edit-button";
    label.textContent = `${item.name} · ${item.category}`;
    label.setAttribute("aria-label", `編輯 ${item.name}`);
    label.addEventListener("click", () => beginCatalogEdit(collectionName, item));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "admin-delete-button";
    remove.textContent = "刪除";
    remove.setAttribute("aria-label", `刪除 ${item.name}`);
    remove.addEventListener("click", () => {
      void deleteCatalogItem(collectionName, item, statusElement);
    });
    row.append(label, remove);
    container.append(row);
  });
}

function renderStoreManager() {
  elements.storeManagerCount.textContent = `${stores.length} 間店家`;
  renderCatalogDeleteList(elements.storeManagerList, stores, "Store", elements.storeManagerStatus);
}

function renderPaymentManager() {
  elements.paymentManagerCount.textContent = `${paymentMethods.length} 種支付方式`;
  renderCatalogDeleteList(elements.paymentManagerList, paymentMethods, "PaymentMethods", elements.paymentManagerStatus);
}

function getManagerForm(collectionName) {
  if (collectionName === "Store") {
    return {
      form: elements.storeManagerForm,
      name: elements.storeManagerName,
      keywords: elements.storeManagerKeywords,
      category: elements.storeManagerCategory,
      offers: elements.storeManagerOffers,
      status: elements.storeManagerStatus,
      submit: elements.storeManagerSubmit,
      cancel: elements.storeManagerCancel,
      addLabel: "新增店家",
      editLabel: "儲存店家修改"
    };
  }
  return {
    form: elements.paymentManagerForm,
    name: elements.paymentManagerName,
    keywords: elements.paymentManagerKeywords,
    category: elements.paymentManagerCategory,
    offers: elements.paymentManagerOffers,
    status: elements.paymentManagerStatus,
    submit: elements.paymentManagerSubmit,
    cancel: elements.paymentManagerCancel,
    addLabel: "新增支付方式",
    editLabel: "儲存支付方式修改"
  };
}

function beginCatalogEdit(collectionName, item) {
  const form = getManagerForm(collectionName);
  editingCatalogIds[collectionName] = item.id;
  form.name.value = item.name;
  form.keywords.value = item.keywords.join(", ");
  form.category.value = item.category;
  form.offers.value = item.offers.flatMap(offer => [offer.method, offer.reward]).join(", ");
  form.submit.textContent = form.editLabel;
  form.cancel.hidden = false;
  form.status.textContent = `正在編輯「${item.name}」；可修改名稱、關鍵字、類別與優惠。`;
  form.name.focus();
}

function cancelCatalogEdit(collectionName) {
  const form = getManagerForm(collectionName);
  const wasEditing = editingCatalogIds[collectionName] !== null;
  editingCatalogIds[collectionName] = null;
  form.form.reset();
  form.submit.textContent = form.addLabel;
  form.cancel.hidden = true;
  if (wasEditing) form.status.textContent = "已取消編輯。";
}

function splitManagerValues(value) {
  return value.split(/[，,]/).map(item => item.trim());
}

async function addCatalogItem(event, config) {
  event.preventDefault();
  if (!currentUser || !isAdmin || !isAdminMode) {
    config.status.textContent = "請先通過管理員驗證並切換至管理員版本。";
    return;
  }

  const name = config.name.value.trim();
  const editingId = editingCatalogIds[config.collectionName];
  const category = config.category.value.trim();
  const keywords = splitManagerValues(config.keywords.value).filter(Boolean);
  const offerEntries = splitManagerValues(config.offers.value);
  if (!name || name.includes("/") || !category || offerEntries.length === 0 || offerEntries.length % 2 !== 0 || offerEntries.some(item => !item)) {
    config.status.textContent = "名稱不可空白或包含 /；請填寫類別，並將優惠名稱與回饋成對輸入。";
    return;
  }

  config.status.textContent = editingId === null ? "正在新增…" : "正在儲存修改…";
  const itemRef = doc(db, config.collectionName, name);
  const sourceRef = doc(db, config.collectionName, editingId ?? name);
  const data = {
    Keyword: keywords.join(", "),
    category,
    offers: config.offers.value.trim()
  };

  try {
    await runTransaction(db, async transaction => {
      const source = await transaction.get(sourceRef);
      if (editingId === null) {
        if (source.exists()) {
          const error = new Error("同名文件已存在。");
          error.code = "already-exists";
          throw error;
        }
        transaction.set(itemRef, data);
        return;
      }

      if (!source.exists()) {
        const error = new Error("要編輯的文件已不存在。");
        error.code = "not-found";
        throw error;
      }
      if (editingId === name) {
        transaction.update(sourceRef, data);
        return;
      }

      const target = await transaction.get(itemRef);
      if (target.exists()) {
        const error = new Error("新名稱已被其他文件使用。");
        error.code = "already-exists";
        throw error;
      }
      transaction.set(itemRef, data);
      transaction.delete(sourceRef);
    });

    const item = {
      id: name,
      name,
      keywords,
      category,
      offers: parseOffers(data.offers)
    };
    if (config.collectionName === "Store") {
      stores = stores.filter(store => store.id !== editingId);
      stores.push(item);
      stores.sort((left, right) => left.name.localeCompare(right.name, "zh-Hant"));
      if (selectedStoreCategory !== "全部" && !stores.some(store => store.category === selectedStoreCategory)) {
        selectedStoreCategory = "全部";
      }
      renderStoreCategoryFilters();
      renderStores();
      renderStoreManager();
    } else {
      paymentMethods = paymentMethods.filter(method => method.id !== editingId);
      paymentMethods.push(item);
      paymentMethods.sort((left, right) => left.category.localeCompare(right.category, "zh-Hant") || left.name.localeCompare(right.name, "zh-Hant"));
      renderPayments();
      renderPaymentManager();
    }
    const wasEditing = editingId !== null;
    cancelCatalogEdit(config.collectionName);
    config.status.textContent = wasEditing ? `「${name}」已更新。` : `「${name}」已新增。`;
  } catch (error) {
    console.error(`${config.collectionName} 新增失敗。`, error);
    config.status.textContent = error.code === "already-exists"
      ? `「${name}」已存在，請使用不同名稱。`
      : error.code === "not-found"
        ? "原始文件已不存在，請重新整理清單後再編輯。"
      : "新增失敗，請確認管理員驗證與 Firestore Security Rules。";
  }
}

async function deleteCatalogItem(collectionName, item, statusElement) {
  if (!currentUser || !isAdmin || !isAdminMode) {
    statusElement.textContent = "目前未啟用管理員版本。";
    return;
  }
  if (!window.confirm(`確定刪除「${item.name}」嗎？此動作無法復原。`)) return;

  statusElement.textContent = `正在刪除「${item.name}」…`;
  try {
    await deleteDoc(doc(db, collectionName, item.id));
    if (collectionName === "Store") {
      stores = stores.filter(store => store.id !== item.id);
      if (selectedStoreCategory !== "全部" && !stores.some(store => store.category === selectedStoreCategory)) {
        selectedStoreCategory = "全部";
      }
      renderStoreCategoryFilters();
      renderStores();
      renderStoreManager();
    } else {
      paymentMethods = paymentMethods.filter(method => method.id !== item.id);
      renderPayments();
      renderPaymentManager();
    }
    if (editingCatalogIds[collectionName] === item.id) cancelCatalogEdit(collectionName);
    statusElement.textContent = `「${item.name}」已刪除。`;
  } catch (error) {
    console.error(`${collectionName} 刪除失敗。`, error);
    statusElement.textContent = "刪除失敗，請確認管理員驗證與 Firestore Security Rules。";
  }
}

function renderPayments() {
  elements.paymentList.replaceChildren();
  elements.setupGuide.hidden = hasSavedRecord;
  if (paymentMethods.length === 0) {
    elements.paymentList.append(makeEmptyState("尚無支付工具", "請確認資料庫是否正常。"));
    elements.saveButton.disabled = true;
    return;
  }

  const groups = new Map();
  paymentMethods.forEach(method => {
    if (!groups.has(method.category)) groups.set(method.category, []);
    groups.get(method.category).push(method);
  });
  groups.forEach((methods, category) => {
    const group = document.createElement("section");
    group.className = "payment-group";
    const heading = document.createElement("h2");
    heading.textContent = category;
    group.append(heading);
    methods.forEach(method => {
      const label = document.createElement("label");
      label.className = "payment-option";
      label.dataset.search = normalizeText([
        method.name,
        method.category,
        ...method.keywords,
        ...method.offers.flatMap(offer => [offer.method, offer.reward])
      ].join(" "));
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = method.name;
      checkbox.checked = savedMethods.some(saved => normalizeText(saved) === normalizeText(method.name));
      checkbox.addEventListener("change", updateSelectionStatus);
      const info = document.createElement("span");
      info.className = "payment-info";
      const name = document.createElement("strong");
      name.className = "payment-name";
      name.textContent = method.name;
      const categoryLabel = document.createElement("small");
      categoryLabel.className = "payment-category";
      categoryLabel.textContent = method.category;
      info.append(name);
      if (method.offers.length > 0) {
        const benefits = document.createElement("small");
        benefits.className = "payment-benefits";
        benefits.textContent = method.offers.map(offer => `${offer.method} ${offer.reward}`).join("、");
        info.append(benefits);
      }
      label.append(checkbox, info, categoryLabel);
      group.append(label);
    });
    elements.paymentList.append(group);
  });
  filterPaymentMethods();
  updateSelectionStatus();
}

function filterPaymentMethods() {
  const terms = getSearchTerms(elements.paymentSearch.value);
  elements.paymentList.querySelectorAll(".payment-group").forEach(group => {
    let hasVisibleMethod = false;
    group.querySelectorAll(".payment-option").forEach(option => {
      const searchable = option.dataset.search || "";
      const matches = terms.length === 0 || terms.every(term => searchable.includes(term));
      option.hidden = !matches;
      hasVisibleMethod ||= matches;
    });
    group.hidden = !hasVisibleMethod;
  });
}

function updateSelectionStatus() {
  const checkedCount = elements.paymentList.querySelectorAll("input:checked").length;
  elements.selectionCount.textContent = `已選 ${checkedCount} 項`;
  elements.saveButton.disabled = !currentUser || !paymentSettingsLoaded || paymentMethods.length === 0;
  if (!currentUser) {
    elements.saveStatus.textContent = "請先登入，才能將支付設定儲存至帳號。";
  } else if (!paymentSettingsLoaded) {
    elements.saveStatus.textContent = "正在載入雲端支付設定…";
  } else {
    elements.saveStatus.textContent = "變更尚未儲存";
  }
}

async function savePayments() {
  if (!currentUser || !paymentSettingsLoaded) {
    elements.saveStatus.textContent = "請先登入並等待支付設定載入完成。";
    return;
  }

  const selected = [...elements.paymentList.querySelectorAll("input:checked")].map(input => input.value);
  const user = currentUser;
  elements.saveButton.disabled = true;
  elements.saveStatus.textContent = "正在儲存至你的帳號…";
  try {
    await setDoc(doc(db, "users", user.uid), {
      PaymentMethods: selected.join(", ")
    }, { merge: true });
    if (currentUser?.uid !== user.uid) return;
    savedMethods = selected;
    hasSavedRecord = true;
    elements.saveStatus.textContent = "設定已儲存至帳號，首頁回饋已更新";
    renderPayments();
    renderStores();
    setPage("home");
  } catch (error) {
    console.error("無法儲存雲端支付設定。", error);
    elements.saveStatus.textContent = "儲存失敗，請確認登入狀態與 Firestore Rules。";
    updateSelectionStatus();
  }
}

function setAuthMode(mode) {
  authMode = mode === "signup" ? "signup" : "login";
  const isSignup = authMode === "signup";
  elements.authTitle.textContent = isSignup ? "建立你的帳戶" : "歡迎回來";
  elements.nicknameField.hidden = !isSignup;
  elements.nicknameInput.required = isSignup;
  elements.passwordInput.autocomplete = isSignup ? "new-password" : "current-password";
  elements.authSubmit.innerHTML = isSignup
    ? '建立帳戶 <span aria-hidden="true">→</span>'
    : '電子郵件登入 <span aria-hidden="true">→</span>';
  elements.authModeButtons.forEach(button => {
    const selected = button.dataset.authMode === authMode;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  elements.authError.hidden = true;
}

function showAuthError(message) {
  elements.authError.textContent = message;
  elements.authError.hidden = false;
}

function describeAuthError(error) {
  const messages = {
    "auth/email-already-in-use": "這個電子郵件已註冊，請直接登入。",
    "auth/invalid-email": "請輸入有效的電子郵件地址。",
    "auth/invalid-credential": "電子郵件或密碼不正確。",
    "auth/weak-password": "密碼至少需要 6 個字元。",
    "auth/popup-closed-by-user": "Google 登入視窗已關閉。",
    "auth/popup-blocked": "瀏覽器封鎖了登入視窗，請允許彈出式視窗後重試。",
    "auth/unauthorized-domain": "此網域尚未加入 Firebase Authentication 的授權網域。",
    "auth/operation-not-allowed": "請先在 Firebase Console 啟用此登入方式。",
    "auth/too-many-requests": "嘗試次數過多，請稍後再試。"
  };
  return messages[error.code] || "登入目前無法完成，請稍後再試。";
}

async function ensureUserNickname(user, preferredNickname = "") {
  const profileRef = doc(db, "users", user.uid);
  const profile = await getDoc(profileRef);
  const savedNickname = profile.exists() ? profile.data().NickName : "";
  if (typeof savedNickname === "string" && savedNickname.trim()) return savedNickname.trim();

  const emailNickname = user.email?.split("@")[0] || "使用者";
  const nickname = preferredNickname.trim() || user.displayName?.trim() || emailNickname;
  await setDoc(profileRef, { NickName: nickname }, { merge: true });
  return nickname;
}

function updateAdminAccess() {
  elements.adminAccess.hidden = !currentUser || isAdminCheckPending || !isAdmin;
  elements.adminAccessStatus.textContent = !currentUser
    ? "請先登入以檢查管理員權限。"
    : isAdminCheckPending
      ? "正在確認管理員權限…"
      : !isAdmin
      ? adminAccessMessage
      : isAdminMode
        ? "管理員版本已啟用。"
        : adminAccessMessage || "已確認此 UID 具有管理員權限。";
  elements.adminModeToggle.hidden = !currentUser || !isAdmin || isAdminCheckPending;
  elements.adminModeToggle.disabled = !isAdmin || isAdminCheckPending;
  elements.adminModeToggle.textContent = isAdminMode ? "切換回一般版本" : "切換管理員版本";
  elements.adminModeBanner.hidden = !isAdmin || !isAdminMode;
  elements.storeManager.hidden = !isAdminMode;
  elements.paymentManager.hidden = !isAdminMode;
  if (isAdminMode) {
    renderStoreManager();
    renderPaymentManager();
  }
  document.body.classList.toggle("admin-mode", isAdmin && isAdminMode);
}

async function detectAdminAccess(user) {
  if (!user || isAdminCheckPending) return;

  isAdmin = false;
  isAdminMode = false;
  isAdminCheckPending = true;
  adminAccessMessage = "";
  updateAdminAccess();

  const probeCollection = collection(db, "Store", "__admin_access_probe", "checks");
  const probeRef = doc(probeCollection);
  const probeValue = `${user.uid}:${Date.now()}:${Math.random()}`;
  let probeCreated = false;

  try {
    // 寫入及讀回 Store 巢狀測試文件；權限判定仍由已部署的 Firestore Rules 決定。
    await setDoc(probeRef, { probe: probeValue });
    probeCreated = true;
    const probeSnapshot = await getDoc(probeRef);
    if (!probeSnapshot.exists() || probeSnapshot.data().probe !== probeValue) {
      throw new Error("管理員測試文件讀回內容不符。");
    }
    if (currentUser?.uid === user.uid) isAdmin = true;
  } catch (error) {
    console.error("管理員資料庫讀寫測試失敗。", error);
    if (currentUser?.uid === user.uid) {
      adminAccessMessage = error.code === "permission-denied"
        ? "資料庫拒絕寫入測試；此帳號沒有管理員寫入權限，或 Rules 尚未允許測試路徑。"
        : "無法完成資料庫權限測試，請檢查網路與 Firestore Rules。";
    }
  } finally {
    if (probeCreated) {
      try {
        await deleteDoc(probeRef);
      } catch (error) {
        console.error("無法清除管理員測試文件。", error);
        if (currentUser?.uid === user.uid && isAdmin) {
          adminAccessMessage = "已通過讀寫測試，但測試文件清理失敗，請檢查 Firestore Rules。";
        }
      }
    }
    if (currentUser?.uid === user.uid) {
      isAdminCheckPending = false;
      if (!isAdmin) isAdminMode = false;
      updateAdminAccess();
    }
  }
}

async function openProfilePage() {
  if (!currentUser) {
    openAuthDialog();
    return;
  }

  setPage("profile");
  void detectAdminAccess(currentUser);
  elements.profileUid.textContent = currentUser.uid;
  elements.profileStatus.textContent = "正在載入個人資料…";
  try {
    const profile = await getDoc(doc(db, "users", currentUser.uid));
    const nickname = profile.exists() ? profile.data().NickName : "";
    elements.profileNickname.value = typeof nickname === "string" && nickname.trim()
      ? nickname.trim()
      : elements.authTrigger.textContent;
    elements.profileStatus.textContent = "可編輯顯示暱稱並儲存。";
  } catch (error) {
    console.error("讀取個人資料失敗。", error);
    elements.profileStatus.textContent = "讀取失敗，請檢查 Firestore 權限後重試。";
  }
  updateAdminAccess();
}

async function saveProfile(event) {
  event.preventDefault();
  if (!currentUser) return;

  const nickname = elements.profileNickname.value.trim();
  if (!nickname || nickname.length > 40) {
    elements.profileStatus.textContent = "暱稱需為 1 至 40 個字元。";
    return;
  }

  const submitButton = elements.profileForm.querySelector("button[type='submit']");
  submitButton.disabled = true;
  elements.profileStatus.textContent = "正在儲存…";
  try {
    await setDoc(doc(db, "users", currentUser.uid), { NickName: nickname }, { merge: true });
    elements.authTrigger.textContent = nickname;
    elements.authTrigger.setAttribute("aria-label", `目前登入：${nickname}`);
    elements.profileStatus.textContent = "暱稱已更新。";
  } catch (error) {
    console.error("更新暱稱失敗。", error);
    elements.profileStatus.textContent = "儲存失敗，請確認登入狀態與 Firestore 規則。";
  } finally {
    submitButton.disabled = false;
  }
}

function toggleAdminMode() {
  if (!isAdmin) return;
  isAdminMode = !isAdminMode;
  updateAdminAccess();
}

function openAuthDialog() {
  setAuthMode("login");
  elements.authForm.reset();
  elements.authDialog.showModal();
  elements.emailInput.focus();
}

async function submitAuthForm(event) {
  event.preventDefault();
  elements.authError.hidden = true;
  elements.authSubmit.disabled = true;
  elements.googleSignin.disabled = true;
  try {
    const email = elements.emailInput.value.trim();
    const password = elements.passwordInput.value;
    if (authMode === "signup") {
      pendingSignupNickname = elements.nicknameInput.value.trim();
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await ensureUserNickname(credential.user, pendingSignupNickname);
      pendingSignupNickname = "";
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
    elements.authDialog.close();
  } catch (error) {
    console.error("Firebase Authentication 操作失敗。", error);
    showAuthError(describeAuthError(error));
  } finally {
    pendingSignupNickname = "";
    elements.authSubmit.disabled = false;
    elements.googleSignin.disabled = false;
  }
}

async function signInWithGoogle() {
  elements.authError.hidden = true;
  elements.googleSignin.disabled = true;
  elements.authSubmit.disabled = true;
  try {
    await signInWithPopup(auth, googleProvider);
    elements.authDialog.close();
  } catch (error) {
    console.error("Google 登入失敗。", error);
    showAuthError(describeAuthError(error));
  } finally {
    elements.googleSignin.disabled = false;
    elements.authSubmit.disabled = false;
  }
}

onAuthStateChanged(auth, async user => {
  currentUser = user;
  elements.authLogout.hidden = !user;
  if (!user) {
    isAdmin = false;
    isAdminMode = false;
    isAdminCheckPending = false;
    adminAccessMessage = "請先登入以檢查管理員權限。";
    savedMethods = [];
    hasSavedRecord = false;
    paymentSettingsLoaded = false;
    renderPayments();
    renderStores();
    updateAdminAccess();
    elements.authTrigger.textContent = "登入 / 註冊";
    if (!document.querySelector("#profile-page").hidden) setPage("home");
    return;
  }

  isAdmin = false;
  isAdminMode = false;
  isAdminCheckPending = false;
  adminAccessMessage = "開啟個人資料頁時，會測試資料庫讀寫權限。";
  void loadUserPaymentMethods(user);
  updateAdminAccess();
  elements.authTrigger.textContent = "載入暱稱…";
  try {
    const nickname = await ensureUserNickname(user, pendingSignupNickname);
    elements.authTrigger.textContent = nickname;
    elements.authTrigger.setAttribute("aria-label", `目前登入：${nickname}`);
  } catch (error) {
    console.error("讀取或建立使用者暱稱失敗。", error);
    elements.authTrigger.textContent = user.displayName || user.email?.split("@")[0] || "已登入";
  }
});

elements.authTrigger.addEventListener("click", () => {
  if (!currentUser) openAuthDialog();
  else void openProfilePage();
});
elements.profileForm.addEventListener("submit", saveProfile);
elements.adminModeToggle.addEventListener("click", toggleAdminMode);
elements.storeManagerForm.addEventListener("submit", event => {
  void addCatalogItem(event, {
    collectionName: "Store",
    form: elements.storeManagerForm,
    name: elements.storeManagerName,
    keywords: elements.storeManagerKeywords,
    category: elements.storeManagerCategory,
    offers: elements.storeManagerOffers,
    status: elements.storeManagerStatus
  });
});
elements.storeManagerCancel.addEventListener("click", () => cancelCatalogEdit("Store"));
elements.paymentManagerForm.addEventListener("submit", event => {
  void addCatalogItem(event, {
    collectionName: "PaymentMethods",
    form: elements.paymentManagerForm,
    name: elements.paymentManagerName,
    keywords: elements.paymentManagerKeywords,
    category: elements.paymentManagerCategory,
    offers: elements.paymentManagerOffers,
    status: elements.paymentManagerStatus
  });
});
elements.paymentManagerCancel.addEventListener("click", () => cancelCatalogEdit("PaymentMethods"));
elements.authClose.addEventListener("click", () => elements.authDialog.close());
elements.authDialog.addEventListener("click", event => {
  if (event.target === elements.authDialog) elements.authDialog.close();
});
elements.authModeButtons.forEach(button => button.addEventListener("click", () => setAuthMode(button.dataset.authMode)));
elements.authForm.addEventListener("submit", submitAuthForm);
elements.googleSignin.addEventListener("click", signInWithGoogle);
elements.authLogout.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("登出失敗。", error);
    setNotice("登出失敗，請稍後再試。 ");
  }
});

elements.pageLinks.forEach(link => link.addEventListener("click", () => setPage(link.dataset.pageLink)));
elements.menuToggle.addEventListener("click", () => {
  const isOpen = elements.menuToggle.getAttribute("aria-expanded") === "true";
  elements.menuToggle.setAttribute("aria-expanded", String(!isOpen));
  elements.menuToggle.setAttribute("aria-label", isOpen ? "開啟導覽選單" : "關閉導覽選單");
  elements.nav.classList.toggle("is-open", !isOpen);
});
elements.searchForm.addEventListener("submit", event => {
  event.preventDefault();
  renderStores();
});
elements.searchInput.addEventListener("input", renderStores);
elements.paymentSearch.addEventListener("input", filterPaymentMethods);
elements.saveButton.addEventListener("click", savePayments);

// Analytics 僅在瀏覽器支援時啟用；Authentication 與 Firestore 獨立運作。
isSupported().then(supported => {
  if (supported) getAnalytics(app);
}).catch(error => console.warn("Firebase Analytics 無法啟用。", error));

loadFirestoreData().catch(error => {
  console.error("Firestore 資料讀取失敗。", error);
  setNotice("資料讀取失敗，請檢查 Firebase 設定、網路連線與 Firestore Security Rules。 ");
  elements.storeList.setAttribute("aria-busy", "false");
  elements.paymentList.setAttribute("aria-busy", "false");
  renderPayments();
  renderStoreCategoryFilters();
  renderStores();
}).finally(() => {
  elements.storeList.setAttribute("aria-busy", "false");
  elements.paymentList.setAttribute("aria-busy", "false");
});