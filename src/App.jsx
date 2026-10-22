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

// PALETTE CALIBRÉE (UI DESIGN TASTE PRO - ZINC & BRAND FOODJI)
const COLORS = {
  primary: '#A84438',
  secondary: '#18181B', // Zinc 900
  bg: '#F4F4F5',        // Zinc 100
  card: '#FFFFFF',
  border: '#E4E4E7',    // Zinc 200
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  promo: '#D97706',
  textMain: '#09090B',  // Zinc 950
  textLight: '#71717A', // Zinc 500
  pending: '#F97316'
};

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

const RETRAIT_INGREDIENTS = ["Sans Tomate", "Sans Salade", "Sans Oignons", "Sans Cornichons", "Sans Sauce"];
const PIZZAS_EXCLUES_PROMO = ["4 saisons", "fruits de mer", "cannibale", "2 saisons"];
const TOUTES_CATEGORIES = ["Tacos", "Pizzas", "Burgers", "Panuozzo", "Pâtes", "Sides", "Les Burritos", "Koniks", "Plats", "Salades", "Boissons", "Desserts"];

const STOCK_TABS = [
  { id: 'viandes', label: '🌮 Viandes' },
  { id: 'garnitures', label: '🍕 Garnitures' },
  { id: 'tailles_pizza', label: '📏 Tailles' },
  { id: 'pates', label: '🍝 Pâtes' },
  { id: 'sauces', label: '🥣 Sauces' }
];

const NOTIF_SOUND = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

const logoImg = "/logo.png";
const iconImg = "/icon.png";
const promoImg = "/promo.jpg";

const WELCOME_TOKEN_REF = "START2026";
const POURCENTAGE_REMISE = 0.20;
const SYNC_ID_VERSION = "053700";

