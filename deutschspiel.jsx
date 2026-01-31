import { useState, useEffect, useRef, useCallback } from "react";

/* ══════════════════════════════════════════════════════════════
   FIREBASE CONFIG  — apunta a un proyecto gratuito de Firebase.
   El maestro debe crear un proyecto en https://console.firebase.google.com
   y reemplazar estos valores con los suyos propios.
   ══════════════════════════════════════════════════════════════ */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBGoh0DV80fhGArMU8rpj2kPteIlETsU9U",
  databaseURL: "https://deutsch-4479a-default-rtdb.firebaseio.com",
};

/* ──────────────────────────────────────────────
   FIREBASE SDK (cargado dinámicamente desde CDN)
   ────────────────────────────────────────────── */
let firebaseApp = null;
let db = null;
let firebaseReady = null; // Promise que se resuelve cuando Firebase está listo

function initFirebase() {
  if (firebaseReady) return firebaseReady;
  firebaseReady = new Promise((resolve, reject) => {
    // Cargar firebase compat desde CDN
    const scripts = [
      "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js",
      "https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js",
    ];
    let loaded = 0;
    scripts.forEach((src) => {
      if (document.querySelector(`script[src="${src}"]`)) { loaded++; if (loaded === scripts.length) finish(); return; }
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => { loaded++; if (loaded === scripts.length) finish(); };
      s.onerror = () => reject(new Error("No se pudo cargar Firebase SDK"));
      document.head.appendChild(s);
    });
    function finish() {
      try {
        firebaseApp = window.firebase.initializeApp(FIREBASE_CONFIG);
        db = window.firebase.database();
        resolve(db);
      } catch (e) { reject(e); }
    }
  });
  return firebaseReady;
}

/* ──── helper: referencia a una sala ──── */
function roomRef(code) { return db.ref(`rooms/${code}`); }

/* ══════════════════════════════════════════════
   KEYFRAMES + FONTS (inyectados una vez)
   ══════════════════════════════════════════════ */
