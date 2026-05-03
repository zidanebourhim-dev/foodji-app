import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from './firebase';
import { signInWithEmailAndPassword, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, setDoc, query } from 'firebase/firestore';
import './App.css';

const COLORS = { primary: '#A84438', secondary: '#1A1E29', bg: '#F3F4F6', card: '#FFFFFF', success: '#10B981', danger: '#EF4444', warning: '#F59E0B', promo: '#D97706', textLight: '#6B7280', pending: '#F97316' };

const INIT_VIANDES = [{ nom: "Poulet", available: true }, { nom: "Viande Hachée", available: true }, { nom: "Cordon Bleu", available: true }, { nom: "Nuggets", available: true }, { nom: "Poulet Crispy", available: true }];
const INIT_GARNITURES_PIZZA = [{ nom: "Viande Hachée", available: true }, { nom: "Poulet", available: true }, { nom: "4 Fromages", available: true }, { nom: "Cannibale", available: true }, { nom: "Pepperoni", available: true }, { nom: "Thon", available: true }, { nom: "Charcuterie", available: true }, { nom: "Végétarienne", available: true }, { nom: "Fruits de Mer", available: true }];
const INIT_SAUCES = [{ nom: "Algérienne", available: true }, { nom: "Biggy", available: true }, { nom: "Barbecue", available: true }, { nom: "Andalouse", available: true }, { nom: "Samouraï", available: true }, { nom: "Gruyère", available: true }, { nom: "Pas de sauce", available: true }];
const INIT_PATES = [{ nom: "Penne", available: true }, { nom: "Tagliatelle", available: true }, { nom: "Spaghetti", available: true }];
const INIT_TAILLES_PIZZA = [{ nom: "M", available: true }, { nom: "L", available: true }];

const TOUTES_CATEGORIES = ["Tacos", "Pizzas", "Burgers", "Panuozzo", "Pâtes", "Sides", "Les Burritos", "Koniks", "Plats", "Salades", "Boissons", "Suppléments"];
const STOCK_TABS = [{ id: 'viandes', label: '🌮 Viandes' }, { id: 'garnitures', label: '🍕 Garnitures' }, { id: 'sauces', label: '🥣 Sauces' }, { id: 'pates', label: '🍝 Pâtes' }, { id: 'tailles_pizza', label: '📏 Tailles Pizza' }];
const CAISSIERES = ["Rim", "Amal", "Manager"];
const NOTIF_SOUND = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

const EXTRAS_BASE = { "Champignons": 10, "Mozzarella": 10, "Parmesan": 15, "Cheddar": 15 };
const TACOS_EXTRAS = { "Sauce Fromagère": 10, "Supplément Cheddar": 7, "Supplément Mozzarella": 7, "Gratinage": 7 };

const ACCOMPAGNEMENTS_PLATS = ["Frites", "Légumes Sautés", "Pâtes"];
const EXCLUSIONS_BURGER = ["Sans Oignons", "Sans Tomates", "Sans Salade", "Sans Fromage", "Sans Sauce", "Sans Cornichons"];

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, errorMsg: '' }; }
  static getDerivedStateFromError(error) { return { hasError: true, errorMsg: error.toString() }; }
  componentDidCatch(error, errorInfo) { console.error("Crash intercepté:", error, errorInfo); }
  render() {
    if (this.state.hasError) return ( <div style={{ padding: '40px', background: '#FEF2F2', color: '#991B1B', minHeight: '100vh', fontFamily: 'sans-serif' }}><h2>🚨 ERREUR FATALE</h2><div style={{ background: '#7F1D1D', color: 'white', padding: '20px', borderRadius: '8px', marginTop: '20px', fontFamily: 'monospace' }}>{this.state.errorMsg}</div></div> );
    return this.props.children;
  }
}

