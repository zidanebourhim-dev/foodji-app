import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from './firebase';
import { signInWithEmailAndPassword, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, setDoc, query, getDoc, orderBy, limit } from 'firebase/firestore';
import './App.css';

// PALETTE CALIBRÉE (UI DESIGN TASTE PRO - ZINC & BRAND FOODJI)
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
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  promo: '#D97706',
  textMain: '#09090B',  // Zinc 950
  textLight: '#71717A', // Zinc 500
  pending: '#F97316',
  blue: '#2563EB'
};

const INIT_VIANDES = [{ nom: "Poulet", available: true }, { nom: "Viande Hachée", available: true }, { nom: "Cordon Bleu", available: true }, { nom: "Nuggets", available: true }, { nom: "Poulet Crispy", available: true }];
const INIT_GARNITURES_PIZZA = [{ nom: "Viande Hachée", available: true }, { nom: "Poulet", available: true }, { nom: "4 Fromages", available: true }, { nom: "Cannibale", available: true }, { nom: "Pepperoni", available: true }, { nom: "Thon", available: true }, { nom: "Charcuterie", available: true }, { nom: "Végétarienne", available: true }, { nom: "Fruits de Mer", available: true }];
const INIT_SAUCES = [{ nom: "Algérienne", available: true }, { nom: "Biggy", available: true }, { nom: "Barbecue", available: true }, { nom: "Andalouse", available: true }, { nom: "Samouraï", available: true }, { nom: "Gruyère", available: true }, { nom: "Pas de sauce", available: true }];
const INIT_PATES = [{ nom: "Penne", available: true }, { nom: "Tagliatelle", available: true }, { nom: "Spaghetti", available: true }];
const INIT_TAILLES_PIZZA = [{ nom: "M", available: true }, { nom: "L", available: true }];

const TOUTES_CATEGORIES = ["Tacos", "Pizzas", "Burgers", "Panuozzo", "Pâtes", "Sides", "Les Burritos", "Koniks", "Plats", "Salades", "Boissons", "Suppléments"];
const STOCK_TABS = [{ id: 'viandes', label: '🌮 Viandes' }, { id: 'garnitures', label: '🍕 Garnitures' }, { id: 'sauces', label: '🥣 Sauces' }, { id: 'pates', label: '🍝 Pâtes' }, { id: 'tailles_pizza', label: '📏 Tailles Pizza' }];
const CAISSIERES = ["Fatima Zahra", "Nada", "Manager"];
const NOTIF_SOUND = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

const EXTRAS_BASE = { "Champignons": 10, "Mozzarella": 10, "Parmesan": 15, "Cheddar": 15 };
const TACOS_EXTRAS = { "Sauce Fromagère": 10, "Supplément Cheddar": 7, "Supplément Mozzarella": 7, "Gratinage": 7 };

const ACCOMPAGNEMENTS_PLATS = ["Frites", "Légumes Sautés", "Pâtes"];
const EXCLUSIONS_BURGER = ["Sans Oignons", "Sans Tomates", "Sans Salade", "Sans Fromage", "Sans Sauce", "Sans Cornichons"];

// Correction : "4 saisons" et "2 saisons" ont été retirées d'ici pour activer la Promo Dimanche automatiquement
const PIZZAS_EXCLUES_PROMO = ["fruits de mer", "cannibale"];

