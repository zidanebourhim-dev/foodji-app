import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from './firebase';
import { signInWithEmailAndPassword, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, setDoc, query, getDoc, orderBy, limit } from 'firebase/firestore';
import './App.css';

// PALETTE CALIBRÉE (90% NEUTRAL ZINC / 10% INTENTIONAL ACCENT)
const COLORS = {
  primary: '#A84438',
  primaryHover: '#8F372C',
  secondary: '#18181B', // Zinc 900
  darkBg: '#09090B',    // Zinc 950 (Panier sombre)
  darkCard: '#18181B',  // Zinc 900 (Carte article panier)
  darkBorder: '#27272A',// Zinc 800
  bg: '#F4F4F5',        // Zinc 100
  card: '#FFFFFF',
  border: '#E4E4E7',    // Zinc 200
  borderStrong: '#D4D4D8', // Zinc 300
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  promo: '#D97706',
  textMain: '#09090B',  // Zinc 950
  textMuted: '#52525B', // Zinc 600
  textLight: '#71717A', // Zinc 500
  pending: '#F97316',
  blue: '#2563EB'
};

// MOTEUR D'ICÔNES VECTORIELLES SVG (STYLE LUCIDE - TRAIT 1.75PX)
const Icon = ({ name, size = 16, color = "currentColor", style = {} }) => {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: "1.75",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: { flexShrink: 0, display: 'inline-block', verticalAlign: 'middle', ...style }
  };

  switch (name) {
    case 'user':
      return <svg {...props}><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    case 'users':
      return <svg {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
    case 'store':
      return <svg {...props}><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>;
    case 'settings':
      return <svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>;
    case 'trash':
      return <svg {...props}><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>;
    case 'plus':
      return <svg {...props}><path d="M12 5v14"/><path d="M5 12h14"/></svg>;
    case 'minus':
      return <svg {...props}><path d="M5 12h14"/></svg>;
    case 'check':
      return <svg {...props}><polyline points="20 6 9 17 4 12"/></svg>;
    case 'x':
      return <svg {...props}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
    case 'printer':
      return <svg {...props}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>;
    case 'truck':
      return <svg {...props}><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>;
    case 'clock':
      return <svg {...props}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
    case 'chart':
      return <svg {...props}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;
    case 'tag':
      return <svg {...props}><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>;
    case 'wallet':
      return <svg {...props}><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>;
    case 'power':
      return <svg {...props}><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>;
    case 'edit':
      return <svg {...props}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>;
    case 'alert':
      return <svg {...props}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
    case 'ban':
      return <svg {...props}><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>;
    case 'bell':
      return <svg {...props}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>;
    case 'image':
      return <svg {...props}><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>;
    case 'shield':
      return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
    case 'logOut':
      return <svg {...props}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
    default:
      return null;
  }
};

// PASTILLE GÉOMÉTRIQUE D'ÉTAT
const StatusDot = ({ active, colorActive = COLORS.success, colorInactive = '#A1A1AA' }) => (
  <span style={{
    display: 'inline-block',
    width: '7px',
    height: '7px',
    borderRadius: '999px',
    backgroundColor: active ? colorActive : colorInactive,
    boxShadow: active ? `0 0 0 3px ${colorActive}28` : 'none',
    flexShrink: 0
  }} />
);

const INIT_VIANDES = [{ nom: "Poulet", available: true }, { nom: "Viande Hachée", available: true }, { nom: "Cordon Bleu", available: true }, { nom: "Nuggets", available: true }, { nom: "Poulet Crispy", available: true }];
const INIT_GARNITURES_PIZZA = [{ nom: "Viande Hachée", available: true }, { nom: "Poulet", available: true }, { nom: "4 Fromages", available: true }, { nom: "Cannibale", available: true }, { nom: "Pepperoni", available: true }, { nom: "Thon", available: true }, { nom: "Charcuterie", available: true }, { nom: "Végétarienne", available: true }, { nom: "Fruits de Mer", available: true }];
const INIT_SAUCES = [{ nom: "Algérienne", available: true }, { nom: "Biggy", available: true }, { nom: "Barbecue", available: true }, { nom: "Andalouse", available: true }, { nom: "Samouraï", available: true }, { nom: "Gruyère", available: true }, { nom: "Pas de sauce", available: true }];
const INIT_PATES = [{ nom: "Penne", available: true }, { nom: "Tagliatelle", available: true }, { nom: "Spaghetti", available: true }];
const INIT_TAILLES_PIZZA = [{ nom: "M", available: true }, { nom: "L", available: true }];

const CATEGORIES_DEFAUT = ["Tacos", "Pizzas", "Burgers", "Panuozzo", "Pâtes", "Sides", "Les Burritos", "Koniks", "Plats", "Salades", "Boissons", "Suppléments"];
const CAISSIERES_DEFAUT = ["Fatima Zahra", "Nada", "Manager"];

const STOCK_TABS = [
  { id: 'viandes', label: 'Viandes' },
  { id: 'garnitures', label: 'Garnitures Pizza' },
  { id: 'sauces', label: 'Sauces' },
  { id: 'pates', label: 'Pâtes' },
  { id: 'tailles_pizza', label: 'Tailles Pizza' }
];

const NOTIF_SOUND = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

const EXTRAS_BASE = { "Champignons": 10, "Mozzarella": 10, "Parmesan": 15, "Cheddar": 15 };
const TACOS_EXTRAS = { "Sauce Fromagère": 10, "Supplément Cheddar": 7, "Supplément Mozzarella": 7, "Gratinage": 7 };

const ACCOMPAGNEMENTS_PLATS = ["Frites", "Légumes Sautés", "Pâtes"];
const EXCLUSIONS_BURGER = ["Sans Oignons", "Sans Tomates", "Sans Salade", "Sans Fromage", "Sans Sauce", "Sans Cornichons"];
const PIZZAS_EXCLUES_PROMO = ["fruits de mer", "cannibale"];

const EXPIRATION_VIP_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours en millisecondes

const toJSDate = (d) => {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  if (typeof d.seconds === 'number') return new Date(d.seconds * 1000);
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

// ÉVALUATION DU STATUT VIP (AVEC EXPIRATION 30 JOURS & PROTECTION VIP MANUEL)
const evaluerStatutVIP = (client) => {
  if (!client) return { isVipActif: false, isExpired: false, label: 'Standard' };
  if (client.isManualVIP) {
    return { isVipActif: true, isExpired: false, label: 'VIP Fixe' };
  }
  const nb = Number(client.totalCommandes) || 0;
  const lastDate = client.lastOrder ? toJSDate(client.lastOrder) : new Date(0);
  const isExpired = (Date.now() - lastDate.getTime()) > EXPIRATION_VIP_MS;

  if (isExpired && nb > 0) {
    return { isVipActif: false, isExpired: true, label: 'Expiré (+30j)' };
  }
  if (nb >= 10) {
    return { isVipActif: true, isExpired: false, label: 'VIP Actif' };
  }
  return { isVipActif: false, isExpired: false, label: 'Standard' };
};

// SYNTHÉTISEUR AUDIO NATIF ("LE BANG" DE CUISINE) + FALLBACK MP3
const declencherSonNotification = (audioRef) => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Note 1 : Attaque franche (880 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.45, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Note 2 : Résonance haute "Bang" (1174.66 Hz - Ré6)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1174.66, now + 0.14);
      gain2.gain.setValueAtTime(0.55, now + 0.14);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.14);
      osc2.stop(now + 0.85);
    }
  } catch (e) {
    console.error("Erreur WebAudio:", e);
  }

  try {
    if (!audioRef.current) audioRef.current = new Audio(NOTIF_SOUND);
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
  } catch (e) {}
};