function FoodjiSystem() {
  const [authState, setAuthState] = useState("LOADING");
  const [appMode, setAppMode] = useState('ADMIN'); 
  
  const [menu, setMenu] = useState([]);
  const [commandes, setCommandes] = useState([]);
  const [clientsDB, setClientsDB] = useState([]); 
  const [parametres, setParametres] = useState({ isOuvert: true, rushMode: 'standard', stocks: { viandes: INIT_VIANDES, garnitures: INIT_GARNITURES_PIZZA, sauces: INIT_SAUCES, pates: INIT_PATES, tailles_pizza: INIT_TAILLES_PIZZA } });
  
  const [sessionCaisse, setSessionCaisse] = useState({ isActive: false, caissiere: '', startTime: null });
  const [serviceGlobal, setServiceGlobal] = useState({ lastZDate: null });
  
  const [adminCategorie, setAdminCategorie] = useState('Tacos'); 
  const [activeStockTab, setActiveStockTab] = useState('viandes');
  const [newItemName, setNewItemName] = useState('');
  const [editId, setEditId] = useState(null); 
  const [formProd, setFormProd] = useState({ nom: '', description: '', image: '', categorie: 'Burgers', prixBase: '', variantes: [] });
  const [showHistory, setShowHistory] = useState(false); 
  
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

  const [customizeItem, setCustomizeItem] = useState(null); 
  const [customOptions, setCustomOptions] = useState({ garnitures: [], sauces: [], viandes: [], extras: [], cheesyCrust: false, typePate: '', accompagnements: [], exclusions: [] });

  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientOrders, setNewClientOrders] = useState('');
  const [newClientRemise, setNewClientRemise] = useState('');

  const prevCommandesLength = useRef(0);
  const audioRef = useRef(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).finally(() => {
      const unsubscribe = onAuthStateChanged(auth, (user) => setAuthState(user ? user : null));
      return () => unsubscribe();
    });
  }, []);

  useEffect(() => {
    if (!authState || authState === "LOADING") return;

    const unsubHoraires = onSnapshot(doc(db, "parametres", "horaires"), (s) => s.exists() && setParametres(prev => ({...prev, isOuvert: s.data().isOuvert})));
    const unsubStatus = onSnapshot(doc(db, "parametres", "status"), (s) => s.exists() && setParametres(prev => ({...prev, rushMode: s.data().mode})));
    const unsubStocks = onSnapshot(doc(db, "parametres", "stocks"), (s) => {
        if (s.exists()) setParametres(prev => ({...prev, stocks: s.data()}));
        else setDoc(doc(db, "parametres", "stocks"), parametres.stocks);
    });
    const unsubSession = onSnapshot(doc(db, "parametres", "session_caisse"), (s) => {
        if (s.exists()) setSessionCaisse(s.data());
        else setDoc(doc(db, "parametres", "session_caisse"), { isActive: false, caissiere: '', startTime: null });
    });
    const unsubServiceGlobal = onSnapshot(doc(db, "parametres", "service_global"), (s) => {
        if (s.exists()) setServiceGlobal(s.data());
        else setDoc(doc(db, "parametres", "service_global"), { lastZDate: new Date() });
    });

    const unsubMenu = onSnapshot(collection(db, "produits"), (snap) => setMenu(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubClients = onSnapshot(collection(db, "clients"), (snap) => setClientsDB(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubCmd = onSnapshot(query(collection(db, "commandes")), (snap) => {
      try {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          list.sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0));
          
          if (list.length > prevCommandesLength.current) {
              if (!audioRef.current) audioRef.current = new Audio(NOTIF_SOUND);
              audioRef.current.play().catch(() => {});
          }
          prevCommandesLength.current = list.length;
          setCommandes(list);
      } catch (e) { console.error("Erreur tri", e); }
    });

    return () => { unsubStatus(); unsubHoraires(); unsubStocks(); unsubSession(); unsubServiceGlobal(); unsubMenu(); unsubClients(); unsubCmd(); };
  }, [authState]);

  useEffect(() => {
      setPosCart(prevCart => prevCart.map(item => {
          if (item.nom.includes("Pep's") && !item.isPrixModifie) {
              const newBasePrice = (posOrderType === 'emporter' || posOrderType === 'livraison') ? 33 : 28;
              return { ...item, prixFinal: newBasePrice };
          }
          return item;
      }));
  }, [posOrderType]);

  const handleLogin = async (e) => {
      e.preventDefault(); if(!email || !password) return; setLoading(true);
      try { await signInWithEmailAndPassword(auth, email, password); } catch(err) { alert(`Erreur: ${err.code}`); }
      setLoading(false);
  };

  const toggleAvailability = async (item) => await updateDoc(doc(db, "produits", item.id), { available: !item.available });
  const supprimerProduit = async (id) => { if(confirm("Supprimer définitivement ?")) await deleteDoc(doc(db, "produits", id)); };
  const toggleStockItem = async (listName, index) => { const newList = [...parametres.stocks[listName]]; newList[index].available = !newList[index].available; await updateDoc(doc(db, "parametres", "stocks"), { ...parametres.stocks, [listName]: newList }); };
  const addNewStockItem = async () => { if(!newItemName.trim()) return; const newList = [...parametres.stocks[activeStockTab], { nom: newItemName.trim(), available: true }]; await updateDoc(doc(db, "parametres", "stocks"), { ...parametres.stocks, [activeStockTab]: newList }); setNewItemName(''); };
  
  // ACTION DE STATUS AVEC CRM AUTOMATISÉ
  const changerStatus = async (cmd, st) => {
      await updateDoc(doc(db, "commandes", cmd.id), { status: st });
      
      // AUTO-CRM : Si la commande Web est servie et a un numéro valide, on nourrit le CRM
      if (st === 'Terminé' && cmd.tel && cmd.tel.trim().length >= 9) {
          const telClean = cmd.tel.replace(/\s+/g, '');
          const exist = clientsDB.find(c => c.tel.replace(/\s+/g, '') === telClean);
          if (exist) {
              await updateDoc(doc(db, "clients", exist.id), { totalCommandes: (exist.totalCommandes || 0) + 1, lastOrder: new Date() });
          } else {
              await addDoc(collection(db, "clients"), { tel: telClean, nom: cmd.client || "Client Web", totalCommandes: 1, remiseAuto: 0, lastOrder: new Date() });
          }
      }
  };
  
  const handleCategoryChange = (e) => {
      const cat = e.target.value;
      let vars = [];
      if (cat === 'Tacos') vars = [{nom: 'M', prix: '', available: true}, {nom: 'L', prix: '', available: true}, {nom: 'XL', prix: '', available: true}, {nom: 'XXL', prix: '', available: true}];
      else if (cat === 'Pizzas') vars = [{nom: 'M', prix: '', available: true}, {nom: 'L', prix: '', available: true}];
      setFormProd({...formProd, categorie: cat, variantes: vars, prixBase: ''});
  };

  const saveProduit = async () => {
    if(!formProd.nom) return; setLoading(true);
    const data = { nom: formProd.nom, description: formProd.description, categorie: formProd.categorie, prix: formProd.variantes.length > 0 ? 0 : Number(formProd.prixBase), variantes: formProd.variantes, available: true, date: new Date() };
    if(formProd.image) data.image = formProd.image;
    if (editId) { await updateDoc(doc(db, "produits", editId), data); alert("Modifié !"); setEditId(null); } else { await addDoc(collection(db, "produits"), data); alert("Ajouté !"); }
    setFormProd({ nom: '', description: '', image: '', categorie: 'Panuozzo', prixBase: '', variantes: [] }); setLoading(false);
  };

  const reparerPizzas = async () => {
      if(!confirm("Ceci va forcer les tailles M et L sur toutes les pizzas. Confirmer ?")) return;
      setLoading(true);
      const pizzas = menu.filter(p => p.categorie === 'Pizzas');
      for (let p of pizzas) {
          let vars = p.variantes || [];
          let hasM = vars.find(v => v.nom === 'M');
          let hasL = vars.find(v => v.nom === 'L');
          if (!hasM || !hasL) {
              if (!hasM) vars.push({nom: 'M', prix: p.prix || 0, available: true});
              if (!hasL) vars.push({nom: 'L', prix: (p.prix || 0) * 1.5, available: true});
              await updateDoc(doc(db, "produits", p.id), { variantes: vars });
          }
      }
      setLoading(false);
      alert("✅ Réparation terminée. Vérifie les prix L dans la liste !");
  };

  const ajouterClientManuel = async () => {
      const telClean = newClientPhone.replace(/\s+/g, '');
      if (telClean.length < 9) return alert("Numéro de téléphone invalide (au moins 9 chiffres).");
      const exist = clientsDB.find(c => c.tel.replace(/\s+/g, '') === telClean);
      if (exist) return alert("❌ Ce numéro existe déjà. Modifie sa fiche dans le tableau en dessous.");
      setLoading(true);
      try {
          await addDoc(collection(db, "clients"), {
              tel: telClean, nom: newClientName.trim() || "Inconnu", totalCommandes: Number(newClientOrders) || 0, remiseAuto: Number(newClientRemise) || 0, lastOrder: new Date()
          });
          setNewClientPhone(''); setNewClientName(''); setNewClientOrders(''); setNewClientRemise('');
          alert("✅ Client ajouté avec succès !");
      } catch (e) { alert("Erreur lors de l'ajout."); }
      setLoading(false);
  };

  const ouvrirCaisse = async (nomCaissiere) => await updateDoc(doc(db, "parametres", "session_caisse"), { isActive: true, caissiere: nomCaissiere, startTime: new Date() });

  const genererBilanShift = () => {
      if (!sessionCaisse.startTime) return null;
      const startT = sessionCaisse.startTime.seconds ? new Date(sessionCaisse.startTime.seconds * 1000) : new Date(sessionCaisse.startTime);
      const cmdsSession = commandes.filter(c => {
          const d = c.date?.seconds ? new Date(c.date.seconds * 1000) : new Date(c.date);
          return d >= startT && c.status !== 'Refusé' && c.status !== 'Annulé' && c.caissiere === sessionCaisse.caissiere;
      });
      let totalEspeces = 0, totalTPE = 0, totalDépenses = 0, totalLivrApp = 0;
      cmdsSession.forEach(c => {
          if (c.type === 'depense') totalDépenses += Math.abs(c.total);
          else if (c.methodePaiement === 'Espèces') totalEspeces += c.total;
          else if (c.methodePaiement === 'TPE') totalTPE += c.total;
          else totalLivrApp += c.total; 
      });
      return { startT, totalGeneral: (totalEspeces + totalTPE + totalLivrApp), totalEspeces, totalTPE, totalDépenses, totalLivrApp, netEnCaisse: (totalEspeces - totalDépenses), nbCommandes: cmdsSession.length };
  };

  const cloturerShift = async () => {
      if (!confirm(`⚠️ Clôturer le shift de ${sessionCaisse.caissiere} ?`)) return;
      const bilan = genererBilanShift(); if (!bilan) return;
      const xData = { isX: true, caissiere: sessionCaisse.caissiere, date: new Date(), ...bilan };
      setOrderToPrint(xData);
      setTimeout(async () => { 
          window.print(); 
          await updateDoc(doc(db, "parametres", "session_caisse"), { isActive: false, caissiere: '', startTime: null });
          setTimeout(() => setOrderToPrint(null), 1000);
      }, 500);
  };

  const genererBilanGlobalZ = () => {
      if (!serviceGlobal.lastZDate) return null;
      const startT = serviceGlobal.lastZDate.seconds ? new Date(serviceGlobal.lastZDate.seconds * 1000) : new Date(serviceGlobal.lastZDate);
      const cmdsZ = commandes.filter(c => {
          const d = c.date?.seconds ? new Date(c.date.seconds * 1000) : new Date(c.date);
          return d >= startT && c.status !== 'Refusé' && c.status !== 'Annulé';
      });
      let totalEspeces = 0, totalTPE = 0, totalDépenses = 0, totalLivrApp = 0;
      cmdsZ.forEach(c => {
          if (c.type === 'depense') totalDépenses += Math.abs(c.total);
          else if (c.methodePaiement === 'Espèces') totalEspeces += c.total;
          else if (c.methodePaiement === 'TPE') totalTPE += c.total;
          else totalLivrApp += c.total; 
      });
      return { startT, totalGeneral: (totalEspeces + totalTPE + totalLivrApp), totalEspeces, totalTPE, totalDépenses, totalLivrApp, netEnCaisse: (totalEspeces - totalDépenses), nbCommandes: cmdsZ.length };
  };

  const cloturerZDefinitif = async () => {
      if (!confirm("⚠️ ATTENTION : Cela va imprimer le bilan final et REMETTRE TOUS LES COMPTEURS À ZÉRO. Confirmer ?")) return;
      const bilan = genererBilanGlobalZ(); if(!bilan) return;
      const now = new Date();
      const zData = { isZ: true, date: now, ...bilan };
      setOrderToPrint(zData);
      setTimeout(async () => { 
          window.print(); 
          await updateDoc(doc(db, "parametres", "service_global"), { lastZDate: now });
          if(sessionCaisse.isActive) await updateDoc(doc(db, "parametres", "session_caisse"), { isActive: false, caissiere: '', startTime: null });
          setShowBilanGlobal(false);
          setTimeout(() => setOrderToPrint(null), 1000);
      }, 500);
  };

  const handlePhoneInput = (val) => {
      setPosPhone(val);
      const valTrim = val.replace(/\s+/g, '');
      if (valTrim.length >= 9) {
          const found = clientsDB.find(c => c.tel.replace(/\s+/g, '') === valTrim);
          if (found) {
              setPosClientName(found.nom || '');
              setClientActif(found);
          } else setClientActif(null);
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

  const validerEtAjouter = () => {
      const prod = customizeItem.produit;
      const vari = customizeItem.variante;
      
      if (prod.categorie === 'Tacos' && prod.nom.toLowerCase().includes('mixte')) {
          const maxViandes = vari?.nom === 'XXL' ? 4 : vari?.nom === 'XL' ? 3 : 2;
          if (customOptions.viandes.length !== maxViandes) {
              return alert(`Action refusée : Tu dois sélectionner EXACTEMENT ${maxViandes} viandes pour ce Tacos Mixte.`);
          }
      }

      if (prod.categorie === 'Pâtes' && !customOptions.typePate) {
          return alert("Action refusée : Tu dois obligatoirement choisir un type de pâtes (Penne, Tagliatelle ou Spaghetti).");
      }

      if (prod.categorie === 'Plats' && customOptions.accompagnements.length !== 2) {
          return alert("Action refusée : Tu dois obligatoirement choisir EXACTEMENT 2 accompagnements différents pour ce Plat.");
      }

      addToCartFinal(prod, vari, customOptions);
  };

  const addToCartFinal = (produit, variante, options) => {
      let basePrice = variante ? variante.prix : produit.prix;
      
      if (produit.nom.includes("Pep's")) {
          basePrice = (posOrderType === 'emporter' || posOrderType === 'livraison') ? 33 : 28;
      }

      let extraPrice = 0;
      let details = [];

      if (produit.categorie === 'Pâtes') {
          details.push(`Type: ${options.typePate}`);
      }
      
      if (produit.categorie === 'Plats') {
          details.push(`Accompagnements: ${options.accompagnements.join(' et ')}`);
      }

      if (produit.categorie === 'Burgers' && options.exclusions?.length > 0) {
          options.exclusions.forEach(exc => details.push(`🚫 ${exc}`));
      }

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
              const extPrice = TACOS_EXTRAS[ext];
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
          nom: nomComplet, 
          prixFinal: finalPrice, 
          isPrixModifie: false,
          detailsTxt: details,
          idCart: Date.now() + Math.random() 
      }]);
      setCustomizeItem(null);
  };

  const removeFromCart = (idCart) => { setPosCart(posCart.filter(item => item.idCart !== idCart)); };
  
  const sousTotalCart = posCart.reduce((sum, item) => sum + Number(item.prixFinal), 0);
  const fraisLivraison = (posOrderType === 'livraison' && sousTotalCart > 0 && sousTotalCart < 45) ? 7 : 0;
  const remiseCRM = clientActif && clientActif.remiseAuto ? Math.round(sousTotalCart * (clientActif.remiseAuto / 100)) : 0;
  const totalRemises = remiseGlobale + remiseCRM;
  const totalCart = Math.max(0, sousTotalCart + fraisLivraison - totalRemises);

  const openNumpad = (mode, label, targetId = null) => { setNumpad({ active: true, mode, label, targetId, value: '' }); };
  const handleNumpadKey = (val) => {
      if (val === 'DEL') setNumpad({...numpad, value: numpad.value.slice(0, -1)});
      else if (val === 'OK') applyNumpadValue();
      else setNumpad({...numpad, value: numpad.value + val});
  };

  const applyNumpadValue = async () => {
      const valNum = Number(numpad.value) || 0;
      if (numpad.mode === 'remise_globale') setRemiseGlobale(valNum);
      else if (numpad.mode === 'prix_article') setPosCart(posCart.map(it => it.idCart === numpad.targetId ? { ...it, prixFinal: valNum, isPrixModifie: true } : it));
      else if (numpad.mode === 'encaissement_especes') {
          if (valNum < totalCart) return alert("Le montant donné est inférieur au total.");
          setNumpad({ active: false, mode: '', targetId: null, label: '', value: '' });
          setShowRenduMonnaie({ active: true, aRendre: valNum - totalCart, received: valNum });
          return;
      }
      else if (numpad.mode === 'depense') {
          if (valNum <= 0) return alert("Montant invalide");
          const motif = prompt("Motif de la dépense (ex: Eau, Fournitures...) :");
          if (!motif) return;
          setLoading(true);
          const newDepense = { client: "DÉCAISSEMENT", caissiere: sessionCaisse.caissiere || "Manager", type: "depense", commentaire: motif, items: [{ nom: `Dépense: ${motif}`, prixFinal: -valNum }], total: -valNum, status: "Terminé", methodePaiement: "Espèces", date: new Date() };
          const docRef = await addDoc(collection(db, "commandes"), newDepense);
          newDepense.id = docRef.id; newDepense.isDepense = true;
          setOrderToPrint(newDepense); setTimeout(() => { window.print(); setTimeout(() => setOrderToPrint(null), 1000); }, 500);
          setLoading(false);
      }
      setNumpad({ active: false, mode: '', targetId: null, label: '', value: '' });
  };

  const validerCommandePOS = async (methodePaiement, especeRecue = null) => {
      if (posCart.length === 0) return alert("Panier vide !");
      
      setLoading(true);
      const finalClientName = posClientName.trim() ? posClientName : "Non spécifié";
      
      const newCmd = {
          client: finalClientName,
          caissiere: sessionCaisse.caissiere || "Inconnu",
          tel: posPhone.trim() ? posPhone : "",
          adresse: posAddress, 
          bipeur: posBipeur, 
          type: posOrderType,
          commentaire: posNote,
          items: posCart,
          sousTotal: sousTotalCart,
          fraisLivraison: fraisLivraison,
          remise: totalRemises,
          total: totalCart,
          status: "Terminé", 
          methodePaiement: methodePaiement,
          especeRecue: especeRecue,
          date: new Date()
      };
      
      try {
          const docRef = await addDoc(collection(db, "commandes"), newCmd);
          newCmd.id = docRef.id;

          if (posPhone.trim().length >= 9) {
              const telClean = posPhone.replace(/\s+/g, '');
              const exist = clientsDB.find(c => c.tel.replace(/\s+/g, '') === telClean);
              if (exist) await updateDoc(doc(db, "clients", exist.id), { totalCommandes: (exist.totalCommandes || 0) + 1, lastOrder: new Date() });
              else await addDoc(collection(db, "clients"), { tel: telClean, nom: finalClientName, totalCommandes: 1, remiseAuto: 0, lastOrder: new Date() });
          }
          
          setOrderToPrint(newCmd);
          setTimeout(() => { window.print(); setTimeout(() => setOrderToPrint(null), 1000); }, 500);
          
          setPosCart([]); setPosPhone(''); setPosNote(''); setPosClientName(''); setPosAddress(''); setPosBipeur(''); setPosOrderType('sur_place'); setRemiseGlobale(0); setClientActif(null); setShowRenduMonnaie({active: false, aRendre: 0, received: 0});
      } catch(e) { alert("Erreur création commande."); }
      setLoading(false);
  };

  const imprimerCommandeExistante = (cmd) => { setOrderToPrint(cmd); setTimeout(() => { window.print(); setTimeout(() => setOrderToPrint(null), 1000); }, 500); };

  // TRADUCTEUR UNIVERSEL POUR LES COMMANDES WEB ET POS
  const getDetaisImpression = (it) => {
      if (it.detailsTxt && it.detailsTxt.length > 0) return it.detailsTxt;
      
      let d = [];
      if (it.choixPates) d.push(`Type: ${it.choixPates}`);
      if (it.isCheesyCrust) d.push(`★ CHEESY CRUST`);
      if (it.optionsChoisies?.length > 0) d.push(`Options: ${it.optionsChoisies.join(', ')}`);
      if (it.sauces?.length > 0) d.push(`Sauces: ${it.sauces.join(', ')}`);
      
      if (it.extras?.length > 0) {
          const extrasText = it.extras.map(e => e.nom ? e.nom : e).join(', ');
          d.push(`Extras: ${extrasText}`);
      }
      
      if (it.sans?.length > 0) {
          it.sans.forEach(exc => d.push(`🚫 ${exc}`));
      }
      
      return d;
  };

  // CALCUL DES COMMANDES WEB EN ATTENTE POUR L'ALERTE
  const commandesWebEnAttente = commandes.filter(c => c.status !== 'Terminé' && c.status !== 'Annulé' && c.status !== 'Refusé').length;

  if (authState === "LOADING") return <div style={{ background: COLORS.secondary, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}><h3>Chargement...</h3></div>;
  if (authState === null) return (
      <div style={{ background: COLORS.bg, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleLogin} style={{ background: 'white', padding: '40px', borderRadius: '15px', width: '350px', textAlign: 'center' }}>
              <h2>⚙️ Foodji Admin</h2>
              <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={{width:'100%', padding:'12px', margin:'15px 0', border:'1px solid #ddd', borderRadius:'8px'}}/>
              <input type="password" placeholder="Pass" value={password} onChange={e=>setPassword(e.target.value)} style={{width:'100%', padding:'12px', marginBottom:'20px', border:'1px solid #ddd', borderRadius:'8px'}}/>
              <button type="submit" style={{width:'100%', padding:'12px', background:COLORS.primary, color:'white', border:'none', borderRadius:'8px', fontWeight:'bold'}}>{loading ? '...' : 'Valider'}</button>
          </form>
      </div>
  );

  // ==========================================
  // RENDUS D'IMPRESSION (AVEC LE BON LOGO.PNG)
  // ==========================================
  const renderTickets = () => {
      if (!orderToPrint) return null;
      const PHONE_FOODJI = "05 37 53 66 89";

      if (orderToPrint.isZ || orderToPrint.isX) {
          const dCloture = orderToPrint.date;
          const titre = orderToPrint.isX ? "X DE CAISSE (SHIFT)" : "Z DE CAISSE (JOURNÉE)";
          return (
              <div className="print-only">
                  <div className="ticket-80mm">
                      <h1 style={{textAlign:'center', fontSize:'24px', borderBottom:'2px solid black', paddingBottom:'10px'}}>{titre}</h1>
                      <p style={{textAlign:'center'}}>Imprimé le {dCloture.toLocaleDateString()} à {dCloture.getHours().toString().padStart(2, '0')}:{dCloture.getMinutes().toString().padStart(2, '0')}</p>
                      {orderToPrint.isX && <p style={{textAlign:'center', fontWeight:'bold', fontSize:'18px'}}>Caissière : {orderToPrint.caissiere}</p>}
                      <hr style={{borderTop:'2px dashed black', margin: '15px 0'}}/>
                      <p style={{fontSize:'14px'}}>Depuis : {orderToPrint.startT.toLocaleDateString()} à {orderToPrint.startT.getHours().toString().padStart(2,'0')}:{orderToPrint.startT.getMinutes().toString().padStart(2,'0')}</p>
                      <p style={{fontSize:'14px'}}>Jusqu'à : {dCloture.toLocaleDateString()} à {dCloture.getHours().toString().padStart(2,'0')}:{dCloture.getMinutes().toString().padStart(2,'0')}</p>
                      <p>Nb Commandes: {orderToPrint.nbCommandes}</p>
                      <hr style={{borderTop:'2px dashed black', margin: '15px 0'}}/>
                      <table style={{width:'100%', fontSize:'16px'}}>
                          <tbody>
                              <tr><td>Total Espèces</td><td style={{textAlign:'right'}}>{orderToPrint.totalEspeces} DH</td></tr>
                              <tr><td>Total TPE</td><td style={{textAlign:'right'}}>{orderToPrint.totalTPE} DH</td></tr>
                              <tr><td>Livr. Web/App</td><td style={{textAlign:'right'}}>{orderToPrint.totalLivrApp} DH</td></tr>
                              <tr style={{color: 'red'}}><td>Décaissements</td><td style={{textAlign:'right'}}>- {orderToPrint.totalDépenses} DH</td></tr>
                          </tbody>
                      </table>
                      <hr style={{borderTop:'2px solid black', margin: '15px 0'}}/>
                      <h2 style={{fontSize:'20px'}}>CA GÉNÉRÉ : {orderToPrint.totalGeneral} DH</h2>
                      <h2 style={{fontSize:'22px', border:'2px solid black', padding:'10px', textAlign:'center'}}>NET ESPÈCES : {orderToPrint.netEnCaisse} DH</h2>
                      <p style={{textAlign:'center', marginTop:'40px'}}>Signature :</p>
                      <div style={{height:'60px', borderBottom:'1px dotted black', margin:'0 20px'}}></div>
                  </div>
              </div>
          );
      }

      if (orderToPrint.isDepense) {
          const d = orderToPrint.date;
          return (
              <div className="print-only">
                  <div className="ticket-80mm">
                      <h1 style={{textAlign:'center', fontSize:'24px', borderBottom:'2px solid black', paddingBottom:'10px'}}>BON DE DÉCAISSEMENT</h1>
                      <p style={{textAlign:'center'}}>Date : {d.toLocaleDateString()} à {d.getHours().toString().padStart(2, '0')}:{d.getMinutes().toString().padStart(2, '0')}</p>
                      <p style={{textAlign:'center', fontWeight:'bold', fontSize:'18px'}}>Caisse : {orderToPrint.caissiere}</p>
                      <hr style={{borderTop:'2px dashed black', margin: '15px 0'}}/>
                      <h2 style={{fontSize:'18px'}}>Motif : {orderToPrint.commentaire}</h2>
                      <h2 style={{fontSize:'24px', textAlign:'center', border:'2px solid black', padding:'10px'}}>SORTIE : {Math.abs(orderToPrint.total)} DH</h2>
                      <p style={{textAlign:'center', marginTop:'40px'}}>Signature :</p>
                      <div style={{height:'60px', borderBottom:'1px dotted black', margin:'0 20px'}}></div>
                  </div>
              </div>
          );
      }

      const d = orderToPrint.date?.seconds ? new Date(orderToPrint.date.seconds * 1000) : new Date(); 
      const heure = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      let typeLabel = "SUR PLACE";
      if(orderToPrint.type === 'emporter') typeLabel = "À EMPORTER";
      if(orderToPrint.type === 'livraison') typeLabel = "LIVRAISON";
      const paiementStatus = orderToPrint.methodePaiement || (orderToPrint.type === 'livraison' ? 'À régler à la livraison' : 'En ligne / Non spécifié');

      return (
          <div className="print-only">
              {/* TICKET CUISINE */}
              <div className="ticket-80mm">
                  <h1 style={{textAlign:'center', fontSize:'24px', borderBottom:'2px solid black', paddingBottom:'10px', margin: '0 0 10px 0'}}>CUISINE - #{orderToPrint.id.substring(0,4).toUpperCase()}</h1>
                  <p style={{textAlign:'center', fontSize:'22px', fontWeight:'bold', margin: '5px 0', border:'2px solid black', padding:'5px'}}>{typeLabel}</p>
                  
                  {orderToPrint.bipeur && (
                      <div style={{textAlign:'center', border:'3px dashed black', padding:'10px', margin:'10px 0'}}>
                          <div style={{fontSize:'18px'}}>BIPEUR</div>
                          <div style={{fontSize:'32px', fontWeight:'bold'}}>{orderToPrint.bipeur}</div>
                      </div>
                  )}

                  <p style={{textAlign:'center', margin: '5px 0'}}>{d.toLocaleDateString()} - {heure}</p>
                  {orderToPrint.commentaire && <div style={{border:'2px dashed black', padding:'10px', margin:'10px 0', fontWeight:'bold', fontSize:'18px'}}>NOTE: {orderToPrint.commentaire}</div>}
                  
                  <ul style={{listStyle:'none', padding:0, marginTop:'20px', margin:0}}>
                      {orderToPrint.items.map((it, i) => {
                          const details = getDetaisImpression(it);
                          return (
                              <li key={i} style={{fontSize:'16px', fontWeight:'bold', borderBottom:'1px dotted black', padding:'10px 0'}}>
                                  <div>{it.nom} {it.varianteNom ? `(${it.varianteNom})` : ''}</div>
                                  {details.length > 0 && (
                                      <div style={{fontSize:'14px', marginLeft:'10px', fontWeight:'normal'}}>
                                          {details.map((dt, j) => <div key={j}>• {dt}</div>)}
                                      </div>
                                  )}
                              </li>
                          );
                      })}
                  </ul>
              </div>

              <div className="page-break"></div>

              {/* TICKET CLIENT */}
              <div className="ticket-80mm">
                  <div style={{textAlign:'center', marginBottom:'10px'}}>
                      <img src="/logo.png" alt="FOODJI" style={{width:'100%', maxWidth:'150px', filter:'grayscale(100%) contrast(1000%)'}} />
                  </div>
                  <p style={{textAlign:'center', fontSize:'14px', margin: '2px 0'}}>Sala Al Jadida</p>
                  <p style={{textAlign:'center', fontSize:'16px', margin: '2px 0', fontWeight:'bold'}}>Tél: {PHONE_FOODJI}</p>
                  <hr style={{borderTop:'2px dashed black', margin: '10px 0'}}/>
                  <p style={{textAlign:'center', fontSize:'18px', fontWeight:'bold', margin: '5px 0'}}>{typeLabel}</p>
                  
                  {orderToPrint.bipeur && (
                      <div style={{textAlign:'center', border:'2px solid black', padding:'5px', margin:'10px 0'}}>
                          <div style={{fontSize:'14px'}}>BIPEUR NUMÉRO</div>
                          <div style={{fontSize:'24px', fontWeight:'bold'}}>{orderToPrint.bipeur}</div>
                      </div>
                  )}

                  <p style={{margin: '2px 0', fontSize:'12px'}}>Date: {d.toLocaleDateString()} {heure}</p>
                  <p style={{margin: '2px 0', fontSize:'12px'}}>Caisse: {orderToPrint.caissiere || 'Inconnu'}</p>
                  
                  {orderToPrint.client && orderToPrint.client !== "Non spécifié" && <p style={{margin: '2px 0', fontWeight:'bold', fontSize:'16px'}}>Client: {orderToPrint.client}</p>}
                  {orderToPrint.tel && <p style={{margin: '5px 0', fontWeight:'bold', fontSize:'18px'}}>Tél: {orderToPrint.tel}</p>}
                  {orderToPrint.type === 'livraison' && orderToPrint.adresse && <p style={{margin: '2px 0', fontWeight:'bold'}}>Adr: {orderToPrint.adresse}</p>}
                  
                  {orderToPrint.commentaire && (
                      <div style={{border:'1px dashed black', padding:'5px', margin:'10px 0', fontSize:'14px', fontWeight:'bold'}}>
                          Note: {orderToPrint.commentaire}
                      </div>
                  )}

                  <hr style={{borderTop:'2px dashed black', margin: '10px 0'}}/>
                  
                  <table style={{width:'100%', fontSize:'14px', marginBottom:'20px'}}>
                      <tbody>
                          {orderToPrint.items.map((it, i) => {
                              const details = getDetaisImpression(it);
                              return (
                                  <React.Fragment key={i}>
                                    <tr>
                                        <td style={{paddingTop:'5px'}}><strong>{it.nom} {it.varianteNom ? `(${it.varianteNom})` : ''}</strong></td>
                                        <td style={{textAlign:'right', paddingTop:'5px'}}><strong>{it.prixFinal} DH</strong></td>
                                    </tr>
                                    {(details.length > 0 || it.isPrixModifie) && (
                                        <tr>
                                            <td colSpan="2" style={{fontSize:'12px', paddingLeft:'10px', paddingBottom:'5px', color:'#333'}}>
                                                {details.join(' / ')}
                                                {it.isPrixModifie && <span style={{display:'block', color:'red'}}>*Prix manuel appliqué</span>}
                                            </td>
                                        </tr>
                                    )}
                                  </React.Fragment>
                              );
                          })}
                      </tbody>
                  </table>
                  
                  {orderToPrint.fraisLivraison > 0 && (
                      <div style={{display:'flex', justifyContent:'space-between', fontSize:'14px', marginBottom:'5px'}}>
                          <span>Frais de livraison</span><span>{orderToPrint.fraisLivraison} DH</span>
                      </div>
                  )}
                  
                  {orderToPrint.remise > 0 && (
                      <div style={{textAlign:'right', fontSize:'16px', borderTop:'1px dashed black', paddingTop:'5px'}}>Sous-total: {orderToPrint.sousTotal} DH<br/><strong>REMISE: -{orderToPrint.remise} DH</strong></div>
                  )}

                  <hr style={{borderTop:'2px dashed black', margin: '10px 0'}}/>
                  <h2 style={{textAlign:'right', fontSize:'24px', margin: '10px 0'}}>TOTAL: {orderToPrint.total} DH</h2>
                  <p style={{textAlign:'right', fontSize:'14px', margin: '2px 0'}}>Paiement: {paiementStatus}</p>
                  
                  {orderToPrint.especeRecue && (
                      <div style={{border:'1px solid black', padding:'5px', marginTop:'10px', fontSize:'14px'}}>
                          <div>Reçu : {orderToPrint.especeRecue} DH</div>
                          <div style={{fontWeight:'bold'}}>Rendu : {orderToPrint.especeRecue - orderToPrint.total} DH</div>
                      </div>
                  )}

                  <p style={{textAlign:'center', marginTop:'30px', fontWeight:'bold', margin: '30px 0 0 0'}}>Merci de votre visite !</p>
              </div>
          </div>
      );
  };

  // ==========================================
  // CAISSE TACTILE (POS)
  // ==========================================
  if (appMode === 'POS') {
      if (!sessionCaisse.isActive) {
          return (
              <div style={{display:'flex', height:'100vh', background:COLORS.secondary, alignItems:'center', justifyContent:'center', color:'white', flexDirection:'column'}}>
                  <h1 style={{fontSize:'3rem', marginBottom:'40px'}}>CAISSE FERMÉE</h1>
                  <div style={{background:'white', color:'black', padding:'40px', borderRadius:'15px', width:'400px', textAlign:'center'}}>
                      <h2 style={{marginTop:0}}>Ouvrir le service</h2>
                      <p>Qui est à la caisse ?</p>
                      <div style={{display:'flex', flexDirection:'column', gap:'15px', marginTop:'20px'}}>
                          {CAISSIERES.map(nom => (
                              <button key={nom} onClick={() => ouvrirCaisse(nom)} style={{padding:'20px', fontSize:'1.5rem', fontWeight:'bold', borderRadius:'10px', border:'2px solid #ddd', background:'#f9fafb', cursor:'pointer'}}>{nom}</button>
                          ))}
                      </div>
                      <button onClick={() => setAppMode('ADMIN')} style={{marginTop:'30px', padding:'10px', border:'none', background:'transparent', color:COLORS.textLight, textDecoration:'underline', cursor:'pointer'}}>⚙️ Retour Administration</button>
                  </div>
              </div>
          );
      }

      return (
          <>
              {renderTickets()}
              
              {showCashOptions && (
                  <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:4000}}>
                      <div style={{background:'white', padding:'30px', borderRadius:'15px', width:'350px', textAlign:'center'}}>
                          <h2 style={{marginTop:0}}>Encaissement Espèces</h2>
                          <p style={{fontSize:'1.5rem', fontWeight:'bold', color:COLORS.primary}}>{totalCart} DH</p>
                          <div style={{display:'flex', flexDirection:'column', gap:'15px', marginTop:'20px'}}>
                              <button onClick={() => { setShowCashOptions(false); validerCommandePOS('Espèces', totalCart); }} style={{padding:'15px', background:COLORS.success, color:'white', border:'none', borderRadius:'10px', fontSize:'1.2rem', fontWeight:'bold', cursor:'pointer'}}>✅ Montant Exact</button>
                              <button onClick={() => { setShowCashOptions(false); openNumpad('encaissement_especes', 'SOMME REÇUE DU CLIENT (DH)'); }} style={{padding:'15px', background:COLORS.secondary, color:'white', border:'none', borderRadius:'10px', fontSize:'1.2rem', fontWeight:'bold', cursor:'pointer'}}>🧮 Rendre la monnaie</button>
                              <button onClick={() => setShowCashOptions(false)} style={{padding:'15px', background:'#eee', color:'black', border:'none', borderRadius:'10px', fontSize:'1rem', fontWeight:'bold', cursor:'pointer'}}>Annuler</button>
                          </div>
                      </div>
                  </div>
              )}

              {numpad.active && (
                  <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:3000}}>
                      <div style={{background:'white', width:'350px', borderRadius:'20px', padding:'25px', display:'flex', flexDirection:'column'}}>
                          <h2 style={{marginTop:0, textAlign:'center'}}>{numpad.label}</h2>
                          <div style={{background:'#f0f2f5', padding:'20px', fontSize:'2.5rem', textAlign:'right', borderRadius:'10px', marginBottom:'20px', fontWeight:'bold', minHeight:'40px'}}>
                              {numpad.value} {numpad.value ? 'DH' : ''}
                          </div>
                          <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'15px'}}>
                              {['7','8','9','4','5','6','1','2','3','0','DEL'].map(btn => (
                                  <button key={btn} onClick={()=>handleNumpadKey(btn)} style={{padding:'20px', fontSize:'1.8rem', fontWeight:'bold', borderRadius:'10px', border:'none', background: btn==='DEL' ? '#fee2e2' : '#e5e7eb', color: btn==='DEL' ? 'red' : 'black', cursor:'pointer'}}>{btn}</button>
                              ))}
                              <button onClick={()=>handleNumpadKey('OK')} style={{padding:'20px', fontSize:'1.5rem', fontWeight:'bold', borderRadius:'10px', border:'none', background:COLORS.success, color:'white', cursor:'pointer'}}>OK</button>
                          </div>
                          <button onClick={()=>setNumpad({active:false, mode:'', targetId:null, label:'', value:''})} style={{marginTop:'20px', padding:'15px', background:'#9CA3AF', color:'white', border:'none', borderRadius:'10px', fontSize:'1.2rem', fontWeight:'bold', cursor:'pointer'}}>Annuler</button>
                      </div>
                  </div>
              )}

              {showRenduMonnaie.active && (
                  <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.9)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:4000}}>
                      <div style={{background:'white', padding:'40px', borderRadius:'20px', width:'90%', maxWidth:'500px', textAlign:'center'}}>
                          <h2 style={{fontSize:'2rem', margin:'0 0 20px 0'}}>💵 RENDU MONNAIE</h2>
                          <div style={{fontSize:'1.5rem', color:'#666', marginBottom:'10px'}}>Total de la commande : <strong>{totalCart} DH</strong></div>
                          <div style={{fontSize:'1.5rem', color:'#666', marginBottom:'20px'}}>Somme reçue : <strong>{showRenduMonnaie.received} DH</strong></div>
                          <div style={{background:COLORS.primary, color:'white', padding:'30px', borderRadius:'15px', fontSize:'3rem', fontWeight:'bold', margin:'20px 0'}}>
                              À RENDRE : {showRenduMonnaie.aRendre} DH
                          </div>
                          <button onClick={() => validerCommandePOS('Espèces', showRenduMonnaie.received)} style={{width:'100%', padding:'20px', background:COLORS.success, color:'white', border:'none', borderRadius:'10px', fontSize:'1.5rem', fontWeight:'bold', cursor:'pointer'}}>✅ VALIDER L'ENCAISSEMENT</button>
                          <button onClick={() => setShowRenduMonnaie({active: false, aRendre: 0, received: 0})} style={{width:'100%', padding:'15px', background:'transparent', color:'#666', border:'none', marginTop:'10px', cursor:'pointer', fontSize:'1.2rem', textDecoration:'underline'}}>Annuler (Retour à la caisse)</button>
                      </div>
                  </div>
              )}

              {customizeItem && (
                  <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000}}>
                      <div style={{background:'white', width:'90%', maxWidth:'800px', borderRadius:'15px', padding:'20px', display:'flex', flexDirection:'column', maxHeight:'90vh'}}>
                          <h2 style={{marginTop:0, borderBottom:'2px solid #eee', paddingBottom:'10px', color:COLORS.primary}}>
                              Préparation : {customizeItem.produit.nom} {customizeItem.variante?.nom ? `(Taille ${customizeItem.variante.nom})` : ''}
                          </h2>
                          
                          <div style={{flex:1, overflowY:'auto', padding:'10px 0'}}>
                              {customizeItem.produit.categorie === 'Burgers' && (
                                  <div style={{marginBottom:'20px'}}>
                                      <h3 style={{fontSize:'1.1rem', marginBottom:'10px', color:COLORS.danger}}>🚫 Exclusions (Sans...)</h3>
                                      <div style={{display:'flex', flexWrap:'wrap', gap:'10px'}}>
                                          {EXCLUSIONS_BURGER.map((exc, idx) => {
                                              const isSelected = customOptions.exclusions.includes(exc);
                                              return (
                                                  <button key={idx} onClick={() => toggleArrOption('exclusions', exc)} style={{padding:'10px 15px', borderRadius:'8px', fontWeight:'bold', cursor:'pointer', background: isSelected ? COLORS.danger : '#fef2f2', color: isSelected ? 'white' : COLORS.danger, border: isSelected ? 'none' : `1px solid ${COLORS.danger}`}}>{exc}</button>
                                              );
                                          })}
                                      </div>
                                  </div>
                              )}

                              {customizeItem.produit.categorie === 'Plats' && (
                                  <div style={{marginBottom:'20px', background:'#e0e7ff', padding:'15px', borderRadius:'10px'}}>
                                      <h3 style={{fontSize:'1.1rem', margin:'0 0 10px 0', color:'#3730a3'}}>🥗 Accompagnements ({customOptions.accompagnements.length} / 2 obligatoires)</h3>
                                      <div style={{display:'flex', flexWrap:'wrap', gap:'10px'}}>
                                          {ACCOMPAGNEMENTS_PLATS.map((acc, idx) => {
                                              const isSelected = customOptions.accompagnements.includes(acc);
                                              const isDisabled = !isSelected && customOptions.accompagnements.length >= 2;
                                              return (
                                                  <button key={idx} disabled={isDisabled} onClick={() => toggleArrOption('accompagnements', acc)} style={{padding:'10px 15px', borderRadius:'8px', fontWeight:'bold', cursor: isDisabled?'not-allowed':'pointer', background: isSelected ? '#3730a3' : '#fff', color: isSelected ? 'white' : 'black', border:'1px solid #3730a3', opacity: isDisabled?0.5:1}}>{acc}</button>
                                              );
                                          })}
                                      </div>
                                  </div>
                              )}

                              {customizeItem.produit.categorie === 'Pâtes' && (
                                  <div style={{marginBottom:'20px'}}>
                                      <h3 style={{fontSize:'1.1rem', marginBottom:'10px'}}>🍝 Type de Pâtes (Obligatoire)</h3>
                                      <div style={{display:'flex', flexWrap:'wrap', gap:'10px'}}>
                                          {parametres.stocks.pates.filter(p => p.available).map((pate, idx) => (
                                              <button key={idx} onClick={() => setCustomOptions(prev => ({...prev, typePate: pate.nom}))} style={{padding:'15px 25px', borderRadius:'8px', fontWeight:'bold', cursor:'pointer', background: customOptions.typePate === pate.nom ? COLORS.primary : '#f0f2f5', color: customOptions.typePate === pate.nom ? 'white' : 'black', border:'none', fontSize:'1.1rem'}}>{pate.nom}</button>
                                          ))}
                                      </div>
                                  </div>
                              )}

                              {customizeItem.produit.categorie === 'Pizzas' && (
                                  <>
                                      {(customizeItem.produit.nom.toLowerCase().includes('saison') || customizeItem.produit.nom.toLowerCase().includes('moitié')) && (
                                          <div style={{marginBottom:'20px'}}>
                                              <h3 style={{fontSize:'1.1rem', marginBottom:'10px'}}>🍕 Choix des garnitures</h3>
                                              <div style={{display:'flex', flexWrap:'wrap', gap:'10px'}}>
                                                  {parametres.stocks.garnitures.filter(opt => opt.available).map((opt, idx) => (
                                                      <button key={idx} onClick={() => toggleArrOption('garnitures', opt.nom)} style={{padding:'10px 15px', borderRadius:'8px', fontWeight:'bold', cursor:'pointer', background: customOptions.garnitures.includes(opt.nom) ? COLORS.primary : '#f0f2f5', color: customOptions.garnitures.includes(opt.nom) ? 'white' : 'black', border:'none'}}>{opt.nom}</button>
                                                  ))}
                                              </div>
                                          </div>
                                      )}
                                      <div style={{marginBottom:'20px'}}>
                                          <h3 style={{fontSize:'1.1rem', marginBottom:'10px'}}>🧀 Bords Fourrés</h3>
                                          <button onClick={() => setCustomOptions(p => ({...p, cheesyCrust: !p.cheesyCrust}))} style={{width:'100%', padding:'15px', borderRadius:'8px', fontWeight:'bold', cursor:'pointer', fontSize:'1.1rem', display:'flex', justifyContent:'space-between', background: customOptions.cheesyCrust ? COLORS.promo : '#f0f2f5', color: customOptions.cheesyCrust ? 'white' : 'black', border:'none'}}>
                                              <span>Cheesy Crust</span>
                                              <span>+ {customizeItem.variante?.nom === 'L' ? 25 : 15} DH</span>
                                          </button>
                                      </div>
                                  </>
                              )}

                              {['Pizzas', 'Pâtes', 'Plats'].includes(customizeItem.produit.categorie) && (
                                  <div style={{marginBottom:'20px'}}>
                                      <h3 style={{fontSize:'1.1rem', marginBottom:'10px'}}>➕ Extras (Payants)</h3>
                                      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:'10px'}}>
                                          {Object.keys(EXTRAS_BASE).map(ext => {
                                              const isPizzaL = (customizeItem.produit.categorie === 'Pizzas' && customizeItem.variante?.nom === 'L');
                                              const price = isPizzaL ? Math.round(EXTRAS_BASE[ext] * 1.7) : EXTRAS_BASE[ext];
                                              return (
                                                  <button key={ext} onClick={() => toggleArrOption('extras', ext)} style={{padding:'15px', borderRadius:'8px', fontWeight:'bold', cursor:'pointer', display:'flex', justifyContent:'space-between', background: customOptions.extras.includes(ext) ? '#10B981' : '#f0f2f5', color: customOptions.extras.includes(ext) ? 'white' : 'black', border:'none'}}>
                                                      <span>{ext}</span><span>+ {price} DH</span>
                                                  </button>
                                              )
                                          })}
                                      </div>
                                  </div>
                              )}

                              {customizeItem.produit.categorie === 'Tacos' && (
                                  <>
                                      {customizeItem.produit.nom.toLowerCase().includes('mixte') && (() => {
                                          const maxV = customizeItem.variante?.nom === 'XXL' ? 4 : customizeItem.variante?.nom === 'XL' ? 3 : 2;
                                          return (
                                              <div style={{marginBottom:'20px', background:'#fef3c7', padding:'15px', borderRadius:'10px'}}>
                                                  <h3 style={{fontSize:'1.1rem', margin:'0 0 10px 0', color:'#92400e'}}>🥩 Choix des Viandes ({customOptions.viandes.length} / {maxV} obligatoires)</h3>
                                                  <div style={{display:'flex', flexWrap:'wrap', gap:'10px'}}>
                                                      {parametres.stocks.viandes.filter(opt => opt.available).map((opt, idx) => {
                                                          const isSelected = customOptions.viandes.includes(opt.nom);
                                                          const isDisabled = !isSelected && customOptions.viandes.length >= maxV;
                                                          return (
                                                              <button key={idx} disabled={isDisabled} onClick={() => toggleArrOption('viandes', opt.nom)} style={{padding:'10px 15px', borderRadius:'8px', fontWeight:'bold', cursor: isDisabled?'not-allowed':'pointer', background: isSelected ? '#92400e' : '#fff', color: isSelected ? 'white' : 'black', border:'1px solid #d97706', opacity: isDisabled?0.5:1}}>{opt.nom}</button>
                                                          )
                                                      })}
                                                  </div>
                                              </div>
                                          )
                                      })()}
                                      <div style={{marginBottom:'20px'}}>
                                          <h3 style={{fontSize:'1.1rem', marginBottom:'10px'}}>🥣 Sauces (Incluses)</h3>
                                          <div style={{display:'flex', flexWrap:'wrap', gap:'10px'}}>
                                              {parametres.stocks.sauces.filter(opt => opt.available).map((opt, idx) => (
                                                  <button key={idx} onClick={() => toggleArrOption('sauces', opt.nom)} style={{padding:'10px 15px', borderRadius:'8px', fontWeight:'bold', cursor:'pointer', background: customOptions.sauces.includes(opt.nom) ? COLORS.secondary : '#f0f2f5', color: customOptions.sauces.includes(opt.nom) ? 'white' : 'black', border:'none'}}>{opt.nom}</button>
                                              ))}
                                          </div>
                                      </div>
                                      <div style={{marginBottom:'20px'}}>
                                          <h3 style={{fontSize:'1.1rem', marginBottom:'10px'}}>➕ Extras & Gratinage</h3>
                                          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:'10px'}}>
                                              {Object.keys(TACOS_EXTRAS).map(ext => (
                                                  <button key={ext} onClick={() => toggleArrOption('extras', ext)} style={{padding:'15px', borderRadius:'8px', fontWeight:'bold', cursor:'pointer', display:'flex', justifyContent:'space-between', background: customOptions.extras.includes(ext) ? '#10B981' : '#f0f2f5', color: customOptions.extras.includes(ext) ? 'white' : 'black', border:'none'}}>
                                                      <span>{ext}</span><span>+ {TACOS_EXTRAS[ext]} DH</span>
                                                  </button>
                                              ))}
                                          </div>
                                      </div>
                                  </>
                              )}
                          </div>
                          
                          <div style={{display:'flex', gap:'10px', marginTop:'20px', borderTop:'2px solid #eee', paddingTop:'20px'}}>
                              <button onClick={() => setCustomizeItem(null)} style={{flex:1, padding:'15px', background:'#9CA3AF', color:'white', borderRadius:'10px', border:'none', fontSize:'1.2rem', fontWeight:'bold', cursor:'pointer'}}>Annuler</button>
                              <button onClick={validerEtAjouter} style={{flex:2, padding:'15px', background:COLORS.success, color:'white', borderRadius:'10px', border:'none', fontSize:'1.2rem', fontWeight:'bold', cursor:'pointer'}}>✅ Valider le produit</button>
                          </div>
                      </div>
                  </div>
              )}

              <div className="no-print" style={{display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: '#f0f2f5', fontFamily: 'sans-serif'}}>
                  {/* COLONNE GAUCHE (MENU) */}
                  <div style={{flex: 1, display: 'flex', flexDirection: 'column', padding: '10px', height: '100%', overflowY: 'auto'}}>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', background:'white', padding:'15px', borderRadius:'10px', marginBottom:'10px', flexShrink: 0}}>
                          
                          <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                              <h2 style={{margin:0, color:COLORS.primary}}>🍔 Foodji POS</h2>
                              <span style={{background:'#e0e7ff', color:'#3730a3', padding:'5px 10px', borderRadius:'20px', fontWeight:'bold', fontSize:'0.9rem'}}>👤 {sessionCaisse.caissiere}</span>
                              
                              {/* ALERTE VISUELLE COMMANDES WEB RESTAURÉE */}
                              {commandesWebEnAttente > 0 && (
                                  <button onClick={() => setAppMode('ADMIN')} className="blink-alert" style={{marginLeft: '15px', background: COLORS.danger, color: 'white', border: 'none', borderRadius: '8px', padding: '8px 15px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 0 10px rgba(239,68,68,0.5)'}}>
                                      🔴 {commandesWebEnAttente} WEB EN ATTENTE
                                  </button>
                              )}
                          </div>

                          <div style={{display:'flex', gap:'8px'}}>
                              <button onClick={()=>openNumpad('depense', 'Saisir le montant retiré')} style={{padding:'10px 15px', background:'#fef3c7', color:'#92400e', borderRadius:'8px', border:'1px solid #f59e0b', cursor:'pointer', fontWeight:'bold'}}>💸 Sortie</button>
                              <button onClick={cloturerShift} style={{padding:'10px 15px', background:COLORS.warning, color:'white', borderRadius:'8px', border:'none', cursor:'pointer', fontWeight:'bold'}}>🛑 Fin Shift</button>
                              <button onClick={() => setAppMode('ADMIN')} style={{padding:'10px 15px', background:COLORS.secondary, color:'white', borderRadius:'8px', border:'none', cursor:'pointer', fontWeight:'bold'}}>⚙️ BACK-OFFICE</button>
                          </div>
                      </div>
                      
                      <div style={{display:'flex', gap:'10px', overflowX:'auto', paddingBottom:'10px', marginBottom:'10px', flexShrink: 0, scrollbarWidth:'none'}}>
                          {TOUTES_CATEGORIES.map(c => (
                              <button key={c} onClick={()=>setPosCategory(c)} style={{padding:'15px 25px', fontSize:'1.1rem', fontWeight:'bold', borderRadius:'10px', border:'none', background: posCategory===c ? COLORS.primary : 'white', color: posCategory===c ? 'white' : 'black', cursor:'pointer', flexShrink:0, boxShadow:'0 2px 5px rgba(0,0,0,0.05)'}}>{c}</button>
                          ))}
                      </div>

                      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))', gap:'10px'}}>
                          {menu.filter(p => p.categorie === posCategory && p.available !== false).map(p => (
                              <div key={p.id} style={{background:'white', borderRadius:'10px', overflow:'hidden', boxShadow:'0 2px 5px rgba(0,0,0,0.1)', border:'2px solid transparent'}}>
                                  {p.variantes?.length > 0 ? (
                                      <div style={{padding:'10px'}}>
                                          <div style={{fontWeight:'bold', textAlign:'center', marginBottom:'10px', fontSize:'1.1rem'}}>{p.nom}</div>
                                          <div style={{display:'flex', flexDirection:'column', gap:'5px'}}>
                                              {p.variantes.filter(v=>v.available !== false).map((v, i) => (
                                                  <button key={i} onClick={(e)=> { e.stopPropagation(); triggerAddToCart(p, v); }} style={{padding:'10px', background:'#f8f9fa', border:'1px solid #ddd', borderRadius:'5px', fontWeight:'bold', cursor:'pointer', display:'flex', justifyContent:'space-between'}}>{v.nom} <span style={{color:COLORS.primary}}>{v.prix} DH</span></button>
                                              ))}
                                          </div>
                                      </div>
                                  ) : (
                                      <div onClick={()=>triggerAddToCart(p)} style={{padding:'20px 10px', textAlign:'center', height:'100%', display:'flex', flexDirection:'column', justifyContent:'center', cursor:'pointer'}}>
                                          <div style={{fontWeight:'bold', fontSize:'1.1rem'}}>{p.nom}</div>
                                          <div style={{color:COLORS.primary, fontWeight:'bold', marginTop:'5px', fontSize:'1.2rem'}}>{p.prix} DH</div>
                                      </div>
                                  )}
                              </div>
                          ))}
                      </div>
                  </div>

                  {/* COLONNE DROITE (PANIER & CRM) */}
                  <div style={{width: '400px', flexShrink: 0, background: 'white', display: 'flex', flexDirection: 'column', height: '100%', borderLeft: '2px solid #ddd', boxShadow: '-5px 0 15px rgba(0,0,0,0.05)'}}>
                      
                      <div style={{padding:'15px', borderBottom:'1px solid #eee', background:COLORS.secondary, color:'white', flexShrink: 0}}>
                          <div style={{display:'flex', gap:'5px', marginBottom:'15px', background:'#374151', padding:'5px', borderRadius:'8px'}}>
                              <button onClick={()=>setPosOrderType('sur_place')} style={{flex:1, padding:'8px', borderRadius:'5px', border:'none', fontWeight:'bold', cursor:'pointer', background: posOrderType==='sur_place' ? COLORS.success : 'transparent', color: posOrderType==='sur_place' ? 'white' : '#ccc'}}>S. Place</button>
                              <button onClick={()=>setPosOrderType('emporter')} style={{flex:1, padding:'8px', borderRadius:'5px', border:'none', fontWeight:'bold', cursor:'pointer', background: posOrderType==='emporter' ? COLORS.promo : 'transparent', color: posOrderType==='emporter' ? 'white' : '#ccc'}}>Emporter</button>
                              <button onClick={()=>setPosOrderType('livraison')} style={{flex:1, padding:'8px', borderRadius:'5px', border:'none', fontWeight:'bold', cursor:'pointer', background: posOrderType==='livraison' ? '#3B82F6' : 'transparent', color: posOrderType==='livraison' ? 'white' : '#ccc'}}>Livraison</button>
                          </div>

                          <div style={{display:'flex', gap:'10px', marginBottom:'10px'}}>
                              <div style={{position:'relative', flex:1}}>
                                  <input type="tel" placeholder="Tél (06...)" value={posPhone} onChange={e=>handlePhoneInput(e.target.value)} style={{width:'100%', padding:'12px', borderRadius:'8px', border:'2px solid #3B82F6', fontSize:'1.1rem', boxSizing:'border-box', fontWeight:'bold'}}/>
                                  {clientActif && clientActif.totalCommandes >= 10 && (
                                      <span style={{position:'absolute', right:'10px', top:'12px', background:COLORS.promo, color:'white', padding:'2px 8px', borderRadius:'5px', fontWeight:'bold', fontSize:'0.8rem'}}>⭐ VIP</span>
                                  )}
                              </div>
                              <select value={posBipeur} onChange={e=>setPosBipeur(e.target.value)} style={{width:'100px', padding:'12px', borderRadius:'8px', border:'1px solid #ccc', fontSize:'1rem', fontWeight:'bold', cursor:'pointer'}}>
                                  <option value="">Bip</option>
                                  {Array.from({length: 20}, (_, i) => <option key={i+1} value={i+1}>N° {i+1}</option>)}
                              </select>
                          </div>
                          
                          <input type="text" placeholder="Nom Client (Automatique si connu)" value={posClientName} onChange={e=>setPosClientName(e.target.value)} style={{width:'100%', padding:'12px', borderRadius:'8px', border:'none', marginBottom: posOrderType==='livraison'?'10px':'0', fontSize:'1rem', boxSizing:'border-box'}}/>
                          
                          {posOrderType === 'livraison' && (
                              <input type="text" placeholder="Adresse complète" value={posAddress} onChange={e=>setPosAddress(e.target.value)} style={{width:'100%', padding:'12px', borderRadius:'8px', border:'none', fontSize:'1rem', boxSizing:'border-box'}}/>
                          )}
                      </div>

                      <div style={{flex: 1, overflowY: 'auto', padding: '10px'}}>
                          {posCart.length === 0 ? <div style={{textAlign:'center', color:'#999', marginTop:'50px', fontSize:'1.2rem'}}>Panier vide</div> : null}
                          {posCart.map(item => (
                              <div key={item.idCart} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px', borderBottom:'1px dashed #ddd', background:'#fafafa', borderRadius:'8px', marginBottom:'5px'}}>
                                  <div style={{flex:1, cursor:'pointer'}} onClick={()=>openNumpad('prix_article', `Modifier prix global : ${item.nom}`, item.idCart)}>
                                    <div style={{fontWeight:'bold', fontSize:'1.1rem', color: item.isPrixModifie ? COLORS.promo : 'black'}}>{item.nom}</div>
                                    {item.detailsTxt?.length > 0 && (
                                        <div style={{fontSize:'0.85rem', color:COLORS.textLight, marginTop:'4px'}}>
                                            {item.detailsTxt.map((txt, j) => <div key={j}>• {txt}</div>)}
                                        </div>
                                    )}
                                  </div>
                                  <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                                      <span style={{fontWeight:'bold', color:COLORS.primary, cursor:'pointer'}} onClick={()=>openNumpad('prix_article', `Modifier prix : ${item.nom}`, item.idCart)}>{item.prixFinal} DH</span>
                                      <button onClick={()=>removeFromCart(item.idCart)} style={{background:'#fee2e2', color:'red', border:'none', padding:'10px 15px', borderRadius:'5px', cursor:'pointer', fontWeight:'bold', fontSize:'1.2rem'}}>X</button>
                                  </div>
                              </div>
                          ))}
                      </div>

                      <div style={{padding: '20px', borderTop: '2px solid #eee', background: '#fff', flexShrink: 0}}>
                          <textarea placeholder="Note pour la cuisine ET le client" value={posNote} onChange={e=>setPosNote(e.target.value)} style={{width:'100%', padding:'10px', borderRadius:'8px', border:'1px solid #ddd', marginBottom:'15px', resize:'none', boxSizing:'border-box'}}/>
                          
                          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px', fontSize:'1rem', color:'#666'}}>
                              <span>Sous-total</span><span>{sousTotalCart} DH</span>
                          </div>

                          {fraisLivraison > 0 && (
                              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px', fontSize:'1rem', color:'#3B82F6', fontWeight:'bold'}}>
                                  <span>Frais de livraison</span><span>+ {fraisLivraison} DH</span>
                              </div>
                          )}
                          
                          {remiseGlobale > 0 && (
                              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px', fontSize:'1rem', color:COLORS.danger, fontWeight:'bold'}}>
                                  <span>Remise globale</span><span>- {remiseGlobale} DH</span>
                              </div>
                          )}
                          {remiseCRM > 0 && (
                              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px', fontSize:'1rem', color:COLORS.success, fontWeight:'bold'}}>
                                  <span>Remise VIP ({clientActif.remiseAuto}%)</span><span>- {remiseCRM} DH</span>
                              </div>
                          )}
                          
                          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px', fontSize:'1.8rem', fontWeight:'bold'}}>
                              <span>TOTAL</span>
                              <span style={{color:COLORS.primary}}>{totalCart} DH</span>
                          </div>
                          
                          <div style={{display:'flex', gap:'10px', marginBottom:'10px'}}>
                              <button onClick={() => setShowCashOptions(true)} disabled={loading || posCart.length===0} style={{flex:2, padding:'20px 10px', background:COLORS.success, color:'white', border:'none', borderRadius:'10px', fontSize:'1.2rem', fontWeight:'bold', cursor:'pointer', opacity: posCart.length===0?0.5:1}}>💵 ENCAISSER EN ESPÈCES</button>
                              <button onClick={()=>openNumpad('remise_globale', 'Saisir la remise totale (en DH)')} disabled={loading || posCart.length===0} style={{flex:1, padding:'20px 10px', background:'#fef3c7', color:'#b45309', border:'none', borderRadius:'10px', fontSize:'1rem', fontWeight:'bold', cursor:'pointer', opacity: posCart.length===0?0.5:1}}>🎁 REMISE</button>
                          </div>
                          
                          <button onClick={()=>{setPosCart([]); setRemiseGlobale(0); setClientActif(null); setPosBipeur('');}} style={{width:'100%', padding:'15px', background:'#fee2e2', color:'red', border:'none', borderRadius:'10px', fontWeight:'bold', cursor:'pointer', fontSize:'1rem'}}>🗑️ Vider le panier</button>
                      </div>
                  </div>
              </div>
          </>
      );
  }

  // ==========================================
  // RENDU ADMIN & STOCKS (BACK-OFFICE COMPACT)
  // ==========================================
  return (
    <>
      {renderTickets()}
      <div className="no-print" style={{ background: COLORS.bg, minHeight: '100vh', paddingBottom: '100px', color: COLORS.secondary }}>
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            
            <div style={{marginBottom:'20px', display:'flex', flexWrap:'wrap', gap:'10px', alignItems:'center', justifyContent:'space-between'}}>
                <h2 style={{margin:0}}>⚙️ Admin Foodji</h2>
                <div style={{display:'flex', gap:'10px'}}>
                    <button onClick={()=>setShowHistory(!showHistory)} style={{padding:'8px 12px', borderRadius:'8px', border:`2px solid ${COLORS.secondary}`, background: showHistory ? COLORS.secondary : 'transparent', color: showHistory ? 'white' : COLORS.secondary, fontWeight:'bold', cursor:'pointer'}}>🕒 Historique</button>
                    <button onClick={()=>setShowBilanGlobal(true)} style={{padding:'8px 12px', borderRadius:'8px', border:'none', background:'#1D4ED8', color:'white', fontWeight:'bold', cursor:'pointer'}}>📊 Bilan (Z)</button>
                    <button onClick={()=>setAppMode('POS')} style={{padding:'8px 12px', borderRadius:'8px', border:'none', background:COLORS.primary, color:'white', fontWeight:'bold', cursor:'pointer'}}>🍔 RETOUR CAISSE</button>
                    <button onClick={() => auth.signOut()} style={{padding:'8px 12px', borderRadius:'8px', border:'none', background:'#eee', cursor:'pointer'}}>Quitter</button>
                </div>
            </div>

            {/* HEADER COMPACT (Service & Rush) */}
            <div style={{display:'flex', flexWrap:'wrap', gap:'20px', marginBottom:'20px', background:'white', padding:'15px', borderRadius:'10px', alignItems:'center', boxShadow:'0 2px 5px rgba(0,0,0,0.05)'}}>
                <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                    <strong style={{color:'#666'}}>Service :</strong>
                    <button onClick={() => updateDoc(doc(db, "parametres", "horaires"), { isOuvert: true })} style={{padding:'8px 15px', borderRadius:'5px', background: parametres.isOuvert ? COLORS.success : '#eee', color: parametres.isOuvert ? 'white' : 'black', border:'none', cursor:'pointer', fontWeight:'bold'}}>🟢 OUVERT</button>
                    <button onClick={() => updateDoc(doc(db, "parametres", "horaires"), { isOuvert: false })} style={{padding:'8px 15px', borderRadius:'5px', background: !parametres.isOuvert ? COLORS.danger : '#eee', color: !parametres.isOuvert ? 'white' : 'black', border:'none', cursor:'pointer', fontWeight:'bold'}}>🔴 FERMÉ</button>
                </div>
                <div style={{width:'1px', height:'30px', background:'#eee'}}></div>
                <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                    <strong style={{color:'#666'}}>Mode Cuisine :</strong>
                    <select value={parametres.rushMode} onChange={(e) => updateDoc(doc(db, "parametres", "status"), { mode: e.target.value })} style={{padding:'8px', borderRadius:'5px', border:'1px solid #ddd', fontWeight:'bold', outline:'none', cursor:'pointer'}}>
                        <option value="standard">✅ Standard</option>
                        <option value="rush">⚠️ Rush (30min+)</option>
                        <option value="gros_rush">🔥 Gros Rush (1h+)</option>
                    </select>
                </div>
            </div>

            {showBilanGlobal && (
                <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:4000}}>
                    <div style={{background:'white', padding:'30px', borderRadius:'15px', width:'90%', maxWidth:'450px', boxShadow:'0 10px 25px rgba(0,0,0,0.2)'}}>
                        <h2 style={{marginTop:0, textAlign:'center', color:COLORS.danger}}>📊 BILAN JOURNÉE (Z)</h2>
                        <p style={{textAlign:'center', color:'#666'}}>Depuis le {serviceGlobal.lastZDate ? new Date(serviceGlobal.lastZDate.seconds ? serviceGlobal.lastZDate.seconds * 1000 : serviceGlobal.lastZDate).toLocaleString() : 'Début'}</p>
                        <hr style={{margin:'20px 0'}}/>
                        {(() => {
                            const bilan = genererBilanGlobalZ();
                            if (!bilan) return <p>Aucune donnée disponible.</p>;
                            return (
                                <>
                                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px', fontSize:'1.2rem'}}><span>Espèces (Tiroir) :</span> <strong>{bilan.totalEspeces} DH</strong></div>
                                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px', fontSize:'1.2rem'}}><span>TPE (Carte) :</span> <strong>{bilan.totalTPE} DH</strong></div>
                                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px', fontSize:'1.2rem', color:'#666'}}><span>Livr. App/Web :</span> <strong>{bilan.totalLivrApp} DH</strong></div>
                                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px', fontSize:'1.2rem', color:'red'}}><span>Décaissements :</span> <strong>- {bilan.totalDépenses} DH</strong></div>
                                    <hr style={{margin:'20px 0'}}/>
                                    <div style={{display:'flex', justifyContent:'space-between', fontSize:'1.5rem', color:COLORS.primary}}><span>NET EN CAISSE :</span> <strong>{bilan.netEnCaisse} DH</strong></div>
                                    <div style={{textAlign:'center', marginTop:'10px', color:'#666'}}>Commandes : {bilan.nbCommandes}</div>
                                </>
                            );
                        })()}
                        <div style={{marginTop:'25px', display:'flex', flexDirection:'column', gap:'10px'}}>
                            <button onClick={cloturerZDefinitif} style={{width:'100%', padding:'15px', background:COLORS.danger, color:'white', border:'none', borderRadius:'10px', fontSize:'1.1rem', fontWeight:'bold', cursor:'pointer'}}>🖨️ IMPRIMER Z ET REMETTRE À ZÉRO</button>
                            <button onClick={()=>setShowBilanGlobal(false)} style={{width:'100%', padding:'15px', background:'#eee', color:'black', border:'none', borderRadius:'10px', fontSize:'1.1rem', fontWeight:'bold', cursor:'pointer'}}>Fermer</button>
                        </div>
                    </div>
                </div>
            )}

            {showHistory ? (
                <div style={{background:'white', padding:'25px', borderRadius:'15px', marginBottom:'40px'}}>
                    <h3 style={{marginTop:0, color: COLORS.secondary}}>🕒 50 Dernières Commandes</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
                      {commandes.filter(c => c.status === 'Terminé' || c.status === 'Annulé').slice(0, 50).map(cmd => (
                        <div key={cmd.id} style={{ border:`1px solid #ddd`, borderRadius:'10px', padding:'15px', opacity: cmd.status === 'Annulé' ? 0.6 : 1, background: cmd.status === 'Annulé' ? '#fef2f2' : '#f9fafb' }}>
                          <div style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #eee', paddingBottom:'10px', marginBottom:'10px'}}>
                              <div>
                                  <strong>{cmd.client}</strong>
                                  <div style={{fontSize:'0.8rem', color:'#666'}}>{cmd.date?.seconds ? new Date(cmd.date.seconds * 1000).toLocaleString() : 'Date inconnue'}</div>
                                  {cmd.caissiere && <div style={{fontSize:'0.8rem', color:COLORS.primary}}>Par: {cmd.caissiere}</div>}
                              </div>
                              <div style={{textAlign:'right'}}>
                                  <strong style={{color:COLORS.primary}}>{cmd.total} DH</strong>
                                  <div style={{fontSize:'0.8rem', fontWeight:'bold', color: cmd.status === 'Annulé' ? COLORS.danger : COLORS.success}}>{cmd.status}</div>
                              </div>
                          </div>
                          <ul style={{listStyle:'none', padding:0, margin:0, fontSize:'0.9rem'}}>
                              {cmd.items?.map((it, i) => {
                                  const details = getDetaisImpression(it);
                                  return (
                                      <li key={i} style={{borderBottom:'1px dashed #e5e7eb', padding:'5px 0'}}>
                                          <div style={{display:'flex', justifyContent:'space-between'}}>
                                              <span>{it.nom} {it.varianteNom ? `(${it.varianteNom})` : ''}</span>
                                          </div>
                                          {details.length > 0 && <div style={{color:'#666', fontSize:'0.8rem', marginTop:'2px'}}>{details.join(' / ')}</div>}
                                      </li>
                                  )
                              })}
                          </ul>
                          <div style={{marginTop:'15px'}}>
                              <button onClick={()=>imprimerCommandeExistante(cmd)} style={{width:'100%', padding:'8px', background: COLORS.secondary, color:'white', border:'none', borderRadius:'5px', cursor:'pointer'}}>🖨️ RE-IMPRIMER</button>
                          </div>
                        </div>
                      ))}
                    </div>
                </div>
            ) : (
                <>
                    {/* COMMANDES WEB EN COURS */}
                    <h3 style={{marginBottom:'15px'}}>Commandes Web & App ({commandesWebEnAttente})</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px', marginBottom:'40px' }}>
                      {commandes.filter(c => c.status !== 'Terminé' && c.status !== 'Annulé').map(cmd => (
                        <div key={cmd.id} style={{ background:'white', borderRadius:'16px', padding:'15px', borderLeft: `5px solid ${COLORS.pending}` }}>
                          <div style={{display:'flex', justifyContent:'space-between', alignItems:'start', borderBottom:'1px solid #f0f0f0', paddingBottom:'10px', marginBottom:'10px'}}>
                            <div>
                                <strong style={{fontSize:'1.2rem'}}>{cmd.client || 'Client'}</strong>
                                <div style={{color: COLORS.textLight}}>📞 {cmd.tel || 'N/A'}</div>
                                <div style={{fontSize:'0.8rem', color: '#666'}}>
                                    {cmd.type === 'livraison' ? `🛵 Livraison : ${cmd.adresse}` : '🛍️ Emporter / Sur Place'}
                                </div>
                            </div>
                            <div style={{textAlign:'right'}}>
                              <div style={{fontSize:'1.3rem', fontWeight:'bold', color: COLORS.primary}}>{cmd.total} DH</div>
                              <div style={{fontSize:'0.8rem', color:'#666'}}>{cmd.status}</div>
                            </div>
                          </div>
                          
                          {cmd.commentaire && <div style={{background: COLORS.warning, color:'white', padding:'8px', borderRadius:'8px', fontSize:'0.9rem', fontWeight:'bold', marginBottom:'10px'}}>📝 {cmd.commentaire}</div>}
                          
                          <ul style={{listStyle:'none', padding:0, marginBottom:'15px'}}>
                            {cmd.items?.map((it, i) => {
                                const details = getDetaisImpression(it);
                                return (
                                  <li key={i} style={{padding:'5px 0', borderBottom:'1px dashed #eee'}}>
                                    <div style={{display:'flex', justifyContent:'space-between'}}>
                                        <strong>{it.nom} {it.varianteNom ? `(${it.varianteNom})` : ''}</strong>
                                        <span>{it.prixFinal} DH</span>
                                    </div>
                                    {details.length > 0 && <div style={{color:'#666', fontSize:'0.8rem', marginTop:'2px'}}>{details.join(' / ')}</div>}
                                  </li>
                                )
                            })}
                          </ul>

                          <div style={{display:'flex', gap:'10px', flexWrap:'wrap'}}>
                            <button onClick={()=>imprimerCommandeExistante(cmd)} style={{width:'100%', padding:'10px', background: COLORS.secondary, color:'white', border:'none', borderRadius:'8px', fontWeight:'bold', cursor:'pointer', marginBottom:'5px'}}>🖨️ IMPRIMER LE TICKET</button>
                            {/* LE BOUTON SERVI MET A JOUR LE CRM EN ARRIERE PLAN */}
                            <button onClick={()=>changerStatus(cmd, 'Terminé')} style={{flex:1, padding:'10px', background: COLORS.success, color:'white', border:'none', borderRadius:'8px', fontWeight:'bold'}}>✅ SERVI</button>
                            <button onClick={()=>changerStatus(cmd, 'Annulé')} style={{flex:1, padding:'10px', background: COLORS.danger, color:'white', border:'none', borderRadius:'8px', fontWeight:'bold'}}>❌ ANNULER</button>
                          </div>
                        </div>
                      ))}
                    </div>
                </>
            )}

            {/* 1. GESTION DES STOCKS REMONTÉE EN PRIORITÉ */}
            <div style={{background:'white', padding:'25px', borderRadius:'15px', marginBottom:'40px', border:`2px solid ${COLORS.primary}`}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
                      <h3 style={{margin:0, color: COLORS.primary, fontSize:'1.3rem'}}>🥕 GESTION DES STOCKS (RUPTURES)</h3>
                      <button onClick={reparerPizzas} style={{padding:'10px 15px', background:'#374151', color:'white', border:'none', borderRadius:'8px', fontWeight:'bold', cursor:'pointer'}}>🔧 Réparer les Tailles Pizzas</button>
                  </div>
                  
                  <div style={{ overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '10px', display:'flex', gap:'10px', marginBottom:'20px', scrollbarWidth:'none' }}>
                      {STOCK_TABS.map(tab => (
                          <button key={tab.id} onClick={() => setActiveStockTab(tab.id)} style={{padding:'10px 20px', borderRadius:'25px', background: activeStockTab === tab.id ? COLORS.secondary : '#f0f2f5', color: activeStockTab === tab.id ? 'white' : 'black', fontWeight:'bold', border:'none', cursor: 'pointer', fontSize:'1rem'}}>{tab.label}</button>
                      ))}
                  </div>
                  
                  <div style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
                      <input type="text" placeholder={`Ajouter dans ${STOCK_TABS.find(t=>t.id===activeStockTab).label}...`} value={newItemName} onChange={(e) => setNewItemName(e.target.value)} style={{flex:1, padding:'12px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'1rem'}} />
                      <button onClick={addNewStockItem} style={{padding:'12px 20px', background:COLORS.success, color:'white', border:'none', borderRadius:'8px', fontWeight:'bold', cursor:'pointer'}}>Ajouter</button>
                  </div>

                  <div style={{display:'flex', flexWrap:'wrap', gap:'10px'}}>
                      {parametres.stocks[activeStockTab] && parametres.stocks[activeStockTab].map((item, index) => (
                          <button key={index} onClick={() => toggleStockItem(activeStockTab, index)} style={{padding:'12px 20px', borderRadius:'25px', cursor:'pointer', fontWeight:'bold', background: item.available ? COLORS.success : '#fef2f2', color: item.available ? 'white' : COLORS.danger, border: item.available ? 'none' : `1px solid ${COLORS.danger}`, fontSize:'1rem', boxShadow:'0 2px 4px rgba(0,0,0,0.1)'}}>
                              {item.nom} {item.available ? '✅' : '❌'}
                          </button>
                      ))}
                  </div>
            </div>

            {/* 2. GESTION DU MENU */}
            <h3 style={{marginBottom:'15px'}}>📦 Gestion de la Carte (Produits)</h3>
            <div style={{background:'white', padding:'20px', borderRadius:'15px', marginBottom:'40px'}}>
               <div style={{ overflowX: 'auto', display:'flex', gap:'10px', paddingBottom:'15px', marginBottom:'15px' }}>
                {TOUTES_CATEGORIES.map(c => <button key={c} onClick={() => setAdminCategorie(c)} style={{padding:'10px 20px', borderRadius:'20px', border:'none', background: adminCategorie===c?COLORS.secondary:'#eee', color:adminCategorie===c?'white':'black', cursor:'pointer', fontWeight:'bold'}}>{c}</button>)}
               </div>

               {menu.filter(p => p.categorie === adminCategorie).map(p => (
                <div key={p.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'15px', borderBottom:'1px solid #f0f0f0', background: p.available === false ? '#FFF5F5' : 'white'}}>
                  <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                    <button onClick={() => toggleAvailability(p)} style={{padding:'8px 15px', border:'none', borderRadius:'8px', background:p.available?COLORS.success:COLORS.danger, color:'white', fontWeight:'bold', cursor:'pointer'}}>{p.available ? 'EN LIGNE' : 'RUPTURE'}</button>
                    <div style={{fontWeight:'bold', fontSize:'1.1rem', textDecoration: p.available === false ? 'line-through' : 'none'}}>{p.nom} <span style={{color:COLORS.textLight, fontWeight:'normal'}}>- {p.variantes?.length>0 ? 'Multi-tailles' : p.prix+' DH'}</span></div>
                  </div>
                  <div style={{display:'flex', gap:'15px'}}>
                      <button onClick={() => {setEditId(p.id); setFormProd({nom: p.nom, description: p.description||'', categorie: p.categorie, prixBase: p.prix||'', variantes: p.variantes||[]}); window.scrollTo(0,0);}} style={{border:'none', background:'#f0f2f5', padding:'8px 12px', borderRadius:'8px', fontSize:'1.1rem', cursor:'pointer'}}>✏️ Modifier</button>
                      <button onClick={()=>supprimerProduit(p.id)} style={{color:'white', border:'none', background:COLORS.danger, padding:'8px 12px', borderRadius:'8px', cursor:'pointer', fontWeight:'bold'}}>X</button>
                  </div>
                </div>
              ))}

              {/* Formulaire d'ajout rapide menu */}
              <div style={{marginTop:'30px', background:'#f9fafb', padding:'25px', borderRadius:'15px', border:'1px dashed #ccc'}}>
                 <h4 style={{marginTop:0}}>{editId ? '✏️ Mettre à jour le produit' : '➕ Ajouter un Produit'}</h4>
                 <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                     <input placeholder="Nom du produit" value={formProd.nom} onChange={e=>setFormProd({...formProd, nom: e.target.value})} style={{padding:'12px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'1rem'}} />
                     <select value={formProd.categorie} onChange={handleCategoryChange} style={{padding:'12px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'1rem'}}>
                         {TOUTES_CATEGORIES.map(cat => <option key={cat}>{cat}</option>)}
                     </select>
                     
                     {formProd.variantes && formProd.variantes.length > 0 ? (
                         <div style={{display:'flex', gap:'10px', flexWrap:'wrap'}}>
                             {formProd.variantes.map((v, index) => (
                                 <div key={index} style={{flex:1, minWidth:'120px', background:'white', padding:'10px', borderRadius:'8px', border:'1px solid #eee'}}>
                                     <label style={{fontSize:'0.9rem', fontWeight:'bold'}}>{v.nom}</label>
                                     <input type="number" placeholder="Prix" value={v.prix} onChange={(e) => {
                                         const newVars = [...formProd.variantes];
                                         newVars[index].prix = Number(e.target.value);
                                         setFormProd({...formProd, variantes: newVars});
                                     }} style={{width:'100%', padding:'8px', borderRadius:'5px', border:'1px solid #ccc', marginTop:'5px', boxSizing:'border-box'}} />
                                     <label style={{fontSize:'0.9rem', display:'flex', alignItems:'center', gap:'5px', marginTop:'8px', cursor:'pointer'}}>
                                         <input type="checkbox" checked={v.available !== false} onChange={(e) => {
                                             const newVars = [...formProd.variantes];
                                             newVars[index].available = e.target.checked;
                                             setFormProd({...formProd, variantes: newVars});
                                         }} style={{width:'18px', height:'18px'}} /> Dispo
                                     </label>
                                 </div>
                             ))}
                         </div>
                     ) : (
                         <input type="number" placeholder="Prix unique (ex: 45)" value={formProd.prixBase} onChange={e=>setFormProd({...formProd, prixBase: e.target.value})} style={{padding:'12px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'1rem'}} />
                     )}

                     <div style={{display:'flex', gap:'10px'}}>
                        <button onClick={saveProduit} style={{flex:1, padding:'15px', background:COLORS.primary, color:'white', border:'none', borderRadius:'10px', fontSize:'1.1rem', fontWeight:'bold', cursor:'pointer'}}>{editId ? 'Enregistrer' : 'Ajouter'}</button>
                        {editId && <button onClick={() => {setEditId(null); setFormProd({nom:'', description:'', categorie:'Panuozzo', prixBase:'', variantes:[]});}} style={{padding:'15px 25px', background:'#9CA3AF', color:'white', border:'none', borderRadius:'10px', fontSize:'1.1rem', fontWeight:'bold', cursor:'pointer'}}>Annuler</button>}
                     </div>
                 </div>
              </div>
            </div>

            {/* 3. CRM RELÉGUÉ EN BAS AVEC HAUTEUR LIMITÉE */}
            <div style={{background:'white', padding:'25px', borderRadius:'15px', marginBottom:'40px', border:`2px solid #3B82F6`}}>
                <h3 style={{marginTop:0, color: '#1D4ED8', fontSize:'1.3rem'}}>👥 CRM : Base Clients Fidèles</h3>
                
                <div style={{background:'#f8fafc', padding:'15px', borderRadius:'10px', marginBottom:'20px', border:'1px solid #e2e8f0'}}>
                    <h4 style={{marginTop:0, marginBottom:'10px', color:'#334155'}}>➕ Ajouter un client manuellement</h4>
                    <div style={{display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center'}}>
                        <input type="tel" placeholder="Tél (06...)" value={newClientPhone} onChange={e=>setNewClientPhone(e.target.value)} style={{flex:1, minWidth:'150px', padding:'10px', borderRadius:'5px', border:'1px solid #cbd5e1'}} />
                        <input type="text" placeholder="Nom complet" value={newClientName} onChange={e=>setNewClientName(e.target.value)} style={{flex:2, minWidth:'200px', padding:'10px', borderRadius:'5px', border:'1px solid #cbd5e1'}} />
                        <input type="number" placeholder="Commandes (ex: 15)" value={newClientOrders} onChange={e=>setNewClientOrders(e.target.value)} style={{width:'120px', padding:'10px', borderRadius:'5px', border:'1px solid #cbd5e1'}} />
                        <input type="number" placeholder="Remise Auto (%)" value={newClientRemise} onChange={e=>setNewClientRemise(e.target.value)} style={{width:'120px', padding:'10px', borderRadius:'5px', border:'1px solid #cbd5e1'}} />
                        <button onClick={ajouterClientManuel} disabled={loading} style={{padding:'10px 20px', background:'#1D4ED8', color:'white', border:'none', borderRadius:'5px', fontWeight:'bold', cursor:'pointer'}}>Ajouter</button>
                    </div>
                </div>

                {/* HAUTEUR BRIDÉE A 250px (Scrolable) */}
                <div style={{maxHeight:'250px', overflowY:'auto', border:'1px solid #eee', borderRadius:'10px'}}>
                    <table style={{width:'100%', textAlign:'left', borderCollapse:'collapse'}}>
                        <thead style={{position:'sticky', top:0, background:'white', zIndex:10}}>
                            <tr style={{borderBottom:'2px solid #eee', boxShadow:'0 2px 2px rgba(0,0,0,0.05)'}}>
                                <th style={{padding:'10px'}}>Téléphone</th>
                                <th style={{padding:'10px'}}>Nom</th>
                                <th style={{padding:'10px'}}>Commandes</th>
                                <th style={{padding:'10px'}}>Remise Auto (%)</th>
                                <th style={{padding:'10px'}}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {clientsDB.sort((a,b) => b.totalCommandes - a.totalCommandes).map(client => (
                                <tr key={client.id} style={{borderBottom:'1px solid #f0f2f5'}}>
                                    <td style={{padding:'10px', fontWeight:'bold'}}>{client.tel}</td>
                                    <td style={{padding:'10px'}}>{client.nom} {client.totalCommandes >= 10 && <span style={{background:COLORS.promo, color:'white', padding:'2px 6px', borderRadius:'5px', fontSize:'0.7rem', marginLeft:'5px'}}>VIP</span>}</td>
                                    <td style={{padding:'10px'}}>{client.totalCommandes}</td>
                                    <td style={{padding:'10px'}}>
                                        <input type="number" value={client.remiseAuto || 0} onChange={(e) => updateDoc(doc(db, "clients", client.id), {remiseAuto: Number(e.target.value)})} style={{width:'60px', padding:'5px', borderRadius:'5px', border:'1px solid #ccc'}}/> %
                                    </td>
                                    <td style={{padding:'10px'}}>
                                        <button onClick={()=>deleteDoc(doc(db, "clients", client.id))} style={{background:'#fee2e2', color:'red', border:'none', padding:'5px 10px', borderRadius:'5px', cursor:'pointer'}}>Supprimer</button>
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

const printStyles = `
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
      50% { opacity: 0.7; transform: scale(1.05); } 
      100% { opacity: 1; transform: scale(1); } 
  }
  .blink-alert { animation: blinkAlert 1s infinite; }
`;

export default function App() { 
    return (
        <ErrorBoundary>
            <style>{printStyles}</style>
            <FoodjiSystem />
        </ErrorBoundary>
    ); 
}
