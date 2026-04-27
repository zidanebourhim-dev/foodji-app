import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from './firebase';
import { signInWithEmailAndPassword, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, setDoc, query, writeBatch } from 'firebase/firestore';
import './App.css';

const COLORS = { primary: '#A84438', secondary: '#1A1E29', bg: '#F3F4F6', card: '#FFFFFF', success: '#10B981', danger: '#EF4444', warning: '#F59E0B', promo: '#D97706', textLight: '#6B7280', pending: '#F97316' };

const INIT_VIANDES = [{ nom: "Poulet", available: true }, { nom: "Viande Hachée", available: true }, { nom: "Cordon Bleu", available: true }, { nom: "Nuggets", available: true }, { nom: "Poulet Crispy", available: true }];
const INIT_GARNITURES_PIZZA = [{ nom: "Viande Hachée", available: true }, { nom: "Poulet", available: true }, { nom: "4 Fromages", available: true }, { nom: "Cannibale", available: true }, { nom: "Pepperoni", available: true }, { nom: "Thon", available: true }, { nom: "Charcuterie", available: true }, { nom: "Végétarienne", available: true }, { nom: "Fruits de Mer", available: true }];
const INIT_SAUCES = [{ nom: "Algérienne", available: true }, { nom: "Biggy", available: true }, { nom: "Barbecue", available: true }, { nom: "Andalouse", available: true }, { nom: "Samouraï", available: true }, { nom: "Gruyère", available: true }, { nom: "Pas de sauce", available: true }];
const INIT_PATES = [{ nom: "Penne", available: true }, { nom: "Tagliatelle", available: true }, { nom: "Spaghetti", available: true }];
const INIT_TAILLES_PIZZA = [{ nom: "M", available: true }, { nom: "L", available: true }];

