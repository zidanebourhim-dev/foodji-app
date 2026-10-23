import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from './firebase';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  deleteDoc,
  updateDoc,
  query,
  writeBatch,
  getDocs,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import './App.css';

const PHONE_NUMBER = "0537536689";
const RESTO_COORDS = { lat: 33.997484, lng: -6.735644 };

// PALETTE CALIBRÉE (90% NEUTRAL ZINC / 10% INTENTIONAL ACCENT)
const COLORS = {
  primary: '#A84438',
  primaryHover: '#8F372C',
  secondary: '#18181B', // Zinc 900
  darkBg: '#09090B',    // Zinc 950
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
  pending: '#F97316'
};

// MOTEUR D'ICÔNES VECTORIELLES SVG (TRAIT FIN 1.75PX - ZÉRO ÉMOJI)
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
    case 'plus':
      return <svg {...props}><path d="M12 5v14"/><path d="M5 12h14"/></svg>;
    case 'minus':
      return <svg {...props}><path d="M5 12h14"/></svg>;
    case 'check':
      return <svg {...props}><polyline points="20 6 9 17 4 12"/></svg>;
    case 'x':
      return <svg {...props}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
    case 'bag':
      return <svg {...props}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>;
    case 'truck':
      return <svg {...props}><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>;
    case 'utensils':
      return <svg {...props}><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>;
    case 'mapPin':
      return <svg {...props}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>;
    case 'phone':
      return <svg {...props}><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>;
    case 'tag':
      return <svg {...props}><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>;
    case 'lock':
      return <svg {...props}><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
    case 'arrowLeft':
      return <svg {...props}><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>;
    case 'chevronRight':
      return <svg {...props}><path d="m9 18 6-6-6-6"/></svg>;
    case 'trash':
      return <svg {...props}><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>;
    case 'edit':
      return <svg {...props}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>;
    case 'copy':
      return <svg {...props}><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>;
    case 'download':
      return <svg {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
    case 'receipt':
      return <svg {...props}><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/></svg>;
    case 'alert':
      return <svg {...props}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
    case 'clock':
      return <svg {...props}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
    default:
      return null;
  }
};

// PASTILLE GÉOMÉTRIQUE D'ÉTAT
const StatusDot = ({ active, colorActive = COLORS.success, colorInactive = COLORS.danger }) => (
  <span style={{
    display: 'inline-block',
    width: '7px',
    height: '7px',
    borderRadius: '999px',
    backgroundColor: active ? colorActive : colorInactive,
    boxShadow: active ? `0 0 0 3px ${colorActive}26` : 'none',
    flexShrink: 0
  }} />
);

const INIT_VIANDES = [
  { nom: "Poulet", available: true }, { nom: "Viande Hachée", available: true },
  { nom: "Cordon Bleu", available: true }, { nom: "Nuggets", available: true },
  { nom: "Poulet Crispy", available: true }
];
const INIT_GARNITURES_PIZZA = [
  { nom: "Viande Hachée", available: true }, { nom: "Poulet", available: true },
  { nom: "4 Fromages", available: true }, { nom: "Cannibale", available: true },
  { nom: "Pepperoni", available: true }, { nom: "Thon", available: true },
  { nom: "Charcuterie", available: true }, { nom: "Végétarienne", available: true },
  { nom: "Fruits de Mer", available: true }
];
const INIT_SAUCES = [
  { nom: "Algérienne Fait Maison", available: true }, { nom: "Biggy Fait Maison", available: true },
  { nom: "Barbecue Fait Maison", available: true }, { nom: "Pas de sauce", available: true }
];
const INIT_PATES = [
  { nom: "Penne", available: true }, { nom: "Tagliatelle", available: true },
  { nom: "Spaghetti", available: true }
];
const INIT_TAILLES_PIZZA = [
  { nom: "M", available: true }, { nom: "L", available: true }
];

const EXTRAS_PIZZA = [
  { nom: "Extra Champignons", prix: 10 },
  { nom: "Extra Mozzarella", prix: 10 },
  { nom: "Extra Parmesan", prix: 15 },
  { nom: "Extra Cheddar", prix: 15 }
];

const TACOS_EXTRAS = {
  "Sauce Fromagère": 10,
  "Supplément Cheddar": 7,
  "Supplément Mozzarella": 7,
  "Gratinage": 7
};

const RETRAIT_INGREDIENTS = ["Sans Tomate", "Sans Salade", "Sans Oignons", "Sans Cornichons", "Sans Sauce"];
// Correction : "4 saisons" et "2 saisons" sont éligibles à l'offre du Dimanche
const PIZZAS_EXCLUES_PROMO = ["fruits de mer", "cannibale"];
const TOUTES_CATEGORIES = ["Tacos", "Pizzas", "Burgers", "Panuozzo", "Pâtes", "Sides", "Les Burritos", "Koniks", "Plats", "Salades", "Boissons", "Desserts"];

const STOCK_TABS = [
  { id: 'viandes', label: 'Viandes' },
  { id: 'garnitures', label: 'Garnitures' },
  { id: 'tailles_pizza', label: 'Tailles Pizza' },
  { id: 'pates', label: 'Pâtes' },
  { id: 'sauces', label: 'Sauces' }
];

const NOTIF_SOUND = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

const logoImg = "/logo.png";
const iconImg = "/icon.png";

const WELCOME_TOKEN_REF = "START2026";
const POURCENTAGE_REMISE = 0.20;
const SYNC_ID_VERSION = "053700";

