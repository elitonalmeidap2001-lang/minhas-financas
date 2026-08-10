import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Home, CreditCard, Receipt, TrendingUp, User, Eye, EyeOff, HelpCircle,
  ChevronLeft, ChevronRight, Plus, X, Trash2, Pencil, Wallet, PiggyBank,
  ArrowUpRight, ArrowDownRight, CheckCircle2, LogOut, ChevronDown, Check
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { auth, firebaseEnabled, loadCloudState, saveCloudState, signInWithGoogle, signOutFromGoogle } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";

/* ============================================================
   DESIGN TOKENS
   Background: #FFFFFF / #F7F8FA   Ink: #14141A   Muted: #6B7280
   Accent (brand): #6D28D9 (deep violet) — premium, calm, banking-trust
   Positive: #0F9D58 tint #E9F9EF  Negative: #D64545 tint #FDECEC
   Invest: #0E7490 tint #E6F6F8    Warning: #B7791F tint #FDF3E2
   Radius: 18px cards / 14px controls / 999px pills
   Font: Inter
   ============================================================ */

const ACCENT = "#0FA958";
const ACCENT_DARK = "#0B7A40";
const ACCENT_TINT = "#E4F9EC";
const INK = "#14141A";
const MUTED = "#6B7280";
const BORDER = "#E7E7EC";
const SURFACE = "#F7F7FA";
const POS = "#0F9D58", POS_BG = "#E9F9EF";
const NEG = "#D64545", NEG_BG = "#FDECEC";
const INV = "#0E7490", INV_BG = "#E6F6F8";
const WARN = "#B7791F", WARN_BG = "#FDF3E2";

const CARD_COLORS = [
  { name: "Verde", hex: "#0FA958" },
  { name: "Violeta", hex: "#6D28D9" },
  { name: "Azul", hex: "#0E7490" },
  { name: "Âmbar", hex: "#B7791F" },
  { name: "Rosa", hex: "#BE185D" },
  { name: "Grafite", hex: "#374151" },
];

const CATEGORIES = ["Alimentação","Transporte","Saúde","Lazer","Compras","Casa","Educação","Trabalho","Outros"];

const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function monthKey(y, m) { return `${y}-${String(m + 1).padStart(2, "0")}`; }
function keyToParts(key) { const [y, m] = key.split("-").map(Number); return { y, m: m - 1 }; }
function monthLabel(key) { const { y, m } = keyToParts(key); return `${MONTH_NAMES[m]} ${y}`; }
function shiftMonth(key, delta) {
  const { y, m } = keyToParts(key);
  const d = new Date(y, m + delta, 1);
  return monthKey(d.getFullYear(), d.getMonth());
}
function monthIndexDiff(fromKey, toKey) {
  const a = keyToParts(fromKey), b = keyToParts(toKey);
  return (b.y - a.y) * 12 + (b.m - a.m);
}
function fmtCurrency(v) {
  const n = Number(v) || 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDateInput(d) { return d; }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmtDateDisplay(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/* ============================================================
   STORAGE
   ============================================================ */
const STORAGE_KEY = "minhas-financas:v1";
const emptyState = {
  user: null,
  cards: [],
  fixedExpenses: [],
  incomes: [],
  variableExpenses: [],
  cardTransactions: [],
  cardInvoices: [],
  investments: [],
  piggyGoals: [],
  piggyTransactions: [],
};

async function loadState(uid) {
  try {
    if (firebaseEnabled && uid) {
      const cloudState = await loadCloudState(uid);
      if (cloudState) return { ...emptyState, ...cloudState };
      return emptyState;
    }
    const res = await window.storage.get(STORAGE_KEY);
    if (res && res.value) return { ...emptyState, ...JSON.parse(res.value) };
  } catch (e) { /* not found yet */ }
  return emptyState;
}
async function saveState(state, uid) {
  try {
    if (firebaseEnabled && uid) await saveCloudState(uid, state);
    await window.storage.set(STORAGE_KEY, JSON.stringify(state));
  }
  catch (e) { console.error("Erro ao salvar", e); }
}

/* ============================================================
   PRIMITIVE UI
   ============================================================ */
function Money({ value, hidden, size = "normal", color, showSign = false }) {
  if (hidden) {
    const dots = size === "large" ? "• • • • •" : "• • •";
    return <span style={{ letterSpacing: 2 }}>{dots}</span>;
  }
  const n = Number(value) || 0;
  const sign = showSign ? (n > 0 ? "+ " : n < 0 ? "− " : "") : "";
  const display = showSign ? fmtCurrency(Math.abs(n)) : fmtCurrency(n);
  return <span style={{ color }}>{sign}{display}</span>;
}

function IconCircle({ children, bg, color }) {
  return (
    <div style={{
      width: 40, height: 40, borderRadius: 12, background: bg, color,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
    }}>{children}</div>
  );
}

function Card({ children, style, onClick, className = "" }) {
  return (
    <div className={`app-card ${className}`} onClick={onClick} style={{
      background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 18,
      padding: 18, ...style
    }}>{children}</div>
  );
}

function SectionTitle({ children, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: INK, margin: 0 }}>{children}</h3>
      {action}
    </div>
  );
}

function AddButton({ onClick, label = "" }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 4, background: SURFACE,
      border: `1px solid ${BORDER}`, borderRadius: 999, padding: label ? "6px 12px" : "6px",
      color: INK, fontSize: 13, fontWeight: 600, cursor: "pointer"
    }}>
      <Plus size={14} /> {label}
    </button>
  );
}

function EmptyState({ text, cta, onCta }) {
  return (
    <div style={{ textAlign: "center", padding: "28px 12px", color: MUTED }}>
      <p style={{ fontSize: 13.5, margin: "0 0 10px" }}>{text}</p>
      {cta && (
        <button onClick={onCta} style={{
          background: "none", border: "none", color: ACCENT, fontWeight: 600,
          fontSize: 13.5, cursor: "pointer"
        }}>{cta}</button>
      )}
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled, style }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: "100%", padding: "14px 16px", borderRadius: 14, border: "none",
      background: disabled ? "#D1D5DB" : INK, color: "#fff", fontSize: 15,
      fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", ...style
    }}>{children}</button>
  );
}

function GhostButton({ children, onClick, style }) {
  return (
    <button onClick={onClick} style={{
      width: "100%", padding: "13px 16px", borderRadius: 14, border: `1px solid ${BORDER}`,
      background: "#fff", color: INK, fontSize: 14.5, fontWeight: 600, cursor: "pointer", ...style
    }}>{children}</button>
  );
}

