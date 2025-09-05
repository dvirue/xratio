// --- Config ---
const THRESHOLDS = { green: 3, amber: 1 }; // %
// ---------------

/***** Utilidades *****/
// Reemplaza la función parseCount por esta
function parseCount(text) {
  if (!text) return NaN;
  const t = text.replace(/\u00A0/g, " ").trim().toLowerCase();

  // Captura número y sufijo explícito (sin solaparse)
  // Soporta: "73 mil", "1 m", "1,2 m", "15k", "2.3m", "1.234"
  const m = t.match(/^([0-9]+(?:[.,][0-9]+)?)\s*(k|mil|m|millón|millones)?\b/);
  if (!m) return NaN;

  // Normalizo el número
  let n = m[1].replace(/\./g, "").replace(/,/g, ".");
  let val = parseFloat(n);
  if (isNaN(val)) return NaN;

  // Sufijo bien definido (sin overlaps)
  const suf = (m[2] || "").toLowerCase();
  switch (suf) {
    case "k":       val *= 1e3; break;
    case "mil":     val *= 1e3; break;
    case "m":
    case "millón":
    case "millones": val *= 1e6; break;
    default: break; // sin sufijo
  }

  return val;
}

function upsertBadge(host, likes, views) {
  if (!host) return;
  let badge = host.querySelector(".x-likeview-badge");
  if (!badge) {
    badge = document.createElement("span");
    badge.className = "x-likeview-badge";
    host.appendChild(badge);
  }
  const ratio = views > 0 ? (likes / views) * 100 : NaN;
  const pct = isFinite(ratio) ? (ratio >= 1 ? ratio.toFixed(2) : ratio.toFixed(3)) : "—";
  badge.textContent = `ER ${pct}%`;
  badge.title = `Likes: ${likes.toLocaleString()} · Vistas: ${views.toLocaleString()} · ER = likes / vistas × 100`;

  // Colorear por rangos
  badge.classList.remove("er-green", "er-amber", "er-red", "er-neutral");
  if (!isFinite(ratio)) {
    badge.classList.add("er-neutral");
  } else if (ratio > THRESHOLDS.green) {
    badge.classList.add("er-green");
  } else if (ratio >= THRESHOLDS.amber) {
    badge.classList.add("er-amber");
  } else {
    badge.classList.add("er-red");
  }
}

/***** Extracción robusta *****/
// Obtiene el contenedor de métricas (grupo de botones) de un post
function getMetricsGroup(article) {
  // Botón de like -> subimos al grupo
  const likeBtn = article.querySelector('[data-testid="like"], [data-testid="unlike"]');
  return likeBtn?.closest('[role="group"]') || likeBtn?.closest('div') || article;
}

// Cuenta visible dentro de un botón (reply/retweet/like/bookmark)
function getButtonCount(btn) {
  if (!btn) return 0;
  // X usa spans de transición con data-testid app-text-transition-container
  const numEl =
    btn.querySelector('[data-testid="app-text-transition-container"]') ||
    btn.querySelector('span');
  const txt = numEl?.innerText?.trim() || "";
  const v = parseCount(txt);
  return isFinite(v) ? v : 0;
}

function extractCounts(article) {
  const group = getMetricsGroup(article);
  if (!group) return null;

  // Botones conocidos
  const replyBtn = group.querySelector('[data-testid="reply"]');
  const rtBtn    = group.querySelector('[data-testid="retweet"], [data-testid="unretweet"]');
  const likeBtn  = group.querySelector('[data-testid="like"], [data-testid="unlike"]');
  const bmBtn    = group.querySelector('[data-testid="bookmark"], [data-testid="unbookmark"]');

  const reply = getButtonCount(replyBtn);
  const rt    = getButtonCount(rtBtn);
  const likes = getButtonCount(likeBtn);
  const bm    = getButtonCount(bmBtn);

  // El bloque de visualizaciones suele estar en el MISMO grupo pero no es botón.
  // Estrategia: buscar todos los spans numéricos y tomar el MAYOR número que
  // no coincide con reply/rt/likes/bookmarks y está a la derecha.
  const numbers = [];
  group.querySelectorAll("span").forEach((s) => {
    const v = parseCount(s.innerText);
    if (isFinite(v) && v > 0) {
      numbers.push({ el: s, v });
    }
  });

  // Orden izquierda->derecha aproximada: replies, RTs, likes, bookmarks, views
  // Nos quedamos con el mayor número que no sea exactamente reply/rt/likes/bm.
  const known = new Set([reply, rt, likes, bm]);
  let views = 0;
  for (const n of numbers) {
    if (!known.has(n.v)) views = Math.max(views, n.v);
  }

  if (likes <= 0 || views <= 0) return null;
  return { group, likes, views };
}

function processArticle(article) {
  if (!article || article.dataset.__xLvDone === "1") return;

  const data = extractCounts(article);
  if (data) {
    upsertBadge(data.group, data.likes, data.views);
    article.dataset.__xLvDone = "1";
  }
}

/***** Observador *****/
const observer = new MutationObserver(() => {
  document.querySelectorAll('article, [data-testid="tweet"]').forEach(processArticle);
});

function init() {
  observer.observe(document.body, { childList: true, subtree: true });
  document.querySelectorAll('article, [data-testid="tweet"]').forEach(processArticle);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

/***** DEBUG opcional (F12 consola) *****/
// window.__xLvDebugScan = () => { document.querySelectorAll('article').forEach(a=>{a.dataset.__xLvDone=""; processArticle(a);}); console.log("re-scan"); };