(function injectStyles() {
  if (document.getElementById("ds-styles")) return;
  const s = document.createElement("style");
  s.id = "ds-styles";
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Bangers&family=Nunito:wght@400;600;700;800&display=swap');
    @keyframes fadeUp   { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
    @keyframes scaleIn  { from{opacity:0;transform:scale(0.78)}     to{opacity:1;transform:scale(1)}     }
    @keyframes popIn    { 0%{opacity:0;transform:scale(0.5)} 60%{transform:scale(1.1)} 100%{opacity:1;transform:scale(1)} }
    @keyframes float1   { 0%,100%{transform:translateY(0) scale(1)}        50%{transform:translateY(-28px) scale(1.06)} }
    @keyframes float2   { 0%,100%{transform:translateY(0) rotate(0deg)}   50%{transform:translateY(-20px) rotate(5deg)} }
    @keyframes timerWarn{ 0%,100%{transform:scale(1)} 50%{transform:scale(1.14)} }
    @keyframes confettiFall{ 0%{transform:translateY(-10px) rotate(0deg);opacity:1} 100%{transform:translateY(380px) rotate(740deg);opacity:0} }
    @keyframes podiumRise{ from{transform:scaleY(0);opacity:0} to{transform:scaleY(1);opacity:1} }
    @keyframes slideIn  { from{opacity:0;transform:translateX(36px)} to{opacity:1;transform:translateX(0)} }
    @keyframes pulse    { 0%,100%{opacity:1} 50%{opacity:0.5} }
  `;
  document.head.appendChild(s);
})();

/* ══════════════════════════════════════════════
   DATOS DE JUEGO
   ══════════════════════════════════════════════ */
const GAME_DATA = {
  game1: {
    id: "game1", title: "🎯 Dativ oder Akkusativ?", category: 1,
    description: "Elige la preposición correcta según ¿Wo? o ¿Wohin?",
    questions: [
      { q: "Die Katze liegt ___ dem Tisch.", hint: "¿Wo? → Dativ", options: ["auf","unter","in","vor"], answer: 0, explanation: "\"liegt\" → ¿Wo? → Dativ. Die Katze liegt auf dem Tisch (encima de la mesa)." },
      { q: "Er legt das Buch ___ den Tisch.", hint: "¿Wohin? → Akkusativ", options: ["auf","unter","neben","vor"], answer: 0, explanation: "\"legt\" → ¿Wohin? → Akkusativ. Él pone el libro encima de la mesa." },
      { q: "Die Lampe hängt ___ dem Sofa.", hint: "¿Wo? → Dativ", options: ["über","auf","in","unter"], answer: 0, explanation: "\"hängt\" → ¿Wo? → Dativ. La lámpara está encima del sofá." },
      { q: "Sie stellt die Blume ___ die Fenster.", hint: "¿Wohin? → Akkusativ", options: ["vor","auf","unter","hinter"], answer: 0, explanation: "\"stellt\" → ¿Wohin? → Akkusativ. Ella pone la flor delante de las ventanas." },
      { q: "Das Handy liegt ___ dem Leiter.", hint: "¿Wo? → Dativ", options: ["auf","unter","neben","in"], answer: 2, explanation: "\"liegt\" → ¿Wo? → Dativ. El teléfono está junto al libro." },
      { q: "Er hängt den Mantel ___ die Tür.", hint: "¿Wohin? → Akkusativ", options: ["hinter","auf","unter","vor"], answer: 0, explanation: "\"hängt\" (transitiv) → ¿Wohin? → Akkusativ. Él cuelga el abrigo detrás de la puerta." },
      { q: "Die Sachen liegen ___ dem Tisch.", hint: "¿Wo? → Dativ", options: ["auf","unter","vor","hinter"], answer: 0, explanation: "Como en el ejemplo: \"Die Sachen liegen auf dem Tisch.\" → Dativ." },
      { q: "Sie legt die Sachen ___ den Tisch.", hint: "¿Wohin? → Akkusativ", options: ["auf","unter","vor","hinter"], answer: 0, explanation: "Como en el ejemplo: \"Er legt die Sachen auf den Tisch.\" → Akkusativ." },
    ]
  },
  game2: {
    id: "game2", title: "🧩 Completa la Frase", category: 1,
    description: "Ordena las palabras para formar la frase correcta",
    questions: [
      { words: ["Die","Katze","liegt","auf","dem","Tisch."], answer: "Die Katze liegt auf dem Tisch.", hint: "¿Wo? → Dativ", explanation: "Dativ: auf + dem (m). La gata está encima de la mesa." },
      { words: ["Er","legt","das","Buch","auf","den","Tisch."], answer: "Er legt das Buch auf den Tisch.", hint: "¿Wohin? → Akkusativ", explanation: "Akkusativ: auf + den (m). Él pone el libro encima de la mesa." },
      { words: ["Sie","steht","vor","dem","Haus."], answer: "Sie steht vor dem Haus.", hint: "¿Wo? → Dativ", explanation: "Dativ: vor + dem (n). Ella está delante de la casa." },
      { words: ["Er","stellt","die","Blume","vor","die","Tür."], answer: "Er stellt die Blume vor die Tür.", hint: "¿Wohin? → Akkusativ", explanation: "Akkusativ: vor + die (f). Él pone la flor delante de la puerta." },
      { words: ["Das","Handy","liegt","neben","dem","Leiter."], answer: "Das Handy liegt neben dem Leiter.", hint: "¿Wo? → Dativ", explanation: "Dativ: neben + dem (m). El teléfono está junto al libro." },
      { words: ["Die","Lampe","hängt","über","dem","Sofa."], answer: "Die Lampe hängt über dem Sofa.", hint: "¿Wo? → Dativ", explanation: "Dativ: über + dem (n). La lámpara está encima del sofá." },
      { words: ["Er","hängt","den","Mantel","hinter","die","Tür."], answer: "Er hängt den Mantel hinter die Tür.", hint: "¿Wohin? → Akkusativ", explanation: "Akkusativ: hinter + die (f). Él cuelga el abrigo detrás de la puerta." },
      { words: ["Sie","legt","die","Sachen","unter","den","Tisch."], answer: "Sie legt die Sachen unter den Tisch.", hint: "¿Wohin? → Akkusativ", explanation: "Akkusativ: unter + den (m). Ella pone las cosas debajo de la mesa." },
    ]
  },
  game3: {
    id: "game3", title: "⚡ Verbo Relámpago", category: 2,
    description: "¿Cuál verbo encaja mejor? Posición vs. movimiento",
    questions: [
      { q: "Das Buch ___ auf dem Tisch.", hint: "¿Wo está el libro?", options: ["liegt","legt","stellt","hängt"], answer: 0, explanation: "\"liegt\" = estar (posición horizontal). ¿Wo? → Dativ." },
      { q: "Er ___ das Buch auf den Tisch.", hint: "¿Qué hace él?", options: ["liegt","legt","steht","hängt"], answer: 1, explanation: "\"legt\" = poner (movimiento, horizontal). ¿Wohin? → Akkusativ." },
      { q: "Die Blume ___ vor dem Fenster.", hint: "¿Wo está la flor?", options: ["steht","legt","stellt","hängt"], answer: 0, explanation: "\"steht\" = estar (posición vertical). ¿Wo? → Dativ." },
      { q: "Sie ___ die Blume vor das Fenster.", hint: "¿Qué hace ella?", options: ["steht","liegt","stellt","legt"], answer: 2, explanation: "\"stellt\" = poner (movimiento, vertical). ¿Wohin? → Akkusativ." },
      { q: "Der Mantel ___ hinter der Tür.", hint: "¿Dónde está el abrigo?", options: ["hängt","liegt","steht","stellt"], answer: 0, explanation: "\"hängt\" = estar colgado (posición). ¿Wo? → Dativ." },
      { q: "Er ___ den Mantel hinter die Tür.", hint: "¿Qué hace él?", options: ["hängt","liegt","steht","stellt"], answer: 0, explanation: "\"hängt\" (transitiv) = cuelgar (movimiento). ¿Wohin? → Akkusativ." },
      { q: "Die Glühbirnen ___ neben dem Leiter.", hint: "¿Dónde están las bombillas?", options: ["liegen","stehen","hängen","stellen"], answer: 0, explanation: "\"liegen\" = estar (posición horizontal, plural). ¿Wo? → Dativ." },
      { q: "Sie ___ die Glühbirnen neben den Leiter.", hint: "¿Qué hace ella?", options: ["liegen","stehen","legt","stellt"], answer: 2, explanation: "\"legt\" = poner (movimiento, horizontal). ¿Wohin? → Akkusativ." },
    ]
  },
  game4: {
    id: "game4", title: "🎮 Verbo vs. Caso", category: 2,
    description: "¿Es posición (Dativ) o movimiento (Akkusativ)?",
    questions: [
      { q: "\"Die Sachen liegen auf dem Tisch.\" – ¿Función del verbo?", options: ["Posición (¿Wo? → Dativ)","Movimiento (¿Wohin? → Akkusativ)"], answer: 0, explanation: "\"liegen\" es POSICIÓN. Responde a ¿Wo? → Dativ." },
      { q: "\"Er legt die Sachen auf den Tisch.\" – ¿Función del verbo?", options: ["Posición (¿Wo? → Dativ)","Movimiento (¿Wohin? → Akkusativ)"], answer: 1, explanation: "\"legt\" es MOVIMIENTO. Responde a ¿Wohin? → Akkusativ." },
      { q: "\"Sie steht vor dem Haus.\" – ¿Función del verbo?", options: ["Posición (¿Wo? → Dativ)","Movimiento (¿Wohin? → Akkusativ)"], answer: 0, explanation: "\"steht\" es POSICIÓN. Responde a ¿Wo? → Dativ." },
      { q: "\"Er stellt die Blume vor die Tür.\" – ¿Función del verbo?", options: ["Posición (¿Wo? → Dativ)","Movimiento (¿Wohin? → Akkusativ)"], answer: 1, explanation: "\"stellt\" es MOVIMIENTO. Responde a ¿Wohin? → Akkusativ." },
      { q: "\"Der Mantel hängt hinter der Tür.\" – ¿Función del verbo?", options: ["Posición (¿Wo? → Dativ)","Movimiento (¿Wohin? → Akkusativ)"], answer: 0, explanation: "\"hängt\" (intransitiv) es POSICIÓN. El abrigo está colgado." },
      { q: "\"Er hängt den Mantel hinter die Tür.\" – ¿Función del verbo?", options: ["Posición (¿Wo? → Dativ)","Movimiento (¿Wohin? → Akkusativ)"], answer: 1, explanation: "\"hängt\" (transitiv) es MOVIMIENTO. Él cuelga el abrigo." },
      { q: "\"Die Lampe hängt über dem Sofa.\" – ¿Función del verbo?", options: ["Posición (¿Wo? → Dativ)","Movimiento (¿Wohin? → Akkusativ)"], answer: 0, explanation: "\"hängt\" (intransitiv) es POSICIÓN. La lámpara está colgada." },
      { q: "\"Sie stellt die Lampe über den Tisch.\" – ¿Función del verbo?", options: ["Posición (¿Wo? → Dativ)","Movimiento (¿Wohin? → Akkusativ)"], answer: 1, explanation: "\"stellt\" es MOVIMIENTO. ¿Wohin? → Akkusativ." },
    ]
  }
};

const TIME_PER_Q = 15;
const POINTS_BASE = 1000;
const GAME_COLORS = { game1: "#e040fb", game2: "#00e5ff", game3: "#76ff03", game4: "#ffea00" };

function calcPoints(t) { return Math.max(100, Math.round((t / TIME_PER_Q) * POINTS_BASE)); }
function generateCode() { return Math.floor(100000 + Math.random() * 900000).toString(); }
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

/* ══════════════════════════════════════════════
   DECORACIÓN: Orbs + Grid
   ══════════════════════════════════════════════ */
function FloatingOrbs() {
  const orbs = [
    { w: 200, h: 200, top: "6%", left: "-5%", bg: "radial-gradient(circle,#e040fb2a 0%,transparent 70%)", anim: "float1 7s ease-in-out infinite" },
    { w: 150, h: 150, top: "62%", right: "-3%", bg: "radial-gradient(circle,#00e5ff22 0%,transparent 70%)", anim: "float2 9s ease-in-out infinite" },
    { w: 90, h: 90, top: "28%", left: "74%", bg: "radial-gradient(circle,#ffea0018 0%,transparent 70%)", anim: "float1 5s ease-in-out infinite 1s" },
  ];
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {orbs.map((o, i) => (
        <div key={i} style={{ position: "absolute", width: o.w, height: o.h, top: o.top, left: o.left, right: o.right, background: o.bg, borderRadius: "50%", animation: o.anim, filter: "blur(7px)" }} />
      ))}
    </div>
  );
}
function GridOverlay() {
  return <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)", backgroundSize: "48px 48px" }} />;
}

/* ══════════════════════════════════════════════
   CONFETTI
   ══════════════════════════════════════════════ */
function Confetti({ active }) {
  if (!active) return null;
  const colors = ["#e040fb","#00e5ff","#ffea00","#76ff03","#ff5252","#ff9800"];
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 200, overflow: "hidden" }}>
      {Array.from({ length: 40 }, (_, i) => {
        const left = 3 + Math.random() * 94;
        const delay = Math.random() * 0.5;
        const dur = 1.3 + Math.random() * 0.7;
        const size = 5 + Math.random() * 10;
        const color = colors[i % colors.length];
        const shape = i % 3 === 0 ? "50%" : i % 3 === 1 ? "2px" : "0";
        return <div key={i} style={{ position: "absolute", top: -16, left: `${left}%`, width: size, height: size * 1.5, background: color, borderRadius: shape, animation: `confettiFall ${dur}s ease-in ${delay}s forwards` }} />;
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════
   SHARED COMPONENTS
   ══════════════════════════════════════════════ */
function BackBtn({ onClick }) {
  return (
    <button onClick={onClick} style={{ background: "none", border: "1px solid rgba(255,255,255,0.12)", color: "#8a9bb5", borderRadius: 24, padding: "7px 18px", fontSize: 14, fontWeight: 700, fontFamily: "'Nunito',sans-serif", cursor: "pointer" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)"; e.currentTarget.style.color = "#fff"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "#8a9bb5"; }}
    >← Atrás</button>
  );
}

const PAGE = { minHeight: "100vh", background: "#0a0e1a", color: "#fff", position: "relative", overflow: "hidden", fontFamily: "'Nunito',sans-serif" };

/* ══════════════════════════════════════════════
   HOME
   ══════════════════════════════════════════════ */
function HomeScreen({ onStart }) {
  return (
    <div style={PAGE}>
      <FloatingOrbs /><GridOverlay />
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "52px 20px 40px", maxWidth: 680, margin: "0 auto" }}>
        <div style={{ fontSize: 60, marginBottom: 2, filter: "drop-shadow(0 0 18px #e040fb66)" }}>🇩🇪</div>
        <h1 style={{ fontFamily: "'Bangers',cursive", fontSize: 50, letterSpacing: 3, margin: 0, background: "linear-gradient(135deg,#e040fb,#00e5ff,#ffea00)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textAlign: "center" }}>DeutschSpiel</h1>
        <p style={{ fontSize: 15, color: "#6b7a99", textAlign: "center", margin: "10px 0 34px", lineHeight: 1.6, maxWidth: 380 }}>
          Aprende <strong style={{ color: "#00e5ff" }}>Wechselpräpositionen</strong> de forma divertida y competitiva
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, width: "100%", marginBottom: 38 }}>
          {Object.values(GAME_DATA).map((g, i) => {
            const accent = GAME_COLORS[g.id];
            return (
              <div key={g.id} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${accent}3a`, borderRadius: 16, padding: "18px 16px", boxShadow: `0 0 18px ${accent}14`, animation: `fadeUp 0.5s ease ${i * 0.1}s both` }}>
                <span style={{ display: "inline-block", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.5, color: accent, background: `${accent}18`, padding: "3px 10px", borderRadius: 20, marginBottom: 8 }}>{g.category === 1 ? "Punto 1" : "Punto 2"}</span>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 5 }}>{g.title}</div>
                <div style={{ fontSize: 12, color: "#5a6680", lineHeight: 1.5 }}>{g.description}</div>
              </div>
            );
          })}
        </div>
        <button onClick={onStart} style={{ background: "linear-gradient(135deg,#e040fb,#c020d9)", color: "#fff", border: "none", borderRadius: 50, padding: "16px 44px", fontSize: 18, fontWeight: 800, fontFamily: "'Nunito',sans-serif", cursor: "pointer", boxShadow: "0 4px 28px #e040fb44" }}
          onMouseDown={e => e.currentTarget.style.transform = "scale(0.95)"}
          onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        >Crear / Unirse a Juego</button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   SETUP (Crear o Unirse)
   ══════════════════════════════════════════════ */