function FormField({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: MUTED, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "12px 14px", borderRadius: 12, border: `1px solid ${BORDER}`,
  fontSize: 15, color: INK, outline: "none", boxSizing: "border-box", background: "#fff",
};

function TextInput(props) { return <input {...props} style={{ ...inputStyle, ...(props.style||{}) }} />; }

function Select({ value, onChange, options, placeholder }) {
  return (
    <select value={value} onChange={onChange} style={{ ...inputStyle, appearance: "none" }}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
    </select>
  );
}

function BottomSheet({ open, onClose, title, children, centered = false }) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: centered ? "center" : "flex-end",
      justifyContent: "center"
    }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(20,20,26,0.45)" }} />
      <div style={{
        position: "relative", width: "100%", maxWidth: 480, background: "#fff",
        borderRadius: centered ? 24 : "24px 24px 0 0", padding: "10px 20px 24px", maxHeight: "88vh",
        overflowY: "auto", boxShadow: "0 -8px 30px rgba(0,0,0,0.15)"
      }}>
        <div style={{ width: 40, height: 4, background: BORDER, borderRadius: 4, margin: "6px auto 16px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: INK, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: SURFACE, border: "none", borderRadius: 999, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={16} color={MUTED} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ConfirmDialog({ open, onCancel, onConfirm, text }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div onClick={onCancel} style={{ position: "absolute", inset: 0, background: "rgba(20,20,26,0.5)" }} />
      <div style={{ position: "relative", background: "#fff", borderRadius: 18, padding: 22, width: "100%", maxWidth: 340 }}>
        <p style={{ fontWeight: 700, fontSize: 15.5, color: INK, margin: "0 0 4px" }}>{text.title}</p>
        <p style={{ fontSize: 13.5, color: MUTED, margin: "0 0 18px" }}>{text.body}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <GhostButton onClick={onCancel}>Cancelar</GhostButton>
          <PrimaryButton onClick={onConfirm} style={{ background: NEG }}>Excluir</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

function RowItem({ leftIcon, leftBg, leftColor, title, subtitle, right, rightColor, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${BORDER}`, position: "relative" }}>
      {leftIcon && <IconCircle bg={leftBg} color={leftColor}>{leftIcon}</IconCircle>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</p>
        {subtitle && <p style={{ margin: "2px 0 0", fontSize: 12.5, color: MUTED }}>{subtitle}</p>}
      </div>
      <div style={{ fontSize: 14.5, fontWeight: 700, color: rightColor || INK, whiteSpace: "nowrap" }}>{right}</div>
      {(onEdit || onDelete) && (
        <div style={{ position: "relative" }}>
          <button onClick={() => setOpen(o => !o)} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 6px", color: MUTED, fontSize: 18, lineHeight: 1 }}>⋮</button>
          {open && (
            <div style={{ position: "absolute", right: 0, top: 28, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: "0 6px 20px rgba(0,0,0,0.12)", zIndex: 10, minWidth: 120, overflow: "hidden" }}>
              {onEdit && <div onClick={() => { setOpen(false); onEdit(); }} style={{ padding: "10px 14px", fontSize: 13.5, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}><Pencil size={13} /> Editar</div>}
              {onDelete && <div onClick={() => { setOpen(false); onDelete(); }} style={{ padding: "10px 14px", fontSize: 13.5, cursor: "pointer", color: NEG, display: "flex", alignItems: "center", gap: 8 }}><Trash2 size={13} /> Excluir</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   APP SHELL: Header + Bottom Nav
   ============================================================ */
function Header({ name, hidden, setHidden, onHelp }) {
  return (
    <div className="app-header" style={{
      background: `linear-gradient(135deg, ${ACCENT} 0%, ${ACCENT_DARK} 100%)`,
      padding: "22px 20px 46px", color: "#fff", position: "relative"
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>Olá, {name || "visitante"}</p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setHidden(h => !h)} style={{ background: "rgba(255,255,255,0.16)", border: "none", width: 34, height: 34, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}>
            {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
          <button onClick={onHelp} style={{ background: "rgba(255,255,255,0.16)", border: "none", width: 34, height: 34, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}>
            <HelpCircle size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: Home },
  { key: "cartoes", label: "Cartões", icon: CreditCard },
  { key: "fixos", label: "Fixos", icon: Receipt },
  { key: "invest", label: "Invest.", icon: TrendingUp },
  { key: "perfil", label: "Perfil", icon: User },
];

function BottomNav({ active, setActive }) {
  return (
    <div className="app-bottom-nav" style={{ position: "fixed", left: 0, right: 0, bottom: 14, display: "flex", justifyContent: "center", zIndex: 40, padding: "0 16px" }}>
      <div className="app-nav-bar" style={{
        display: "flex", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 999,
        padding: 6, boxShadow: "0 10px 30px rgba(20,20,26,0.12)", gap: 2, width: "100%", maxWidth: 420
      }}>
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <button className={`nav-item ${isActive ? "nav-item--active" : ""}`} key={item.key} onClick={() => setActive(item.key)} style={{
              flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
              background: isActive ? ACCENT_TINT : "transparent", border: "none", borderRadius: 999,
              padding: "8px 4px", cursor: "pointer", color: isActive ? ACCENT : MUTED, transition: "all .15s"
            }}>
              <Icon size={18} strokeWidth={isActive ? 2.4 : 2} />
              <span style={{ fontSize: 10.5, fontWeight: isActive ? 700 : 500 }}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MonthPickerSheet({ open, onClose, year, currentMonthIdx, onPick }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Selecione o mês" centered>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 4 }}>
        {MONTH_NAMES.map((name, idx) => {
          const isCurrent = idx === currentMonthIdx;
          return (
            <button key={name} onClick={() => onPick(idx)} style={{
              padding: "12px 6px", borderRadius: 12, cursor: "pointer", fontSize: 13, fontWeight: 600,
              border: `1px solid ${isCurrent ? ACCENT : BORDER}`,
              background: isCurrent ? ACCENT_TINT : "#fff", color: isCurrent ? ACCENT_DARK : INK,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 4
            }}>
              {isCurrent && <Check size={13} />} {name.slice(0, 3)}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}

function YearPickerSheet({ open, onClose, currentYear, onPick }) {
  const years = [];
  for (let y = currentYear - 6; y <= currentYear + 4; y++) years.push(y);
  return (
    <BottomSheet open={open} onClose={onClose} title="Selecione o ano" centered>
      <div style={{ maxHeight: 320, overflowY: "auto" }}>
        {years.map(y => {
          const isCurrent = y === currentYear;
          return (
            <div key={y} onClick={() => onPick(y)} style={{
              padding: "13px 14px", borderRadius: 12, cursor: "pointer", marginBottom: 6,
              border: `1px solid ${isCurrent ? ACCENT : BORDER}`,
              background: isCurrent ? ACCENT_TINT : "#fff", color: isCurrent ? ACCENT_DARK : INK,
              fontWeight: isCurrent ? 700 : 500, fontSize: 14.5,
              display: "flex", alignItems: "center", justifyContent: "space-between"
            }}>
              {y} {isCurrent && <Check size={15} />}
            </div>
          );
        })}
      </div>
    </BottomSheet>
  );
}

function MonthSelector({ monthKeyVal, onChange, overlap = true }) {
  const [pickerOpen, setPickerOpen] = useState(null); // 'month' | 'year' | null
  const { y, m } = keyToParts(monthKeyVal);

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#fff",
      border: `1px solid ${BORDER}`, borderRadius: 999, padding: "8px 10px",
      margin: overlap ? "-30px 20px 18px" : "18px 0 16px",
      boxShadow: "0 8px 24px rgba(20,20,26,0.08)", position: "relative", zIndex: 5
    }}>
      <button onClick={() => setPickerOpen("month")} style={{
        background: SURFACE, border: "none", borderRadius: 999, padding: "7px 12px", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 4, fontWeight: 700, fontSize: 14, color: INK
      }}>
        {MONTH_NAMES[m]} <ChevronDown size={13} color={MUTED} />
      </button>
      <button onClick={() => setPickerOpen("year")} style={{
        background: SURFACE, border: "none", borderRadius: 999, padding: "7px 12px", cursor: "pointer",
        display: "flex", alignItems: "center", gap: 4, fontWeight: 700, fontSize: 14, color: INK
      }}>
        {y} <ChevronDown size={13} color={MUTED} />
      </button>

      <MonthPickerSheet open={pickerOpen === "month"} onClose={() => setPickerOpen(null)}
        currentMonthIdx={m} onPick={(idx) => { onChange(monthKey(y, idx)); setPickerOpen(null); }} />
      <YearPickerSheet open={pickerOpen === "year"} onClose={() => setPickerOpen(null)}
        currentYear={y} onPick={(newY) => { onChange(monthKey(newY, m)); setPickerOpen(null); }} />
    </div>
  );
}

/* ============================================================
   LOGIN / CREATE ACCOUNT
   ============================================================ */
function LoginScreen({ onLogin, onGoogleLogin, mode, setMode }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");

  const isCreate = mode === "create";

  function submit() {
    setError("");
    if (firebaseEnabled) return setError("Para este teste, entre com Google.");
    if (isCreate) {
      if (!name.trim()) return setError("Informe seu nome.");
      if (!email.trim()) return setError("Informe seu e-mail.");
      if (password.length < 4) return setError("A senha deve ter ao menos 4 caracteres.");
      if (password !== confirm) return setError("As senhas não coincidem.");
      onLogin({ name: name.trim(), email: email.trim(), password });
    } else {
      if (!email.trim() || !password) return setError("Preencha e-mail e senha.");
      onLogin({ name: email.split("@")[0] || "usuário", email: email.trim(), password });
    }
  }

  async function googleLogin() {
    try {
      setError("");
      await onGoogleLogin();
    } catch {
      setError("Não foi possível entrar com Google. Tente novamente.");
    }
  }

  return (
    <div className={`auth-screen ${isCreate ? "auth-screen--create" : "auth-screen--login"}`} style={{ minHeight: "100vh", background: "#fff", display: "flex", flexDirection: "column", justifyContent: "center", padding: "40px 26px", maxWidth: 440, margin: "0 auto" }}>
      <div className="auth-logo" style={{ width: 52, height: 52, borderRadius: 16, background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 22 }}>
        M
      </div>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: INK, margin: "0 0 6px" }}>
        {isCreate ? "Criar conta" : "Minhas Finanças"}
      </h1>
      <p style={{ fontSize: 14, color: MUTED, margin: "0 0 28px", lineHeight: 1.5 }}>
        {isCreate ? "Leva menos de um minuto." : "Organize seus ganhos, gastos e investimentos em um só lugar."}
      </p>

      {isCreate && (
        <FormField label="Nome"><TextInput value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" /></FormField>
      )}
      <FormField label="E-mail"><TextInput type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" /></FormField>
      <FormField label="Senha">
        <div style={{ position: "relative" }}>
          <TextInput type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ paddingRight: 42 }} />
          <button onClick={() => setShowPass(s => !s)} style={{ position: "absolute", right: 10, top: 10, background: "none", border: "none", cursor: "pointer", color: MUTED }}>
            {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </FormField>
      {isCreate && (
        <FormField label="Confirmar senha"><TextInput type={showPass ? "text" : "password"} value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" /></FormField>
      )}

      {error && <p style={{ color: NEG, fontSize: 13, margin: "-6px 0 14px" }}>{error}</p>}

      <PrimaryButton onClick={submit} style={{ background: ACCENT, marginTop: 4 }}>{isCreate ? "Criar conta" : "Entrar"}</PrimaryButton>

      <button className="auth-google-button" type="button" onClick={googleLogin} style={{ width:"100%", marginTop:10, padding:"13px 16px", borderRadius:14, border:`1px solid ${BORDER}`, background:"#fff", color:INK, fontSize:14, fontWeight:700, cursor:"pointer" }}>{isCreate ? "Criar conta com Google" : "Continuar com Google"}</button>

      {!isCreate ? (
        <>
          <p className="auth-forgot" style={{ textAlign: "center", fontSize: 13, color: ACCENT, margin: "16px 0 0", cursor: "pointer", fontWeight: 600 }}>Esqueci minha senha</p>
          <div className="auth-login-divider" style={{ display: "flex", alignItems: "center", gap: 10, margin: "22px 0" }}>
            <div style={{ flex: 1, height: 1, background: BORDER }} /><span style={{ fontSize: 12, color: MUTED }}>ou</span><div style={{ flex: 1, height: 1, background: BORDER }} />
          </div>
          <GhostButton onClick={() => setMode("create")}>Criar conta</GhostButton>
        </>
      ) : (
        <p style={{ textAlign: "center", fontSize: 13, color: ACCENT, margin: "18px 0 0", cursor: "pointer", fontWeight: 600 }} onClick={() => setMode("login")}>Já tenho uma conta</p>
      )}
    </div>
  );
}

/* ============================================================
   FIXED EXPENSES — computation for a given month
   ============================================================ */
function fixedExpenseStatusForMonth(fe, mKey) {
  if (!fe.active) return null;
  if (fe.type === "RECURRING") {
    if (monthIndexDiff(fe.startDate, mKey) < 0) return null;
    return { active: true, label: "Recorrente" };
  }
  // INSTALLMENT
  const idx = monthIndexDiff(fe.startDate, mKey) + (fe.initialInstallment || 1);
  if (idx < 1 || idx > fe.installmentCount) return null;
  return { active: true, label: `${idx} de ${fe.installmentCount}` };
}

function computeMonth(state, mKey) {
  const incomes = state.incomes.filter(i => i.monthReference === mKey);
  const totalIncome = incomes.reduce((s, i) => s + Number(i.amount), 0);

  const varExp = state.variableExpenses.filter(v => v.monthReference === mKey);
  const totalVar = varExp.reduce((s, v) => s + Number(v.amount), 0);

  const activeFixed = state.fixedExpenses
    .map(fe => ({ fe, status: fixedExpenseStatusForMonth(fe, mKey) }))
    .filter(x => x.status);
  const totalFixed = activeFixed.reduce((s, x) => s + Number(x.fe.amount), 0);

  // A consolidated invoice replaces old per-purchase entries for that card and
  // month, so a bill is never counted twice.
  const invoices = (state.cardInvoices || []).filter(i => i.invoiceMonth === mKey);
  const invoicedCardIds = new Set(invoices.map(i => i.cardId));
  const cardTx = state.cardTransactions.filter(t => t.invoiceMonth === mKey && !invoicedCardIds.has(t.cardId));
  const totalCard = invoices.reduce((s, i) => s + Number(i.amount), 0) + cardTx.reduce((s, t) => s + Number(t.amount), 0);
  const cardInvoiceEntries = invoices.map(i => ({
    ...i,
    description: `Fatura: ${state.cards.find(c => c.id === i.cardId)?.name || "cartão"}`,
    date: `${mKey}-01`,
  }));

  const monthInvest = state.investments.filter(i => i.monthReference === mKey && i.type === "CONTRIBUTION");
  const totalInvest = monthInvest.reduce((s, i) => s + Number(i.amount), 0);

  const tithe = totalIncome * 0.1;
  const balance = totalIncome - tithe - totalFixed - totalVar - totalCard - totalInvest;

  return { incomes, totalIncome, tithe, varExp, totalVar, activeFixed, totalFixed, cardTx, cardInvoiceEntries, totalCard, totalInvest, balance };
}

/* ============================================================
   DASHBOARD
   ============================================================ */
function BalanceCard({ data, hidden }) {
  const positive = data.balance >= 0;
  return (
    <Card className="balance-card" style={{ background: "#075B31", border: "none", color: "#fff" }}>
      <p style={{ margin: 0, fontSize: 13, color: "#B9B9C4", fontWeight: 600 }}>Saldo do mês</p>
      <p style={{ margin: "6px 0 14px", fontSize: 32, fontWeight: 800, color: positive ? "#D1FAE5" : "#FECACA" }}>
        <Money value={data.balance} hidden={hidden} showSign size="large" />
      </p>
      <div style={{ display: "flex", gap: 18, borderTop: "1px solid rgba(255,255,255,0.12)", paddingTop: 12 }}>
        <div>
          <p style={{ margin: 0, fontSize: 11.5, color: "#B9B9C4" }}>Receitas</p>
          <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 700 }}><Money value={data.totalIncome} hidden={hidden} /></p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 11.5, color: "#B9E6CD" }}>Dízimo reservado</p>
          <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 700, color: "#FEF3C7" }}><Money value={data.tithe} hidden={hidden} /></p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: 11.5, color: "#B9B9C4" }}>Saídas</p>
          <p style={{ margin: "2px 0 0", fontSize: 14, fontWeight: 700 }}><Money value={data.totalFixed + data.totalVar + data.totalCard} hidden={hidden} /></p>
        </div>
      </div>
    </Card>
  );
}

function CustomBarTooltip({ active, payload, hidden }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div style={{ background: INK, color: "#fff", padding: "8px 12px", borderRadius: 10, fontSize: 12.5 }}>
      <p style={{ margin: 0, fontWeight: 700 }}>{p.label}</p>
      <p style={{ margin: "2px 0 0" }}><Money value={p.value} hidden={hidden} showSign={p.label === "Saldo"} /></p>
    </div>
  );
}

function compactCurrency(value) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });
}

function InsideBarValue({ x, y, width, height, value }) {
  // A label only appears when it can remain completely inside its own bar.
  if (!value || width < 72) return null;
  return <text x={x + width - 10} y={y + height / 2} dominantBaseline="middle" textAnchor="end"
    style={{ fontSize: 11.5, fontWeight: 800, fill: "#fff" }}>{compactCurrency(value)}</text>;
}

function MonthlyComparisonChart({ data, hidden }) {
  const totalExpenses = data.totalFixed + data.totalVar + data.totalCard;
  const items = [
    { label: "Ganhos", value: data.totalIncome, color: POS },
    { label: "Gastos", value: totalExpenses, color: NEG },
    { label: "Investido", value: data.totalInvest, color: INV },
  ];
  return (
    <Card style={{ marginTop: 14 }}>
      <SectionTitle>Ganhos, gastos e investimentos</SectionTitle>
      <div style={{ width: "100%", height: 172 }}>
        <ResponsiveContainer>
          <BarChart data={items} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
            <CartesianGrid horizontal={false} stroke={BORDER} strokeDasharray="3 3" />
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="label" width={82} tick={{ fontSize: 12.5, fill: MUTED }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomBarTooltip hidden={hidden} />} cursor={{ fill: SURFACE }} />
            <Bar dataKey="value" radius={[8, 8, 8, 8]} barSize={28}>
              {items.map((it, i) => <Cell key={i} fill={it.color} />)}
              {!hidden && <LabelList dataKey="value" content={<InsideBarValue />} />}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p style={{ margin: "6px 0 0", fontSize: 11.5, color: MUTED, textAlign: "center" }}>
        Valores proporcionais do mês. O saldo permanece no cartão acima.
      </p>
    </Card>
  );
}

function IncomeSection({ state, mKey, hidden, onAdd, onEdit, onDelete }) {
  const d = computeMonth(state, mKey);
  const tithe = d.totalIncome * 0.1;
  return (
    <Card style={{ marginTop: 14 }}>
      <SectionTitle action={<AddButton onClick={onAdd} />}>Ganhos</SectionTitle>
      {d.incomes.length === 0 ? (
        <EmptyState text="Nenhum ganho registrado neste mês." cta="+ Adicionar ganho" onCta={onAdd} />
      ) : (
        <div>
          {d.incomes.map(inc => (
            <RowItem key={inc.id}
              leftIcon={<ArrowUpRight size={17} />} leftBg={POS_BG} leftColor={POS}
              title={inc.description} subtitle={`${fmtDateDisplay(inc.date)}${inc.status ? " · " + inc.status : ""}`}
              right={<Money value={inc.amount} hidden={hidden} />}
              onEdit={() => onEdit(inc)} onDelete={() => onDelete(inc.id)}
            />
          ))}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 14, marginTop: 4 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: MUTED }}>Total de ganhos</span>
        <span style={{ fontSize: 17, fontWeight: 800, color: INK }}><Money value={d.totalIncome} hidden={hidden} /></span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 12.5, color: MUTED }}>Dízimo (10%)</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: INV }}><Money value={tithe} hidden={hidden} /></span>
      </div>
    </Card>
  );
}

function MonthlyInvestCard({ state, mKey, hidden, onAdd }) {
  const d = computeMonth(state, mKey);
  return (
    <Card className="monthly-invest-card" style={{ marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <IconCircle bg={INV_BG} color={INV}><PiggyBank size={18} /></IconCircle>
          <div>
            <p style={{ margin: 0, fontSize: 12.5, color: MUTED }}>Investido em {monthLabel(mKey).split(" ")[0].toLowerCase()}</p>
            <p style={{ margin: "2px 0 0", fontSize: 17, fontWeight: 800, color: INK }}><Money value={d.totalInvest} hidden={hidden} /></p>
          </div>
        </div>
        <AddButton onClick={onAdd} label="Adicionar" />
      </div>
    </Card>
  );
}

function FixedExpensesSection({ state, mKey, hidden }) {
  const d = computeMonth(state, mKey);
  return (
    <Card style={{ marginTop: 14 }}>
      <SectionTitle>Gastos fixos</SectionTitle>
      {d.activeFixed.length === 0 ? (
        <EmptyState text="Nenhum gasto fixo neste mês." />
      ) : (
        <div>
          {d.activeFixed.map(({ fe, status }) => (
            <RowItem key={fe.id}
              leftIcon={<Receipt size={16} />} leftBg={WARN_BG} leftColor={WARN}
              title={fe.description} subtitle={status.label}
              right={<Money value={fe.amount} hidden={hidden} />}
            />
          ))}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 14 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: MUTED }}>Total de gastos fixos</span>
        <span style={{ fontSize: 16, fontWeight: 800, color: INK }}><Money value={d.totalFixed} hidden={hidden} /></span>
      </div>
    </Card>
  );
}

function VariableExpensesSection({ state, mKey, hidden, onAdd, onEdit, onDelete }) {
  const d = computeMonth(state, mKey);
  return (
    <Card style={{ marginTop: 14, marginBottom: 100 }}>
      <SectionTitle action={<AddButton onClick={onAdd} />}>Gastos variáveis</SectionTitle>
      {d.varExp.length === 0 && d.cardInvoiceEntries.length === 0 ? (
        <EmptyState text="Nenhum gasto variável neste mês." cta="+ Adicionar gasto" onCta={onAdd} />
      ) : (
        <div>
          {d.varExp.map(v => (
            <RowItem key={v.id}
              leftIcon={<ArrowDownRight size={17} />} leftBg={NEG_BG} leftColor={NEG}
              title={v.description} subtitle={`${v.category} · ${fmtDateDisplay(v.date)} · ${v.paymentMethod}`}
              right={<Money value={v.amount} hidden={hidden} />}
              onEdit={() => onEdit(v)} onDelete={() => onDelete(v.id)}
            />
          ))}
          {d.cardInvoiceEntries.map(invoice => (
            <RowItem key={`invoice-${invoice.id}`}
              leftIcon={<CreditCard size={17} />} leftBg={SURFACE} leftColor={MUTED}
              title={invoice.description} subtitle={`Fatura atualizada · ${monthLabel(mKey)}`}
              right={<Money value={invoice.amount} hidden={hidden} />}
            />
          ))}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 14 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: MUTED }}>Total de gastos variáveis</span>
        <span style={{ fontSize: 16, fontWeight: 800, color: INK }}><Money value={d.totalVar + d.totalCard} hidden={hidden} /></span>
      </div>
      {d.totalCard > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
          <span style={{ fontSize: 12.5, color: MUTED }}>Cartões (fatura do mês)</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: INK }}><Money value={d.totalCard} hidden={hidden} /></span>
        </div>
      )}
    </Card>
  );
}

/* ============================================================
   MODALS: Add Income / Variable Expense / Investment / Card / Card Tx / Fixed Expense
   ============================================================ */
function IncomeForm({ initial, onSave, onClose }) {
  const [description, setDescription] = useState(initial?.description || "");
  const [amount, setAmount] = useState(initial?.amount || "");
  const [date, setDate] = useState(initial?.date || todayISO());
  const [status, setStatus] = useState(initial?.status || "Recebido");
  const valid = description.trim() && Number(amount) > 0;
  return (
    <div>
      <FormField label="Nome do serviço / origem"><TextInput value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Projeto Website" /></FormField>
      <FormField label="Valor"><TextInput type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" /></FormField>
      <FormField label="Data"><TextInput type="date" value={date} onChange={e => setDate(e.target.value)} /></FormField>
      <FormField label="Status">
        <Select value={status} onChange={e => setStatus(e.target.value)} options={["Previsto", "Recebido"]} />
      </FormField>
      <PrimaryButton disabled={!valid} onClick={() => { onSave({ description: description.trim(), amount: Number(amount), date, status }); onClose(); }}>Salvar</PrimaryButton>
    </div>
  );
}

function VariableExpenseForm({ initial, onSave, onClose }) {
  const [description, setDescription] = useState(initial?.description || "");
  const [amount, setAmount] = useState(initial?.amount || "");
  const [category, setCategory] = useState(initial?.category || CATEGORIES[0]);
  const [date, setDate] = useState(initial?.date || todayISO());
  const [paymentMethod, setPaymentMethod] = useState(initial?.paymentMethod || "Pix");
  const valid = description.trim() && Number(amount) > 0;
  return (
    <div>
      <FormField label="Descrição"><TextInput value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Mercado" /></FormField>
      <FormField label="Valor"><TextInput type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" /></FormField>
      <FormField label="Categoria"><Select value={category} onChange={e => setCategory(e.target.value)} options={CATEGORIES} /></FormField>
      <FormField label="Data"><TextInput type="date" value={date} onChange={e => setDate(e.target.value)} /></FormField>
      <FormField label="Forma de pagamento"><Select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} options={["Pix", "Débito", "Dinheiro"]} /></FormField>
      <PrimaryButton disabled={!valid} onClick={() => { onSave({ description: description.trim(), amount: Number(amount), category, date, paymentMethod }); onClose(); }}>Salvar</PrimaryButton>
    </div>
  );
}

function InvestmentForm({ type, onSave, onClose }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState("");
  const valid = Number(amount) > 0 && (type === "CONTRIBUTION" || description.trim());
  return (
    <div>
      <FormField label="Valor"><TextInput type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" /></FormField>
      <FormField label="Data"><TextInput type="date" value={date} onChange={e => setDate(e.target.value)} /></FormField>
      <FormField label={type === "CONTRIBUTION" ? "Descrição (opcional)" : "Motivo da retirada"}>
        <TextInput value={description} onChange={e => setDescription(e.target.value)} placeholder={type === "CONTRIBUTION" ? "Ex: Aporte mensal" : "Ex: Emergência"} />
      </FormField>
      <PrimaryButton disabled={!valid} onClick={() => { onSave({ amount: Number(amount), date, description: description.trim() }); onClose(); }}>Salvar</PrimaryButton>
    </div>
  );
}

function CardForm({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || "");
  const [invoiceDay, setInvoiceDay] = useState(initial?.invoiceDay || "10");
  const [closingDay, setClosingDay] = useState(initial?.closingDay || "3");
  const [color, setColor] = useState(initial?.colorLabel || CARD_COLORS[0].hex);
  const valid = name.trim() && Number(invoiceDay) >= 1 && Number(invoiceDay) <= 31 && Number(closingDay) >= 1 && Number(closingDay) <= 31;
  return (
    <div>
      <FormField label="Nome do cartão"><TextInput value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Nubank" /></FormField>
      <FormField label="Dia de pagamento da fatura"><TextInput type="number" min="1" max="31" value={invoiceDay} onChange={e => setInvoiceDay(e.target.value)} /></FormField>
      <FormField label="Dia de fechamento da fatura"><TextInput type="number" min="1" max="31" value={closingDay} onChange={e => setClosingDay(e.target.value)} /></FormField>
      <FormField label="Cor da etiqueta">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {CARD_COLORS.map(c => (
            <div key={c.hex} onClick={() => setColor(c.hex)} style={{
              width: 32, height: 32, borderRadius: 999, background: c.hex, cursor: "pointer",
              border: color === c.hex ? `3px solid ${INK}` : "3px solid transparent", boxSizing: "border-box"
            }} title={c.name} />
          ))}
        </div>
      </FormField>
      <PrimaryButton disabled={!valid} onClick={() => { onSave({ name: name.trim(), invoiceDay: Number(invoiceDay), closingDay: Number(closingDay), colorLabel: color }); onClose(); }}>Salvar</PrimaryButton>
    </div>
  );
}

function CardTxForm({ onSave, onClose }) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [category, setCategory] = useState(CATEGORIES[0]);
  const valid = description.trim() && Number(amount) > 0;
  return (
    <div>
      <FormField label="Descrição"><TextInput value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Assinatura streaming" /></FormField>
      <FormField label="Valor"><TextInput type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" /></FormField>
      <FormField label="Data"><TextInput type="date" value={date} onChange={e => setDate(e.target.value)} /></FormField>
      <FormField label="Categoria"><Select value={category} onChange={e => setCategory(e.target.value)} options={CATEGORIES} /></FormField>
      <PrimaryButton disabled={!valid} onClick={() => { onSave({ description: description.trim(), amount: Number(amount), date, category }); onClose(); }}>Salvar</PrimaryButton>
    </div>
  );
}

function FixedExpenseForm({ onSave, onClose, defaultMonth, cards }) {
  const [type, setType] = useState("RECURRING");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [startDate, setStartDate] = useState(defaultMonth);
  const [paymentDay, setPaymentDay] = useState("5");
  const [cardId, setCardId] = useState("");
  const [installmentCount, setInstallmentCount] = useState("2");
  const [initialInstallment, setInitialInstallment] = useState("1");

  const valid = description.trim() && Number(amount) > 0 && (type === "RECURRING" || Number(installmentCount) >= 1);

  function submit() {
    onSave({
      description: description.trim(), amount: Number(amount), type,
      startDate, paymentDay: Number(paymentDay) || null, cardId: cardId || null,
      installmentCount: type === "INSTALLMENT" ? Number(installmentCount) : null,
      initialInstallment: type === "INSTALLMENT" ? Number(initialInstallment) : null,
      active: true,
    });
    onClose();
  }

  return (
    <div>
      <FormField label="Tipo">
        <div style={{ display: "flex", gap: 8 }}>
          {[{k:"RECURRING", l:"Recorrente"}, {k:"INSTALLMENT", l:"Parcelado"}].map(o => (
            <button key={o.k} onClick={() => setType(o.k)} style={{
              flex: 1, padding: "10px", borderRadius: 12, cursor: "pointer",
              border: `1px solid ${type === o.k ? ACCENT : BORDER}`,
              background: type === o.k ? ACCENT_TINT : "#fff", color: type === o.k ? ACCENT : INK, fontWeight: 600, fontSize: 13.5
            }}>{o.l}</button>
          ))}
        </div>
      </FormField>
      <FormField label="Descrição"><TextInput value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Aluguel, Netflix..." /></FormField>
      <FormField label={type === "RECURRING" ? "Valor" : "Valor da parcela"}><TextInput type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" /></FormField>
      <FormField label={type === "RECURRING" ? "Início (mês/ano)" : "Mês/ano da 1ª parcela considerada"}>
        <TextInput type="month" value={startDate} onChange={e => setStartDate(e.target.value)} />
      </FormField>
      {type === "INSTALLMENT" && (
        <>
          <FormField label="Quantidade total de parcelas"><TextInput type="number" min="1" value={installmentCount} onChange={e => setInstallmentCount(e.target.value)} /></FormField>
          <FormField label="Número da parcela no mês acima"><TextInput type="number" min="1" value={initialInstallment} onChange={e => setInitialInstallment(e.target.value)} /></FormField>
        </>
      )}
      <FormField label="Dia de pagamento"><TextInput type="number" min="1" max="31" value={paymentDay} onChange={e => setPaymentDay(e.target.value)} /></FormField>
      <FormField label="Cartão vinculado (opcional)">
        <Select value={cardId} onChange={e => setCardId(e.target.value)} placeholder="Nenhum" options={cards.map(c => ({ value: c.id, label: c.name }))} />
      </FormField>
      <PrimaryButton disabled={!valid} onClick={submit}>Salvar</PrimaryButton>
    </div>
  );
}

/* ============================================================
   SCREENS: CARTÕES / FIXOS / INVEST / PERFIL
   ============================================================ */
function CartoesScreen({ state, mKey, setMKey, hidden, actions }) {
  const [expanded, setExpanded] = useState(null);
  const [sheet, setSheet] = useState(null); // { cardId }
  const [confirmDel, setConfirmDel] = useState(null);

  return (
    <div className="app-page" style={{ padding: "0 20px" }}>
      <div style={{ margin: "18px 0" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: INK, margin: "0 0 4px" }}>Cartões</h2>
        <MonthSelector monthKeyVal={mKey} onChange={setMKey} overlap={false} />
      </div>
      {state.cards.length === 0 ? (
        <Card><EmptyState text="Você ainda não cadastrou cartões." cta="Cadastre em Perfil › Meus cartões" /></Card>
      ) : (
        state.cards.map(card => {
          const txs = state.cardTransactions.filter(t => t.cardId === card.id && t.invoiceMonth === mKey);
          const invoice = (state.cardInvoices || []).find(i => i.cardId === card.id && i.invoiceMonth === mKey);
          const total = invoice ? Number(invoice.amount) : txs.reduce((s, t) => s + Number(t.amount), 0);
          const isOpen = expanded === card.id;
          const today = new Date().getDate();
          const closesThisCycle = today <= Number(card.closingDay || 1);
          return (
            <Card key={card.id} style={{ marginBottom: 12, padding: 0, overflow: "hidden" }}>
              <div onClick={() => setExpanded(isOpen ? null : card.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: 16, cursor: "pointer" }}>
                <div style={{ width: 6, height: 40, borderRadius: 4, background: card.colorLabel }} />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: INK }}>{card.name}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12.5, color: MUTED }}>Fecha dia {card.closingDay || "—"} · paga dia {card.invoiceDay}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: INK }}><Money value={total} hidden={hidden} /></p>
                </div>
                <ChevronDown size={16} color={MUTED} style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
              </div>
              {isOpen && (
                <div style={{ padding: "0 16px 16px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, padding: "10px 0 14px" }}>
                    {[{ label: "Hoje", day: today, color: ACCENT }, { label: "Fecha", day: card.closingDay || "—", color: WARN }, { label: "Paga", day: card.invoiceDay, color: INV }].map(item => (
                      <div key={item.label} style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: "9px 6px", textAlign: "center" }}>
                        <p style={{ margin: 0, fontSize: 10.5, color: MUTED }}>{item.label}</p><p style={{ margin: "3px 0 0", fontSize: 17, fontWeight: 800, color: item.color }}>{item.day}</p>
                      </div>
                    ))}
                  </div>
                  <p style={{ margin: "0 0 10px", fontSize: 12.5, color: closesThisCycle ? POS : WARN }}>Uma compra feita hoje entra {closesThisCycle ? "nesta fatura" : "na próxima fatura"}.</p>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
                    <AddButton label="Atualizar fatura" onClick={() => setSheet({ cardId: card.id, amount: total })} />
                  </div>
                  <p style={{ margin: 0, color: MUTED, fontSize: 13 }}>Valor consolidado da fatura de {monthLabel(mKey)}.</p>
                </div>
              )}
            </Card>
          );
        })
      )}
      <div style={{ height: 90 }} />
      <BottomSheet open={!!sheet} onClose={() => setSheet(null)} title="Atualizar fatura">
        {sheet && <InvoiceUpdateForm initialAmount={sheet.amount} onSave={(amount) => actions.updateCardInvoice(sheet.cardId, mKey, amount)} onClose={() => setSheet(null)} />}
      </BottomSheet>
      <ConfirmDialog open={!!confirmDel} onCancel={() => setConfirmDel(null)}
        onConfirm={() => { actions.deleteCardTx(confirmDel); setConfirmDel(null); }}
        text={{ title: "Excluir esta compra?", body: "Essa ação não poderá ser desfeita." }} />
    </div>
  );
}

function FixosScreen({ state, hidden, actions }) {
  const [sheet, setSheet] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const nowKey = monthKey(new Date().getFullYear(), new Date().getMonth());

  return (
    <div className="app-page" style={{ padding: "0 20px" }}>
      <div style={{ margin: "18px 0 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: INK, margin: 0 }}>Gastos Fixos</h2>
          <p style={{ fontSize: 13, color: MUTED, margin: "4px 0 0" }}>Gerencie despesas recorrentes e compras parceladas.</p>
        </div>
        <AddButton onClick={() => setSheet(true)} label="Novo" />
      </div>
      <Card>
        {state.fixedExpenses.length === 0 ? (
          <EmptyState text="Nenhum gasto fixo cadastrado." cta="+ Novo gasto fixo" onCta={() => setSheet(true)} />
        ) : (
          state.fixedExpenses.map(fe => {
            const status = fixedExpenseStatusForMonth(fe, nowKey);
            const card = state.cards.find(c => c.id === fe.cardId);
            return (
              <RowItem key={fe.id}
                leftIcon={<Receipt size={16} />} leftBg={WARN_BG} leftColor={WARN}
                title={fe.description}
                subtitle={`${fe.type === "RECURRING" ? "Recorrente" : (status ? status.label : `${fe.installmentCount}x`)}${card ? " · " + card.name : ""}${fe.paymentDay ? " · dia " + fe.paymentDay : ""}`}
                right={<Money value={fe.amount} hidden={hidden} />}
                onDelete={() => setConfirmDel(fe.id)}
              />
            );
          })
        )}
      </Card>
      <div style={{ height: 90 }} />
      <BottomSheet open={sheet} onClose={() => setSheet(false)} title="Novo gasto fixo">
        <FixedExpenseForm onSave={actions.addFixedExpense} onClose={() => setSheet(false)} defaultMonth={nowKey} cards={state.cards} />
      </BottomSheet>
      <ConfirmDialog open={!!confirmDel} onCancel={() => setConfirmDel(null)}
        onConfirm={() => { actions.deleteFixedExpense(confirmDel); setConfirmDel(null); }}
        text={{ title: "Excluir este gasto fixo?", body: "Essa ação não poderá ser desfeita." }} />
    </div>
  );
}

function PiggyGoalForm({ onSave, onClose }) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [deadline, setDeadline] = useState("");
  const [color, setColor] = useState(CARD_COLORS[0].hex);
  const valid = name.trim() && Number(target) > 0;
  return <div>
    <FormField label="Nome da meta"><TextInput value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Viagem para Salvador" /></FormField>
    <FormField label="Valor da meta"><TextInput type="number" min="1" value={target} onChange={e => setTarget(e.target.value)} placeholder="0,00" /></FormField>
    <FormField label="Data desejada (opcional)"><TextInput type="date" value={deadline} onChange={e => setDeadline(e.target.value)} /></FormField>
    <FormField label="Cor do porquinho"><div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>{CARD_COLORS.map(c => <button key={c.hex} onClick={() => setColor(c.hex)} aria-label={c.name} style={{ width:30, height:30, borderRadius:99, background:c.hex, border: color === c.hex ? `3px solid ${INK}` : "3px solid transparent", cursor:"pointer" }} />)}</div></FormField>
    <PrimaryButton disabled={!valid} onClick={() => { onSave({ name:name.trim(), target:Number(target), deadline, color }); onClose(); }}>Criar porquinho</PrimaryButton>
  </div>;
}

function PiggyValueForm({ goal, mode, onSave, onClose }) {
  const [amount, setAmount] = useState("");
  const isAdd = mode === "add";
  return <div>
    <p style={{ color:MUTED, fontSize:13.5, margin:"0 0 16px" }}>{isAdd ? "Adicione um valor a esta meta." : "Retire um valor desta meta."}</p>
    <FormField label="Valor"><TextInput type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" /></FormField>
    <PrimaryButton disabled={Number(amount) <= 0} onClick={() => { onSave((isAdd ? 1 : -1) * Number(amount)); onClose(); }}>{isAdd ? "Adicionar valor" : "Retirar valor"}</PrimaryButton>
  </div>;
}

function InvestScreen({ state, hidden, actions }) {
  const [sheet, setSheet] = useState(null); // 'contribution' | 'withdrawal'
  const [goalSheet, setGoalSheet] = useState(null); // 'create' | { goal, mode }
  const [statementGoal, setStatementGoal] = useState(null);
  const [confirmPiggy, setConfirmPiggy] = useState(null);
  const [filter, setFilter] = useState("Todos");
  const totalContrib = state.investments.filter(i => i.type === "CONTRIBUTION").reduce((s, i) => s + Number(i.amount), 0);
  const totalWithdraw = state.investments.filter(i => i.type === "WITHDRAWAL").reduce((s, i) => s + Number(i.amount), 0);
  const balance = totalContrib - totalWithdraw;

  const sorted = [...state.investments].sort((a, b) => b.date.localeCompare(a.date));
  const filtered = filter === "Todos" ? sorted : sorted.filter(i => i.date.slice(0, 4) === filter);
  const years = Array.from(new Set(state.investments.map(i => i.date.slice(0, 4)))).sort().reverse();

  return (
    <div className="app-page" style={{ padding: "0 20px" }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: INK, margin: "18px 0 16px" }}>Investimentos</h2>
      <Card className="invest-summary-card" style={{ background: INK, color: "#fff", border: "none" }}>
        <p style={{ margin: 0, fontSize: 13, color: "#B9B9C4", fontWeight: 600 }}>Saldo investido</p>
        <p style={{ margin: "6px 0 16px", fontSize: 30, fontWeight: 800, color: "#7DD3FC" }}><Money value={balance} hidden={hidden} /></p>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setSheet("contribution")} style={{ flex: 1, background: "rgba(255,255,255,0.14)", border: "none", borderRadius: 12, padding: "10px", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ Investimento</button>
          <button onClick={() => setSheet("withdrawal")} style={{ flex: 1, background: "rgba(255,255,255,0.14)", border: "none", borderRadius: 12, padding: "10px", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>+ Retirada</button>
        </div>
      </Card>

      <Card style={{ marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 13, color: MUTED }}>Total investido</span>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: POS }}><Money value={totalContrib} hidden={hidden} /></span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, color: MUTED }}>Total retirado</span>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: NEG }}><Money value={totalWithdraw} hidden={hidden} /></span>
        </div>
      </Card>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", margin:"20px 0 10px" }}>
        <div><h3 style={{ margin:0, fontSize:17, color:INK }}>Porquinhos</h3><p style={{ margin:"3px 0 0", fontSize:12.5, color:MUTED }}>Metas separadas dos seus investimentos.</p></div>
        <AddButton label="Porquinho" onClick={() => setGoalSheet("create")} />
      </div>
      {(state.piggyGoals || []).length === 0 ? <Card><EmptyState text="Crie um porquinho para começar uma meta." cta="+ Adicionar porquinho" onCta={() => setGoalSheet("create")} /></Card> : (
        <div style={{ display:"grid", gap:10 }}>{state.piggyGoals.map(goal => {
          const percent = Math.min(100, Math.round((Number(goal.balance || 0) / Number(goal.target || 1)) * 100));
          return <Card key={goal.id} style={{ padding:14, position:"relative" }}>
            <button onClick={() => setConfirmPiggy(goal)} aria-label={`Excluir ${goal.name}`} style={{ position:"absolute", top:5, right:5, width:26, height:26, borderRadius:99, border:"none", background:"transparent", color:"#9CA3AF", display:"grid", placeItems:"center", cursor:"pointer" }}><X size={15} /></button>
            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:48, height:48, borderRadius:14, background:"#F8F8FA", color:goal.color, display:"grid", placeItems:"center", flexShrink:0 }}><PiggyBank size={25} /></div>
              <div style={{ flex:1, minWidth:0 }}><p style={{ margin:0, fontSize:14, fontWeight:700, color:INK, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{goal.name}</p><div style={{ height:7, borderRadius:99, background:"#ECEEF1", overflow:"hidden", marginTop:8 }}><div style={{ width:`${percent}%`, height:"100%", background:goal.color, borderRadius:99, transition:"width .25s" }} /></div></div>
              <div style={{ display:"flex", alignItems:"center", paddingRight:16 }}><strong style={{ fontSize:22, color:goal.color }}>{percent}%</strong></div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3, minmax(0, 1fr))", gap:8, marginTop:12 }}><button onClick={() => setGoalSheet({ goal, mode:"add" })} style={{ border:`1px solid ${goal.color}`, background:"#fff", color:goal.color, borderRadius:10, padding:"8px", fontWeight:700, cursor:"pointer" }}>Adicionar</button><button onClick={() => setGoalSheet({ goal, mode:"withdraw" })} style={{ border:`1px solid ${BORDER}`, background:"#fff", color:INK, borderRadius:10, padding:"8px", fontWeight:700, cursor:"pointer" }}>Retirar</button><button onClick={() => setStatementGoal(goal)} aria-label={`Ver extrato de ${goal.name}`} style={{ border:`1px solid ${BORDER}`, background:"#fff", color:goal.color, borderRadius:10, padding:"8px", display:"grid", placeItems:"center", cursor:"pointer" }}><Receipt size={16} /></button></div>
          </Card>;
        })}</div>
      )}

      <div style={{ display: "flex", gap: 8, margin: "16px 0 8px", overflowX: "auto" }}>
        {["Todos", ...years].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "6px 14px", borderRadius: 999, border: `1px solid ${filter === f ? ACCENT : BORDER}`,
            background: filter === f ? ACCENT_TINT : "#fff", color: filter === f ? ACCENT : MUTED, fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap"
          }}>{f}</button>
        ))}
      </div>

      <Card>
        <SectionTitle>Extrato</SectionTitle>
        {filtered.length === 0 ? (
          <EmptyState text="Você ainda não registrou investimentos." />
        ) : filtered.map(inv => (
          <RowItem key={inv.id}
            leftIcon={inv.type === "CONTRIBUTION" ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
            leftBg={inv.type === "CONTRIBUTION" ? INV_BG : NEG_BG} leftColor={inv.type === "CONTRIBUTION" ? INV : NEG}
            title={inv.type === "CONTRIBUTION" ? "Investimento" : "Retirada"}
            subtitle={`${fmtDateDisplay(inv.date)}${inv.description ? " · " + inv.description : ""}`}
            right={<Money value={inv.amount} hidden={hidden} showSign={inv.type === "WITHDRAWAL"} color={inv.type === "WITHDRAWAL" ? NEG : undefined} />}
            onDelete={() => actions.deleteInvestment(inv.id)}
          />
        ))}
      </Card>
      <div style={{ height: 90 }} />
      <BottomSheet open={!!sheet} onClose={() => setSheet(null)} title={sheet === "contribution" ? "Novo investimento" : "Nova retirada"}>
        {sheet && <InvestmentForm type={sheet === "contribution" ? "CONTRIBUTION" : "WITHDRAWAL"} onSave={(v) => actions.addInvestment({ ...v, type: sheet === "contribution" ? "CONTRIBUTION" : "WITHDRAWAL", monthReference: v.date.slice(0, 7) })} onClose={() => setSheet(null)} />}
      </BottomSheet>
      <BottomSheet open={!!goalSheet} onClose={() => setGoalSheet(null)} title={goalSheet === "create" ? "Novo porquinho" : goalSheet?.mode === "add" ? "Adicionar ao porquinho" : "Retirar do porquinho"} centered>
        {goalSheet === "create" && <PiggyGoalForm onSave={actions.addPiggyGoal} onClose={() => setGoalSheet(null)} />}
        {goalSheet && goalSheet !== "create" && <PiggyValueForm goal={goalSheet.goal} mode={goalSheet.mode} onSave={(amount) => actions.changePiggyGoal(goalSheet.goal.id, amount)} onClose={() => setGoalSheet(null)} />}
      </BottomSheet>
      <BottomSheet open={!!statementGoal} onClose={() => setStatementGoal(null)} title={statementGoal ? `Extrato · ${statementGoal.name}` : "Extrato"} centered>
        {statementGoal && (() => {
          const entries = (state.piggyTransactions || []).filter(t => t.piggyGoalId === statementGoal.id).sort((a,b) => b.date.localeCompare(a.date));
          return entries.length === 0 ? <EmptyState text="Ainda não há movimentações neste porquinho." /> : <div>{entries.map(t => { const signedAmount = t.type === "WITHDRAW" ? -Number(t.amount) : Number(t.amount); return <RowItem key={t.id} leftIcon={t.type === "ADD" ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />} leftBg={t.type === "ADD" ? POS_BG : NEG_BG} leftColor={t.type === "ADD" ? POS : NEG} title={t.type === "ADD" ? "Valor adicionado" : "Valor retirado"} subtitle={fmtDateDisplay(t.date)} right={<Money value={signedAmount} hidden={hidden} showSign />} rightColor={t.type === "ADD" ? POS : NEG} />; })}</div>;
        })()}
      </BottomSheet>
      <ConfirmDialog open={!!confirmPiggy} onCancel={() => setConfirmPiggy(null)} onConfirm={() => { actions.deletePiggyGoal(confirmPiggy.id); setConfirmPiggy(null); }} text={{ title:"Excluir este porquinho?", body:"A meta e todo o seu extrato serão removidos." }} />
    </div>
  );
}

function PersonalDataForm({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial?.name || "");
  const [email, setEmail] = useState(initial?.email || "");
  const valid = name.trim() && email.trim();
  return (
    <div>
      <FormField label="Nome"><TextInput value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome" /></FormField>
      <FormField label="E-mail"><TextInput type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" /></FormField>
      <PrimaryButton disabled={!valid} onClick={() => { onSave({ name: name.trim(), email: email.trim() }); onClose(); }}>Salvar</PrimaryButton>
    </div>
  );
}

function InvoiceUpdateForm({ initialAmount, onSave, onClose }) {
  const [amount, setAmount] = useState(initialAmount ? String(initialAmount) : "");
  return <div>
    <p style={{ margin: "0 0 16px", color: MUTED, fontSize: 13.5, lineHeight: 1.5 }}>Informe o valor total atual da fatura selecionada. Você poderá atualizá-lo novamente quando quiser.</p>
    <FormField label="Valor atual da fatura"><TextInput type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" /></FormField>
    <PrimaryButton disabled={amount === "" || Number(amount) < 0} onClick={() => { onSave(Number(amount)); onClose(); }}>Atualizar fatura</PrimaryButton>
  </div>;
}

function PasswordForm({ onSave, onClose }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  function submit() {
    if (password.length < 4) return setError("Use ao menos 4 caracteres.");
    if (password !== confirm) return setError("As senhas não coincidem.");
    onSave(password);
    onClose();
  }
  return <div>
    <FormField label="Nova senha"><TextInput type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo de 4 caracteres" /></FormField>
    <FormField label="Confirmar nova senha"><TextInput type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Digite novamente" /></FormField>
    {error && <p style={{ color: NEG, fontSize: 13, margin: "-6px 0 12px" }}>{error}</p>}
    <PrimaryButton onClick={submit}>Salvar nova senha</PrimaryButton>
  </div>;
}

function PreferencesForm({ initial, onSave, onClose }) {
  const [hideBalancesByDefault, setHideBalancesByDefault] = useState(!!initial?.hideBalancesByDefault);
  const [theme, setTheme] = useState(initial?.theme || "picpay");
  const palettes = [{ id:"picpay", name:"PicPay", colors:["#0FA958","#075B31","#E4F9EC","#D1FAE5"] }, { id:"nubank", name:"Nubank", colors:["#6D28D9","#4C1D95","#F3E8FF","#DDD6FE"] }, { id:"inter", name:"Inter", colors:["#EA580C","#9A3412","#FFF7ED","#FED7AA"] }, { id:"cora", name:"Cora", colors:["#BE185D","#831843","#FCE7F3","#FBCFE8"] }, { id:"mercadopago", name:"Mercado Pago", colors:["#0284C7","#075985","#E0F2FE","#BAE6FD"] }];
  return <div>
    <p style={{ margin: "0 0 12px", color: MUTED, fontSize: 13.5, lineHeight: 1.5 }}>Escolha uma paleta clara para personalizar o aplicativo.</p>
    <div style={{ display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:10, marginBottom:20 }}>{palettes.map(p => <button key={p.id} onClick={() => setTheme(p.id)} style={{ border:`2px solid ${theme === p.id ? p.colors[0] : BORDER}`, background:"#fff", borderRadius:14, padding:10, textAlign:"left", cursor:"pointer" }}><span style={{ fontSize:13, fontWeight:700, color:INK }}>{p.name}</span><span style={{ display:"flex", gap:4, marginTop:8 }}>{p.colors.map(c => <i key={c} style={{ width:16, height:16, borderRadius:99, background:c, display:"block" }} />)}</span></button>)}</div>
    <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 20, cursor: "pointer", color: INK, fontSize: 14 }}>
      <input type="checkbox" checked={hideBalancesByDefault} onChange={e => setHideBalancesByDefault(e.target.checked)} style={{ marginTop: 2, accentColor: ACCENT }} />
      <span><strong>Ocultar valores ao abrir</strong><br /><span style={{ color: MUTED, fontSize: 12.5 }}>Protege saldos e lançamentos quando estiver em público.</span></span>
    </label>
    <PrimaryButton onClick={() => { onSave({ hideBalancesByDefault, theme }); onClose(); }}>Salvar preferências</PrimaryButton>
  </div>;
}

function PerfilScreen({ state, actions, onLogout }) {
  const [sheet, setSheet] = useState(false);
  const [editCard, setEditCard] = useState(null);
  const [editData, setEditData] = useState(false);
  const [passwordSheet, setPasswordSheet] = useState(false);
  const [preferencesSheet, setPreferencesSheet] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const initials = (state.user?.name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="app-page profile-page" style={{ padding: "0 20px 100px" }}>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: INK, margin: "18px 0 16px" }}>Perfil</h2>
      <Card style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 52, height: 52, borderRadius: 999, background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 17 }}>{initials}</div>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: INK }}>{state.user?.name}</p>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: MUTED }}>{state.user?.email}</p>
        </div>
      </Card>

      <p style={{ fontSize: 12.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, margin: "22px 4px 8px" }}>Meus cartões</p>
      <Card style={{ padding: 8 }}>
        {state.cards.length === 0 ? (
          <div style={{ padding: 10 }}><EmptyState text="Nenhum cartão cadastrado." cta="+ Adicionar cartão" onCta={() => setSheet(true)} /></div>
        ) : (
          <div style={{ padding: "6px 10px" }}>
            {state.cards.map(c => (
              <RowItem key={c.id}
                leftIcon={<div style={{ width: 10, height: 10, borderRadius: 999, background: c.colorLabel }} />}
                leftBg="transparent" title={c.name} subtitle={`Fatura dia ${c.invoiceDay}`}
                right="" onEdit={() => setEditCard(c)} onDelete={() => setConfirmDel(c.id)}
              />
            ))}
          </div>
        )}
        <div style={{ padding: "10px 10px 4px" }}>
          <AddButton onClick={() => setSheet(true)} label="Adicionar cartão" />
        </div>
      </Card>

      <p style={{ fontSize: 12.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, margin: "22px 4px 8px" }}>Dados pessoais</p>
      <Card>
        <RowItem title="Nome" right={state.user?.name} />
        <RowItem title="E-mail" right={state.user?.email} />
        <div style={{ marginTop: 12 }}><GhostButton onClick={() => setEditData(true)}>Editar dados</GhostButton></div>
      </Card>

      <p style={{ fontSize: 12.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, margin: "22px 4px 8px" }}>Segurança</p>
      <Card><GhostButton onClick={() => setPasswordSheet(true)}>Alterar senha</GhostButton></Card>

      <p style={{ fontSize: 12.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: 0.4, margin: "22px 4px 8px" }}>Preferências</p>
      <Card>
        <RowItem title="Aparência" right="Paleta clara" />
        <div style={{ marginTop: 12 }}><GhostButton onClick={() => setPreferencesSheet(true)}>Configurar preferências</GhostButton></div>
      </Card>

      <div style={{ marginTop: 22 }}>
        <button onClick={onLogout} style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", width: "100%", padding: "13px", borderRadius: 14, border: `1px solid ${BORDER}`, background: "#fff", color: NEG, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
          <LogOut size={16} /> Sair
        </button>
      </div>

      <BottomSheet open={sheet || !!editCard} onClose={() => { setSheet(false); setEditCard(null); }} title={editCard ? "Editar cartão" : "Adicionar cartão"}>
        <CardForm initial={editCard} onSave={(c) => editCard ? actions.updateCard(editCard.id, c) : actions.addCard(c)} onClose={() => { setSheet(false); setEditCard(null); }} />
      </BottomSheet>
      <BottomSheet open={editData} onClose={() => setEditData(false)} title="Editar dados">
        <PersonalDataForm initial={state.user} onSave={actions.updateUser} onClose={() => setEditData(false)} />
      </BottomSheet>
      <BottomSheet open={passwordSheet} onClose={() => setPasswordSheet(false)} title="Alterar senha">
        <PasswordForm onSave={(password) => actions.updateUser({ password, passwordChangedAt: new Date().toISOString() })} onClose={() => setPasswordSheet(false)} />
      </BottomSheet>
      <BottomSheet open={preferencesSheet} onClose={() => setPreferencesSheet(false)} title="Preferências">
        <PreferencesForm initial={state.user} onSave={actions.updateUser} onClose={() => setPreferencesSheet(false)} />
      </BottomSheet>
      <ConfirmDialog open={!!confirmDel} onCancel={() => setConfirmDel(null)}
        onConfirm={() => { actions.deleteCard(confirmDel); setConfirmDel(null); }}
        text={{ title: "Excluir este cartão?", body: "Compras associadas continuarão no histórico, mas o cartão será removido." }} />
    </div>
  );
}

/* ============================================================
   ONBOARDING CHECKLIST
   ============================================================ */
function OnboardingChecklist({ state, dismissed, onDismiss, goTo }) {
  if (dismissed) return null;
  const steps = [
    { done: state.cards.length > 0, label: "Cadastre seus cartões", to: "perfil" },
    { done: state.fixedExpenses.length > 0, label: "Adicione gastos fixos", to: "fixos" },
    { done: state.incomes.length > 0, label: "Registre seus ganhos", to: "dashboard" },
  ];
  if (steps.every(s => s.done)) return null;
  return (
    <Card className="onboarding-card" style={{ marginTop: 14, background: ACCENT_TINT, border: "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: ACCENT_DARK }}>Comece por aqui</p>
        <button onClick={onDismiss} style={{ background: "none", border: "none", cursor: "pointer", color: ACCENT_DARK }}><X size={16} /></button>
      </div>
      {steps.map((s, i) => (
        <div key={i} onClick={() => goTo(s.to)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", cursor: "pointer" }}>
          <CheckCircle2 size={16} color={s.done ? POS : "#A7E3C0"} />
          <span style={{ fontSize: 13.5, color: s.done ? MUTED : ACCENT_DARK, textDecoration: s.done ? "line-through" : "none" }}>{s.label}</span>
        </div>
      ))}
    </Card>
  );
}

/* ============================================================
   ROOT APP
   ============================================================ */
export default function App() {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState(emptyState);
  const [authUser, setAuthUser] = useState(null);
  const cloudReady = useRef(false);
  const [authMode, setAuthMode] = useState("login");
  const [active, setActive] = useState("dashboard");
  const [hidden, setHidden] = useState(false);
  const [mKey, setMKey] = useState(() => { const d = new Date(); return monthKey(d.getFullYear(), d.getMonth()); });
  const [checklistDismissed, setChecklistDismissed] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const [incomeSheet, setIncomeSheet] = useState(null); // {} or {edit}
  const [varSheet, setVarSheet] = useState(null);
  const [investSheet, setInvestSheet] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null); // {type,id}

  useEffect(() => {
    if (!firebaseEnabled) {
      loadState().then(s => { setState(s); setHidden(!!s.user?.hideBalancesByDefault); setLoading(false); });
      return undefined;
    }
    return onAuthStateChanged(auth, async (user) => {
      cloudReady.current = false;
      setAuthUser(user);
      if (!user) { setState(emptyState); setLoading(false); return; }
      const saved = await loadState(user.uid);
      const merged = { ...saved, user: { ...saved.user, name: user.displayName || saved.user?.name || "Usuário", email: user.email || saved.user?.email || "" } };
      setState(merged);
      setHidden(!!merged.user?.hideBalancesByDefault);
      cloudReady.current = true;
      setLoading(false);
    });
  }, []);
  useEffect(() => { if (!loading && (!firebaseEnabled || (authUser && cloudReady.current))) saveState(state, authUser?.uid); }, [state, loading, authUser]);

  const actions = useMemo(() => ({
    addCard: (c) => setState(s => ({ ...s, cards: [...s.cards, { id: uid(), ...c, active: true, createdAt: todayISO() }] })),
    updateCard: (id, c) => setState(s => ({ ...s, cards: s.cards.map(x => x.id === id ? { ...x, ...c } : x) })),
    deleteCard: (id) => setState(s => ({ ...s, cards: s.cards.filter(c => c.id !== id) })),

    addFixedExpense: (fe) => setState(s => ({ ...s, fixedExpenses: [...s.fixedExpenses, { id: uid(), ...fe }] })),
    deleteFixedExpense: (id) => setState(s => ({ ...s, fixedExpenses: s.fixedExpenses.filter(f => f.id !== id) })),

    addIncome: (inc) => setState(s => ({ ...s, incomes: [...s.incomes, { id: uid(), monthReference: mKey, ...inc }] })),
    updateIncome: (id, inc) => setState(s => ({ ...s, incomes: s.incomes.map(x => x.id === id ? { ...x, ...inc } : x) })),
    deleteIncome: (id) => setState(s => ({ ...s, incomes: s.incomes.filter(i => i.id !== id) })),

    addVarExpense: (v) => setState(s => ({ ...s, variableExpenses: [...s.variableExpenses, { id: uid(), monthReference: mKey, ...v }] })),
    updateVarExpense: (id, v) => setState(s => ({ ...s, variableExpenses: s.variableExpenses.map(x => x.id === id ? { ...x, ...v } : x) })),
    deleteVarExpense: (id) => setState(s => ({ ...s, variableExpenses: s.variableExpenses.filter(v => v.id !== id) })),

    addCardTx: (t) => setState(s => ({ ...s, cardTransactions: [...s.cardTransactions, { id: uid(), ...t }] })),
    deleteCardTx: (id) => setState(s => ({ ...s, cardTransactions: s.cardTransactions.filter(t => t.id !== id) })),
    updateCardInvoice: (cardId, invoiceMonth, amount) => setState(s => {
      const existing = s.cardInvoices.find(i => i.cardId === cardId && i.invoiceMonth === invoiceMonth);
      const cardInvoices = existing
        ? s.cardInvoices.map(i => i.id === existing.id ? { ...i, amount } : i)
        : [...s.cardInvoices, { id: uid(), cardId, invoiceMonth, amount }];
      return { ...s, cardInvoices };
    }),

    addInvestment: (i) => setState(s => ({ ...s, investments: [...s.investments, { id: uid(), ...i }] })),
    deleteInvestment: (id) => setState(s => ({ ...s, investments: s.investments.filter(i => i.id !== id) })),
    addPiggyGoal: (goal) => setState(s => ({ ...s, piggyGoals: [...s.piggyGoals, { id: uid(), balance: 0, ...goal }] })),
    changePiggyGoal: (id, amount) => setState(s => {
      const goal = s.piggyGoals.find(g => g.id === id);
      if (!goal) return s;
      const actualAmount = amount < 0 ? -Math.min(Math.abs(amount), Number(goal.balance || 0)) : amount;
      if (!actualAmount) return s;
      return {
        ...s,
        piggyGoals: s.piggyGoals.map(g => g.id === id ? { ...g, balance: Number(g.balance || 0) + actualAmount } : g),
        piggyTransactions: [...(s.piggyTransactions || []), { id: uid(), piggyGoalId: id, type: actualAmount > 0 ? "ADD" : "WITHDRAW", amount: Math.abs(actualAmount), date: todayISO() }],
      };
    }),
    deletePiggyGoal: (id) => setState(s => ({ ...s, piggyGoals: s.piggyGoals.filter(g => g.id !== id), piggyTransactions: (s.piggyTransactions || []).filter(t => t.piggyGoalId !== id) })),

    updateUser: (u) => setState(s => ({ ...s, user: { ...s.user, ...u } })),
  }), [mKey]);

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: MUTED, fontFamily: "Inter, sans-serif" }}>Carregando...</div>;
  }

  if (!state.user) {
    return (
      <div style={{ fontFamily: "Inter, sans-serif" }}>
        <LoginScreen mode={authMode} setMode={setAuthMode} onGoogleLogin={signInWithGoogle} onLogin={(user) => setState(s => ({ ...s, user }))} />
      </div>
    );
  }

  const monthData = computeMonth(state, mKey);

  return (
    <div className={`app-shell theme-${state.user?.theme || "picpay"}`} style={{ fontFamily: "Inter, system-ui, sans-serif", background: "#fff", minHeight: "100vh", maxWidth: 480, margin: "0 auto", position: "relative" }}>
      {active === "dashboard" && (
        <>
          <Header name={state.user.name.split(" ")[0]} hidden={hidden} setHidden={setHidden} onHelp={() => setHelpOpen(true)} />
          <MonthSelector monthKeyVal={mKey} onChange={setMKey} />
          <div className="dashboard-content" style={{ padding: "0 20px" }}>
            <BalanceCard data={monthData} hidden={hidden} />
            <OnboardingChecklist state={state} dismissed={checklistDismissed} onDismiss={() => setChecklistDismissed(true)} goTo={setActive} />
            <MonthlyComparisonChart data={monthData} hidden={hidden} />
            <IncomeSection state={state} mKey={mKey} hidden={hidden}
              onAdd={() => setIncomeSheet({})}
              onEdit={(inc) => setIncomeSheet({ edit: inc })}
              onDelete={(id) => setConfirmDel({ type: "income", id })} />
            <MonthlyInvestCard state={state} mKey={mKey} hidden={hidden} onAdd={() => setInvestSheet("contribution")} />
            <FixedExpensesSection state={state} mKey={mKey} hidden={hidden} />
            <VariableExpensesSection state={state} mKey={mKey} hidden={hidden}
              onAdd={() => setVarSheet({})}
              onEdit={(v) => setVarSheet({ edit: v })}
              onDelete={(id) => setConfirmDel({ type: "var", id })} />
          </div>
        </>
      )}

      {active === "cartoes" && (
        <CartoesScreen state={state} mKey={mKey} setMKey={setMKey} hidden={hidden} actions={actions} />
      )}
      {active === "fixos" && <FixosScreen state={state} hidden={hidden} actions={actions} />}
      {active === "invest" && <InvestScreen state={state} hidden={hidden} actions={actions} />}
      {active === "perfil" && <PerfilScreen state={state} actions={actions} onLogout={() => firebaseEnabled ? signOutFromGoogle() : setState(s => ({ ...s, user: null }))} />}

      <BottomNav active={active} setActive={setActive} />

      {/* Income sheet */}
      <BottomSheet open={!!incomeSheet} onClose={() => setIncomeSheet(null)} title={incomeSheet?.edit ? "Editar ganho" : "Adicionar ganho"}>
        {incomeSheet && (
          <IncomeForm initial={incomeSheet.edit}
            onSave={(v) => incomeSheet.edit ? actions.updateIncome(incomeSheet.edit.id, v) : actions.addIncome(v)}
            onClose={() => setIncomeSheet(null)} />
        )}
      </BottomSheet>

      {/* Variable expense sheet */}
      <BottomSheet open={!!varSheet} onClose={() => setVarSheet(null)} title={varSheet?.edit ? "Editar gasto" : "Adicionar gasto"}>
        {varSheet && (
          <VariableExpenseForm initial={varSheet.edit}
            onSave={(v) => varSheet.edit ? actions.updateVarExpense(varSheet.edit.id, v) : actions.addVarExpense(v)}
            onClose={() => setVarSheet(null)} />
        )}
      </BottomSheet>

      {/* Monthly investment sheet */}
      <BottomSheet open={!!investSheet} onClose={() => setInvestSheet(null)} title="Novo investimento">
        {investSheet && (
          <InvestmentForm type="CONTRIBUTION" onSave={(v) => actions.addInvestment({ ...v, type: "CONTRIBUTION", monthReference: mKey })} onClose={() => setInvestSheet(null)} />
        )}
      </BottomSheet>

      <ConfirmDialog open={!!confirmDel} onCancel={() => setConfirmDel(null)}
        onConfirm={() => {
          if (confirmDel.type === "income") actions.deleteIncome(confirmDel.id);
          if (confirmDel.type === "var") actions.deleteVarExpense(confirmDel.id);
          setConfirmDel(null);
        }}
        text={{ title: "Excluir este lançamento?", body: "Essa ação não poderá ser desfeita." }} />

      {helpOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={() => setHelpOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(20,20,26,0.5)" }} />
          <div style={{ position: "relative", background: "#fff", borderRadius: 18, padding: 24, maxWidth: 340 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 800, color: INK }}>Minhas Finanças</h3>
            <p style={{ margin: 0, fontSize: 13.5, color: MUTED, lineHeight: 1.6 }}>
              Acompanhe ganhos, gastos fixos e variáveis, cartões e investimentos, mês a mês. Use o ícone de olho para ocultar valores em público. Seus dados ficam salvos automaticamente.
            </p>
            <div style={{ marginTop: 16 }}><PrimaryButton onClick={() => setHelpOpen(false)}>Entendi</PrimaryButton></div>
          </div>
        </div>
      )}
    </div>
  );
}