// Helper universel pour convertir proprement les dates Firestore ou JS sans crash
const toJSDate = (d) => {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  if (typeof d.seconds === 'number') return new Date(d.seconds * 1000);
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, errorMsg: '' }; }
  static getDerivedStateFromError(error) { return { hasError: true, errorMsg: error.toString() }; }
  componentDidCatch(error, errorInfo) { console.error("Crash intercepté:", error, errorInfo); }
  render() {
    if (this.state.hasError) return (
      <div style={{ padding: '40px', background: '#FEF2F2', color: '#991B1B', minHeight: '100vh', fontFamily: 'sans-serif' }}>
        <h2>🚨 ERREUR FATALE INTERCEPTÉE</h2>
        <div style={{ background: '#7F1D1D', color: 'white', padding: '20px', borderRadius: '12px', marginTop: '20px', fontFamily: 'monospace' }}>{this.state.errorMsg}</div>
        <button onClick={() => window.location.reload()} style={{ marginTop: '20px', padding: '12px 24px', background: '#991B1B', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>🔄 Recharger l'application</button>
      </div>
    );
    return this.props.children;
  }
}

function FoodjiSystem() {
  const [authState, setAuthState] = useState("LOADING");
  const [appMode, setAppMode] = useState('ADMIN');

  const [menu, setMenu] = useState([]);
  const [commandes, setCommandes] = useState([]);
  const [clientsDB, setClientsDB] = useState([]);
  const [promotions, setPromotions] = useState([]);
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
  const [numpad, setNumpad] = useState({ active: false, mode: '', targetId: null, label: '', value: '' });
  const [showBilanGlobal, setShowBilanGlobal] = useState(false);
  const [showRenduMonnaie, setShowRenduMonnaie] = useState({ active: false, aRendre: 0, received: 0 });
  const [showCashOptions, setShowCashOptions] = useState(false);
  const [showFondsCaissePrompt, setShowFondsCaissePrompt] = useState({ active: false, caissiere: '' });
  const [fondsInitialInput, setFondsInitialInput] = useState('');
  const [showDiviserAddition, setShowDiviserAddition] = useState(false);
  const [diviserPar, setDiviserPar] = useState(2);

  const [customizeItem, setCustomizeItem] = useState(null);
  const [customOptions, setCustomOptions] = useState({ garnitures: [], sauces: [], viandes: [], extras: [], cheesyCrust: false, typePate: '', accompagnements: [], exclusions: [] });

  // État dédié pour le configurateur Pack Promo 2 Tacos (L = 55 DH / XL = 89 DH)
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

  const prevCommandesLength = useRef(null);
  const audioRef = useRef(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Correction de la fuite mémoire sur onAuthStateChanged
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

    const unsubMenu = onSnapshot(collection(db, "produits"), (snap) => setMenu(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubPromos = onSnapshot(collection(db, "promotions"), (snap) => setPromotions(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubClients = onSnapshot(collection(db, "clients"), (snap) => setClientsDB(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    // Protection Quota Firestore : Tri descendant + Limite aux 150 dernières commandes
    const qCmd = query(collection(db, "commandes"), orderBy("date", "desc"), limit(150));
    const unsubCmd = onSnapshot(qCmd, (snap) => {
      try {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));

        if (prevCommandesLength.current !== null && list.length > prevCommandesLength.current) {
          if (!audioRef.current) audioRef.current = new Audio(NOTIF_SOUND);
          audioRef.current.play().catch(() => {});
        }
        prevCommandesLength.current = list.length;
        setCommandes(list);
      } catch (e) { console.error("Erreur tri commandes:", e); }
    });

    return () => { unsubStatus(); unsubHoraires(); unsubStocks(); unsubSession(); unsubServiceGlobal(); unsubMenu(); unsubPromos(); unsubClients(); unsubCmd(); };
  }, [authState]);

  // Préserve les suppléments payants (extraPrice) sur le Pep's lors du changement Sur Place / Emporter
  useEffect(() => {
    setPosCart(prevCart => prevCart.map(item => {
      if (item.nom.includes("Pep's") && !item.isPrixModifie) {
        const newBasePrice = (posOrderType === 'emporter' || posOrderType === 'livraison') ? 33 : 28;
        return { ...item, prixFinal: newBasePrice + (item.extraPrice || 0) };
      }
      return item;
    }));
  }, [posOrderType]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try { await signInWithEmailAndPassword(auth, email, password); } catch (err) { alert(`Erreur d'authentification : ${err.code}`); }
    setLoading(false);
  };

  const toggleAvailability = async (item) => await updateDoc(doc(db, "produits", item.id), { available: !item.available });
  const supprimerProduit = async (id) => { if (window.confirm("Supprimer définitivement ce produit du catalogue ?")) await deleteDoc(doc(db, "produits", id)); };
  const toggleStockItem = async (listName, index) => {
    const newList = [...(parametres.stocks[listName] || [])];
    newList[index].available = !newList[index].available;
    await updateDoc(doc(db, "parametres", "stocks"), { ...parametres.stocks, [listName]: newList });
  };
  const addNewStockItem = async () => {
    if (!newItemName.trim()) return;
    const newList = [...(parametres.stocks[activeStockTab] || []), { nom: newItemName.trim(), available: true }];
    await updateDoc(doc(db, "parametres", "stocks"), { ...parametres.stocks, [activeStockTab]: newList });
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
      alert(`✅ [${nomItem}] mis en rupture de stock.`);
    }
    e.target.value = "";
  };

  const savePromotion = async () => {
    if (!formPromo.titre || !formPromo.prix) return alert("Remplis le titre et le prix.");
    await addDoc(collection(db, "promotions"), { titre: formPromo.titre.trim(), description: formPromo.description.trim(), prix: Number(formPromo.prix), status: formPromo.status, date: new Date() });
    setFormPromo({ titre: '', description: '', prix: '', status: true });
    alert("Deal ajouté avec succès !");
  };

  const togglePromoStatus = async (id, currentStatus) => await updateDoc(doc(db, "promotions", id), { status: !currentStatus });
  const togglePromoDuoAdmin = async () => await updateDoc(doc(db, "parametres", "status"), { promoDuoActive: !parametres.promoDuoActive });
  const togglePromoDimancheAdmin = async () => await updateDoc(doc(db, "parametres", "status"), { promoDimancheActive: !parametres.promoDimancheActive });
  const togglePromoTacosAdmin = async () => await updateDoc(doc(db, "parametres", "status"), { promoTacosActive: !parametres.promoTacosActive });

  const crediterPointsFidelite = async (telRaw, nomClient) => {
    if (!telRaw || telRaw.trim().length < 9) return;
    const telClean = telRaw.replace(/\s+/g, '');
    const exist = clientsDB.find(c => (c.tel || '').replace(/\s+/g, '') === telClean);
    if (exist) {
      await updateDoc(doc(db, "clients", exist.id), { totalCommandes: (exist.totalCommandes || 0) + 1, lastOrder: new Date() });
    } else {
      await addDoc(collection(db, "clients"), { tel: telClean, nom: nomClient || "Client", totalCommandes: 1, remiseAuto: 0, lastOrder: new Date() });
    }
  };

  const changerStatus = async (cmd, st) => {
    if (st === 'Annulé' && cmd.total > 100) {
      if (!window.confirm(`⚠️ ALERTE SÉCURITÉ\n\nÊtes-vous sûr de vouloir ANNULER cette commande de ${cmd.total} DH ?`)) return;
    }
    await updateDoc(doc(db, "commandes", cmd.id), { status: st });
    if (st === 'Terminé') await crediterPointsFidelite(cmd.tel, cmd.client || "Client Web");
  };

  const encaisserRetourLivreur = async (cmd) => {
    if (!window.confirm(`✅ Confirmer l'encaissement de ${cmd.total} DH apportés par le livreur ?`)) return;
    await updateDoc(doc(db, "commandes", cmd.id), { status: 'Terminé', methodePaiement: 'Espèces' });
    await crediterPointsFidelite(cmd.tel, cmd.client || "Client Livraison");
  };

  const handleCategoryChange = (e) => {
    const cat = e.target.value;
    let vars = [];
    if (cat === 'Tacos') vars = [{ nom: 'M', prix: '', available: true }, { nom: 'L', prix: '', available: true }, { nom: 'XL', prix: '', available: true }, { nom: 'XXL', prix: '', available: true }];
    else if (cat === 'Pizzas') vars = [{ nom: 'M', prix: '', available: true }, { nom: 'L', prix: '', available: true }];
    setFormProd({ ...formProd, categorie: cat, variantes: vars, prixBase: '' });
  };

  const saveProduit = async () => {
    if (!formProd.nom.trim()) return;
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
      alert("Produit modifié !");
      setEditId(null);
    } else {
      await addDoc(collection(db, "produits"), data);
      alert("Produit ajouté !");
    }
    setFormProd({ nom: '', description: '', image: '', categorie: 'Panuozzo', prixBase: '', variantes: [], excludeVIP: false });
    setLoading(false);
  };

  const ajouterClientManuel = async () => {
    const telClean = newClientPhone.replace(/\s+/g, '');
    if (telClean.length < 9) return alert("Numéro de téléphone invalide (au moins 9 chiffres).");
    const exist = clientsDB.find(c => (c.tel || '').replace(/\s+/g, '') === telClean);
    if (exist) return alert("❌ Ce numéro existe déjà. Modifie sa fiche dans le tableau.");
    setLoading(true);
    try {
      await addDoc(collection(db, "clients"), {
        tel: telClean,
        nom: newClientName.trim() || "Inconnu",
        totalCommandes: Number(newClientOrders) || 0,
        remiseAuto: Math.min(100, Math.max(0, Number(newClientRemise) || 0)),
        lastOrder: new Date()
      });
      setNewClientPhone(''); setNewClientName(''); setNewClientOrders(''); setNewClientRemise('');
      alert("✅ Client ajouté !");
    } catch (e) { alert("Erreur lors de l'ajout."); }
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

  const cloturerShift = async () => {
    const bilan = genererBilanShift();
    if (!bilan) return;
    if (bilan.totalEnLivraison > 0) {
      if (!window.confirm(`⚠️ ATTENTION : Il reste ${bilan.totalEnLivraison} DH en cours chez les livreurs non encaissés.\nVoulez-vous quand même clôturer le shift de ${sessionCaisse.caissiere} ?`)) return;
    } else {
      if (!window.confirm(`⚠️ Clôturer le shift de ${sessionCaisse.caissiere} ?`)) return;
    }
    const xData = { isX: true, caissiere: sessionCaisse.caissiere, date: new Date(), ...bilan };
    setOrderToPrint(xData);
    setTimeout(async () => {
      window.print();
      await updateDoc(doc(db, "parametres", "session_caisse"), { isActive: false, caissiere: '', startTime: null });
      setTimeout(() => setOrderToPrint(null), 1000);
    }, 500);
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

  const cloturerZDefinitif = async () => {
    const bilan = genererBilanGlobalZ();
    if (!bilan) return;
    if (bilan.totalEnLivraison > 0) {
      alert(`🚫 IMPOSSIBLE DE CLÔTURER LE Z : Il reste ${bilan.totalEnLivraison} DH dehors chez les livreurs. Encaissez d'abord les retours livreurs en haut de la page Admin.`);
      return;
    }
    if (!window.confirm("⚠️ ATTENTION : Cela va imprimer le bilan final Z, L'ARCHIVER, et REMETTRE TOUS LES COMPTEURS À ZÉRO. Confirmer ?")) return;
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
  };

  const handlePhoneInput = (val) => {
    setPosPhone(val);
    const valTrim = val.replace(/\s+/g, '');
    if (valTrim.length >= 9) {
      const found = clientsDB.find(c => (c.tel || '').replace(/\s+/g, '') === valTrim);
      if (found) { setPosClientName(found.nom || ''); setClientActif(found); } else setClientActif(null);
    } else setClientActif(null);
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

  // Helpers pour le configurateur Pack Promo 2 Tacos
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
      return alert(`Sélectionne au moins 1 viande (max ${maxV}) pour chacun des 2 Tacos.`);
    }

    let extraPrice = 0;
    let details = [];

    if (promoTacosModal.avecFritesBoisson) {
      extraPrice += 15;
      details.push("🍟🥤 + MENU FRITES & BOISSON 1L (+15DH)");
    } else {
      details.push("🚫 LES 2 SANS FRITES (Offre Promo)");
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
      nom: '🍟🥤 Option Promo : Frites + Boisson 1L',
      extraPrice: 15,
      prixFinal: 15,
      isPrixModifie: false,
      isPromoPack: true,
      detailsTxt: ['🍟🥤 Avec Frites + Boisson 1L pour Promo Tacos'],
      excludeVIP: true,
      qte: 1,
      idCart: Date.now() + Math.random()
    }]);
  };

  const validerEtAjouter = () => {
    const prod = customizeItem.produit; const vari = customizeItem.variante;
    if (prod.categorie === 'Tacos' && prod.nom.toLowerCase().includes('mixte')) {
      const maxViandes = vari?.nom === 'XXL' ? 4 : vari?.nom === 'XL' ? 3 : 2;
      if (customOptions.viandes.length !== maxViandes) return alert(`Tu dois sélectionner EXACTEMENT ${maxViandes} viandes.`);
    }
    if (prod.categorie === 'Pâtes' && !customOptions.typePate) return alert("Choisis un type de pâtes.");
    if (prod.categorie === 'Plats' && customOptions.accompagnements.length !== 2) return alert("Choisis EXACTEMENT 2 accompagnements.");
    addToCartFinal(prod, vari, customOptions);
  };

  const addToCartFinal = (produit, variante, options) => {
    let basePrice = Number(variante ? variante.prix : produit.prix) || 0;
    if (produit.nom.includes("Pep's")) basePrice = (posOrderType === 'emporter' || posOrderType === 'livraison') ? 33 : 28;
    let extraPrice = 0; let details = [];

    if (produit.categorie === 'Pâtes') details.push(`Type: ${options.typePate}`);
    if (produit.categorie === 'Plats') details.push(`Accompagnements: ${options.accompagnements.join(' et ')}`);
    if (produit.categorie === 'Burgers' && options.exclusions?.length > 0) options.exclusions.forEach(exc => details.push(`🚫 ${exc}`));

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

  // 1. MOTEUR PROMO DIMANCHE (2 Pizzas M achetées = 3ème offerte, inclut désormais 2 saisons et 4 saisons)
  if (parametres.promoDimancheActive) {
    let pizzasDimanchePrices = [];
    posCart.forEach(item => {
      const vNom = (item.varianteNom || '').trim().toUpperCase();
      const isMoyenne = vNom !== 'L'; // Accepte 'M', 'Standard' ou pizza sans taille L
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

  // 2. MOTEUR PROMO TACOS AUTOMATIQUE (Si la caissière saisit 2 Tacos L ou 2 Tacos XL séparément)
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

  // 3. MOTEUR PROMO DUO (-50% sur le 2ème)
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
  const remiseCRM = clientActif && clientActif.remiseAuto ? Math.round(sousTotalEligibleVIP * (clientActif.remiseAuto / 100)) : 0;
  const totalRemises = montantRemiseGlobale + remiseCRM + promoDuoDiscount + promoDimancheDiscount + promoTacosDiscount;
  const totalCart = Math.max(0, sousTotalCart + fraisLivraison - totalRemises);

  const openNumpad = (mode, label, targetId = null) => setNumpad({ active: true, mode, label, targetId, value: '' });
  const handleNumpadKey = (val) => {
    if (val === 'DEL') setNumpad({ ...numpad, value: numpad.value.slice(0, -1) });
    else if (val === 'OK') applyNumpadValue();
    else setNumpad({ ...numpad, value: numpad.value + val });
  };

  const applyNumpadValue = async () => {
    const valNum = Number(numpad.value) || 0;
    if (numpad.mode === 'remise_globale') {
      if (valNum > 100) return alert("La remise ne peut pas dépasser 100%");
      setRemiseGlobale(valNum);
    } else if (numpad.mode === 'prix_article') {
      setPosCart(posCart.map(it => it.idCart === numpad.targetId ? { ...it, prixFinal: valNum, isPrixModifie: true } : it));
    } else if (numpad.mode === 'encaissement_especes') {
      if (valNum < totalCart) return alert("Le montant donné est inférieur au total.");
      setNumpad({ active: false, mode: '', targetId: null, label: '', value: '' });
      setShowRenduMonnaie({ active: true, aRendre: valNum - totalCart, received: valNum });
      return;
    } else if (numpad.mode === 'depense') {
      if (valNum <= 0) return alert("Montant invalide");
      const motif = window.prompt("Motif de la dépense (ex: Eau, Fournitures...) :");
      if (!motif || !motif.trim()) return;
      setLoading(true);
      const newDepense = {
        client: "DÉCAISSEMENT",
        caissiere: sessionCaisse.caissiere || "Manager",
        type: "depense",
        commentaire: motif.trim(),
        items: [{ nom: `Dépense: ${motif.trim()}`, prixFinal: -valNum, qte: 1 }],
        total: -valNum,
        status: "Terminé",
        methodePaiement: "Espèces",
        date: new Date()
      };
      const docRef = await addDoc(collection(db, "commandes"), newDepense);
      newDepense.id = docRef.id;
      newDepense.isDepense = true;
      setOrderToPrint(newDepense);
      setTimeout(() => { window.print(); setTimeout(() => setOrderToPrint(null), 1000); }, 500);
      setLoading(false);
    }
    setNumpad({ active: false, mode: '', targetId: null, label: '', value: '' });
  };

  const validerCommandePOS = async (methodePaiement, especeRecue = null, forceStatus = "Terminé") => {
    if (posCart.length === 0) return alert("Panier vide !");
    if (posOrderType === 'livraison' && !posAddress.trim()) {
      if (!window.confirm("⚠️ Aucune adresse de livraison n'est renseignée. Continuer quand même ?")) return;
    }

    setLoading(true);
    const finalClientName = posClientName.trim() ? posClientName.trim() : "Non spécifié";

    // Si promoTacosDiscount est appliquée automatiquement sur des Tacos individuels sans pack frites+boisson, on le signale clairement à la cuisine
    const hasOptionFritesBoisson = posCart.some(it => it.id === 'supplement_promo_tacos_menu');
    const itemsFinal = posCart.map(it => {
      if (promoTacosDiscount > 0 && it.categorie === 'Tacos' && (it.varianteNom === 'L' || it.varianteNom === 'XL') && !it.isPromoPack) {
        const mentionFrites = hasOptionFritesBoisson ? '🍟🥤 AVEC FRITES + BOISSON 1L (Promo)' : '🚫 SANS FRITES (Promo Tacos)';
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
      newCmd.id = docRef.id;

      if (forceStatus === 'Terminé') {
        await crediterPointsFidelite(posPhone, finalClientName);
      }

      setOrderToPrint(newCmd);
      setTimeout(() => { window.print(); setTimeout(() => setOrderToPrint(null), 1000); }, 500);

      setPosCart([]); setPosPhone(''); setPosNote(''); setPosClientName(''); setPosAddress(''); setPosBipeur(''); setPosOrderType('sur_place'); setRemiseGlobale(0); setClientActif(null); setShowRenduMonnaie({ active: false, aRendre: 0, received: 0 });
    } catch (e) { alert("Erreur lors de la création de la commande."); }
    setLoading(false);
  };

  const imprimerCommandeExistante = (cmd) => {
    setOrderToPrint(cmd);
    setTimeout(() => { window.print(); setTimeout(() => setOrderToPrint(null), 1000); }, 500);
  };

  const getDetaisImpression = (it) => {
    if (it.detailsTxt && it.detailsTxt.length > 0) return it.detailsTxt;
    let d = [];
    if (it.choixPates) d.push(`Type: ${it.choixPates}`);
    if (it.isCheesyCrust) d.push(`★ CHEESY CRUST`);
    if (it.optionsChoisies?.length > 0) d.push(`Options: ${it.optionsChoisies.join(', ')}`);
    if (it.sauces?.length > 0) d.push(`Sauces: ${it.sauces.join(', ')}`);
    if (it.extras?.length > 0) { const extrasText = it.extras.map(e => e.nom ? e.nom : e).join(', '); d.push(`Extras: ${extrasText}`); }
    if (it.sans?.length > 0) it.sans.forEach(exc => d.push(`🚫 ${exc}`));
    return d;
  };

  const commandesWebEnAttente = commandes.filter(c => c.status === 'En attente' || c.status === 'En cours de validation').length;
  const commandesEnLivraison = commandes.filter(c => c.status === 'En Livraison');

  if (authState === "LOADING") return (
    <div style={{ background: COLORS.secondary, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
      <h3 style={{ letterSpacing: '-0.02em' }}>Chargement du système Foodji...</h3>
    </div>
  );

  if (authState === null) return (
    <div style={{ background: COLORS.bg, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={handleLogin} className="modal-box" style={{ background: 'white', padding: '40px', borderRadius: '16px', width: '360px', textAlign: 'center', border: `1px solid ${COLORS.border}`, boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
        <h2 style={{ marginTop: 0, letterSpacing: '-0.03em', color: COLORS.textMain }}>⚙️ Foodji Système</h2>
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '12px', margin: '15px 0', border: `1px solid ${COLORS.border}`, borderRadius: '10px', boxSizing: 'border-box', fontSize: '1rem' }} />
        <input type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '12px', marginBottom: '20px', border: `1px solid ${COLORS.border}`, borderRadius: '10px', boxSizing: 'border-box', fontSize: '1rem' }} />
        <button type="submit" className="pos-btn" style={{ width: '100%', padding: '14px', background: COLORS.primary, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>{loading ? 'Connexion...' : 'Se connecter'}</button>
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
                      {details.map((dt, j) => <div key={j} style={{ fontWeight: (dt.includes('🚫') || dt.includes('🍟🥤')) ? 'bold' : 'normal' }}>• {dt}</div>)}
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
              <span>🎁 PROMO DIMANCHE (3ème Gratuite)</span><span>- {orderToPrint.remisePromoDimanche} DH</span>
            </div>
          )}

          {orderToPrint.remisePromoTacos > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '5px', fontWeight: 'bold' }}>
              <span>🌮 PROMO TACOS (2L=55 / 2XL=89)</span><span>- {orderToPrint.remisePromoTacos} DH</span>
            </div>
          )}

          {orderToPrint.remisePromoDuo > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '5px', fontWeight: 'bold' }}>
              <span>🎁 PROMO DUO (-50%)</span><span>- {orderToPrint.remisePromoDuo} DH</span>
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
          <h1 style={{ fontSize: '2.8rem', marginBottom: '32px', letterSpacing: '-0.04em' }}>CAISSE FERMÉE</h1>

          {!showFondsCaissePrompt.active ? (
            <div className="modal-box" style={{ background: 'white', color: COLORS.textMain, padding: '36px', borderRadius: '20px', width: '400px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)' }}>
              <h2 style={{ marginTop: 0, letterSpacing: '-0.02em' }}>Ouvrir le service</h2>
              <p style={{ color: COLORS.textLight }}>Sélectionnez l'opérateur de caisse :</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
                {CAISSIERES.map(nom => (
                  <button key={nom} className="pos-btn" onClick={() => demanderOuvertureCaisse(nom)} style={{ padding: '18px', fontSize: '1.35rem', fontWeight: 'bold', borderRadius: '12px', border: `1px solid ${COLORS.border}`, background: COLORS.bg, cursor: 'pointer', color: COLORS.textMain }}>{nom}</button>
                ))}
              </div>
              <button className="pos-btn" onClick={() => setAppMode('ADMIN')} style={{ marginTop: '28px', padding: '10px', border: 'none', background: 'transparent', color: COLORS.textLight, textDecoration: 'underline', cursor: 'pointer', fontWeight: '500' }}>⚙️ Retour Administration</button>
            </div>
          ) : (
            <div className="modal-box" style={{ background: 'white', color: COLORS.textMain, padding: '36px', borderRadius: '20px', width: '400px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)' }}>
              <h2 style={{ marginTop: 0, letterSpacing: '-0.02em' }}>Fonds de Caisse</h2>
              <p style={{ fontSize: '1.05rem', color: COLORS.textLight }}>Déclarer le fond de tiroir pour <strong style={{ color: COLORS.textMain }}>{showFondsCaissePrompt.caissiere}</strong> :</p>
              <input type="number" className="num-tabular" placeholder="Ex: 300" value={fondsInitialInput} onChange={e => setFondsInitialInput(e.target.value)} style={{ width: '100%', padding: '15px', fontSize: '2rem', textAlign: 'center', border: `2px solid ${COLORS.border}`, borderRadius: '12px', marginBottom: '20px', boxSizing: 'border-box', fontWeight: 'bold' }} />
              <button className="pos-btn" onClick={validerOuvertureCaisse} style={{ width: '100%', padding: '16px', background: COLORS.success, color: 'white', fontWeight: 'bold', fontSize: '1.15rem', borderRadius: '12px', border: 'none', cursor: 'pointer' }}>✅ Valider l'ouverture</button>
              <button className="pos-btn" onClick={() => setShowFondsCaissePrompt({ active: false, caissiere: '' })} style={{ marginTop: '15px', padding: '10px', border: 'none', background: 'transparent', color: COLORS.textLight, textDecoration: 'underline', cursor: 'pointer' }}>Annuler</button>
            </div>
          )}
        </div>
      );
    }

    return (
      <>
        {renderTickets()}

        {/* MODALE CONFIGURATEUR PACK PROMO 2 TACOS (L = 55 DH / XL = 89 DH) */}
        {promoTacosModal.active && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(9, 9, 11, 0.8)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2500 }}>
            <div className="modal-box" style={{ background: 'white', width: '92%', maxWidth: '880px', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', maxHeight: '92vh' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${COLORS.border}`, paddingBottom: '14px' }}>
                <div>
                  <h2 style={{ margin: 0, color: COLORS.primary, letterSpacing: '-0.02em' }}>
                    🌮 Pack Promo : 2 Tacos {promoTacosModal.taille} ({promoTacosModal.prixPack} DH)
                  </h2>
                  <div style={{ fontSize: '0.9rem', color: COLORS.textLight, marginTop: '4px' }}>
                    Par défaut : <strong style={{ color: COLORS.danger }}>🚫 Les deux sans frites</strong> • Option Menu Frites + Boisson 1L à +15 DH
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="pos-btn num-tabular" onClick={() => setPromoTacosModal(p => ({ ...p, taille: 'L', prixPack: 55, tacos1Viandes: [], tacos2Viandes: [] }))} style={{ padding: '10px 16px', borderRadius: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: promoTacosModal.taille === 'L' ? COLORS.primary : COLORS.bg, color: promoTacosModal.taille === 'L' ? 'white' : COLORS.textMain }}>2x L (55 DH)</button>
                  <button className="pos-btn num-tabular" onClick={() => setPromoTacosModal(p => ({ ...p, taille: 'XL', prixPack: 89, tacos1Viandes: [], tacos2Viandes: [] }))} style={{ padding: '10px 16px', borderRadius: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: promoTacosModal.taille === 'XL' ? COLORS.primary : COLORS.bg, color: promoTacosModal.taille === 'XL' ? 'white' : COLORS.textMain }}>2x XL (89 DH)</button>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '14px 0' }}>
                {/* OPTION +15 DH FRITES & BOISSON 1L */}
                <button
                  className="pos-btn num-tabular"
                  onClick={() => setPromoTacosModal(p => ({ ...p, avecFritesBoisson: !p.avecFritesBoisson }))}
                  style={{
                    width: '100%',
                    padding: '16px 20px',
                    borderRadius: '14px',
                    border: promoTacosModal.avecFritesBoisson ? `2px solid ${COLORS.success}` : `2px dashed ${COLORS.promo}`,
                    background: promoTacosModal.avecFritesBoisson ? '#ECFDF5' : '#FFFBEB',
                    color: promoTacosModal.avecFritesBoisson ? '#065F46' : '#92400E',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontWeight: 'bold',
                    fontSize: '1.1rem',
                    cursor: 'pointer',
                    marginBottom: '18px'
                  }}
                >
                  <span>{promoTacosModal.avecFritesBoisson ? '✅ MENU ACTIVÉ : Avec Frites + Boisson 1L' : '🍟🥤 Rajouter Frites + Boisson 1L (Sinon : 🚫 Sans Frites)'}</span>
                  <span style={{ background: promoTacosModal.avecFritesBoisson ? COLORS.success : COLORS.promo, color: 'white', padding: '6px 12px', borderRadius: '8px' }}>+ 15 DH</span>
                </button>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '16px' }}>
                  {/* TACOS #1 */}
                  <div style={{ background: COLORS.bg, padding: '16px', borderRadius: '14px', border: `1px solid ${COLORS.border}` }}>
                    <h3 style={{ marginTop: 0, color: COLORS.secondary, fontSize: '1.1rem' }}>
                      🌮 Tacos #1 ({promoTacosModal.taille}) — Viandes ({promoTacosModal.tacos1Viandes.length}/{promoTacosModal.taille === 'XL' ? 3 : 2})
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                      {(parametres.stocks.viandes || []).filter(v => v.available).map((v, idx) => {
                        const sel = promoTacosModal.tacos1Viandes.includes(v.nom);
                        const maxV = promoTacosModal.taille === 'XL' ? 3 : 2;
                        return (
                          <button key={idx} className="pos-btn" onClick={() => togglePromoTacosOption('tacos1Viandes', v.nom, maxV)} style={{ padding: '8px 14px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', background: sel ? COLORS.primary : 'white', color: sel ? 'white' : COLORS.textMain, border: `1px solid ${sel ? COLORS.primary : COLORS.border}` }}>{v.nom}</button>
                        );
                      })}
                    </div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: COLORS.textLight }}>🥣 Sauces Tacos #1</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                      {(parametres.stocks.sauces || []).filter(s => s.available).map((s, idx) => {
                        const sel = promoTacosModal.tacos1Sauces.includes(s.nom);
                        return (
                          <button key={idx} className="pos-btn" onClick={() => togglePromoTacosOption('tacos1Sauces', s.nom)} style={{ padding: '7px 12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', background: sel ? COLORS.secondary : 'white', color: sel ? 'white' : COLORS.textMain, border: `1px solid ${COLORS.border}`, fontSize: '0.9rem' }}>{s.nom}</button>
                        );
                      })}
                    </div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: COLORS.textLight }}>➕ Extras Tacos #1</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {Object.keys(TACOS_EXTRAS).map(ext => {
                        const sel = promoTacosModal.tacos1Extras.includes(ext);
                        return (
                          <button key={ext} className="pos-btn num-tabular" onClick={() => togglePromoTacosOption('tacos1Extras', ext)} style={{ padding: '7px 12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', background: sel ? COLORS.success : 'white', color: sel ? 'white' : COLORS.textMain, border: `1px solid ${COLORS.border}`, fontSize: '0.85rem' }}>{ext} (+{TACOS_EXTRAS[ext]}DH)</button>
                        );
                      })}
                    </div>
                  </div>

                  {/* TACOS #2 */}
                  <div style={{ background: COLORS.bg, padding: '16px', borderRadius: '14px', border: `1px solid ${COLORS.border}` }}>
                    <h3 style={{ marginTop: 0, color: COLORS.secondary, fontSize: '1.1rem' }}>
                      🌮 Tacos #2 ({promoTacosModal.taille}) — Viandes ({promoTacosModal.tacos2Viandes.length}/{promoTacosModal.taille === 'XL' ? 3 : 2})
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                      {(parametres.stocks.viandes || []).filter(v => v.available).map((v, idx) => {
                        const sel = promoTacosModal.tacos2Viandes.includes(v.nom);
                        const maxV = promoTacosModal.taille === 'XL' ? 3 : 2;
                        return (
                          <button key={idx} className="pos-btn" onClick={() => togglePromoTacosOption('tacos2Viandes', v.nom, maxV)} style={{ padding: '8px 14px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', background: sel ? COLORS.primary : 'white', color: sel ? 'white' : COLORS.textMain, border: `1px solid ${sel ? COLORS.primary : COLORS.border}` }}>{v.nom}</button>
                        );
                      })}
                    </div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: COLORS.textLight }}>🥣 Sauces Tacos #2</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                      {(parametres.stocks.sauces || []).filter(s => s.available).map((s, idx) => {
                        const sel = promoTacosModal.tacos2Sauces.includes(s.nom);
                        return (
                          <button key={idx} className="pos-btn" onClick={() => togglePromoTacosOption('tacos2Sauces', s.nom)} style={{ padding: '7px 12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', background: sel ? COLORS.secondary : 'white', color: sel ? 'white' : COLORS.textMain, border: `1px solid ${COLORS.border}`, fontSize: '0.9rem' }}>{s.nom}</button>
                        );
                      })}
                    </div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: COLORS.textLight }}>➕ Extras Tacos #2</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {Object.keys(TACOS_EXTRAS).map(ext => {
                        const sel = promoTacosModal.tacos2Extras.includes(ext);
                        return (
                          <button key={ext} className="pos-btn num-tabular" onClick={() => togglePromoTacosOption('tacos2Extras', ext)} style={{ padding: '7px 12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', background: sel ? COLORS.success : 'white', color: sel ? 'white' : COLORS.textMain, border: `1px solid ${COLORS.border}`, fontSize: '0.85rem' }}>{ext} (+{TACOS_EXTRAS[ext]}DH)</button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '14px', borderTop: `1px solid ${COLORS.border}`, paddingTop: '14px' }}>
                <button className="pos-btn" onClick={() => setPromoTacosModal(p => ({ ...p, active: false }))} style={{ flex: 1, padding: '15px', background: COLORS.bg, color: COLORS.textLight, borderRadius: '12px', border: 'none', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer' }}>Annuler</button>
                <button className="pos-btn num-tabular" onClick={validerPackPromoTacos} style={{ flex: 2, padding: '15px', background: COLORS.success, color: 'white', borderRadius: '12px', border: 'none', fontSize: '1.15rem', fontWeight: 'bold', cursor: 'pointer' }}>
                  ✅ Ajouter Pack Promo ({promoTacosModal.prixPack + (promoTacosModal.avecFritesBoisson ? 15 : 0)} DH + extras)
                </button>
              </div>
            </div>
          </div>
        )}

        {showDiviserAddition && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(9, 9, 11, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000 }}>
            <div className="modal-box" style={{ background: 'white', padding: '30px', borderRadius: '20px', width: '360px', textAlign: 'center' }}>
              <h2 style={{ marginTop: 0, letterSpacing: '-0.02em' }}>Diviser l'addition</h2>
              <p style={{ fontSize: '1.15rem', color: COLORS.textLight, marginBottom: '20px' }}>Total à diviser : <strong className="num-tabular" style={{ color: COLORS.textMain }}>{totalCart} DH</strong></p>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '20px' }}>
                <button className="pos-btn" onClick={() => setDiviserPar(Math.max(2, diviserPar - 1))} style={{ width: '56px', height: '56px', fontSize: '1.8rem', borderRadius: '12px', border: `1px solid ${COLORS.border}`, background: COLORS.bg, cursor: 'pointer', fontWeight: 'bold' }}>-</button>
                <span className="num-tabular" style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{diviserPar}</span>
                <button className="pos-btn" onClick={() => setDiviserPar(diviserPar + 1)} style={{ width: '56px', height: '56px', fontSize: '1.8rem', borderRadius: '12px', border: `1px solid ${COLORS.border}`, background: COLORS.bg, cursor: 'pointer', fontWeight: 'bold' }}>+</button>
              </div>

              <div className="num-tabular" style={{ background: COLORS.bg, padding: '20px', borderRadius: '12px', fontSize: '2rem', fontWeight: 'bold', color: COLORS.primary, marginBottom: '20px' }}>
                {(totalCart / diviserPar).toFixed(2)} DH <span style={{ fontSize: '1rem', color: COLORS.textLight }}>/ pers.</span>
              </div>

              <button className="pos-btn" onClick={() => { setShowDiviserAddition(false); validerCommandePOS('Espèces', totalCart); }} style={{ width: '100%', padding: '16px', background: COLORS.success, color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.15rem', fontWeight: 'bold', cursor: 'pointer' }}>✅ Encaisser (Espèces)</button>
              <button className="pos-btn" onClick={() => setShowDiviserAddition(false)} style={{ width: '100%', padding: '14px', background: 'transparent', color: COLORS.textLight, border: 'none', marginTop: '8px', cursor: 'pointer', fontSize: '1.05rem', fontWeight: '500' }}>Annuler</button>
            </div>
          </div>
        )}

        {showCashOptions && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(9, 9, 11, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000 }}>
            <div className="modal-box" style={{ background: 'white', padding: '30px', borderRadius: '20px', width: '360px', textAlign: 'center' }}>
              <h2 style={{ marginTop: 0, letterSpacing: '-0.02em' }}>Encaissement Espèces</h2>
              <p className="num-tabular" style={{ fontSize: '2rem', fontWeight: 'bold', color: COLORS.primary, margin: '10px 0 20px 0' }}>{totalCart} DH</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button className="pos-btn" onClick={() => { setShowCashOptions(false); validerCommandePOS('Espèces', totalCart); }} style={{ padding: '16px', background: COLORS.success, color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.15rem', fontWeight: 'bold', cursor: 'pointer' }}>✅ Montant Exact</button>
                <button className="pos-btn" onClick={() => { setShowCashOptions(false); openNumpad('encaissement_especes', 'SOMME REÇUE (Rendre monnaie)'); }} style={{ padding: '16px', background: COLORS.secondary, color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.15rem', fontWeight: 'bold', cursor: 'pointer' }}>🧮 Rendre la monnaie</button>
                <button className="pos-btn" onClick={() => { setShowCashOptions(false); setShowDiviserAddition(true); }} style={{ padding: '16px', background: COLORS.blue, color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.15rem', fontWeight: 'bold', cursor: 'pointer' }}>➗ Diviser l'addition</button>
                <button className="pos-btn" onClick={() => setShowCashOptions(false)} style={{ padding: '14px', background: COLORS.bg, color: COLORS.textMain, border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer' }}>Annuler</button>
              </div>
            </div>
          </div>
        )}

        {numpad.active && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(9, 9, 11, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
            <div className="modal-box" style={{ background: 'white', width: '360px', borderRadius: '24px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ marginTop: 0, textAlign: 'center', letterSpacing: '-0.02em', color: COLORS.textLight }}>{numpad.label}</h3>
              <div className="num-tabular" style={{ background: COLORS.bg, padding: '18px', fontSize: '2.4rem', textAlign: 'right', borderRadius: '14px', marginBottom: '18px', fontWeight: 'bold', minHeight: '42px', border: `1px solid ${COLORS.border}` }}>
                {numpad.value || '0'} {numpad.mode === 'remise_globale' ? '%' : 'DH'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', 'DEL'].map(btn => (
                  <button key={btn} className="pos-btn num-tabular" onClick={() => handleNumpadKey(btn)} style={{ padding: '18px', fontSize: '1.6rem', fontWeight: 'bold', borderRadius: '14px', border: `1px solid ${COLORS.border}`, background: btn === 'DEL' ? '#FEE2E2' : 'white', color: btn === 'DEL' ? COLORS.danger : COLORS.textMain, cursor: 'pointer' }}>{btn}</button>
                ))}
                <button className="pos-btn" onClick={() => handleNumpadKey('OK')} style={{ padding: '18px', fontSize: '1.4rem', fontWeight: 'bold', borderRadius: '14px', border: 'none', background: COLORS.success, color: 'white', cursor: 'pointer' }}>OK</button>
              </div>
              <button className="pos-btn" onClick={() => setNumpad({ active: false, mode: '', targetId: null, label: '', value: '' })} style={{ marginTop: '16px', padding: '14px', background: COLORS.bg, color: COLORS.textLight, border: 'none', borderRadius: '12px', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer' }}>Annuler</button>
            </div>
          </div>
        )}

        {showRenduMonnaie.active && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(9, 9, 11, 0.85)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000 }}>
            <div className="modal-box" style={{ background: 'white', padding: '40px', borderRadius: '24px', width: '90%', maxWidth: '480px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '1.8rem', margin: '0 0 20px 0', letterSpacing: '-0.03em' }}>💵 RENDU MONNAIE</h2>
              <div className="num-tabular" style={{ fontSize: '1.35rem', color: COLORS.textLight, marginBottom: '8px' }}>Total commande : <strong style={{ color: COLORS.textMain }}>{totalCart} DH</strong></div>
              <div className="num-tabular" style={{ fontSize: '1.35rem', color: COLORS.textLight, marginBottom: '20px' }}>Somme reçue : <strong style={{ color: COLORS.textMain }}>{showRenduMonnaie.received} DH</strong></div>
              <div className="num-tabular" style={{ background: COLORS.primary, color: 'white', padding: '28px', borderRadius: '16px', fontSize: '2.6rem', fontWeight: 'bold', margin: '20px 0' }}>
                À RENDRE : {showRenduMonnaie.aRendre} DH
              </div>
              <button className="pos-btn" onClick={() => validerCommandePOS('Espèces', showRenduMonnaie.received)} style={{ width: '100%', padding: '20px', background: COLORS.success, color: 'white', border: 'none', borderRadius: '14px', fontSize: '1.35rem', fontWeight: 'bold', cursor: 'pointer' }}>✅ VALIDER L'ENCAISSEMENT</button>
              <button className="pos-btn" onClick={() => setShowRenduMonnaie({ active: false, aRendre: 0, received: 0 })} style={{ width: '100%', padding: '14px', background: 'transparent', color: COLORS.textLight, border: 'none', marginTop: '10px', cursor: 'pointer', fontSize: '1.1rem', textDecoration: 'underline' }}>Annuler (Retour caisse)</button>
            </div>
          </div>
        )}

        {customizeItem && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(9, 9, 11, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
            <div className="modal-box" style={{ background: 'white', width: '90%', maxWidth: '800px', borderRadius: '20px', padding: '24px', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
              <h2 style={{ marginTop: 0, borderBottom: `1px solid ${COLORS.border}`, paddingBottom: '14px', color: COLORS.primary, letterSpacing: '-0.02em' }}>
                Préparation : {customizeItem.produit.nom} {customizeItem.variante?.nom ? `(Taille ${customizeItem.variante.nom})` : ''}
              </h2>

              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
                {customizeItem.produit.categorie === 'Burgers' && (
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '1.05rem', marginBottom: '10px', color: COLORS.danger }}>🚫 Exclusions (Sans...)</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      {EXCLUSIONS_BURGER.map((exc, idx) => {
                        const isSelected = customOptions.exclusions.includes(exc);
                        return (
                          <button key={idx} className="pos-btn" onClick={() => toggleArrOption('exclusions', exc)} style={{ padding: '10px 16px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', background: isSelected ? COLORS.danger : '#FEF2F2', color: isSelected ? 'white' : COLORS.danger, border: isSelected ? 'none' : `1px solid ${COLORS.danger}` }}>{exc}</button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {customizeItem.produit.categorie === 'Plats' && (
                  <div style={{ marginBottom: '20px', background: '#EEF2FF', padding: '16px', borderRadius: '12px' }}>
                    <h3 style={{ fontSize: '1.05rem', margin: '0 0 10px 0', color: '#3730A3' }}>🥗 Accompagnements ({customOptions.accompagnements.length} / 2 obligatoires)</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      {ACCOMPAGNEMENTS_PLATS.map((acc, idx) => {
                        const isSelected = customOptions.accompagnements.includes(acc);
                        const isDisabled = !isSelected && customOptions.accompagnements.length >= 2;
                        return (
                          <button key={idx} className="pos-btn" disabled={isDisabled} onClick={() => toggleArrOption('accompagnements', acc)} style={{ padding: '12px 18px', borderRadius: '10px', fontWeight: 'bold', cursor: isDisabled ? 'not-allowed' : 'pointer', background: isSelected ? '#3730A3' : '#fff', color: isSelected ? 'white' : 'black', border: '1px solid #3730A3', opacity: isDisabled ? 0.5 : 1 }}>{acc}</button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {customizeItem.produit.categorie === 'Pâtes' && (
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '1.05rem', marginBottom: '10px' }}>🍝 Type de Pâtes (Obligatoire)</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      {(parametres.stocks.pates || []).filter(p => p.available).map((pate, idx) => (
                        <button key={idx} className="pos-btn" onClick={() => setCustomOptions(prev => ({ ...prev, typePate: pate.nom }))} style={{ padding: '14px 24px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', background: customOptions.typePate === pate.nom ? COLORS.primary : COLORS.bg, color: customOptions.typePate === pate.nom ? 'white' : COLORS.textMain, border: 'none', fontSize: '1.05rem' }}>{pate.nom}</button>
                      ))}
                    </div>
                  </div>
                )}

                {customizeItem.produit.categorie === 'Pizzas' && (
                  <>
                    {(customizeItem.produit.nom.toLowerCase().includes('saison') || customizeItem.produit.nom.toLowerCase().includes('moitié')) && (
                      <div style={{ marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '1.05rem', marginBottom: '10px' }}>🍕 Choix des garnitures</h3>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                          {(parametres.stocks.garnitures || []).filter(opt => opt.available).map((opt, idx) => (
                            <button key={idx} className="pos-btn" onClick={() => toggleArrOption('garnitures', opt.nom)} style={{ padding: '10px 16px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', background: customOptions.garnitures.includes(opt.nom) ? COLORS.primary : COLORS.bg, color: customOptions.garnitures.includes(opt.nom) ? 'white' : COLORS.textMain, border: 'none' }}>{opt.nom}</button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{ marginBottom: '20px' }}>
                      <h3 style={{ fontSize: '1.05rem', marginBottom: '10px' }}>🧀 Bords Fourrés</h3>
                      <button className="pos-btn num-tabular" onClick={() => setCustomOptions(p => ({ ...p, cheesyCrust: !p.cheesyCrust }))} style={{ width: '100%', padding: '16px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1.1rem', display: 'flex', justifyContent: 'space-between', background: customOptions.cheesyCrust ? COLORS.promo : COLORS.bg, color: customOptions.cheesyCrust ? 'white' : COLORS.textMain, border: 'none' }}>
                        <span>Cheesy Crust</span>
                        <span>+ {customizeItem.variante?.nom === 'L' ? 25 : 15} DH</span>
                      </button>
                    </div>
                  </>
                )}

                {['Pizzas', 'Pâtes', 'Plats'].includes(customizeItem.produit.categorie) && (
                  <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '1.05rem', marginBottom: '10px' }}>➕ Extras (Payants)</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                      {Object.keys(EXTRAS_BASE).map(ext => {
                        const isPizzaL = (customizeItem.produit.categorie === 'Pizzas' && customizeItem.variante?.nom === 'L');
                        const price = isPizzaL ? Math.round(EXTRAS_BASE[ext] * 1.7) : EXTRAS_BASE[ext];
                        return (
                          <button key={ext} className="pos-btn num-tabular" onClick={() => toggleArrOption('extras', ext)} style={{ padding: '14px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', background: customOptions.extras.includes(ext) ? COLORS.success : COLORS.bg, color: customOptions.extras.includes(ext) ? 'white' : COLORS.textMain, border: 'none' }}>
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
                        <div style={{ marginBottom: '20px', background: '#FEF3C7', padding: '16px', borderRadius: '12px' }}>
                          <h3 style={{ fontSize: '1.05rem', margin: '0 0 10px 0', color: '#92400E' }}>🥩 Choix des Viandes ({customOptions.viandes.length} / {maxV} obligatoires)</h3>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                            {(parametres.stocks.viandes || []).filter(opt => opt.available).map((opt, idx) => {
                              const isSelected = customOptions.viandes.includes(opt.nom);
                              const isDisabled = !isSelected && customOptions.viandes.length >= maxV;
                              return (
                                <button key={idx} className="pos-btn" disabled={isDisabled} onClick={() => toggleArrOption('viandes', opt.nom)} style={{ padding: '10px 16px', borderRadius: '10px', fontWeight: 'bold', cursor: isDisabled ? 'not-allowed' : 'pointer', background: isSelected ? '#92400E' : '#fff', color: isSelected ? 'white' : 'black', border: '1px solid #D97706', opacity: isDisabled ? 0.5 : 1 }}>{opt.nom}</button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                    <div style={{ marginBottom: '20px' }}>
                      <h3 style={{ fontSize: '1.05rem', marginBottom: '10px' }}>🥣 Sauces (Incluses)</h3>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {(parametres.stocks.sauces || []).filter(opt => opt.available).map((opt, idx) => (
                          <button key={idx} className="pos-btn" onClick={() => toggleArrOption('sauces', opt.nom)} style={{ padding: '10px 16px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', background: customOptions.sauces.includes(opt.nom) ? COLORS.secondary : COLORS.bg, color: customOptions.sauces.includes(opt.nom) ? 'white' : COLORS.textMain, border: 'none' }}>{opt.nom}</button>
                        ))}
                      </div>
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                      <h3 style={{ fontSize: '1.05rem', marginBottom: '10px' }}>➕ Extras & Gratinage</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                        {Object.keys(TACOS_EXTRAS).map(ext => (
                          <button key={ext} className="pos-btn num-tabular" onClick={() => toggleArrOption('extras', ext)} style={{ padding: '14px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', background: customOptions.extras.includes(ext) ? COLORS.success : COLORS.bg, color: customOptions.extras.includes(ext) ? 'white' : COLORS.textMain, border: 'none' }}>
                            <span>{ext}</span><span>+ {TACOS_EXTRAS[ext]} DH</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px', borderTop: `1px solid ${COLORS.border}`, paddingTop: '16px' }}>
                <button className="pos-btn" onClick={() => setCustomizeItem(null)} style={{ flex: 1, padding: '15px', background: COLORS.bg, color: COLORS.textLight, borderRadius: '12px', border: 'none', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}>Annuler</button>
                <button className="pos-btn" onClick={validerEtAjouter} style={{ flex: 2, padding: '15px', background: COLORS.success, color: 'white', borderRadius: '12px', border: 'none', fontSize: '1.15rem', fontWeight: 'bold', cursor: 'pointer' }}>✅ Ajouter au panier</button>
              </div>
            </div>
          </div>
        )}

        <div className="no-print" style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: COLORS.bg }}>
          {/* COLONNE GAUCHE : CATALOGUE & ACTIONS POS */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px', height: '100%', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '14px 18px', borderRadius: '14px', marginBottom: '12px', flexShrink: 0, border: `1px solid ${COLORS.border}` }}>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <h2 style={{ margin: 0, color: COLORS.primary, letterSpacing: '-0.03em' }}>🍔 Foodji POS</h2>
                <span style={{ background: '#EEF2FF', color: '#3730A3', padding: '6px 12px', borderRadius: '999px', fontWeight: 'bold', fontSize: '0.85rem' }}>👤 {sessionCaisse.caissiere}</span>

                {commandesWebEnAttente > 0 && (
                  <button onClick={() => setAppMode('ADMIN')} className="blink-alert pos-btn" style={{ background: COLORS.danger, color: 'white', border: 'none', borderRadius: '10px', padding: '8px 14px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(239,68,68,0.35)' }}>
                    🔴 {commandesWebEnAttente} WEB EN ATTENTE
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button className="pos-btn num-tabular" onClick={() => openPromoTacosBuilder('L')} style={{ padding: '10px 14px', background: COLORS.promo, color: 'white', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                  🌮 Promo Tacos (55 / 89 DH)
                </button>

                <select onChange={handleRuptureRapide} value="" style={{ padding: '10px 14px', background: '#FEF2F2', color: COLORS.danger, borderRadius: '10px', border: `1px solid ${COLORS.danger}`, cursor: 'pointer', fontWeight: 'bold', outline: 'none' }}>
                  <option value="" disabled>🔴 Rupture Rapide...</option>
                  {STOCK_TABS.map(tab => (
                    <optgroup key={tab.id} label={tab.label}>
                      {(parametres.stocks[tab.id] || []).filter(i => i.available).map(item => (
                        <option key={item.nom} value={`${tab.id}|${item.nom}`}>{item.nom}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <button className="pos-btn" onClick={() => openNumpad('depense', 'Montant du décaissement')} style={{ padding: '10px 14px', background: '#FEF3C7', color: '#92400E', borderRadius: '10px', border: '1px solid #F59E0B', cursor: 'pointer', fontWeight: 'bold' }}>💸 Sortie</button>
                <button className="pos-btn" onClick={cloturerShift} style={{ padding: '10px 14px', background: COLORS.warning, color: 'white', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>🛑 Fin Shift</button>
                <button className="pos-btn" onClick={() => setAppMode('ADMIN')} style={{ padding: '10px 14px', background: COLORS.secondary, color: 'white', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>⚙️ BACK-OFFICE</button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '10px', flexShrink: 0, scrollbarWidth: 'none' }}>
              {TOUTES_CATEGORIES.map(c => (
                <button key={c} className="pos-btn" onClick={() => setPosCategory(c)} style={{ padding: '12px 22px', fontSize: '1.05rem', fontWeight: 'bold', borderRadius: '12px', border: posCategory === c ? 'none' : `1px solid ${COLORS.border}`, background: posCategory === c ? COLORS.primary : 'white', color: posCategory === c ? 'white' : COLORS.textMain, cursor: 'pointer', flexShrink: 0 }}>{c}</button>
              ))}
            </div>

            {/* BANNIÈRE D'ACCÈS RAPIDE PROMO TACOS DANS L'ONGLET TACOS */}
            {posCategory === 'Tacos' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '10px', marginBottom: '12px', flexShrink: 0 }}>
                <button className="pos-btn num-tabular" onClick={() => openPromoTacosBuilder('L')} style={{ padding: '14px 18px', borderRadius: '14px', border: `2px solid ${COLORS.promo}`, background: '#FFFBEB', color: '#92400E', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.05rem' }}>🔥 PACK 2 TACOS L (Sans Frites)</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>Option +15 DH : Frites + Boisson 1L</div>
                  </div>
                  <span style={{ background: COLORS.promo, color: 'white', padding: '6px 12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '1.15rem' }}>55 DH</span>
                </button>

                <button className="pos-btn num-tabular" onClick={() => openPromoTacosBuilder('XL')} style={{ padding: '14px 18px', borderRadius: '14px', border: `2px solid ${COLORS.primary}`, background: '#FEF2F2', color: '#991B1B', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', textAlign: 'left' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.05rem' }}>🔥 PACK 2 TACOS XL (Sans Frites)</div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>Option +15 DH : Frites + Boisson 1L</div>
                  </div>
                  <span style={{ background: COLORS.primary, color: 'white', padding: '6px 12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '1.15rem' }}>89 DH</span>
                </button>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))', gap: '10px' }}>
              {menu.filter(p => p.categorie === posCategory && p.available !== false).map(p => (
                <div key={p.id} className="pos-card" style={{ background: 'white', borderRadius: '14px', overflow: 'hidden', border: `1px solid ${COLORS.border}` }}>
                  {p.variantes?.length > 0 ? (
                    <div style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 'bold', textAlign: 'center', marginBottom: '10px', fontSize: '1.05rem', letterSpacing: '-0.01em' }}>{p.nom}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {p.variantes.filter(v => v.available !== false).map((v, i) => (
                          <button key={i} className="pos-btn num-tabular" onClick={(e) => { e.stopPropagation(); triggerAddToCart(p, v); }} style={{ padding: '10px 12px', background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', color: COLORS.textMain }}>
                            <span>{v.nom}</span> <span style={{ color: COLORS.primary }}>{v.prix} DH</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="pos-btn" onClick={() => triggerAddToCart(p)} style={{ padding: '22px 12px', textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', cursor: 'pointer', boxSizing: 'border-box' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '1.05rem', letterSpacing: '-0.01em' }}>{p.nom}</div>
                      <div className="num-tabular" style={{ color: COLORS.primary, fontWeight: 'bold', marginTop: '6px', fontSize: '1.2rem' }}>{p.prix} DH</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* COLONNE DROITE : PANIER DE COMMANDE EN DARK UI (ZINC 950 / 900) */}
          <div style={{ width: '420px', flexShrink: 0, background: COLORS.darkBg, color: '#FAFAFA', display: 'flex', flexDirection: 'column', height: '100%', borderLeft: `1px solid ${COLORS.darkBorder}` }}>
            {/* EN-TÊTE CLIENT & TYPE DE COMMANDE */}
            <div style={{ padding: '14px', background: COLORS.darkCard, color: 'white', flexShrink: 0, borderBottom: `1px solid ${COLORS.darkBorder}` }}>
              <div style={{ display: 'flex', gap: '4px', marginBottom: '12px', background: '#09090B', padding: '4px', borderRadius: '10px', border: `1px solid ${COLORS.darkBorder}` }}>
                <button className="pos-btn" onClick={() => setPosOrderType('sur_place')} style={{ flex: 1, padding: '8px', borderRadius: '7px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: posOrderType === 'sur_place' ? COLORS.success : 'transparent', color: posOrderType === 'sur_place' ? 'white' : '#A1A1AA' }}>Sur Place</button>
                <button className="pos-btn" onClick={() => setPosOrderType('emporter')} style={{ flex: 1, padding: '8px', borderRadius: '7px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: posOrderType === 'emporter' ? COLORS.promo : 'transparent', color: posOrderType === 'emporter' ? 'white' : '#A1A1AA' }}>Emporter</button>
                <button className="pos-btn" onClick={() => setPosOrderType('livraison')} style={{ flex: 1, padding: '8px', borderRadius: '7px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: posOrderType === 'livraison' ? COLORS.blue : 'transparent', color: posOrderType === 'livraison' ? 'white' : '#A1A1AA' }}>Livraison</button>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input type="tel" className="num-tabular" placeholder="Tél (06...)" value={posPhone} onChange={e => handlePhoneInput(e.target.value)} style={{ width: '100%', padding: '11px', borderRadius: '8px', border: `2px solid ${COLORS.blue}`, background: '#09090B', color: '#FAFAFA', fontSize: '1.05rem', boxSizing: 'border-box', fontWeight: 'bold' }} />
                  {clientActif && clientActif.totalCommandes >= 10 && (
                    <span style={{ position: 'absolute', right: '8px', top: '10px', background: COLORS.promo, color: 'white', padding: '2px 8px', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.75rem' }}>⭐ VIP</span>
                  )}
                </div>
                <select value={posBipeur} onChange={e => setPosBipeur(e.target.value)} style={{ width: '96px', padding: '11px', borderRadius: '8px', border: `1px solid ${COLORS.darkBorder}`, background: '#27272A', color: '#FAFAFA', fontSize: '0.95rem', fontWeight: 'bold', cursor: 'pointer' }}>
                  <option value="">Bipeur</option>
                  {Array.from({ length: 20 }, (_, i) => <option key={i + 1} value={i + 1}>N° {i + 1}</option>)}
                </select>
              </div>

              <input type="text" placeholder="Nom Client (Auto si fidèle)" value={posClientName} onChange={e => setPosClientName(e.target.value)} style={{ width: '100%', padding: '11px', borderRadius: '8px', border: `1px solid ${COLORS.darkBorder}`, background: '#27272A', color: '#FAFAFA', marginBottom: posOrderType === 'livraison' ? '8px' : '0', fontSize: '0.95rem', boxSizing: 'border-box' }} />

              {posOrderType === 'livraison' && (
                <input type="text" placeholder="Adresse complète de livraison" value={posAddress} onChange={e => setPosAddress(e.target.value)} style={{ width: '100%', padding: '11px', borderRadius: '8px', border: `1px solid ${COLORS.darkBorder}`, background: '#27272A', color: '#FAFAFA', fontSize: '0.95rem', boxSizing: 'border-box' }} />
              )}
            </div>

            {/* LISTE DES ARTICLES CHOISIS (FOND SOMBRE #09090B & CARTES #18181B) */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px', background: COLORS.darkBg }}>
              {posCart.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#71717A', marginTop: '60px', fontSize: '1.05rem', padding: '24px', border: `1px dashed ${COLORS.darkBorder}`, borderRadius: '12px' }}>
                  Aucun article dans le panier
                </div>
              ) : null}

              {posCart.map(item => (
                <div key={item.idCart} style={{ padding: '12px', border: `1px solid ${COLORS.darkBorder}`, background: COLORS.darkCard, borderRadius: '12px', marginBottom: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.25)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '8px' }}>
                    <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => openNumpad('prix_article', `Modifier prix unitaire : ${item.nom}`, item.idCart)}>
                      <div style={{ fontWeight: 'bold', fontSize: '1rem', color: item.isPrixModifie ? '#FBBF24' : '#FAFAFA' }}>{item.nom}</div>
                      {item.detailsTxt?.length > 0 && (
                        <div style={{ fontSize: '0.85rem', color: '#A1A1AA', marginTop: '6px', paddingLeft: '6px' }}>
                          {item.detailsTxt.map((txt, j) => (
                            <div key={j} style={{ color: txt.includes('🚫') ? '#F87171' : txt.includes('🍟🥤') ? '#34D399' : '#A1A1AA', fontWeight: (txt.includes('🚫') || txt.includes('🍟🥤')) ? 'bold' : 'normal', marginBottom: '2px' }}>
                              • {txt}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="num-tabular" style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#FB923C', cursor: 'pointer', display: 'block' }} onClick={() => openNumpad('prix_article', `Modifier prix : ${item.nom}`, item.idCart)}>{item.prixFinal * item.qte} DH</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', background: '#27272A', border: '1px solid #3F3F46', borderRadius: '8px', overflow: 'hidden' }}>
                      <button className="pos-btn" onClick={() => modifierQuantite(item.idCart, -1)} style={{ padding: '4px 14px', fontSize: '1.1rem', fontWeight: 'bold', border: 'none', background: 'transparent', color: '#FAFAFA', cursor: 'pointer' }}>-</button>
                      <span className="num-tabular" style={{ padding: '0 10px', fontWeight: 'bold', fontSize: '1rem', color: '#FAFAFA' }}>{item.qte}</span>
                      <button className="pos-btn" onClick={() => modifierQuantite(item.idCart, 1)} style={{ padding: '4px 14px', fontSize: '1.1rem', fontWeight: 'bold', border: 'none', background: 'transparent', color: '#FAFAFA', cursor: 'pointer' }}>+</button>
                    </div>
                    <button className="pos-btn" onClick={() => removeFromCart(item.idCart)} style={{ background: 'rgba(239, 68, 68, 0.18)', color: '#F87171', border: '1px solid rgba(239, 68, 68, 0.35)', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>🗑️</button>
                  </div>
                </div>
              ))}

              {/* BOUTON RAPIDE +15 DH FRITES & BOISSON 1L SI PROMO TACOS DÉTECTÉE DANS LE PANIER */}
              {promoTacosDiscount > 0 && (
                <button
                  className="pos-btn num-tabular"
                  onClick={ajouterOptionFritesBoissonPromo}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px dashed #F59E0B',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#FBBF24',
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    marginTop: '4px'
                  }}
                >
                  🍟🥤 + Rajouter Frites & Boisson 1L (+15 DH)
                </button>
              )}
            </div>

            {/* PIED DE CAISSE SOMBRE */}
            <div style={{ padding: '16px', borderTop: `1px solid ${COLORS.darkBorder}`, background: COLORS.darkCard, flexShrink: 0 }}>
              <textarea placeholder="Note cuisine / client..." value={posNote} onChange={e => setPosNote(e.target.value)} rows={2} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: `1px solid ${COLORS.darkBorder}`, background: '#27272A', color: '#FAFAFA', marginBottom: '12px', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />

              <div className="num-tabular" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '0.95rem', color: '#A1A1AA' }}>
                <span>Sous-total</span><span>{sousTotalCart} DH</span>
              </div>

              {fraisLivraison > 0 && (
                <div className="num-tabular" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '0.95rem', color: '#60A5FA', fontWeight: 'bold' }}>
                  <span>Frais de livraison</span><span>+ {fraisLivraison} DH</span>
                </div>
              )}

              {promoDimancheDiscount > 0 && (
                <div className="num-tabular" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '0.95rem', color: '#34D399', fontWeight: 'bold' }}>
                  <span>🎁 Promo Dimanche (3ème Pizza)</span><span>- {promoDimancheDiscount} DH</span>
                </div>
              )}

              {promoTacosDiscount > 0 && (
                <div className="num-tabular" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '0.95rem', color: '#FBBF24', fontWeight: 'bold' }}>
                  <span>🌮 Promo Tacos (Sans frites)</span><span>- {promoTacosDiscount} DH</span>
                </div>
              )}

              {promoDuoDiscount > 0 && (
                <div className="num-tabular" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '0.95rem', color: '#34D399', fontWeight: 'bold' }}>
                  <span>🎁 Promo Duo (-50%)</span><span>- {promoDuoDiscount} DH</span>
                </div>
              )}

              {montantRemiseGlobale > 0 && (
                <div className="num-tabular" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '0.95rem', color: '#F87171', fontWeight: 'bold' }}>
                  <span>Remise manuelle ({remiseGlobale}%)</span><span>- {montantRemiseGlobale} DH</span>
                </div>
              )}

              {remiseCRM > 0 && (
                <div className="num-tabular" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '0.95rem', color: '#34D399', fontWeight: 'bold' }}>
                  <span>Remise Fidélité ({clientActif.remiseAuto}%)</span><span>- {remiseCRM} DH</span>
                </div>
              )}

              <div className="num-tabular" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '10px 0 14px 0', fontSize: '1.75rem', fontWeight: 'bold', letterSpacing: '-0.02em', color: '#FAFAFA' }}>
                <span>TOTAL</span>
                <span style={{ color: '#FB923C' }}>{totalCart} DH</span>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                {posOrderType === 'livraison' ? (
                  <button className="pos-btn" onClick={() => validerCommandePOS('En attente', null, 'En Livraison')} disabled={loading || posCart.length === 0} style={{ flex: 2, padding: '16px 10px', background: COLORS.blue, color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', opacity: posCart.length === 0 ? 0.5 : 1 }}>🛵 DÉPART LIVREUR</button>
                ) : (
                  <button className="pos-btn" onClick={() => setShowCashOptions(true)} disabled={loading || posCart.length === 0} style={{ flex: 2, padding: '16px 10px', background: COLORS.success, color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer', opacity: posCart.length === 0 ? 0.5 : 1 }}>💵 ENCAISSER</button>
                )}
                <button className="pos-btn" onClick={() => openNumpad('remise_globale', 'Remise globale (%)')} disabled={loading || posCart.length === 0} style={{ flex: 1, padding: '16px 10px', background: '#27272A', color: '#FBBF24', border: '1px solid #3F3F46', borderRadius: '12px', fontSize: '0.95rem', fontWeight: 'bold', cursor: 'pointer', opacity: posCart.length === 0 ? 0.5 : 1 }}>🎁 REMISE %</button>
              </div>

              <button className="pos-btn" onClick={() => { if (window.confirm("Vider entièrement le panier ?")) { setPosCart([]); setRemiseGlobale(0); setClientActif(null); setPosBipeur(''); } }} style={{ width: '100%', padding: '12px', background: 'rgba(239, 68, 68, 0.15)', color: '#F87171', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.95rem' }}>🗑️ Vider le panier</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {renderTickets()}
      <div className="no-print" style={{ background: COLORS.bg, minHeight: '100vh', paddingBottom: '100px', color: COLORS.textMain }}>
        <div style={{ padding: '24px', maxWidth: '1240px', margin: '0 auto' }}>

          <div style={{ marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, letterSpacing: '-0.03em', fontSize: '1.75rem' }}>⚙️ Administration Foodji</h2>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button className="pos-btn" onClick={() => setShowPromoManager(!showPromoManager)} style={{ padding: '10px 14px', borderRadius: '10px', border: 'none', background: COLORS.promo, color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>🎁 GESTION PROMOS</button>
              <button className="pos-btn" onClick={() => setShowHistory(!showHistory)} style={{ padding: '10px 14px', borderRadius: '10px', border: `1px solid ${COLORS.secondary}`, background: showHistory ? COLORS.secondary : 'white', color: showHistory ? 'white' : COLORS.secondary, fontWeight: 'bold', cursor: 'pointer' }}>🕒 Historique</button>
              <button className="pos-btn" onClick={() => setShowBilanGlobal(true)} style={{ padding: '10px 14px', borderRadius: '10px', border: 'none', background: COLORS.blue, color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>📊 Bilan (Z)</button>
              <button className="pos-btn" onClick={() => setAppMode('POS')} style={{ padding: '10px 16px', borderRadius: '10px', border: 'none', background: COLORS.primary, color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>🍔 OUVRIR LA CAISSE</button>
              <button className="pos-btn" onClick={() => auth.signOut()} style={{ padding: '10px 14px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, background: 'white', cursor: 'pointer', fontWeight: '500' }}>Déconnexion</button>
            </div>
          </div>

          {commandesEnLivraison.length > 0 && (
            <div style={{ background: '#FEF2F2', padding: '20px', borderRadius: '16px', marginBottom: '32px', border: `2px solid ${COLORS.danger}` }}>
              <h3 style={{ marginTop: 0, color: COLORS.danger, fontSize: '1.2rem', letterSpacing: '-0.02em' }}>🛵 RETOURS LIVREURS EN ATTENTE D'ENCAISSEMENT ({commandesEnLivraison.length})</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '14px' }}>
                {commandesEnLivraison.map(cmd => (
                  <div key={cmd.id} style={{ background: 'white', borderRadius: '12px', padding: '16px', borderLeft: `5px solid ${COLORS.blue}`, boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div>
                        <strong style={{ fontSize: '1.1rem' }}>{cmd.client}</strong>
                        <div style={{ color: COLORS.textLight, fontSize: '0.9rem' }}>{cmd.adresse || 'Adresse non spécifiée'}</div>
                      </div>
                      <div className="num-tabular" style={{ textAlign: 'right', fontSize: '1.4rem', fontWeight: 'bold', color: COLORS.primary }}>
                        {cmd.total} DH
                      </div>
                    </div>
                    <button className="pos-btn" onClick={() => encaisserRetourLivreur(cmd)} style={{ width: '100%', padding: '12px', background: COLORS.success, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1.05rem' }}>
                      ✅ ENCAISSER LES ESPÈCES
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showPromoManager && (
            <div style={{ background: 'white', padding: '24px', borderRadius: '16px', marginBottom: '28px', border: `2px solid ${COLORS.promo}` }}>
              <h3 style={{ marginTop: 0, color: COLORS.promo }}>🎁 Module Deals & Offres Spéciales</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '16px' }}>
                <div style={{ background: '#FFFBEB', padding: '16px', borderRadius: '12px', border: '1px solid #FEF3C7' }}>
                  <h4 style={{ marginTop: 0 }}>➕ Créer un nouveau Deal</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input placeholder="Nom du Deal (ex: Offre Tacos)" value={formPromo.titre} onChange={e => setFormPromo({ ...formPromo, titre: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }} />
                    <input placeholder="Description (ex: 2 Tacos L 55 DH / 2 XL 89 DH sans frites)" value={formPromo.description} onChange={e => setFormPromo({ ...formPromo, description: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }} />
                    <input type="number" placeholder="Prix du Pack complet (DH)" value={formPromo.prix} onChange={e => setFormPromo({ ...formPromo, prix: e.target.value })} style={{ padding: '10px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }} />
                    <button className="pos-btn" onClick={savePromotion} style={{ padding: '12px', background: COLORS.promo, color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Mettre en ligne l'offre</button>
                  </div>
                </div>

                <div>
                  <h4 style={{ marginTop: 0 }}>📋 Statut des Promos Actuelles</h4>
                  <div style={{ maxHeight: '220px', overflowY: 'auto', border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '10px' }}>
                    {promotions.map(promo => (
                      <div key={promo.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: promo.status ? '#F0FDF4' : '#FEF2F2', borderRadius: '8px', marginBottom: '6px' }}>
                        <div>
                          <strong>{promo.titre}</strong>
                          <div className="num-tabular" style={{ fontSize: '0.85rem', color: COLORS.textLight }}>{promo.prix} DH</div>
                        </div>
                        <button className="pos-btn" onClick={() => togglePromoStatus(promo.id, promo.status)} style={{ padding: '8px 12px', border: 'none', borderRadius: '8px', background: promo.status ? COLORS.success : COLORS.danger, color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
                          {promo.status ? '🟢 ACTIF' : '🔴 COUPÉ'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <button className="pos-btn" onClick={() => setShowPromoManager(false)} style={{ background: COLORS.bg, border: 'none', padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>Fermer le module</button>
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', marginBottom: '24px', background: 'white', padding: '16px 20px', borderRadius: '14px', alignItems: 'center', border: `1px solid ${COLORS.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <strong style={{ color: COLORS.textLight }}>Service :</strong>
              <button className="pos-btn" onClick={() => updateDoc(doc(db, "parametres", "horaires"), { isOuvert: true })} style={{ padding: '8px 14px', borderRadius: '8px', background: parametres.isOuvert ? COLORS.success : COLORS.bg, color: parametres.isOuvert ? 'white' : COLORS.textMain, border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>🟢 OUVERT</button>
              <button className="pos-btn" onClick={() => updateDoc(doc(db, "parametres", "horaires"), { isOuvert: false })} style={{ padding: '8px 14px', borderRadius: '8px', background: !parametres.isOuvert ? COLORS.danger : COLORS.bg, color: !parametres.isOuvert ? 'white' : COLORS.textMain, border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>🔴 FERMÉ</button>
            </div>
            <div style={{ width: '1px', height: '28px', background: COLORS.border }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <strong style={{ color: COLORS.textLight }}>Mode Cuisine :</strong>
              <select value={parametres.rushMode} onChange={(e) => updateDoc(doc(db, "parametres", "status"), { mode: e.target.value })} style={{ padding: '8px 12px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, fontWeight: 'bold', outline: 'none', cursor: 'pointer' }}>
                <option value="standard">✅ Standard</option>
                <option value="rush">⚠️ Rush (30min+)</option>
                <option value="gros_rush">🔥 Gros Rush (1h+)</option>
              </select>
            </div>
            <div style={{ width: '1px', height: '28px', background: COLORS.border }}></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <strong style={{ color: COLORS.textLight }}>Promotions POS :</strong>
              <button className="pos-btn" onClick={togglePromoTacosAdmin} style={{ padding: '8px 14px', borderRadius: '8px', background: parametres.promoTacosActive ? COLORS.success : COLORS.bg, color: parametres.promoTacosActive ? 'white' : COLORS.textMain, border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                {parametres.promoTacosActive ? '🟢 TACOS (2L=55 / 2XL=89)' : '🔴 TACOS (2L=55 / 2XL=89)'}
              </button>
              <button className="pos-btn" onClick={togglePromoDuoAdmin} style={{ padding: '8px 14px', borderRadius: '8px', background: parametres.promoDuoActive ? COLORS.success : COLORS.bg, color: parametres.promoDuoActive ? 'white' : COLORS.textMain, border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                {parametres.promoDuoActive ? '🟢 DUO (-50%)' : '🔴 DUO (-50%)'}
              </button>
              <button className="pos-btn" onClick={togglePromoDimancheAdmin} style={{ padding: '8px 14px', borderRadius: '8px', background: parametres.promoDimancheActive ? COLORS.success : COLORS.bg, color: parametres.promoDimancheActive ? 'white' : COLORS.textMain, border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>
                {parametres.promoDimancheActive ? '🟢 DIMANCHE (3ème Offert)' : '🔴 DIMANCHE (3ème Offert)'}
              </button>
            </div>
          </div>

          {showBilanGlobal && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(9, 9, 11, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 4000 }}>
              <div className="modal-box" style={{ background: 'white', padding: '30px', borderRadius: '20px', width: '90%', maxWidth: '460px' }}>
                <h2 style={{ marginTop: 0, textAlign: 'center', color: COLORS.danger, letterSpacing: '-0.02em' }}>📊 BILAN JOURNÉE (Z)</h2>
                <p style={{ textAlign: 'center', color: COLORS.textLight, fontSize: '0.9rem' }}>
                  Depuis {serviceGlobal.lastZDate ? toJSDate(serviceGlobal.lastZDate).toLocaleString() : 'le début de service (06:00)'}
                </p>
                <hr style={{ border: 'none', borderTop: `1px solid ${COLORS.border}`, margin: '18px 0' }} />
                {(() => {
                  const bilan = genererBilanGlobalZ();
                  if (!bilan) return <p>Aucune donnée disponible.</p>;
                  return (
                    <div className="num-tabular">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '1.15rem' }}><span>Espèces encaissées :</span> <strong>{bilan.totalEspeces} DH</strong></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '1.15rem', color: COLORS.textLight }}><span>Livr. Web / Autres :</span> <strong>{bilan.totalLivrApp} DH</strong></div>
                      {bilan.totalEnLivraison > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '1.1rem', color: COLORS.warning, fontWeight: 'bold' }}><span>🛵 En cours chez livreurs :</span> <span>{bilan.totalEnLivraison} DH</span></div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '1.15rem', color: COLORS.danger }}><span>Décaissements :</span> <strong>- {bilan.totalDépenses} DH</strong></div>
                      <hr style={{ border: 'none', borderTop: `1px solid ${COLORS.border}`, margin: '12px 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '1rem', color: COLORS.textLight }}><span>Fonds de Caisse initial :</span> <strong>+ {bilan.fondsInitial} DH</strong></div>
                      <hr style={{ border: 'none', borderTop: `1px solid ${COLORS.border}`, margin: '12px 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.5rem', color: COLORS.primary }}><span>TIROIR ATTENDU :</span> <strong>{bilan.netEnCaisse} DH</strong></div>
                      <div style={{ textAlign: 'center', marginTop: '12px', color: COLORS.textLight, fontSize: '0.9rem' }}>Commandes clôturées : {bilan.nbCommandes}</div>
                    </div>
                  );
                })()}
                <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button className="pos-btn" onClick={cloturerZDefinitif} style={{ width: '100%', padding: '16px', background: COLORS.danger, color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer' }}>🖨️ IMPRIMER Z ET REMETTRE À ZÉRO</button>
                  <button className="pos-btn" onClick={() => setShowBilanGlobal(false)} style={{ width: '100%', padding: '14px', background: COLORS.bg, color: COLORS.textMain, border: 'none', borderRadius: '12px', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer' }}>Fermer</button>
                </div>
              </div>
            </div>
          )}

          {showHistory ? (
            <div style={{ background: 'white', padding: '24px', borderRadius: '16px', marginBottom: '40px', border: `1px solid ${COLORS.border}` }}>
              <h3 style={{ marginTop: 0, color: COLORS.secondary }}>🕒 50 Dernières Commandes</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
                {commandes.filter(c => c.status === 'Terminé' || c.status === 'En Livraison' || c.status === 'Annulé').slice(0, 50).map(cmd => (
                  <div key={cmd.id} style={{ border: `1px solid ${COLORS.border}`, borderRadius: '12px', padding: '16px', opacity: cmd.status === 'Annulé' ? 0.65 : 1, background: cmd.status === 'Annulé' ? '#FEF2F2' : COLORS.bg }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${COLORS.border}`, paddingBottom: '10px', marginBottom: '10px' }}>
                      <div>
                        <strong>{cmd.client}</strong>
                        <div style={{ fontSize: '0.8rem', color: COLORS.textLight }}>{toJSDate(cmd.date).toLocaleString()}</div>
                        {cmd.caissiere && <div style={{ fontSize: '0.8rem', color: COLORS.primary, fontWeight: '500' }}>Opérateur : {cmd.caissiere}</div>}
                      </div>
                      <div className="num-tabular" style={{ textAlign: 'right' }}>
                        <strong style={{ color: COLORS.primary, fontSize: '1.1rem' }}>{cmd.total} DH</strong>
                        <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: cmd.status === 'Annulé' ? COLORS.danger : COLORS.success }}>{cmd.status}</div>
                      </div>
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.9rem' }}>
                      {cmd.items?.map((it, i) => {
                        const details = getDetaisImpression(it);
                        return (
                          <li key={i} style={{ borderBottom: `1px dashed ${COLORS.border}`, padding: '5px 0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span>{it.qte > 1 ? `${it.qte}x ` : ''}{it.nom}</span>
                            </div>
                            {details.length > 0 && <div style={{ color: COLORS.textLight, fontSize: '0.8rem', marginTop: '2px' }}>{details.join(' / ')}</div>}
                          </li>
                        );
                      })}
                    </ul>
                    <div style={{ marginTop: '14px' }}>
                      <button className="pos-btn" onClick={() => imprimerCommandeExistante(cmd)} style={{ width: '100%', padding: '10px', background: COLORS.secondary, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>🖨️ RÉ-IMPRIMER LE TICKET</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <h3 style={{ marginBottom: '14px', letterSpacing: '-0.02em' }}>Commandes en Cuisine ({commandesWebEnAttente})</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px', marginBottom: '36px' }}>
                {commandes.filter(c => c.status === 'En attente' || c.status === 'En cours de validation').map(cmd => (
                  <div key={cmd.id} style={{ background: 'white', borderRadius: '16px', padding: '16px', borderLeft: `5px solid ${COLORS.pending}`, border: `1px solid ${COLORS.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', borderBottom: `1px solid ${COLORS.border}`, paddingBottom: '10px', marginBottom: '10px' }}>
                      <div>
                        <strong style={{ fontSize: '1.15rem' }}>{cmd.client || 'Client'}</strong>
                        <div className="num-tabular" style={{ color: COLORS.textLight }}>📞 {cmd.tel || 'N/A'}</div>
                        <div style={{ fontSize: '0.85rem', color: COLORS.textLight }}>{cmd.type === 'livraison' ? `🛵 Livraison : ${cmd.adresse}` : '🛍️ Emporter / Sur Place'}</div>
                      </div>
                      <div className="num-tabular" style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: COLORS.primary }}>{cmd.total} DH</div>
                        <div style={{ fontSize: '0.8rem', color: COLORS.textLight }}>{cmd.status}</div>
                      </div>
                    </div>

                    {cmd.commentaire && <div style={{ background: COLORS.warning, color: 'white', padding: '8px 12px', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 'bold', marginBottom: '10px' }}>📝 {cmd.commentaire}</div>}

                    <ul style={{ listStyle: 'none', padding: 0, marginBottom: '14px' }}>
                      {cmd.items?.map((it, i) => {
                        const details = getDetaisImpression(it);
                        return (
                          <li key={i} style={{ padding: '6px 0', borderBottom: `1px dashed ${COLORS.border}` }}>
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
                      <button className="pos-btn" onClick={() => imprimerCommandeExistante(cmd)} style={{ width: '100%', padding: '10px', background: COLORS.secondary, color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>🖨️ IMPRIMER LE TICKET</button>
                      <button className="pos-btn" onClick={() => changerStatus(cmd, cmd.type === 'livraison' ? 'En Livraison' : 'Terminé')} style={{ flex: 1, padding: '10px', background: COLORS.success, color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                        {cmd.type === 'livraison' ? '🛵 PARTI LIVRAISON' : '✅ SERVI'}
                      </button>
                      <button className="pos-btn" onClick={() => changerStatus(cmd, 'Annulé')} style={{ flex: 1, padding: '10px', background: COLORS.danger, color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>❌ ANNULER</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* GESTION DES STOCKS (SANS LE BOUTON RÉPARER PIZZAS) */}
          <div style={{ background: 'white', padding: '24px', borderRadius: '16px', marginBottom: '36px', border: `1px solid ${COLORS.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ margin: 0, color: COLORS.primary, fontSize: '1.25rem', letterSpacing: '-0.02em' }}>🥕 GESTION DES STOCKS & INGRÉDIENTS</h3>
            </div>

            <div style={{ overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '8px', display: 'flex', gap: '8px', marginBottom: '18px', scrollbarWidth: 'none' }}>
              {STOCK_TABS.map(tab => (
                <button key={tab.id} className="pos-btn" onClick={() => setActiveStockTab(tab.id)} style={{ padding: '10px 18px', borderRadius: '999px', background: activeStockTab === tab.id ? COLORS.secondary : COLORS.bg, color: activeStockTab === tab.id ? 'white' : COLORS.textMain, fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>{tab.label}</button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
              <input type="text" placeholder={`Nouvel élément dans ${STOCK_TABS.find(t => t.id === activeStockTab)?.label}...`} value={newItemName} onChange={(e) => setNewItemName(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '1rem' }} />
              <button className="pos-btn" onClick={addNewStockItem} style={{ padding: '12px 20px', background: COLORS.success, color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Ajouter</button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {(parametres.stocks[activeStockTab] || []).map((item, index) => (
                <button key={index} className="pos-btn" onClick={() => toggleStockItem(activeStockTab, index)} style={{ padding: '10px 18px', borderRadius: '999px', cursor: 'pointer', fontWeight: 'bold', background: item.available ? COLORS.success : '#FEF2F2', color: item.available ? 'white' : COLORS.danger, border: item.available ? 'none' : `1px solid ${COLORS.danger}`, fontSize: '0.95rem' }}>
                  {item.nom} {item.available ? '✅' : '❌'}
                </button>
              ))}
            </div>
          </div>

          <h3 style={{ marginBottom: '14px', letterSpacing: '-0.02em' }}>📦 Gestion de la Carte (Produits)</h3>
          <div style={{ background: 'white', padding: '24px', borderRadius: '16px', marginBottom: '36px', border: `1px solid ${COLORS.border}` }}>
            <div style={{ overflowX: 'auto', display: 'flex', gap: '8px', paddingBottom: '12px', marginBottom: '14px' }}>
              {TOUTES_CATEGORIES.map(c => (
                <button key={c} className="pos-btn" onClick={() => setAdminCategorie(c)} style={{ padding: '10px 18px', borderRadius: '999px', border: 'none', background: adminCategorie === c ? COLORS.secondary : COLORS.bg, color: adminCategorie === c ? 'white' : COLORS.textMain, cursor: 'pointer', fontWeight: 'bold', flexShrink: 0 }}>{c}</button>
              ))}
            </div>

            {menu.filter(p => p.categorie === adminCategorie).map(p => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', borderBottom: `1px solid ${COLORS.border}`, background: p.available === false ? '#FEF2F2' : 'white' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <button className="pos-btn" onClick={() => toggleAvailability(p)} style={{ padding: '8px 14px', border: 'none', borderRadius: '8px', background: p.available ? COLORS.success : COLORS.danger, color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>{p.available ? 'EN LIGNE' : 'RUPTURE'}</button>
                  <div className="num-tabular" style={{ fontWeight: 'bold', fontSize: '1.05rem', textDecoration: p.available === false ? 'line-through' : 'none' }}>
                    {p.nom}
                    {p.excludeVIP && <span style={{ fontSize: '0.8rem', color: COLORS.danger, marginLeft: '6px' }}>(VIP🚫)</span>}
                    <span style={{ color: COLORS.textLight, fontWeight: 'normal', marginLeft: '6px' }}>— {p.variantes?.length > 0 ? 'Multi-tailles' : `${p.prix} DH`}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="pos-btn" onClick={() => { setEditId(p.id); setFormProd({ nom: p.nom, description: p.description || '', categorie: p.categorie, prixBase: p.prix || '', variantes: p.variantes || [], excludeVIP: p.excludeVIP || false }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} style={{ border: `1px solid ${COLORS.border}`, background: COLORS.bg, padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>✏️ Modifier</button>
                  <button className="pos-btn" onClick={() => supprimerProduit(p.id)} style={{ color: 'white', border: 'none', background: COLORS.danger, padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
                </div>
              </div>
            ))}

            <div style={{ marginTop: '28px', background: COLORS.bg, padding: '24px', borderRadius: '14px', border: `1px dashed ${COLORS.border}` }}>
              <h4 style={{ marginTop: 0 }}>{editId ? '✏️ Mettre à jour le produit' : '➕ Ajouter un Produit'}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <input placeholder="Nom du produit" value={formProd.nom} onChange={e => setFormProd({ ...formProd, nom: e.target.value })} style={{ padding: '12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '1rem' }} />

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select value={formProd.categorie} onChange={handleCategoryChange} style={{ flex: 1, padding: '12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '1rem' }}>
                    {TOUTES_CATEGORIES.map(cat => <option key={cat}>{cat}</option>)}
                  </select>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 'bold', color: COLORS.danger, padding: '10px 14px', background: '#FEF2F2', borderRadius: '10px', border: `1px solid ${COLORS.danger}` }}>
                    <input type="checkbox" checked={formProd.excludeVIP} onChange={e => setFormProd({ ...formProd, excludeVIP: e.target.checked })} style={{ width: '18px', height: '18px' }} />
                    🚫 Exclure des remises VIP
                  </label>
                </div>

                {formProd.variantes && formProd.variantes.length > 0 ? (
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {formProd.variantes.map((v, index) => (
                      <div key={index} style={{ flex: 1, minWidth: '120px', background: 'white', padding: '12px', borderRadius: '10px', border: `1px solid ${COLORS.border}` }}>
                        <label style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Taille {v.nom}</label>
                        <input type="number" className="num-tabular" placeholder="Prix DH" value={v.prix} onChange={(e) => {
                          const newVars = [...formProd.variantes];
                          newVars[index].prix = Number(e.target.value);
                          setFormProd({ ...formProd, variantes: newVars });
                        }} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${COLORS.border}`, marginTop: '6px', boxSizing: 'border-box' }} />
                        <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={v.available !== false} onChange={(e) => {
                            const newVars = [...formProd.variantes];
                            newVars[index].available = e.target.checked;
                            setFormProd({ ...formProd, variantes: newVars });
                          }} style={{ width: '16px', height: '16px' }} /> Disponible
                        </label>
                      </div>
                    ))}
                  </div>
                ) : (
                  <input type="number" className="num-tabular" placeholder="Prix unique en DH (ex: 45)" value={formProd.prixBase} onChange={e => setFormProd({ ...formProd, prixBase: e.target.value })} style={{ padding: '12px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, fontSize: '1rem' }} />
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button className="pos-btn" onClick={saveProduit} style={{ flex: 1, padding: '14px', background: COLORS.primary, color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer' }}>{editId ? 'Enregistrer les modifications' : 'Ajouter à la carte'}</button>
                  {editId && <button className="pos-btn" onClick={() => { setEditId(null); setFormProd({ nom: '', description: '', categorie: 'Panuozzo', prixBase: '', variantes: [], excludeVIP: false }); }} style={{ padding: '14px 24px', background: COLORS.textLight, color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.05rem', fontWeight: 'bold', cursor: 'pointer' }}>Annuler</button>}
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: 'white', padding: '24px', borderRadius: '16px', marginBottom: '40px', border: `1px solid ${COLORS.border}` }}>
            <h3 style={{ marginTop: 0, color: COLORS.blue, fontSize: '1.25rem', letterSpacing: '-0.02em' }}>👥 CRM : Base Clients Fidèles</h3>

            <div style={{ background: COLORS.bg, padding: '16px', borderRadius: '12px', marginBottom: '20px', border: `1px solid ${COLORS.border}` }}>
              <h4 style={{ marginTop: 0, marginBottom: '12px' }}>➕ Ajouter un client manuellement</h4>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input type="tel" className="num-tabular" placeholder="Tél (06...)" value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} style={{ flex: 1, minWidth: '150px', padding: '10px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }} />
                <input type="text" placeholder="Nom complet" value={newClientName} onChange={e => setNewClientName(e.target.value)} style={{ flex: 2, minWidth: '200px', padding: '10px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }} />
                <input type="number" className="num-tabular" placeholder="Commandes" value={newClientOrders} onChange={e => setNewClientOrders(e.target.value)} style={{ width: '120px', padding: '10px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }} />
                <input type="number" className="num-tabular" placeholder="Remise (%)" value={newClientRemise} onChange={e => setNewClientRemise(e.target.value)} style={{ width: '120px', padding: '10px', borderRadius: '8px', border: `1px solid ${COLORS.border}` }} />
                <button className="pos-btn" onClick={ajouterClientManuel} disabled={loading} style={{ padding: '10px 20px', background: COLORS.blue, color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Ajouter</button>
              </div>
            </div>

            <div style={{ maxHeight: '300px', overflowY: 'auto', border: `1px solid ${COLORS.border}`, borderRadius: '12px' }}>
              <table className="num-tabular" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'white', zIndex: 10 }}>
                  <tr style={{ borderBottom: `2px solid ${COLORS.border}` }}>
                    <th style={{ padding: '12px' }}>Téléphone</th>
                    <th style={{ padding: '12px' }}>Nom</th>
                    <th style={{ padding: '12px' }}>Commandes</th>
                    <th style={{ padding: '12px' }}>Remise Auto (%)</th>
                    <th style={{ padding: '12px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {[...clientsDB].sort((a, b) => (b.totalCommandes || 0) - (a.totalCommandes || 0)).map(client => (
                    <tr key={client.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>{client.tel}</td>
                      <td style={{ padding: '12px' }}>
                        {client.nom}
                        {client.totalCommandes >= 10 && <span style={{ background: COLORS.promo, color: 'white', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', marginLeft: '8px', fontWeight: 'bold' }}>VIP</span>}
                      </td>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>{client.totalCommandes || 0}</td>
                      <td style={{ padding: '12px' }}>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={client.remiseAuto || 0}
                          onChange={(e) => {
                            const val = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                            updateDoc(doc(db, "clients", client.id), { remiseAuto: val });
                          }}
                          style={{ width: '64px', padding: '6px', borderRadius: '6px', border: `1px solid ${COLORS.border}`, fontWeight: 'bold' }}
                        /> %
                      </td>
                      <td style={{ padding: '12px' }}>
                        <button className="pos-btn" onClick={() => { if (window.confirm("Supprimer ce client ?")) deleteDoc(doc(db, "clients", client.id)); }} style={{ background: '#FEE2E2', color: COLORS.danger, border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Supprimer</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}

// STYLES PHYSIQUES (EMIL KOWALSKI MOTION + IMPECCABLE TYPOGRAPHY + PRINT 80MM)
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
    transition: transform 150ms cubic-bezier(0.22, 1, 0.36, 1), opacity 150ms ease, box-shadow 150ms ease;
    will-change: transform;
    user-select: none;
  }
  .pos-btn:active:not(:disabled) {
    transform: scale(0.97);
  }

  .pos-card {
    transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1), border-color 180ms ease;
  }
  .pos-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px -4px rgba(0, 0, 0, 0.08);
    border-color: #D4D4D8 !important;
  }

  @keyframes modalIn {
    from { opacity: 0; transform: scale(0.96) translateY(6px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
  .modal-box {
    animation: modalIn 180ms cubic-bezier(0.22, 1, 0.36, 1) forwards;
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
    0% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.75; transform: scale(1.03); }
    100% { opacity: 1; transform: scale(1); }
  }
  .blink-alert { animation: blinkAlert 1s infinite cubic-bezier(0.22, 1, 0.36, 1); }
`;

export default function App() {
  return (
    <ErrorBoundary>
      <style>{printStyles}</style>
      <FoodjiSystem />
    </ErrorBoundary>
  );
}