function SetupScreen({ onHost, onJoin, onBack }) {
  return (
    <div style={PAGE}>
      <FloatingOrbs /><GridOverlay />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 520, margin: "0 auto", padding: "32px 20px" }}>
        <BackBtn onClick={onBack} />
        <h2 style={{ fontFamily: "'Bangers',cursive", fontSize: 36, letterSpacing: 2, textAlign: "center", margin: "52px 0 38px", color: "#fff" }}>¿Qué quieres hacer?</h2>
        <div style={{ display: "flex", gap: 18 }}>
          {[
            { icon: "👑", title: "Crear Juego", desc: "Eres el host. Se genera un código y los alumnos se unen automáticamente.", color: "#e040fb", onClick: onHost },
            { icon: "🎫", title: "Unirse", desc: "Ingresa el código que te dio el profe y tu nombre.", color: "#00e5ff", onClick: onJoin },
          ].map((c, i) => (
            <div key={i} onClick={c.onClick} style={{ flex: 1, background: "rgba(255,255,255,0.045)", border: `1px solid ${c.color}30`, borderRadius: 20, padding: "32px 20px 28px", cursor: "pointer", textAlign: "center", boxShadow: `0 0 24px ${c.color}12`, transition: "transform 0.18s, box-shadow 0.18s", animation: `fadeUp 0.45s ease ${i * 0.12}s both` }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = `0 6px 32px ${c.color}28`; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = `0 0 24px ${c.color}12`; }}
            >
              <div style={{ fontSize: 46, marginBottom: 14, filter: `drop-shadow(0 0 12px ${c.color}55)` }}>{c.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: "#fff" }}>{c.title}</div>
              <div style={{ fontSize: 13, color: "#6b7a99", lineHeight: 1.55 }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   JOIN
   ══════════════════════════════════════════════ */
function JoinScreen({ onJoined, onBack }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    if (!name.trim()) { setError("Por favor ingresa tu nombre"); return; }
    if (code.trim().length !== 6) { setError("El código debe tener 6 dígitos"); return; }
    setLoading(true);
    setError("");
    try {
      await initFirebase();
      const snap = await roomRef(code.trim()).once("value");
      if (!snap.exists()) { setError("No se encontró esa sala. Revisa el código."); setLoading(false); return; }
      const roomData = snap.val();
      if (roomData.started) { setError("El juego ya inició. Espera a la siguiente ronda."); setLoading(false); return; }
      // Agregar jugador
      const playerId = uid();
      await roomRef(code.trim()).child("players").child(playerId).set({
        id: playerId, name: name.trim(), color: `hsl(${Math.floor(Math.random() * 360)},70%,55%)`, score: 0, joined: Date.now()
      });
      onJoined({ code: code.trim(), playerId, playerName: name.trim() });
    } catch (e) {
      setError("Error al conectar. Revisa tu conexión.");
      setLoading(false);
    }
  }

  const inp = { width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: "13px 16px", color: "#fff", fontSize: 16, fontFamily: "'Nunito',sans-serif", boxSizing: "border-box", outline: "none" };

  return (
    <div style={PAGE}>
      <FloatingOrbs /><GridOverlay />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 400, margin: "0 auto", padding: "32px 20px" }}>
        <BackBtn onClick={onBack} />
        <div style={{ marginTop: 56, textAlign: "center" }}>
          <h2 style={{ fontFamily: "'Bangers',cursive", fontSize: 34, letterSpacing: 2, color: "#fff", marginBottom: 28 }}>🎮 Unirse al Juego</h2>
          <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#00e5ff", textAlign: "left", marginBottom: 7, textTransform: "uppercase", letterSpacing: 1.2 }}>Tu nombre</label>
          <input value={name} onChange={e => { setName(e.target.value); setError(""); }} placeholder="Ej: María" style={inp} />
          <label style={{ display: "block", fontSize: 12, fontWeight: 800, color: "#00e5ff", textAlign: "left", marginBottom: 7, textTransform: "uppercase", letterSpacing: 1.2, marginTop: 18 }}>Código del juego</label>
          <input value={code} onChange={e => { setCode(e.target.value); setError(""); }} placeholder="Ej: 482917" maxLength={6} style={inp} />
          {error && <div style={{ color: "#ff5252", fontSize: 13, textAlign: "left", marginTop: 7, fontWeight: 600 }}>{error}</div>}
          <button onClick={handleJoin} disabled={loading} style={{ width: "100%", marginTop: 28, background: loading ? "#2a2f3e" : "linear-gradient(135deg,#00e5ff,#00bcd4)", color: loading ? "#5a6680" : "#0a0e1a", border: "none", borderRadius: 50, padding: "14px", fontSize: 17, fontWeight: 800, fontFamily: "'Nunito',sans-serif", cursor: loading ? "not-allowed" : "pointer", boxShadow: loading ? "none" : "0 4px 24px #00e5ff33" }}>
            {loading ? "Conectando…" : "Unirse →"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   LOBBY (vista compartida host + jugadores)
   ══════════════════════════════════════════════ */
function LobbyScreen({ gameCode, isHost, players, selectedGames, onStartGame, onGameToggle, onBack }) {
  return (
    <div style={PAGE}>
      <FloatingOrbs /><GridOverlay />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 580, margin: "0 auto", padding: "24px 20px 40px" }}>
        <BackBtn onClick={onBack} />
        {/* CÓDIGO */}
        <div style={{ background: "linear-gradient(135deg,rgba(224,64,251,0.1),rgba(0,229,255,0.07))", border: "1px solid #e040fb3a", borderRadius: 20, padding: "22px 20px", textAlign: "center", marginTop: 28, marginBottom: 28, boxShadow: "0 0 32px #e040fb14" }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 2.5, color: "#6b7a99", marginBottom: 6 }}>Código de unión</div>
          <div style={{ fontFamily: "'Bangers',cursive", fontSize: 52, letterSpacing: 10, color: "#e040fb", margin: "4px 0", textShadow: "0 0 20px #e040fb44" }}>{gameCode}</div>
          <div style={{ fontSize: 12, color: "#4a5668" }}>Los alumnos ingresan este código para unirse automáticamente</div>
        </div>

        {/* SELECTOR DE JUEGOS (solo host) */}
        {isHost && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.5, color: "#6b7a99", marginBottom: 10 }}>Selecciona los juegos</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {Object.values(GAME_DATA).map(g => {
                const sel = selectedGames.includes(g.id);
                const accent = GAME_COLORS[g.id];
                return (
                  <div key={g.id} onClick={() => onGameToggle(g.id)} style={{ background: sel ? `${accent}14` : "rgba(255,255,255,0.04)", border: sel ? `1px solid ${accent}55` : "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "12px 14px", cursor: "pointer", position: "relative", transition: "all 0.2s", boxShadow: sel ? `0 0 16px ${accent}1e` : "none" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{g.title}</div>
                    <div style={{ fontSize: 11, color: "#4a5668", marginTop: 2 }}>{g.category === 1 ? "Punto 1" : "Punto 2"}</div>
                    {sel && <div style={{ position: "absolute", top: 8, right: 10, width: 18, height: 18, borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#0a0e1a" }}>✓</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* LISTA DE JUGADORES */}
        <div style={{ marginBottom: 26 }}>
          <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.5, color: "#6b7a99", marginBottom: 10 }}>
            👥 Jugadores ({players.length}) {players.length < 2 && <span style={{ color: "#ff5252", fontWeight: 600, fontSize: 10, marginLeft: 6, animation: "pulse 1.4s ease infinite" }}>— se necesitan al menos 2</span>}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {players.map(p => (
              <div key={p.id} style={{ background: p.color, borderRadius: 24, padding: "7px 16px", fontSize: 13, fontWeight: 700, color: "#fff", boxShadow: `0 2px 12px ${p.color}40`, display: "flex", alignItems: "center", gap: 6, animation: "scaleIn 0.3s ease both" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,0.55)", display: "inline-block" }} />
                {p.name} {p.isHost && <span style={{ fontSize: 10, background: "rgba(0,0,0,0.25)", borderRadius: 8, padding: "1px 6px" }}>host</span>}
              </div>
            ))}
          </div>
        </div>

        {/* BOTÓN INICIAR (solo host) */}
        {isHost ? (
          <button onClick={onStartGame} disabled={selectedGames.length === 0 || players.length < 2} style={{ width: "100%", background: (selectedGames.length === 0 || players.length < 2) ? "#1e2233" : "linear-gradient(135deg,#76ff03,#4caf00)", color: (selectedGames.length === 0 || players.length < 2) ? "#4a5668" : "#0a0e1a", border: "none", borderRadius: 50, padding: "16px", fontSize: 18, fontWeight: 800, fontFamily: "'Nunito',sans-serif", cursor: (selectedGames.length === 0 || players.length < 2) ? "not-allowed" : "pointer", boxShadow: (selectedGames.length === 0 || players.length < 2) ? "none" : "0 4px 28px #76ff0333", transition: "all 0.2s" }}>
            🚀 Iniciar Juego
          </button>
        ) : (
          <div style={{ textAlign: "center", color: "#4a5668", fontSize: 15, fontWeight: 600, padding: "14px", animation: "pulse 2s ease infinite" }}>
            ⏳ Esperando a que el host inicie el juego…
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   GAME SCREEN
   ══════════════════════════════════════════════ */
function GameScreen({ game, players, myId, isHost, roomCode, onFinish }) {
  const [qIndex, setQIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIME_PER_Q);
  const [myAnswer, setMyAnswer] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [scores, setScores] = useState(() => { const s = {}; players.forEach(p => s[p.id] = p.score || 0); return s; });
  const [placed, setPlaced] = useState([]);
  const [pool, setPool] = useState([]);
  const [dragDone, setDragDone] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const timerRef = useRef(null);
  const listenerRef = useRef(null);

  const question = game.questions[qIndex];
  const isWordGame = game.id === "game2";
  const totalQ = game.questions.length;
  const isCorrect = showResult && (isWordGame ? myAnswer === 1 : myAnswer === question.answer);

  // Reset on new question
  useEffect(() => {
    setMyAnswer(null); setShowResult(false); setTimeLeft(TIME_PER_Q); setShowConfetti(false); setDragDone(false);
    if (isWordGame) { setPool(shuffleArray(question.words.map((_, i) => i))); setPlaced([]); }
  }, [qIndex]);

  // Timer
  useEffect(() => {
    if (showResult) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { clearInterval(timerRef.current); setShowResult(true); return 0; } return t - 1; });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [showResult, qIndex]);

  // Confetti on correct
  useEffect(() => { if (showResult && isCorrect) setShowConfetti(true); }, [showResult, isCorrect]);

  // Listen for OTHER players' answers (from Firebase) to update scores
  useEffect(() => {
    if (!db) return;
    const path = `rooms/${roomCode}/answers/${game.id}_${qIndex}`;
    const ref = db.ref(path);
    const cb = snap => {
      if (!snap.exists()) return;
      const answers = snap.val();
      const newScores = { ...scores };
      Object.values(answers).forEach(a => {
        if (a.correct && a.points) newScores[a.playerId] = (newScores[a.playerId] || 0);
        // scores are pushed per-answer; we rebuild at end
      });
    };
    ref.on("value", cb);
    listenerRef.current = () => ref.off("value", cb);
    return () => { if (listenerRef.current) listenerRef.current(); };
  }, [qIndex, game.id]);

  function submitAnswer(answerIdx, isCorrectAnswer) {
    if (!db) return;
    const points = isCorrectAnswer ? calcPoints(timeLeft) : 0;
    db.ref(`rooms/${roomCode}/answers/${game.id}_${qIndex}/${myId}`).set({
      playerId: myId, answer: answerIdx, correct: isCorrectAnswer, points, time: timeLeft
    });
    if (isCorrectAnswer) setScores(s => ({ ...s, [myId]: (s[myId] || 0) + points }));
  }

  function handleMCAnswer(idx) {
    if (showResult || myAnswer !== null) return;
    clearInterval(timerRef.current);
    setMyAnswer(idx);
    const correct = idx === question.answer;
    submitAnswer(idx, correct);
    setShowResult(true);
  }

  function handleWordSubmit() {
    clearInterval(timerRef.current);
    const formed = placed.map(i => question.words[i]).join(" ");
    const correct = formed === question.answer;
    setMyAnswer(correct ? 1 : 0);
    submitAnswer(correct ? 1 : 0, correct);
    setDragDone(true);
    setShowResult(true);
  }

  function handleNextQ() {
    if (qIndex + 1 >= totalQ) {
      // Push final scores to Firebase
      if (db) {
        const finalScores = {};
        players.forEach(p => { finalScores[p.id] = scores[p.id] || 0; });
        db.ref(`rooms/${roomCode}/scores`).update(finalScores);
      }
      onFinish(players.map(p => ({ ...p, score: scores[p.id] || 0 })));
    } else {
      setQIndex(q => q + 1);
    }
  }

  function pickWord(wi) { if (dragDone) return; setPool(p => p.filter(i => i !== wi)); setPlaced(p => [...p, wi]); }
  function unpickWord(pos) { if (dragDone) return; const wi = placed[pos]; setPlaced(p => p.filter((_, i) => i !== pos)); setPool(p => [...p, wi]); }

  const sorted = [...players].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0)).slice(0, 3);
  const timerWarning = timeLeft <= 5 && !showResult;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0e1a", color: "#fff", position: "relative", fontFamily: "'Nunito',sans-serif", display: "flex", flexDirection: "column" }}>
      <Confetti active={showConfetti} />
      <FloatingOrbs /><GridOverlay />

      {/* HEADER */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", background: "rgba(10,14,26,0.7)", backdropFilter: "blur(8px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#6b7a99" }}>{game.title} <span style={{ color: "#3d4560" }}>— {qIndex + 1}/{totalQ}</span></div>
        <div style={{ position: "relative", width: 50, height: 50, animation: timerWarning ? "timerWarn 0.6s ease infinite" : "none" }}>
          <svg width="50" height="50" style={{ display: "block" }}>
            <circle cx="25" cy="25" r="21" fill="none" stroke="#1a1f2e" strokeWidth="5" />
            <circle cx="25" cy="25" r="21" fill="none" stroke={timeLeft > 5 ? "#00e5ff" : "#ff5252"} strokeWidth="5"
              strokeDasharray={`${(timeLeft / TIME_PER_Q) * 131.95} 131.95`} strokeLinecap="round"
              style={{ transform: "rotate(-90deg)", transformOrigin: "center", transition: "stroke-dasharray 0.9s linear" }} />
          </svg>
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: timeLeft > 5 ? "#00e5ff" : "#ff5252" }}>{timeLeft}</span>
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#ffea00", textShadow: "0 0 8px #ffea0033" }}>⭐ {scores[myId] || 0}</div>
      </div>

      {/* MINI LEADERBOARD */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", gap: 8, padding: "7px 18px", justifyContent: "center", flexWrap: "wrap" }}>
        {sorted.map((p, i) => {
          const isMe = p.id === myId;
          return (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, background: isMe ? "rgba(255,234,0,0.1)" : "rgba(255,255,255,0.045)", border: isMe ? "1px solid #ffea0055" : "1px solid rgba(255,255,255,0.06)", borderRadius: 22, padding: "4px 12px", fontSize: 12 }}>
              <span style={{ fontSize: 14 }}>{["🥇","🥈","🥉"][i]}</span>
              <span style={{ fontWeight: 700, color: "#fff", maxWidth: 64, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
              <span style={{ fontWeight: 800, color: "#ffea00" }}>{scores[p.id] || 0}</span>
            </div>
          );
        })}
      </div>

      {/* QUESTION */}
      <div style={{ position: "relative", zIndex: 1, padding: "18px 20px 8px", textAlign: "center" }}>
        {question.hint && <span style={{ display: "inline-block", fontSize: 12, fontWeight: 800, color: "#e040fb", background: "#e040fb16", padding: "4px 14px", borderRadius: 20, marginBottom: 10, border: "1px solid #e040fb2e" }}>{question.hint}</span>}
        <div style={{ fontSize: 21, fontWeight: 800, color: "#fff", lineHeight: 1.45 }}>{isWordGame ? "Ordena las palabras para formar la frase:" : question.q}</div>
      </div>

      {/* ANSWERS */}
      <div style={{ position: "relative", zIndex: 1, padding: "8px 18px 24px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        {isWordGame ? (
          <>
            {/* Zona de palabras colocadas */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "14px 16px", background: dragDone ? (myAnswer === 1 ? "rgba(118,255,3,0.07)" : "rgba(255,82,82,0.07)") : "rgba(0,229,255,0.055)", border: dragDone ? (myAnswer === 1 ? "1px solid #76ff033a" : "1px solid #ff52523a") : "2px dashed rgba(0,229,255,0.28)", borderRadius: 16, minHeight: 54, alignItems: "center", alignContent: "center", transition: "all 0.3s" }}>
              {placed.length === 0 && <span style={{ fontSize: 13, color: "#3d4560", fontStyle: "italic" }}>Toca las palabras de abajo…</span>}
              {placed.map((wi, pos) => (
                <div key={wi} onClick={() => unpickWord(pos)} style={{ background: dragDone ? (myAnswer === 1 ? "rgba(118,255,3,0.18)" : "rgba(255,82,82,0.18)") : "rgba(0,229,255,0.13)", border: dragDone ? (myAnswer === 1 ? "1px solid #76ff0355" : "1px solid #ff525255") : "1px solid rgba(0,229,255,0.38)", borderRadius: 10, padding: "8px 14px", fontSize: 15, fontWeight: 700, color: "#fff", cursor: dragDone ? "default" : "pointer", display: "flex", alignItems: "center", gap: 5, userSelect: "none", WebkitTapHighlightColor: "transparent", boxShadow: dragDone ? "none" : "0 2px 8px rgba(0,229,255,0.14)" }}>
                  {question.words[wi]}
                  {!dragDone && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.38)" }}>✕</span>}
                </div>
              ))}
            </div>
            {/* Pool de palabras disponibles */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "4px 0", justifyContent: "center" }}>
              {pool.map(wi => (
                <div key={wi} onClick={() => pickWord(wi)} style={{ background: "rgba(224,64,251,0.13)", border: "1px solid rgba(224,64,251,0.38)", borderRadius: 10, padding: "10px 18px", fontSize: 15, fontWeight: 700, color: "#fff", cursor: "pointer", userSelect: "none", WebkitTapHighlightColor: "transparent", boxShadow: "0 3px 12px rgba(224,64,251,0.18)", transition: "transform 0.1s" }}
                  onMouseDown={e => e.currentTarget.style.transform = "scale(0.92)"}
                  onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                >{question.words[wi]}</div>
              ))}
            </div>
            {/* Confirmar */}
            {!dragDone && placed.length === question.words.length && (
              <button onClick={handleWordSubmit} style={{ alignSelf: "center", marginTop: 6, background: "linear-gradient(135deg,#76ff03,#4caf00)", color: "#0a0e1a", border: "none", borderRadius: 50, padding: "12px 36px", fontSize: 16, fontWeight: 800, fontFamily: "'Nunito',sans-serif", cursor: "pointer", boxShadow: "0 4px 20px #76ff0333" }}>✓ Confirmar</button>
            )}
          </>
        ) : (
          question.options.map((opt, idx) => {
            let bg = "rgba(255,255,255,0.045)", bdr = "rgba(255,255,255,0.1)", shadow = "none", letterBg = "rgba(255,255,255,0.1)";
            if (showResult) {
              if (idx === question.answer) { bg = "rgba(118,255,3,0.13)"; bdr = "#76ff0355"; shadow = "0 0 16px #76ff0320"; letterBg = "#76ff03"; }
              else if (idx === myAnswer) { bg = "rgba(255,82,82,0.13)"; bdr = "#ff525255"; shadow = "0 0 16px #ff525220"; letterBg = "#ff5252"; }
              else { bg = "rgba(255,255,255,0.02)"; bdr = "rgba(255,255,255,0.04)"; }
            }
            const dimmed = showResult && idx !== question.answer && idx !== myAnswer;
            return (
              <button key={idx} onClick={() => handleMCAnswer(idx)} disabled={showResult} style={{ background: bg, border: `1px solid ${bdr}`, borderRadius: 14, padding: "14px 18px", color: dimmed ? "#2e3448" : "#fff", fontSize: 16, cursor: showResult ? "default" : "pointer", display: "flex", alignItems: "center", gap: 14, textAlign: "left", boxShadow: shadow, transition: "all 0.18s", fontFamily: "'Nunito',sans-serif", fontWeight: 600, animation: `fadeUp 0.35s ease ${idx * 0.07}s both` }}
                onMouseEnter={e => { if (!showResult) e.currentTarget.style.borderColor = "#e040fb55"; }}
                onMouseLeave={e => { if (!showResult) e.currentTarget.style.borderColor = bdr; }}
                onMouseDown={e => { if (!showResult) e.currentTarget.style.transform = "scale(0.97)"; }}
                onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
              >
                <span style={{ background: letterBg, borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, flexShrink: 0, color: "#fff", transition: "background 0.2s" }}>{["A","B","C","D"][idx]}</span>
                {opt}
              </button>
            );
          })
        )}
      </div>

      {/* RESULTADO */}
      {showResult && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#111420", borderRadius: 24, padding: "34px 28px 30px", maxWidth: 440, width: "100%", textAlign: "center", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 8px 48px rgba(0,0,0,0.5)", animation: "popIn 0.35s ease both" }}>
            <div style={{ fontSize: 58, marginBottom: 4, animation: "scaleIn 0.3s ease both" }}>{isCorrect ? "✅" : myAnswer === null ? "⏰" : "❌"}</div>
            <div style={{ fontFamily: "'Bangers',cursive", fontSize: 30, letterSpacing: 2, marginBottom: 10, color: isCorrect ? "#76ff03" : myAnswer === null ? "#ffea00" : "#ff5252", textShadow: `0 0 16px ${isCorrect ? "#76ff0344" : myAnswer === null ? "#ffea0044" : "#ff525244"}` }}>
              {isCorrect ? "¡Correcto!" : myAnswer === null ? "¡Tiempo!" : "Incorrecto"}
            </div>
            {!isCorrect && !isWordGame && myAnswer !== null && <div style={{ color: "#76ff03", fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Respuesta correcta: {question.options[question.answer]}</div>}
            {isWordGame && myAnswer === 0 && <div style={{ color: "#76ff03", fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Respuesta: {question.answer}</div>}
            <div style={{ background: "rgba(255,255,255,0.045)", borderRadius: 12, padding: "14px 18px", marginBottom: 22, border: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.4, color: "#4a5668", marginBottom: 6 }}>💡 Explicación</div>
              <div style={{ color: "#8a9bb5", fontSize: 14, lineHeight: 1.6 }}>{question.explanation}</div>
            </div>
            <button onClick={handleNextQ} style={{ background: "linear-gradient(135deg,#e040fb,#c020d9)", color: "#fff", border: "none", borderRadius: 50, padding: "13px 36px", fontSize: 16, fontWeight: 800, fontFamily: "'Nunito',sans-serif", cursor: "pointer", boxShadow: "0 4px 24px #e040fb44" }}
              onMouseDown={e => e.currentTarget.style.transform = "scale(0.95)"}
              onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
            >{qIndex + 1 >= totalQ ? "Ver Resultados 🏆" : "Siguiente →"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   PODIUM
   ══════════════════════════════════════════════ */
function PodiumScreen({ players, onPlayAgain }) {
  const [showConfetti, setShowConfetti] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShowConfetti(true), 500); return () => clearTimeout(t); }, []);

  const sorted = [...players].sort((a, b) => b.score - a.score);
  const top5 = sorted.slice(0, 5);
  const podiumOrder = top5.length >= 3 ? [top5[1], top5[0], top5[2]] : top5;
  const medalGlows = ["#ffd700","#c0c0c0","#cd7f32"];
  const medalBgs = ["linear-gradient(180deg,#ffe566,#c9a00a)","linear-gradient(180deg,#e4e4e4,#9e9e9e)","linear-gradient(180deg,#e8a96c,#a0622a)"];
  const barHeights = [180, 130, 100];

  return (
    <div style={PAGE}>
      <Confetti active={showConfetti} />
      <FloatingOrbs /><GridOverlay />
      <div style={{ position: "relative", zIndex: 1, maxWidth: 580, margin: "0 auto", padding: "48px 20px 40px", textAlign: "center" }}>
        <h1 style={{ fontFamily: "'Bangers',cursive", fontSize: 42, letterSpacing: 3, margin: "0 0 6px", background: "linear-gradient(135deg,#ffd700,#ffea00,#ffa000)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", filter: "drop-shadow(0 0 16px #ffd70033)" }}>🏆 Resultados Finales</h1>
        <p style={{ color: "#4a5668", fontSize: 14, margin: "0 0 40px" }}>¡Excelente competencia!</p>

        {/* PODIUM */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 14, marginBottom: 32, height: 280 }}>
          {podiumOrder.map(p => {
            const realRank = sorted.findIndex(s => s.id === p.id);
            const barH = barHeights[realRank] || 90;
            return (
              <div key={p.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ background: "rgba(255,255,255,0.055)", border: `2px solid ${medalGlows[realRank]}55`, borderRadius: 18, padding: "14px 18px", marginBottom: 10, minWidth: 104, boxShadow: `0 0 24px ${medalGlows[realRank]}2a`, animation: "scaleIn 0.4s ease 0.3s both" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: p.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: "#fff", margin: "0 auto 8px", boxShadow: `0 0 12px ${p.color}44` }}>{p.name.charAt(0).toUpperCase()}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 90 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "#ffea00", fontWeight: 700, marginTop: 3 }}>⭐ {p.score}</div>
                </div>
                <div style={{ width: 88, borderRadius: "10px 10px 0 0", background: medalBgs[realRank], display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 10, boxShadow: `0 4px 16px ${medalGlows[realRank]}33`, transformOrigin: "bottom", animation: `podiumRise 0.5s cubic-bezier(.34,1.56,.64,1) ${0.4 + realRank * 0.15}s both`, height: barH }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: "rgba(0,0,0,0.5)" }}>{["🥇","🥈","🥉"][realRank]}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 4to y 5to */}
        {top5.length > 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
            {top5.slice(3).map((p, i) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "11px 18px", animation: `slideIn 0.4s ease ${0.8 + i * 0.1}s both` }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#4a5668", width: 26 }}>{`#${i + 4}`}</span>
                <span style={{ width: 34, height: 34, borderRadius: "50%", background: p.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: "#fff", flexShrink: 0 }}>{p.name.charAt(0).toUpperCase()}</span>
                <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: "#fff", textAlign: "left" }}>{p.name}</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#ffea00" }}>⭐ {p.score}</span>
              </div>
            ))}
          </div>
        )}

        <button onClick={onPlayAgain} style={{ background: "linear-gradient(135deg,#e040fb,#c020d9)", color: "#fff", border: "none", borderRadius: 50, padding: "15px 44px", fontSize: 18, fontWeight: 800, fontFamily: "'Nunito',sans-serif", cursor: "pointer", boxShadow: "0 4px 28px #e040fb44" }}
          onMouseDown={e => e.currentTarget.style.transform = "scale(0.95)"}
          onMouseUp={e => e.currentTarget.style.transform = "scale(1)"}
          onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
        >🔄 Jugar de Nuevo</button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   ROOT APP — orchestrator
   ══════════════════════════════════════════════ */
export default function App() {
  const [screen, setScreen] = useState("home"); // home | setup | join | lobby | game | podium
  const [firebaseStatus, setFirebaseStatus] = useState("idle"); // idle | loading | error | ready
  const [roomCode, setRoomCode] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [myPlayerId, setMyPlayerId] = useState("");
  const [players, setPlayers] = useState([]);
  const [selectedGames, setSelectedGames] = useState(["game1","game2","game3","game4"]);
  const [gamesToPlay, setGamesToPlay] = useState([]);
  const [currentGameIdx, setCurrentGameIdx] = useState(0);
  const [finalPlayers, setFinalPlayers] = useState([]);
  const playersListenerRef = useRef(null);

  // Listen to players in lobby
  useEffect(() => {
    if (!db || !roomCode || screen !== "lobby") return;
    const ref = db.ref(`rooms/${roomCode}/players`);
    const cb = snap => {
      if (!snap.exists()) { setPlayers([]); return; }
      const obj = snap.val();
      setPlayers(Object.values(obj).sort((a, b) => a.joined - b.joined));
    };
    ref.on("value", cb);
    playersListenerRef.current = () => ref.off("value", cb);
    return () => { if (playersListenerRef.current) playersListenerRef.current(); };
  }, [roomCode, screen]);

  // Listen for game start (non-host)
  useEffect(() => {
    if (!db || !roomCode || isHost || screen !== "lobby") return;
    const ref = db.ref(`rooms/${roomCode}/started`);
    const cb = snap => {
      if (snap.val()) {
        const gamesSnap = db.ref(`rooms/${roomCode}/gamesToPlay`);
        gamesSnap.once("value", s => {
          if (s.exists()) {
            setGamesToPlay(s.val());
            setCurrentGameIdx(0);
            setScreen("game");
          }
        });
      }
    };
    ref.on("value", cb);
    return () => ref.off("value", cb);
  }, [roomCode, isHost, screen]);

  async function handleHost() {
    setFirebaseStatus("loading");
    try {
      await initFirebase();
      setFirebaseStatus("ready");
      const code = generateCode();
      const hostId = uid();
      // Crear sala en Firebase
      await roomRef(code).set({
        started: false,
        gamesToPlay: [],
        players: {
          [hostId]: { id: hostId, name: "Profesor (Host)", color: "#00e5ff", score: 0, isHost: true, joined: Date.now() }
        }
      });
      setRoomCode(code);
      setIsHost(true);
      setMyPlayerId(hostId);
      setScreen("lobby");
    } catch (e) {
      setFirebaseStatus("error");
    }
  }

  function handleJoined({ code, playerId }) {
    setRoomCode(code);
    setIsHost(false);
    setMyPlayerId(playerId);
    setScreen("lobby");
  }

  function handleGameToggle(id) {
    setSelectedGames(p => p.includes(id) ? p.filter(g => g !== id) : [...p, id]);
  }

  async function handleStartGame() {
    const ordered = Object.keys(GAME_DATA).filter(id => selectedGames.includes(id));
    setGamesToPlay(ordered);
    setCurrentGameIdx(0);
    // Escribir en Firebase para que los otros se enteran
    if (db) {
      await roomRef(roomCode).update({ started: true, gamesToPlay: ordered });
    }
    setScreen("game");
  }

  function handleGameFinish(updatedPlayers) {
    setPlayers(updatedPlayers);
    if (currentGameIdx + 1 < gamesToPlay.length) {
      setCurrentGameIdx(i => i + 1);
    } else {
      setFinalPlayers(updatedPlayers);
      setScreen("podium");
    }
  }

  function handlePlayAgain() {
    // Limpiar sala
    if (db && roomCode) { db.ref(`rooms/${roomCode}`).remove(); }
    setScreen("home");
    setPlayers([]);
    setRoomCode("");
    setIsHost(false);
    setSelectedGames(["game1","game2","game3","game4"]);
    setCurrentGameIdx(0);
  }

  // ── RENDERS ──
  if (screen === "home") return <HomeScreen onStart={() => setScreen("setup")} />;

  if (screen === "setup") {
    if (firebaseStatus === "error") {
      return (
        <div style={PAGE}>
          <FloatingOrbs /><GridOverlay />
          <div style={{ position: "relative", zIndex: 1, maxWidth: 460, margin: "80px auto", padding: "0 20px", textAlign: "center" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontFamily: "'Bangers',cursive", fontSize: 28, color: "#ff5252", marginBottom: 14 }}>Firebase no configurado</h2>
            <p style={{ color: "#6b7a99", fontSize: 15, lineHeight: 1.7, marginBottom: 24 }}>
              Para que el modo multijugador funcione necesitas crear un proyecto gratuito en <strong style={{ color: "#00e5ff" }}>Firebase</strong> y reemplazar las credenciales en el código (busca <code style={{ color: "#e040fb" }}>FIREBASE_CONFIG</code>). Sigue los pasos del README que se envió junto con el archivo.
            </p>
            <button onClick={() => setFirebaseStatus("idle")} style={{ background: "linear-gradient(135deg,#e040fb,#c020d9)", color: "#fff", border: "none", borderRadius: 50, padding: "12px 32px", fontSize: 16, fontWeight: 800, fontFamily: "'Nunito',sans-serif", cursor: "pointer" }}>Intentar de nuevo</button>
          </div>
        </div>
      );
    }
    return (
      <SetupScreen
        onHost={handleHost}
        onJoin={() => setScreen("join")}
        onBack={() => setScreen("home")}
      />
    );
  }

  if (screen === "join") return <JoinScreen onJoined={handleJoined} onBack={() => setScreen("setup")} />;

  if (screen === "lobby") return (
    <LobbyScreen
      gameCode={roomCode}
      isHost={isHost}
      players={players}
      selectedGames={selectedGames}
      onStartGame={handleStartGame}
      onGameToggle={handleGameToggle}
      onBack={handlePlayAgain}
    />
  );

  if (screen === "game") {
    const currentGame = GAME_DATA[gamesToPlay[currentGameIdx]];
    return (
      <GameScreen
        key={gamesToPlay[currentGameIdx] + "_" + currentGameIdx}
        game={currentGame}
        players={players}
        myId={myPlayerId}
        isHost={isHost}
        roomCode={roomCode}
        onFinish={handleGameFinish}
      />
    );
  }

  if (screen === "podium") return <PodiumScreen players={finalPlayers} onPlayAgain={handlePlayAgain} />;

  return null;
}