// COMPRESSEUR D'IMAGE CÔTÉ CLIENT (JPEG 800PX - RESPECTE LA LIMITE 1MB FIRESTORE)
const compresserImageProduit = (file, callback) => {
  if (!file) return;
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = (e) => {
    const img = document.createElement("img");
    img.src = e.target.result;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const maxWidth = 800;
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
      callback(dataUrl);
    };
  };
};

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, errorMsg: '' }; }
  static getDerivedStateFromError(error) { return { hasError: true, errorMsg: error.toString() }; }
  componentDidCatch(error, errorInfo) { console.error("Crash intercepté:", error, errorInfo); }
  render() {
    if (this.state.hasError) return (
      <div style={{ padding: '40px', background: '#FEF2F2', color: '#991B1B', minHeight: '100vh', fontFamily: 'sans-serif' }}>
        <h2 style={{ letterSpacing: '-0.02em' }}>Erreur système interceptée</h2>
        <div style={{ background: '#7F1D1D', color: 'white', padding: '20px', borderRadius: '12px', marginTop: '20px', fontFamily: 'monospace' }}>{this.state.errorMsg}</div>
        <button onClick={() => window.location.reload()} style={{ marginTop: '20px', padding: '12px 24px', background: '#991B1B', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Recharger l'application</button>
      </div>
    );
    return this.props.children;
  }
}

function FoodjiSystem() {
  const [authState, setAuthState] = useState("LOADING");
  const [appMode, setAppMode] = useState('ADMIN');

  // SYSTÈME DE TOASTS & MODALE DE CONFIRMATION
  const [toasts, setToasts] = useState([]);
  const [confirmModal, setConfirmModal] = useState({ active: false, title: '', message: '', confirmLabel: 'Confirmer', danger: false, onConfirm: null });

  const notify = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 2800);
  };

  const requestConfirm = (title, message, onConfirm, danger = false, confirmLabel = 'Confirmer') => {
    setConfirmModal({ active: true, title, message, confirmLabel, danger, onConfirm });
  };

  const [menu, setMenu] = useState([]);
  const [commandes, setCommandes] = useState([]);
  const [clientsDB, setClientsDB] = useState([]);
  const [promotions, setPromotions] = useState([]);

  // CONFIGURATION DYNAMIQUE SANS CODE (CAISSIÈRES & CATÉGORIES)
  const [caissieresList, setCaissieresList] = useState(CAISSIERES_DEFAUT);
  const [categoriesList, setCategoriesList] = useState(CATEGORIES_DEFAUT);
  const [showSystemConfig, setShowSystemConfig] = useState(false);
  const [newCaissiereInput, setNewCaissiereInput] = useState('');
  const [newCategoryInput, setNewCategoryInput] = useState('');

  const [parametres, setParametres] = useState({
    isOuvert: true,
    rushMode: 'standard',
    promoDuoActive: false,
    promoDimancheActive: false,
    promoTacosActive: true,
    stocks: { viandes: INIT_VIANDES, garnitures: INIT_GARNITURES_PIZZA, sauces: INIT_SAUCES, pates: INIT_PATES, tailles_pizza: INIT_TAILLES_PIZZA }
  });

  const [sessionCaisse, setSessionCaisse] = useState({ isActive: false, caissiere: '', startTime: null });
  const [serviceGlobal, setServiceGlobal] = useState({ lastZDate: null, fondsInitial: 0, fondsDeclare: false });

  const [adminCategorie, setAdminCategorie] = useState('Tacos');
  const [activeStockTab, setActiveStockTab] = useState('viandes');
  const [newItemName, setNewItemName] = useState('');
  const [editId, setEditId] = useState(null);
  const [formProd, setFormProd] = useState({ nom: '', description: '', image: '', categorie: 'Burgers', prixBase: '', variantes: [], excludeVIP: false });
  const [showHistory, setShowHistory] = useState(false);
  const [showPromoManager, setShowPromoManager] = useState(false);
  const [formPromo, setFormPromo] = useState({ titre: '', description: '', prix: '', status: true });

  const [posCart, setPosCart] = useState([]);
  const [posPhone, setPosPhone] = useState('');
  const [posNote, setPosNote] = useState('');
  const [posClientName, setPosClientName] = useState('');
  const [posCategory, setPosCategory] = useState('Tacos');
  const [posOrderType, setPosOrderType] = useState('sur_place');
  const [posAddress, setPosAddress] = useState('');
  const [posBipeur, setPosBipeur] = useState('');
  const [remiseGlobale, setRemiseGlobale] = useState(0);
  const [clientActif, setClientActif] = useState(null);

  const [orderToPrint, setOrderToPrint] = useState(null);
  const [numpad, setNumpad] = useState({ active: false, mode: '', targetId: null, label: '', value: '', motif: '' });
  const [showBilanGlobal, setShowBilanGlobal] = useState(false);
  const [showRenduMonnaie, setShowRenduMonnaie] = useState({ active: false, aRendre: 0, received: 0 });
  const [showCashOptions, setShowCashOptions] = useState(false);
  const [showFondsCaissePrompt, setShowFondsCaissePrompt] = useState({ active: false, caissiere: '' });
  const [fondsInitialInput, setFondsInitialInput] = useState('');
  const [showDiviserAddition, setShowDiviserAddition] = useState(false);
  const [diviserPar, setDiviserPar] = useState(2);

  const [customizeItem, setCustomizeItem] = useState(null);
  const [customOptions, setCustomOptions] = useState({ garnitures: [], sauces: [], viandes: [], extras: [], cheesyCrust: false, typePate: '', accompagnements: [], exclusions: [] });

  const [promoTacosModal, setPromoTacosModal] = useState({
    active: false,
    taille: 'L',
    prixPack: 55,
    tacos1Viandes: [],
    tacos1Sauces: [],
    tacos1Extras: [],
    tacos2Viandes: [],
    tacos2Sauces: [],
    tacos2Extras: [],
    avecFritesBoisson: false
  });

  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientOrders, setNewClientOrders] = useState('');
  const [newClientRemise, setNewClientRemise] = useState('');
  const [newClientManualVIP, setNewClientManualVIP] = useState(true);

  // Références pour la détection infaillible des nouvelles commandes (même avec limit 150)
  const isInitialCmdLoad = useRef(true);
  const knownCmdIds = useRef(new Set());
  const audioRef = useRef(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let unsubscribeAuth = () => {};
    setPersistence(auth, browserLocalPersistence)
      .catch((err) => console.error("Erreur persistance Auth:", err))
      .finally(() => {
        unsubscribeAuth = onAuthStateChanged(auth, (user) => setAuthState(user ? user : null));
      });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!authState || authState === "LOADING") return;

    const unsubHoraires = onSnapshot(doc(db, "parametres", "horaires"), (s) => s.exists() && setParametres(prev => ({ ...prev, isOuvert: s.data().isOuvert })));
    const unsubStatus = onSnapshot(doc(db, "parametres", "status"), (s) => {
      if (s.exists()) {
        const data = s.data();
        setParametres(prev => ({
          ...prev,
          rushMode: data.mode || 'standard',
          promoDuoActive: data.promoDuoActive || false,
          promoDimancheActive: data.promoDimancheActive || false,
          promoTacosActive: data.promoTacosActive !== undefined ? data.promoTacosActive : true
        }));
      }
    });
    const unsubStocks = onSnapshot(doc(db, "parametres", "stocks"), (s) => {
      if (s.exists()) setParametres(prev => ({ ...prev, stocks: s.data() }));
      else setDoc(doc(db, "parametres", "stocks"), { viandes: INIT_VIANDES, garnitures: INIT_GARNITURES_PIZZA, sauces: INIT_SAUCES, pates: INIT_PATES, tailles_pizza: INIT_TAILLES_PIZZA });
    });
    const unsubSession = onSnapshot(doc(db, "parametres", "session_caisse"), (s) => {
      if (s.exists()) setSessionCaisse(s.data());
      else setDoc(doc(db, "parametres", "session_caisse"), { isActive: false, caissiere: '', startTime: null });
    });
    const unsubServiceGlobal = onSnapshot(doc(db, "parametres", "service_global"), (s) => {
      if (s.exists()) {
        const data = s.data();
        setServiceGlobal({ lastZDate: data.lastZDate, fondsInitial: data.fondsInitial || 0, fondsDeclare: data.fondsDeclare || false });
      } else {
        setDoc(doc(db, "parametres", "service_global"), { lastZDate: new Date(), fondsInitial: 0, fondsDeclare: false });
      }
    });

    // Écouteur de la configuration dynamique (Caissières & Catégories modifiables sans code)
    const unsubConfig = onSnapshot(doc(db, "parametres", "config"), (s) => {
      if (s.exists()) {
        const data = s.data();
        if (Array.isArray(data.caissieres) && data.caissieres.length > 0) setCaissieresList(data.caissieres);
        if (Array.isArray(data.categories) && data.categories.length > 0) setCategoriesList(data.categories);
      } else {
        setDoc(doc(db, "parametres", "config"), { caissieres: CAISSIERES_DEFAUT, categories: CATEGORIES_DEFAUT });
      }
    });

    const unsubMenu = onSnapshot(collection(db, "produits"), (snap) => setMenu(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubPromos = onSnapshot(collection(db, "promotions"), (snap) => setPromotions(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubClients = onSnapshot(collection(db, "clients"), (snap) => setClientsDB(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    // Détection infaillible des nouvelles commandes entrantes par ID (fonctionne même quand la limite de 150 est atteinte)
    const qCmd = query(collection(db, "commandes"), orderBy("date", "desc"), limit(150));
    const unsubCmd = onSnapshot(qCmd, (snap) => {
      try {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));

        if (isInitialCmdLoad.current) {
          list.forEach(c => knownCmdIds.current.add(c.id));
          isInitialCmdLoad.current = false;
        } else {
          let hasNewOrder = false;
          list.forEach(c => {
            if (!knownCmdIds.current.has(c.id)) {
              knownCmdIds.current.add(c.id);
              if (c.type !== 'depense') hasNewOrder = true;
            }
          });
          if (hasNewOrder) {
            declencherSonNotification(audioRef);
            notify("Nouvelle commande reçue !", "success");
          }
        }
        setCommandes(list);
      } catch (e) { console.error("Erreur tri commandes:", e); }
    });

    return () => { unsubStatus(); unsubHoraires(); unsubStocks(); unsubSession(); unsubServiceGlobal(); unsubConfig(); unsubMenu(); unsubPromos(); unsubClients(); unsubCmd(); };
  }, [authState]);

  useEffect(() => {
    setPosCart(prevCart => prevCart.map(item => {
      if (item.nom.includes("Pep's") && !item.isPrixModifie) {
        const newBasePrice = (posOrderType === 'emporter' || posOrderType === 'livraison') ? 33 : 28;
        return { ...item, prixFinal: newBasePrice + (item.extraPrice || 0) };
      }
      return item;
    }));
  }, [posOrderType]);

  // Synchronise clientActif si clientsDB est modifié en temps réel
  useEffect(() => {
    if (posPhone.replace(/\s+/g, '').length >= 9) {
      const clean = posPhone.replace(/\s+/g, '');
      const found = clientsDB.find(c => (c.tel || '').replace(/\s+/g, '') === clean);
      setClientActif(found || null);
    }
  }, [clientsDB, posPhone]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      notify(`Identifiants incorrects (${err.code})`, 'error');
    }
    setLoading(false);
  };

  // GESTION DYNAMIQUE DES CAISSIÈRES ET DES CATÉGORIES (SANS CODE)
  const ajouterCaissiereConfig = async () => {
    const nomClean = newCaissiereInput.trim();
    if (!nomClean) return;
    if (caissieresList.includes(nomClean)) return notify("Cette caissière figure déjà dans la liste", "error");
    const updated = [...caissieresList, nomClean];
    await setDoc(doc(db, "parametres", "config"), { caissieres: updated, categories: categoriesList }, { merge: true });
    setNewCaissiereInput('');
    notify(`Opérateur "${nomClean}" ajouté`, "success");
  };

  const supprimerCaissiereConfig = (nomC) => {
    if (caissieresList.length <= 1) return notify("Il doit rester au moins un opérateur", "error");
    requestConfirm(
      "Retirer l'opérateur",
      `Voulez-vous retirer "${nomC}" de la liste d'ouverture de caisse ?`,
      async () => {
        const updated = caissieresList.filter(c => c !== nomC);
        await setDoc(doc(db, "parametres", "config"), { caissieres: updated, categories: categoriesList }, { merge: true });
        notify(`Opérateur "${nomC}" retiré`, "info");
      },
      true,
      "Retirer"
    );
  };

  const ajouterCategorieConfig = async () => {
    const catClean = newCategoryInput.trim();
    if (!catClean) return;
    if (categoriesList.includes(catClean)) return notify("Cette catégorie existe déjà", "error");
    const updated = [...categoriesList, catClean];
    await setDoc(doc(db, "parametres", "config"), { caissieres: caissieresList, categories: updated }, { merge: true });
    setNewCategoryInput('');
    notify(`Catégorie "${catClean}" ajoutée`, "success");
  };

  const supprimerCategorieConfig = (catName) => {
    requestConfirm(
      "Supprimer la catégorie",
      `Voulez-vous retirer l'onglet de catégorie "${catName}" de l'interface ?`,
      async () => {
        const updated = categoriesList.filter(c => c !== catName);
        await setDoc(doc(db, "parametres", "config"), { caissieres: caissieresList, categories: updated }, { merge: true });
        notify(`Catégorie "${catName}" supprimée`, "info");
      },
      true,
      "Supprimer"
    );
  };

  const toggleAvailability = async (item) => {
    await updateDoc(doc(db, "produits", item.id), { available: !item.available });
    notify(`${item.nom} : ${!item.available ? 'En ligne' : 'Mis en rupture'}`, !item.available ? 'success' : 'info');
  };

  const supprimerProduit = (id, nomProd) => {
    requestConfirm(
      "Supprimer le produit",
      `Voulez-vous supprimer définitivement "${nomProd || 'ce produit'}" du catalogue ?`,
      async () => {
        await deleteDoc(doc(db, "produits", id));
        notify("Produit supprimé du catalogue", "info");
      },
      true,
      "Supprimer"
    );
  };

  const handleDirectProductImageUpload = (prodId, file) => {
    compresserImageProduit(file, async (base64Img) => {
      await updateDoc(doc(db, "produits", prodId), { image: base64Img });
      notify("Photo du produit enregistrée", "success");
    });
  };

  const toggleStockItem = async (listName, index) => {
    const newList = [...(parametres.stocks[listName] || [])];
    newList[index].available = !newList[index].available;
    await updateDoc(doc(db, "parametres", "stocks"), { ...parametres.stocks, [listName]: newList });
    notify(`${newList[index].nom} : ${newList[index].available ? 'Disponible' : 'Rupture'}`, newList[index].available ? 'success' : 'info');
  };

  const addNewStockItem = async () => {
    if (!newItemName.trim()) return;
    const newList = [...(parametres.stocks[activeStockTab] || []), { nom: newItemName.trim(), available: true }];
    await updateDoc(doc(db, "parametres", "stocks"), { ...parametres.stocks, [activeStockTab]: newList });
    notify(`${newItemName.trim()} ajouté au stock`, 'success');
    setNewItemName('');
  };

  const handleRuptureRapide = async (e) => {
    const value = e.target.value;
    if (!value) return;
    const [listName, nomItem] = value.split('|');
    const index = (parametres.stocks[listName] || []).findIndex(item => item.nom === nomItem);
    if (index > -1) {
      const newList = [...parametres.stocks[listName]];
      newList[index].available = false;
      await updateDoc(doc(db, "parametres", "stocks"), { ...parametres.stocks, [listName]: newList });
      notify(`${nomItem} mis en rupture de stock`, 'error');
    }
    e.target.value = "";
  };

  const savePromotion = async () => {
    if (!formPromo.titre || !formPromo.prix) return notify("Veuillez renseigner le titre et le prix du deal", "error");
    await addDoc(collection(db, "promotions"), { titre: formPromo.titre.trim(), description: formPromo.description.trim(), prix: Number(formPromo.prix), status: formPromo.status, date: new Date() });
    setFormPromo({ titre: '', description: '', prix: '', status: true });
    notify("Offre promotionnelle publiée", "success");
  };

  const togglePromoStatus = async (id, currentStatus) => await updateDoc(doc(db, "promotions", id), { status: !currentStatus });
  const togglePromoDuoAdmin = async () => await updateDoc(doc(db, "parametres", "status"), { promoDuoActive: !parametres.promoDuoActive });
  const togglePromoDimancheAdmin = async () => await updateDoc(doc(db, "parametres", "status"), { promoDimancheActive: !parametres.promoDimancheActive });
  const togglePromoTacosAdmin = async () => await updateDoc(doc(db, "parametres", "status"), { promoTacosActive: !parametres.promoTacosActive });

  // CRÉDIT FIDÉLITÉ INTELLIGENT : MISE À JOUR DU NOM + GESTION EXPIRATION 30 JOURS
  const crediterPointsFidelite = async (telRaw, nomClient) => {
    if (!telRaw || telRaw.trim().length < 9) return;
    const telClean = telRaw.replace(/\s+/g, '');
    const nomPropre = (nomClient || '').trim();
    const isValidNewName = nomPropre.length > 1 && !['non spécifié', 'client', 'inconnu', 'client web', 'client livraison'].includes(nomPropre.toLowerCase());

    const exist = clientsDB.find(c => (c.tel || '').replace(/\s+/g, '') === telClean);
    if (exist) {
      const statut = evaluerStatutVIP(exist);
      // Si le client n'est pas un VIP Fixe manuel et n'a pas commandé depuis plus de 30 jours, son compteur repart à 1
      const nouveauTotal = (!exist.isManualVIP && statut.isExpired) ? 1 : ((Number(exist.totalCommandes) || 0) + 1);
      const updatedFields = {
        totalCommandes: nouveauTotal,
        lastOrder: new Date()
      };
      // Si un vrai nom est renseigné en caisse, on écrase "Non spécifié" / "Client" ou on met à jour le nom
      if (isValidNewName) {
        updatedFields.nom = nomPropre;
      }
      if (!exist.isManualVIP && statut.isExpired) {
        updatedFields.remiseAuto = 0;
      }
      await updateDoc(doc(db, "clients", exist.id), updatedFields);
    } else {
      await addDoc(collection(db, "clients"), {
        tel: telClean,
        nom: isValidNewName ? nomPropre : "Non spécifié",
        totalCommandes: 1,
        remiseAuto: 0,
        isManualVIP: false,
        lastOrder: new Date()
      });
    }
  };

  // RETRAIT DU POINT DE FIDÉLITÉ LORSQU'UNE COMMANDE TERMINÉE EST ANNULÉE
  const retirerPointFideliteAnnulation = async (telRaw) => {
    if (!telRaw || telRaw.trim().length < 9) return;
    const telClean = telRaw.replace(/\s+/g, '');
    const exist = clientsDB.find(c => (c.tel || '').replace(/\s+/g, '') === telClean);
    if (exist && (Number(exist.totalCommandes) || 0) > 0) {
      await updateDoc(doc(db, "clients", exist.id), {
        totalCommandes: Math.max(0, (Number(exist.totalCommandes) || 0) - 1)
      });
    }
  };

  const executerChangementStatus = async (cmd, st) => {
    const etaitTermine = cmd.status === 'Terminé';
    await updateDoc(doc(db, "commandes", cmd.id), { status: st });
    if (st === 'Terminé' && !etaitTermine) {
      await crediterPointsFidelite(cmd.tel, cmd.client || "Non spécifié");
    } else if (st === 'Annulé' && etaitTermine) {
      await retirerPointFideliteAnnulation(cmd.tel);
    }
    notify(`Commande #${(cmd.id || '').substring(0, 4).toUpperCase()} : ${st}`, st === 'Annulé' ? 'error' : 'success');
  };

  const changerStatus = (cmd, st) => {
    if (st === 'Annulé') {
      requestConfirm(
        "Annuler la commande",
        `Confirmez-vous l'annulation de la commande de ${cmd.total} DH (${cmd.client || 'Client'}) ? Le montant sera automatiquement déduit du bilan de caisse.`,
        () => executerChangementStatus(cmd, 'Annulé'),
        true,
        "Confirmer l'annulation"
      );
      return;
    }
    executerChangementStatus(cmd, st);
  };

  const encaisserRetourLivreur = (cmd) => {
    requestConfirm(
      "Encaissement retour livreur",
      `Confirmer la réception de ${cmd.total} DH en espèces pour la commande de ${cmd.client} ?`,
      async () => {
        await updateDoc(doc(db, "commandes", cmd.id), { status: 'Terminé', methodePaiement: 'Espèces' });
        await crediterPointsFidelite(cmd.tel, cmd.client || "Non spécifié");
        notify(`${cmd.total} DH encaissés en caisse`, 'success');
      },
      false,
      "Valider l'encaissement"
    );
  };

  const handleCategoryChange = (e) => {
    const cat = e.target.value;
    let vars = [];
    if (cat === 'Tacos') vars = [{ nom: 'M', prix: '', available: true }, { nom: 'L', prix: '', available: true }, { nom: 'XL', prix: '', available: true }, { nom: 'XXL', prix: '', available: true }];
    else if (cat === 'Pizzas') vars = [{ nom: 'M', prix: '', available: true }, { nom: 'L', prix: '', available: true }];
    setFormProd({ ...formProd, categorie: cat, variantes: vars, prixBase: '' });
  };

  const saveProduit = async () => {
    if (!formProd.nom.trim()) return notify("Veuillez donner un nom au produit", "error");
    setLoading(true);
    const data = {
      nom: formProd.nom.trim(),
      description: formProd.description.trim(),
      categorie: formProd.categorie,
      prix: formProd.variantes.length > 0 ? 0 : Number(formProd.prixBase),
      variantes: formProd.variantes,
      available: true,
      excludeVIP: formProd.excludeVIP || false,
      date: new Date()
    };
    if (formProd.image) data.image = formProd.image;
    if (editId) {
      await updateDoc(doc(db, "produits", editId), data);
      notify("Produit mis à jour", "success");
      setEditId(null);
    } else {
      await addDoc(collection(db, "produits"), data);
      notify("Produit ajouté à la carte", "success");
    }
    setFormProd({ nom: '', description: '', image: '', categorie: categoriesList[0] || 'Burgers', prixBase: '', variantes: [], excludeVIP: false });
    setLoading(false);
  };

  const ajouterClientManuel = async () => {
    const telClean = newClientPhone.replace(/\s+/g, '');
    if (telClean.length < 9) return notify("Numéro invalide (9 chiffres minimum)", "error");
    const exist = clientsDB.find(c => (c.tel || '').replace(/\s+/g, '') === telClean);
    if (exist) return notify("Ce numéro existe déjà dans la base CRM", "error");
    setLoading(true);
    try {
      await addDoc(collection(db, "clients"), {
        tel: telClean,
        nom: newClientName.trim() || "Non spécifié",
        totalCommandes: Number(newClientOrders) || 0,
        remiseAuto: Math.min(100, Math.max(0, Number(newClientRemise) || 0)),
        isManualVIP: newClientManualVIP,
        lastOrder: new Date()
      });
      setNewClientPhone(''); setNewClientName(''); setNewClientOrders(''); setNewClientRemise(''); setNewClientManualVIP(true);
      notify("Client enregistré dans le CRM", "success");
    } catch (e) { notify("Erreur lors de l'ajout du client", "error"); }
    setLoading(false);
  };

  const demanderOuvertureCaisse = async (nomCaissiere) => {
    const serviceDoc = await getDoc(doc(db, "parametres", "service_global"));
    const currentData = serviceDoc.exists() ? serviceDoc.data() : { fondsDeclare: false, fondsInitial: 0 };

    const now = new Date();
    let isSessionPerimee = false;

    if (currentData.lastZDate) {
      const zDate = toJSDate(currentData.lastZDate);
      const limiteAujourdhui = new Date(now);
      limiteAujourdhui.setHours(6, 0, 0, 0);
      if (now >= limiteAujourdhui && zDate < limiteAujourdhui) isSessionPerimee = true;
    } else {
      isSessionPerimee = true;
    }

    if (isSessionPerimee) {
      await updateDoc(doc(db, "parametres", "service_global"), { lastZDate: now, fondsDeclare: false, fondsInitial: 0 });
      await updateDoc(doc(db, "parametres", "session_caisse"), { isActive: false, caissiere: '', startTime: null });
      setShowFondsCaissePrompt({ active: true, caissiere: nomCaissiere });
      setFondsInitialInput('');
    } else if (currentData.fondsDeclare && currentData.fondsInitial >= 0) {
      await updateDoc(doc(db, "parametres", "session_caisse"), { isActive: true, caissiere: nomCaissiere, startTime: new Date() });
    } else {
      setShowFondsCaissePrompt({ active: true, caissiere: nomCaissiere });
      setFondsInitialInput('');
    }
  };

  const validerOuvertureCaisse = async () => {
    const fInitial = Math.max(0, Number(fondsInitialInput) || 0);
    await updateDoc(doc(db, "parametres", "service_global"), { ...serviceGlobal, fondsInitial: fInitial, fondsDeclare: true });
    await updateDoc(doc(db, "parametres", "session_caisse"), { isActive: true, caissiere: showFondsCaissePrompt.caissiere, startTime: new Date() });
    setShowFondsCaissePrompt({ active: false, caissiere: '' });
    notify(`Service ouvert par ${showFondsCaissePrompt.caissiere}`, 'success');
  };

  const calculerVentilationComptable = (listeCommandes, fondsInitial) => {
    let totalEspeces = 0, totalDépenses = 0, totalLivrApp = 0, totalEnLivraison = 0, nbCommandes = 0;
    listeCommandes.forEach(c => {
      const m = Number(c.total) || 0;
      if (c.status === 'En Livraison') {
        totalEnLivraison += m;
      } else if (c.status === 'Terminé') {
        nbCommandes++;
        if (c.type === 'depense') totalDépenses += Math.abs(m);
        else if (c.methodePaiement === 'Espèces') totalEspeces += m;
        else totalLivrApp += m;
      }
    });
    const f = Number(fondsInitial) || 0;
    return {
      fondsInitial: f,
      totalGeneral: (totalEspeces + totalLivrApp),
      totalEspeces,
      totalDépenses,
      totalLivrApp,
      totalEnLivraison,
      netEnCaisse: (f + totalEspeces - totalDépenses),
      nbCommandes
    };
  };

  const genererBilanShift = () => {
    if (!sessionCaisse.startTime) return null;
    const startT = toJSDate(sessionCaisse.startTime);
    const cmdsSession = commandes.filter(c => {
      const d = toJSDate(c.date);
      return d >= startT && (c.status === 'Terminé' || c.status === 'En Livraison') && c.caissiere === sessionCaisse.caissiere;
    });
    return { startT, ...calculerVentilationComptable(cmdsSession, serviceGlobal.fondsInitial) };
  };

  const cloturerShift = () => {
    const bilan = genererBilanShift();
    if (!bilan) return;
    const msg = bilan.totalEnLivraison > 0
      ? `Attention : ${bilan.totalEnLivraison} DH sont encore en cours chez les livreurs. Voulez-vous quand même clôturer le shift de ${sessionCaisse.caissiere} ?`
      : `Confirmer la clôture du shift et l'impression du ticket X pour ${sessionCaisse.caissiere} ?`;

    requestConfirm(
      "Clôture de Shift (X)",
      msg,
      () => {
        const xData = { isX: true, caissiere: sessionCaisse.caissiere, date: new Date(), ...bilan };
        setOrderToPrint(xData);
        setTimeout(async () => {
          window.print();
          await updateDoc(doc(db, "parametres", "session_caisse"), { isActive: false, caissiere: '', startTime: null });
          setTimeout(() => setOrderToPrint(null), 1000);
        }, 500);
      },
      bilan.totalEnLivraison > 0,
      "Imprimer X et fermer"
    );
  };

  const genererBilanGlobalZ = () => {
    let startT;
    if (serviceGlobal.lastZDate) {
      startT = toJSDate(serviceGlobal.lastZDate);
    } else {
      startT = new Date();
      startT.setHours(6, 0, 0, 0);
      if (new Date() < startT) startT.setDate(startT.getDate() - 1);
    }
    const cmdsZ = commandes.filter(c => {
      const d = toJSDate(c.date);
      return d >= startT && (c.status === 'Terminé' || c.status === 'En Livraison');
    });
    return { startT, ...calculerVentilationComptable(cmdsZ, serviceGlobal.fondsInitial) };
  };

  const cloturerZDefinitif = () => {
    const bilan = genererBilanGlobalZ();
    if (!bilan) return;
    if (bilan.totalEnLivraison > 0) {
      notify(`Impossible de clôturer le Z : ${bilan.totalEnLivraison} DH sont encore chez les livreurs`, 'error');
      return;
    }

    requestConfirm(
      "Clôture générale de journée (Z)",
      "Cette action va imprimer le bilan final Z, l'archiver et remettre tous les compteurs de caisse à zéro.",
      async () => {
        const now = new Date();
        const zData = { isZ: true, date: now, ...bilan };
        setOrderToPrint(zData);

        try {
          await addDoc(collection(db, "historique_z"), {
            dateCloture: now,
            startT: bilan.startT,
            fondsInitial: bilan.fondsInitial,
            totalEspeces: bilan.totalEspeces,
            totalDépenses: bilan.totalDépenses,
            totalLivrApp: bilan.totalLivrApp,
            totalGeneral: bilan.totalGeneral,
            netEnCaisse: bilan.netEnCaisse,
            nbCommandes: bilan.nbCommandes
          });
        } catch (e) { console.error("Erreur lors de l'archivage du Z :", e); }

        setTimeout(async () => {
          window.print();
          await updateDoc(doc(db, "parametres", "service_global"), { lastZDate: now, fondsInitial: 0, fondsDeclare: false });
          if (sessionCaisse.isActive) await updateDoc(doc(db, "parametres", "session_caisse"), { isActive: false, caissiere: '', startTime: null });
          setShowBilanGlobal(false);
          setTimeout(() => setOrderToPrint(null), 1000);
        }, 500);
      },
      true,
      "Archiver et remettre à zéro"
    );
  };

  const handlePhoneInput = (val) => {
    setPosPhone(val);
    const valTrim = val.replace(/\s+/g, '');
    if (valTrim.length >= 9) {
      const found = clientsDB.find(c => (c.tel || '').replace(/\s+/g, '') === valTrim);
      if (found) {
        const nomActuel = (found.nom || '').trim();
        const isGeneric = ['non spécifié', 'client', 'inconnu'].includes(nomActuel.toLowerCase());
        setPosClientName(isGeneric ? '' : nomActuel);
        setClientActif(found);
      } else {
        setClientActif(null);
      }
    } else {
      setClientActif(null);
    }
  };

  const triggerAddToCart = (produit, variante = null) => {
    if (['Tacos', 'Pizzas', 'Pâtes', 'Plats', 'Burgers'].includes(produit.categorie)) {
      setCustomizeItem({ produit, variante });
      setCustomOptions({ garnitures: [], sauces: [], viandes: [], extras: [], cheesyCrust: false, typePate: '', accompagnements: [], exclusions: [] });
    } else {
      addToCartFinal(produit, variante, { garnitures: [], sauces: [], viandes: [], extras: [], cheesyCrust: false, typePate: '', accompagnements: [], exclusions: [] });
    }
  };

  const toggleArrOption = (type, value) => {
    setCustomOptions(prev => {
      const arr = prev[type];
      return { ...prev, [type]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
    });
  };

  const openPromoTacosBuilder = (taille) => {
    setPromoTacosModal({
      active: true,
      taille,
      prixPack: taille === 'XL' ? 89 : 55,
      tacos1Viandes: [],
      tacos1Sauces: [],
      tacos1Extras: [],
      tacos2Viandes: [],
      tacos2Sauces: [],
      tacos2Extras: [],
      avecFritesBoisson: false
    });
  };

  const togglePromoTacosOption = (field, value, maxLimit = null) => {
    setPromoTacosModal(prev => {
      const arr = prev[field] || [];
      if (arr.includes(value)) {
        return { ...prev, [field]: arr.filter(v => v !== value) };
      }
      if (maxLimit && arr.length >= maxLimit) return prev;
      return { ...prev, [field]: [...arr, value] };
    });
  };

  const validerPackPromoTacos = () => {
    const maxV = promoTacosModal.taille === 'XL' ? 3 : 2;
    if (promoTacosModal.tacos1Viandes.length === 0 || promoTacosModal.tacos2Viandes.length === 0) {
      return notify(`Sélectionnez au moins 1 viande (max ${maxV}) pour chaque Tacos`, 'error');
    }

    let extraPrice = 0;
    let details = [];

    if (promoTacosModal.avecFritesBoisson) {
      extraPrice += 15;
      details.push("[OPTION +15DH] Avec Frites + Boisson 1L");
    } else {
      details.push("[SANS FRITES] Offre Promo 2 Tacos");
    }

    const t1Sauces = promoTacosModal.tacos1Sauces.length > 0 ? ` | Sauces: ${promoTacosModal.tacos1Sauces.join(', ')}` : '';
    details.push(`Tacos #1 (${promoTacosModal.taille}): ${promoTacosModal.tacos1Viandes.join(', ')}${t1Sauces}`);
    promoTacosModal.tacos1Extras.forEach(ext => {
      const p = TACOS_EXTRAS[ext] || 0;
      extraPrice += p;
      details.push(`  + [Tacos #1] ${ext} (+${p}DH)`);
    });

    const t2Sauces = promoTacosModal.tacos2Sauces.length > 0 ? ` | Sauces: ${promoTacosModal.tacos2Sauces.join(', ')}` : '';
    details.push(`Tacos #2 (${promoTacosModal.taille}): ${promoTacosModal.tacos2Viandes.join(', ')}${t2Sauces}`);
    promoTacosModal.tacos2Extras.forEach(ext => {
      const p = TACOS_EXTRAS[ext] || 0;
      extraPrice += p;
      details.push(`  + [Tacos #2] ${ext} (+${p}DH)`);
    });

    const finalPrice = promoTacosModal.prixPack + extraPrice;

    setPosCart(prev => [...prev, {
      id: `promo_tacos_${promoTacosModal.taille}`,
      categorie: 'PromoTacos',
      varianteNom: promoTacosModal.taille,
      nom: `[PROMO] 2 Tacos ${promoTacosModal.taille}${promoTacosModal.avecFritesBoisson ? ' + Frites & 1L' : ' (Sans Frites)'}`,
      extraPrice,
      prixFinal: finalPrice,
      isPrixModifie: false,
      isPromoPack: true,
      detailsTxt: details,
      excludeVIP: true,
      qte: 1,
      idCart: Date.now() + Math.random()
    }]);

    setPromoTacosModal(prev => ({ ...prev, active: false }));
  };

  const ajouterOptionFritesBoissonPromo = () => {
    setPosCart(prev => [...prev, {
      id: 'supplement_promo_tacos_menu',
      categorie: 'Suppléments',
      varianteNom: null,
      nom: 'Option Promo : Frites + Boisson 1L',
      extraPrice: 15,
      prixFinal: 15,
      isPrixModifie: false,
      isPromoPack: true,
      detailsTxt: ['[OPTION +15DH] Avec Frites + Boisson 1L pour Promo Tacos'],
      excludeVIP: true,
      qte: 1,
      idCart: Date.now() + Math.random()
    }]);
  };

  const validerEtAjouter = () => {
    const prod = customizeItem.produit; const vari = customizeItem.variante;
    if (prod.categorie === 'Tacos' && prod.nom.toLowerCase().includes('mixte')) {
      const maxViandes = vari?.nom === 'XXL' ? 4 : vari?.nom === 'XL' ? 3 : 2;
      if (customOptions.viandes.length !== maxViandes) return notify(`Sélectionnez exactement ${maxViandes} viandes`, 'error');
    }
    if (prod.categorie === 'Pâtes' && !customOptions.typePate) return notify("Choisissez un type de pâtes", "error");
    if (prod.categorie === 'Plats' && customOptions.accompagnements.length !== 2) return notify("Choisissez exactement 2 accompagnements", "error");
    addToCartFinal(prod, vari, customOptions);
  };

  const addToCartFinal = (produit, variante, options) => {
    let basePrice = Number(variante ? variante.prix : produit.prix) || 0;
    if (produit.nom.includes("Pep's")) basePrice = (posOrderType === 'emporter' || posOrderType === 'livraison') ? 33 : 28;
    let extraPrice = 0; let details = [];

    if (produit.categorie === 'Pâtes') details.push(`Type: ${options.typePate}`);
    if (produit.categorie === 'Plats') details.push(`Accompagnements: ${options.accompagnements.join(' et ')}`);
    if (produit.categorie === 'Burgers' && options.exclusions?.length > 0) options.exclusions.forEach(exc => details.push(`[SANS] ${exc}`));

    if (produit.categorie === 'Pizzas') {
      if (options.garnitures?.length > 0) details.push(`Garnitures: ${options.garnitures.join(', ')}`);
      if (options.cheesyCrust) {
        const crustPrice = variante?.nom === 'L' ? 25 : 15;
        extraPrice += crustPrice;
        details.push(`Cheesy Crust (+${crustPrice}DH)`);
      }
    }
    if (produit.categorie === 'Tacos') {
      if (options.viandes?.length > 0) details.push(`Viandes: ${options.viandes.join(', ')}`);
      if (options.sauces?.length > 0) details.push(`Sauces: ${options.sauces.join(', ')}`);
      options.extras?.forEach(ext => {
        const extPrice = TACOS_EXTRAS[ext] || 0;
        extraPrice += extPrice;
        details.push(`+ ${ext} (+${extPrice}DH)`);
      });
    }
    if (['Pizzas', 'Pâtes', 'Plats'].includes(produit.categorie)) {
      options.extras?.forEach(ext => {
        const isPizzaL = (produit.categorie === 'Pizzas' && variante?.nom === 'L');
        const extPrice = isPizzaL ? Math.round(EXTRAS_BASE[ext] * 1.7) : EXTRAS_BASE[ext];
        extraPrice += extPrice;
        details.push(`+ ${ext} (+${extPrice}DH)`);
      });
    }

    const finalPrice = basePrice + extraPrice;
    const nomComplet = variante ? `[${produit.categorie}] ${produit.nom} (${variante.nom})` : `[${produit.categorie}] ${produit.nom}`;

    setPosCart([...posCart, {
      ...produit,
      varianteNom: variante ? variante.nom : null,
      categorie: produit.categorie,
      nom: nomComplet,
      extraPrice: extraPrice,
      prixFinal: finalPrice,
      isPrixModifie: false,
      detailsTxt: details,
      excludeVIP: produit.excludeVIP || false,
      qte: 1,
      idCart: Date.now() + Math.random()
    }]);
    setCustomizeItem(null);
  };

  const modifierQuantite = (idCart, delta) => {
    setPosCart(posCart.map(item => item.idCart === idCart ? { ...item, qte: item.qte + delta } : item).filter(item => item.qte > 0));
  };

  const removeFromCart = (idCart) => setPosCart(posCart.filter(item => item.idCart !== idCart));

  // CALCULS PANIER & MOTEURS PROMOS POS
  const sousTotalCart = posCart.reduce((sum, item) => sum + (Number(item.prixFinal) * item.qte), 0);
  const sousTotalEligibleVIP = posCart.reduce((sum, item) => sum + (item.excludeVIP ? 0 : (Number(item.prixFinal) * item.qte)), 0);
  const fraisLivraison = (posOrderType === 'livraison' && sousTotalCart > 0 && sousTotalCart < 45) ? 7 : 0;

  let promoDimancheDiscount = 0;
  let promoDuoDiscount = 0;
  let promoTacosDiscount = 0;

  if (parametres.promoDimancheActive) {
    let pizzasDimanchePrices = [];
    posCart.forEach(item => {
      const vNom = (item.varianteNom || '').trim().toUpperCase();
      const isMoyenne = vNom !== 'L';
      const isExcluded = PIZZAS_EXCLUES_PROMO.some(ex => item.nom.toLowerCase().includes(ex));
      if (item.categorie === 'Pizzas' && isMoyenne && !isExcluded && !item.isPrixModifie) {
        const basePizzaPrice = Math.max(0, Number(item.prixFinal) - (Number(item.extraPrice) || 0));
        for (let i = 0; i < item.qte; i++) pizzasDimanchePrices.push(basePizzaPrice);
      }
    });
    if (pizzasDimanchePrices.length >= 3) {
      pizzasDimanchePrices.sort((a, b) => a - b);
      const itemsToDiscount = Math.floor(pizzasDimanchePrices.length / 3);
      for (let i = 0; i < itemsToDiscount; i++) promoDimancheDiscount += pizzasDimanchePrices[i];
    }
  }

  if (parametres.promoTacosActive) {
    let tacosLBasePrices = [];
    let tacosXLBasePrices = [];
    posCart.forEach(item => {
      if (item.categorie === 'Tacos' && !item.isPrixModifie && !item.isPromoPack) {
        const vNom = (item.varianteNom || '').trim().toUpperCase();
        const baseTacosPrice = Math.max(0, Number(item.prixFinal) - (Number(item.extraPrice) || 0));
        if (vNom === 'L') {
          for (let i = 0; i < item.qte; i++) tacosLBasePrices.push(baseTacosPrice);
        } else if (vNom === 'XL') {
          for (let i = 0; i < item.qte; i++) tacosXLBasePrices.push(baseTacosPrice);
        }
      }
    });

    tacosLBasePrices.sort((a, b) => a - b);
    for (let i = 0; i + 1 < tacosLBasePrices.length; i += 2) {
      const pairSum = tacosLBasePrices[i] + tacosLBasePrices[i + 1];
      if (pairSum > 55) promoTacosDiscount += (pairSum - 55);
    }

    tacosXLBasePrices.sort((a, b) => a - b);
    for (let i = 0; i + 1 < tacosXLBasePrices.length; i += 2) {
      const pairSum = tacosXLBasePrices[i] + tacosXLBasePrices[i + 1];
      if (pairSum > 89) promoTacosDiscount += (pairSum - 89);
    }
  }

  if (parametres.promoDuoActive) {
    let eligiblePrices = [];
    posCart.forEach(item => {
      const isSalade = item.categorie === 'Salades';
      const isPeps = item.nom.toLowerCase().includes("pep's");
      const vNom = item.varianteNom || '';
      const isTacosLarge = item.categorie === 'Tacos' && (vNom === 'L' || vNom === 'XL' || vNom === 'XXL');
      const isPizzaM = item.categorie === 'Pizzas' && (vNom === 'M' || vNom === 'Standard');

      if (!isSalade && !item.isPrixModifie && !item.isPromoPack && !isPeps && !isTacosLarge && !isPizzaM) {
        for (let i = 0; i < item.qte; i++) eligiblePrices.push(Number(item.prixFinal));
      }
    });
    eligiblePrices.sort((a, b) => a - b);
    const itemsToDiscount = Math.floor(eligiblePrices.length / 2);
    for (let i = 0; i < itemsToDiscount; i++) promoDuoDiscount += (eligiblePrices[i] * 0.5);
    promoDuoDiscount = Math.round(promoDuoDiscount);
  }

  const montantRemiseGlobale = Math.round(sousTotalCart * ((Number(remiseGlobale) || 0) / 100));

  // Vérification de non-expiration (30 jours) avant d'appliquer la remise CRM
  const statutClientActif = evaluerStatutVIP(clientActif);
  const remiseCRM = (clientActif && clientActif.remiseAuto && !statutClientActif.isExpired)
    ? Math.round(sousTotalEligibleVIP * (clientActif.remiseAuto / 100))
    : 0;

  const totalRemises = montantRemiseGlobale + remiseCRM + promoDuoDiscount + promoDimancheDiscount + promoTacosDiscount;
  const totalCart = Math.max(0, sousTotalCart + fraisLivraison - totalRemises);

  const openNumpad = (mode, label, targetId = null) => setNumpad({ active: true, mode, label, targetId, value: '', motif: '' });
  const handleNumpadKey = (val) => {
    if (val === 'DEL') setNumpad({ ...numpad, value: numpad.value.slice(0, -1) });
    else if (val === 'OK') applyNumpadValue();
    else setNumpad({ ...numpad, value: numpad.value + val });
  };

  const applyNumpadValue = async () => {
    const valNum = Number(numpad.value) || 0;
    if (numpad.mode === 'remise_globale') {
      if (valNum > 100) return notify("La remise ne peut pas dépasser 100%", "error");
      setRemiseGlobale(valNum);
    } else if (numpad.mode === 'prix_article') {
      setPosCart(posCart.map(it => it.idCart === numpad.targetId ? { ...it, prixFinal: valNum, isPrixModifie: true } : it));
    } else if (numpad.mode === 'encaissement_especes') {
      if (valNum < totalCart) return notify("Le montant reçu est inférieur au total à payer", "error");
      setNumpad({ active: false, mode: '', targetId: null, label: '', value: '', motif: '' });
      setShowRenduMonnaie({ active: true, aRendre: valNum - totalCart, received: valNum });
      return;
    } else if (numpad.mode === 'depense') {
      if (valNum <= 0) return notify("Veuillez saisir un montant supérieur à 0 DH", "error");
      if (!numpad.motif || !numpad.motif.trim()) return notify("Veuillez saisir le motif du décaissement", "error");
      setLoading(true);
      const newDepense = {
        client: "DÉCAISSEMENT",
        caissiere: sessionCaisse.caissiere || "Manager",
        type: "depense",
        commentaire: numpad.motif.trim(),
        items: [{ nom: `Dépense: ${numpad.motif.trim()}`, prixFinal: -valNum, qte: 1 }],
        total: -valNum,
        status: "Terminé",
        methodePaiement: "Espèces",
        date: new Date()
      };
      const docRef = await addDoc(collection(db, "commandes"), newDepense);
      knownCmdIds.current.add(docRef.id);
      newDepense.id = docRef.id;
      newDepense.isDepense = true;
      setOrderToPrint(newDepense);
      setTimeout(() => { window.print(); setTimeout(() => setOrderToPrint(null), 1000); }, 500);
      notify(`Décaissement de ${valNum} DH enregistré`, 'info');
      setLoading(false);
    }
    setNumpad({ active: false, mode: '', targetId: null, label: '', value: '', motif: '' });
  };

  const executerValidationCommandePOS = async (methodePaiement, especeRecue = null, forceStatus = "Terminé") => {
    setLoading(true);
    const finalClientName = posClientName.trim() ? posClientName.trim() : (clientActif?.nom || "Non spécifié");

    const hasOptionFritesBoisson = posCart.some(it => it.id === 'supplement_promo_tacos_menu');
    const itemsFinal = posCart.map(it => {
      if (promoTacosDiscount > 0 && it.categorie === 'Tacos' && (it.varianteNom === 'L' || it.varianteNom === 'XL') && !it.isPromoPack) {
        const mentionFrites = hasOptionFritesBoisson ? '[OPTION +15DH] Avec Frites + Boisson 1L' : '[SANS FRITES] Offre Promo Tacos';
        const existingDetails = it.detailsTxt || [];
        if (!existingDetails.includes(mentionFrites)) {
          return { ...it, detailsTxt: [mentionFrites, ...existingDetails] };
        }
      }
      return it;
    });

    const newCmd = {
      client: finalClientName,
      caissiere: sessionCaisse.caissiere || "Inconnu",
      tel: posPhone.trim() ? posPhone.trim() : "",
      adresse: posAddress.trim(),
      bipeur: posBipeur,
      type: posOrderType,
      commentaire: posNote.trim(),
      items: itemsFinal,
      sousTotal: sousTotalCart,
      fraisLivraison: fraisLivraison,
      remiseGlobalePct: remiseGlobale,
      remisePromoDuo: promoDuoDiscount,
      remisePromoDimanche: promoDimancheDiscount,
      remisePromoTacos: promoTacosDiscount,
      remise: totalRemises,
      total: totalCart,
      status: forceStatus,
      methodePaiement: methodePaiement,
      especeRecue: especeRecue,
      date: new Date()
    };

    try {
      const docRef = await addDoc(collection(db, "commandes"), newCmd);
      knownCmdIds.current.add(docRef.id);
      newCmd.id = docRef.id;

      if (forceStatus === 'Terminé') {
        await crediterPointsFidelite(posPhone, finalClientName);
      } else if (posPhone.trim().length >= 9 && posClientName.trim()) {
        // Même en départ livraison, si un nouveau prénom est tapé, on met à jour le nom du client
        const telClean = posPhone.replace(/\s+/g, '');
        const exist = clientsDB.find(c => (c.tel || '').replace(/\s+/g, '') === telClean);
        if (exist && posClientName.trim() !== exist.nom) {
          await updateDoc(doc(db, "clients", exist.id), { nom: posClientName.trim() });
        }
      }

      setOrderToPrint(newCmd);
      setTimeout(() => { window.print(); setTimeout(() => setOrderToPrint(null), 1000); }, 500);

      setPosCart([]); setPosPhone(''); setPosNote(''); setPosClientName(''); setPosAddress(''); setPosBipeur(''); setPosOrderType('sur_place'); setRemiseGlobale(0); setClientActif(null); setShowRenduMonnaie({ active: false, aRendre: 0, received: 0 });
      notify("Commande validée et envoyée à l'impression", "success");
    } catch (e) { notify("Erreur lors de l'enregistrement de la commande", "error"); }
    setLoading(false);
  };

  const validerCommandePOS = (methodePaiement, especeRecue = null, forceStatus = "Terminé") => {
    if (posCart.length === 0) return notify("Le panier est vide", "error");
    if (posOrderType === 'livraison' && !posAddress.trim()) {
      requestConfirm(
        "Adresse de livraison manquante",
        "Aucune adresse de livraison n'est renseignée. Voulez-vous valider la commande quand même ?",
        () => executerValidationCommandePOS(methodePaiement, especeRecue, forceStatus),
        false,
        "Continuer sans adresse"
      );
      return;
    }
    executerValidationCommandePOS(methodePaiement, especeRecue, forceStatus);
  };

  const imprimerCommandeExistante = (cmd) => {
    setOrderToPrint(cmd);
    setTimeout(() => { window.print(); setTimeout(() => setOrderToPrint(null), 1000); }, 500);
  };

  const getDetaisImpression = (it) => {
    if (it.detailsTxt && it.detailsTxt.length > 0) return it.detailsTxt;
    let d = [];
    if (it.choixPates) d.push(`Type: ${it.choixPates}`);
    if (it.isCheesyCrust) d.push(`* CHEESY CRUST`);
    if (it.optionsChoisies?.length > 0) d.push(`Options: ${it.optionsChoisies.join(', ')}`);
    if (it.sauces?.length > 0) d.push(`Sauces: ${it.sauces.join(', ')}`);
    if (it.extras?.length > 0) { const extrasText = it.extras.map(e => e.nom ? e.nom : e).join(', '); d.push(`Extras: ${extrasText}`); }
    if (it.sans?.length > 0) it.sans.forEach(exc => d.push(`[SANS] ${exc}`));
    return d;
  };

  const commandesWebEnAttente = commandes.filter(c => c.status === 'En attente' || c.status === 'En cours de validation').length;
  const commandesEnLivraison = commandes.filter(c => c.status === 'En Livraison');

  const renderSystemOverlays = () => (
    <>
      <div className="no-print" style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} className="modal-box" style={{
            background: COLORS.secondary,
            color: '#FAFAFA',
            padding: '12px 16px',
            borderRadius: '12px',
            border: `1px solid ${t.type === 'error' ? COLORS.danger : t.type === 'success' ? COLORS.success : COLORS.darkBorder}`,
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.9rem',
            fontWeight: '600',
            pointerEvents: 'auto'
          }}>
            <StatusDot active={true} colorActive={t.type === 'error' ? COLORS.danger : t.type === 'success' ? COLORS.success : COLORS.blue} />
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {confirmModal.active && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(9, 9, 11, 0.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9500 }}>
          <div className="modal-box" style={{ background: 'white', padding: '28px', borderRadius: '16px', width: '90%', maxWidth: '420px', border: `1px solid ${COLORS.border}`, boxShadow: '0 20px 40px -15px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <Icon name="alert" size={20} color={confirmModal.danger ? COLORS.danger : COLORS.textMain} />
              <h3 style={{ margin: 0, fontSize: '1.15rem', letterSpacing: '-0.02em', color: COLORS.textMain }}>{confirmModal.title}</h3>
            </div>
            <p style={{ margin: '0 0 24px 0', color: COLORS.textMuted, fontSize: '0.95rem', lineHeight: 1.5 }}>{confirmModal.message}</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="pos-btn" onClick={() => setConfirmModal({ ...confirmModal, active: false })} style={{ padding: '10px 18px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, background: 'white', color: COLORS.textMain, fontWeight: '600', cursor: 'pointer' }}>Annuler</button>
              <button className="pos-btn" onClick={() => { const fn = confirmModal.onConfirm; setConfirmModal({ ...confirmModal, active: false }); if (fn) fn(); }} style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: confirmModal.danger ? COLORS.danger : COLORS.secondary, color: 'white', fontWeight: '600', cursor: 'pointer' }}>{confirmModal.confirmLabel}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (authState === "LOADING") return (
    <div style={{ background: COLORS.secondary, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
      <h3 style={{ letterSpacing: '-0.02em', fontWeight: '600' }}>Initialisation Foodji System...</h3>
    </div>
  );

  if (authState === null) return (
    <div style={{ background: COLORS.bg, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {renderSystemOverlays()}
      <form onSubmit={handleLogin} className="modal-box" style={{ background: 'white', padding: '36px', borderRadius: '16px', width: '360px', border: `1px solid ${COLORS.border}`, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <Icon name="store" size={22} color={COLORS.primary} />
          <h2 style={{ margin: 0, letterSpacing: '-0.03em', color: COLORS.textMain, fontSize: '1.4rem' }}>Foodji System</h2>
        </div>
        <input type="email" placeholder="Adresse email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '12px', border: `1px solid ${COLORS.border}`, borderRadius: '8px', boxSizing: 'border-box', fontSize: '0.95rem' }} />
        <input type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '20px', border: `1px solid ${COLORS.border}`, borderRadius: '8px', boxSizing: 'border-box', fontSize: '0.95rem' }} />
        <button type="submit" className="pos-btn" style={{ width: '100%', padding: '13px', background: COLORS.secondary, color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '0.95rem', cursor: 'pointer' }}>{loading ? 'Authentification...' : 'Se connecter'}</button>
      </form>
    </div>
  );

  const renderTickets = () => {
    if (!orderToPrint) return null;
    const PHONE_FOODJI = "05 37 53 66 89";

    if (orderToPrint.isZ || orderToPrint.isX) {
      const dCloture = toJSDate(orderToPrint.date);
      const dStart = toJSDate(orderToPrint.startT);
      const titre = orderToPrint.isX ? "X DE CAISSE (SHIFT)" : "Z DE CAISSE (JOURNÉE)";
      return (
        <div className="print-only">
          <div className="ticket-80mm">
            <h1 style={{ textAlign: 'center', fontSize: '24px', borderBottom: '2px solid black', paddingBottom: '10px' }}>{titre}</h1>
            <p style={{ textAlign: 'center' }}>Imprimé le {dCloture.toLocaleDateString()} à {dCloture.getHours().toString().padStart(2, '0')}:{dCloture.getMinutes().toString().padStart(2, '0')}</p>
            {orderToPrint.isX && <p style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '18px' }}>Caissière : {orderToPrint.caissiere}</p>}
            <hr style={{ borderTop: '2px dashed black', margin: '15px 0' }} />
            <p style={{ fontSize: '14px' }}>Depuis : {dStart.toLocaleDateString()} à {dStart.getHours().toString().padStart(2, '0')}:{dStart.getMinutes().toString().padStart(2, '0')}</p>
            <p style={{ fontSize: '14px' }}>Jusqu'à : {dCloture.toLocaleDateString()} à {dCloture.getHours().toString().padStart(2, '0')}:{dCloture.getMinutes().toString().padStart(2, '0')}</p>
            <p>Nb Commandes encaissées : {orderToPrint.nbCommandes}</p>
            <hr style={{ borderTop: '2px dashed black', margin: '15px 0' }} />
            <table style={{ width: '100%', fontSize: '16px' }}>
              <tbody>
                <tr><td>Total Espèces</td><td style={{ textAlign: 'right' }}>{orderToPrint.totalEspeces} DH</td></tr>
                <tr><td>Livr. Web/App</td><td style={{ textAlign: 'right' }}>{orderToPrint.totalLivrApp} DH</td></tr>
                {orderToPrint.totalEnLivraison > 0 && (
                  <tr><td>En cours Livreurs</td><td style={{ textAlign: 'right' }}>{orderToPrint.totalEnLivraison} DH</td></tr>
                )}
                <tr><td>Décaissements</td><td style={{ textAlign: 'right' }}>- {orderToPrint.totalDépenses} DH</td></tr>
              </tbody>
            </table>
            <hr style={{ borderTop: '2px solid black', margin: '15px 0' }} />
            <p style={{ textAlign: 'center', fontSize: '14px', marginBottom: '5px' }}>Fonds de Caisse Déclaré : {orderToPrint.fondsInitial} DH</p>
            <h2 style={{ fontSize: '22px', border: '2px solid black', padding: '10px', textAlign: 'center' }}>TIROIR ATTENDU : {orderToPrint.netEnCaisse} DH</h2>
            <p style={{ textAlign: 'center', marginTop: '40px' }}>Signature :</p>
            <div style={{ height: '60px', borderBottom: '1px dotted black', margin: '0 20px' }}></div>
          </div>
        </div>
      );
    }

    if (orderToPrint.isDepense) {
      const d = toJSDate(orderToPrint.date);
      return (
        <div className="print-only">
          <div className="ticket-80mm">
            <h1 style={{ textAlign: 'center', fontSize: '24px', borderBottom: '2px solid black', paddingBottom: '10px' }}>BON DE DÉCAISSEMENT</h1>
            <p style={{ textAlign: 'center' }}>Date : {d.toLocaleDateString()} à {d.getHours().toString().padStart(2, '0')}:{d.getMinutes().toString().padStart(2, '0')}</p>
            <p style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '18px' }}>Caisse : {orderToPrint.caissiere}</p>
            <hr style={{ borderTop: '2px dashed black', margin: '15px 0' }} />
            <h2 style={{ fontSize: '18px' }}>Motif : {orderToPrint.commentaire}</h2>
            <h2 style={{ fontSize: '24px', textAlign: 'center', border: '2px solid black', padding: '10px' }}>SORTIE : {Math.abs(orderToPrint.total)} DH</h2>
            <p style={{ textAlign: 'center', marginTop: '40px' }}>Signature :</p>
            <div style={{ height: '60px', borderBottom: '1px dotted black', margin: '0 20px' }}></div>
          </div>
        </div>
      );
    }

    const d = toJSDate(orderToPrint.date);
    const heure = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    let typeLabel = "SUR PLACE";
    if (orderToPrint.type === 'emporter') typeLabel = "À EMPORTER";
    if (orderToPrint.type === 'livraison') typeLabel = "LIVRAISON";
    const paiementStatus = orderToPrint.methodePaiement || (orderToPrint.type === 'livraison' ? 'À régler à la livraison' : 'En ligne / Non spécifié');
    const shortId = (orderToPrint.id || '0000').substring(0, 4).toUpperCase();

    return (
      <div className="print-only">
        <div className="ticket-80mm">
          <h1 style={{ textAlign: 'center', fontSize: '24px', borderBottom: '2px solid black', paddingBottom: '10px', margin: '0 0 10px 0' }}>CUISINE - #{shortId}</h1>
          <p style={{ textAlign: 'center', fontSize: '22px', fontWeight: 'bold', margin: '5px 0', border: '2px solid black', padding: '5px' }}>{typeLabel}</p>

          {orderToPrint.bipeur && (
            <div style={{ textAlign: 'center', border: '3px dashed black', padding: '10px', margin: '10px 0' }}>
              <div style={{ fontSize: '18px' }}>BIPEUR</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{orderToPrint.bipeur}</div>
            </div>
          )}

          <p style={{ textAlign: 'center', margin: '5px 0' }}>{d.toLocaleDateString()} - {heure}</p>
          {orderToPrint.commentaire && <div style={{ border: '2px dashed black', padding: '10px', margin: '10px 0', fontWeight: 'bold', fontSize: '18px' }}>NOTE: {orderToPrint.commentaire}</div>}

          <ul style={{ listStyle: 'none', padding: 0, marginTop: '20px', margin: 0 }}>
            {(orderToPrint.items || []).map((it, i) => {
              const details = getDetaisImpression(it);
              return (
                <li key={i} style={{ fontSize: '16px', fontWeight: 'bold', borderBottom: '1px dotted black', padding: '10px 0' }}>
                  <div>{it.qte > 1 ? `${it.qte}x ` : ''}{it.nom}</div>
                  {details.length > 0 && (
                    <div style={{ fontSize: '14px', marginLeft: '10px', fontWeight: 'normal' }}>
                      {details.map((dt, j) => <div key={j} style={{ fontWeight: (dt.includes('[SANS') || dt.includes('[OPTION')) ? 'bold' : 'normal' }}>• {dt}</div>)}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="page-break"></div>

        <div className="ticket-80mm">
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <img src="/logo.png" alt="FOODJI" style={{ width: '100%', maxWidth: '150px', filter: 'grayscale(100%) contrast(1000%)' }} />
          </div>
          <p style={{ textAlign: 'center', fontSize: '14px', margin: '2px 0' }}>Sala Al Jadida</p>
          <p style={{ textAlign: 'center', fontSize: '16px', margin: '2px 0', fontWeight: 'bold' }}>Tél: {PHONE_FOODJI}</p>
          <hr style={{ borderTop: '2px dashed black', margin: '10px 0' }} />
          <p style={{ textAlign: 'center', fontSize: '18px', fontWeight: 'bold', margin: '5px 0' }}>{typeLabel}</p>

          {orderToPrint.bipeur && (
            <div style={{ textAlign: 'center', border: '2px solid black', padding: '5px', margin: '10px 0' }}>
              <div style={{ fontSize: '14px' }}>BIPEUR NUMÉRO</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{orderToPrint.bipeur}</div>
            </div>
          )}

          <p style={{ margin: '2px 0', fontSize: '12px' }}>Date: {d.toLocaleDateString()} {heure}</p>
          <p style={{ margin: '2px 0', fontSize: '12px' }}>Caisse: {orderToPrint.caissiere || 'Inconnu'}</p>

          {orderToPrint.client && orderToPrint.client !== "Non spécifié" && <p style={{ margin: '2px 0', fontWeight: 'bold', fontSize: '16px' }}>Client: {orderToPrint.client}</p>}
          {orderToPrint.tel && <p style={{ margin: '5px 0', fontWeight: 'bold', fontSize: '18px' }}>Tél: {orderToPrint.tel}</p>}
          {orderToPrint.type === 'livraison' && orderToPrint.adresse && <p style={{ margin: '2px 0', fontWeight: 'bold' }}>Adr: {orderToPrint.adresse}</p>}

          {orderToPrint.commentaire && (
            <div style={{ border: '1px dashed black', padding: '5px', margin: '10px 0', fontSize: '14px', fontWeight: 'bold' }}>
              Note: {orderToPrint.commentaire}
            </div>
          )}

          <hr style={{ borderTop: '2px dashed black', margin: '10px 0' }} />

          <table style={{ width: '100%', fontSize: '14px', marginBottom: '20px' }}>
            <tbody>
              {(orderToPrint.items || []).map((it, i) => {
                const details = getDetaisImpression(it);
                return (
                  <React.Fragment key={i}>
                    <tr>
                      <td style={{ paddingTop: '5px' }}><strong>{it.qte > 1 ? `${it.qte}x ` : ''}{it.nom}</strong></td>
                      <td style={{ textAlign: 'right', paddingTop: '5px' }}><strong>{it.prixFinal * (it.qte || 1)} DH</strong></td>
                    </tr>
                    {(details.length > 0 || it.isPrixModifie) && (
                      <tr>
                        <td colSpan="2" style={{ fontSize: '12px', paddingLeft: '10px', paddingBottom: '5px', color: '#333' }}>
                          {details.join(' / ')}
                          {it.isPrixModifie && <span style={{ display: 'block', color: 'red' }}>*Prix manuel appliqué</span>}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          {orderToPrint.fraisLivraison > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '5px' }}>
              <span>Frais de livraison</span><span>{orderToPrint.fraisLivraison} DH</span>
            </div>
          )}

          {orderToPrint.remisePromoDimanche > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '5px', fontWeight: 'bold' }}>
              <span>PROMO DIMANCHE (3ème Offert)</span><span>- {orderToPrint.remisePromoDimanche} DH</span>
            </div>
          )}

          {orderToPrint.remisePromoTacos > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '5px', fontWeight: 'bold' }}>
              <span>PROMO TACOS (2L=55 / 2XL=89)</span><span>- {orderToPrint.remisePromoTacos} DH</span>
            </div>
          )}

          {orderToPrint.remisePromoDuo > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '5px', fontWeight: 'bold' }}>
              <span>PROMO DUO (-50%)</span><span>- {orderToPrint.remisePromoDuo} DH</span>
            </div>
          )}

          {orderToPrint.remise > 0 && (
            <div style={{ textAlign: 'right', fontSize: '16px', borderTop: '1px dashed black', paddingTop: '5px' }}>Sous-total brut: {orderToPrint.sousTotal} DH<br /><strong>TOTAL REMISES: -{orderToPrint.remise} DH</strong></div>
          )}

          <hr style={{ borderTop: '2px dashed black', margin: '10px 0' }} />
          <h2 style={{ textAlign: 'right', fontSize: '24px', margin: '10px 0' }}>TOTAL: {orderToPrint.total} DH</h2>
          <p style={{ textAlign: 'right', fontSize: '14px', margin: '2px 0' }}>Paiement: {paiementStatus}</p>

          {orderToPrint.especeRecue && (
            <div style={{ border: '1px solid black', padding: '5px', marginTop: '10px', fontSize: '14px' }}>
              <div>Reçu : {orderToPrint.especeRecue} DH</div>
              <div style={{ fontWeight: 'bold' }}>Rendu : {orderToPrint.especeRecue - orderToPrint.total} DH</div>
            </div>
          )}

          <p style={{ textAlign: 'center', marginTop: '30px', fontWeight: 'bold', margin: '30px 0 0 0' }}>Merci de votre visite !</p>
        </div>
      </div>
    );
  };

  if (appMode === 'POS') {
    if (!sessionCaisse.isActive || !sessionCaisse.startTime || !serviceGlobal.fondsDeclare) {
      return (
        <div style={{ display: 'flex', height: '100vh', background: COLORS.secondary, alignItems: 'center', justifyContent: 'center', color: 'white', flexDirection: 'column' }}>
          {renderSystemOverlays()}
          <div style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#A1A1AA', marginBottom: '8px' }}>Terminal Point de Vente</div>
          <h1 style={{ fontSize: '2.4rem', margin: '0 0 32px 0', letterSpacing: '-0.04em' }}>Caisse Fermée</h1>

          {!showFondsCaissePrompt.active ? (
            <div className="modal-box" style={{ background: 'white', color: COLORS.textMain, padding: '32px', borderRadius: '16px', width: '380px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)' }}>
              <h2 style={{ marginTop: 0, letterSpacing: '-0.02em', fontSize: '1.3rem' }}>Ouvrir un service</h2>
              <p style={{ color: COLORS.textLight, fontSize: '0.95rem', marginBottom: '20px' }}>Sélectionnez l'opérateur responsable du tiroir :</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {caissieresList.map(nom => (
                  <button key={nom} className="pos-btn" onClick={() => demanderOuvertureCaisse(nom)} style={{ padding: '15px 18px', fontSize: '1.05rem', fontWeight: '600', borderRadius: '8px', border: `1px solid ${COLORS.border}`, background: COLORS.bg, cursor: 'pointer', color: COLORS.textMain, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{nom}</span>
                    <Icon name="user" size={16} color={COLORS.textLight} />
                  </button>
                ))}
              </div>
              <button className="pos-btn" onClick={() => setAppMode('ADMIN')} style={{ width: '100%', marginTop: '24px', padding: '10px', border: 'none', background: 'transparent', color: COLORS.textLight, cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Icon name="settings" size={15} /> Retour Administration
              </button>
            </div>
          ) : (
            <div className="modal-box" style={{ background: 'white', color: COLORS.textMain, padding: '32px', borderRadius: '16px', width: '380px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)' }}>
              <h2 style={{ marginTop: 0, letterSpacing: '-0.02em', fontSize: '1.3rem' }}>Fonds de Caisse Initial</h2>
              <p style={{ fontSize: '0.95rem', color: COLORS.textLight }}>Montant en espèces présent dans le tiroir pour <strong style={{ color: COLORS.textMain }}>{showFondsCaissePrompt.caissiere}</strong> :</p>
              <input type="number" className="num-tabular" placeholder="0 DH" value={fondsInitialInput} onChange={e => setFondsInitialInput(e.target.value)} style={{ width: '100%', padding: '14px', fontSize: '1.8rem', textAlign: 'center', border: `1px solid ${COLORS.borderStrong}`, borderRadius: '8px', marginBottom: '18px', boxSizing: 'border-box', fontWeight: 'bold' }} />
              <button className="pos-btn" onClick={validerOuvertureCaisse} style={{ width: '100%', padding: '14px', background: COLORS.secondary, color: 'white', fontWeight: '600', fontSize: '1rem', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>Valider l'ouverture</button>
              <button className="pos-btn" onClick={() => setShowFondsCaissePrompt({ active: false, caissiere: '' })} style={{ width: '100%', marginTop: '12px', padding: '10px', border: 'none', background: 'transparent', color: COLORS.textLight, cursor: 'pointer', fontWeight: '500' }}>Annuler</button>
            </div>
          )}
        </div>
      );
    }

    return (
      <>
        {renderTickets()}
        {renderSystemOverlays()}

        {/* MODALE CONFIGURATEUR PACK PROMO 2 TACOS */}
        {promoTacosModal.active && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(9, 9, 11, 0.78)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2500 }}>
            <div className="modal-box" style={{ background: 'white', width: '92%', maxWidth: '880px', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', maxHeight: '92vh', border: `1px solid ${COLORS.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${COLORS.border}`, paddingBottom: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ background: COLORS.secondary, color: 'white', fontSize: '0.75rem', fontWeight: '700', padding: '3px 8px', borderRadius: '6px', letterSpacing: '0.04em' }}>OFFRE PACK</span>
                    <h2 style={{ margin: 0, color: COLORS.textMain, letterSpacing: '-0.02em', fontSize: '1.35rem' }}>
                      2 Tacos {promoTacosModal.taille} — {promoTacosModal.prixPack} DH
                    </h2>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: COLORS.textLight, marginTop: '4px' }}>
                    Inclus par défaut : <strong style={{ color: COLORS.textMain }}>Les 2 Tacos sans frites</strong> • Supplément Menu Frites + Boisson 1L à +15 DH
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', background: COLORS.bg, padding: '4px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>
                  <button className="pos-btn num-tabular" onClick={() => setPromoTacosModal(p => ({ ...p, taille: 'L', prixPack: 55, tacos1Viandes: [], tacos2Viandes: [] }))} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', fontWeight: '600', cursor: 'pointer', background: promoTacosModal.taille === 'L' ? COLORS.secondary : 'transparent', color: promoTacosModal.taille === 'L' ? 'white' : COLORS.textMuted }}>2x L (55 DH)</button>
                  <button className="pos-btn num-tabular" onClick={() => setPromoTacosModal(p => ({ ...p, taille: 'XL', prixPack: 89, tacos1Viandes: [], tacos2Viandes: [] }))} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', fontWeight: '600', cursor: 'pointer', background: promoTacosModal.taille === 'XL' ? COLORS.secondary : 'transparent', color: promoTacosModal.taille === 'XL' ? 'white' : COLORS.textMuted }}>2x XL (89 DH)</button>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
                <button
                  className="pos-btn num-tabular"
                  onClick={() => setPromoTacosModal(p => ({ ...p, avecFritesBoisson: !p.avecFritesBoisson }))}
                  style={{
                    width: '100%', padding: '14px 18px', borderRadius: '12px',
                    border: `1px solid ${promoTacosModal.avecFritesBoisson ? COLORS.success : COLORS.borderStrong}`,
                    background: promoTacosModal.avecFritesBoisson ? '#ECFDF5' : COLORS.bg,
                    color: COLORS.textMain, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    fontWeight: '600', fontSize: '1rem', cursor: 'pointer', marginBottom: '18px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <StatusDot active={promoTacosModal.avecFritesBoisson} />
                    <span>{promoTacosModal.avecFritesBoisson ? 'Option activée : Avec Frites + Boisson 1L' : 'Ajouter Option Frites + Boisson 1L (Sinon : Sans Frites)'}</span>
                  </div>
                  <span style={{ background: promoTacosModal.avecFritesBoisson ? COLORS.success : COLORS.secondary, color: 'white', padding: '5px 10px', borderRadius: '6px', fontSize: '0.9rem' }}>+ 15 DH</span>
                </button>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
                  {/* TACOS #1 */}
                  <div style={{ background: COLORS.bg, padding: '16px', borderRadius: '12px', border: `1px solid ${COLORS.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h3 style={{ margin: 0, color: COLORS.textMain, fontSize: '1rem' }}>Tacos #1 ({promoTacosModal.taille})</h3>
                      <span className="num-tabular" style={{ fontSize: '0.8rem', fontWeight: '600', color: COLORS.textLight }}>{promoTacosModal.tacos1Viandes.length} / {promoTacosModal.taille === 'XL' ? 3 : 2} viandes</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                      {(parametres.stocks.viandes || []).filter(v => v.available).map((v, idx) => {
                        const sel = promoTacosModal.tacos1Viandes.includes(v.nom);
                        const maxV = promoTacosModal.taille === 'XL' ? 3 : 2;
                        return (
                          <button key={idx} className="pos-btn" onClick={() => togglePromoTacosOption('tacos1Viandes', v.nom, maxV)} style={{ padding: '8px 12px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', background: sel ? COLORS.primary : 'white', color: sel ? 'white' : COLORS.textMain, border: `1px solid ${sel ? COLORS.primary : COLORS.border}`, fontSize: '0.9rem' }}>{v.nom}</button>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: '600', color: COLORS.textLight, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Sauces Tacos #1</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                      {(parametres.stocks.sauces || []).filter(s => s.available).map((s, idx) => {
                        const sel = promoTacosModal.tacos1Sauces.includes(s.nom);
                        return (
                          <button key={idx} className="pos-btn" onClick={() => togglePromoTacosOption('tacos1Sauces', s.nom)} style={{ padding: '7px 11px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', background: sel ? COLORS.secondary : 'white', color: sel ? 'white' : COLORS.textMain, border: `1px solid ${COLORS.border}`, fontSize: '0.85rem' }}>{s.nom}</button>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: '600', color: COLORS.textLight, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Suppléments Tacos #1</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {Object.keys(TACOS_EXTRAS).map(ext => {
                        const sel = promoTacosModal.tacos1Extras.includes(ext);
                        return (
                          <button key={ext} className="pos-btn num-tabular" onClick={() => togglePromoTacosOption('tacos1Extras', ext)} style={{ padding: '7px 11px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', background: sel ? COLORS.success : 'white', color: sel ? 'white' : COLORS.textMain, border: `1px solid ${sel ? COLORS.success : COLORS.border}`, fontSize: '0.85rem' }}>{ext} (+{TACOS_EXTRAS[ext]}DH)</button>
                        );
                      })}
                    </div>
                  </div>

                  {/* TACOS #2 */}
                  <div style={{ background: COLORS.bg, padding: '16px', borderRadius: '12px', border: `1px solid ${COLORS.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <h3 style={{ margin: 0, color: COLORS.textMain, fontSize: '1rem' }}>Tacos #2 ({promoTacosModal.taille})</h3>
                      <span className="num-tabular" style={{ fontSize: '0.8rem', fontWeight: '600', color: COLORS.textLight }}>{promoTacosModal.tacos2Viandes.length} / {promoTacosModal.taille === 'XL' ? 3 : 2} viandes</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                      {(parametres.stocks.viandes || []).filter(v => v.available).map((v, idx) => {
                        const sel = promoTacosModal.tacos2Viandes.includes(v.nom);
                        const maxV = promoTacosModal.taille === 'XL' ? 3 : 2;
                        return (
                          <button key={idx} className="pos-btn" onClick={() => togglePromoTacosOption('tacos2Viandes', v.nom, maxV)} style={{ padding: '8px 12px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', background: sel ? COLORS.primary : 'white', color: sel ? 'white' : COLORS.textMain, border: `1px solid ${sel ? COLORS.primary : COLORS.border}`, fontSize: '0.9rem' }}>{v.nom}</button>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: '600', color: COLORS.textLight, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Sauces Tacos #2</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
                      {(parametres.stocks.sauces || []).filter(s => s.available).map((s, idx) => {
                        const sel = promoTacosModal.tacos2Sauces.includes(s.nom);
                        return (
                          <button key={idx} className="pos-btn" onClick={() => togglePromoTacosOption('tacos2Sauces', s.nom)} style={{ padding: '7px 11px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', background: sel ? COLORS.secondary : 'white', color: sel ? 'white' : COLORS.textMain, border: `1px solid ${COLORS.border}`, fontSize: '0.85rem' }}>{s.nom}</button>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: '600', color: COLORS.textLight, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Suppléments Tacos #2</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {Object.keys(TACOS_EXTRAS).map(ext => {
                        const sel = promoTacosModal.tacos2Extras.includes(ext);
                        return (
                          <button key={ext} className="pos-btn num-tabular" onClick={() => togglePromoTacosOption('tacos2Extras', ext)} style={{ padding: '7px 11px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', background: sel ? COLORS.success : 'white', color: sel ? 'white' : COLORS.textMain, border: `1px solid ${sel ? COLORS.success : COLORS.border}`, fontSize: '0.85rem' }}>{ext} (+{TACOS_EXTRAS[ext]}DH)</button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '14px', borderTop: `1px solid ${COLORS.border}`, paddingTop: '16px' }}>
                <button className="pos-btn" onClick={() => setPromoTacosModal(p => ({ ...p, active: false }))} style={{ flex: 1, padding: '14px', background: COLORS.bg, color: COLORS.textMuted, borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer' }}>Annuler</button>
                <button className="pos-btn num-tabular" onClick={validerPackPromoTacos} style={{ flex: 2, padding: '14px', background: COLORS.secondary, color: 'white', borderRadius: '8px', border: 'none', fontSize: '1rem', fontWeight: '600', cursor: 'pointer' }}>
                  Ajouter le Pack au panier • {promoTacosModal.prixPack + (promoTacosModal.avecFritesBoisson ? 15 : 0)} DH
                </button>
              </div>
            </div>
          </div>
        )}

        {showDiviserAddition && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(9, 9, 11, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000 }}>
            <div className="modal-box" style={{ background: 'white', padding: '28px', borderRadius: '16px', width: '360px', textAlign: 'center', border: `1px solid ${COLORS.border}` }}>
              <h2 style={{ marginTop: 0, letterSpacing: '-0.02em', fontSize: '1.3rem' }}>Diviser l'addition</h2>
              <p style={{ fontSize: '1rem', color: COLORS.textLight, marginBottom: '20px' }}>Total : <strong className="num-tabular" style={{ color: COLORS.textMain }}>{totalCart} DH</strong></p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '20px' }}>
                <button className="pos-btn" onClick={() => setDiviserPar(Math.max(2, diviserPar - 1))} style={{ width: '48px', height: '48px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, background: COLORS.bg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="minus" size={18} /></button>
                <span className="num-tabular" style={{ fontSize: '2.2rem', fontWeight: 'bold' }}>{diviserPar}</span>
                <button className="pos-btn" onClick={() => setDiviserPar(diviserPar + 1)} style={{ width: '48px', height: '48px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, background: COLORS.bg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={18} /></button>
              </div>

              <div className="num-tabular" style={{ background: COLORS.bg, padding: '18px', borderRadius: '12px', fontSize: '1.8rem', fontWeight: 'bold', color: COLORS.primary, marginBottom: '20px', border: `1px solid ${COLORS.border}` }}>
                {(totalCart / diviserPar).toFixed(2)} DH <span style={{ fontSize: '0.9rem', color: COLORS.textLight }}>/ pers.</span>
              </div>

              <button className="pos-btn" onClick={() => { setShowDiviserAddition(false); validerCommandePOS('Espèces', totalCart); }} style={{ width: '100%', padding: '14px', background: COLORS.success, color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer' }}>Confirmer l'encaissement</button>
              <button className="pos-btn" onClick={() => setShowDiviserAddition(false)} style={{ width: '100%', padding: '12px', background: 'transparent', color: COLORS.textLight, border: 'none', marginTop: '8px', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '500' }}>Fermer</button>
            </div>
          </div>
        )}

        {showCashOptions && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(9, 9, 11, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000 }}>
            <div className="modal-box" style={{ background: 'white', padding: '28px', borderRadius: '16px', width: '360px', textAlign: 'center', border: `1px solid ${COLORS.border}` }}>
              <h2 style={{ marginTop: 0, letterSpacing: '-0.02em', fontSize: '1.3rem' }}>Règlement Espèces</h2>
              <p className="num-tabular" style={{ fontSize: '2rem', fontWeight: 'bold', color: COLORS.primary, margin: '8px 0 20px 0' }}>{totalCart} DH</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button className="pos-btn" onClick={() => { setShowCashOptions(false); validerCommandePOS('Espèces', totalCart); }} style={{ padding: '14px', background: COLORS.success, color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.05rem', fontWeight: '600', cursor: 'pointer' }}>Montant exact reçu</button>
                <button className="pos-btn" onClick={() => { setShowCashOptions(false); openNumpad('encaissement_especes', 'Somme reçue du client'); }} style={{ padding: '14px', background: COLORS.secondary, color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer' }}>Calculer le rendu monnaie</button>
                <button className="pos-btn" onClick={() => { setShowCashOptions(false); setShowDiviserAddition(true); }} style={{ padding: '14px', background: COLORS.bg, color: COLORS.textMain, border: `1px solid ${COLORS.border}`, borderRadius: '8px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer' }}>Diviser la note</button>
                <button className="pos-btn" onClick={() => setShowCashOptions(false)} style={{ padding: '12px', background: 'transparent', color: COLORS.textLight, border: 'none', fontSize: '0.95rem', fontWeight: '500', cursor: 'pointer' }}>Annuler</button>
              </div>
            </div>
          </div>
        )}

        {numpad.active && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(9, 9, 11, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
            <div className="modal-box" style={{ background: 'white', width: '360px', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', border: `1px solid ${COLORS.border}` }}>
              <h3 style={{ marginTop: 0, textAlign: 'center', letterSpacing: '-0.02em', color: COLORS.textMain, fontSize: '1.1rem' }}>{numpad.label}</h3>

              {numpad.mode === 'depense' && (
                <input
                  type="text"
                  placeholder="Motif (ex: Eau, Glace, Fournitures...)"
                  value={numpad.motif}
                  onChange={e => setNumpad({ ...numpad, motif: e.target.value })}
                  autoFocus
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${COLORS.borderStrong}`, marginBottom: '12px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              )}

              <div className="num-tabular" style={{ background: COLORS.bg, padding: '16px', fontSize: '2.2rem', textAlign: 'right', borderRadius: '12px', marginBottom: '16px', fontWeight: 'bold', minHeight: '40px', border: `1px solid ${COLORS.border}` }}>
                {numpad.value || '0'} {numpad.mode === 'remise_globale' ? '%' : 'DH'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', 'DEL'].map(btn => (
                  <button key={btn} className="pos-btn num-tabular" onClick={() => handleNumpadKey(btn)} style={{ padding: '16px', fontSize: '1.4rem', fontWeight: '600', borderRadius: '8px', border: `1px solid ${COLORS.border}`, background: btn === 'DEL' ? '#FEF2F2' : 'white', color: btn === 'DEL' ? COLORS.danger : COLORS.textMain, cursor: 'pointer' }}>{btn}</button>
                ))}
                <button className="pos-btn" onClick={() => handleNumpadKey('OK')} style={{ padding: '16px', fontSize: '1.2rem', fontWeight: '600', borderRadius: '8px', border: 'none', background: COLORS.secondary, color: 'white', cursor: 'pointer' }}>Valider</button>
              </div>
              <button className="pos-btn" onClick={() => setNumpad({ active: false, mode: '', targetId: null, label: '', value: '', motif: '' })} style={{ marginTop: '14px', padding: '12px', background: COLORS.bg, color: COLORS.textMuted, border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer' }}>Fermer</button>
            </div>
          </div>
        )}

        {showRenduMonnaie.active && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(9, 9, 11, 0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000 }}>
            <div className="modal-box" style={{ background: 'white', padding: '36px', borderRadius: '16px', width: '90%', maxWidth: '440px', textAlign: 'center', border: `1px solid ${COLORS.border}` }}>
              <h2 style={{ fontSize: '1.5rem', margin: '0 0 18px 0', letterSpacing: '-0.03em' }}>Rendu Monnaie</h2>
              <div className="num-tabular" style={{ fontSize: '1.15rem', color: COLORS.textLight, marginBottom: '6px' }}>Total à encaisser : <strong style={{ color: COLORS.textMain }}>{totalCart} DH</strong></div>
              <div className="num-tabular" style={{ fontSize: '1.15rem', color: COLORS.textLight, marginBottom: '18px' }}>Espèces reçues : <strong style={{ color: COLORS.textMain }}>{showRenduMonnaie.received} DH</strong></div>
              <div className="num-tabular" style={{ background: COLORS.secondary, color: 'white', padding: '24px', borderRadius: '12px', fontSize: '2.2rem', fontWeight: 'bold', margin: '18px 0' }}>
                À rendre : {showRenduMonnaie.aRendre} DH
              </div>
              <button className="pos-btn" onClick={() => validerCommandePOS('Espèces', showRenduMonnaie.received)} style={{ width: '100%', padding: '16px', background: COLORS.success, color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.15rem', fontWeight: '600', cursor: 'pointer' }}>Confirmer et imprimer</button>
              <button className="pos-btn" onClick={() => setShowRenduMonnaie({ active: false, aRendre: 0, received: 0 })} style={{ width: '100%', padding: '12px', background: 'transparent', color: COLORS.textLight, border: 'none', marginTop: '10px', cursor: 'pointer', fontSize: '0.95rem' }}>Retour</button>
            </div>
          </div>
        )}

        {customizeItem && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(9, 9, 11, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
            <div className="modal-box" style={{ background: 'white', width: '90%', maxWidth: '780px', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', maxHeight: '90vh', border: `1px solid ${COLORS.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${COLORS.border}`, paddingBottom: '14px' }}>
                <h2 style={{ margin: 0, color: COLORS.textMain, letterSpacing: '-0.02em', fontSize: '1.3rem' }}>
                  {customizeItem.produit.nom} {customizeItem.variante?.nom ? `— Taille ${customizeItem.variante.nom}` : ''}
                </h2>
                <span style={{ fontSize: '0.85rem', color: COLORS.textLight, fontWeight: '600' }}>{customizeItem.produit.categorie}</span>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 0' }}>
                {customizeItem.produit.categorie === 'Burgers' && (
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '10px', color: COLORS.danger }}>Exclusions cuisine</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {EXCLUSIONS_BURGER.map((exc, idx) => {
                        const isSelected = customOptions.exclusions.includes(exc);
                        return (
                          <button key={idx} className="pos-btn" onClick={() => toggleArrOption('exclusions', exc)} style={{ padding: '10px 14px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', background: isSelected ? COLORS.danger : COLORS.bg, color: isSelected ? 'white' : COLORS.textMain, border: `1px solid ${isSelected ? COLORS.danger : COLORS.border}` }}>{exc}</button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {customizeItem.produit.categorie === 'Plats' && (
                  <div style={{ marginBottom: '20px', background: COLORS.bg, padding: '16px', borderRadius: '12px', border: `1px solid ${COLORS.border}` }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '10px', color: COLORS.textMain }}>Accompagnements ({customOptions.accompagnements.length} / 2 obligatoires)</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {ACCOMPAGNEMENTS_PLATS.map((acc, idx) => {
                        const isSelected = customOptions.accompagnements.includes(acc);
                        const isDisabled = !isSelected && customOptions.accompagnements.length >= 2;
                        return (
                          <button key={idx} className="pos-btn" disabled={isDisabled} onClick={() => toggleArrOption('accompagnements', acc)} style={{ padding: '10px 16px', borderRadius: '8px', fontWeight: '600', cursor: isDisabled ? 'not-allowed' : 'pointer', background: isSelected ? COLORS.secondary : 'white', color: isSelected ? 'white' : COLORS.textMain, border: `1px solid ${COLORS.border}`, opacity: isDisabled ? 0.5 : 1 }}>{acc}</button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {customizeItem.produit.categorie === 'Pâtes' && (
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '10px', color: COLORS.textLight }}>Choix de pâtes (Obligatoire)</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {(parametres.stocks.pates || []).filter(p => p.available).map((pate, idx) => (
                        <button key={idx} className="pos-btn" onClick={() => setCustomOptions(prev => ({ ...prev, typePate: pate.nom }))} style={{ padding: '12px 20px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', background: customOptions.typePate === pate.nom ? COLORS.secondary : COLORS.bg, color: customOptions.typePate === pate.nom ? 'white' : COLORS.textMain, border: `1px solid ${COLORS.border}`, fontSize: '1rem' }}>{pate.nom}</button>
                      ))}
                    </div>
                  </div>
                )}

                {customizeItem.produit.categorie === 'Pizzas' && (
                  <>
                    {(customizeItem.produit.nom.toLowerCase().includes('saison') || customizeItem.produit.nom.toLowerCase().includes('moitié')) && (
                      <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '10px', color: COLORS.textLight }}>Garnitures au choix</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {(parametres.stocks.garnitures || []).filter(opt => opt.available).map((opt, idx) => (
                            <button key={idx} className="pos-btn" onClick={() => toggleArrOption('garnitures', opt.nom)} style={{ padding: '10px 14px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', background: customOptions.garnitures.includes(opt.nom) ? COLORS.primary : COLORS.bg, color: customOptions.garnitures.includes(opt.nom) ? 'white' : COLORS.textMain, border: `1px solid ${COLORS.border}` }}>{opt.nom}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '10px', color: COLORS.textLight }}>Croûte</div>
                      <button className="pos-btn num-tabular" onClick={() => setCustomOptions(p => ({ ...p, cheesyCrust: !p.cheesyCrust }))} style={{ width: '100%', padding: '14px 16px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '1rem', display: 'flex', justifyContent: 'space-between', background: customOptions.cheesyCrust ? COLORS.secondary : COLORS.bg, color: customOptions.cheesyCrust ? 'white' : COLORS.textMain, border: `1px solid ${COLORS.border}` }}>
                        <span>Option Cheesy Crust (Bords fourrés au fromage)</span>
                        <span>+ {customizeItem.variante?.nom === 'L' ? 25 : 15} DH</span>
                      </button>
                    </div>
                  </>
                )}

                {['Pizzas', 'Pâtes', 'Plats'].includes(customizeItem.produit.categorie) && (
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '10px', color: COLORS.textLight }}>Suppléments</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '8px' }}>
                      {Object.keys(EXTRAS_BASE).map(ext => {
                        const isPizzaL = (customizeItem.produit.categorie === 'Pizzas' && customizeItem.variante?.nom === 'L');
                        const price = isPizzaL ? Math.round(EXTRAS_BASE[ext] * 1.7) : EXTRAS_BASE[ext];
                        const sel = customOptions.extras.includes(ext);
                        return (
                          <button key={ext} className="pos-btn num-tabular" onClick={() => toggleArrOption('extras', ext)} style={{ padding: '12px 14px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', background: sel ? COLORS.secondary : COLORS.bg, color: sel ? 'white' : COLORS.textMain, border: `1px solid ${COLORS.border}` }}>
                            <span>{ext}</span><span>+ {price} DH</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {customizeItem.produit.categorie === 'Tacos' && (
                  <>
                    {customizeItem.produit.nom.toLowerCase().includes('mixte') && (() => {
                      const maxV = customizeItem.variante?.nom === 'XXL' ? 4 : customizeItem.variante?.nom === 'XL' ? 3 : 2;
                      return (
                        <div style={{ marginBottom: '20px', background: COLORS.bg, padding: '16px', borderRadius: '12px', border: `1px solid ${COLORS.border}` }}>
                          <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '10px', color: COLORS.textMain }}>Viandes au choix ({customOptions.viandes.length} / {maxV} obligatoires)</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {(parametres.stocks.viandes || []).filter(opt => opt.available).map((opt, idx) => {
                              const isSelected = customOptions.viandes.includes(opt.nom);
                              const isDisabled = !isSelected && customOptions.viandes.length >= maxV;
                              return (
                                <button key={idx} className="pos-btn" disabled={isDisabled} onClick={() => toggleArrOption('viandes', opt.nom)} style={{ padding: '10px 14px', borderRadius: '8px', fontWeight: '600', cursor: isDisabled ? 'not-allowed' : 'pointer', background: isSelected ? COLORS.primary : 'white', color: isSelected ? 'white' : COLORS.textMain, border: `1px solid ${isSelected ? COLORS.primary : COLORS.border}`, opacity: isDisabled ? 0.5 : 1 }}>{opt.nom}</button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '10px', color: COLORS.textLight }}>Sauces incluses</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {(parametres.stocks.sauces || []).filter(opt => opt.available).map((opt, idx) => (
                          <button key={idx} className="pos-btn" onClick={() => toggleArrOption('sauces', opt.nom)} style={{ padding: '10px 14px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', background: customOptions.sauces.includes(opt.nom) ? COLORS.secondary : COLORS.bg, color: customOptions.sauces.includes(opt.nom) ? 'white' : COLORS.textMain, border: `1px solid ${COLORS.border}` }}>{opt.nom}</button>
                        ))}
                      </div>
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '10px', color: COLORS.textLight }}>Suppléments Fromagers</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '8px' }}>
                        {Object.keys(TACOS_EXTRAS).map(ext => {
                          const sel = customOptions.extras.includes(ext);
                          return (
                            <button key={ext} className="pos-btn num-tabular" onClick={() => toggleArrOption('extras', ext)} style={{ padding: '12px 14px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', background: sel ? COLORS.secondary : COLORS.bg, color: sel ? 'white' : COLORS.textMain, border: `1px solid ${COLORS.border}` }}>
                              <span>{ext}</span><span>+ {TACOS_EXTRAS[ext]} DH</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '14px', borderTop: `1px solid ${COLORS.border}`, paddingTop: '16px' }}>
                <button className="pos-btn" onClick={() => setCustomizeItem(null)} style={{ flex: 1, padding: '14px', background: COLORS.bg, color: COLORS.textMuted, borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer' }}>Annuler</button>
                <button className="pos-btn" onClick={validerEtAjouter} style={{ flex: 2, padding: '14px', background: COLORS.secondary, color: 'white', borderRadius: '8px', border: 'none', fontSize: '1rem', fontWeight: '600', cursor: 'pointer' }}>Ajouter à la commande</button>
              </div>
            </div>
          </div>
        )}

        <div className="no-print" style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: COLORS.bg }}>
          {/* COLONNE GAUCHE : CATALOGUE POS */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px', height: '100%', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '12px 16px', borderRadius: '12px', marginBottom: '12px', flexShrink: 0, border: `1px solid ${COLORS.border}` }}>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h2 style={{ margin: 0, color: COLORS.textMain, letterSpacing: '-0.03em', fontSize: '1.25rem' }}>Foodji POS</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: COLORS.bg, color: COLORS.textMain, padding: '5px 10px', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', border: `1px solid ${COLORS.border}` }}>
                  <StatusDot active={true} />
                  <span>{sessionCaisse.caissiere}</span>
                </div>

                {commandesWebEnAttente > 0 && (
                  <button onClick={() => setAppMode('ADMIN')} className="blink-alert pos-btn" style={{ background: COLORS.danger, color: 'white', border: 'none', borderRadius: '8px', padding: '7px 12px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <StatusDot active={true} colorActive="#FFFFFF" />
                    <span>{commandesWebEnAttente} Commande{commandesWebEnAttente > 1 ? 's' : ''} Web</span>
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="pos-btn num-tabular" onClick={() => openPromoTacosBuilder('L')} style={{ padding: '8px 12px', background: COLORS.bg, color: COLORS.textMain, borderRadius: '8px', border: `1px solid ${COLORS.borderStrong}`, cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Icon name="tag" size={14} color={COLORS.primary} /> Pack Tacos 55/89
                </button>

                <select onChange={handleRuptureRapide} value="" style={{ padding: '8px 12px', background: 'white', color: COLORS.textMuted, borderRadius: '8px', border: `1px solid ${COLORS.border}`, cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', outline: 'none' }}>
                  <option value="" disabled>Rupture rapide...</option>
                  {STOCK_TABS.map(tab => (
                    <optgroup key={tab.id} label={tab.label}>
                      {(parametres.stocks[tab.id] || []).filter(i => i.available).map(item => (
                        <option key={item.nom} value={`${tab.id}|${item.nom}`}>{item.nom}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <button className="pos-btn" onClick={() => openNumpad('depense', 'Enregistrer un décaissement')} style={{ padding: '8px 12px', background: 'white', color: COLORS.textMain, borderRadius: '8px', border: `1px solid ${COLORS.border}`, cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Icon name="wallet" size={14} color={COLORS.textLight} /> Sortie
                </button>
                <button className="pos-btn" onClick={cloturerShift} style={{ padding: '8px 12px', background: 'white', color: COLORS.textMain, borderRadius: '8px', border: `1px solid ${COLORS.border}`, cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Icon name="power" size={14} color={COLORS.textLight} /> Fin Shift
                </button>
                <button className="pos-btn" onClick={() => setAppMode('ADMIN')} style={{ padding: '8px 12px', background: COLORS.secondary, color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Icon name="settings" size={14} /> Admin
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '8px', flexShrink: 0, scrollbarWidth: 'none' }}>
              {categoriesList.map(c => (
                <button key={c} className="pos-btn" onClick={() => setPosCategory(c)} style={{ padding: '10px 18px', fontSize: '0.95rem', fontWeight: '600', borderRadius: '8px', border: posCategory === c ? 'none' : `1px solid ${COLORS.border}`, background: posCategory === c ? COLORS.secondary : 'white', color: posCategory === c ? 'white' : COLORS.textMain, cursor: 'pointer', flexShrink: 0 }}>{c}</button>
              ))}
            </div>

            {posCategory === 'Tacos' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px', marginBottom: '12px', flexShrink: 0 }}>
                <button className="pos-btn num-tabular" onClick={() => openPromoTacosBuilder('L')} style={{ padding: '14px 16px', borderRadius: '12px', border: `1px solid ${COLORS.darkBorder}`, background: COLORS.secondary, color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left' }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '1rem', letterSpacing: '-0.01em' }}>Pack 2 Tacos L (Sans Frites)</div>
                    <div style={{ fontSize: '0.8rem', color: '#A1A1AA', marginTop: '2px' }}>Option +15 DH : Frites + Boisson 1L</div>
                  </div>
                  <span style={{ background: COLORS.primary, color: 'white', padding: '6px 10px', borderRadius: '8px', fontWeight: '700', fontSize: '1.05rem' }}>55 DH</span>
                </button>

                <button className="pos-btn num-tabular" onClick={() => openPromoTacosBuilder('XL')} style={{ padding: '14px 16px', borderRadius: '12px', border: `1px solid ${COLORS.darkBorder}`, background: COLORS.secondary, color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left' }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '1rem', letterSpacing: '-0.01em' }}>Pack 2 Tacos XL (Sans Frites)</div>
                    <div style={{ fontSize: '0.8rem', color: '#A1A1AA', marginTop: '2px' }}>Option +15 DH : Frites + Boisson 1L</div>
                  </div>
                  <span style={{ background: COLORS.primary, color: 'white', padding: '6px 10px', borderRadius: '8px', fontWeight: '700', fontSize: '1.05rem' }}>89 DH</span>
                </button>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))', gap: '10px' }}>
              {menu.filter(p => p.categorie === posCategory && p.available !== false).map(p => (
                <div key={p.id} className="pos-card" style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${COLORS.border}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  {p.variantes?.length > 0 ? (
                    <div style={{ padding: '12px' }}>
                      <div style={{ fontWeight: '600', textAlign: 'left', marginBottom: '10px', fontSize: '0.98rem', letterSpacing: '-0.01em', color: COLORS.textMain, lineHeight: 1.25 }}>{p.nom}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                        {p.variantes.filter(v => v.available !== false).map((v, i) => (
                          <button key={i} className="pos-btn num-tabular" onClick={(e) => { e.stopPropagation(); triggerAddToCart(p, v); }} style={{ padding: '8px 10px', background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: COLORS.textMain, fontSize: '0.85rem' }}>
                            <span>{v.nom}</span>
                            <span style={{ color: COLORS.primary, fontWeight: '700' }}>{v.prix}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="pos-btn" onClick={() => triggerAddToCart(p)} style={{ padding: '16px 14px', textAlign: 'left', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer', boxSizing: 'border-box', minHeight: '92px' }}>
                      <div style={{ fontWeight: '600', fontSize: '0.98rem', letterSpacing: '-0.01em', color: COLORS.textMain, lineHeight: 1.25 }}>{p.nom}</div>
                      <div className="num-tabular" style={{ color: COLORS.textMuted, fontWeight: '700', marginTop: '10px', fontSize: '1.05rem' }}>{p.prix} DH</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* COLONNE DROITE : PANIER DE COMMANDE EN DARK UI */}
          <div style={{ width: '420px', flexShrink: 0, background: COLORS.darkBg, color: '#FAFAFA', display: 'flex', flexDirection: 'column', height: '100%', borderLeft: `1px solid ${COLORS.darkBorder}` }}>
            <div style={{ padding: '14px', background: COLORS.darkCard, color: 'white', flexShrink: 0, borderBottom: `1px solid ${COLORS.darkBorder}` }}>
              <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', background: '#09090B', padding: '4px', borderRadius: '8px', border: `1px solid ${COLORS.darkBorder}` }}>
                <button className="pos-btn" onClick={() => setPosOrderType('sur_place')} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', fontWeight: '600', fontSize: '0.88rem', cursor: 'pointer', background: posOrderType === 'sur_place' ? '#27272A' : 'transparent', color: posOrderType === 'sur_place' ? 'white' : '#71717A' }}>Sur Place</button>
                <button className="pos-btn" onClick={() => setPosOrderType('emporter')} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', fontWeight: '600', fontSize: '0.88rem', cursor: 'pointer', background: posOrderType === 'emporter' ? '#27272A' : 'transparent', color: posOrderType === 'emporter' ? 'white' : '#71717A' }}>À Emporter</button>
                <button className="pos-btn" onClick={() => setPosOrderType('livraison')} style={{ flex: 1, padding: '8px', borderRadius: '6px', border: 'none', fontWeight: '600', fontSize: '0.88rem', cursor: 'pointer', background: posOrderType === 'livraison' ? COLORS.blue : 'transparent', color: posOrderType === 'livraison' ? 'white' : '#71717A' }}>Livraison</button>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input type="tel" className="num-tabular" placeholder="Téléphone (06...)" value={posPhone} onChange={e => handlePhoneInput(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${COLORS.darkBorder}`, background: '#09090B', color: '#FAFAFA', fontSize: '0.95rem', boxSizing: 'border-box', fontWeight: '600' }} />
                  {clientActif && statutClientActif.isVipActif && (
                    <span style={{ position: 'absolute', right: '8px', top: '9px', background: COLORS.promo, color: 'white', padding: '2px 7px', borderRadius: '6px', fontWeight: '700', fontSize: '0.7rem' }}>{statutClientActif.label}</span>
                  )}
                  {clientActif && statutClientActif.isExpired && (
                    <span style={{ position: 'absolute', right: '8px', top: '9px', background: '#3F3F46', color: '#F87171', padding: '2px 7px', borderRadius: '6px', fontWeight: '700', fontSize: '0.7rem' }}>Expiré +30j</span>
                  )}
                </div>
                <select value={posBipeur} onChange={e => setPosBipeur(e.target.value)} style={{ width: '96px', padding: '10px', borderRadius: '8px', border: `1px solid ${COLORS.darkBorder}`, background: '#09090B', color: '#FAFAFA', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer' }}>
                  <option value="">Bipeur</option>
                  {Array.from({ length: 20 }, (_, i) => <option key={i + 1} value={i + 1}>N° {i + 1}</option>)}
                </select>
              </div>

              <input type="text" placeholder={clientActif && ['non spécifié', 'client', 'inconnu'].includes((clientActif.nom || '').toLowerCase()) ? "Saisir le prénom pour mettre à jour la fiche..." : "Nom du client"} value={posClientName} onChange={e => setPosClientName(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${COLORS.darkBorder}`, background: '#09090B', color: '#FAFAFA', marginBottom: posOrderType === 'livraison' ? '8px' : '0', fontSize: '0.9rem', boxSizing: 'border-box' }} />

              {posOrderType === 'livraison' && (
                <input type="text" placeholder="Adresse complète de livraison" value={posAddress} onChange={e => setPosAddress(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${COLORS.darkBorder}`, background: '#09090B', color: '#FAFAFA', fontSize: '0.9rem', boxSizing: 'border-box' }} />
              )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px', background: COLORS.darkBg }}>
              {posCart.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#52525B', marginTop: '60px', fontSize: '0.95rem', padding: '24px' }}>
                  Sélectionnez un produit pour démarrer
                </div>
              ) : null}

              {posCart.map(item => (
                <div key={item.idCart} style={{ padding: '12px', border: `1px solid ${COLORS.darkBorder}`, background: COLORS.darkCard, borderRadius: '12px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '8px' }}>
                    <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => openNumpad('prix_article', `Modifier prix unitaire : ${item.nom}`, item.idCart)}>
                      <div style={{ fontWeight: '600', fontSize: '0.95rem', color: item.isPrixModifie ? '#FBBF24' : '#FAFAFA' }}>{item.nom}</div>
                      {item.detailsTxt?.length > 0 && (
                        <div style={{ fontSize: '0.82rem', color: '#A1A1AA', marginTop: '6px', paddingLeft: '4px' }}>
                          {item.detailsTxt.map((txt, j) => (
                            <div key={j} style={{ color: txt.includes('[SANS') ? '#F87171' : txt.includes('[OPTION') ? '#34D399' : '#A1A1AA', fontWeight: (txt.includes('[SANS') || txt.includes('[OPTION')) ? '600' : 'normal', marginBottom: '2px' }}>
                              • {txt}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="num-tabular" style={{ fontWeight: '700', fontSize: '1rem', color: '#FAFAFA', cursor: 'pointer', display: 'block' }} onClick={() => openNumpad('prix_article', `Modifier prix : ${item.nom}`, item.idCart)}>{item.prixFinal * item.qte} DH</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', background: '#09090B', border: `1px solid ${COLORS.darkBorder}`, borderRadius: '8px', overflow: 'hidden' }}>
                      <button className="pos-btn" onClick={() => modifierQuantite(item.idCart, -1)} style={{ padding: '5px 12px', border: 'none', background: 'transparent', color: '#A1A1AA', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Icon name="minus" size={14} /></button>
                      <span className="num-tabular" style={{ padding: '0 8px', fontWeight: '600', fontSize: '0.9rem', color: '#FAFAFA' }}>{item.qte}</span>
                      <button className="pos-btn" onClick={() => modifierQuantite(item.idCart, 1)} style={{ padding: '5px 12px', border: 'none', background: 'transparent', color: '#FAFAFA', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Icon name="plus" size={14} /></button>
                    </div>
                    <button className="pos-btn" onClick={() => removeFromCart(item.idCart)} style={{ background: 'transparent', color: '#71717A', border: `1px solid ${COLORS.darkBorder}`, padding: '6px 8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                      <Icon name="trash" size={14} color="#F87171" />
                    </button>
                  </div>
                </div>
              ))}

              {promoTacosDiscount > 0 && (
                <button
                  className="pos-btn num-tabular"
                  onClick={ajouterOptionFritesBoissonPromo}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    border: `1px solid ${COLORS.darkBorder}`, background: COLORS.darkCard,
                    color: '#FBBF24', fontWeight: '600', fontSize: '0.85rem',
                    cursor: 'pointer', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                  }}
                >
                  <span>+ Ajouter Frites & Boisson 1L (Promo Tacos)</span>
                  <span>+15 DH</span>
                </button>
              )}
            </div>

            <div style={{ padding: '14px', borderTop: `1px solid ${COLORS.darkBorder}`, background: COLORS.darkCard, flexShrink: 0 }}>
              <textarea placeholder="Note cuisine / instructions..." value={posNote} onChange={e => setPosNote(e.target.value)} rows={2} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${COLORS.darkBorder}`, background: '#09090B', color: '#FAFAFA', marginBottom: '10px', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: '0.88rem' }} />

              <div className="num-tabular" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '0.88rem', color: '#A1A1AA' }}>
                <span>Sous-total</span><span>{sousTotalCart} DH</span>
              </div>

              {fraisLivraison > 0 && (
                <div className="num-tabular" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '0.88rem', color: '#60A5FA', fontWeight: '600' }}>
                  <span>Frais de livraison</span><span>+ {fraisLivraison} DH</span>
                </div>
              )}

              {promoDimancheDiscount > 0 && (
                <div className="num-tabular" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '0.88rem', color: '#34D399', fontWeight: '600' }}>
                  <span>Promo Dimanche (3ème Pizza)</span><span>- {promoDimancheDiscount} DH</span>
                </div>
              )}

              {promoTacosDiscount > 0 && (
                <div className="num-tabular" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '0.88rem', color: '#FBBF24', fontWeight: '600' }}>
                  <span>Promo Tacos (Sans frites)</span><span>- {promoTacosDiscount} DH</span>
                </div>
              )}

              {promoDuoDiscount > 0 && (
                <div className="num-tabular" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '0.88rem', color: '#34D399', fontWeight: '600' }}>
                  <span>Promo Duo (-50%)</span><span>- {promoDuoDiscount} DH</span>
                </div>
              )}

              {montantRemiseGlobale > 0 && (
                <div className="num-tabular" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '0.88rem', color: '#F87171', fontWeight: '600' }}>
                  <span>Remise manuelle ({remiseGlobale}%)</span><span>- {montantRemiseGlobale} DH</span>
                </div>
              )}

              {remiseCRM > 0 && (
                <div className="num-tabular" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.88rem', color: '#34D399', fontWeight: '600' }}>
                  <span>Remise Fidélité ({clientActif.remiseAuto}%)</span><span>- {remiseCRM} DH</span>
                </div>
              )}

              <div className="num-tabular" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0 12px 0', fontSize: '1.6rem', fontWeight: 'bold', letterSpacing: '-0.02em', color: '#FAFAFA' }}>
                <span>Total</span>
                <span>{totalCart} DH</span>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                {posOrderType === 'livraison' ? (
                  <button className="pos-btn" onClick={() => validerCommandePOS('En attente', null, 'En Livraison')} disabled={loading || posCart.length === 0} style={{ flex: 2, padding: '14px 10px', background: COLORS.blue, color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.98rem', fontWeight: '600', cursor: 'pointer', opacity: posCart.length === 0 ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <Icon name="truck" size={16} /> Départ Livreur
                  </button>
                ) : (
                  <button className="pos-btn" onClick={() => setShowCashOptions(true)} disabled={loading || posCart.length === 0} style={{ flex: 2, padding: '14px 10px', background: COLORS.success, color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.98rem', fontWeight: '600', cursor: 'pointer', opacity: posCart.length === 0 ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <Icon name="check" size={16} /> Encaisser
                  </button>
                )}
                <button className="pos-btn" onClick={() => openNumpad('remise_globale', 'Remise globale (%)')} disabled={loading || posCart.length === 0} style={{ flex: 1, padding: '14px 10px', background: '#27272A', color: '#FAFAFA', border: `1px solid ${COLORS.darkBorder}`, borderRadius: '8px', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', opacity: posCart.length === 0 ? 0.5 : 1 }}>Remise %</button>
              </div>

              <button
                className="pos-btn"
                onClick={() => {
                  if (posCart.length === 0) return;
                  requestConfirm("Vider le panier", "Voulez-vous retirer tous les articles du panier actuel ?", () => {
                    setPosCart([]); setRemiseGlobale(0); setClientActif(null); setPosBipeur('');
                  }, true, "Vider");
                }}
                style={{ width: '100%', padding: '10px', background: 'transparent', color: '#71717A', border: `1px solid ${COLORS.darkBorder}`, borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Icon name="trash" size={14} /> Vider le panier
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {renderTickets()}
      {renderSystemOverlays()}
      <div className="no-print" style={{ background: COLORS.bg, minHeight: '100vh', paddingBottom: '100px', color: COLORS.textMain }}>
        <div style={{ padding: '24px', maxWidth: '1240px', margin: '0 auto' }}>

          {/* BARRE SUPÉRIEURE ADMIN */}
          <div style={{ marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, letterSpacing: '-0.03em', fontSize: '1.6rem' }}>Administration Foodji</h2>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="pos-btn" onClick={() => declencherSonNotification(audioRef)} style={{ padding: '10px 14px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, background: 'white', color: COLORS.textMain, fontWeight: '600', fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icon name="bell" size={15} color={COLORS.primary} /> Tester le son
              </button>
              <button className="pos-btn" onClick={() => setShowSystemConfig(!showSystemConfig)} style={{ padding: '10px 14px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, background: showSystemConfig ? COLORS.secondary : 'white', color: showSystemConfig ? 'white' : COLORS.textMain, fontWeight: '600', fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icon name="users" size={15} /> Équipe & Catégories
              </button>
              <button className="pos-btn" onClick={() => setShowPromoManager(!showPromoManager)} style={{ padding: '10px 14px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, background: showPromoManager ? COLORS.secondary : 'white', color: showPromoManager ? 'white' : COLORS.textMain, fontWeight: '600', fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icon name="tag" size={15} /> Offres & Deals
              </button>
              <button className="pos-btn" onClick={() => setShowHistory(!showHistory)} style={{ padding: '10px 14px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, background: showHistory ? COLORS.secondary : 'white', color: showHistory ? 'white' : COLORS.textMain, fontWeight: '600', fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icon name="clock" size={15} /> {showHistory ? 'Masquer Historique' : 'Historique'}
              </button>
              <button className="pos-btn" onClick={() => setShowBilanGlobal(true)} style={{ padding: '10px 14px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, background: 'white', color: COLORS.textMain, fontWeight: '600', fontSize: '0.88rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icon name="chart" size={15} /> Bilan (Z)
              </button>
              <button className="pos-btn" onClick={() => setAppMode('POS')} style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: COLORS.primary, color: 'white', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icon name="store" size={15} /> Ouvrir la Caisse
              </button>
              <button className="pos-btn" onClick={() => auth.signOut()} style={{ padding: '10px 12px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, background: 'white', color: COLORS.textLight, cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icon name="logOut" size={15} />
              </button>
            </div>
          </div>

          {/* PANNEAU DE CONFIGURATION DYNAMIQUE SANS CODE (CAISSIÈRES & CATÉGORIES) */}
          {showSystemConfig && (
            <div style={{ background: 'white', padding: '24px', borderRadius: '12px', marginBottom: '24px', border: `1px solid ${COLORS.borderStrong}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', letterSpacing: '-0.02em' }}>Configuration Système (Sans passer par le code)</h3>
                <button className="pos-btn" onClick={() => setShowSystemConfig(false)} style={{ background: COLORS.bg, border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Fermer</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                {/* GESTION CAISSIÈRES */}
                <div style={{ background: COLORS.bg, padding: '16px', borderRadius: '10px', border: `1px solid ${COLORS.border}` }}>
                  <h4 style={{ marginTop: 0, marginBottom: '10px', fontSize: '0.95rem' }}>Équipe Caisse (Opérateurs)</h4>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <input type="text" placeholder="Prénom du nouvel opérateur..." value={newCaissiereInput} onChange={e => setNewCaissiereInput(e.target.value)} style={{ flex: 1, padding: '9px 12px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }} />
                    <button className="pos-btn" onClick={ajouterCaissiereConfig} style={{ padding: '9px 16px', background: COLORS.secondary, color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Ajouter</button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {caissieresList.map(nomC => (
                      <div key={nomC} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', padding: '6px 12px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontWeight: '600', fontSize: '0.88rem' }}>
                        <span>{nomC}</span>
                        <button onClick={() => supprimerCaissiereConfig(nomC)} style={{ border: 'none', background: 'transparent', color: COLORS.danger, cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}>
                          <Icon name="x" size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* GESTION CATÉGORIES */}
                <div style={{ background: COLORS.bg, padding: '16px', borderRadius: '10px', border: `1px solid ${COLORS.border}` }}>
                  <h4 style={{ marginTop: 0, marginBottom: '10px', fontSize: '0.95rem' }}>Catégories du Menu</h4>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <input type="text" placeholder="Nouvelle catégorie (ex: Desserts)..." value={newCategoryInput} onChange={e => setNewCategoryInput(e.target.value)} style={{ flex: 1, padding: '9px 12px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }} />
                    <button className="pos-btn" onClick={ajouterCategorieConfig} style={{ padding: '9px 16px', background: COLORS.secondary, color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Ajouter</button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {categoriesList.map(cat => (
                      <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', padding: '6px 12px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontWeight: '600', fontSize: '0.88rem' }}>
                        <span>{cat}</span>
                        <button onClick={() => supprimerCategorieConfig(cat)} style={{ border: 'none', background: 'transparent', color: COLORS.danger, cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}>
                          <Icon name="x" size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {commandesEnLivraison.length > 0 && (
            <div style={{ background: 'white', padding: '20px', borderRadius: '12px', marginBottom: '28px', border: `1px solid ${COLORS.borderStrong}`, borderLeft: `4px solid ${COLORS.blue}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <Icon name="truck" size={18} color={COLORS.blue} />
                <h3 style={{ margin: 0, color: COLORS.textMain, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>Retours livreurs en attente d'encaissement ({commandesEnLivraison.length})</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' }}>
                {commandesEnLivraison.map(cmd => (
                  <div key={cmd.id} style={{ background: COLORS.bg, borderRadius: '8px', padding: '14px', border: `1px solid ${COLORS.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div>
                        <strong style={{ fontSize: '1rem' }}>{cmd.client}</strong>
                        <div style={{ color: COLORS.textLight, fontSize: '0.85rem' }}>{cmd.adresse || 'Adresse non spécifiée'}</div>
                      </div>
                      <div className="num-tabular" style={{ textAlign: 'right', fontSize: '1.25rem', fontWeight: 'bold', color: COLORS.textMain }}>
                        {cmd.total} DH
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="pos-btn" onClick={() => encaisserRetourLivreur(cmd)} style={{ flex: 2, padding: '10px', background: COLORS.secondary, color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <Icon name="check" size={15} /> Encaisser
                      </button>
                      <button className="pos-btn" onClick={() => changerStatus(cmd, 'Annulé')} style={{ flex: 1, padding: '10px', background: 'white', color: COLORS.danger, border: `1px solid ${COLORS.border}`, borderRadius: '8px', fontWeight: '600', cursor: 'pointer', fontSize: '0.85rem' }}>
                        Annuler
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showPromoManager && (
            <div style={{ background: 'white', padding: '24px', borderRadius: '12px', marginBottom: '24px', border: `1px solid ${COLORS.border}` }}>
              <h3 style={{ marginTop: 0, color: COLORS.textMain, fontSize: '1.15rem', letterSpacing: '-0.02em' }}>Catalogue des Deals Web</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '16px' }}>
                <div style={{ background: COLORS.bg, padding: '16px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>
                  <h4 style={{ marginTop: 0, fontSize: '0.95rem' }}>Créer une nouvelle offre</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input placeholder="Titre de l'offre" value={formPromo.titre} onChange={e => setFormPromo({ ...formPromo, titre: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }} />
                    <input placeholder="Description (ex: 2 Tacos L 55 DH / 2 XL 89 DH sans frites)" value={formPromo.description} onChange={e => setFormPromo({ ...formPromo, description: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }} />
                    <input type="number" placeholder="Prix en DH" value={formPromo.prix} onChange={e => setFormPromo({ ...formPromo, prix: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }} />
                    <button className="pos-btn" onClick={savePromotion} style={{ padding: '11px', background: COLORS.secondary, color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Publier l'offre</button>
                  </div>
                </div>

                <div>
                  <h4 style={{ marginTop: 0, fontSize: '0.95rem' }}>Offres enregistrées</h4>
                  <div style={{ maxHeight: '220px', overflowY: 'auto', border: `1px solid ${COLORS.border}`, borderRadius: '8px', padding: '8px' }}>
                    {promotions.map(promo => (
                      <div key={promo.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: COLORS.bg, borderRadius: '8px', marginBottom: '6px', border: `1px solid ${COLORS.border}` }}>
                        <div>
                          <strong style={{ fontSize: '0.95rem' }}>{promo.titre}</strong>
                          <div className="num-tabular" style={{ fontSize: '0.85rem', color: COLORS.textLight }}>{promo.prix} DH</div>
                        </div>
                        <button className="pos-btn" onClick={() => togglePromoStatus(promo.id, promo.status)} style={{ padding: '6px 12px', border: `1px solid ${COLORS.border}`, borderRadius: '8px', background: 'white', color: COLORS.textMain, fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <StatusDot active={promo.status} />
                          <span>{promo.status ? 'Actif' : 'Désactivé'}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BARRE DE CONTRÔLE OPÉRATIONNELLE */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '24px', background: 'white', padding: '14px 20px', borderRadius: '12px', alignItems: 'center', border: `1px solid ${COLORS.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: COLORS.textLight, fontSize: '0.9rem', fontWeight: '600' }}>Restaurant :</span>
              <button className="pos-btn" onClick={() => updateDoc(doc(db, "parametres", "horaires"), { isOuvert: !parametres.isOuvert })} style={{ padding: '7px 12px', borderRadius: '8px', background: COLORS.bg, color: COLORS.textMain, border: `1px solid ${COLORS.border}`, cursor: 'pointer', fontWeight: '600', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <StatusDot active={parametres.isOuvert} colorInactive={COLORS.danger} />
                <span>{parametres.isOuvert ? 'Ouvert aux commandes' : 'Fermé'}</span>
              </button>
            </div>
            <div style={{ width: '1px', height: '24px', background: COLORS.border }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: COLORS.textLight, fontSize: '0.9rem', fontWeight: '600' }}>Cadence Cuisine :</span>
              <select value={parametres.rushMode} onChange={(e) => updateDoc(doc(db, "parametres", "status"), { mode: e.target.value })} style={{ padding: '7px 12px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, background: COLORS.bg, fontWeight: '600', fontSize: '0.88rem', outline: 'none', cursor: 'pointer' }}>
                <option value="standard">Flux Standard</option>
                <option value="rush">Flux Rush (30 min+)</option>
                <option value="gros_rush">Fort Rush (1h+)</option>
              </select>
            </div>
            <div style={{ width: '1px', height: '24px', background: COLORS.border }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ color: COLORS.textLight, fontSize: '0.9rem', fontWeight: '600' }}>Moteurs Promos :</span>
              <button className="pos-btn" onClick={togglePromoTacosAdmin} style={{ padding: '7px 12px', borderRadius: '8px', background: COLORS.bg, color: COLORS.textMain, border: `1px solid ${COLORS.border}`, cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '7px' }}>
                <StatusDot active={parametres.promoTacosActive} />
                <span>Tacos (2L=55 / 2XL=89)</span>
              </button>
              <button className="pos-btn" onClick={togglePromoDuoAdmin} style={{ padding: '7px 12px', borderRadius: '8px', background: COLORS.bg, color: COLORS.textMain, border: `1px solid ${COLORS.border}`, cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '7px' }}>
                <StatusDot active={parametres.promoDuoActive} />
                <span>Duo (-50%)</span>
              </button>
              <button className="pos-btn" onClick={togglePromoDimancheAdmin} style={{ padding: '7px 12px', borderRadius: '8px', background: COLORS.bg, color: COLORS.textMain, border: `1px solid ${COLORS.border}`, cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '7px' }}>
                <StatusDot active={parametres.promoDimancheActive} />
                <span>Dimanche (3ème Pizza)</span>
              </button>
            </div>
          </div>

          {showBilanGlobal && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(9, 9, 11, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000 }}>
              <div className="modal-box" style={{ background: 'white', padding: '28px', borderRadius: '16px', width: '90%', maxWidth: '440px', border: `1px solid ${COLORS.border}` }}>
                <h2 style={{ marginTop: 0, textAlign: 'left', color: COLORS.textMain, letterSpacing: '-0.02em', fontSize: '1.35rem' }}>Bilan Comptable (Z)</h2>
                <p style={{ textAlign: 'left', color: COLORS.textLight, fontSize: '0.85rem', marginTop: '4px' }}>
                  Période ouverte depuis {serviceGlobal.lastZDate ? toJSDate(serviceGlobal.lastZDate).toLocaleString() : '06:00'}
                </p>
                <hr style={{ border: 'none', borderTop: `1px solid ${COLORS.border}`, margin: '16px 0' }} />
                {(() => {
                  const bilan = genererBilanGlobalZ();
                  if (!bilan) return <p>Aucune donnée disponible.</p>;
                  return (
                    <div className="num-tabular" style={{ fontSize: '0.95rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}><span>Espèces encaissées</span> <strong>{bilan.totalEspeces} DH</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: COLORS.textLight }}><span>Livraisons Web / Autres</span> <strong>{bilan.totalLivrApp} DH</strong></div>
                      {bilan.totalEnLivraison > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: COLORS.warning, fontWeight: '600' }}><span>En cours chez livreurs</span> <span>{bilan.totalEnLivraison} DH</span></div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: COLORS.danger }}><span>Décaissements enregistrés</span> <strong>- {bilan.totalDépenses} DH</strong></div>
                      <hr style={{ border: 'none', borderTop: `1px solid ${COLORS.border}`, margin: '12px 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: COLORS.textLight }}><span>Fonds de caisse initial</span> <strong>+ {bilan.fondsInitial} DH</strong></div>
                      <hr style={{ border: 'none', borderTop: `1px solid ${COLORS.border}`, margin: '12px 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.35rem', color: COLORS.textMain }}><span>Tiroir attendu</span> <strong>{bilan.netEnCaisse} DH</strong></div>
                      <div style={{ marginTop: '12px', color: COLORS.textLight, fontSize: '0.85rem' }}>Commandes clôturées : {bilan.nbCommandes}</div>
                    </div>
                  );
                })()}
                <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button className="pos-btn" onClick={cloturerZDefinitif} style={{ width: '100%', padding: '14px', background: COLORS.danger, color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <Icon name="printer" size={16} /> Imprimer Z et remettre à zéro
                  </button>
                  <button className="pos-btn" onClick={() => setShowBilanGlobal(false)} style={{ width: '100%', padding: '12px', background: COLORS.bg, color: COLORS.textMain, border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer' }}>Fermer</button>
                </div>
              </div>
            </div>
          )}

          {/* 1. FILE D'ATTENTE CUISINE ÉPINGLÉE EN HAUT EN PERMANENCE (JAMAIS MASQUÉE PAR L'HISTORIQUE) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, letterSpacing: '-0.02em' }}>File d'attente Cuisine (Commandes Web en direct)</h3>
            <span className="num-tabular" style={{ background: commandesWebEnAttente > 0 ? COLORS.danger : COLORS.secondary, color: 'white', padding: '2px 8px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '600' }}>{commandesWebEnAttente}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '14px', marginBottom: '32px' }}>
            {commandesWebEnAttente === 0 ? (
              <div style={{ gridColumn: '1 / -1', background: 'white', padding: '20px', borderRadius: '12px', border: `1px solid ${COLORS.border}`, color: COLORS.textLight, fontSize: '0.92rem', textAlign: 'center' }}>
                Aucune commande Web en attente pour le moment.
              </div>
            ) : (
              commandes.filter(c => c.status === 'En attente' || c.status === 'En cours de validation').map(cmd => (
                <div key={cmd.id} style={{ background: 'white', borderRadius: '12px', padding: '16px', border: `1px solid ${COLORS.border}`, borderLeft: `4px solid ${COLORS.pending}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', borderBottom: `1px solid ${COLORS.border}`, paddingBottom: '10px', marginBottom: '10px' }}>
                    <div>
                      <strong style={{ fontSize: '1.05rem' }}>{cmd.client || 'Client'}</strong>
                      <div className="num-tabular" style={{ color: COLORS.textMuted, fontSize: '0.88rem', marginTop: '2px' }}>{cmd.tel || 'Sans téléphone'}</div>
                      <div style={{ fontSize: '0.82rem', color: COLORS.textLight, marginTop: '2px' }}>{cmd.type === 'livraison' ? `Livraison : ${cmd.adresse}` : 'À emporter / Sur place'}</div>
                    </div>
                    <div className="num-tabular" style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: COLORS.textMain }}>{cmd.total} DH</div>
                      <div style={{ fontSize: '0.78rem', color: COLORS.textLight }}>{cmd.status}</div>
                    </div>
                  </div>

                  {cmd.commentaire && <div style={{ background: COLORS.bg, color: COLORS.textMain, padding: '8px 10px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600', marginBottom: '10px', border: `1px solid ${COLORS.border}` }}>Note : {cmd.commentaire}</div>}

                  <ul style={{ listStyle: 'none', padding: 0, marginBottom: '14px' }}>
                    {cmd.items?.map((it, i) => {
                      const details = getDetaisImpression(it);
                      return (
                        <li key={i} style={{ padding: '6px 0', borderBottom: `1px solid ${COLORS.border}`, fontSize: '0.9rem' }}>
                          <div className="num-tabular" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <strong><span style={{ color: COLORS.primary }}>{it.qte > 1 ? `${it.qte}x ` : ''}</span>{it.nom}</strong>
                            <span>{it.prixFinal * (it.qte || 1)} DH</span>
                          </div>
                          {details.length > 0 && <div style={{ color: COLORS.textLight, fontSize: '0.8rem', marginTop: '2px' }}>{details.join(' / ')}</div>}
                        </li>
                      );
                    })}
                  </ul>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button className="pos-btn" onClick={() => imprimerCommandeExistante(cmd)} style={{ width: '100%', padding: '9px', background: COLORS.bg, color: COLORS.textMain, border: `1px solid ${COLORS.border}`, borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <Icon name="printer" size={14} /> Imprimer le bon
                    </button>
                    <button className="pos-btn" onClick={() => changerStatus(cmd, cmd.type === 'livraison' ? 'En Livraison' : 'Terminé')} style={{ flex: 2, padding: '9px', background: COLORS.secondary, color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}>
                      {cmd.type === 'livraison' ? 'Expédier en livraison' : 'Marquer comme servi'}
                    </button>
                    <button className="pos-btn" onClick={() => changerStatus(cmd, 'Annulé')} style={{ flex: 1, padding: '9px', background: 'white', color: COLORS.danger, border: `1px solid ${COLORS.border}`, borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}>Annuler</button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 2. HISTORIQUE DES 50 DERNIÈRES COMMANDES (AVEC BOUTON ANNULER À CÔTÉ DE RÉ-IMPRIMER) */}
          {showHistory && (
            <div style={{ background: 'white', padding: '24px', borderRadius: '12px', marginBottom: '36px', border: `1px solid ${COLORS.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, color: COLORS.textMain, letterSpacing: '-0.02em' }}>Historique des 50 Dernières Commandes</h3>
                <button className="pos-btn" onClick={() => setShowHistory(false)} style={{ background: COLORS.bg, border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Fermer l'historique</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '14px' }}>
                {commandes.filter(c => c.status === 'Terminé' || c.status === 'En Livraison' || c.status === 'Annulé').slice(0, 50).map(cmd => (
                  <div key={cmd.id} style={{ border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '16px', opacity: cmd.status === 'Annulé' ? 0.6 : 1, background: COLORS.bg, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${COLORS.border}`, paddingBottom: '10px', marginBottom: '10px' }}>
                        <div>
                          <strong style={{ textDecoration: cmd.status === 'Annulé' ? 'line-through' : 'none' }}>{cmd.client}</strong>
                          <div style={{ fontSize: '0.8rem', color: COLORS.textLight }}>{toJSDate(cmd.date).toLocaleString()}</div>
                          {cmd.caissiere && <div style={{ fontSize: '0.8rem', color: COLORS.textMuted, fontWeight: '500' }}>Opérateur : {cmd.caissiere}</div>}
                        </div>
                        <div className="num-tabular" style={{ textAlign: 'right' }}>
                          <strong style={{ color: COLORS.textMain, fontSize: '1.05rem', textDecoration: cmd.status === 'Annulé' ? 'line-through' : 'none' }}>{cmd.total} DH</strong>
                          <div style={{ fontSize: '0.8rem', fontWeight: '600', color: cmd.status === 'Annulé' ? COLORS.danger : COLORS.success }}>{cmd.status}</div>
                        </div>
                      </div>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.88rem' }}>
                        {cmd.items?.map((it, i) => {
                          const details = getDetaisImpression(it);
                          return (
                            <li key={i} style={{ borderBottom: `1px solid ${COLORS.border}`, padding: '5px 0' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '500' }}>
                                <span>{it.qte > 1 ? `${it.qte}x ` : ''}{it.nom}</span>
                              </div>
                              {details.length > 0 && <div style={{ color: COLORS.textLight, fontSize: '0.8rem', marginTop: '2px' }}>{details.join(' / ')}</div>}
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    <div style={{ marginTop: '14px', display: 'flex', gap: '8px' }}>
                      <button className="pos-btn" onClick={() => imprimerCommandeExistante(cmd)} style={{ flex: 1, padding: '9px', background: 'white', color: COLORS.textMain, border: `1px solid ${COLORS.border}`, borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.84rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <Icon name="printer" size={14} /> Ré-imprimer
                      </button>
                      {cmd.status !== 'Annulé' && (
                        <button className="pos-btn" onClick={() => changerStatus(cmd, 'Annulé')} style={{ padding: '9px 12px', background: 'white', color: COLORS.danger, border: `1px solid ${COLORS.border}`, borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.84rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <Icon name="ban" size={14} /> Annuler
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* GESTION DES STOCKS */}
          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', marginBottom: '32px', border: `1px solid ${COLORS.border}` }}>
            <h3 style={{ margin: '0 0 16px 0', color: COLORS.textMain, fontSize: '1.15rem', letterSpacing: '-0.02em' }}>Disponibilité des Ingrédients & Stocks</h3>

            <div style={{ overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '8px', display: 'flex', gap: '6px', marginBottom: '16px', scrollbarWidth: 'none' }}>
              {STOCK_TABS.map(tab => (
                <button key={tab.id} className="pos-btn" onClick={() => setActiveStockTab(tab.id)} style={{ padding: '8px 16px', borderRadius: '8px', background: activeStockTab === tab.id ? COLORS.secondary : COLORS.bg, color: activeStockTab === tab.id ? 'white' : COLORS.textMain, fontWeight: '600', fontSize: '0.9rem', border: 'none', cursor: 'pointer' }}>{tab.label}</button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <input type="text" placeholder={`Ajouter dans ${STOCK_TABS.find(t => t.id === activeStockTab)?.label}...`} value={newItemName} onChange={(e) => setNewItemName(e.target.value)} style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '0.95rem' }} />
              <button className="pos-btn" onClick={addNewStockItem} style={{ padding: '10px 18px', background: COLORS.secondary, color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Ajouter</button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {(parametres.stocks[activeStockTab] || []).map((item, index) => (
                <button key={index} className="pos-btn" onClick={() => toggleStockItem(activeStockTab, index)} style={{ padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', background: item.available ? 'white' : '#FEF2F2', color: item.available ? COLORS.textMain : COLORS.danger, border: `1px solid ${item.available ? COLORS.border : COLORS.danger}`, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <StatusDot active={item.available} colorInactive={COLORS.danger} />
                  <span>{item.nom}</span>
                </button>
              ))}
            </div>
          </div>

          {/* GESTION DE LA CARTE (PRODUITS + UPLOAD PHOTO DIRECT SANS CODE) */}
          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', marginBottom: '32px', border: `1px solid ${COLORS.border}` }}>
            <h3 style={{ margin: '0 0 16px 0', letterSpacing: '-0.02em', fontSize: '1.15rem' }}>Catalogue des Produits & Photos</h3>
            <div style={{ overflowX: 'auto', display: 'flex', gap: '6px', paddingBottom: '12px', marginBottom: '12px' }}>
              {categoriesList.map(c => (
                <button key={c} className="pos-btn" onClick={() => setAdminCategorie(c)} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: adminCategorie === c ? COLORS.secondary : COLORS.bg, color: adminCategorie === c ? 'white' : COLORS.textMain, cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', flexShrink: 0 }}>{c}</button>
              ))}
            </div>

            {menu.filter(p => p.categorie === adminCategorie).map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: `1px solid ${COLORS.border}`, background: p.available === false ? COLORS.bg : 'white', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Vignette cliquable pour changer l'image directement */}
                  <label title="Cliquer pour ajouter ou changer la photo" style={{ width: '44px', height: '44px', borderRadius: '8px', background: COLORS.bg, border: `1px solid ${COLORS.border}`, overflow: 'hidden', position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {p.image ? (
                      <img src={p.image} alt={p.nom} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <Icon name="image" size={18} color={COLORS.textLight} />
                    )}
                    <input type="file" accept="image/*" onChange={(e) => handleDirectProductImageUpload(p.id, e.target.files[0])} style={{ display: 'none' }} />
                  </label>

                  <button className="pos-btn" onClick={() => toggleAvailability(p)} style={{ padding: '6px 12px', border: `1px solid ${COLORS.border}`, borderRadius: '8px', background: 'white', color: COLORS.textMain, fontWeight: '600', fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <StatusDot active={p.available !== false} colorInactive={COLORS.danger} />
                    <span>{p.available !== false ? 'En ligne' : 'Rupture'}</span>
                  </button>

                  <div className="num-tabular" style={{ fontWeight: '600', fontSize: '0.98rem', textDecoration: p.available === false ? 'line-through' : 'none', color: p.available === false ? COLORS.textLight : COLORS.textMain }}>
                    {p.nom}
                    {p.excludeVIP && <span style={{ fontSize: '0.75rem', color: COLORS.danger, marginLeft: '8px', fontWeight: '600' }}>[Hors VIP]</span>}
                    <span style={{ color: COLORS.textLight, fontWeight: 'normal', marginLeft: '8px' }}>— {p.variantes?.length > 0 ? 'Multi-tailles' : `${p.prix} DH`}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="pos-btn" onClick={() => { setEditId(p.id); setFormProd({ nom: p.nom, description: p.description || '', image: p.image || '', categorie: p.categorie, prixBase: p.prix || '', variantes: p.variantes || [], excludeVIP: p.excludeVIP || false }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ border: `1px solid ${COLORS.border}`, background: 'white', padding: '7px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icon name="edit" size={14} /> Modifier
                  </button>
                  <button className="pos-btn" onClick={() => supprimerProduit(p.id, p.nom)} style={{ color: COLORS.danger, border: `1px solid ${COLORS.border}`, background: 'white', padding: '7px 10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <Icon name="trash" size={14} />
                  </button>
                </div>
              </div>
            ))}

            <div style={{ marginTop: '24px', background: COLORS.bg, padding: '20px', borderRadius: '12px', border: `1px solid ${COLORS.border}` }}>
              <h4 style={{ marginTop: 0, fontSize: '1rem' }}>{editId ? 'Modifier le produit sélectionné' : 'Ajouter un nouveau produit'}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <input placeholder="Nom du produit" value={formProd.nom} onChange={e => setFormProd({ ...formProd, nom: e.target.value })} style={{ flex: 2, minWidth: '200px', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '0.95rem' }} />
                  <input placeholder="Description / ingrédients (affiché sur l'App Client)" value={formProd.description} onChange={e => setFormProd({ ...formProd, description: e.target.value })} style={{ flex: 3, minWidth: '240px', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '0.95rem' }} />
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select value={formProd.categorie} onChange={handleCategoryChange} style={{ flex: 1, minWidth: '180px', padding: '10px 12px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '0.95rem', background: 'white' }}>
                    {categoriesList.map(cat => <option key={cat}>{cat}</option>)}
                  </select>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.88rem', color: COLORS.textMain, padding: '9px 14px', background: 'white', borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>
                    <Icon name="image" size={15} color={COLORS.primary} />
                    <span>{formProd.image ? 'Photo chargée (Changer)' : 'Uploader une photo'}</span>
                    <input type="file" accept="image/*" onChange={(e) => compresserImageProduit(e.target.files[0], (b64) => setFormProd(prev => ({ ...prev, image: b64 })))} style={{ display: 'none' }} />
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.88rem', color: COLORS.textMain, padding: '9px 14px', background: 'white', borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>
                    <input type="checkbox" checked={formProd.excludeVIP} onChange={e => setFormProd({ ...formProd, excludeVIP: e.target.checked })} style={{ width: '16px', height: '16px' }} />
                    Exclure des remises fidélité VIP
                  </label>
                </div>

                {formProd.variantes && formProd.variantes.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                    {formProd.variantes.map((v, index) => (
                      <div key={index} style={{ background: 'white', padding: '12px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: '600' }}>Taille {v.nom}</label>
                        <input type="number" className="num-tabular" placeholder="Prix DH" value={v.prix} onChange={(e) => {
                          const newVars = [...formProd.variantes];
                          newVars[index].prix = Number(e.target.value);
                          setFormProd({ ...formProd, variantes: newVars });
                        }} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${COLORS.border}`, marginTop: '6px', boxSizing: 'border-box' }} />
                        <label style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', cursor: 'pointer', color: COLORS.textMuted }}>
                          <input type="checkbox" checked={v.available !== false} onChange={(e) => {
                            const newVars = [...formProd.variantes];
                            newVars[index].available = e.target.checked;
                            setFormProd({ ...formProd, variantes: newVars });
                          }} style={{ width: '15px', height: '15px' }} /> Disponible
                        </label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <input type="number" className="num-tabular" placeholder="Prix unique en DH (ex: 45)" value={formProd.prixBase} onChange={e => setFormProd({ ...formProd, prixBase: e.target.value })} style={{ padding: '10px 12px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '0.95rem' }} />
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="pos-btn" onClick={saveProduit} style={{ flex: 1, padding: '12px', background: COLORS.secondary, color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer' }}>{editId ? 'Enregistrer les modifications' : 'Ajouter à la carte'}</button>
                  {editId && <button className="pos-btn" onClick={() => { setEditId(null); setFormProd({ nom: '', description: '', image: '', categorie: categoriesList[0] || 'Panuozzo', prixBase: '', variantes: [], excludeVIP: false }); }} style={{ padding: '12px 20px', background: 'white', color: COLORS.textMain, border: `1px solid ${COLORS.border}`, borderRadius: '8px', fontSize: '0.95rem', fontWeight: '600', cursor: 'pointer' }}>Annuler</button>}
                </div>
              </div>
            </div>
          </div>

          {/* CRM CLIENTS (AVEC ÉDITION DU NOM EN DIRECT + STATUT VIP FIXE vs AUTO 30 JOURS) */}
          <div style={{ background: 'white', padding: '24px', borderRadius: '12px', marginBottom: '40px', border: `1px solid ${COLORS.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <h3 style={{ margin: 0, color: COLORS.textMain, fontSize: '1.15rem', letterSpacing: '-0.02em' }}>Base Clients & Fidélité (CRM)</h3>
              <span style={{ fontSize: '0.82rem', color: COLORS.textLight }}>Expiration automatique après 30 jours sans commande (sauf VIP Fixe protégé)</span>
            </div>

            <div style={{ background: COLORS.bg, padding: '16px', borderRadius: '8px', marginBottom: '20px', border: `1px solid ${COLORS.border}` }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input type="tel" className="num-tabular" placeholder="Téléphone (06...)" value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} style={{ flex: 1, minWidth: '140px', padding: '10px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }} />
                <input type="text" placeholder="Nom complet" value={newClientName} onChange={e => setNewClientName(e.target.value)} style={{ flex: 2, minWidth: '180px', padding: '10px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }} />
                <input type="number" className="num-tabular" placeholder="Nb commandes" value={newClientOrders} onChange={e => setNewClientOrders(e.target.value)} style={{ width: '120px', padding: '10px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }} />
                <input type="number" className="num-tabular" placeholder="Remise (%)" value={newClientRemise} onChange={e => setNewClientRemise(e.target.value)} style={{ width: '110px', padding: '10px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'white', padding: '9px 12px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer' }}>
                  <input type="checkbox" checked={newClientManualVIP} onChange={e => setNewClientManualVIP(e.target.checked)} />
                  VIP Fixe (Sans expiration)
                </label>
                <button className="pos-btn" onClick={ajouterClientManuel} disabled={loading} style={{ padding: '10px 18px', background: COLORS.secondary, color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Ajouter</button>
              </div>
            </div>

            <div style={{ maxHeight: '380px', overflowY: 'auto', border: `1px solid ${COLORS.border}`, borderRadius: '8px' }}>
              <table className="num-tabular" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead style={{ position: 'sticky', top: 0, background: COLORS.bg, zIndex: 10 }}>
                  <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <th style={{ padding: '10px 12px' }}>Téléphone</th>
                    <th style={{ padding: '10px 12px' }}>Nom (Modifiable)</th>
                    <th style={{ padding: '10px 12px' }}>Statut VIP</th>
                    <th style={{ padding: '10px 12px' }}>Commandes</th>
                    <th style={{ padding: '10px 12px' }}>Remise (%)</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {[...clientsDB].sort((a, b) => (b.totalCommandes || 0) - (a.totalCommandes || 0)).map(client => {
                    const stVip = evaluerStatutVIP(client);
                    return (
                      <tr key={client.id} style={{ borderBottom: `1px solid ${COLORS.border}`, opacity: stVip.isExpired ? 0.65 : 1 }}>
                        <td style={{ padding: '10px 12px', fontWeight: '600' }}>{client.tel}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <input
                            type="text"
                            defaultValue={client.nom || ''}
                            placeholder="Saisir un nom..."
                            onBlur={(e) => {
                              const newVal = e.target.value.trim();
                              if (newVal && newVal !== client.nom) {
                                updateDoc(doc(db, "clients", client.id), { nom: newVal });
                                notify(`Nom mis à jour : ${newVal}`, "success");
                              }
                            }}
                            style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${COLORS.border}`, fontWeight: '600', width: '170px', fontSize: '0.88rem' }}
                          />
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <button
                            className="pos-btn"
                            title="Cliquer pour activer/désactiver la protection VIP Fixe (sans expiration 30j)"
                            onClick={() => updateDoc(doc(db, "clients", client.id), { isManualVIP: !client.isManualVIP })}
                            style={{
                              padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '700', fontSize: '0.75rem',
                              border: `1px solid ${client.isManualVIP ? COLORS.secondary : COLORS.border}`,
                              background: client.isManualVIP ? COLORS.secondary : (stVip.isVipActif ? '#ECFDF5' : (stVip.isExpired ? '#FEF2F2' : 'white')),
                              color: client.isManualVIP ? 'white' : (stVip.isVipActif ? COLORS.success : (stVip.isExpired ? COLORS.danger : COLORS.textLight)),
                              display: 'inline-flex', alignItems: 'center', gap: '5px'
                            }}
                          >
                            {client.isManualVIP && <Icon name="shield" size={12} color="white" />}
                            <span>{stVip.label}</span>
                          </button>
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: '600' }}>{client.totalCommandes || 0}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={client.remiseAuto || 0}
                            onChange={(e) => {
                              const val = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                              updateDoc(doc(db, "clients", client.id), { remiseAuto: val });
                            }}
                            style={{ width: '56px', padding: '6px', borderRadius: '6px', border: `1px solid ${COLORS.border}`, fontWeight: '600' }}
                          /> %
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <button
                            className="pos-btn"
                            onClick={() => requestConfirm("Supprimer le client", `Retirer ${client.nom} (${client.tel}) de la base CRM ?`, () => deleteDoc(doc(db, "clients", client.id)), true, "Supprimer")}
                            style={{ background: 'white', color: COLORS.danger, border: `1px solid ${COLORS.border}`, padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.82rem' }}
                          >
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

const printStyles = `
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    color: #09090B;
  }

  .num-tabular {
    font-variant-numeric: tabular-nums;
  }

  .pos-btn {
    transition: transform 150ms cubic-bezier(0.22, 1, 0.36, 1), opacity 150ms ease, box-shadow 150ms ease, border-color 150ms ease;
    will-change: transform;
    user-select: none;
  }
  .pos-btn:active:not(:disabled) {
    transform: scale(0.97);
  }

  .pos-card {
    transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 160ms cubic-bezier(0.22, 1, 0.36, 1), border-color 160ms ease;
  }
  .pos-card:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px -4px rgba(0, 0, 0, 0.06);
    border-color: #D4D4D8 !important;
  }

  @keyframes modalIn {
    from { opacity: 0; transform: scale(0.97) translateY(4px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
  .modal-box {
    animation: modalIn 160ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }

  @media print {
    @page { margin: 0; size: 80mm auto; }
    body, html, #root { background: white !important; height: auto !important; min-height: auto !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; }
    .no-print { display: none !important; }
    .print-only { display: block !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 80mm !important; color: black !important; background: white !important; font-family: 'Courier New', monospace; }
    .ticket-80mm { width: 75mm; margin: 0 auto; padding-bottom: 20px; }
    .page-break { page-break-after: always; }
  }
  @media screen { .print-only { display: none !important; } }

  @keyframes blinkAlert {
    0% { opacity: 1; }
    50% { opacity: 0.72; }
    100% { opacity: 1; }
  }
  .blink-alert { animation: blinkAlert 1.2s infinite ease-in-out; }
`;

export default function App() {
  return (
    <ErrorBoundary>
      <style>{printStyles}</style>
      <FoodjiSystem />
    </ErrorBoundary>
  );
}