const seoConfig = {
  title: "Foodji - Le Fait Maison à Sala Al Jadida | Burgers & Tacos (Jusqu'à 2h)",
  description: "Découvrez le vrai goût du Fait Maison chez Foodji : Burgers, Tacos gratinés et Pizzas préparés à la minute. Livraison sur Sala Al Jadida jusqu'à 2h du matin.",
  keywords: "restaurant sala al jadida, livraison burger, tacos technopolis, cuisine minute, uir, pizza nuit, fait maison",
  image: "https://foodji.ma/promo.jpg",
  url: "https://foodji.ma"
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "Foodji",
  "image": seoConfig.image,
  "description": "Foodji propose une cuisine minute à Sala Al Jadida : Burgers gourmets, Tacos gratinés et Pizzas préparés à la commande.",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Sala Al Jadida",
    "addressRegion": "Rabat-Salé-Kénitra",
    "addressCountry": "MA"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 33.997484,
    "longitude": -6.735644
  },
  "url": seoConfig.url,
  "telephone": "+212537536689",
  "priceRange": "$$",
  "servesCuisine": ["Burger", "Tacos", "Pizza", "Cuisine Minute"]
};

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('landing');

  // SYSTÈME DE TOASTS & MODALE DE CONFIRMATION / PIN (ZÉRO ALERT/PROMPT NATIFS)
  const [toasts, setToasts] = useState([]);
  const [confirmModal, setConfirmModal] = useState({ active: false, title: '', message: '', requirePin: false, pinValue: '', confirmLabel: 'Confirmer', danger: false, onConfirm: null });

  const notify = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 2800);
  };

  const requestConfirm = (title, message, onConfirm, danger = false, confirmLabel = 'Confirmer', requirePin = false) => {
    setConfirmModal({ active: true, title, message, confirmLabel, danger, requirePin, pinValue: '', onConfirm });
  };

  const [menu, setMenu] = useState([]);
  const [commandes, setCommandes] = useState([]);

  const prevCommandesLength = useRef(null);
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showPromoWizard, setShowPromoWizard] = useState(false);
  const [promoTacosSheet, setPromoTacosSheet] = useState({ active: false, initialSize: 'L' });
  const [showCGV, setShowCGV] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [isMenuLoading, setIsMenuLoading] = useState(true);

  const [categorieActive, setCategorieActive] = useState('');
  const [adminCategorie, setAdminCategorie] = useState('');

  const [parametresStatus, setParametresStatus] = useState({
    rushMode: 'standard',
    promoDuoActive: false,
    promoDimancheActive: false,
    promoTacosActive: true
  });
  const [isStoreOpen, setIsStoreOpen] = useState(true);

  const [stocks, setStocks] = useState({
    viandes: INIT_VIANDES,
    garnitures: INIT_GARNITURES_PIZZA,
    sauces: INIT_SAUCES,
    pates: INIT_PATES,
    tailles_pizza: INIT_TAILLES_PIZZA
  });
  const [activeStockTab, setActiveStockTab] = useState('viandes');
  const [newItemName, setNewItemName] = useState('');

  const [panier, setPanier] = useState([]);
  const [clientNom, setClientNom] = useState('');
  const [clientTel, setClientTel] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [typeCommande, setTypeCommande] = useState('livraison');
  const [adresse, setAdresse] = useState('');

  const [codePromo, setCodePromo] = useState('');
  const [remiseAppliquee, setRemiseAppliquee] = useState(0);
  const [isPromoValidee, setIsPromoValidee] = useState(false);

  const [distanceClient, setDistanceClient] = useState(null);
  const [clientCoords, setClientCoords] = useState(null);
  const [showDistanceBlocker, setShowDistanceBlocker] = useState(false);

  const [derniereCommande, setDerniereCommande] = useState(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [editId, setEditId] = useState(null);
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [categorie, setCategorie] = useState('Burgers');
  const [prixBase, setPrixBase] = useState('');
  const [variantes, setVariantes] = useState([]);

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIosInstall, setShowIosInstall] = useState(false);

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  useEffect(() => {
    try {
      const savedNom = localStorage.getItem('clientNom');
      const savedTel = localStorage.getItem('clientTel');
      const savedAdresse = localStorage.getItem('clientAdresse');
      const savedTicket = localStorage.getItem('derniereCommande');

      if (savedNom) setClientNom(savedNom);
      if (savedTel) setClientTel(savedTel);
      if (savedAdresse) setAdresse(savedAdresse);
      if (savedTicket) setDerniereCommande(JSON.parse(savedTicket));
    } catch (e) {
      console.error("Erreur lecture localStorage:", e);
    }
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => setUser(u));

    const unsubMenu = onSnapshot(collection(db, "produits"), (snap) => {
      setMenu(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsMenuLoading(false);
    });

    const unsubStatus = onSnapshot(doc(db, "parametres", "status"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setParametresStatus({
          rushMode: data.mode || 'standard',
          promoDuoActive: data.promoDuoActive || false,
          promoDimancheActive: data.promoDimancheActive || false,
          promoTacosActive: data.promoTacosActive !== undefined ? data.promoTacosActive : true
        });
      }
    });

    const unsubHoraires = onSnapshot(doc(db, "parametres", "horaires"), (docSnap) => {
      if (docSnap.exists()) setIsStoreOpen(docSnap.data().isOuvert !== false);
    });

    const unsubStocks = onSnapshot(doc(db, "parametres", "stocks"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setStocks({
          viandes: data.viandes || INIT_VIANDES,
          garnitures: data.garnitures || INIT_GARNITURES_PIZZA,
          sauces: data.sauces || INIT_SAUCES,
          pates: data.pates || INIT_PATES,
          tailles_pizza: data.tailles_pizza || INIT_TAILLES_PIZZA
        });
      }
    });

    return () => { unsubAuth(); unsubMenu(); unsubStatus(); unsubStocks(); unsubHoraires(); };
  }, []);

  useEffect(() => {
    if (!user) {
      setCommandes([]);
      return;
    }

    const q = query(collection(db, "commandes"), orderBy("date", "desc"), limit(100));
    const unsubscribeCmd = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));

      if (prevCommandesLength.current !== null && list.length > prevCommandesLength.current) {
        if (!audioRef.current) audioRef.current = new Audio(NOTIF_SOUND);
        audioRef.current.play().catch(() => {});
      }
      prevCommandesLength.current = list.length;
      setCommandes(list);
    });

    return () => unsubscribeCmd();
  }, [user]);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    const hasRefused = localStorage.getItem('iosInstallRefused');

    if (isIos && !isStandalone && !hasRefused) {
      setShowIosInstall(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const closeIosInstall = () => {
    setShowIosInstall(false);
    localStorage.setItem('iosInstallRefused', 'true');
  };

  const categoriesReelles = [...new Set(menu.map(p => p.categorie))].filter(Boolean);
  const categoriesSelectAdmin = [...new Set([...TOUTES_CATEGORIES, ...categoriesReelles])];

  useEffect(() => {
    if (categoriesReelles.length > 0 && !adminCategorie) setAdminCategorie(categoriesReelles[0]);
  }, [menu, adminCategorie]);

  const categoriesClient = [...categoriesReelles];

  useEffect(() => {
    if (categoriesClient.length > 0 && (!categorieActive || !categoriesClient.includes(categorieActive))) {
      setCategorieActive(categoriesClient[0]);
    }
  }, [menu, categorieActive]);

  const menuClient = menu.filter(p => p.categorie === categorieActive && p.available !== false);

  let menuAdmin = [];
  if (adminCategorie === 'RUPTURE') menuAdmin = menu.filter(p => p.available === false);
  else menuAdmin = menu.filter(p => p.categorie === adminCategorie);

  const triggerImport = () => {
    requestConfirm(
      "Importation Catalogue CSV",
      "Entrez le code Manager pour autoriser l'importation d'un fichier CSV :",
      () => fileInputRef.current.click(),
      false,
      "Déverrouiller",
      true
    );
  };

  const handleCSVImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      const rows = text.split('\n').filter(r => r.trim() !== '');
      requestConfirm(
        "Confirmer l'importation",
        `Voulez-vous importer ${rows.length} lignes dans le catalogue ?`,
        async () => {
          setLoading(true);
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const tokens = row.split(',');
            if (tokens.length >= 5) {
              const cat = tokens[0].trim(); const name = tokens[1].trim();
              const len = tokens.length;
              const p1Raw = tokens[len - 3]; const p2Raw = tokens[len - 2]; const p3Raw = tokens[len - 1];
              const clean = (val) => val ? Number(val.toString().replace(/[^0-9.]/g, '')) : 0;
              const p1 = clean(p1Raw.replace(',', '.')); const p2 = clean(p2Raw.replace(',', '.')); const p3 = clean(p3Raw.replace(',', '.'));
              let vars = [];
              if (p2 > 0 || p3 > 0) {
                let n1 = "Standard", n2 = "Moyen", n3 = "Grand";
                if (cat.toLowerCase().includes('tacos')) { n1 = "L"; n2 = "XL"; n3 = "XXL"; }
                else if (cat.toLowerCase().includes('pizza')) { n1 = "M"; n2 = "L"; n3 = "XL"; }
                if (p1 > 0) vars.push({ nom: n1, prix: p1, available: true });
                if (p2 > 0) vars.push({ nom: n2, prix: p2, available: true });
                if (p3 > 0) vars.push({ nom: n3, prix: p3, available: true });
              }
              if (name && cat) await addDoc(collection(db, "produits"), { categorie: cat, nom: name, description: tokens.slice(2, len - 3).join(', ').replace(/"/g, ''), prix: vars.length > 0 ? 0 : p1, image: '', variantes: vars, date: new Date(), available: true });
            }
          }
          setLoading(false);
          notify("Importation CSV terminée", "success");
          e.target.value = null;
        },
        false,
        "Importer"
      );
    };
    reader.readAsText(file);
  };

  const viderMenu = () => {
    requestConfirm(
      "Réinitialisation totale du catalogue",
      "Cette action supprimera tous les produits du menu. Entrez le code Manager pour confirmer :",
      async () => {
        setLoading(true);
        const batch = writeBatch(db);
        menu.forEach(p => { batch.delete(doc(db, "produits", p.id)); });
        await batch.commit();
        setLoading(false);
        notify("Catalogue entièrement vidé", "info");
      },
      true,
      "Tout supprimer",
      true
    );
  };

  const handleStaffAccess = () => {
    if (user) setView('admin');
    else setView('login');
  };

  const ajouterAuPanier = (itemMerged) => {
    if (itemMerged.isPromoTrigger) { setShowPromoWizard(true); return; }
    setPanier(prev => [...prev, { ...itemMerged, qte: 1, uniqueId: Date.now() + Math.random() }]);
    setSelectedProduct(null);
    notify("Ajouté à votre commande", "success");
  };

  const ajouterLotAuPanier = (lotPizzas) => {
    setPanier(prev => [...prev, ...lotPizzas.map((p, index) => ({ ...p, qte: 1, uniqueId: Date.now() + index + Math.random() }))]);
    setShowPromoWizard(false);
    notify("Pack 3 Pizzas ajouté au panier", "success");
  };

  const ajouterOptionFritesBoissonPromo = () => {
    setPanier(prev => [...prev, {
      id: 'supplement_promo_tacos_menu',
      categorie: 'Suppléments',
      varianteNom: null,
      nom: 'Option Promo : Frites + Boisson 1L',
      extraPrice: 15,
      prixFinal: 15,
      isPromoPack: true,
      detailsTxt: ['[OPTION +15DH] Avec Frites + Boisson 1L pour Promo Tacos'],
      qte: 1,
      uniqueId: Date.now() + Math.random()
    }]);
    notify("Option Frites + Boisson 1L (+15 DH) ajoutée", "success");
  };

  const retirerDuPanier = (uid) => setPanier(prev => prev.filter(i => i.uniqueId !== uid));

  const getPrixItemAjuste = (item) => {
    let prix = Number(item.prixFinal) || 0;
    if (item.nom.toLowerCase().includes("pep's") && (typeCommande === 'livraison' || typeCommande === 'emporter')) prix += 5;
    return prix;
  };

  // MOTEUR DE CALCUL ALIGNÉ SUR LE POS FOODJI (AVEC PROMO DIMANCHE 2/4 SAISONS + PROMO TACOS 55/89 DH)
  const calculerTotalInterne = () => {
    let sousTotal = 0;
    let pizzasDimanchePrices = [];
    let eligibleDuoPrices = [];
    let tacosLBasePrices = [];
    let tacosXLBasePrices = [];

    panier.forEach(item => {
      const p = getPrixItemAjuste(item);
      const qte = item.qte || 1;
      sousTotal += (p * qte);

      const vNom = (item.varianteNom || '').trim().toUpperCase();
      const catLower = (item.categorie || '').toLowerCase();
      const isPizza = catLower.includes('pizza');
      const isTacos = catLower.includes('tacos') && !item.isPromoPack;
      const isMoyenne = vNom !== 'L';
      const isExcludedSunday = PIZZAS_EXCLUES_PROMO.some(ex => item.nom.toLowerCase().includes(ex));

      if (parametresStatus.promoDimancheActive && (item.isPromoEligible || (isPizza && isMoyenne && !isExcludedSunday))) {
        const basePizzaPrice = Math.max(0, p - (Number(item.extraPrice) || 0));
        for (let i = 0; i < qte; i++) pizzasDimanchePrices.push(basePizzaPrice);
      }

      if (parametresStatus.promoTacosActive && isTacos) {
        const baseTacosPrice = Math.max(0, p - (Number(item.extraPrice) || 0));
        if (vNom === 'L') {
          for (let i = 0; i < qte; i++) tacosLBasePrices.push(baseTacosPrice);
        } else if (vNom === 'XL') {
          for (let i = 0; i < qte; i++) tacosXLBasePrices.push(baseTacosPrice);
        }
      }

      if (parametresStatus.promoDuoActive && !item.isPromoPack) {
        const isSalade = item.categorie === 'Salades';
        const isPeps = item.nom.toLowerCase().includes("pep's");
        const isTacosLarge = isTacos && (vNom === 'L' || vNom === 'XL' || vNom === 'XXL');
        const isPizzaM = isPizza && isMoyenne;

        if (!isSalade && !isPeps && !isTacosLarge && !isPizzaM) {
          for (let i = 0; i < qte; i++) eligibleDuoPrices.push(p);
        }
      }
    });

    let remiseDimanche = 0;
    if (parametresStatus.promoDimancheActive && pizzasDimanchePrices.length >= 3) {
      pizzasDimanchePrices.sort((a, b) => a - b);
      const itemsToDiscount = Math.floor(pizzasDimanchePrices.length / 3);
      for (let i = 0; i < itemsToDiscount; i++) remiseDimanche += pizzasDimanchePrices[i];
    }

    let remiseTacos = 0;
    if (parametresStatus.promoTacosActive) {
      tacosLBasePrices.sort((a, b) => a - b);
      for (let i = 0; i + 1 < tacosLBasePrices.length; i += 2) {
        const pairSum = tacosLBasePrices[i] + tacosLBasePrices[i + 1];
        if (pairSum > 55) remiseTacos += (pairSum - 55);
      }
      tacosXLBasePrices.sort((a, b) => a - b);
      for (let i = 0; i + 1 < tacosXLBasePrices.length; i += 2) {
        const pairSum = tacosXLBasePrices[i] + tacosXLBasePrices[i + 1];
        if (pairSum > 89) remiseTacos += (pairSum - 89);
      }
    }

    let remiseDuo = 0;
    if (parametresStatus.promoDuoActive && eligibleDuoPrices.length >= 2) {
      eligibleDuoPrices.sort((a, b) => a - b);
      const itemsToDiscount = Math.floor(eligibleDuoPrices.length / 2);
      for (let i = 0; i < itemsToDiscount; i++) remiseDuo += ((Number(eligibleDuoPrices[i]) || 0) * 0.5);
      remiseDuo = Math.round(remiseDuo);
    }

    const remisePromoSysteme = remiseDimanche + remiseDuo + remiseTacos;
    const netApresPromo = sousTotal - remisePromoSysteme;
    const frais = (typeCommande === 'livraison' && netApresPromo > 0 && netApresPromo < 45) ? 7 : 0;

    return { sousTotal, remisePromoSysteme, remiseDimanche, remiseDuo, remiseTacos, fraisLivraison: frais };
  };

  const calculerTotal = () => {
    const { sousTotal, remisePromoSysteme, remiseDimanche, remiseDuo, remiseTacos, fraisLivraison } = calculerTotalInterne();
    const totalAvantRemiseCode = (sousTotal - remisePromoSysteme) + fraisLivraison;
    const totalFinal = Math.max(0, totalAvantRemiseCode - remiseAppliquee);
    return { sousTotal, remisePromo: remisePromoSysteme, remiseDimanche, remiseDuo, remiseTacos, fraisLivraison, grandTotal: totalFinal };
  };

  const { sousTotal, remisePromo, remiseDimanche, remiseDuo, remiseTacos, fraisLivraison, grandTotal } = calculerTotal();

  useEffect(() => {
    if (panier.length === 0) {
      setRemiseAppliquee(0);
      setIsPromoValidee(false);
      setCodePromo('');
    } else if (isPromoValidee) {
      const { sousTotal: st } = calculerTotalInterne();
      setRemiseAppliquee(Math.round(st * POURCENTAGE_REMISE));
    }
  }, [panier, typeCommande]);

  useEffect(() => {
    if (isPromoValidee) {
      setIsPromoValidee(false);
      setRemiseAppliquee(0);
    }
  }, [clientTel]);

  const verifierCodePromo = async () => {
    if (!codePromo.trim()) return notify("Veuillez saisir un code promo", "error");

    const telClean = clientTel.replace(/\s/g, '');
    if (!/^(06|07)\d{8}$/.test(telClean)) {
      return notify("Renseignez d'abord votre numéro de téléphone (06... ou 07...)", "error");
    }

    if (codePromo.trim().toUpperCase() !== WELCOME_TOKEN_REF) {
      return notify("Code promo invalide ou expiré", "error");
    }

    // Vérification locale préalable
    if (derniereCommande && (derniereCommande.tel || '').replace(/\s/g, '') === telClean) {
      return notify("Ce code est réservé à votre première commande", "error");
    }

    setLoading(true);
    try {
      const qCheck = query(collection(db, "commandes"), where("tel", "==", telClean), limit(1));
      const historySnapshot = await getDocs(qCheck);

      if (historySnapshot.empty) {
        const { sousTotal: st } = calculerTotalInterne();
        const montantRemise = Math.round(st * POURCENTAGE_REMISE);
        setRemiseAppliquee(montantRemise);
        setIsPromoValidee(true);
        notify("Remise de bienvenue (-20%) appliquée", "success");
      } else {
        notify("Ce code est réservé aux nouveaux clients", "error");
        setRemiseAppliquee(0);
        setIsPromoValidee(false);
      }
    } catch (e) {
      // Repli sécurisé si les règles Firestore bloquent la lecture publique de la collection commandes
      const { sousTotal: st } = calculerTotalInterne();
      const montantRemise = Math.round(st * POURCENTAGE_REMISE);
      setRemiseAppliquee(montantRemise);
      setIsPromoValidee(true);
      notify("Remise de bienvenue (-20%) appliquée", "success");
    }
    setLoading(false);
  };

  const handleOpenPanier = () => {
    if (panier.length === 0) return notify("Votre panier est vide", "error");
    setGpsLoading(true);

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        const uLat = position.coords.latitude;
        const uLng = position.coords.longitude;
        setClientCoords({ lat: uLat, lng: uLng });
        const dist = calculateDistance(RESTO_COORDS.lat, RESTO_COORDS.lng, uLat, uLng);
        setDistanceClient(dist);
        setGpsLoading(false);
        setView('panier');
      }, () => {
        setGpsLoading(false);
        setDistanceClient(null);
        setClientCoords(null);
        setView('panier');
      }, { timeout: 5000 });
    } else {
      setGpsLoading(false);
      setDistanceClient(null);
      setView('panier');
    }
  };

  const envoyerCommande = async () => {
    if (!isStoreOpen) {
      return notify("Le restaurant est actuellement fermé", "error");
    }
    if (panier.length === 0) return notify("Votre panier est vide", "error");
    if (!clientNom.trim()) return notify("Veuillez indiquer votre nom", "error");

    const telClean = clientTel.replace(/\s/g, '');
    if (!/^(06|07)\d{8}$/.test(telClean)) return notify("Numéro de téléphone invalide (06... ou 07...)", "error");

    if (typeCommande === 'livraison') {
      if (!adresse.trim()) return notify("Veuillez préciser votre adresse complète de livraison", "error");
      if (distanceClient !== null && distanceClient > 10) {
        setShowDistanceBlocker(true);
        return;
      }
      if (distanceClient !== null && distanceClient > 4 && grandTotal < 300) {
        return notify(`Zone ${distanceClient.toFixed(1)} km : minimum de commande de 300 DH en livraison`, "error");
      }
    }

    setLoading(true);
    try {
      localStorage.setItem('clientNom', clientNom.trim());
      localStorage.setItem('clientTel', telClean);
      if (adresse.trim()) localStorage.setItem('clientAdresse', adresse.trim());
    } catch (e) {}

    const hasOptionFritesBoisson = panier.some(it => it.id === 'supplement_promo_tacos_menu');
    const panierFinal = panier.map(item => {
      const pFinal = getPrixItemAjuste(item);
      const isTacos = (item.categorie || '').toLowerCase().includes('tacos') && !item.isPromoPack;
      if (remiseTacos > 0 && isTacos && (item.varianteNom === 'L' || item.varianteNom === 'XL')) {
        const mentionFrites = hasOptionFritesBoisson ? '[OPTION +15DH] Avec Frites + Boisson 1L' : '[SANS FRITES] Offre Promo Tacos';
        const existing = item.detailsTxt || [];
        return {
          ...item,
          prixFinal: pFinal,
          detailsTxt: existing.includes(mentionFrites) ? existing : [mentionFrites, ...existing]
        };
      }
      return { ...item, prixFinal: pFinal };
    });

    let status = 'En attente';
    if (grandTotal >= 300) status = 'En cours de validation';

    let commentaireFinal = commentaire.trim();
    if (isPromoValidee) {
      commentaireFinal = `${commentaireFinal} [CODE PROMO: -${remiseAppliquee} DH]`.trim();
    }

    const data = {
      client: clientNom.trim(),
      tel: telClean,
      type: typeCommande,
      adresse: typeCommande === 'livraison' ? adresse.trim() : '',
      commentaire: commentaireFinal,
      items: panierFinal,
      sousTotal: sousTotal,
      total: grandTotal,
      remisePromo: remiseDimanche,
      remisePromoDimanche: remiseDimanche,
      remisePromoTacos: remiseTacos,
      remisePromoDuo: remiseDuo,
      remise: remisePromo + remiseAppliquee,
      fraisLivraison,
      date: new Date(),
      status,
      distance: distanceClient !== null ? distanceClient.toFixed(2) : 'N/A',
      lat: clientCoords?.lat || 0,
      lng: clientCoords?.lng || 0,
      codePromoUtilise: isPromoValidee ? codePromo : 'NON'
    };

    try {
      const ref = await addDoc(collection(db, "commandes"), data);
      const ticket = { ...data, id: ref.id, date: new Date().toLocaleString() };
      localStorage.setItem('derniereCommande', JSON.stringify(ticket));
      setDerniereCommande(ticket);

      setPanier([]); setCommentaire(''); setCodePromo(''); setRemiseAppliquee(0); setIsPromoValidee(false);
      setView('ticket');
      notify("Commande transmise en cuisine", "success");
    } catch (e) {
      notify("Erreur réseau lors de l'envoi. Veuillez réessayer.", "error");
    }
    setLoading(false);
  };

  const toggleAvailability = async (item) => {
    await updateDoc(doc(db, "produits", item.id), { available: !item.available });
    notify(`${item.nom} : ${!item.available ? 'En ligne' : 'Mis en rupture'}`, 'info');
  };

  const handleCategoryChange = (e) => {
    const cat = e.target.value;
    setCategorie(cat);
    if (!editId) {
      if (cat === 'Tacos') {
        setVariantes([{ nom: 'L', prix: '', available: true }, { nom: 'XL', prix: '', available: true }, { nom: 'XXL', prix: '', available: true }]);
        setPrixBase('');
      } else if (cat === 'Pizzas') {
        setVariantes([{ nom: 'M', prix: '', available: true }, { nom: 'L', prix: '', available: true }]);
        setPrixBase('');
      } else {
        setVariantes([]);
      }
    }
  };

  const handleEdit = (p) => {
    setEditId(p.id);
    setNom(p.nom);
    setDescription(p.description || '');
    setCategorie(p.categorie);
    if (p.variantes && p.variantes.length > 0) {
      setVariantes(p.variantes.map(v => ({ ...v, available: v.available !== false })));
      setPrixBase('');
    } else {
      setVariantes([]);
      setPrixBase(p.prix);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const updateVariantPrice = (index, field, newVal) => {
    const newVars = [...variantes];
    if (field === 'available') newVars[index].available = newVal;
    else newVars[index].prix = Number(newVal);
    setVariantes(newVars);
  };

  const saveProduit = async () => {
    if (!nom.trim()) return notify("Veuillez renseigner le nom du produit", "error");
    setLoading(true);
    const data = {
      nom: nom.trim(),
      description: description.trim(),
      categorie,
      prix: variantes.length > 0 ? 0 : Number(prixBase),
      variantes,
      available: true,
      date: new Date()
    };
    if (image) data.image = image;
    if (editId) {
      await updateDoc(doc(db, "produits", editId), data);
      notify("Produit mis à jour", "success");
      setEditId(null);
    } else {
      await addDoc(collection(db, "produits"), data);
      notify("Produit ajouté à la carte", "success");
    }
    setNom(''); setDescription(''); setImage(''); setPrixBase(''); setVariantes([]);
    setLoading(false);
  };

  const supprimerProduit = (id, nomProd) => {
    requestConfirm(
      "Supprimer le produit",
      `Entrez le code Manager pour supprimer définitivement "${nomProd || 'ce produit'}" :`,
      async () => {
        await deleteDoc(doc(db, "produits", id));
        notify("Produit supprimé", "info");
      },
      true,
      "Supprimer",
      true
    );
  };

  const toggleStockItem = async (listName, index) => {
    const newList = [...(stocks[listName] || [])];
    newList[index].available = !newList[index].available;
    const newData = { ...stocks, [listName]: newList };
    await updateDoc(doc(db, "parametres", "stocks"), newData);
  };

  const addNewStockItem = () => {
    if (!newItemName.trim()) return;
    requestConfirm(
      "Ajouter un ingrédient",
      `Entrez le code Manager pour ajouter "${newItemName.trim()}" au stock :`,
      async () => {
        const newList = [...(stocks[activeStockTab] || []), { nom: newItemName.trim(), available: true }];
        const newData = { ...stocks, [activeStockTab]: newList };
        await updateDoc(doc(db, "parametres", "stocks"), newData);
        setNewItemName('');
        notify("Ingrédient ajouté", "success");
      },
      false,
      "Ajouter",
      true
    );
  };

  const copierOdoo = (cmd) => {
    let t = `Nom : ${cmd.client}\nTél : ${cmd.tel}\n`;
    if (cmd.type === 'livraison') t += `Adresse : ${cmd.adresse}`;
    else t += `Mode : ${cmd.type === 'sur_place' ? 'Sur Place' : 'Emporter'}`;
    if (cmd.commentaire) t += `\nNote : ${cmd.commentaire}`;
    navigator.clipboard.writeText(t).then(() => notify("Coordonnées copiées", "success"));
  };

  const changerStatus = async (id, st) => {
    await updateDoc(doc(db, "commandes", id), { status: st });
    notify(`Statut mis à jour : ${st}`, "info");
  };

  const supprimerCmd = (id) => {
    requestConfirm(
      "Supprimer la commande",
      "Voulez-vous supprimer définitivement cette commande de la liste ?",
      async () => {
        await deleteDoc(doc(db, "commandes", id));
        notify("Commande supprimée", "info");
      },
      true,
      "Supprimer"
    );
  };

  const updateProductImage = async (id, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = document.createElement("img");
      img.src = e.target.result;
      img.onload = async () => {
        const c = document.createElement("canvas");
        const ctx = c.getContext("2d");
        const s = 800 / img.width;
        c.width = 800;
        c.height = img.height * s;
        ctx.drawImage(img, 0, 0, c.width, c.height);
        await updateDoc(doc(db, "produits", id), { image: c.toDataURL("image/jpeg", 0.75) });
        notify("Photo du produit mise à jour", "success");
      };
    };
  };

  const btnStyle = {
    background: COLORS.secondary, color: 'white', border: 'none', borderRadius: '12px',
    padding: '14px 20px', fontWeight: '600', cursor: 'pointer', width: '100%',
    fontSize: '0.98rem'
  };
  const inputStyle = {
    width: '100%', padding: '13px 14px', borderRadius: '8px',
    border: `1px solid ${COLORS.border}`, background: 'white', marginBottom: '10px',
    fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit'
  };
  const cardStyle = {
    background: COLORS.card, borderRadius: '12px', padding: '16px',
    border: `1px solid ${COLORS.border}`
  };

  return (
    <HelmetProvider>
      <style>{uiTasteStyles}</style>
      <div style={{ background: COLORS.bg, minHeight: '100vh', paddingBottom: '110px', color: COLORS.textMain }}>

        <Helmet>
          <title>{seoConfig.title}</title>
          <meta name="description" content={seoConfig.description} />
          <meta name="keywords" content={seoConfig.keywords} />
          <meta property="og:title" content="Foodji - Cuisine Minute à Sala Al Jadida" />
          <meta property="og:description" content={seoConfig.description} />
          <meta property="og:image" content={seoConfig.image} />
          <meta property="og:url" content={seoConfig.url} />
          <meta property="og:type" content="restaurant.menu" />
          <script type="application/ld+json">
            {JSON.stringify(structuredData)}
          </script>
        </Helmet>

        {/* TOASTS FLOTTANTS & MODALE DE CONFIRMATION / PIN */}
        <div style={{ position: 'fixed', top: '16px', right: '16px', left: '16px', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', pointerEvents: 'none' }}>
          {toasts.map(t => (
            <div key={t.id} className="modal-anim" style={{
              background: COLORS.secondary,
              color: '#FAFAFA',
              padding: '11px 16px',
              borderRadius: '12px',
              border: `1px solid ${t.type === 'error' ? COLORS.danger : t.type === 'success' ? COLORS.success : COLORS.darkBorder}`,
              boxShadow: '0 12px 24px -6px rgba(0,0,0,0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '0.88rem',
              fontWeight: '600',
              maxWidth: '400px',
              width: '100%',
              boxSizing: 'border-box',
              pointerEvents: 'auto'
            }}>
              <StatusDot active={t.type !== 'error'} colorActive={t.type === 'success' ? COLORS.success : '#60A5FA'} />
              <span>{t.message}</span>
            </div>
          ))}
        </div>

        {confirmModal.active && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(9, 9, 11, 0.72)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9500, padding: '20px', boxSizing: 'border-box' }}>
            <div className="modal-anim" style={{ background: 'white', padding: '24px', borderRadius: '16px', width: '100%', maxWidth: '400px', border: `1px solid ${COLORS.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <Icon name={confirmModal.requirePin ? 'lock' : 'alert'} size={18} color={confirmModal.danger ? COLORS.danger : COLORS.textMain} />
                <h3 style={{ margin: 0, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>{confirmModal.title}</h3>
              </div>
              <p style={{ margin: '0 0 16px 0', color: COLORS.textMuted, fontSize: '0.92rem', lineHeight: 1.5 }}>{confirmModal.message}</p>

              {confirmModal.requirePin && (
                <input
                  type="password"
                  placeholder="Code Manager"
                  value={confirmModal.pinValue}
                  onChange={e => setConfirmModal({ ...confirmModal, pinValue: e.target.value })}
                  autoFocus
                  style={{ ...inputStyle, textAlign: 'center', fontWeight: '700', letterSpacing: '0.15em', marginBottom: '18px' }}
                />
              )}

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button className="taste-btn" onClick={() => setConfirmModal({ ...confirmModal, active: false })} style={{ padding: '10px 16px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, background: 'white', color: COLORS.textMain, fontWeight: '600', cursor: 'pointer' }}>Annuler</button>
                <button
                  className="taste-btn"
                  onClick={() => {
                    if (confirmModal.requirePin && confirmModal.pinValue !== SYNC_ID_VERSION) {
                      notify("Code Manager incorrect", "error");
                      return;
                    }
                    const fn = confirmModal.onConfirm;
                    setConfirmModal({ ...confirmModal, active: false });
                    if (fn) fn();
                  }}
                  style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: confirmModal.danger ? COLORS.danger : COLORS.secondary, color: 'white', fontWeight: '600', cursor: 'pointer' }}
                >
                  {confirmModal.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        )}

        {showDistanceBlocker && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(9, 9, 11, 0.94)', backdropFilter: 'blur(8px)', zIndex: 9000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '28px', color: 'white', textAlign: 'center', boxSizing: 'border-box' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(239, 68, 68, 0.15)', border: `1px solid ${COLORS.danger}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
              <Icon name="mapPin" size={26} color={COLORS.danger} />
            </div>
            <h2 style={{ fontSize: '1.6rem', color: 'white', margin: '0 0 10px 0', letterSpacing: '-0.03em' }}>Zone hors périmètre de livraison</h2>
            <p style={{ fontSize: '0.98rem', marginBottom: '26px', lineHeight: '1.6', color: '#A1A1AA', maxWidth: '360px' }}>
              Votre position est à <strong className="num-tabular" style={{ color: 'white' }}>{distanceClient ? distanceClient.toFixed(1) : '?'} km</strong>.<br />
              La livraison est assurée dans un rayon de 10 km autour de Sala Al Jadida. Vous pouvez toutefois commander <strong>À Emporter</strong> ou <strong>Sur Place</strong>.
            </p>
            <button className="taste-btn" onClick={() => { setShowDistanceBlocker(false); setTypeCommande('emporter'); }} style={{ background: COLORS.primary, border: 'none', color: 'white', padding: '14px 28px', borderRadius: '12px', fontWeight: '600', fontSize: '1rem', cursor: 'pointer', width: '100%', maxWidth: '300px', marginBottom: '10px' }}>
              Passer en retrait "À Emporter"
            </button>
            <a href={`tel:${PHONE_NUMBER}`} className="taste-btn" style={{ background: '#18181B', border: `1px solid ${COLORS.darkBorder}`, color: 'white', padding: '14px 28px', borderRadius: '12px', textDecoration: 'none', fontWeight: '600', fontSize: '0.95rem', width: '100%', maxWidth: '300px', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Icon name="phone" size={16} /> Appeler le restaurant
            </a>
            <button className="taste-btn" onClick={() => setShowDistanceBlocker(false)} style={{ marginTop: '20px', background: 'transparent', border: 'none', color: '#71717A', padding: '8px 16px', cursor: 'pointer', fontWeight: '500' }}>Fermer</button>
          </div>
        )}

        {showIosInstall && (
          <div className="sheet-anim" style={{
            position: 'fixed', bottom: 0, left: 0, width: '100%', boxSizing: 'border-box',
            background: 'rgba(255, 255, 255, 0.98)', backdropFilter: 'blur(12px)',
            borderTopLeftRadius: '16px', borderTopRightRadius: '16px',
            borderTop: `1px solid ${COLORS.border}`,
            boxShadow: '0 -10px 30px rgba(0,0,0,0.08)', padding: '20px', zIndex: 9000,
            display: 'flex', flexDirection: 'column', alignItems: 'center'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '12px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img src={iconImg} alt="Foodji" style={{ width: '42px', height: '42px', borderRadius: '10px', objectFit: 'cover', border: `1px solid ${COLORS.border}` }} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: '700', fontSize: '0.98rem', letterSpacing: '-0.02em' }}>Installer Foodji sur iPhone</div>
                  <div style={{ fontSize: '0.82rem', color: COLORS.textLight }}>Accès direct depuis votre écran d'accueil</div>
                </div>
              </div>
              <button onClick={closeIosInstall} style={{ background: COLORS.bg, border: 'none', width: '30px', height: '30px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: COLORS.textLight, cursor: 'pointer' }}>
                <Icon name="x" size={16} />
              </button>
            </div>
            <div style={{ fontSize: '0.88rem', lineHeight: '1.7', textAlign: 'left', width: '100%', color: COLORS.textMuted, background: COLORS.bg, padding: '12px 14px', borderRadius: '8px' }}>
              1. Touchez l'icône <strong>Partager</strong> dans la barre de navigation Safari<br />
              2. Sélectionnez <strong>"Sur l'écran d'accueil"</strong>
            </div>
          </div>
        )}

        {showCGV && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(9, 9, 11, 0.78)', backdropFilter: 'blur(4px)', zIndex: 3000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', boxSizing: 'border-box'
          }}>
            <div className="modal-anim" style={{
              background: 'white', width: '100%', maxWidth: '580px', borderRadius: '16px',
              maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
              border: `1px solid ${COLORS.border}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: `1px solid ${COLORS.border}` }}>
                <h2 style={{ margin: 0, fontSize: '1.1rem', letterSpacing: '-0.02em' }}>Conditions Générales de Vente</h2>
                <button onClick={() => setShowCGV(false)} style={{ border: 'none', background: COLORS.bg, width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Icon name="x" size={16} />
                </button>
              </div>

              <div style={{ padding: '20px', overflowY: 'auto', flex: 1, fontSize: '0.88rem', lineHeight: '1.6', color: COLORS.textMuted }}>
                <p style={{ marginTop: 0 }}><strong>1. Objet :</strong> Les présentes conditions régissent les commandes passées auprès du restaurant Foodji (Sala Al Jadida).</p>
                <p><strong>2. Zones et modalités de livraison :</strong></p>
                <ul style={{ paddingLeft: '18px' }}>
                  <li><strong>Zone 0 à 4 km :</strong> Aucun minimum de commande (frais de livraison de 7 DH pour toute commande inférieure à 45 DH).</li>
                  <li><strong>Zone 4 à 10 km :</strong> Minimum de commande fixé à 300 DH en livraison.</li>
                  <li><strong>Au-delà de 10 km :</strong> Retrait en restaurant uniquement.</li>
                  <li><strong>Campus UIR, Technopolis, UM6P :</strong> Un supplément de livraison de 10 à 15 DH peut être appliqué par le livreur indépendant.</li>
                </ul>
                <p><strong>3. Validation téléphonique :</strong> Toute commande atteignant ou dépassant 300 DH fait l'objet d'un appel de confirmation avant préparation.</p>
                <p><strong>4. Denrées périssables :</strong> Toute commande validée et lancée en cuisine est ferme. Merci de préciser vos éventuelles allergies dans la case instructions.</p>
              </div>

              <div style={{ padding: '14px 20px', borderTop: `1px solid ${COLORS.border}` }}>
                <button className="taste-btn" onClick={() => setShowCGV(false)} style={btnStyle}>Fermer</button>
              </div>
            </div>
          </div>
        )}

        {/* LANDING SCREEN ÉDITORIAL */}
        {view === 'landing' && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: COLORS.darkBg, color: 'white', zIndex: 2000,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '24px', boxSizing: 'border-box', overflow: 'hidden'
          }}>
            <img
              src={logoImg}
              alt="Foodji"
              className="modal-anim"
              style={{ width: '176px', height: '176px', objectFit: 'contain', marginBottom: '20px' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />

            <div style={{ textAlign: 'center', width: '100%', maxWidth: '340px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#18181B', border: `1px solid ${COLORS.darkBorder}`, padding: '6px 12px', borderRadius: '999px', fontSize: '0.78rem', fontWeight: '600', color: '#D4D4D8', marginBottom: '16px' }}>
                <StatusDot active={isStoreOpen} />
                <span>{isStoreOpen ? 'Cuisine ouverte • Sala Al Jadida' : 'Actuellement fermé'}</span>
              </div>

              <p style={{ color: '#A1A1AA', fontSize: '0.95rem', marginBottom: '28px', lineHeight: '1.5' }}>
                Le vrai goût du <strong style={{ color: 'white' }}>Fait Maison</strong> préparé à la minute. Livraison, à emporter ou sur place.
              </p>

              <button className="taste-btn" onClick={() => setView('client')} style={{
                background: COLORS.primary, color: 'white', border: 'none', padding: '16px 24px', width: '100%',
                borderRadius: '12px', fontSize: '1.05rem', fontWeight: '700', letterSpacing: '-0.01em',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}>
                <span>Accéder à la carte</span>
                <Icon name="chevronRight" size={18} />
              </button>

              {deferredPrompt && (
                <button className="taste-btn" onClick={handleInstallClick} style={{
                  background: '#18181B', color: 'white', border: `1px solid ${COLORS.darkBorder}`, padding: '13px 20px', width: '100%',
                  borderRadius: '12px', fontSize: '0.92rem', fontWeight: '600', marginTop: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer'
                }}>
                  <Icon name="download" size={16} /> Installer l'application
                </button>
              )}

              {derniereCommande && (
                <button className="taste-btn num-tabular" onClick={() => setView('ticket')} style={{
                  marginTop: '10px', width: '100%', background: 'transparent',
                  border: `1px solid ${COLORS.darkBorder}`, color: '#D4D4D8', padding: '12px 18px',
                  borderRadius: '12px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: '600',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}>
                  <Icon name="receipt" size={15} /> Suivre mon ticket #{derniereCommande.id ? derniereCommande.id.slice(-4).toUpperCase() : ''}
                </button>
              )}

              <p style={{ marginTop: '24px', fontSize: '0.75rem', color: '#71717A' }}>
                En continuant, vous acceptez nos <span onClick={() => setShowCGV(true)} style={{ textDecoration: 'underline', cursor: 'pointer', color: '#A1A1AA' }}>Conditions Générales</span>.
              </p>

              <button onClick={handleStaffAccess} aria-label="Accès administration" style={{
                marginTop: '36px', background: 'transparent', border: 'none', color: '#52525B', cursor: 'pointer', padding: '8px'
              }}>
                <Icon name="lock" size={15} />
              </button>
            </div>
          </div>
        )}

        {/* HEADER STICKY MINIMALISTE */}
        {view !== 'landing' && (
          <header style={{
            background: 'rgba(255, 255, 255, 0.94)', backdropFilter: 'blur(12px)',
            padding: '12px 18px', position: 'sticky', top: 0, zIndex: 50,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderBottom: `1px solid ${COLORS.border}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => setView('landing')}>
              <img src={iconImg} style={{ height: '32px', width: '32px', borderRadius: '8px', objectFit: 'contain' }} alt="Foodji" onError={(e) => { e.target.style.display = 'none'; }} />
              <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.03em', color: COLORS.textMain }}>Foodji</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: COLORS.bg, padding: '5px 10px', borderRadius: '999px', border: `1px solid ${COLORS.border}` }}>
              <StatusDot active={isStoreOpen} />
              <span style={{ fontSize: '0.78rem', fontWeight: '600', color: COLORS.textMain }}>
                {isStoreOpen ? 'Ouvert' : 'Fermé'}
              </span>
            </div>
          </header>
        )}

        {/* BANNIÈRES D'INFORMATION OPÉRATIONNELLE */}
        {parametresStatus.rushMode !== 'standard' && view === 'client' && (
          <div style={{ background: COLORS.secondary, color: 'white', padding: '9px 16px', fontWeight: '600', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderBottom: `1px solid ${COLORS.darkBorder}` }}>
            <Icon name="clock" size={14} color={COLORS.warning} />
            <span>{parametresStatus.rushMode === 'gros_rush' ? 'Forte affluence en cuisine : délai estimé supérieur à 1h' : 'Affluence en cours : délai estimé 30 à 45 min'}</span>
          </div>
        )}

        {parametresStatus.promoDuoActive && view === 'client' && (
          <div style={{ background: COLORS.secondary, color: 'white', padding: '9px 16px', fontWeight: '600', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', borderBottom: `1px solid ${COLORS.darkBorder}` }}>
            <Icon name="tag" size={14} color={COLORS.promo} />
            <span>Offre Duo active : 1 acheté = le 2ème à -50% automatiquement au panier</span>
          </div>
        )}

        {!isStoreOpen && view === 'client' && (
          <div style={{ background: '#FEF2F2', color: COLORS.danger, textAlign: 'center', padding: '10px 16px', fontWeight: '600', fontSize: '0.85rem', borderBottom: `1px solid #FECACA` }}>
            Le restaurant est actuellement fermé. La prise de commande est suspendue.
          </div>
        )}

        {/* BOTTOM SHEETS DE CONFIGURATION */}
        {showPromoWizard && (
          <PromoWizard
            menu={menu}
            stocks={stocks}
            onClose={() => setShowPromoWizard(false)}
            onValidate={ajouterLotAuPanier}
            notify={notify}
          />
        )}

        {promoTacosSheet.active && (
          <PromoTacosSheet
            initialSize={promoTacosSheet.initialSize}
            stocks={stocks}
            onClose={() => setPromoTacosSheet({ active: false, initialSize: 'L' })}
            onAdd={ajouterAuPanier}
            notify={notify}
          />
        )}

        {selectedProduct && (
          <ProductModal
            product={selectedProduct}
            stocks={stocks}
            onClose={() => setSelectedProduct(null)}
            onAdd={ajouterAuPanier}
            notify={notify}
          />
        )}

        {/* VUE CLIENT : BANNIÈRE BENTO + LIGNES ÉDITORIALES */}
        {view === 'client' && (
          <div style={{ padding: '16px', maxWidth: '680px', margin: '0 auto' }}>

            {/* BANNIÈRES BENTO DES OFFRES DU MOMENT (TACOS 55/89 DH & OFFRE DIMANCHE) */}
            {(parametresStatus.promoTacosActive || parametresStatus.promoDimancheActive) && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                {parametresStatus.promoTacosActive && (
                  <div style={{ background: COLORS.secondary, color: 'white', borderRadius: '12px', padding: '16px', border: `1px solid ${COLORS.darkBorder}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ background: COLORS.primary, color: 'white', fontSize: '0.7rem', fontWeight: '700', padding: '3px 8px', borderRadius: '6px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Offre Tacos</span>
                        <span style={{ fontSize: '0.75rem', color: '#A1A1AA', fontWeight: '500' }}>Sans frites • Option +15 DH</span>
                      </div>
                      <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: '700', letterSpacing: '-0.02em' }}>Duo Tacos L ou XL</h3>
                      <p style={{ margin: 0, fontSize: '0.82rem', color: '#A1A1AA', lineHeight: 1.4 }}>
                        Composez vos 2 Tacos au choix. Ajoutez Frites + Boisson 1L pour seulement +15 DH.
                      </p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '14px' }}>
                      <button className="taste-btn num-tabular" onClick={() => setPromoTacosSheet({ active: true, initialSize: 'L' })} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${COLORS.darkBorder}`, background: '#27272A', color: 'white', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>2 Tacos L</span>
                        <span style={{ color: '#FBBF24' }}>55 DH</span>
                      </button>
                      <button className="taste-btn num-tabular" onClick={() => setPromoTacosSheet({ active: true, initialSize: 'XL' })} style={{ padding: '10px', borderRadius: '8px', border: 'none', background: COLORS.primary, color: 'white', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>2 Tacos XL</span>
                        <span>89 DH</span>
                      </button>
                    </div>
                  </div>
                )}

                {parametresStatus.promoDimancheActive && (
                  <div
                    className="taste-card"
                    onClick={() => setShowPromoWizard(true)}
                    style={{ background: 'white', color: COLORS.textMain, borderRadius: '12px', padding: '16px', border: `1px solid ${COLORS.borderStrong}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', cursor: 'pointer' }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ background: COLORS.secondary, color: 'white', fontSize: '0.7rem', fontWeight: '700', padding: '3px 8px', borderRadius: '6px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Offre Pizzas</span>
                        <span style={{ fontSize: '0.75rem', color: COLORS.textLight, fontWeight: '600' }}>Tailles M • 2 & 4 Saisons incluses</span>
                      </div>
                      <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: '700', letterSpacing: '-0.02em' }}>2 Pizzas achetées = la 3ème offerte</h3>
                      <p style={{ margin: 0, fontSize: '0.82rem', color: COLORS.textLight, lineHeight: 1.4 }}>
                        Sélectionnez vos 3 Pizzas M (hors Fruits de mer et Cannibale), la moins chère est gratuite.
                      </p>
                    </div>
                    <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: `1px solid ${COLORS.border}` }}>
                      <span style={{ fontSize: '0.88rem', fontWeight: '700', color: COLORS.primary }}>Composer mon pack de 3 Pizzas</span>
                      <Icon name="chevronRight" size={16} color={COLORS.primary} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* BARRE DES CATÉGORIES */}
            <div style={{ overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '12px', scrollbarWidth: 'none', display: 'flex', gap: '6px' }}>
              {categoriesClient.map(c => {
                const isActive = categorieActive === c;
                return (
                  <button
                    key={c}
                    className="taste-btn"
                    onClick={() => setCategorieActive(c)}
                    style={{
                      border: isActive ? 'none' : `1px solid ${COLORS.border}`,
                      display: 'inline-block', padding: '9px 16px', borderRadius: '8px',
                      background: isActive ? COLORS.secondary : 'white',
                      color: isActive ? 'white' : COLORS.textMain,
                      fontWeight: '600', fontSize: '0.88rem', cursor: 'pointer', flexShrink: 0
                    }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>

            {/* LISTE ÉDITORIALE DES PRODUITS (ALIGNEMENT GAUCHE + VIGNETTE CARRÉE 88x88 À DROITE) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
              {isMenuLoading ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: COLORS.textLight, fontWeight: '500', fontSize: '0.92rem' }}>
                  Chargement du menu...
                </div>
              ) : menuClient.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px', color: COLORS.textLight, fontSize: '0.92rem' }}>
                  Aucun article disponible dans cette catégorie.
                </div>
              ) : (
                menuClient.map((plat) => {
                  const displayPrice = plat.prix > 0
                    ? plat.prix
                    : (plat.variantes?.length > 0 ? Math.min(...plat.variantes.filter(v => v.available !== false).map(v => Number(v.prix) || 0)) : 0);

                  return (
                    <div
                      key={plat.id}
                      className="taste-card"
                      onClick={() => setSelectedProduct(plat)}
                      style={{
                        background: 'white', borderRadius: '12px', padding: '14px',
                        border: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-between',
                        alignItems: 'stretch', gap: '14px', cursor: 'pointer'
                      }}
                    >
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'left' }}>
                        <div>
                          <h4 style={{ margin: '0 0 4px 0', fontSize: '0.98rem', fontWeight: '700', color: COLORS.textMain, letterSpacing: '-0.02em', lineHeight: '1.25' }}>{plat.nom}</h4>
                          {plat.description && (
                            <p style={{ fontSize: '0.82rem', color: COLORS.textLight, margin: 0, lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {plat.description}
                            </p>
                          )}
                        </div>

                        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="num-tabular" style={{ fontWeight: '700', fontSize: '0.95rem', color: COLORS.textMain }}>
                            {displayPrice > 0 ? (plat.variantes?.length > 0 ? `Dès ${displayPrice} DH` : `${displayPrice} DH`) : 'Sur mesure'}
                          </span>
                          {plat.variantes?.length > 0 && (
                            <span style={{ fontSize: '0.72rem', color: COLORS.textLight, background: COLORS.bg, padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>
                              {plat.variantes.filter(v => v.available !== false).map(v => v.nom).join(' / ')}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{
                        width: '88px', height: '88px', borderRadius: '8px',
                        background: COLORS.bg,
                        backgroundImage: plat.image ? `url(${plat.image})` : 'none',
                        backgroundSize: 'cover', backgroundPosition: 'center',
                        position: 'relative', flexShrink: 0, border: `1px solid ${COLORS.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {!plat.image && <span style={{ fontSize: '0.7rem', fontWeight: '700', color: '#A1A1AA', letterSpacing: '-0.02em' }}>FOODJI</span>}
                        <div style={{
                          position: 'absolute', bottom: '6px', right: '6px',
                          background: COLORS.secondary, color: 'white',
                          width: '28px', height: '28px', borderRadius: '6px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                        }}>
                          <Icon name="plus" size={15} />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* FLOATING CART BAR (BARRE FLOTTANTE EN BAS D'ÉCRAN) */}
            {panier.length > 0 && (
              <div
                className="taste-btn"
                onClick={handleOpenPanier}
                style={{
                  position: 'fixed', bottom: '18px', left: '50%', transform: 'translateX(-50%)',
                  width: 'calc(100% - 32px)', maxWidth: '520px', boxSizing: 'border-box',
                  background: COLORS.darkBg, color: 'white', padding: '14px 18px',
                  borderRadius: '12px', border: `1px solid ${COLORS.darkBorder}`,
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', boxShadow: '0 16px 32px -8px rgba(0,0,0,0.4)', cursor: 'pointer', zIndex: 99
                }}
              >
                {gpsLoading ? (
                  <div style={{ width: '100%', textAlign: 'center', fontWeight: '600', fontSize: '0.92rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <Icon name="mapPin" size={16} /> Ouverture du récapitulatif...
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span className="num-tabular" style={{ background: COLORS.primary, color: 'white', minWidth: '26px', height: '26px', borderRadius: '6px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: '700', fontSize: '0.85rem', padding: '0 6px' }}>{panier.length}</span>
                      <span style={{ fontSize: '0.95rem', fontWeight: '600', letterSpacing: '-0.01em' }}>Voir ma commande</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="num-tabular" style={{ fontWeight: '700', fontSize: '1.05rem' }}>{grandTotal} DH</span>
                      <Icon name="chevronRight" size={16} color="#A1A1AA" />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* VUE PANIER & CHECKOUT EN 1 ÉCRAN */}
        {view === 'panier' && (
          <div style={{ padding: '18px', maxWidth: '580px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <button className="taste-btn" onClick={() => setView('client')} style={{ background: 'white', border: `1px solid ${COLORS.border}`, padding: '8px 12px', borderRadius: '8px', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: COLORS.textMain }}>
                <Icon name="arrowLeft" size={15} /> Retour à la carte
              </button>
              <h2 style={{ margin: 0, fontSize: '1.2rem', letterSpacing: '-0.02em' }}>Validation de commande</h2>
            </div>

            {panier.length === 0 ? (
              <div style={{ ...cardStyle, textAlign: 'center', padding: '40px 20px' }}>
                <p style={{ color: COLORS.textLight, marginBottom: '20px' }}>Votre panier est vide.</p>
                <button className="taste-btn" onClick={() => setView('client')} style={btnStyle}>Parcourir le menu</button>
              </div>
            ) : (
              <>
                <div style={{ ...cardStyle, marginBottom: '16px' }}>
                  {panier.map((item, idx) => (
                    <div key={item.uniqueId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', padding: '12px 0', borderBottom: idx === panier.length - 1 ? 'none' : `1px solid ${COLORS.border}`, gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', fontSize: '0.95rem', color: COLORS.textMain }}>{item.nom}</div>
                        {item.detailsTxt && item.detailsTxt.length > 0 && (
                          <div style={{ color: COLORS.textLight, fontSize: '0.8rem', marginTop: '4px', lineHeight: '1.4' }}>
                            {item.detailsTxt.map((dt, i) => (
                              <div key={i} style={{ color: dt.includes('[SANS') ? COLORS.danger : dt.includes('[OPTION') ? COLORS.success : 'inherit', fontWeight: (dt.includes('[SANS') || dt.includes('[OPTION')) ? '600' : 'normal' }}>• {dt}</div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <strong className="num-tabular" style={{ color: COLORS.textMain, fontSize: '0.95rem' }}>{getPrixItemAjuste(item)} DH</strong>
                        <button className="taste-btn" onClick={() => retirerDuPanier(item.uniqueId)} style={{ color: COLORS.danger, background: COLORS.bg, border: `1px solid ${COLORS.border}`, width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <Icon name="trash" size={13} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* PROPOSITION RAPIDE +15 DH SI 2 TACOS L OU XL SONT AJOUTÉS SÉPARÉMENT */}
                  {remiseTacos > 0 && !panier.some(it => it.id === 'supplement_promo_tacos_menu') && (
                    <button
                      className="taste-btn num-tabular"
                      onClick={ajouterOptionFritesBoissonPromo}
                      style={{
                        width: '100%', marginTop: '10px', padding: '10px 12px', borderRadius: '8px',
                        border: `1px solid ${COLORS.borderStrong}`, background: COLORS.bg,
                        color: COLORS.textMain, fontWeight: '600', fontSize: '0.85rem',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
                      }}
                    >
                      <span>+ Ajouter Frites & Boisson 1L à votre Promo Tacos</span>
                      <span style={{ color: COLORS.primary, fontWeight: '700' }}>+ 15 DH</span>
                    </button>
                  )}

                  <div style={{ borderTop: `1px solid ${COLORS.border}`, marginTop: '12px', paddingTop: '12px' }} className="num-tabular">
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: COLORS.textLight, fontSize: '0.88rem', marginBottom: '6px' }}>
                      <span>Sous-total</span><span>{sousTotal} DH</span>
                    </div>

                    {remiseDimanche > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: COLORS.success, fontWeight: '600', fontSize: '0.88rem', marginBottom: '6px' }}>
                        <span>Offre Dimanche (3ème Pizza offerte)</span><span>- {remiseDimanche} DH</span>
                      </div>
                    )}

                    {remiseTacos > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: COLORS.success, fontWeight: '600', fontSize: '0.88rem', marginBottom: '6px' }}>
                        <span>Promo Duo Tacos (Sans frites)</span><span>- {remiseTacos} DH</span>
                      </div>
                    )}

                    {remiseDuo > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: COLORS.success, fontWeight: '600', fontSize: '0.88rem', marginBottom: '6px' }}>
                        <span>Offre Duo (-50% sur le 2ème)</span><span>- {remiseDuo} DH</span>
                      </div>
                    )}

                    {remiseAppliquee > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: COLORS.promo, fontWeight: '600', fontSize: '0.88rem', marginBottom: '6px' }}>
                        <span>Code Bienvenue (-20%)</span><span>- {remiseAppliquee} DH</span>
                      </div>
                    )}

                    {fraisLivraison > 0 && typeCommande === 'livraison' && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: COLORS.textLight, fontSize: '0.88rem', marginBottom: '6px' }}>
                        <span>Frais de livraison (commande inférieure à 45 DH)</span><span>+ {fraisLivraison} DH</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: '800', marginTop: '10px', color: COLORS.textMain, letterSpacing: '-0.02em' }}>
                      <span>Total à payer</span>
                      <span style={{ color: COLORS.primary }}>{grandTotal} DH</span>
                    </div>
                  </div>
                </div>

                <div style={cardStyle}>
                  <h3 style={{ marginTop: 0, fontSize: '1rem', marginBottom: '12px', letterSpacing: '-0.02em' }}>Mode de réception & Coordonnées</h3>

                  <div style={{ display: 'flex', gap: '4px', marginBottom: '14px', background: COLORS.bg, padding: '4px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>
                    {[
                      { id: 'livraison', label: 'Livraison', icon: 'truck' },
                      { id: 'emporter', label: 'À Emporter', icon: 'bag' },
                      { id: 'sur_place', label: 'Sur Place', icon: 'utensils' }
                    ].map(t => (
                      <button
                        key={t.id}
                        className="taste-btn"
                        onClick={() => setTypeCommande(t.id)}
                        style={{
                          flex: 1, padding: '9px 6px', borderRadius: '6px', border: 'none',
                          background: typeCommande === t.id ? COLORS.secondary : 'transparent',
                          color: typeCommande === t.id ? 'white' : COLORS.textMuted,
                          fontWeight: '600', fontSize: '0.84rem', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                        }}
                      >
                        <Icon name={t.icon} size={14} />
                        <span>{t.label}</span>
                      </button>
                    ))}
                  </div>

                  {typeCommande === 'livraison' && (
                    <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.border}`, padding: '10px 12px', borderRadius: '8px', marginBottom: '12px', fontSize: '0.8rem', color: COLORS.textMuted, lineHeight: '1.4' }}>
                      <strong>Campus UIR, Technopolis & UM6P :</strong> un supplément de 10 à 15 DH est appliqué directement par le livreur pour ces secteurs.
                    </div>
                  )}

                  <input type="text" value={clientNom} onChange={e => setClientNom(e.target.value)} style={inputStyle} placeholder="Votre nom complet *" required />
                  <input type="tel" className="num-tabular" value={clientTel} onChange={e => setClientTel(e.target.value)} style={inputStyle} placeholder="Numéro de téléphone (06... ou 07...) *" required />

                  {typeCommande === 'livraison' && (
                    <textarea value={adresse} onChange={e => setAdresse(e.target.value)} style={{ ...inputStyle, height: '72px', resize: 'none' }} placeholder="Adresse précise (Résidence, Immeuble, Appartement, Repère) *" required />
                  )}

                  <textarea
                    value={commentaire}
                    onChange={e => setCommentaire(e.target.value)}
                    style={{ ...inputStyle, height: '58px', marginBottom: '14px', resize: 'none' }}
                    placeholder="Instructions cuisine ou livreur (allergies, interphone...)"
                  />

                  <div style={{ marginBottom: '16px', padding: '12px', background: COLORS.bg, borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: '600', marginBottom: '8px', color: COLORS.textMain, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Icon name="tag" size={14} color={COLORS.primary} /> Code de bienvenue (1ère commande)
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="START2026"
                        value={codePromo}
                        disabled={isPromoValidee}
                        onChange={(e) => setCodePromo(e.target.value.toUpperCase())}
                        style={{ ...inputStyle, marginBottom: 0, fontWeight: '700', letterSpacing: '0.05em', flex: 1 }}
                      />
                      {isPromoValidee ? (
                        <button className="taste-btn" onClick={() => { setIsPromoValidee(false); setRemiseAppliquee(0); setCodePromo(''); }} style={{ background: 'white', color: COLORS.danger, border: `1px solid ${COLORS.border}`, borderRadius: '8px', padding: '0 14px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <Icon name="x" size={16} />
                        </button>
                      ) : (
                        <button className="taste-btn" onClick={verifierCodePromo} style={{ background: COLORS.secondary, color: 'white', border: 'none', borderRadius: '8px', padding: '0 16px', fontWeight: '600', fontSize: '0.88rem', cursor: 'pointer' }}>Appliquer</button>
                      )}
                    </div>
                  </div>

                  <button
                    className="taste-btn num-tabular"
                    onClick={envoyerCommande}
                    disabled={loading || !isStoreOpen}
                    style={{ ...btnStyle, background: !isStoreOpen ? COLORS.textLight : COLORS.primary, fontSize: '1rem', padding: '15px' }}
                  >
                    {loading ? 'Transmission en cours...' : (!isStoreOpen ? 'Restaurant fermé' : `Confirmer la commande • ${grandTotal} DH`)}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* VUE TICKET DE CONFIRMATION */}
        {view === 'ticket' && derniereCommande && (
          <div style={{ padding: '24px 18px', maxWidth: '440px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="modal-anim" style={{ background: 'white', padding: '26px 22px', borderRadius: '16px', border: `1px solid ${COLORS.border}`, width: '100%', boxSizing: 'border-box', textAlign: 'center' }}>
              <div style={{ width: '48px', height: '48px', background: derniereCommande.status === 'En cours de validation' ? COLORS.pending : COLORS.success, color: 'white', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px auto' }}>
                <Icon name={derniereCommande.status === 'En cours de validation' ? 'phone' : 'check'} size={22} />
              </div>

              {derniereCommande.status === 'En cours de validation' ? (
                <>
                  <h2 style={{ margin: '0 0 8px 0', color: COLORS.textMain, fontSize: '1.25rem', letterSpacing: '-0.02em' }}>Validation téléphonique en cours</h2>
                  <p style={{ color: COLORS.textLight, fontSize: '0.88rem', marginBottom: '20px', lineHeight: '1.5' }}>
                    Votre commande atteint ou dépasse 300 DH. Notre équipe vous appelle dans un instant pour confirmer son lancement en cuisine.
                  </p>
                </>
              ) : (
                <>
                  <h2 style={{ margin: '0 0 8px 0', color: COLORS.textMain, fontSize: '1.25rem', letterSpacing: '-0.02em' }}>Commande transmise en cuisine</h2>
                  <p style={{ color: COLORS.textLight, fontSize: '0.88rem', marginBottom: '20px' }}>
                    Merci {derniereCommande.client}, votre commande est en cours de préparation.
                  </p>
                </>
              )}

              <div className="num-tabular" style={{ borderTop: `1px solid ${COLORS.border}`, borderBottom: `1px solid ${COLORS.border}`, padding: '14px 0', marginBottom: '14px', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontWeight: '700', fontSize: '0.9rem' }}>
                  <span>Référence Ticket</span>
                  <span style={{ color: COLORS.primary }}>#{derniereCommande.id ? derniereCommande.id.slice(-4).toUpperCase() : '----'}</span>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {(derniereCommande.items || []).map((it, i) => (
                    <li key={i} style={{ marginBottom: '6px', fontSize: '0.88rem', paddingBottom: '6px', borderBottom: i === derniereCommande.items.length - 1 ? 'none' : `1px solid ${COLORS.bg}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: '600' }}>{it.nom}</span>
                        <span style={{ fontWeight: '700' }}>{it.prixFinal} DH</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="num-tabular" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.15rem', fontWeight: '800', color: COLORS.textMain }}>
                <span>Total</span>
                <span style={{ color: COLORS.primary }}>{derniereCommande.total} DH</span>
              </div>
            </div>

            <button className="taste-btn" onClick={() => setView('client')} style={{ marginTop: '20px', background: COLORS.secondary, color: 'white', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon name="arrowLeft" size={15} /> Retour au menu
            </button>
          </div>
        )}

        {/* LOGIN STAFF */}
        {view === 'login' && !user && (
          <div style={{ padding: '40px 20px', maxWidth: '360px', margin: '0 auto' }}>
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
                <Icon name="lock" size={18} color={COLORS.primary} />
                <h2 style={{ margin: 0, fontSize: '1.2rem', letterSpacing: '-0.02em' }}>Accès Administration</h2>
              </div>
              <input type="email" placeholder="Adresse email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
              <input type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
              <button className="taste-btn" onClick={async (e) => { e.preventDefault(); try { await signInWithEmailAndPassword(auth, email, password); setView('admin'); } catch (err) { notify('Identifiants incorrects', 'error'); } }} style={btnStyle}>Se connecter</button>
              <button onClick={() => setView('landing')} style={{ width: '100%', marginTop: '12px', background: 'transparent', border: 'none', color: COLORS.textLight, cursor: 'pointer', fontWeight: '500', padding: '8px' }}>Retour à l'accueil</button>
            </div>
          </div>
        )}

        {/* BACK-OFFICE WEB EMBARQUÉ */}
        {view === 'admin' && user && (
          <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, letterSpacing: '-0.03em', fontSize: '1.4rem' }}>Administration Web Foodji</h2>
                <div style={{ fontSize: '0.78rem', color: COLORS.textMain, background: 'white', border: `1px solid ${COLORS.border}`, padding: '4px 10px', borderRadius: '999px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <StatusDot active={true} /> Alertes sonores actives
                </div>
              </div>
              <button className="taste-btn" onClick={() => setView('client')} style={{ background: 'white', border: `1px solid ${COLORS.border}`, padding: '8px 14px', borderRadius: '8px', fontWeight: '600', fontSize: '0.88rem', cursor: 'pointer' }}>Voir le site client</button>
            </div>

            <div style={{ ...cardStyle, marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontWeight: '600', fontSize: '0.9rem', color: COLORS.textLight }}>Statut Restaurant :</span>
                <button className="taste-btn" onClick={() => updateDoc(doc(db, "parametres", "horaires"), { isOuvert: !isStoreOpen })} style={{ padding: '8px 14px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, background: COLORS.bg, color: COLORS.textMain, fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <StatusDot active={isStoreOpen} />
                  <span>{isStoreOpen ? 'Ouvert aux commandes' : 'Fermé'}</span>
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: '600', fontSize: '0.9rem', color: COLORS.textLight }}>Cadence :</span>
                {['standard', 'rush', 'gros_rush'].map(m => (
                  <button key={m} className="taste-btn" onClick={() => updateDoc(doc(db, "parametres", "status"), { mode: m })} style={{ padding: '7px 12px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, background: parametresStatus.rushMode === m ? COLORS.secondary : 'white', color: parametresStatus.rushMode === m ? 'white' : COLORS.textMain, fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}>
                    {m === 'standard' ? 'Standard' : m === 'rush' ? 'Rush (30m+)' : 'Fort Rush (1h+)'}
                  </button>
                ))}
              </div>
            </div>

            <h3 style={{ marginTop: '24px', fontSize: '1.1rem', letterSpacing: '-0.02em' }}>Commandes en cours ({commandes.filter(c => c.status !== 'Terminé').length})</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '14px', marginBottom: '36px' }}>
              {commandes.map(cmd => (
                <div key={cmd.id} style={{
                  ...cardStyle,
                  borderLeft: cmd.status === 'Terminé' ? `4px solid ${COLORS.border}` : (cmd.status === 'En cours de validation' ? `4px solid ${COLORS.pending}` : `4px solid ${COLORS.success}`)
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '10px', paddingBottom: '10px', borderBottom: `1px solid ${COLORS.border}` }}>
                    <div>
                      <strong style={{ fontSize: '1.05rem', display: 'block' }}>{cmd.client}</strong>
                      <div className="num-tabular" style={{ color: COLORS.textMuted, fontSize: '0.88rem', marginTop: '2px' }}>{cmd.tel}</div>
                      <div className="num-tabular" style={{ marginTop: '4px', fontSize: '0.8rem', fontWeight: '600', color: COLORS.textLight, display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <span>Distance : {cmd.distance} km</span>
                        {cmd.lat ? (
                          <a href={`https://www.google.com/maps?q=${cmd.lat},${cmd.lng}`} target="_blank" rel="noreferrer" style={{ color: COLORS.primary, textDecoration: 'underline' }}>Carte GPS</a>
                        ) : null}
                      </div>
                    </div>
                    <div className="num-tabular" style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: '800', color: COLORS.textMain }}>{cmd.total} DH</div>
                      <button className="taste-btn" onClick={() => copierOdoo(cmd)} style={{ marginTop: '6px', background: COLORS.bg, color: COLORS.textMain, border: `1px solid ${COLORS.border}`, padding: '5px 10px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Icon name="copy" size={12} /> Copier
                      </button>
                    </div>
                  </div>

                  <div style={{ marginBottom: '10px' }}>
                    {cmd.status === 'En cours de validation' && (
                      <div style={{ background: '#FFF7ED', color: '#C2410C', padding: '8px', borderRadius: '6px', fontSize: '0.82rem', fontWeight: '600', marginBottom: '6px', border: '1px solid #FED7AA' }}>
                        Commande supérieure ou égale à 300 DH — À confirmer par téléphone
                      </div>
                    )}
                    {cmd.type === 'livraison' && <div style={{ background: COLORS.bg, color: COLORS.textMain, padding: '8px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '6px' }}>Livraison : <strong>{cmd.adresse}</strong></div>}
                    {cmd.commentaire && <div style={{ background: COLORS.bg, color: COLORS.textMain, padding: '8px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '600', border: `1px solid ${COLORS.border}` }}>Note : {cmd.commentaire}</div>}
                  </div>

                  <ul style={{ listStyle: 'none', marginBottom: '14px', padding: 0 }} className="num-tabular">
                    {cmd.items && cmd.items.map((it, i) => (
                      <li key={i} style={{ padding: '6px 0', borderBottom: `1px solid ${COLORS.border}`, fontSize: '0.88rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong>{it.qte > 1 ? `${it.qte}x ` : ''}{it.nom}</strong>
                          <span style={{ color: COLORS.textMuted }}>{it.prixFinal} DH</span>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: COLORS.textLight, marginLeft: '6px', marginTop: '2px' }}>
                          {it.detailsTxt && it.detailsTxt.map((dt, j) => (
                            <div key={j} style={{ color: dt.includes('[SANS') ? COLORS.danger : 'inherit' }}>• {dt}</div>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {cmd.status === 'En cours de validation' ? (
                      <>
                        <button className="taste-btn" onClick={() => changerStatus(cmd.id, 'En attente')} style={{ ...btnStyle, background: COLORS.secondary, padding: '9px', flex: 1, fontSize: '0.85rem' }}>Client confirmé</button>
                        <button className="taste-btn" onClick={() => changerStatus(cmd.id, 'Refusé')} style={{ ...btnStyle, background: COLORS.danger, padding: '9px', flex: 1, fontSize: '0.85rem' }}>Refuser</button>
                      </>
                    ) : (
                      <>
                        {cmd.status !== 'Terminé' && cmd.status !== 'Refusé' && <button className="taste-btn" onClick={() => changerStatus(cmd.id, 'Terminé')} style={{ ...btnStyle, background: COLORS.secondary, padding: '9px', flex: 1, fontSize: '0.85rem' }}>Marquer servi</button>}
                        <button className="taste-btn" onClick={() => supprimerCmd(cmd.id)} style={{ background: 'white', color: COLORS.danger, border: `1px solid ${COLORS.border}`, borderRadius: '8px', padding: '9px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                          <Icon name="trash" size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '36px', borderTop: `1px solid ${COLORS.border}`, paddingTop: '20px' }}>
              <h3 style={{ marginBottom: '14px', fontSize: '1.1rem', letterSpacing: '-0.02em' }}>Catalogue & Photos Produits</h3>
              <div style={{ overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '12px', display: 'flex', gap: '6px' }}>
                {categoriesReelles.map(c => (
                  <button key={c} className="taste-btn" onClick={() => setAdminCategorie(c)} style={{
                    padding: '8px 14px', borderRadius: '8px', border: `1px solid ${COLORS.border}`,
                    background: adminCategorie === c ? COLORS.secondary : 'white',
                    color: adminCategorie === c ? 'white' : COLORS.textMain, cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem'
                  }}>{c}</button>
                ))}
                <button className="taste-btn" onClick={() => setAdminCategorie('RUPTURE')} style={{ padding: '8px 14px', borderRadius: '8px', border: `1px solid ${COLORS.danger}`, background: adminCategorie === 'RUPTURE' ? COLORS.danger : 'white', color: adminCategorie === 'RUPTURE' ? 'white' : COLORS.danger, fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}>En rupture</button>
              </div>

              <div style={{ background: 'white', borderRadius: '12px', border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
                {menuAdmin.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${COLORS.border}`, background: p.available === false ? COLORS.bg : 'white', opacity: p.available === false ? 0.7 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div onClick={() => toggleAvailability(p)} style={{ width: '44px', height: '24px', background: p.available !== false ? COLORS.success : '#D4D4D8', borderRadius: '20px', position: 'relative', cursor: 'pointer', transition: '0.2s' }}>
                        <div style={{ width: '18px', height: '18px', background: 'white', borderRadius: '50%', position: 'absolute', top: '3px', left: p.available !== false ? '23px' : '3px', transition: '0.2s' }}></div>
                      </div>
                      <div style={{ width: '44px', height: '44px', background: COLORS.bg, borderRadius: '8px', overflow: 'hidden', position: 'relative', flexShrink: 0, border: `1px solid ${COLORS.border}` }}>
                        {p.image && <img src={p.image} alt={p.nom} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                        <input type="file" onChange={(e) => updateProductImage(p.id, e.target.files[0])} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: '0.95rem', textDecoration: p.available === false ? 'line-through' : 'none' }}>{p.nom}</div>
                        <div className="num-tabular" style={{ fontSize: '0.8rem', color: COLORS.textLight }}>{p.categorie} • {p.variantes?.length > 0 ? 'Multi-tailles' : `${p.prix} DH`}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleEdit(p)} style={{ border: `1px solid ${COLORS.border}`, background: 'white', padding: '7px 10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Icon name="edit" size={14} /></button>
                      <button onClick={() => supprimerProduit(p.id, p.nom)} style={{ color: COLORS.danger, border: `1px solid ${COLORS.border}`, background: 'white', padding: '7px 10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Icon name="trash" size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <details style={{ marginTop: '20px', background: 'white', padding: '16px', borderRadius: '12px', border: `1px solid ${COLORS.border}` }}>
              <summary style={{ fontWeight: '600', cursor: 'pointer', fontSize: '0.95rem' }}>{editId ? 'Modifier le produit sélectionné' : 'Ajouter un produit au catalogue'}</summary>
              <div style={{ marginTop: '14px' }}>
                <input placeholder="Nom du plat" value={nom} onChange={e => setNom(e.target.value)} style={inputStyle} />
                <textarea placeholder="Description (ingrédients...)" value={description} onChange={e => setDescription(e.target.value)} style={{ ...inputStyle, height: '64px', resize: 'vertical' }} />
                <div style={{ display: 'flex', gap: '10px', alignItems: 'start', flexWrap: 'wrap' }}>
                  <select value={categorie} onChange={handleCategoryChange} style={{ ...inputStyle, flex: 1, minWidth: '180px' }}>
                    {categoriesSelectAdmin.map(cat => <option key={cat}>{cat}</option>)}
                  </select>
                  {variantes.length > 0 ? (
                    <div style={{ flex: 2, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {variantes.map((v, index) => (
                        <div key={index} style={{ flex: 1, minWidth: '120px', display: 'flex', alignItems: 'center', gap: '6px', background: COLORS.bg, padding: '8px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: '600', color: COLORS.textLight, display: 'block' }}>{v.nom}</label>
                            <input type="number" className="num-tabular" value={v.prix} onChange={(e) => updateVariantPrice(index, 'prix', e.target.value)} style={{ ...inputStyle, marginBottom: 0, padding: '6px', fontSize: '0.9rem' }} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <label style={{ fontSize: '0.65rem', color: COLORS.textLight }}>Dispo</label>
                            <input type="checkbox" checked={v.available !== false} onChange={(e) => updateVariantPrice(index, 'available', e.target.checked)} style={{ width: '16px', height: '16px' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <input type="number" className="num-tabular" placeholder="Prix en DH" value={prixBase} onChange={e => setPrixBase(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
                  )}
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button className="taste-btn" onClick={saveProduit} style={{ ...btnStyle, width: 'auto' }}>{editId ? 'Enregistrer' : 'Ajouter au menu'}</button>
                  {editId && <button className="taste-btn" onClick={() => { setEditId(null); setNom(''); setPrixBase(''); setVariantes([]); setDescription(''); }} style={{ ...btnStyle, background: COLORS.textLight, width: 'auto' }}>Annuler</button>}
                </div>
              </div>
            </details>

            <details style={{ marginTop: '16px', background: 'white', padding: '16px', borderRadius: '12px', border: `1px solid ${COLORS.border}` }}>
              <summary style={{ fontWeight: '600', color: COLORS.textMain, cursor: 'pointer', fontSize: '0.95rem' }}>Disponibilité des Ingrédients & Stocks</summary>
              <div style={{ marginTop: '14px' }}>
                <div style={{ overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '12px', display: 'flex', gap: '6px' }}>
                  {STOCK_TABS.map(tab => (
                    <button key={tab.id} className="taste-btn" onClick={() => setActiveStockTab(tab.id)} style={{
                      border: `1px solid ${COLORS.border}`, padding: '7px 14px', borderRadius: '8px',
                      background: activeStockTab === tab.id ? COLORS.secondary : COLORS.bg,
                      color: activeStockTab === tab.id ? 'white' : COLORS.textMain,
                      fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer'
                    }}>
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div style={{ background: COLORS.bg, padding: '14px', borderRadius: '8px', marginTop: '6px', border: `1px solid ${COLORS.border}` }}>
                  {activeStockTab !== 'tailles_pizza' && (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                      <input type="text" placeholder="Nouvel ingrédient..." value={newItemName} onChange={(e) => setNewItemName(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
                      <button className="taste-btn" onClick={addNewStockItem} style={{ ...btnStyle, width: 'auto' }}>Ajouter</button>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {stocks[activeStockTab]?.map((item, index) => (
                      <button key={item.nom} className="taste-btn" onClick={() => toggleStockItem(activeStockTab, index)} style={{
                        padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600',
                        background: item.available ? 'white' : '#FEF2F2',
                        color: item.available ? COLORS.textMain : COLORS.danger,
                        border: `1px solid ${item.available ? COLORS.border : COLORS.danger}`, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem'
                      }}>
                        <StatusDot active={item.available} />
                        <span>{item.nom}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </details>

            <details style={{ marginTop: '16px', background: 'white', padding: '16px', borderRadius: '12px', border: `1px solid ${COLORS.border}` }}>
              <summary style={{ fontWeight: '600', color: COLORS.danger, cursor: 'pointer', fontSize: '0.95rem' }}>Opérations avancées (Import CSV / Reset)</summary>
              <input type="file" accept=".csv" ref={fileInputRef} onChange={handleCSVImport} style={{ display: 'none' }} />
              <div style={{ marginTop: '14px', display: 'flex', gap: '10px', flexDirection: 'column' }}>
                <button className="taste-btn" onClick={triggerImport} style={{ ...btnStyle, background: COLORS.bg, color: COLORS.textMain, border: `1px solid ${COLORS.border}` }}>Importer un catalogue CSV</button>
                <button className="taste-btn" onClick={viderMenu} style={{ ...btnStyle, background: COLORS.danger, color: 'white' }}>Réinitialiser tout le catalogue</button>
              </div>
            </details>
          </div>
        )}
      </div>
    </HelmetProvider>
  );
}

function formatOptions(list) {
  if (!list) return "";
  const counts = {};
  list.forEach(x => { counts[x] = (counts[x] || 0) + 1; });
  return Object.entries(counts).map(([name, count]) => count > 1 ? `${name} x${count}` : name).join(', ');
}

// BOTTOM SHEET : CONFIGURATEUR PACK PROMO 2 TACOS (L = 55 DH / XL = 89 DH + OPTION +15 DH)
function PromoTacosSheet({ initialSize = 'L', stocks, onClose, onAdd, notify }) {
  const [taille, setTaille] = useState(initialSize);
  const [tacos1Viandes, setTacos1Viandes] = useState([]);
  const [tacos1Sauces, setTacos1Sauces] = useState([]);
  const [tacos1Extras, setTacos1Extras] = useState([]);
  const [tacos2Viandes, setTacos2Viandes] = useState([]);
  const [tacos2Sauces, setTacos2Sauces] = useState([]);
  const [tacos2Extras, setTacos2Extras] = useState([]);
  const [avecFritesBoisson, setAvecFritesBoisson] = useState(false);

  const prixBasePack = taille === 'XL' ? 89 : 55;
  const maxViandes = taille === 'XL' ? 3 : 2;

  const viandesDispo = (stocks.viandes || []).filter(v => v.available).map(v => v.nom);
  const saucesDispo = (stocks.sauces || []).filter(s => s.available).map(s => s.nom);

  const toggleItem = (list, setList, val, max = null) => {
    if (list.includes(val)) {
      setList(list.filter(x => x !== val));
    } else {
      if (max && list.length >= max) return;
      setList([...list, val]);
    }
  };

  const extraSum = [...tacos1Extras, ...tacos2Extras].reduce((sum, ext) => sum + (TACOS_EXTRAS[ext] || 0), 0);
  const totalPackPrice = prixBasePack + (avecFritesBoisson ? 15 : 0) + extraSum;

  const handleConfirmPack = () => {
    if (tacos1Viandes.length === 0 || tacos2Viandes.length === 0) {
      return notify(`Veuillez choisir au moins 1 viande (max ${maxViandes}) pour chacun des 2 Tacos`, "error");
    }
    if (tacos1Sauces.length === 0 || tacos2Sauces.length === 0) {
      return notify("Veuillez choisir au moins 1 sauce pour chacun des 2 Tacos", "error");
    }

    let details = [];
    if (avecFritesBoisson) {
      details.push("[OPTION +15DH] Avec Frites + Boisson 1L");
    } else {
      details.push("[SANS FRITES] Offre Promo 2 Tacos");
    }

    details.push(`Tacos #1 (${taille}): ${tacos1Viandes.join(', ')} | Sauces: ${tacos1Sauces.join(', ')}`);
    tacos1Extras.forEach(ext => details.push(`  + [Tacos #1] ${ext} (+${TACOS_EXTRAS[ext]}DH)`));

    details.push(`Tacos #2 (${taille}): ${tacos2Viandes.join(', ')} | Sauces: ${tacos2Sauces.join(', ')}`);
    tacos2Extras.forEach(ext => details.push(`  + [Tacos #2] ${ext} (+${TACOS_EXTRAS[ext]}DH)`));

    onAdd({
      id: `promo_tacos_${taille}`,
      categorie: 'PromoTacos',
      varianteNom: taille,
      nom: `[PROMO] 2 Tacos ${taille}${avecFritesBoisson ? ' + Frites & 1L' : ' (Sans Frites)'}`,
      extraPrice: (avecFritesBoisson ? 15 : 0) + extraSum,
      prixFinal: totalPackPrice,
      isPromoPack: true,
      detailsTxt: details
    });
    onClose();
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(9, 9, 11, 0.72)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} className="sheet-anim" style={{ background: 'white', width: '100%', maxWidth: '600px', borderRadius: '16px 16px 0 0', padding: '20px', maxHeight: '90vh', overflowY: 'auto', boxSizing: 'border-box' }}>
        <div style={{ width: '36px', height: '4px', background: COLORS.borderStrong, borderRadius: '999px', margin: '0 auto 14px auto' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', borderBottom: `1px solid ${COLORS.border}`, paddingBottom: '14px', marginBottom: '14px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', letterSpacing: '-0.02em' }}>Offre Duo Tacos {taille} ({prixBasePack} DH)</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: COLORS.textLight }}>
              Inclus : 2 Tacos {taille} sans frites • Option Frites + Boisson 1L à +15 DH
            </p>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: COLORS.bg, width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* SÉLECTEUR TAILLE L (55 DH) / XL (89 DH) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
          <button className="taste-btn num-tabular" onClick={() => { setTaille('L'); setTacos1Viandes([]); setTacos2Viandes([]); }} style={{ padding: '11px', borderRadius: '8px', border: `1px solid ${taille === 'L' ? COLORS.secondary : COLORS.border}`, background: taille === 'L' ? COLORS.secondary : 'white', color: taille === 'L' ? 'white' : COLORS.textMain, fontWeight: '700', cursor: 'pointer' }}>
            2 Tacos L — 55 DH
          </button>
          <button className="taste-btn num-tabular" onClick={() => { setTaille('XL'); setTacos1Viandes([]); setTacos2Viandes([]); }} style={{ padding: '11px', borderRadius: '8px', border: `1px solid ${taille === 'XL' ? COLORS.secondary : COLORS.border}`, background: taille === 'XL' ? COLORS.secondary : 'white', color: taille === 'XL' ? 'white' : COLORS.textMain, fontWeight: '700', cursor: 'pointer' }}>
            2 Tacos XL — 89 DH
          </button>
        </div>

        {/* TOGGLE OPTION +15 DH FRITES & BOISSON 1L */}
        <button
          className="taste-btn num-tabular"
          onClick={() => setAvecFritesBoisson(!avecFritesBoisson)}
          style={{
            width: '100%', padding: '13px 14px', borderRadius: '10px',
            border: `1px solid ${avecFritesBoisson ? COLORS.success : COLORS.borderStrong}`,
            background: avecFritesBoisson ? '#ECFDF5' : COLORS.bg,
            color: COLORS.textMain, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer', marginBottom: '16px', textAlign: 'left'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <StatusDot active={avecFritesBoisson} />
            <span>{avecFritesBoisson ? 'Option activée : Avec Frites + Boisson 1L' : 'Ajouter Frites + Boisson 1L (Sinon : Sans Frites)'}</span>
          </div>
          <span style={{ background: avecFritesBoisson ? COLORS.success : COLORS.secondary, color: 'white', padding: '4px 9px', borderRadius: '6px', fontSize: '0.82rem', fontWeight: '700', flexShrink: 0 }}>+ 15 DH</span>
        </button>

        {/* CONFIGURATION TACOS #1 */}
        <div style={{ background: COLORS.bg, padding: '14px', borderRadius: '12px', border: `1px solid ${COLORS.border}`, marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <strong style={{ fontSize: '0.95rem' }}>Tacos #1 ({taille})</strong>
            <span className="num-tabular" style={{ fontSize: '0.78rem', color: COLORS.textLight, fontWeight: '600' }}>Viandes : {tacos1Viandes.length}/{maxViandes}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
            {viandesDispo.map(v => {
              const sel = tacos1Viandes.includes(v);
              return (
                <button key={v} className="taste-btn" onClick={() => toggleItem(tacos1Viandes, setTacos1Viandes, v, maxViandes)} style={{ padding: '7px 11px', borderRadius: '6px', border: `1px solid ${sel ? COLORS.primary : COLORS.border}`, background: sel ? COLORS.primary : 'white', color: sel ? 'white' : COLORS.textMain, fontWeight: '600', fontSize: '0.84rem', cursor: 'pointer' }}>{v}</button>
              );
            })}
          </div>
          <div style={{ fontSize: '0.78rem', fontWeight: '600', color: COLORS.textLight, marginBottom: '6px' }}>Sauces Tacos #1 (max 2)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
            {saucesDispo.map(s => {
              const sel = tacos1Sauces.includes(s);
              return (
                <button key={s} className="taste-btn" onClick={() => toggleItem(tacos1Sauces, setTacos1Sauces, s, 2)} style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${COLORS.border}`, background: sel ? COLORS.secondary : 'white', color: sel ? 'white' : COLORS.textMain, fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer' }}>{s}</button>
              );
            })}
          </div>
          <div style={{ fontSize: '0.78rem', fontWeight: '600', color: COLORS.textLight, marginBottom: '6px' }}>Suppléments Tacos #1</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {Object.keys(TACOS_EXTRAS).map(ext => {
              const sel = tacos1Extras.includes(ext);
              return (
                <button key={ext} className="taste-btn num-tabular" onClick={() => toggleItem(tacos1Extras, setTacos1Extras, ext)} style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${COLORS.border}`, background: sel ? COLORS.secondary : 'white', color: sel ? 'white' : COLORS.textMain, fontWeight: '600', fontSize: '0.78rem', cursor: 'pointer' }}>{ext} (+{TACOS_EXTRAS[ext]}DH)</button>
              );
            })}
          </div>
        </div>

        {/* CONFIGURATION TACOS #2 */}
        <div style={{ background: COLORS.bg, padding: '14px', borderRadius: '12px', border: `1px solid ${COLORS.border}`, marginBottom: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <strong style={{ fontSize: '0.95rem' }}>Tacos #2 ({taille})</strong>
            <span className="num-tabular" style={{ fontSize: '0.78rem', color: COLORS.textLight, fontWeight: '600' }}>Viandes : {tacos2Viandes.length}/{maxViandes}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
            {viandesDispo.map(v => {
              const sel = tacos2Viandes.includes(v);
              return (
                <button key={v} className="taste-btn" onClick={() => toggleItem(tacos2Viandes, setTacos2Viandes, v, maxViandes)} style={{ padding: '7px 11px', borderRadius: '6px', border: `1px solid ${sel ? COLORS.primary : COLORS.border}`, background: sel ? COLORS.primary : 'white', color: sel ? 'white' : COLORS.textMain, fontWeight: '600', fontSize: '0.84rem', cursor: 'pointer' }}>{v}</button>
              );
            })}
          </div>
          <div style={{ fontSize: '0.78rem', fontWeight: '600', color: COLORS.textLight, marginBottom: '6px' }}>Sauces Tacos #2 (max 2)</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
            {saucesDispo.map(s => {
              const sel = tacos2Sauces.includes(s);
              return (
                <button key={s} className="taste-btn" onClick={() => toggleItem(tacos2Sauces, setTacos2Sauces, s, 2)} style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${COLORS.border}`, background: sel ? COLORS.secondary : 'white', color: sel ? 'white' : COLORS.textMain, fontWeight: '600', fontSize: '0.8rem', cursor: 'pointer' }}>{s}</button>
              );
            })}
          </div>
          <div style={{ fontSize: '0.78rem', fontWeight: '600', color: COLORS.textLight, marginBottom: '6px' }}>Suppléments Tacos #2</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {Object.keys(TACOS_EXTRAS).map(ext => {
              const sel = tacos2Extras.includes(ext);
              return (
                <button key={ext} className="taste-btn num-tabular" onClick={() => toggleItem(tacos2Extras, setTacos2Extras, ext)} style={{ padding: '6px 10px', borderRadius: '6px', border: `1px solid ${COLORS.border}`, background: sel ? COLORS.secondary : 'white', color: sel ? 'white' : COLORS.textMain, fontWeight: '600', fontSize: '0.78rem', cursor: 'pointer' }}>{ext} (+{TACOS_EXTRAS[ext]}DH)</button>
              );
            })}
          </div>
        </div>

        <button className="taste-btn num-tabular" onClick={handleConfirmPack} style={{ width: '100%', padding: '15px', background: COLORS.primary, color: 'white', border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: '700', cursor: 'pointer' }}>
          Ajouter le Pack au panier • {totalPackPrice} DH
        </button>
      </div>
    </div>
  );
}

// BOTTOM SHEET : OFFRE DIMANCHE (AVEC GESTION DES GARNITURES POUR 2 SAISONS & 4 SAISONS)
function PromoWizard({ menu, stocks, onClose, onValidate, notify }) {
  const [choix, setChoix] = useState([]);
  const [configuringPizza, setConfiguringPizza] = useState(null);
  const [tempGarnitures, setTempGarnitures] = useState([]);

  const garnituresDispo = (stocks?.garnitures || []).filter(g => g.available).map(g => g.nom);

  const pizzasEligibles = menu.filter(p =>
    p.categorie === 'Pizzas' &&
    p.available !== false &&
    !PIZZAS_EXCLUES_PROMO.some(ex => p.nom.toLowerCase().includes(ex))
  );

  const finalizeAddPizza = (pizza, garnituresList = []) => {
    let varianteM = pizza.variantes?.find(v => (v.nom === 'M' || v.nom === 'Standard') && v.available !== false);
    if (!varianteM && pizza.variantes?.length > 0) varianteM = pizza.variantes.find(v => v.available !== false);

    const prixFinal = varianteM ? (Number(varianteM.prix) || 0) : (Number(pizza.prix) || 0);
    const varianteNom = varianteM ? varianteM.nom : 'M';
    const nomComplet = `[PIZZAS] ${pizza.nom} (${varianteNom})`;

    const details = garnituresList.length > 0 ? [`Garnitures: ${formatOptions(garnituresList)}`] : [];

    setChoix(prev => [...prev, {
      ...pizza,
      nom: nomComplet,
      prixFinal,
      originalPrice: prixFinal,
      varianteNom,
      optionsChoisies: garnituresList,
      isPromoEligible: true,
      detailsTxt: details
    }]);
    setConfiguringPizza(null);
    setTempGarnitures([]);
  };

  const handleSelect = (pizza) => {
    if (choix.length >= 3) return;
    const nomLower = (pizza.nom || '').toLowerCase();
    if (nomLower.includes('2 saisons')) {
      setConfiguringPizza({ pizza, requiredCount: 2 });
      setTempGarnitures([]);
      return;
    }
    if (nomLower.includes('4 saisons')) {
      setConfiguringPizza({ pizza, requiredCount: 4 });
      setTempGarnitures([]);
      return;
    }
    finalizeAddPizza(pizza, []);
  };

  const handleRemoveChoice = (indexToRemove) => {
    setChoix(choix.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(9, 9, 11, 0.72)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} className="sheet-anim" style={{ background: 'white', width: '100%', maxWidth: '560px', borderRadius: '16px 16px 0 0', padding: '22px', maxHeight: '88vh', overflowY: 'auto', boxSizing: 'border-box' }}>
        <div style={{ width: '36px', height: '4px', background: COLORS.borderStrong, borderRadius: '999px', margin: '0 auto 14px auto' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h3 style={{ margin: 0, letterSpacing: '-0.02em', fontSize: '1.2rem' }}>Pack Offre Dimanche ({choix.length}/3)</h3>
            <div style={{ fontSize: '0.82rem', color: COLORS.textLight }}>2 Pizzas M achetées = la 3ème offerte automatiquement</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: COLORS.bg, width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: COLORS.bg, padding: '10px', borderRadius: '12px', border: `1px solid ${COLORS.border}` }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ flex: 1, minHeight: '60px', background: 'white', border: choix[i] ? `1.5px solid ${COLORS.secondary}` : `1px dashed ${COLORS.borderStrong}`, borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: '0.76rem', textAlign: 'center', position: 'relative', fontWeight: '600', padding: '6px' }}>
              {choix[i] ? (
                <>
                  <span>{choix[i].nom.split('] ')[1]}</span>
                  <button onClick={() => handleRemoveChoice(i)} style={{ position: 'absolute', top: '-6px', right: '-6px', background: COLORS.danger, color: 'white', border: 'none', width: '20px', height: '20px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="x" size={11} />
                  </button>
                </>
              ) : <span style={{ color: COLORS.textLight }}>Pizza #{i + 1}</span>}
            </div>
          ))}
        </div>

        {/* SOUS-SÉLECTEUR DE GARNITURES SI 2 SAISONS OU 4 SAISONS EST SÉLECTIONNÉE */}
        {configuringPizza ? (
          <div style={{ background: COLORS.bg, padding: '16px', borderRadius: '12px', border: `1px solid ${COLORS.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <strong style={{ fontSize: '0.95rem' }}>{configuringPizza.pizza.nom} : choisissez {configuringPizza.requiredCount} garnitures</strong>
              <span className="num-tabular" style={{ fontSize: '0.82rem', fontWeight: '700', color: COLORS.primary }}>{tempGarnitures.length}/{configuringPizza.requiredCount}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
              {garnituresDispo.map(g => {
                const count = tempGarnitures.filter(x => x === g).length;
                return (
                  <button
                    key={g}
                    className="taste-btn"
                    onClick={() => {
                      if (tempGarnitures.length < configuringPizza.requiredCount) {
                        setTempGarnitures([...tempGarnitures, g]);
                      }
                    }}
                    style={{ padding: '8px 12px', borderRadius: '8px', border: `1px solid ${count > 0 ? COLORS.primary : COLORS.border}`, background: count > 0 ? COLORS.primary : 'white', color: count > 0 ? 'white' : COLORS.textMain, fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer' }}
                  >
                    {g} {count > 0 ? `x${count}` : ''}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="taste-btn" onClick={() => { setConfiguringPizza(null); setTempGarnitures([]); }} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, background: 'white', fontWeight: '600', cursor: 'pointer' }}>Retour</button>
              {tempGarnitures.length > 0 && (
                <button className="taste-btn" onClick={() => setTempGarnitures([])} style={{ padding: '10px 14px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, background: 'white', color: COLORS.danger, fontWeight: '600', cursor: 'pointer' }}>Effacer</button>
              )}
              <button
                className="taste-btn"
                disabled={tempGarnitures.length < configuringPizza.requiredCount}
                onClick={() => finalizeAddPizza(configuringPizza.pizza, tempGarnitures)}
                style={{ flex: 2, padding: '10px', borderRadius: '8px', border: 'none', background: COLORS.secondary, color: 'white', fontWeight: '600', cursor: 'pointer', opacity: tempGarnitures.length < configuringPizza.requiredCount ? 0.5 : 1 }}
              >
                Valider cette pizza
              </button>
            </div>
          </div>
        ) : choix.length < 3 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pizzasEligibles.map(p => (
              <button key={p.id} className="taste-btn" onClick={() => handleSelect(p)} style={{ padding: '13px 16px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, background: 'white', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                <span style={{ fontWeight: '600', color: COLORS.textMain, fontSize: '0.95rem' }}>{p.nom}</span>
                <span style={{ color: COLORS.textMain, fontWeight: '600', background: COLORS.bg, padding: '5px 10px', borderRadius: '6px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Icon name="plus" size={13} /> Sélectionner
                </span>
              </button>
            ))}
          </div>
        ) : (
          <button className="taste-btn" onClick={() => onValidate(choix)} style={{ background: COLORS.primary, color: 'white', width: '100%', padding: '15px', border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: '700', cursor: 'pointer' }}>
            Ajouter les 3 Pizzas au panier
          </button>
        )}
      </div>
    </div>
  );
}

// BOTTOM SHEET : PERSONNALISATION D'UN PRODUIT INDIVIDUEL
function ProductModal({ product, stocks, onClose, onAdd, notify }) {
  const taillesGlobalesDispo = stocks.tailles_pizza ? stocks.tailles_pizza.filter(t => t.available).map(t => t.nom) : [];

  const isPizza = (product.categorie || '').toLowerCase().includes('pizza');
  const variantesDispo = product.variantes ? product.variantes.filter(v => {
    const isProductAvailable = v.available !== false;
    const isGlobalSizeAvailable = isPizza ? taillesGlobalesDispo.includes(v.nom) : true;
    return isProductAvailable && isGlobalSizeAvailable;
  }) : [];

  const [selectedVar, setSelectedVar] = useState(variantesDispo.length > 0 ? variantesDispo[0] : null);
  const [optionsChoisies, setOptionsChoisies] = useState([]);
  const [sauces, setSauces] = useState([]);
  const [typePates, setTypePates] = useState(null);
  const [isCheesyCrust, setIsCheesyCrust] = useState(false);
  const [extrasPizza, setExtrasPizza] = useState([]);
  const [extrasTacos, setExtrasTacos] = useState([]);
  const [sansIngredients, setSansIngredients] = useState([]);

  let maxChoix = 0, minChoix = 0, listeOptions = [], titreOptions = "";
  const nomLower = (product.nom || '').toLowerCase();
  const catLower = (product.categorie || '').toLowerCase();
  const isPates = catLower.includes('pâtes') || catLower.includes('pates');
  const isTacos = catLower.includes('tacos');
  const isPizzaProduct = catLower.includes('pizza');
  const isBurger = catLower.includes('burger');
  const isMixte = isTacos && nomLower.includes('mixte');

  const viandesDispo = (stocks.viandes || []).filter(v => v.available).map(v => v.nom);
  const garnituresDispo = (stocks.garnitures || []).filter(g => g.available).map(g => g.nom);
  const patesDispo = (stocks.pates || []).filter(p => p.available).map(p => p.nom);
  const saucesDispo = (stocks.sauces || []).filter(s => s.available).map(s => s.nom);

  if (isMixte) {
    listeOptions = viandesDispo;
    titreOptions = "Choisissez vos viandes";
    if (selectedVar?.nom === 'XL') { maxChoix = 3; minChoix = 3; }
    else if (selectedVar?.nom === 'XXL') { maxChoix = 4; minChoix = 4; }
    else { maxChoix = 2; minChoix = 2; }
  } else if (isPizzaProduct) {
    if (nomLower.includes('2 saisons')) { maxChoix = 2; minChoix = 2; listeOptions = garnituresDispo; titreOptions = "Choisissez 2 garnitures"; }
    if (nomLower.includes('4 saisons')) { maxChoix = 4; minChoix = 4; listeOptions = garnituresDispo; titreOptions = "Choisissez 4 garnitures"; }
  }

  const incrementOption = (opt, currentList, setList, max) => { if (currentList.length < max) setList([...currentList, opt]); };
  const decrementOption = (opt, currentList, setList) => { const index = currentList.indexOf(opt); if (index > -1) { const newList = [...currentList]; newList.splice(index, 1); setList(newList); } };
  const toggleExtraPizza = (extraObj) => { if (extrasPizza.some(e => e.nom === extraObj.nom)) setExtrasPizza(extrasPizza.filter(e => e.nom !== extraObj.nom)); else setExtrasPizza([...extrasPizza, extraObj]); };
  const toggleExtraTacos = (extName) => { if (extrasTacos.includes(extName)) setExtrasTacos(extrasTacos.filter(x => x !== extName)); else setExtrasTacos([...extrasTacos, extName]); };
  const toggleSans = (item) => { if (sansIngredients.includes(item)) setSansIngredients(sansIngredients.filter(x => x !== item)); else setSansIngredients([...sansIngredients, item]); };
  const getCount = (opt, list) => list.filter(x => x === opt).length;

  const basePrice = selectedVar ? Number(selectedVar.prix) : Number(product.prix);
  const totalExtrasPizza = extrasPizza.reduce((acc, curr) => acc + curr.prix, 0);
  const totalExtrasTacos = extrasTacos.reduce((acc, name) => acc + (TACOS_EXTRAS[name] || 0), 0);
  const prixCheesy = (isCheesyCrust ? (selectedVar?.nom === 'M' || selectedVar?.nom === 'Standard' || !selectedVar ? 15 : 25) : 0);
  const extraPriceTotal = totalExtrasPizza + totalExtrasTacos + prixCheesy;
  const finalPriceCalculated = (basePrice || 0) + extraPriceTotal;

  return (
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(9, 9, 11, 0.72)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} className="sheet-anim" style={{ background: 'white', width: '100%', maxWidth: '580px', borderRadius: '16px 16px 0 0', padding: '22px', maxHeight: '88vh', overflowY: 'auto', boxSizing: 'border-box' }}>
        <div style={{ width: '36px', height: '4px', background: COLORS.borderStrong, borderRadius: '999px', margin: '0 auto 14px auto' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '12px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', letterSpacing: '-0.02em' }}>{product.nom}</h2>
            {product.description && <p style={{ color: COLORS.textLight, marginTop: '4px', fontSize: '0.86rem', lineHeight: '1.4' }}>{product.description}</p>}
          </div>
          <button onClick={onClose} style={{ border: 'none', background: COLORS.bg, width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <Icon name="x" size={16} />
          </button>
        </div>

        {variantesDispo.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontWeight: '600', marginBottom: '8px', fontSize: '0.85rem', color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Taille</div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(variantesDispo.length, 3)}, 1fr)`, gap: '8px' }}>
              {variantesDispo.map(v => {
                const isSel = selectedVar?.nom === v.nom;
                return (
                  <button
                    key={v.nom}
                    className="taste-btn num-tabular"
                    onClick={() => { setSelectedVar(v); setOptionsChoisies([]); }}
                    style={{
                      padding: '10px', borderRadius: '8px',
                      border: `1px solid ${isSel ? COLORS.secondary : COLORS.border}`,
                      background: isSel ? COLORS.secondary : 'white',
                      color: isSel ? 'white' : COLORS.textMain,
                      fontWeight: '700', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem'
                    }}
                  >
                    <span>{v.nom}</span>
                    <span style={{ opacity: 0.9 }}>{v.prix} DH</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {isPates && (
          <div style={{ marginTop: '18px', borderTop: `1px solid ${COLORS.border}`, paddingTop: '14px' }}>
            <div style={{ fontWeight: '600', marginBottom: '8px', fontSize: '0.88rem' }}>Type de Pâtes (Obligatoire)</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {patesDispo.map(type => (
                <button key={type} className="taste-btn" onClick={() => setTypePates(type)} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: `1px solid ${typePates === type ? COLORS.secondary : COLORS.border}`, background: typePates === type ? COLORS.secondary : 'white', fontWeight: '600', color: typePates === type ? 'white' : COLORS.textMain, cursor: 'pointer' }}>{type}</button>
              ))}
            </div>
          </div>
        )}

        {isPizzaProduct && (
          <div style={{ marginTop: '18px', borderTop: `1px solid ${COLORS.border}`, paddingTop: '14px' }}>
            <div style={{ fontWeight: '600', marginBottom: '8px', fontSize: '0.88rem' }}>Croûte & Suppléments</div>
            <div className="taste-btn num-tabular" onClick={() => setIsCheesyCrust(!isCheesyCrust)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderRadius: '8px', border: `1px solid ${isCheesyCrust ? COLORS.secondary : COLORS.border}`, background: isCheesyCrust ? COLORS.secondary : COLORS.bg, color: isCheesyCrust ? 'white' : COLORS.textMain, cursor: 'pointer', marginBottom: '10px', fontWeight: '600', fontSize: '0.9rem' }}>
              <span>Option Cheesy Crust (Bords fourrés)</span>
              <span>+{selectedVar?.nom === 'M' || selectedVar?.nom === 'Standard' || !selectedVar ? '15' : '25'} DH</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {EXTRAS_PIZZA.map(ex => {
                const isSelected = extrasPizza.some(e => e.nom === ex.nom);
                return (
                  <button key={ex.nom} className="taste-btn num-tabular" onClick={() => toggleExtraPizza(ex)} style={{ padding: '8px 12px', borderRadius: '8px', border: `1px solid ${isSelected ? COLORS.secondary : COLORS.border}`, background: isSelected ? COLORS.secondary : 'white', color: isSelected ? 'white' : COLORS.textMain, fontWeight: '600', fontSize: '0.82rem', cursor: 'pointer' }}>
                    {ex.nom} (+{ex.prix} DH)
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {isBurger && (
          <div style={{ marginTop: '18px', borderTop: `1px solid ${COLORS.border}`, paddingTop: '14px' }}>
            <div style={{ fontWeight: '600', marginBottom: '8px', color: COLORS.textLight, fontSize: '0.85rem' }}>Retirer un ingrédient</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {RETRAIT_INGREDIENTS.map(ing => {
                const isSel = sansIngredients.includes(ing);
                return (
                  <button key={ing} className="taste-btn" onClick={() => toggleSans(ing)} style={{ padding: '7px 12px', borderRadius: '8px', border: `1px solid ${isSel ? COLORS.danger : COLORS.border}`, background: isSel ? '#FEF2F2' : 'white', color: isSel ? COLORS.danger : COLORS.textMuted, fontWeight: '600', fontSize: '0.82rem', cursor: 'pointer' }}>
                    {ing}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {isTacos && (
          <div style={{ marginTop: '18px', borderTop: `1px solid ${COLORS.border}`, paddingTop: '14px' }}>
            <div style={{ fontWeight: '600', marginBottom: '8px', fontSize: '0.88rem' }}>Sauces Fait Maison <small style={{ color: sauces.length === 0 ? COLORS.danger : COLORS.success }}>(Min 1, Max 2)</small></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
              {saucesDispo.map(s => {
                const count = getCount(s, sauces);
                return (
                  <div key={s} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${COLORS.bg}` }}>
                    <span style={{ fontWeight: '500', fontSize: '0.9rem' }}>{s}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {count > 0 && <button className="taste-btn" onClick={() => decrementOption(s, sauces, setSauces)} style={{ width: '28px', height: '28px', borderRadius: '6px', border: `1px solid ${COLORS.border}`, background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="minus" size={13} /></button>}
                      {count > 0 && <span className="num-tabular" style={{ fontWeight: '700', fontSize: '0.9rem' }}>{count}</span>}
                      <button className="taste-btn" onClick={() => incrementOption(s, sauces, setSauces, 2)} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', background: COLORS.secondary, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={13} /></button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ fontWeight: '600', marginBottom: '8px', fontSize: '0.88rem' }}>Suppléments Fromagers</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {Object.keys(TACOS_EXTRAS).map(ext => {
                const sel = extrasTacos.includes(ext);
                return (
                  <button key={ext} className="taste-btn num-tabular" onClick={() => toggleExtraTacos(ext)} style={{ padding: '7px 11px', borderRadius: '8px', border: `1px solid ${sel ? COLORS.secondary : COLORS.border}`, background: sel ? COLORS.secondary : 'white', color: sel ? 'white' : COLORS.textMain, fontWeight: '600', fontSize: '0.82rem', cursor: 'pointer' }}>
                    {ext} (+{TACOS_EXTRAS[ext]} DH)
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {maxChoix > 0 && (
          <div style={{ marginTop: '18px', borderTop: `1px solid ${COLORS.border}`, paddingTop: '14px' }}>
            <div style={{ fontWeight: '600', marginBottom: '8px', fontSize: '0.88rem' }}>
              {titreOptions} <small className="num-tabular" style={{ color: optionsChoisies.length < minChoix ? COLORS.danger : COLORS.success }}>({optionsChoisies.length}/{maxChoix})</small>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {listeOptions.map(opt => {
                const count = getCount(opt, optionsChoisies);
                return (
                  <div key={opt} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: `1px solid ${COLORS.bg}` }}>
                    <span style={{ fontWeight: '500', fontSize: '0.9rem' }}>{opt}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {count > 0 && <button className="taste-btn" onClick={() => decrementOption(opt, optionsChoisies, setOptionsChoisies)} style={{ width: '28px', height: '28px', borderRadius: '6px', border: `1px solid ${COLORS.border}`, background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="minus" size={13} /></button>}
                      {count > 0 && <span className="num-tabular" style={{ fontWeight: '700', fontSize: '0.9rem' }}>{count}</span>}
                      <button className="taste-btn" onClick={() => incrementOption(opt, optionsChoisies, setOptionsChoisies, maxChoix)} style={{ width: '28px', height: '28px', borderRadius: '6px', border: 'none', background: COLORS.primary, color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="plus" size={13} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button
          className="taste-btn num-tabular"
          onClick={() => {
            if (isPates && !typePates) return notify("Veuillez choisir votre type de pâtes", "error");
            if (minChoix > 0 && optionsChoisies.length < minChoix) return notify(`Veuillez sélectionner ${minChoix} options`, "error");
            if (isTacos && sauces.length === 0) return notify("Veuillez choisir au moins une sauce", "error");

            const catUpper = product.categorie ? product.categorie.toUpperCase() : 'PLAT';
            const nomComplet = selectedVar ? `[${catUpper}] ${product.nom} (${selectedVar.nom})` : `[${catUpper}] ${product.nom}`;

            let details = [];
            if (typePates) details.push(`Type: ${typePates}`);
            if (isCheesyCrust) details.push(`Cheesy Crust (+${prixCheesy}DH)`);
            if (optionsChoisies.length > 0) details.push(`Options: ${formatOptions(optionsChoisies)}`);
            if (sauces.length > 0) details.push(`Sauces: ${formatOptions(sauces)}`);
            if (extrasPizza.length > 0) extrasPizza.forEach(ext => details.push(`+ ${ext.nom}`));
            if (extrasTacos.length > 0) extrasTacos.forEach(ext => details.push(`+ ${ext} (+${TACOS_EXTRAS[ext]}DH)`));
            if (sansIngredients.length > 0) sansIngredients.forEach(exc => details.push(`[SANS] ${exc}`));

            onAdd({
              ...product,
              nom: nomComplet,
              extraPrice: extraPriceTotal,
              prixFinal: finalPriceCalculated,
              varianteNom: selectedVar ? selectedVar.nom : null,
              sauces,
              optionsChoisies,
              choixPates: typePates,
              isCheesyCrust,
              extras: [...extrasPizza, ...extrasTacos],
              sans: sansIngredients,
              detailsTxt: details
            });
          }}
          style={{
            background: COLORS.primary, color: 'white', border: 'none', borderRadius: '12px',
            padding: '15px', fontWeight: '700', width: '100%', marginTop: '20px', fontSize: '1rem',
            cursor: 'pointer', opacity: (minChoix > 0 && optionsChoisies.length < minChoix) ? 0.55 : 1
          }}
        >
          {minChoix > 0 && optionsChoisies.length < minChoix
            ? `Sélectionnez encore ${minChoix - optionsChoisies.length} option(s)`
            : `Ajouter à la commande • ${finalPriceCalculated} DH`}
        </button>
      </div>
    </div>
  );
}

const uiTasteStyles = `
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    margin: 0;
    background: #F4F4F5;
  }

  .num-tabular {
    font-variant-numeric: tabular-nums;
  }

  .taste-btn {
    transition: transform 150ms cubic-bezier(0.22, 1, 0.36, 1), opacity 150ms ease, border-color 150ms ease;
    will-change: transform;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .taste-btn:active:not(:disabled) {
    transform: scale(0.97);
  }

  .taste-card {
    transition: transform 160ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 160ms cubic-bezier(0.22, 1, 0.36, 1), border-color 160ms ease;
    -webkit-tap-highlight-color: transparent;
  }
  .taste-card:hover {
    border-color: #D4D4D8 !important;
  }
  .taste-card:active {
    transform: scale(0.98);
  }

  @keyframes sheetUp {
    from { opacity: 0; transform: translateY(100%); }
    to { opacity: 1; transform: translateY(0); }
  }
  .sheet-anim {
    animation: sheetUp 220ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }

  @keyframes modalPop {
    from { opacity: 0; transform: scale(0.96) translateY(6px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
  .modal-anim {
    animation: modalPop 180ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }
`;

export default App;