const TOUTES_CATEGORIES = ["Tacos", "Pizzas", "Burgers", "Panuozzo", "Pâtes", "Sides", "Les Burritos", "Koniks", "Plats", "Salades", "Boissons"];
const STOCK_TABS = [{ id: 'viandes', label: '🌮 Viandes' }, { id: 'garnitures', label: '🍕 Garnitures' }, { id: 'sauces', label: '🥣 Sauces' }, { id: 'pates', label: '🍝 Pâtes' }, { id: 'tailles_pizza', label: '📏 Tailles Pizza' }];
const CAISSIERES = ["Rim", "Amal", "Manager"];
const NOTIF_SOUND = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

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
  const [parametres, setParametres] = useState({ isOuvert: true, rushMode: 'standard', stocks: { viandes: INIT_VIANDES, garnitures: INIT_GARNITURES_PIZZA, sauces: INIT_SAUCES, pates: INIT_PATES, tailles_pizza: INIT_TAILLES_PIZZA } });
  const [sessionCaisse, setSessionCaisse] = useState({ isActive: false, caissiere: '', startTime: null });
  
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
  const [remiseGlobale, setRemiseGlobale] = useState(0);
  
  const [orderToPrint, setOrderToPrint] = useState(null);
  const [customizeItem, setCustomizeItem] = useState(null); 
  const [selectedOptions, setSelectedOptions] = useState([]);

  // NUMPAD
  const [numpad, setNumpad] = useState({ active: false, mode: '', targetId: null, label: '', value: '' });

  const prevCommandesLength = useRef(0);
  const audioRef = useRef(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // CODE MANAGER
  const SYNC_ID_VERSION = "053700";

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

    const unsubMenu = onSnapshot(collection(db, "produits"), (snap) => setMenu(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
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

    return () => { unsubStatus(); unsubHoraires(); unsubStocks(); unsubSession(); unsubMenu(); unsubCmd(); };
  }, [authState]);

  const handleLogin = async (e) => {
      e.preventDefault(); if(!email || !password) return; setLoading(true);
      try { await signInWithEmailAndPassword(auth, email, password); } catch(err) { alert(`Erreur: ${err.code}`); }
      setLoading(false);
  };
  const checkManagerAuth = () => { const code = prompt("🔒 Code Manager requis :"); if (code === SYNC_ID_VERSION) return true; alert("❌ Code incorrect !"); return false; };

  // --- ACTIONS ADMIN ---
  const toggleAvailability = async (item) => await updateDoc(doc(db, "produits", item.id), { available: !item.available });
  const supprimerProduit = async (id) => { if (!checkManagerAuth()) return; if(confirm("Supprimer définitivement ?")) await deleteDoc(doc(db, "produits", id)); };
  const toggleStockItem = async (listName, index) => { const newList = [...parametres.stocks[listName]]; newList[index].available = !newList[index].available; await updateDoc(doc(db, "parametres", "stocks"), { ...parametres.stocks, [listName]: newList }); };
  const addNewStockItem = async () => { if(!checkManagerAuth() || !newItemName.trim()) return; const newList = [...parametres.stocks[activeStockTab], { nom: newItemName.trim(), available: true }]; await updateDoc(doc(db, "parametres", "stocks"), { ...parametres.stocks, [activeStockTab]: newList }); setNewItemName(''); };
  const changerStatus = async (id, st) => await updateDoc(doc(db, "commandes", id), { status: st });
  const supprimerCmd = async (id) => confirm("Supprimer commande ?") && await deleteDoc(doc(db, "commandes", id));
  
  const saveProduit = async () => {
    if(!formProd.nom) return; setLoading(true);
    const data = { nom: formProd.nom, description: formProd.description, categorie: formProd.categorie, prix: formProd.variantes.length > 0 ? 0 : Number(formProd.prixBase), variantes: formProd.variantes, available: true, date: new Date() };
    if(formProd.image) data.image = formProd.image;
    if (editId) { await updateDoc(doc(db, "produits", editId), data); alert("Modifié !"); setEditId(null); } else { await addDoc(collection(db, "produits"), data); alert("Ajouté !"); }
    setFormProd({ nom: '', description: '', image: '', categorie: 'Panuozzo', prixBase: '', variantes: [] }); setLoading(false);
  };

  // --- GESTION DE SESSION (X & Z) ---
  const ouvrirCaisse = async (nomCaissiere) => {
      await updateDoc(doc(db, "parametres", "session_caisse"), { isActive: true, caissiere: nomCaissiere, startTime: new Date() });
  };

  const cloturerShift = async () => {
      if (!confirm(`⚠️ Clôturer le shift de ${sessionCaisse.caissiere} ?`)) return;
      
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

      const xData = {
          isX: true,
          caissiere: sessionCaisse.caissiere,
          startT: startT,
          date: new Date(),
          totalGeneral: (totalEspeces + totalTPE + totalLivrApp), 
          totalEspeces, totalTPE, totalDépenses, totalLivrApp, 
          netEnCaisse: (totalEspeces - totalDépenses), 
          nbCommandes: cmdsSession.length
      };
      
      setOrderToPrint(xData);
      setTimeout(async () => { 
          window.print(); 
          await updateDoc(doc(db, "parametres", "session_caisse"), { isActive: false, caissiere: '', startTime: null });
          setTimeout(() => setOrderToPrint(null), 1000);
      }, 500);
  };

  const imprimerZJournee = () => {
      const today = new Date(); today.setHours(0,0,0,0);
      const cmdsDuJour = commandes.filter(c => {
          const d = c.date?.seconds ? new Date(c.date.seconds * 1000) : new Date(c.date);
          return d >= today && c.status !== 'Refusé' && c.status !== 'Annulé';
      });
      let totalEspeces = 0, totalTPE = 0, totalDépenses = 0, totalLivrApp = 0;
      cmdsDuJour.forEach(c => {
          if (c.type === 'depense') totalDépenses += Math.abs(c.total);
          else if (c.methodePaiement === 'Espèces') totalEspeces += c.total;
          else if (c.methodePaiement === 'TPE') totalTPE += c.total;
          else totalLivrApp += c.total; 
      });
      
      const zData = {
          isZ: true, date: new Date(), today: today,
          totalGeneral: (totalEspeces + totalTPE + totalLivrApp), 
          totalEspeces, totalTPE, totalDépenses, totalLivrApp, 
          netEnCaisse: (totalEspeces - totalDépenses), 
          nbCommandes: cmdsDuJour.length
      };
      setOrderToPrint(zData);
      setTimeout(() => { window.print(); setTimeout(() => setOrderToPrint(null), 1000); }, 500);
  };

  // --- LOGIQUE PANIER & CAISSE ---
  const triggerAddToCart = (produit, variante = null) => {
      const nomPizza = produit.nom.toLowerCase();
      const isPizzaPersonnalisable = produit.categorie === 'Pizzas' && (nomPizza.includes('2 saisons') || nomPizza.includes('4 saisons'));

      if (produit.categorie === 'Tacos' || isPizzaPersonnalisable) {
          setCustomizeItem({ produit, variante });
          setSelectedOptions([]); 
      } else {
          addToCartFinal(produit, variante, []);
      }
  };

  const toggleOption = (optName) => {
      if (selectedOptions.includes(optName)) setSelectedOptions(selectedOptions.filter(o => o !== optName));
      else setSelectedOptions([...selectedOptions, optName]);
  };

  const addToCartFinal = (produit, variante, options) => {
      const prixFinal = variante ? variante.prix : produit.prix;
      const nomComplet = variante ? `${produit.nom} (${variante.nom})` : produit.nom;
      
      let sauces = []; let optionsChoisies = [];
      if (produit.categorie === 'Tacos') sauces = options;
      if (produit.categorie === 'Pizzas') optionsChoisies = options;

      setPosCart([...posCart, { ...produit, nom: nomComplet, prixOriginal: prixFinal, prixFinal, sauces, optionsChoisies, idCart: Date.now() + Math.random() }]);
      setCustomizeItem(null);
  };

  const removeFromCart = (idCart) => { setPosCart(posCart.filter(item => item.idCart !== idCart)); };
  const sousTotalCart = posCart.reduce((sum, item) => sum + Number(item.prixFinal), 0);
  const totalCart = Math.max(0, sousTotalCart - remiseGlobale);

  // --- NUMPAD LOGIC ---
  const openNumpad = (mode, label, targetId = null) => { setNumpad({ active: true, mode, label, targetId, value: '' }); };
  const handleNumpadKey = (val) => {
      if (val === 'DEL') setNumpad({...numpad, value: numpad.value.slice(0, -1)});
      else if (val === 'OK') applyNumpadValue();
      else setNumpad({...numpad, value: numpad.value + val});
  };

  const applyNumpadValue = async () => {
      const valNum = Number(numpad.value) || 0;
      
      if (numpad.mode === 'remise_globale') {
          setRemiseGlobale(valNum);
      } 
      else if (numpad.mode === 'prix_article') {
          setPosCart(posCart.map(it => it.idCart === numpad.targetId ? { ...it, prixFinal: valNum, isPrixModifie: true } : it));
      } 
      else if (numpad.mode === 'depense') {
          if (valNum <= 0) return alert("Montant invalide");
          const motif = prompt("Motif de la dépense (ex: Eau, Fournitures...) :");
          if (!motif) return;
          
          setLoading(true);
          const newDepense = {
              client: "DÉCAISSEMENT", caissiere: sessionCaisse.caissiere, type: "depense", commentaire: motif,
              items: [{ nom: `Dépense: ${motif}`, prixFinal: -valNum }], total: -valNum, status: "Terminé", methodePaiement: "Espèces", date: new Date()
          };
          const docRef = await addDoc(collection(db, "commandes"), newDepense);
          newDepense.id = docRef.id; newDepense.isDepense = true;
          
          setOrderToPrint(newDepense);
          setTimeout(() => { window.print(); setTimeout(() => setOrderToPrint(null), 1000); }, 500);
          setLoading(false);
      }
      setNumpad({ active: false, mode: '', targetId: null, label: '', value: '' });
  };

  // --- VALIDATION POS ---
  const validerCommandePOS = async (methodePaiement) => {
      if (posCart.length === 0) return alert("Panier vide !");
      if (posOrderType === 'livraison' && !posAddress.trim()) return alert("Adresse de livraison obligatoire !");
      
      setLoading(true);
      const newCmd = {
          client: posClientName.trim() ? posClientName : "Non spécifié",
          caissiere: sessionCaisse.caissiere || "Inconnu",
          tel: posPhone.trim() ? posPhone : "",
          adresse: posOrderType === 'livraison' ? posAddress : "Sur place",
          type: posOrderType,
          commentaire: posNote,
          items: posCart,
          sousTotal: sousTotalCart,
          remise: remiseGlobale,
          total: totalCart,
          status: "Terminé", 
          methodePaiement: methodePaiement,
          date: new Date()
      };
      
      try {
          const docRef = await addDoc(collection(db, "commandes"), newCmd);
          newCmd.id = docRef.id;
          
          setOrderToPrint(newCmd);
          setTimeout(() => { window.print(); setTimeout(() => setOrderToPrint(null), 1000); }, 500);
          
          setPosCart([]); setPosPhone(''); setPosNote(''); setPosClientName(''); setPosAddress(''); setPosOrderType('sur_place'); setRemiseGlobale(0);
      } catch(e) { alert("Erreur création commande."); }
      setLoading(false);
  };

  const imprimerCommandeExistante = (cmd) => { setOrderToPrint(cmd); setTimeout(() => { window.print(); setTimeout(() => setOrderToPrint(null), 1000); }, 500); };

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
  // RENDUS D'IMPRESSION (X, Z, DEPENSE, TICKET)
  // ==========================================
  const renderTickets = () => {
      if (!orderToPrint) return null;

      // MODE Z DE CAISSE (JOURNÉE) ou X DE CAISSE (SHIFT)
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
                      <p>Période: {orderToPrint.isX ? `Depuis ${orderToPrint.startT.getHours()}:${orderToPrint.startT.getMinutes()}` : `Journée du ${orderToPrint.today.toLocaleDateString()}`}</p>
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

      // MODE DÉPENSE
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

      // MODE TICKET CLIENT / CUISINE
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
                  <p style={{textAlign:'center', margin: '5px 0'}}>{d.toLocaleDateString()} - {heure}</p>
                  {orderToPrint.commentaire && <div style={{border:'2px dashed black', padding:'10px', margin:'10px 0', fontWeight:'bold', fontSize:'18px'}}>NOTE: {orderToPrint.commentaire}</div>}
                  
                  <ul style={{listStyle:'none', padding:0, marginTop:'20px', margin:0}}>
                      {orderToPrint.items.map((it, i) => (
                          <li key={i} style={{fontSize:'16px', fontWeight:'bold', borderBottom:'1px dotted black', padding:'10px 0'}}>
                              <div>{it.nom}</div>
                              {it.optionsChoisies?.length > 0 && <div style={{fontSize:'14px', marginLeft:'10px'}}>+ {it.optionsChoisies.join(', ')}</div>}
                              {it.sauces?.length > 0 && <div style={{fontSize:'14px', marginLeft:'10px'}}>Sauces: {it.sauces.join(', ')}</div>}
                          </li>
                      ))}
                  </ul>
              </div>

              <div className="page-break"></div>

              {/* TICKET CLIENT */}
              <div className="ticket-80mm">
                  <div style={{textAlign:'center', marginBottom:'10px'}}><img src="/logo-ticket.png" alt="FOODJI" style={{maxWidth:'180px', maxHeight:'80px', filter:'grayscale(100%) contrast(1000%)'}} /></div>
                  <p style={{textAlign:'center', fontSize:'14px', margin: '2px 0'}}>Sala Al Jadida</p>
                  <p style={{textAlign:'center', fontSize:'14px', margin: '2px 0'}}>Tél: 06 00 00 00 00</p>
                  <hr style={{borderTop:'2px dashed black', margin: '10px 0'}}/>
                  <p style={{textAlign:'center', fontSize:'18px', fontWeight:'bold', margin: '5px 0'}}>{typeLabel}</p>
                  <p style={{margin: '2px 0', fontSize:'12px'}}>Date: {d.toLocaleDateString()} {heure}</p>
                  <p style={{margin: '2px 0', fontSize:'12px'}}>Caisse: {orderToPrint.caissiere || 'Inconnu'}</p>
                  
                  {orderToPrint.client && orderToPrint.client !== "Non spécifié" && <p style={{margin: '2px 0', fontWeight:'bold', fontSize:'16px'}}>Client: {orderToPrint.client}</p>}
                  {orderToPrint.tel && <p style={{margin: '5px 0', fontWeight:'bold', fontSize:'18px'}}>Tél: {orderToPrint.tel}</p>}
                  {orderToPrint.type === 'livraison' && orderToPrint.adresse && <p style={{margin: '2px 0', fontWeight:'bold'}}>Adr: {orderToPrint.adresse}</p>}
                  
                  <hr style={{borderTop:'2px dashed black', margin: '10px 0'}}/>
                  
                  <table style={{width:'100%', fontSize:'14px', marginBottom:'20px'}}>
                      <tbody>
                          {orderToPrint.items.map((it, i) => (
                              <React.Fragment key={i}>
                                <tr>
                                    <td style={{paddingTop:'5px'}}><strong>{it.nom}</strong></td>
                                    <td style={{textAlign:'right', paddingTop:'5px'}}><strong>{it.prixFinal} DH</strong></td>
                                </tr>
                                {(it.optionsChoisies?.length > 0 || it.sauces?.length > 0 || it.isPrixModifie) && (
                                    <tr>
                                        <td colSpan="2" style={{fontSize:'12px', paddingLeft:'10px', paddingBottom:'5px', color:'#333'}}>
                                            {it.optionsChoisies?.join(', ')} {it.sauces?.join(', ')}
                                            {it.isPrixModifie && <span style={{display:'block', color:'red'}}>*Prix manuel</span>}
                                        </td>
                                    </tr>
                                )}
                              </React.Fragment>
                          ))}
                      </tbody>
                  </table>
                  
                  {orderToPrint.remise > 0 && (
                      <div style={{textAlign:'right', fontSize:'16px', borderBottom:'1px dashed black', paddingBottom:'5px'}}>Sous-total: {orderToPrint.sousTotal} DH<br/><strong>REMISE: -{orderToPrint.remise} DH</strong></div>
                  )}

                  <hr style={{borderTop:'2px dashed black', margin: '10px 0'}}/>
                  <h2 style={{textAlign:'right', fontSize:'24px', margin: '10px 0'}}>TOTAL: {orderToPrint.total} DH</h2>
                  <p style={{textAlign:'right', fontSize:'14px', margin: '2px 0'}}>Paiement: {paiementStatus}</p>
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
                      <button onClick={() => { if(checkManagerAuth()) setAppMode('ADMIN'); }} style={{marginTop:'30px', padding:'10px', border:'none', background:'transparent', color:COLORS.textLight, textDecoration:'underline', cursor:'pointer'}}>⚙️ Retour Administration</button>
                  </div>
              </div>
          );
      }

      return (
          <>
              {renderTickets()}
              
              {/* MODAL NUMPAD */}
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

              <div className="no-print" style={{display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: '#f0f2f5', fontFamily: 'sans-serif'}}>
                  
                  {/* MODAL PERSONNALISATION */}
                  {customizeItem && (
                      <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000}}>
                          <div style={{background:'white', width:'90%', maxWidth:'600px', borderRadius:'15px', padding:'20px', display:'flex', flexDirection:'column', maxHeight:'90vh'}}>
                              <h2 style={{marginTop:0, borderBottom:'2px solid #eee', paddingBottom:'10px', color:COLORS.primary}}>Options pour {customizeItem.produit.nom}</h2>
                              <div style={{flex:1, overflowY:'auto', padding:'10px 0', display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))', gap:'10px'}}>
                                  {(customizeItem.produit.categorie === 'Pizzas' ? parametres.stocks.garnitures : parametres.stocks.sauces).filter(opt => opt.available).map((opt, idx) => (
                                          <button key={idx} onClick={() => toggleOption(opt.nom)} style={{padding:'15px', borderRadius:'10px', fontWeight:'bold', cursor:'pointer', fontSize:'1rem', background: selectedOptions.includes(opt.nom) ? COLORS.primary : '#f0f2f5', color: selectedOptions.includes(opt.nom) ? 'white' : 'black', border: selectedOptions.includes(opt.nom) ? `2px solid ${COLORS.primary}` : '2px solid transparent', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'}}>{opt.nom}</button>
                                  ))}
                              </div>
                              <div style={{display:'flex', gap:'10px', marginTop:'20px', borderTop:'2px solid #eee', paddingTop:'20px'}}>
                                  <button onClick={() => setCustomizeItem(null)} style={{flex:1, padding:'15px', background:'#9CA3AF', color:'white', borderRadius:'10px', border:'none', fontSize:'1.2rem', fontWeight:'bold', cursor:'pointer'}}>Annuler</button>
                                  <button onClick={() => addToCartFinal(customizeItem.produit, customizeItem.variante, selectedOptions)} style={{flex:2, padding:'15px', background:COLORS.success, color:'white', borderRadius:'10px', border:'none', fontSize:'1.2rem', fontWeight:'bold', cursor:'pointer'}}>✅ Valider</button>
                              </div>
                          </div>
                      </div>
                  )}

                  {/* COLONNE GAUCHE (MENU) */}
                  <div style={{flex: 1, display: 'flex', flexDirection: 'column', padding: '10px', height: '100%', overflowY: 'auto'}}>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', background:'white', padding:'15px', borderRadius:'10px', marginBottom:'10px', flexShrink: 0}}>
                          <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                              <h2 style={{margin:0, color:COLORS.primary}}>🍔 Foodji POS</h2>
                              <span style={{background:'#e0e7ff', color:'#3730a3', padding:'5px 10px', borderRadius:'20px', fontWeight:'bold', fontSize:'0.9rem'}}>👤 {sessionCaisse.caissiere}</span>
                          </div>
                          <div style={{display:'flex', gap:'10px'}}>
                              <button onClick={()=>openNumpad('depense', 'Saisir le montant retiré de la caisse')} style={{padding:'10px 15px', background:'#fef3c7', color:'#92400e', borderRadius:'8px', border:'1px solid #f59e0b', cursor:'pointer', fontWeight:'bold'}}>💸 Sortie Caisse</button>
                              <button onClick={cloturerShift} style={{padding:'10px 15px', background:COLORS.warning, color:'white', borderRadius:'8px', border:'none', cursor:'pointer', fontWeight:'bold'}}>🛑 Fin de Shift (X)</button>
                              <button onClick={() => { if(checkManagerAuth()) setAppMode('ADMIN'); }} style={{padding:'10px 15px', background:COLORS.secondary, color:'white', borderRadius:'8px', border:'none', cursor:'pointer', fontWeight:'bold'}}>⚙️ BACK-OFFICE</button>
                          </div>
                      </div>
                      
                      <div style={{display:'flex', gap:'10px', overflowX:'auto', paddingBottom:'10px', marginBottom:'10px', flexShrink: 0, scrollbarWidth:'none'}}>
                          {TOUTES_CATEGORIES.map(c => (
                              <button key={c} onClick={()=>setPosCategory(c)} style={{padding:'15px 25px', fontSize:'1.1rem', fontWeight:'bold', borderRadius:'10px', border:'none', background: posCategory===c ? COLORS.primary : 'white', color: posCategory===c ? 'white' : 'black', cursor:'pointer', flexShrink:0, boxShadow:'0 2px 5px rgba(0,0,0,0.05)'}}>{c}</button>
                          ))}
                      </div>

                      {/* AFFICHAGE DES ARTICLES (BOUTONS TAILLES SUR LA CARTE) */}
                      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:'10px'}}>
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

                  {/* COLONNE DROITE (PANIER) */}
                  <div style={{width: '400px', flexShrink: 0, background: 'white', display: 'flex', flexDirection: 'column', height: '100%', borderLeft: '2px solid #ddd', boxShadow: '-5px 0 15px rgba(0,0,0,0.05)'}}>
                      
                      <div style={{padding:'15px', borderBottom:'1px solid #eee', background:COLORS.secondary, color:'white', flexShrink: 0}}>
                          <div style={{display:'flex', gap:'5px', marginBottom:'15px', background:'#374151', padding:'5px', borderRadius:'8px'}}>
                              <button onClick={()=>setPosOrderType('sur_place')} style={{flex:1, padding:'8px', borderRadius:'5px', border:'none', fontWeight:'bold', cursor:'pointer', background: posOrderType==='sur_place' ? COLORS.success : 'transparent', color: posOrderType==='sur_place' ? 'white' : '#ccc'}}>S. Place</button>
                              <button onClick={()=>setPosOrderType('emporter')} style={{flex:1, padding:'8px', borderRadius:'5px', border:'none', fontWeight:'bold', cursor:'pointer', background: posOrderType==='emporter' ? COLORS.promo : 'transparent', color: posOrderType==='emporter' ? 'white' : '#ccc'}}>Emporter</button>
                              <button onClick={()=>setPosOrderType('livraison')} style={{flex:1, padding:'8px', borderRadius:'5px', border:'none', fontWeight:'bold', cursor:'pointer', background: posOrderType==='livraison' ? '#3B82F6' : 'transparent', color: posOrderType==='livraison' ? 'white' : '#ccc'}}>Livraison</button>
                          </div>

                          <input type="text" placeholder="Nom Client (Optionnel)" value={posClientName} onChange={e=>setPosClientName(e.target.value)} style={{width:'100%', padding:'12px', borderRadius:'8px', border:'none', marginBottom:'10px', fontSize:'1rem', boxSizing:'border-box'}}/>
                          <input type="tel" placeholder="N° Tél (Imprimé sur ticket)" value={posPhone} onChange={e=>setPosPhone(e.target.value)} style={{width:'100%', padding:'12px', borderRadius:'8px', border:'none', fontSize:'1rem', boxSizing:'border-box', marginBottom: posOrderType==='livraison'?'10px':'0'}}/>
                          
                          {posOrderType === 'livraison' && (
                              <input type="text" placeholder="Adresse complète..." value={posAddress} onChange={e=>setPosAddress(e.target.value)} style={{width:'100%', padding:'12px', borderRadius:'8px', border:'2px solid #3B82F6', fontSize:'1rem', boxSizing:'border-box'}}/>
                          )}
                      </div>

                      <div style={{flex: 1, overflowY: 'auto', padding: '10px'}}>
                          {posCart.length === 0 ? <div style={{textAlign:'center', color:'#999', marginTop:'50px', fontSize:'1.2rem'}}>Panier vide</div> : null}
                          {posCart.map(item => (
                              <div key={item.idCart} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px', borderBottom:'1px dashed #ddd', background:'#fafafa', borderRadius:'8px', marginBottom:'5px'}}>
                                  <div style={{flex:1, cursor:'pointer'}} onClick={()=>openNumpad('prix_article', `Modifier prix : ${item.nom}`, item.idCart)}>
                                    <div style={{fontWeight:'bold', fontSize:'1.1rem', color: item.isPrixModifie ? COLORS.promo : 'black'}}>{item.nom}</div>
                                    {(item.optionsChoisies?.length > 0 || item.sauces?.length > 0) && (
                                        <div style={{fontSize:'0.85rem', color:COLORS.textLight, marginTop:'4px'}}>
                                            {item.optionsChoisies?.join(', ')} {item.sauces?.join(', ')}
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
                          <textarea placeholder="Note cuisine (ex: Sans frites)" value={posNote} onChange={e=>setPosNote(e.target.value)} style={{width:'100%', padding:'10px', borderRadius:'8px', border:'1px solid #ddd', marginBottom:'15px', resize:'none', boxSizing:'border-box'}}/>
                          
                          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px', fontSize:'1rem', color:'#666'}}>
                              <span>Sous-total</span><span>{sousTotalCart} DH</span>
                          </div>
                          {remiseGlobale > 0 && (
                              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px', fontSize:'1.1rem', color:COLORS.danger, fontWeight:'bold'}}>
                                  <span>Remise globale</span><span>- {remiseGlobale} DH</span>
                              </div>
                          )}
                          
                          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px', fontSize:'1.8rem', fontWeight:'bold'}}>
                              <span>TOTAL</span>
                              <span style={{color:COLORS.primary}}>{totalCart} DH</span>
                          </div>
                          
                          <div style={{display:'flex', gap:'10px', marginBottom:'10px'}}>
                              <button onClick={()=>validerCommandePOS('Espèces')} disabled={loading || posCart.length===0} style={{flex:2, padding:'20px 10px', background:COLORS.success, color:'white', border:'none', borderRadius:'10px', fontSize:'1.2rem', fontWeight:'bold', cursor:'pointer', opacity: posCart.length===0?0.5:1}}>💵 ENCAISSER (ESPÈCES)</button>
                              <button onClick={()=>openNumpad('remise_globale', 'Saisir la remise totale (en DH)')} disabled={loading || posCart.length===0} style={{flex:1, padding:'20px 10px', background:'#fef3c7', color:'#b45309', border:'none', borderRadius:'10px', fontSize:'1rem', fontWeight:'bold', cursor:'pointer', opacity: posCart.length===0?0.5:1}}>🎁 REMISE</button>
                          </div>
                          
                          <button onClick={()=>{setPosCart([]); setRemiseGlobale(0);}} style={{width:'100%', padding:'15px', background:'#fee2e2', color:'red', border:'none', borderRadius:'10px', fontWeight:'bold', cursor:'pointer', fontSize:'1rem'}}>🗑️ Vider le panier</button>
                      </div>
                  </div>
              </div>
          </>
      );
  }

  // ==========================================
  // RENDU ADMIN & STOCKS (BACK-OFFICE)
  // ==========================================
  return (
    <>
      {renderTickets()}
      <div className="no-print" style={{ background: COLORS.bg, minHeight: '100vh', paddingBottom: '100px', color: COLORS.secondary }}>
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            
            <div style={{marginBottom:'20px', display:'flex', flexWrap:'wrap', gap:'10px', alignItems:'center', justifyContent:'space-between'}}>
                <h2 style={{margin:0}}>⚙️ Tableau de Bord (Admin)</h2>
                <div style={{display:'flex', gap:'10px'}}>
                    <button onClick={()=>setShowHistory(!showHistory)} style={{padding:'10px 15px', borderRadius:'8px', border:`2px solid ${COLORS.secondary}`, background: showHistory ? COLORS.secondary : 'transparent', color: showHistory ? 'white' : COLORS.secondary, fontWeight:'bold', cursor:'pointer'}}>🕒 Historique</button>
                    <button onClick={imprimerZJournee} style={{padding:'10px 15px', borderRadius:'8px', border:'none', background:'#1D4ED8', color:'white', fontWeight:'bold', cursor:'pointer'}}>📊 Imprimer Z de Caisse (Fin Journée)</button>
                    <button onClick={()=>setAppMode('POS')} style={{padding:'10px 15px', borderRadius:'8px', border:'none', background:COLORS.primary, color:'white', fontWeight:'bold', cursor:'pointer', fontSize:'1.1rem'}}>🍔 OUVRIR LA CAISSE</button>
                    <button onClick={() => auth.signOut()} style={{padding:'10px 15px', borderRadius:'8px', border:'none', background:'#eee', cursor:'pointer'}}>Déconnexion</button>
                </div>
            </div>

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
                              {cmd.items?.map((it, i) => (
                                  <li key={i} style={{display:'flex', justifyContent:'space-between', borderBottom:'1px dashed #e5e7eb', padding:'5px 0'}}>
                                      <span>{it.nom} {it.varianteNom ? `(${it.varianteNom})` : ''}</span>
                                  </li>
                              ))}
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
                    <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(250px, 1fr))', gap:'20px', marginBottom:'30px'}}>
                      <div style={{background: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', textAlign:'center'}}>
                          <h3 style={{marginTop:0, marginBottom:'15px', fontSize:'1rem'}}>Service Client</h3>
                          <button onClick={() => updateDoc(doc(db, "parametres", "horaires"), { isOuvert: !parametres.isOuvert })} style={{width:'100%', padding:'15px', borderRadius:'10px', border: parametres.isOuvert ? `2px solid ${COLORS.success}` : '1px solid #ddd', background: parametres.isOuvert ? '#ECFDF5' : 'white', color: parametres.isOuvert ? COLORS.success : 'black', fontWeight:'bold', cursor:'pointer'}}>
                              {parametres.isOuvert ? '🟢 OUVERT' : '🔴 FERMÉ'}
                          </button>
                      </div>
                      <div style={{background: 'white', padding: '20px', borderRadius: '16px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', textAlign:'center'}}>
                          <h3 style={{marginTop:0, marginBottom:'15px', fontSize:'1rem'}}>Mode Rush</h3>
                          <select value={parametres.rushMode} onChange={(e) => updateDoc(doc(db, "parametres", "status"), { mode: e.target.value })} style={{width:'100%', padding:'15px', borderRadius:'10px', border:'1px solid #ddd', fontSize:'1rem'}}>
                              <option value="standard">✅ Standard</option>
                              <option value="rush">⚠️ Rush (30min+)</option>
                              <option value="gros_rush">🔥 Gros Rush (1h+)</option>
                          </select>
                      </div>
                    </div>

                    <h3 style={{marginBottom:'15px'}}>Commandes Web & App ({commandes.filter(c => c.status !== 'Terminé' && c.status !== 'Annulé').length})</h3>
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
                            {cmd.items?.map((it, i) => (
                              <li key={i} style={{padding:'5px 0', borderBottom:'1px dashed #eee', display:'flex', justifyContent:'space-between'}}>
                                <div>
                                    <strong>{it.nom}</strong> <span style={{fontSize:'0.8rem', color:'#666'}}>{it.varianteNom ? `(${it.varianteNom})` : ''}</span>
                                    {(it.optionsChoisies?.length > 0 || it.sauces?.length > 0) && (
                                        <div style={{fontSize:'0.8rem', color:COLORS.textLight}}>
                                            + {it.optionsChoisies?.join(', ')} {it.sauces?.join(', ')}
                                        </div>
                                    )}
                                </div>
                                <span>{it.prixFinal} DH</span>
                              </li>
                            ))}
                          </ul>

                          <div style={{display:'flex', gap:'10px', flexWrap:'wrap'}}>
                            <button onClick={()=>imprimerCommandeExistante(cmd)} style={{width:'100%', padding:'10px', background: COLORS.secondary, color:'white', border:'none', borderRadius:'8px', fontWeight:'bold', cursor:'pointer', marginBottom:'5px'}}>🖨️ IMPRIMER LE TICKET</button>
                            <button onClick={()=>changerStatus(cmd.id, 'Terminé')} style={{flex:1, padding:'10px', background: COLORS.success, color:'white', border:'none', borderRadius:'8px', fontWeight:'bold'}}>✅ SERVI</button>
                            <button onClick={()=>changerStatus(cmd.id, 'Annulé')} style={{flex:1, padding:'10px', background: COLORS.danger, color:'white', border:'none', borderRadius:'8px', fontWeight:'bold'}}>❌ ANNULER</button>
                          </div>
                        </div>
                      ))}
                    </div>
                </>
            )}

            <div style={{background:'white', padding:'25px', borderRadius:'15px', marginBottom:'40px', border:`2px solid ${COLORS.primary}`}}>
                  <h3 style={{marginTop:0, color: COLORS.primary, fontSize:'1.3rem'}}>🥕 GESTION RAPIDE DES STOCKS (RUPTURES)</h3>
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

            <h3 style={{marginBottom:'15px'}}>📦 Gestion de la Carte (Produits)</h3>
            <div style={{background:'white', padding:'20px', borderRadius:'15px'}}>
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
                      <button onClick={() => {setEditId(p.id); setFormProd({nom: p.nom, description: p.description||'', categorie: p.categorie, prixBase: p.prix, variantes: p.variantes||[]}); window.scrollTo(0,0);}} style={{border:'none', background:'#f0f2f5', padding:'8px 12px', borderRadius:'8px', fontSize:'1.1rem', cursor:'pointer'}}>✏️ Modifier</button>
                      <button onClick={()=>supprimerProduit(p.id)} style={{color:'white', border:'none', background:COLORS.danger, padding:'8px 12px', borderRadius:'8px', cursor:'pointer', fontWeight:'bold'}}>X</button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{marginTop:'30px', background:'white', padding:'25px', borderRadius:'15px', boxShadow:'0 4px 6px rgba(0,0,0,0.05)'}}>
               <h3 style={{marginTop:0}}>{editId ? '✏️ Mettre à jour le produit' : '➕ Ajouter un Produit'}</h3>
               <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                   <input placeholder="Nom du produit" value={formProd.nom} onChange={e=>setFormProd({...formProd, nom: e.target.value})} style={{padding:'12px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'1rem'}} />
                   <select value={formProd.categorie} onChange={e=>setFormProd({...formProd, categorie: e.target.value})} style={{padding:'12px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'1rem'}}>
                       {TOUTES_CATEGORIES.map(cat => <option key={cat}>{cat}</option>)}
                   </select>
                   <input type="number" placeholder="Prix (ex: 45)" value={formProd.prixBase} onChange={e=>setFormProd({...formProd, prixBase: e.target.value})} style={{padding:'12px', borderRadius:'8px', border:'1px solid #ddd', fontSize:'1rem'}} />
                   <div style={{display:'flex', gap:'10px'}}>
                      <button onClick={saveProduit} style={{flex:1, padding:'15px', background:COLORS.primary, color:'white', border:'none', borderRadius:'10px', fontSize:'1.1rem', fontWeight:'bold', cursor:'pointer'}}>{editId ? 'Enregistrer les modifications' : 'Ajouter à la carte'}</button>
                      {editId && <button onClick={() => {setEditId(null); setFormProd({nom:'', description:'', categorie:'Panuozzo', prixBase:'', variantes:[]});}} style={{padding:'15px 25px', background:'#9CA3AF', color:'white', border:'none', borderRadius:'10px', fontSize:'1.1rem', fontWeight:'bold', cursor:'pointer'}}>Annuler</button>}
                   </div>
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
`;

export default function App() { 
    return (
        <ErrorBoundary>
            <style>{printStyles}</style>
            <FoodjiSystem />
        </ErrorBoundary>
    ); 
}