const seoConfig = {
  title: "Foodji - Le Fait Maison à Sala Al Jadida | Burgers & Tacos (Jusqu'à 2h)",
  description: "Arrêtez de payer cher pour du surgelé. Chez Foodji, découvrez le vrai goût du Fait Maison : Burgers et Tacos haute qualité à prix accessible. Livraison sur Sala Al Jadida jusqu'à 2h du matin !",
  keywords: "restaurant sala al jadida, livraison burger, tacos technopolis, cuisine minute, uir, pizza nuit, fait maison",
  image: "https://foodji.ma/promo.jpg",
  url: "https://foodji.ma"
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "Foodji",
  "image": seoConfig.image,
  "description": "Foodji propose une cuisine minute à Sala Al Jadida avec une promesse simple : du Fait Maison et de la haute qualité à prix moyen. Burgers gourmets, Tacos gratinés et Pizzas préparés à la commande.",
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
  "servesCuisine": ["Burger", "Tacos", "Pizza", "Cuisine Minute"],
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday"],
      "opens": "12:00",
      "closes": "01:00"
    },
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Friday"],
      "opens": "12:00",
      "closes": "02:00"
    },
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Saturday", "Sunday"],
      "opens": "18:00",
      "closes": "02:00"
    }
  ]
};

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('landing');

  const [menu, setMenu] = useState([]);
  const [commandes, setCommandes] = useState([]);

  const prevCommandesLength = useRef(null);
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showPromoWizard, setShowPromoWizard] = useState(false);
  const [showCGV, setShowCGV] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [isMenuLoading, setIsMenuLoading] = useState(true);

  const [categorieActive, setCategorieActive] = useState('');
  const [adminCategorie, setAdminCategorie] = useState('');

  const [parametresStatus, setParametresStatus] = useState({ rushMode: 'standard', promoDuoActive: false, promoDimancheActive: false });
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

  // Écouteurs publics (Lecture seule stricte côté client)
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
          promoDimancheActive: data.promoDimancheActive || false
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

  // SÉCURITÉ RED TEAM : On n'écoute la collection "commandes" QUE si un administrateur (user) est connecté
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

  let categoriesClient = [...categoriesReelles];
  if (parametresStatus.promoDimancheActive) categoriesClient = ['🔥 PROMOTIONS', ...categoriesReelles];

  useEffect(() => {
    if (categoriesClient.length > 0 && (!categorieActive || !categoriesClient.includes(categorieActive))) {
      setCategorieActive(categoriesClient[0]);
    }
  }, [menu, categorieActive, parametresStatus.promoDimancheActive]);

  let menuClient = [];
  if (categorieActive === '🔥 PROMOTIONS') {
    menuClient = [{
      id: 'promo-sunday-card',
      nom: 'OFFRE DIMANCHE',
      description: '2 PIZZAS ACHETÉES = LA 3ÈME OFFERTE (Tailles M uniquement, hors 2/4 Saisons, Cannibale et Fruits de Mer)',
      categorie: '🔥 PROMOTIONS',
      prix: 0,
      image: promoImg,
      available: true,
      isPromoTrigger: true
    }];
  } else {
    menuClient = menu.filter(p => p.categorie === categorieActive && p.available !== false);
  }

  let menuAdmin = [];
  if (adminCategorie === 'RUPTURE') menuAdmin = menu.filter(p => p.available === false);
  else menuAdmin = menu.filter(p => p.categorie === adminCategorie);

  const checkManagerAuth = () => {
    const code = window.prompt("🔒 Code Manager requis :");
    if (code === SYNC_ID_VERSION) return true;
    alert("❌ Code incorrect !");
    return false;
  };

  const triggerImport = () => {
    if (checkManagerAuth()) fileInputRef.current.click();
  };

  const handleCSVImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      const rows = text.split('\n').filter(r => r.trim() !== '');
      if (window.confirm(`Importer ${rows.length} lignes ?`)) {
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
        setLoading(false); alert("Import terminé !"); e.target.value = null;
      }
    };
    reader.readAsText(file);
  };

  const viderMenu = async () => {
    if (!checkManagerAuth()) return;
    if (window.confirm("⚠️ SUPPRIMER TOUT LE MENU ?")) {
      setLoading(true);
      const batch = writeBatch(db);
      menu.forEach(p => { batch.delete(doc(db, "produits", p.id)); });
      await batch.commit();
      setLoading(false); alert("Menu vidé !");
    }
  };

  const handleStaffAccess = () => {
    if (user) setView('admin');
    else setView('login');
  };

  const ajouterAuPanier = (itemMerged) => {
    if (itemMerged.isPromoTrigger) { setShowPromoWizard(true); return; }
    if (itemMerged.isInfo) return alert("Info seulement.");
    setPanier(prev => [...prev, { ...itemMerged, qte: 1, uniqueId: Date.now() + Math.random() }]);
    setSelectedProduct(null);
  };

  const ajouterLotAuPanier = (lotPizzas) => {
    setPanier(prev => [...prev, ...lotPizzas.map((p, index) => ({ ...p, qte: 1, uniqueId: Date.now() + index + Math.random() }))]);
    setShowPromoWizard(false);
  };

  const retirerDuPanier = (uid) => setPanier(prev => prev.filter(i => i.uniqueId !== uid));

  const getPrixItemAjuste = (item) => {
    let prix = Number(item.prixFinal) || 0;
    if (item.nom.toLowerCase().includes("pep's") && (typeCommande === 'livraison' || typeCommande === 'emporter')) prix += 5;
    return prix;
  };

  // MOTEUR DE CALCUL ALIGNÉ SUR LE POS FOODJI
  const calculerTotalInterne = () => {
    let sousTotal = 0;
    let pizzasDimanchePrices = [];
    let eligibleDuoPrices = [];

    panier.forEach(item => {
      const p = getPrixItemAjuste(item);
      const qte = item.qte || 1;
      sousTotal += (p * qte);

      const vNom = item.varianteNom || '';
      const isPizza = (item.categorie || '').toLowerCase().includes('pizza');
      const isMoyenne = vNom === 'M' || vNom === 'Standard';
      const isExcludedSunday = PIZZAS_EXCLUES_PROMO.some(ex => item.nom.toLowerCase().includes(ex));

      if (parametresStatus.promoDimancheActive && (item.isPromoEligible || (isPizza && isMoyenne && !isExcludedSunday))) {
        for (let i = 0; i < qte; i++) pizzasDimanchePrices.push(p);
      }

      if (parametresStatus.promoDuoActive) {
        const isSalade = item.categorie === 'Salades';
        const isPeps = item.nom.toLowerCase().includes("pep's");
        const isTacosLarge = (item.categorie || '').toLowerCase().includes('tacos') && (vNom === 'L' || vNom === 'XL' || vNom === 'XXL');
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

    let remiseDuo = 0;
    if (parametresStatus.promoDuoActive && eligibleDuoPrices.length >= 2) {
      eligibleDuoPrices.sort((a, b) => a - b);
      const itemsToDiscount = Math.floor(eligibleDuoPrices.length / 2);
      for (let i = 0; i < itemsToDiscount; i++) remiseDuo += (eligiblePricesOrVal(eligibleDuoPrices[i]) * 0.5);
      remiseDuo = Math.round(remiseDuo);
    }

    const remisePromoSysteme = remiseDimanche + remiseDuo;
    const netApresPromo = sousTotal - remisePromoSysteme;
    const frais = (typeCommande === 'livraison' && netApresPromo > 0 && netApresPromo < 45) ? 7 : 0;

    return { sousTotal, remisePromoSysteme, remiseDimanche, remiseDuo, fraisLivraison: frais };
  };

  function eligiblePricesOrVal(v) { return Number(v) || 0; }

  const calculerTotal = () => {
    const { sousTotal, remisePromoSysteme, remiseDimanche, remiseDuo, fraisLivraison } = calculerTotalInterne();
    const totalAvantRemiseCode = (sousTotal - remisePromoSysteme) + fraisLivraison;
    const totalFinal = Math.max(0, totalAvantRemiseCode - remiseAppliquee);
    return { sousTotal, remisePromo: remisePromoSysteme, remiseDimanche, remiseDuo, fraisLivraison, grandTotal: totalFinal };
  };

  const { sousTotal, remisePromo, remiseDimanche, remiseDuo, fraisLivraison, grandTotal } = calculerTotal();

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
    if (!codePromo.trim()) return alert("Veuillez entrer un code promo.");

    const telClean = clientTel.replace(/\s/g, '');
    if (!/^(06|07)\d{8}$/.test(telClean)) {
      return alert("⚠️ Veuillez d'abord entrer un numéro de téléphone valide (06... ou 07...) dans la case ci-dessus.");
    }

    if (codePromo.trim().toUpperCase() !== WELCOME_TOKEN_REF) {
      return alert("❌ Code promo invalide ou expiré.");
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
        alert(`BOOM ! 💥\n\nFoodji régale : -20% de bienvenue rien que pour vous !`);
      } else {
        alert("⚠️ Ce code est réservé aux nouveaux clients pour leur 1ère commande.");
        setRemiseAppliquee(0);
        setIsPromoValidee(false);
      }
    } catch (e) {
      console.error(e);
      alert("Erreur de connexion lors de la vérification.");
    }
    setLoading(false);
  };

  // Ouverture du panier agile : le GPS ne bloque plus les clients "Sur Place" ou "À Emporter"
  const handleOpenPanier = () => {
    if (panier.length === 0) return alert("Panier vide !");
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
      }, { timeout: 6000 });
    } else {
      setGpsLoading(false);
      setDistanceClient(null);
      setView('panier');
    }
  };

  const envoyerCommande = async () => {
    if (!isStoreOpen) {
      return alert("😴 Le restaurant est actuellement fermé. Les commandes sont suspendues.");
    }
    if (panier.length === 0) return alert("Panier vide !");
    if (!clientNom.trim()) return alert("Veuillez indiquer votre nom.");

    const telClean = clientTel.replace(/\s/g, '');
    if (!/^(06|07)\d{8}$/.test(telClean)) return alert("Numéro de téléphone invalide (Format : 06... ou 07...)");

    // Contrôles géographiques strictement réservés au mode LIVRAISON
    if (typeCommande === 'livraison') {
      if (!adresse.trim()) return alert("⚠️ Adresse complète obligatoire pour la livraison (Immeuble, résidence, repère).");
      if (distanceClient !== null && distanceClient > 10) {
        setShowDistanceBlocker(true);
        return;
      }
      if (distanceClient !== null && distanceClient > 4 && grandTotal < 300) {
        return alert(`⛔️ Zone 4 km - 10 km (${distanceClient.toFixed(1)} km).\n\nEn livraison à cette distance, le minimum de commande est de 300 DH (ou choisissez "À Emporter").`);
      }
    }

    setLoading(true);
    try {
      localStorage.setItem('clientNom', clientNom.trim());
      localStorage.setItem('clientTel', telClean);
      if (adresse.trim()) localStorage.setItem('clientAdresse', adresse.trim());
    } catch (e) {}

    const panierFinal = panier.map(item => ({
      ...item,
      prixFinal: getPrixItemAjuste(item)
    }));

    let status = 'En attente';
    if (grandTotal >= 300) status = 'En cours de validation';

    let commentaireFinal = commentaire.trim();
    if (isPromoValidee) {
      commentaireFinal = `${commentaireFinal} [🎁 CODE PROMO: -${remiseAppliquee} DH]`.trim();
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

      if (isPromoValidee) {
        alert(`👏 COMMANDE VALIDÉE AVEC LA REMISE !\n\nBienvenue chez Foodji !`);
      }

      setPanier([]); setCommentaire(''); setCodePromo(''); setRemiseAppliquee(0); setIsPromoValidee(false);
      setView('ticket');
    } catch (e) {
      alert("Erreur réseau lors de l'envoi de la commande. Veuillez réessayer.");
    }
    setLoading(false);
  };

  const toggleAvailability = async (item) => {
    await updateDoc(doc(db, "produits", item.id), { available: !item.available });
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
    if (!nom.trim()) return;
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
      alert("Produit modifié !");
      setEditId(null);
    } else {
      await addDoc(collection(db, "produits"), data);
      alert("Produit ajouté !");
    }
    setNom(''); setDescription(''); setImage(''); setPrixBase(''); setVariantes([]);
    setLoading(false);
  };

  const supprimerProduit = async (id) => {
    if (!checkManagerAuth()) return;
    if (window.confirm("Confirmer la suppression définitive ?")) {
      await deleteDoc(doc(db, "produits", id));
    }
  };

  const toggleStockItem = async (listName, index) => {
    const newList = [...(stocks[listName] || [])];
    newList[index].available = !newList[index].available;
    const newData = { ...stocks, [listName]: newList };
    await updateDoc(doc(db, "parametres", "stocks"), newData);
  };

  const addNewStockItem = async () => {
    if (!checkManagerAuth()) return;
    if (!newItemName.trim()) return;
    const newList = [...(stocks[activeStockTab] || []), { nom: newItemName.trim(), available: true }];
    const newData = { ...stocks, [activeStockTab]: newList };
    await updateDoc(doc(db, "parametres", "stocks"), newData);
    setNewItemName('');
  };

  const copierOdoo = (cmd) => {
    let t = `Nom : ${cmd.client}\nTél : ${cmd.tel}\n`;
    if (cmd.type === 'livraison') t += `Adresse : ${cmd.adresse}`;
    else t += `Mode : ${cmd.type === 'sur_place' ? 'Sur Place' : 'Emporter'}`;
    if (cmd.commentaire) t += `\nNote : ${cmd.commentaire}`;
    navigator.clipboard.writeText(t).then(() => alert("Copié !"));
  };

  const changerStatus = async (id, st) => {
    await updateDoc(doc(db, "commandes", id), { status: st });
  };

  const supprimerCmd = async (id) => {
    if (window.confirm("Supprimer cette commande ?")) await deleteDoc(doc(db, "commandes", id));
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
        alert("Image mise à jour !");
      };
    };
  };

  const btnStyle = {
    background: COLORS.primary, color: 'white', border: 'none', borderRadius: '14px',
    padding: '14px 20px', fontWeight: '700', cursor: 'pointer', width: '100%',
    fontSize: '1rem'
  };
  const inputStyle = {
    width: '100%', padding: '14px', borderRadius: '12px',
    border: `1px solid ${COLORS.border}`, background: 'white', marginBottom: '12px',
    fontSize: '1rem', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit'
  };
  const cardStyle = {
    background: COLORS.card, borderRadius: '16px', padding: '14px',
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
          <meta property="og:title" content="Foodji - La Faim n'attend pas !" />
          <meta property="og:description" content={seoConfig.description} />
          <meta property="og:image" content={seoConfig.image} />
          <meta property="og:url" content={seoConfig.url} />
          <meta property="og:type" content="restaurant.menu" />
          <script type="application/ld+json">
            {JSON.stringify(structuredData)}
          </script>
        </Helmet>

        {showDistanceBlocker && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(9, 9, 11, 0.95)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px', color: 'white', textAlign: 'center', boxSizing: 'border-box' }}>
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>⛔</div>
            <h2 style={{ fontSize: '1.8rem', color: COLORS.danger, marginBottom: '12px', letterSpacing: '-0.03em' }}>Hors zone de livraison</h2>
            <p style={{ fontSize: '1.05rem', marginBottom: '28px', lineHeight: '1.6', color: '#D4D4D8', maxWidth: '360px' }}>
              Vous êtes situé à <strong className="num-tabular" style={{ color: 'white' }}>{distanceClient ? distanceClient.toFixed(1) : '?'} km</strong>.<br />
              La livraison est limitée à un rayon de 10 km autour de Sala Al Jadida (vous pouvez toutefois commander <strong>À Emporter</strong> ou <strong>Sur Place</strong>).
            </p>
            <a href={`tel:${PHONE_NUMBER}`} className="taste-btn" style={{ background: 'white', color: COLORS.textMain, padding: '16px 36px', borderRadius: '999px', textDecoration: 'none', fontWeight: 'bold', fontSize: '1.1rem' }}>📞 APPELER LE RESTAURANT</a>
            <button className="taste-btn" onClick={() => { setShowDistanceBlocker(false); setTypeCommande('emporter'); }} style={{ marginTop: '16px', background: COLORS.primary, border: 'none', color: 'white', padding: '14px 28px', borderRadius: '999px', fontWeight: 'bold', cursor: 'pointer' }}>🛍️ Passer en mode "À Emporter"</button>
            <button className="taste-btn" onClick={() => setShowDistanceBlocker(false)} style={{ marginTop: '24px', background: 'transparent', border: 'none', color: '#A1A1AA', padding: '10px 20px', textDecoration: 'underline', cursor: 'pointer' }}>Fermer</button>
          </div>
        )}

        {showIosInstall && (
          <div className="sheet-anim" style={{
            position: 'fixed', bottom: 0, left: 0, width: '100%', boxSizing: 'border-box',
            background: 'rgba(255, 255, 255, 0.96)', backdropFilter: 'blur(12px)',
            borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
            borderTop: `1px solid ${COLORS.border}`,
            boxShadow: '0 -10px 30px rgba(0,0,0,0.1)', padding: '20px', zIndex: 9999,
            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '10px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img src={iconImg} alt="Foodji" style={{ width: '44px', height: '44px', borderRadius: '12px', objectFit: 'cover' }} />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: '800', fontSize: '1rem', letterSpacing: '-0.02em' }}>Installer l'App Foodji</div>
                  <div style={{ fontSize: '0.85rem', color: COLORS.textLight }}>Commande en 2 clics depuis votre écran</div>
                </div>
              </div>
              <button onClick={closeIosInstall} style={{ background: COLORS.bg, border: 'none', width: '32px', height: '32px', borderRadius: '50%', fontSize: '1.2rem', color: COLORS.textLight, cursor: 'pointer' }}>×</button>
            </div>

            <div style={{ width: '100%', height: '1px', background: COLORS.border, margin: '10px 0' }}></div>

            <div style={{ fontSize: '0.92rem', lineHeight: '1.8', textAlign: 'left', width: '100%', color: COLORS.textMain }}>
              1. Touchez <strong>Partager</strong> <svg width="15" height="18" viewBox="0 0 15 18" style={{ verticalAlign: 'middle', margin: '0 4px' }}><path d="M7.5 0.5L7.5 10.5M7.5 0.5L3.5 4.5M7.5 0.5L11.5 4.5M2.5 7.5L0.5 7.5L0.5 17.5L14.5 17.5L14.5 7.5L12.5 7.5" stroke="#007AFF" strokeWidth="1.5" fill="none" /></svg> dans la barre Safari<br />
              2. Faites défiler et choisissez <strong>"Sur l'écran d'accueil"</strong>
            </div>
          </div>
        )}

        {showCGV && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: 'rgba(9, 9, 11, 0.8)', backdropFilter: 'blur(4px)', zIndex: 3000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', boxSizing: 'border-box'
          }}>
            <div className="modal-anim" style={{
              background: 'white', width: '100%', maxWidth: '600px', borderRadius: '20px',
              maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
              border: `1px solid ${COLORS.border}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: `1px solid ${COLORS.border}`, background: 'white' }}>
                <h2 style={{ margin: 0, fontSize: '1.15rem', letterSpacing: '-0.02em' }}>Conditions Générales (CGUV)</h2>
                <button onClick={() => setShowCGV(false)} style={{ border: 'none', background: COLORS.bg, width: '32px', height: '32px', borderRadius: '50%', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer' }}>×</button>
              </div>

              <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, WebkitOverflowScrolling: 'touch', fontSize: '0.9rem', lineHeight: '1.6', color: '#3F3F46' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 'bold', marginTop: 0, color: COLORS.textMain }}>CONDITIONS GÉNÉRALES D'UTILISATION ET DE VENTE - FOODJI</h3>
                <p style={{ fontStyle: 'italic', color: COLORS.textLight, marginBottom: '16px' }}>Dernière mise à jour : Janvier 2026</p>
                <p><strong>1. Objet :</strong> Les présentes conditions régissent les ventes du restaurant Foodji (Sala Al Jadida) via son application web.</p>
                <p><strong>2. Zones et Livraison :</strong></p>
                <ul style={{ paddingLeft: '20px' }}>
                  <li><strong>Zone 0 à 4 km :</strong> Aucun minimum de commande (frais de 7 DH si commande inférieure à 45 DH).</li>
                  <li><strong>Zone 4 à 10 km :</strong> Minimum de commande strict de 300 DH en livraison.</li>
                  <li><strong>Au-delà de 10 km :</strong> Livraison indisponible (retrait en restaurant uniquement).</li>
                  <li><strong>Zones spéciales (UIR, Technopolis, UM6P) :</strong> Un supplément de 10 à 15 DH peut être appliqué directement par le livreur indépendant.</li>
                </ul>
                <p><strong>3. Validation Téléphonique (&gt; 300 DH) :</strong> Toute commande dépassant 300 DH fait l'objet d'un appel de confirmation avant lancement en cuisine.</p>
                <p><strong>4. Allergènes & Rétractation :</strong> Conformément à la loi sur les denrées périssables préparées à la minute, toute commande validée et lancée en cuisine est ferme et non remboursable. Signalez impérativement vos allergies en commentaire.</p>
              </div>

              <div style={{ padding: '16px 24px', borderTop: `1px solid ${COLORS.border}`, background: 'white' }}>
                <button className="taste-btn" onClick={() => setShowCGV(false)} style={{ width: '100%', background: COLORS.secondary, color: 'white', padding: '14px', borderRadius: '12px', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>J'ai compris</button>
              </div>
            </div>
          </div>
        )}

        {view === 'landing' && (
          <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            background: '#09090B', color: 'white', zIndex: 2000,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '24px', boxSizing: 'border-box', overflow: 'hidden'
          }}>
            <img
              src={logoImg}
              alt="Foodji"
              className="modal-anim"
              style={{ width: '200px', height: '200px', objectFit: 'contain', marginBottom: '24px' }}
              onError={(e) => { e.target.style.display = 'none'; }}
            />

            <div style={{ textAlign: 'center', width: '100%', maxWidth: '320px' }}>
              <p style={{ color: '#A1A1AA', fontSize: '0.95rem', marginBottom: '24px', lineHeight: '1.5' }}>
                Le vrai goût du <strong style={{ color: 'white' }}>Fait Maison</strong> à Sala Al Jadida. Préparé à la minute.
              </p>

              <button className="taste-btn" onClick={() => setView('client')} style={{
                background: COLORS.primary, color: 'white', border: 'none', padding: '18px 0', width: '100%',
                borderRadius: '999px', fontSize: '1.15rem', fontWeight: '800', letterSpacing: '-0.01em',
                boxShadow: '0 12px 30px -6px rgba(168, 68, 56, 0.55)', cursor: 'pointer'
              }}>
                COMMANDER MAINTENANT
              </button>

              {deferredPrompt && (
                <button className="taste-btn" onClick={handleInstallClick} style={{
                  background: '#18181B', color: 'white', border: '1px solid #27272A', padding: '14px 0', width: '100%',
                  borderRadius: '999px', fontSize: '1rem', fontWeight: '700', marginTop: '14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer'
                }}>
                  📲 Installer l'application
                </button>
              )}

              {derniereCommande && (
                <button className="taste-btn" onClick={() => setView('ticket')} style={{
                  marginTop: '16px', width: '100%', background: 'transparent',
                  border: '1px solid #27272A', color: '#E4E4E7', padding: '12px 20px',
                  borderRadius: '999px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600'
                }}>
                  📄 Voir mon dernier ticket (#{derniereCommande.id ? derniereCommande.id.slice(-4).toUpperCase() : ''})
                </button>
              )}

              <p style={{ marginTop: '20px', fontSize: '0.75rem', color: '#71717A' }}>
                En continuant, vous acceptez nos <span onClick={() => setShowCGV(true)} style={{ textDecoration: 'underline', cursor: 'pointer', color: '#D4D4D8' }}>Conditions Générales</span>.
              </p>

              <button onClick={handleStaffAccess} style={{
                marginTop: '48px', background: 'transparent', border: 'none', fontSize: '1.2rem', cursor: 'pointer', opacity: 0.35
              }}>
                🔒
              </button>
            </div>
          </div>
        )}

        {view !== 'landing' && (
          <header style={{
            background: 'rgba(255, 255, 255, 0.92)', backdropFilter: 'blur(12px)',
            padding: '14px 20px', position: 'sticky', top: 0, zIndex: 50,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderBottom: `1px solid ${COLORS.border}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }} onClick={() => setView('landing')}>
              <img src={iconImg} style={{ height: '34px', width: '34px', borderRadius: '8px', objectFit: 'contain' }} alt="Foodji" onError={(e) => { e.target.style.display = 'none'; }} />
              <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '800', letterSpacing: '-0.04em', color: COLORS.textMain }}>Foodji</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                fontSize: '0.78rem', fontWeight: '700', padding: '5px 10px', borderRadius: '999px',
                background: isStoreOpen ? '#ECFDF5' : '#FEF2F2',
                color: isStoreOpen ? COLORS.success : COLORS.danger
              }}>
                {isStoreOpen ? '● Ouvert' : '● Fermé'}
              </span>
            </div>
          </header>
        )}

        {/* BANNIÈRES D'ÉTAT */}
        {parametresStatus.rushMode !== 'standard' && view === 'client' && (
          <div style={{ background: parametresStatus.rushMode === 'gros_rush' ? COLORS.danger : COLORS.warning, color: 'white', textAlign: 'center', padding: '10px 16px', fontWeight: '700', fontSize: '0.88rem' }}>
            {parametresStatus.rushMode === 'gros_rush' ? '🔥 Très forte affluence : Délai estimé > 1h' : '⚡ Forte affluence : Délai estimé 30 à 45 min'}
          </div>
        )}

        {parametresStatus.promoDuoActive && view === 'client' && (
          <div style={{ background: COLORS.secondary, color: 'white', textAlign: 'center', padding: '10px 16px', fontWeight: '700', fontSize: '0.88rem', borderBottom: `2px solid ${COLORS.promo}` }}>
            🎁 OFFRE DUO ACTIVE : 1 Acheté = Le 2ème à -50% automatiquement au panier !
          </div>
        )}

        {!isStoreOpen && view === 'client' && (
          <div style={{ background: COLORS.danger, color: 'white', textAlign: 'center', padding: '12px 16px', fontWeight: '800', fontSize: '0.9rem' }}>
            ⛔ LE RESTAURANT EST ACTUELLEMENT FERMÉ
          </div>
        )}

        {showPromoWizard && <PromoWizard menu={menu} onClose={() => setShowPromoWizard(false)} onValidate={ajouterLotAuPanier} />}
        {selectedProduct && <ProductModal product={selectedProduct} stocks={stocks} onClose={() => setSelectedProduct(null)} onAdd={ajouterAuPanier} />}

        {view === 'client' && (
          <div style={{ padding: '16px', maxWidth: '680px', margin: '0 auto' }}>
            {/* Barre de catégories sticky sous le header */}
            <div style={{ overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '14px', scrollbarWidth: 'none', display: 'flex', gap: '8px' }}>
              {categoriesClient.map(c => {
                const isActive = categorieActive === c;
                const isPromo = c === '🔥 PROMOTIONS';
                return (
                  <button
                    key={c}
                    className="taste-btn"
                    onClick={() => setCategorieActive(c)}
                    style={{
                      border: isActive ? 'none' : `1px solid ${COLORS.border}`,
                      display: 'inline-block', padding: '10px 18px', borderRadius: '999px',
                      background: isActive ? (isPromo ? COLORS.promo : COLORS.secondary) : 'white',
                      color: isActive ? 'white' : COLORS.textMain,
                      fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer', flexShrink: 0
                    }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              {isMenuLoading ? (
                <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '60px 20px', color: COLORS.textLight, fontWeight: '500' }}>
                  Chargement de la carte...
                </div>
              ) : menuClient.length === 0 ? (
                <div style={{ gridColumn: 'span 2', textAlign: 'center', padding: '60px 20px', color: COLORS.textLight }}>
                  Aucun article disponible dans cette catégorie pour le moment.
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
                      onClick={() => plat.isPromoTrigger ? setShowPromoWizard(true) : setSelectedProduct(plat)}
                      style={{
                        background: 'white', borderRadius: '16px', padding: '8px',
                        border: `1px solid ${COLORS.border}`, display: 'flex', flexDirection: 'column',
                        cursor: 'pointer', position: 'relative'
                      }}
                    >
                      {/* Ratio 4/3 avec rayon imbriqué R_interne = 16 - 8 = 8px */}
                      <div style={{
                        width: '100%', aspectRatio: '4/3', borderRadius: '10px',
                        background: COLORS.bg,
                        backgroundImage: `url(${plat.image || 'https://via.placeholder.com/400x300?text=Foodji'})`,
                        backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative', overflow: 'hidden'
                      }}>
                        {plat.isPromoTrigger && (
                          <div style={{ position: 'absolute', top: '8px', left: '8px', background: COLORS.promo, color: 'white', fontSize: '0.72rem', fontWeight: '800', padding: '4px 8px', borderRadius: '6px' }}>
                            PACK PROMO
                          </div>
                        )}
                      </div>

                      <div style={{ padding: '8px 4px 4px 4px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <h4 style={{ margin: '0 0 4px 0', fontSize: '0.98rem', fontWeight: '700', color: COLORS.textMain, letterSpacing: '-0.02em', lineHeight: '1.25' }}>{plat.nom}</h4>
                          {plat.description && (
                            <p style={{ fontSize: '0.78rem', color: COLORS.textLight, margin: 0, lineHeight: '1.35', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {plat.description}
                            </p>
                          )}
                        </div>

                        <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="num-tabular" style={{ fontWeight: '800', fontSize: '0.95rem', color: COLORS.primary }}>
                            {plat.isPromoTrigger ? 'Choisir 3 Pizzas →' : (displayPrice > 0 ? (plat.variantes?.length > 0 ? `dès ${displayPrice} DH` : `${displayPrice} DH`) : 'Offert')}
                          </span>
                          {!plat.isPromoTrigger && (
                            <div style={{ background: COLORS.secondary, color: 'white', width: '30px', height: '30px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', fontWeight: 'bold' }}>+</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {panier.length > 0 && (
              <div
                className="taste-btn"
                onClick={handleOpenPanier}
                style={{
                  position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
                  width: 'calc(100% - 32px)', maxWidth: '520px', boxSizing: 'border-box',
                  background: COLORS.secondary, color: 'white', padding: '16px 22px',
                  borderRadius: '18px', display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', boxShadow: '0 16px 32px -8px rgba(0,0,0,0.35)', cursor: 'pointer', zIndex: 99
                }}
              >
                {gpsLoading ? (
                  <div style={{ width: '100%', textAlign: 'center', fontWeight: '700', fontSize: '0.98rem' }}>📍 Vérification de votre zone...</div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span className="num-tabular" style={{ background: COLORS.primary, color: 'white', minWidth: '28px', height: '28px', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: '800', fontSize: '0.9rem', padding: '0 6px' }}>{panier.length}</span>
                      <span style={{ fontSize: '1rem', fontWeight: '700', letterSpacing: '-0.01em' }}>Voir ma commande</span>
                    </div>
                    <span className="num-tabular" style={{ fontWeight: '800', fontSize: '1.15rem' }}>{grandTotal} DH</span>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {view === 'panier' && (
          <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, letterSpacing: '-0.03em' }}>🛒 Votre Panier</h2>
              <button className="taste-btn" onClick={() => setView('client')} style={{ background: 'white', border: `1px solid ${COLORS.border}`, padding: '8px 14px', borderRadius: '10px', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer' }}>+ Ajouter des plats</button>
            </div>

            {panier.length === 0 ? (
              <div style={{ ...cardStyle, textAlign: 'center', padding: '40px 20px' }}>
                <p style={{ color: COLORS.textLight, marginBottom: '20px' }}>Votre panier est vide.</p>
                <button className="taste-btn" onClick={() => setView('client')} style={btnStyle}>Retourner au menu</button>
              </div>
            ) : (
              <>
                <div style={{ ...cardStyle, marginBottom: '20px' }}>
                  {panier.map((item, idx) => (
                    <div key={item.uniqueId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', padding: '12px 0', borderBottom: idx === panier.length - 1 ? 'none' : `1px solid ${COLORS.border}`, gap: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '700', fontSize: '0.96rem', color: COLORS.textMain }}>{item.nom}</div>
                        {item.detailsTxt && item.detailsTxt.length > 0 && (
                          <div style={{ color: COLORS.textLight, fontSize: '0.82rem', marginTop: '4px', lineHeight: '1.4' }}>
                            {item.detailsTxt.map((dt, i) => (
                              <div key={i} style={{ color: dt.includes('🚫') ? COLORS.danger : 'inherit' }}>• {dt}</div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <strong className="num-tabular" style={{ color: COLORS.primary, fontSize: '1rem' }}>{getPrixItemAjuste(item)} DH</strong>
                        <button className="taste-btn" onClick={() => retirerDuPanier(item.uniqueId)} style={{ color: COLORS.danger, background: '#FEF2F2', border: 'none', width: '30px', height: '30px', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}>×</button>
                      </div>
                    </div>
                  ))}

                  <div style={{ borderTop: `1px dashed ${COLORS.border}`, marginTop: '12px', paddingTop: '12px' }} className="num-tabular">
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: COLORS.textLight, fontSize: '0.9rem', marginBottom: '6px' }}>
                      <span>Sous-total</span><span>{sousTotal} DH</span>
                    </div>

                    {remiseDimanche > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: COLORS.success, fontWeight: '700', fontSize: '0.92rem', marginBottom: '6px' }}>
                        <span>🎁 Offre Dimanche (3ème Pizza offerte)</span><span>- {remiseDimanche} DH</span>
                      </div>
                    )}

                    {remiseDuo > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: COLORS.success, fontWeight: '700', fontSize: '0.92rem', marginBottom: '6px' }}>
                        <span>🎁 Promo Duo (-50% sur le 2ème)</span><span>- {remiseDuo} DH</span>
                      </div>
                    )}

                    {remiseAppliquee > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: COLORS.promo, fontWeight: '700', fontSize: '0.92rem', marginBottom: '6px' }}>
                        <span>🎉 Code Bienvenue (-20%)</span><span>- {remiseAppliquee} DH</span>
                      </div>
                    )}

                    {fraisLivraison > 0 && typeCommande === 'livraison' && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: COLORS.textLight, fontSize: '0.9rem', marginBottom: '6px' }}>
                        <span>🛵 Frais de livraison (&lt; 45 DH)</span><span>+ {fraisLivraison} DH</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.35rem', fontWeight: '800', marginTop: '10px', color: COLORS.textMain, letterSpacing: '-0.02em' }}>
                      <span>TOTAL À PAYER</span>
                      <span style={{ color: COLORS.primary }}>{grandTotal} DH</span>
                    </div>
                  </div>
                </div>

                <div style={cardStyle}>
                  <h3 style={{ marginTop: 0, fontSize: '1.05rem', marginBottom: '12px', letterSpacing: '-0.02em' }}>Mode de réception & Coordonnées</h3>

                  <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', background: COLORS.bg, padding: '5px', borderRadius: '12px' }}>
                    {[
                      { id: 'livraison', label: '🛵 Livraison' },
                      { id: 'emporter', label: '🛍️ À Emporter' },
                      { id: 'sur_place', label: '🍽️ Sur Place' }
                    ].map(t => (
                      <button
                        key={t.id}
                        className="taste-btn"
                        onClick={() => setTypeCommande(t.id)}
                        style={{
                          flex: 1, padding: '10px 6px', borderRadius: '9px', border: 'none',
                          background: typeCommande === t.id ? COLORS.secondary : 'transparent',
                          color: typeCommande === t.id ? 'white' : COLORS.textLight,
                          fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer'
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {typeCommande === 'livraison' && (
                    <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: '12px', borderRadius: '10px', marginBottom: '14px', fontSize: '0.85rem', color: '#92400E', lineHeight: '1.4' }}>
                      <strong>ℹ️ Campus UIR, Technopolis & UM6P :</strong><br />
                      Un supplément de livraison (10 à 15 DH) est demandé directement par le livreur pour ces zones.
                    </div>
                  )}

                  <input type="text" value={clientNom} onChange={e => setClientNom(e.target.value)} style={{ ...inputStyle, borderColor: !clientNom.trim() ? '#FCA5A5' : COLORS.border }} placeholder="Votre Nom complet *" required />
                  <input type="tel" className="num-tabular" value={clientTel} onChange={e => setClientTel(e.target.value)} style={{ ...inputStyle, borderColor: !clientTel.trim() ? '#FCA5A5' : COLORS.border }} placeholder="Téléphone (06... ou 07...) *" required />

                  {typeCommande === 'livraison' && (
                    <textarea value={adresse} onChange={e => setAdresse(e.target.value)} style={{ ...inputStyle, height: '76px', borderColor: !adresse.trim() ? '#FCA5A5' : COLORS.border }} placeholder="Adresse exacte (Résidence, Immeuble, Appartement, Repère) *" required />
                  )}

                  <textarea
                    value={commentaire}
                    onChange={e => setCommentaire(e.target.value)}
                    style={{ ...inputStyle, height: '60px', marginBottom: '16px' }}
                    placeholder="Instructions cuisine ou livreur (ex: sans oignons, code porte...)"
                  />

                  <div style={{ marginBottom: '16px', padding: '14px', background: COLORS.bg, borderRadius: '12px', border: `1px solid ${COLORS.border}` }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '700', marginBottom: '8px', color: COLORS.textMain }}>🎁 Code Promo (1ère commande)</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Ex: START2026"
                        value={codePromo}
                        disabled={isPromoValidee}
                        onChange={(e) => setCodePromo(e.target.value.toUpperCase())}
                        style={{ ...inputStyle, marginBottom: 0, textAlign: 'center', fontWeight: '800', letterSpacing: '1px', flex: 1 }}
                      />
                      {isPromoValidee ? (
                        <button className="taste-btn" onClick={() => { setIsPromoValidee(false); setRemiseAppliquee(0); setCodePromo(''); }} style={{ background: COLORS.danger, color: 'white', border: 'none', borderRadius: '10px', padding: '0 16px', fontWeight: 'bold', cursor: 'pointer' }}>✕</button>
                      ) : (
                        <button className="taste-btn" onClick={verifierCodePromo} style={{ background: COLORS.secondary, color: 'white', border: 'none', borderRadius: '10px', padding: '0 18px', fontWeight: '700', cursor: 'pointer' }}>Appliquer</button>
                      )}
                    </div>
                  </div>

                  <button
                    className="taste-btn num-tabular"
                    onClick={envoyerCommande}
                    disabled={loading || !isStoreOpen}
                    style={{ ...btnStyle, background: !isStoreOpen ? COLORS.textLight : COLORS.success, fontSize: '1.08rem', padding: '16px' }}
                  >
                    {loading ? 'Envoi en cours...' : (!isStoreOpen ? 'RESTAURANT FERMÉ' : `CONFIRMER LA COMMANDE • ${grandTotal} DH`)}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {view === 'ticket' && derniereCommande && (
          <div style={{ padding: '24px 20px', maxWidth: '440px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="modal-anim" style={{ background: 'white', padding: '28px 22px', borderRadius: '20px', border: `1px solid ${COLORS.border}`, width: '100%', boxSizing: 'border-box', textAlign: 'center' }}>
              <div style={{ width: '56px', height: '56px', background: derniereCommande.status === 'En cours de validation' ? COLORS.pending : COLORS.success, color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', fontWeight: 'bold', margin: '0 auto 16px auto' }}>
                {derniereCommande.status === 'En cours de validation' ? '!' : '✓'}
              </div>

              {derniereCommande.status === 'En cours de validation' ? (
                <>
                  <h2 style={{ margin: '0 0 8px 0', color: COLORS.pending, letterSpacing: '-0.02em' }}>Validation téléphonique requise</h2>
                  <p style={{ color: COLORS.textLight, fontSize: '0.9rem', marginBottom: '24px', lineHeight: '1.5' }}>
                    Votre commande dépasse 300 DH. Gardez votre téléphone près de vous, notre équipe vous appelle dans un instant pour confirmer !
                  </p>
                </>
              ) : (
                <>
                  <h2 style={{ margin: '0 0 8px 0', color: COLORS.textMain, letterSpacing: '-0.02em' }}>Commande envoyée en cuisine !</h2>
                  <p style={{ color: COLORS.textLight, fontSize: '0.9rem', marginBottom: '24px' }}>
                    Merci {derniereCommande.client}, nous préparons votre commande à la minute.
                  </p>
                </>
              )}

              <div className="num-tabular" style={{ borderTop: `1px dashed ${COLORS.border}`, borderBottom: `1px dashed ${COLORS.border}`, padding: '16px 0', marginBottom: '16px', textAlign: 'left' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontWeight: '800' }}>
                  <span>Ticket N°</span>
                  <span style={{ color: COLORS.primary }}>#{derniereCommande.id ? derniereCommande.id.slice(-4).toUpperCase() : '----'}</span>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {(derniereCommande.items || []).map((it, i) => (
                    <li key={i} style={{ marginBottom: '8px', fontSize: '0.92rem', paddingBottom: '6px', borderBottom: `1px solid ${COLORS.bg}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: '600' }}>{it.nom}</span>
                        <span style={{ fontWeight: '700' }}>{it.prixFinal} DH</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="num-tabular" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: '800', color: COLORS.primary }}>
                <span>TOTAL</span>
                <span>{derniereCommande.total} DH</span>
              </div>
            </div>

            <button className="taste-btn" onClick={() => setView('client')} style={{ marginTop: '24px', background: COLORS.secondary, color: 'white', border: 'none', padding: '14px 28px', borderRadius: '999px', fontWeight: '700', cursor: 'pointer' }}>
              ← Retour à la carte
            </button>
          </div>
        )}

        {view === 'login' && !user && (
          <div style={{ padding: '40px 20px', maxWidth: '380px', margin: '0 auto', textAlign: 'center' }}>
            <div style={cardStyle}>
              <h2 style={{ marginTop: 0, marginBottom: '20px', letterSpacing: '-0.02em' }}>🔒 Accès Staff Foodji</h2>
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
              <input type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
              <button className="taste-btn" onClick={async (e) => { e.preventDefault(); try { await signInWithEmailAndPassword(auth, email, password); setView('admin'); } catch (err) { alert('Identifiants incorrects'); } }} style={btnStyle}>Se connecter</button>
              <button onClick={() => setView('landing')} style={{ marginTop: '16px', background: 'transparent', border: 'none', color: COLORS.textLight, cursor: 'pointer', fontWeight: '600' }}>Retour à l'accueil</button>
            </div>
          </div>
        )}

        {view === 'admin' && user && (
          <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, letterSpacing: '-0.03em' }}>⚙️ Gestion Web Foodji</h2>
                <div style={{ fontSize: '0.8rem', color: COLORS.success, background: '#ECFDF5', padding: '5px 10px', borderRadius: '999px', fontWeight: 'bold' }}>🔊 Alertes Actives</div>
              </div>
              <button className="taste-btn" onClick={() => setView('client')} style={{ background: 'white', border: `1px solid ${COLORS.border}`, padding: '8px 14px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Voir le site client</button>
            </div>

            <div style={{ ...cardStyle, marginBottom: '20px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '1rem' }}>Ouverture / Fermeture des Commandes en Ligne</h3>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="taste-btn" onClick={() => updateDoc(doc(db, "parametres", "horaires"), { isOuvert: true })} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: isStoreOpen ? `2px solid ${COLORS.success}` : `1px solid ${COLORS.border}`, background: isStoreOpen ? '#ECFDF5' : 'white', color: isStoreOpen ? COLORS.success : COLORS.textMain, fontWeight: 'bold', cursor: 'pointer' }}>
                  🟢 OUVERT
                </button>
                <button className="taste-btn" onClick={() => updateDoc(doc(db, "parametres", "horaires"), { isOuvert: false })} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: !isStoreOpen ? `2px solid ${COLORS.danger}` : `1px solid ${COLORS.border}`, background: !isStoreOpen ? '#FEF2F2' : 'white', color: !isStoreOpen ? COLORS.danger : COLORS.textMain, fontWeight: 'bold', cursor: 'pointer' }}>
                  🔴 FERMÉ
                </button>
              </div>
            </div>

            <div style={{ ...cardStyle, marginBottom: '30px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '12px', fontSize: '1rem' }}>Bannière d'Affluence (Rush)</h3>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button className="taste-btn" onClick={() => updateDoc(doc(db, "parametres", "status"), { mode: 'standard' })} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: parametresStatus.rushMode === 'standard' ? `2px solid ${COLORS.success}` : `1px solid ${COLORS.border}`, background: parametresStatus.rushMode === 'standard' ? '#ECFDF5' : 'white', color: parametresStatus.rushMode === 'standard' ? COLORS.success : COLORS.textMain, fontWeight: 'bold', cursor: 'pointer' }}>
                  ✅ Standard
                </button>
                <button className="taste-btn" onClick={() => updateDoc(doc(db, "parametres", "status"), { mode: 'rush' })} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: parametresStatus.rushMode === 'rush' ? `2px solid ${COLORS.warning}` : `1px solid ${COLORS.border}`, background: parametresStatus.rushMode === 'rush' ? '#FFFBEB' : 'white', color: parametresStatus.rushMode === 'rush' ? COLORS.warning : COLORS.textMain, fontWeight: 'bold', cursor: 'pointer' }}>
                  ⚠️ Rush (30min+)
                </button>
                <button className="taste-btn" onClick={() => updateDoc(doc(db, "parametres", "status"), { mode: 'gros_rush' })} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: parametresStatus.rushMode === 'gros_rush' ? `2px solid ${COLORS.danger}` : `1px solid ${COLORS.border}`, background: parametresStatus.rushMode === 'gros_rush' ? '#FEF2F2' : 'white', color: parametresStatus.rushMode === 'gros_rush' ? COLORS.danger : COLORS.textMain, fontWeight: 'bold', cursor: 'pointer' }}>
                  🔥 Gros Rush (1h+)
                </button>
              </div>
            </div>

            <h3 style={{ marginTop: '30px' }}>Commandes en cours ({commandes.filter(c => c.status !== 'Terminé').length})</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px', marginBottom: '40px' }}>
              {commandes.map(cmd => (
                <div key={cmd.id} style={{
                  ...cardStyle,
                  borderLeft: cmd.status === 'Terminé' ? `5px solid ${COLORS.border}` : (cmd.status === 'En cours de validation' ? `5px solid ${COLORS.pending}` : `5px solid ${COLORS.success}`)
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px', paddingBottom: '12px', borderBottom: `1px solid ${COLORS.border}` }}>
                    <div>
                      <strong style={{ fontSize: '1.15rem', display: 'block' }}>{cmd.client}</strong>
                      <div className="num-tabular" style={{ color: COLORS.textLight, marginTop: '4px' }}>📞 {cmd.tel}</div>
                      <div className="num-tabular" style={{ marginTop: '6px', fontSize: '0.82rem', fontWeight: 'bold', color: COLORS.secondary, display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <span>📍 {cmd.distance} km</span>
                        {cmd.lat ? (
                          <a href={`https://www.google.com/maps?q=${cmd.lat},${cmd.lng}`} target="_blank" rel="noreferrer" style={{ color: COLORS.primary, textDecoration: 'underline' }}>Ouvrir GPS</a>
                        ) : null}
                      </div>
                    </div>
                    <div className="num-tabular" style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.3rem', fontWeight: '800', color: COLORS.primary }}>{cmd.total} DH</div>
                      <button className="taste-btn" onClick={() => copierOdoo(cmd)} style={{ marginTop: '6px', background: COLORS.secondary, color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}>📋 COPIER</button>
                    </div>
                  </div>

                  <div style={{ marginBottom: '10px' }}>
                    {cmd.status === 'En cours de validation' && (
                      <div style={{ background: '#FFF7ED', color: '#C2410C', padding: '8px', borderRadius: '8px', fontSize: '0.88rem', fontWeight: 'bold', marginBottom: '8px', border: '1px solid #FED7AA' }}>
                        ⚠️ COMMANDE &gt; 300 DH - À CONFIRMER PAR TÉL
                      </div>
                    )}
                    {cmd.type === 'livraison' && <div style={{ background: '#FEF3C7', color: '#92400E', padding: '8px', borderRadius: '8px', fontSize: '0.88rem', marginBottom: '6px' }}>🛵 <strong>{cmd.adresse}</strong></div>}
                    {cmd.commentaire && <div style={{ background: COLORS.warning, color: 'white', padding: '8px', borderRadius: '8px', fontSize: '0.88rem', fontWeight: 'bold' }}>📝 {cmd.commentaire}</div>}
                  </div>

                  <ul style={{ listStyle: 'none', marginBottom: '14px', padding: 0 }} className="num-tabular">
                    {cmd.items && cmd.items.map((it, i) => (
                      <li key={i} style={{ padding: '6px 0', borderBottom: `1px dashed ${COLORS.border}`, lineHeight: '1.4' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong style={{ fontSize: '1rem' }}>{it.qte > 1 ? `${it.qte}x ` : ''}{it.nom}</strong>
                          <strong style={{ color: COLORS.textLight }}>{it.prixFinal} DH</strong>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: COLORS.textLight, marginLeft: '8px', marginTop: '2px' }}>
                          {it.detailsTxt && it.detailsTxt.map((dt, j) => (
                            <div key={j} style={{ color: dt.includes('🚫') ? COLORS.danger : 'inherit' }}>• {dt}</div>
                          ))}
                        </div>
                      </li>
                    ))}
                  </ul>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {cmd.status === 'En cours de validation' ? (
                      <>
                        <button className="taste-btn" onClick={() => changerStatus(cmd.id, 'En attente')} style={{ ...btnStyle, background: COLORS.success, padding: '10px', flex: 1 }}>☎️ CLIENT OK</button>
                        <button className="taste-btn" onClick={() => changerStatus(cmd.id, 'Refusé')} style={{ ...btnStyle, background: COLORS.danger, padding: '10px', flex: 1 }}>REFUSER</button>
                      </>
                    ) : (
                      <>
                        {cmd.status !== 'Terminé' && cmd.status !== 'Refusé' && <button className="taste-btn" onClick={() => changerStatus(cmd.id, 'Terminé')} style={{ ...btnStyle, background: COLORS.success, padding: '10px', flex: 1 }}>✅ SERVI</button>}
                        <button className="taste-btn" onClick={() => supprimerCmd(cmd.id)} style={{ background: '#FEF2F2', color: COLORS.danger, border: 'none', borderRadius: '10px', padding: '10px 16px', cursor: 'pointer', fontWeight: 'bold' }}>🗑️</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '40px', borderTop: `1px solid ${COLORS.border}`, paddingTop: '20px' }}>
              <h3 style={{ marginBottom: '15px' }}>📦 Catalogue & Photos Produits</h3>
              <div style={{ overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '14px', display: 'flex', gap: '8px' }}>
                {categoriesReelles.map(c => (
                  <button key={c} className="taste-btn" onClick={() => setAdminCategorie(c)} style={{
                    padding: '8px 16px', borderRadius: '999px', border: 'none',
                    background: adminCategorie === c ? COLORS.secondary : 'white',
                    color: adminCategorie === c ? 'white' : COLORS.textMain, cursor: 'pointer', fontWeight: 'bold'
                  }}>{c}</button>
                ))}
                <button className="taste-btn" onClick={() => setAdminCategorie('RUPTURE')} style={{ padding: '8px 16px', borderRadius: '999px', border: 'none', background: adminCategorie === 'RUPTURE' ? COLORS.danger : '#FEF2F2', color: adminCategorie === 'RUPTURE' ? 'white' : COLORS.danger, fontWeight: 'bold', cursor: 'pointer' }}>🚫 EN RUPTURE</button>
              </div>

              <div style={{ background: 'white', borderRadius: '16px', border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
                {menuAdmin.map(p => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: `1px solid ${COLORS.border}`, background: p.available === false ? '#FEF2F2' : 'white', opacity: p.available === false ? 0.75 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div onClick={() => toggleAvailability(p)} style={{ width: '48px', height: '26px', background: p.available !== false ? COLORS.success : '#D4D4D8', borderRadius: '20px', position: 'relative', cursor: 'pointer', transition: '0.2s' }}>
                        <div style={{ width: '20px', height: '20px', background: 'white', borderRadius: '50%', position: 'absolute', top: '3px', left: p.available !== false ? '25px' : '3px', transition: '0.2s' }}></div>
                      </div>
                      <div style={{ width: '44px', height: '44px', background: COLORS.bg, borderRadius: '8px', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                        {p.image && <img src={p.image} alt={p.nom} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                        <input type="file" onChange={(e) => updateProductImage(p.id, e.target.files[0])} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 'bold', textDecoration: p.available === false ? 'line-through' : 'none' }}>{p.nom}</div>
                        <div className="num-tabular" style={{ fontSize: '0.8rem', color: COLORS.textLight }}>{p.categorie} • {p.variantes?.length > 0 ? 'Multi-tailles' : `${p.prix} DH`}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button onClick={() => handleEdit(p)} style={{ border: 'none', background: COLORS.bg, padding: '8px', borderRadius: '8px', cursor: 'pointer' }}>✏️</button>
                      <button onClick={() => supprimerProduit(p.id)} style={{ color: COLORS.danger, border: 'none', background: '#FEF2F2', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <details style={{ marginTop: '24px', background: 'white', padding: '16px', borderRadius: '14px', border: `1px solid ${COLORS.border}` }}>
              <summary style={{ fontWeight: 'bold', cursor: 'pointer' }}>{editId ? '✏️ Modifier le produit sélectionné' : '➕ Ajouter un produit manuellement'}</summary>
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
                        <div key={index} style={{ flex: 1, minWidth: '120px', display: 'flex', alignItems: 'center', gap: '6px', background: COLORS.bg, padding: '8px', borderRadius: '10px', border: `1px solid ${COLORS.border}` }}>
                          <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: 'bold', color: COLORS.textLight, display: 'block' }}>{v.nom}</label>
                            <input type="number" className="num-tabular" value={v.prix} onChange={(e) => updateVariantPrice(index, 'prix', e.target.value)} style={{ ...inputStyle, marginBottom: 0, padding: '6px', fontSize: '0.9rem' }} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <label style={{ fontSize: '0.65rem', color: COLORS.textLight }}>Dispo</label>
                            <input type="checkbox" checked={v.available !== false} onChange={(e) => updateVariantPrice(index, 'available', e.target.checked)} style={{ width: '18px', height: '18px' }} />
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

            <details style={{ marginTop: '20px', background: '#FFFBEB', padding: '16px', borderRadius: '14px', border: `1px solid ${COLORS.promo}` }}>
              <summary style={{ fontWeight: 'bold', color: '#92400E', cursor: 'pointer' }}>🥕 GESTION DES STOCKS INGRÉDIENTS (ON/OFF)</summary>
              <div style={{ marginTop: '16px' }}>
                <div style={{ overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '12px', display: 'flex', gap: '8px' }}>
                  {STOCK_TABS.map(tab => (
                    <button key={tab.id} className="taste-btn" onClick={() => setActiveStockTab(tab.id)} style={{
                      border: 'none', padding: '8px 16px', borderRadius: '999px',
                      background: activeStockTab === tab.id ? COLORS.secondary : 'white',
                      color: activeStockTab === tab.id ? 'white' : COLORS.textMain,
                      fontWeight: 'bold', fontSize: '0.88rem', cursor: 'pointer'
                    }}>
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div style={{ background: 'white', padding: '16px', borderRadius: '12px', marginTop: '8px' }}>
                  {activeStockTab !== 'tailles_pizza' && (
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                      <input type="text" placeholder="Nouvel ingrédient..." value={newItemName} onChange={(e) => setNewItemName(e.target.value)} style={{ ...inputStyle, marginBottom: 0 }} />
                      <button className="taste-btn" onClick={addNewStockItem} style={{ ...btnStyle, width: 'auto' }}>Ajouter</button>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {stocks[activeStockTab]?.map((item, index) => (
                      <button key={item.nom} className="taste-btn" onClick={() => toggleStockItem(activeStockTab, index)} style={{
                        padding: '10px 16px', borderRadius: '999px', cursor: 'pointer', fontWeight: 'bold',
                        background: item.available ? COLORS.success : COLORS.bg,
                        color: item.available ? 'white' : COLORS.textLight,
                        border: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem'
                      }}>
                        <span>{item.nom}</span> <span>{item.available ? '✓' : '✕'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </details>

            <details style={{ marginTop: '24px', background: '#FEF2F2', padding: '16px', borderRadius: '14px', border: `1px solid ${COLORS.danger}` }}>
              <summary style={{ fontWeight: 'bold', color: COLORS.danger, cursor: 'pointer' }}>💀 ZONE DANGEREUSE (Import CSV / Reset)</summary>
              <input type="file" accept=".csv" ref={fileInputRef} onChange={handleCSVImport} style={{ display: 'none' }} />
              <div style={{ marginTop: '16px', display: 'flex', gap: '10px', flexDirection: 'column' }}>
                <button className="taste-btn" onClick={triggerImport} style={{ ...btnStyle, background: 'white', color: COLORS.textMain, border: `1px solid ${COLORS.border}` }}>📂 IMPORTER UN MENU (CSV)</button>
                <button className="taste-btn" onClick={viderMenu} style={{ ...btnStyle, background: COLORS.danger, color: 'white' }}>🗑️ TOUT SUPPRIMER (RESET)</button>
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

function PromoWizard({ menu, onClose, onValidate }) {
  const [choix, setChoix] = useState([]);

  const pizzasEligibles = menu.filter(p =>
    p.categorie === 'Pizzas' &&
    p.available !== false &&
    !PIZZAS_EXCLUES_PROMO.some(ex => p.nom.toLowerCase().includes(ex))
  );

  const handleSelect = (pizza) => {
    if (choix.length >= 3) return;
    let varianteM = pizza.variantes?.find(v => (v.nom === 'M' || v.nom === 'Standard') && v.available !== false);
    if (!varianteM && pizza.variantes?.length > 0) varianteM = pizza.variantes.find(v => v.available !== false);
    if (!varianteM) return alert("Ce produit n'est pas disponible actuellement.");

    const prixFinal = Number(varianteM.prix) || 0;
    const varianteNom = varianteM.nom;
    const nomComplet = `[PIZZAS] ${pizza.nom} (${varianteNom})`;

    setChoix([...choix, {
      ...pizza,
      nom: nomComplet,
      prixFinal,
      originalPrice: prixFinal,
      varianteNom,
      isPromoEligible: true,
      detailsTxt: []
    }]);
  };

  const handleRemoveChoice = (indexToRemove) => {
    setChoix(choix.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(9, 9, 11, 0.85)', backdropFilter: 'blur(4px)', zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', boxSizing: 'border-box' }}>
      <div className="modal-anim" style={{ background: 'white', width: '100%', maxWidth: '540px', borderRadius: '22px', padding: '22px', maxHeight: '88vh', overflowY: 'auto', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, letterSpacing: '-0.02em' }}>🍕 Offre Dimanche ({choix.length}/3)</h3>
            <div style={{ fontSize: '0.82rem', color: COLORS.textLight }}>La moins chère des 3 est automatiquement offerte !</div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: COLORS.bg, width: '34px', height: '34px', borderRadius: '50%', fontSize: '1.3rem', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', background: COLORS.bg, padding: '10px', borderRadius: '14px' }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{ flex: 1, minHeight: '64px', background: 'white', border: choix[i] ? `2px solid ${COLORS.primary}` : `1px dashed ${COLORS.border}`, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', textAlign: 'center', position: 'relative', fontWeight: '700', padding: '6px' }}>
              {choix[i] ? (
                <>
                  <span>{choix[i].nom.split('] ')[1]}</span>
                  <button onClick={() => handleRemoveChoice(i)} style={{ position: 'absolute', top: '-6px', right: '-6px', background: COLORS.danger, color: 'white', border: 'none', width: '22px', height: '22px', borderRadius: '50%', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 'bold' }}>×</button>
                </>
              ) : <span style={{ color: COLORS.textLight }}>Pizza {i + 1}</span>}
            </div>
          ))}
        </div>

        {choix.length < 3 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pizzasEligibles.map(p => (
              <button key={p.id} className="taste-btn" onClick={() => handleSelect(p)} style={{ padding: '14px 16px', borderRadius: '12px', border: `1px solid ${COLORS.border}`, background: 'white', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
                <span style={{ fontWeight: '700', color: COLORS.textMain }}>{p.nom}</span>
                <span style={{ color: COLORS.primary, fontWeight: '800', background: '#FEF2F2', padding: '6px 12px', borderRadius: '999px', fontSize: '0.85rem' }}>+ Choisir</span>
              </button>
            ))}
          </div>
        ) : (
          <button className="taste-btn" onClick={() => onValidate(choix)} style={{ background: COLORS.success, color: 'white', width: '100%', padding: '18px', border: 'none', borderRadius: '14px', fontSize: '1.1rem', fontWeight: '800', cursor: 'pointer' }}>
            ✅ AJOUTER LES 3 PIZZAS AU PANIER
          </button>
        )}
      </div>
    </div>
  );
}

function ProductModal({ product, stocks, onClose, onAdd }) {
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
    if (nomLower.includes('2 saisons')) { maxChoix = 2; minChoix = 2; listeOptions = garnituresDispo; titreOptions = "Choisissez 2 Garnitures"; }
    if (nomLower.includes('4 saisons')) { maxChoix = 4; minChoix = 4; listeOptions = garnituresDispo; titreOptions = "Choisissez 4 Garnitures"; }
  }

  const incrementOption = (opt, currentList, setList, max) => { if (currentList.length < max) setList([...currentList, opt]); };
  const decrementOption = (opt, currentList, setList) => { const index = currentList.indexOf(opt); if (index > -1) { const newList = [...currentList]; newList.splice(index, 1); setList(newList); } };
  const toggleExtraPizza = (extraObj) => { if (extrasPizza.some(e => e.nom === extraObj.nom)) setExtrasPizza(extrasPizza.filter(e => e.nom !== extraObj.nom)); else setExtrasPizza([...extrasPizza, extraObj]); };
  const toggleSans = (item) => { if (sansIngredients.includes(item)) setSansIngredients(sansIngredients.filter(x => x !== item)); else setSansIngredients([...sansIngredients, item]); };
  const getCount = (opt, list) => list.filter(x => x === opt).length;

  let basePrice = selectedVar ? Number(selectedVar.prix) : Number(product.prix);
  let totalExtras = extrasPizza.reduce((acc, curr) => acc + curr.prix, 0);
  let prixCheesy = (isCheesyCrust ? (selectedVar?.nom === 'M' || selectedVar?.nom === 'Standard' || !selectedVar ? 15 : 25) : 0);
  const finalPriceCalculated = (basePrice || 0) + totalExtras + prixCheesy;

  return (
    <div onClick={onClose} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(9, 9, 11, 0.65)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} className="sheet-anim" style={{ background: 'white', width: '100%', maxWidth: '580px', borderRadius: '24px 24px 0 0', padding: '24px', maxHeight: '88vh', overflowY: 'auto', boxSizing: 'border-box' }}>
        <div style={{ width: '40px', height: '4px', background: COLORS.border, borderRadius: '999px', margin: '0 auto 14px auto' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '12px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.35rem', letterSpacing: '-0.03em' }}>{product.nom}</h2>
            {product.description && <p style={{ color: COLORS.textLight, marginTop: '4px', fontSize: '0.88rem', lineHeight: '1.4' }}>{product.description}</p>}
          </div>
          <button onClick={onClose} style={{ border: 'none', background: COLORS.bg, width: '34px', height: '34px', borderRadius: '50%', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', flexShrink: 0 }}>×</button>
        </div>

        {variantesDispo.length > 0 && (
          <div style={{ marginTop: '18px' }}>
            <div style={{ fontWeight: '700', marginBottom: '10px', fontSize: '0.92rem' }}>Choisissez la taille</div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(variantesDispo.length, 3)}, 1fr)`, gap: '8px' }}>
              {variantesDispo.map(v => {
                const isSel = selectedVar?.nom === v.nom;
                return (
                  <button
                    key={v.nom}
                    className="taste-btn num-tabular"
                    onClick={() => { setSelectedVar(v); setOptionsChoisies([]); }}
                    style={{
                      padding: '12px 10px', borderRadius: '12px',
                      border: isSel ? `2px solid ${COLORS.primary}` : `1px solid ${COLORS.border}`,
                      background: isSel ? '#FEF2F2' : 'white',
                      color: isSel ? COLORS.primary : COLORS.textMain,
                      fontWeight: '800', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px'
                    }}
                  >
                    <span style={{ fontSize: '1rem' }}>{v.nom}</span>
                    <span style={{ fontSize: '0.85rem', opacity: 0.9 }}>{v.prix} DH</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {isPates && (
          <div style={{ marginTop: '20px', borderTop: `1px solid ${COLORS.border}`, paddingTop: '16px' }}>
            <div style={{ fontWeight: '700', marginBottom: '10px', fontSize: '0.92rem' }}>Type de Pâtes <span style={{ color: COLORS.danger }}>*</span></div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {patesDispo.map(type => (
                <button key={type} className="taste-btn" onClick={() => setTypePates(type)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: typePates === type ? `2px solid ${COLORS.primary}` : `1px solid ${COLORS.border}`, background: typePates === type ? '#FEF2F2' : 'white', fontWeight: '700', color: typePates === type ? COLORS.primary : COLORS.textMain, cursor: 'pointer' }}>{type}</button>
              ))}
            </div>
          </div>
        )}

        {isPizzaProduct && (
          <div style={{ marginTop: '20px', borderTop: `1px solid ${COLORS.border}`, paddingTop: '16px' }}>
            <div style={{ fontWeight: '700', marginBottom: '10px', fontSize: '0.92rem' }}>Suppléments & Croûte</div>
            <div className="taste-btn num-tabular" onClick={() => setIsCheesyCrust(!isCheesyCrust)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', borderRadius: '12px', border: isCheesyCrust ? `2px solid ${COLORS.promo}` : `1px solid ${COLORS.border}`, background: isCheesyCrust ? '#FFFBEB' : 'white', cursor: 'pointer', marginBottom: '12px' }}>
              <span style={{ fontWeight: '700' }}>🧀 Cheesy Crust (Bords Fourrés)</span>
              <span style={{ color: COLORS.primary, fontWeight: '800' }}>+{selectedVar?.nom === 'M' || selectedVar?.nom === 'Standard' || !selectedVar ? '15' : '25'} DH</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {EXTRAS_PIZZA.map(ex => {
                const isSelected = extrasPizza.some(e => e.nom === ex.nom);
                return (
                  <button key={ex.nom} className="taste-btn num-tabular" onClick={() => toggleExtraPizza(ex)} style={{ padding: '9px 14px', borderRadius: '999px', border: isSelected ? `1px solid ${COLORS.primary}` : `1px solid ${COLORS.border}`, background: isSelected ? '#FEF2F2' : 'white', color: isSelected ? COLORS.primary : COLORS.textMain, fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}>
                    {isSelected ? '✓ ' : '+ '}{ex.nom} ({ex.prix} DH)
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {isBurger && (
          <div style={{ marginTop: '20px', borderTop: `1px solid ${COLORS.border}`, paddingTop: '16px' }}>
            <div style={{ fontWeight: '700', marginBottom: '10px', color: COLORS.danger, fontSize: '0.92rem' }}>Retirer un ingrédient</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {RETRAIT_INGREDIENTS.map(ing => {
                const isSel = sansIngredients.includes(ing);
                return (
                  <button key={ing} className="taste-btn" onClick={() => toggleSans(ing)} style={{ padding: '8px 14px', borderRadius: '999px', border: `1px solid ${isSel ? COLORS.danger : COLORS.border}`, background: isSel ? '#FEF2F2' : 'white', color: isSel ? COLORS.danger : COLORS.textLight, fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer' }}>
                    {isSel ? '🚫 ' : ''}{ing}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {isTacos && (
          <div style={{ marginTop: '20px', borderTop: `1px solid ${COLORS.border}`, paddingTop: '16px' }}>
            <div style={{ fontWeight: '700', marginBottom: '10px', fontSize: '0.92rem' }}>Sauces Fait Maison <small style={{ color: sauces.length === 0 ? COLORS.danger : COLORS.success }}>(Min 1, Max 2)</small></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {saucesDispo.map(s => {
                const count = getCount(s, sauces);
                return (
                  <div key={s} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px dashed ${COLORS.border}` }}>
                    <span style={{ fontWeight: '500' }}>{s}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {count > 0 && <button className="taste-btn" onClick={() => decrementOption(s, sauces, setSauces)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, background: 'white', fontWeight: 'bold', cursor: 'pointer' }}>-</button>}
                      {count > 0 && <span className="num-tabular" style={{ fontWeight: '800' }}>{count}</span>}
                      <button className="taste-btn" onClick={() => incrementOption(s, sauces, setSauces, 2)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: COLORS.secondary, color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {maxChoix > 0 && (
          <div style={{ marginTop: '20px', borderTop: `1px solid ${COLORS.border}`, paddingTop: '16px' }}>
            <div style={{ fontWeight: '700', marginBottom: '10px', fontSize: '0.92rem' }}>
              {titreOptions} <small className="num-tabular" style={{ color: optionsChoisies.length < minChoix ? COLORS.danger : COLORS.success }}>({optionsChoisies.length}/{maxChoix})</small>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {listeOptions.map(opt => {
                const count = getCount(opt, optionsChoisies);
                return (
                  <div key={opt} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px dashed ${COLORS.border}` }}>
                    <span style={{ fontWeight: '500' }}>{opt}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {count > 0 && <button className="taste-btn" onClick={() => decrementOption(opt, optionsChoisies, setOptionsChoisies)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, background: 'white', fontWeight: 'bold', cursor: 'pointer' }}>-</button>}
                      {count > 0 && <span className="num-tabular" style={{ fontWeight: '800' }}>{count}</span>}
                      <button className="taste-btn" onClick={() => incrementOption(opt, optionsChoisies, setOptionsChoisies, maxChoix)} style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: COLORS.primary, color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>+</button>
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
            if (isPates && !typePates) return alert("Veuillez choisir le type de pâtes !");
            if (minChoix > 0 && optionsChoisies.length < minChoix) return alert(`Veuillez choisir ${minChoix} options !`);
            if (isTacos && sauces.length === 0) return alert("⚠️ Veuillez choisir au moins une sauce (ou 'Pas de sauce') !");

            const catUpper = product.categorie ? product.categorie.toUpperCase() : 'PLAT';
            const nomComplet = selectedVar ? `[${catUpper}] ${product.nom} (${selectedVar.nom})` : `[${catUpper}] ${product.nom}`;

            let details = [];
            if (typePates) details.push(`Type: ${typePates}`);
            if (isCheesyCrust) details.push(`★ CHEESY CRUST`);
            if (optionsChoisies.length > 0) details.push(`Options: ${formatOptions(optionsChoisies)}`);
            if (sauces.length > 0) details.push(`Sauces: ${formatOptions(sauces)}`);
            if (extrasPizza.length > 0) extrasPizza.forEach(ext => details.push(`+ ${ext.nom}`));
            if (sansIngredients.length > 0) sansIngredients.forEach(exc => details.push(`🚫 ${exc}`));

            onAdd({
              ...product,
              nom: nomComplet,
              prixFinal: finalPriceCalculated,
              varianteNom: selectedVar ? selectedVar.nom : null,
              sauces,
              optionsChoisies,
              choixPates: typePates,
              isCheesyCrust,
              extras: extrasPizza,
              sans: sansIngredients,
              detailsTxt: details
            });
          }}
          style={{
            background: COLORS.primary, color: 'white', border: 'none', borderRadius: '14px',
            padding: '16px', fontWeight: '800', width: '100%', marginTop: '24px', fontSize: '1.05rem',
            cursor: 'pointer', opacity: (minChoix > 0 && optionsChoisies.length < minChoix) ? 0.55 : 1
          }}
        >
          {minChoix > 0 && optionsChoisies.length < minChoix
            ? `Choisissez encore ${minChoix - optionsChoisies.length} option(s)`
            : `Ajouter au panier • ${finalPriceCalculated} DH`}
        </button>
      </div>
    </div>
  );
}

// STYLES PHYSIQUES & MICRO-INTERACTIONS (UI DESIGN TASTE PRO)
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
    transition: transform 150ms cubic-bezier(0.22, 1, 0.36, 1), opacity 150ms ease;
    will-change: transform;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .taste-btn:active:not(:disabled) {
    transform: scale(0.97);
  }

  .taste-card {
    transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1);
    -webkit-tap-highlight-color: transparent;
  }
  .taste-card:active {
    transform: scale(0.98);
  }

  @keyframes sheetUp {
    from { opacity: 0; transform: translateY(100%); }
    to { opacity: 1; transform: translateY(0); }
  }
  .sheet-anim {
    animation: sheetUp 240ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }

  @keyframes modalPop {
    from { opacity: 0; transform: scale(0.95) translateY(8px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
  .modal-anim {
    animation: modalPop 200ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }
`;

export default App;
