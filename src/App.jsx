import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from './firebase';
import { signInWithEmailAndPassword, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, setDoc, query, writeBatch } from 'firebase/firestore';
import './App.css';

const COLORS = { primary: '#A84438', secondary: '#1A1E29', bg: '#F3F4F6', card: '#FFFFFF', success: '#10B981', danger: '#EF4444', warning: '#F59E0B', promo: '#D97706', textLight: '#6B7280', pending: '#F97316' };

const INIT_VIANDES = [{ nom: "Poulet", available: true }, { nom: "Viande Hachée", available: true }, { nom: "Cordon Bleu", available: true }, { nom: "Nuggets", available: true }, { nom: "Poulet Crispy", available: true }];
const INIT_GARNITURES_PIZZA = [{ nom: "Viande Hachée", available: true }, { nom: "Poulet", available: true }, { nom: "4 Fromages", available: true }, { nom: "Cannibale", available: true }, { nom: "Pepperoni", available: true }, { nom: "Thon", available: true }, { nom: "Charcuterie", available: true }, { nom: "Végétarienne", available: true }, { nom: "Fruits de Mer", available: true }];
const INIT_SAUCES = [{ nom: "Algérienne Fait Maison", available: true }, { nom: "Biggy Fait Maison", available: true }, { nom: "Barbecue Fait Maison", available: true }, { nom: "Pas de sauce", available: true }];
const INIT_PATES = [{ nom: "Penne", available: true }, { nom: "Tagliatelle", available: true }, { nom: "Spaghetti", available: true }];
const INIT_TAILLES_PIZZA = [{ nom: "M", available: true }, { nom: "L", available: true }];
const TOUTES_CATEGORIES = ["Tacos", "Pizzas", "Burgers", "Pâtes", "Sides", "Les Burritos", "Koniks", "Plats", "Salades", "Boissons", "Desserts"];
const STOCK_TABS = [{ id: 'viandes', label: '🌮 Viandes' }, { id: 'garnitures', label: '🍕 Garnitures' }, { id: 'tailles_pizza', label: '📏 Tailles' }, { id: 'pates', label: '🍝 Pâtes' }, { id: 'sauces', label: '🥣 Sauces' }];
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
  const [appMode, setAppMode] = useState('ADMIN'); // 'ADMIN' ou 'POS'
  
  // DONNÉES GLOBALES
  const [menu, setMenu] = useState([]);
  const [commandes, setCommandes] = useState([]);
  const [parametres, setParametres] = useState({ isOuvert: true, rushMode: 'standard', stocks: { viandes: INIT_VIANDES, garnitures: INIT_GARNITURES_PIZZA, sauces: INIT_SAUCES, pates: INIT_PATES, tailles_pizza: INIT_TAILLES_PIZZA } });
  
  // ETATS ADMIN
  const [adminCategorie, setAdminCategorie] = useState(''); 
  const [activeStockTab, setActiveStockTab] = useState('viandes');
  const [newItemName, setNewItemName] = useState('');
  const [editId, setEditId] = useState(null); 
  const [formProd, setFormProd] = useState({ nom: '', description: '', image: '', categorie: 'Burgers', prixBase: '', variantes: [] });
  
  // ETATS POS (CAISSE)
  const [posCart, setPosCart] = useState([]);
  const [posPhone, setPosPhone] = useState('');
  const [posNote, setPosNote] = useState('');
  const [posClientName, setPosClientName] = useState('Client Comptoir');
  const [posCategory, setPosCategory] = useState('Tacos');
  const [orderToPrint, setOrderToPrint] = useState(null);
  const [showZDeCaisse, setShowZDeCaisse] = useState(false);

  const prevCommandesLength = useRef(0);
  const audioRef = useRef(null);
  const fileInputRef = useRef(null); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const SYNC_ID_VERSION = "053700";

  // --- 1. INITIALISATION ---
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).finally(() => {
      const unsubscribe = onAuthStateChanged(auth, (user) => setAuthState(user ? user : null));
      return () => unsubscribe();
    });
  }, []);

  // --- 2. ÉCOUTEURS FIREBASE ---
  useEffect(() => {
    if (!authState || authState === "LOADING") return;

    const unsubHoraires = onSnapshot(doc(db, "parametres", "horaires"), (s) => s.exists() && setParametres(prev => ({...prev, isOuvert: s.data().isOuvert})));
    const unsubStatus = onSnapshot(doc(db, "parametres", "status"), (s) => s.exists() && setParametres(prev => ({...prev, rushMode: s.data().mode})));
    const unsubStocks = onSnapshot(doc(db, "parametres", "stocks"), (s) => {
        if (s.exists()) setParametres(prev => ({...prev, stocks: s.data()}));
        else setDoc(doc(db, "parametres", "stocks"), parametres.stocks);
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

    return () => { unsubStatus(); unsubHoraires(); unsubStocks(); unsubMenu(); unsubCmd(); };
  }, [authState]);

  useEffect(() => { if (menu.length > 0 && !adminCategorie) setAdminCategorie(menu[0].categorie); }, [menu, adminCategorie]);

  // --- ACTIONS COMMUNES ---
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
    setFormProd({ nom: '', description: '', image: '', categorie: 'Burgers', prixBase: '', variantes: [] }); setLoading(false);
  };

  // --- ACTIONS CAISSE (POS) ---
  const addToCart = (produit, variante = null) => {
      const prixFinal = variante ? variante.prix : produit.prix;
      const nomComplet = variante ? `${produit.nom} (${variante.nom})` : produit.nom;
      setPosCart([...posCart, { ...produit, nom: nomComplet, prixFinal, idCart: Date.now() + Math.random() }]);
  };

  const removeFromCart = (idCart) => { setPosCart(posCart.filter(item => item.idCart !== idCart)); };
  const totalCart = posCart.reduce((sum, item) => sum + Number(item.prixFinal), 0);

  const validerCommandePOS = async (methodePaiement) => {
      if (posCart.length === 0) return alert("Panier vide !");
      setLoading(true);
      const newCmd = {
          client: posClientName,
          tel: posPhone || "Comptoir",
          adresse: "Sur place",
          type: "sur_place",
          commentaire: posNote,
          items: posCart,
          total: totalCart,
          status: "En attente",
          methodePaiement: methodePaiement, // 'Espèces' ou 'TPE'
          date: new Date()
      };
      
      try {
          const docRef = await addDoc(collection(db, "commandes"), newCmd);
          newCmd.id = docRef.id;
          // Lancer l'impression automatique
          setOrderToPrint(newCmd);
          setTimeout(() => { window.print(); setOrderToPrint(null); }, 800);
          
          // Reset Caisse
          setPosCart([]); setPosPhone(''); setPosNote(''); setPosClientName('Client Comptoir');
      } catch(e) { alert("Erreur lors de la création de la commande."); }
      setLoading(false);
  };

  const genererZDeCaisse = () => {
      const today = new Date();
      today.setHours(0,0,0,0);
      
      const cmdsDuJour = commandes.filter(c => {
          const d = c.date?.seconds ? new Date(c.date.seconds * 1000) : new Date(c.date);
          return d >= today && c.status !== 'Refusé' && c.status !== 'Annulé';
      });

      let totalEspeces = 0;
      let totalTPE = 0;
      let totalLivrApp = 0; // Glovo/En ligne potentiel

      cmdsDuJour.forEach(c => {
          if (c.methodePaiement === 'Espèces') totalEspeces += c.total;
          else if (c.methodePaiement === 'TPE') totalTPE += c.total;
          else totalLivrApp += c.total; // Les commandes en ligne arrivent souvent sans methodePaiement "caisse"
      });

      return { totalGeneral: totalEspeces + totalTPE + totalLivrApp, totalEspeces, totalTPE, totalLivrApp, nbCommandes: cmdsDuJour.length };
  };


  // ==========================================
  // RENDU 1 : ÉCRAN D'ATTENTE & LOGIN
  // ==========================================
  if (authState === "LOADING") return <div style={{ background: COLORS.secondary, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}><h3>Chargement...</h3></div>;
  if (authState === null) return (
      <div style={{ background: COLORS.bg, height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleLogin} style={{ background: 'white', padding: '40px', borderRadius: '15px', width: '350px', textAlign: 'center' }}>
              <h2>⚙️ Connexion Foodji</h2>
              <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={{width:'100%', padding:'12px', margin:'15px 0', border:'1px solid #ddd', borderRadius:'8px'}}/>
              <input type="password" placeholder="Pass" value={password} onChange={e=>setPassword(e.target.value)} style={{width:'100%', padding:'12px', marginBottom:'20px', border:'1px solid #ddd', borderRadius:'8px'}}/>
              <button type="submit" style={{width:'100%', padding:'12px', background:COLORS.primary, color:'white', border:'none', borderRadius:'8px', fontWeight:'bold'}}>{loading ? '...' : 'Valider'}</button>
          </form>
      </div>
  );

  // ==========================================
  // RENDU INVISIBLE : TICKETS D'IMPRESSION (80mm)
  // ==========================================
  const renderTickets = () => {
      if (!orderToPrint) return null;
      const d = new Date();
      const heure = `${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
      
      return (
          <div className="print-only">
              {/* TICKET CUISINE */}
              <div className="ticket-80mm">
                  <h1 style={{textAlign:'center', fontSize:'24px', borderBottom:'2px solid black', paddingBottom:'10px'}}>CUISINE - #{orderToPrint.id.substring(0,4).toUpperCase()}</h1>
                  <p style={{textAlign:'center', fontSize:'18px', fontWeight:'bold'}}>{orderToPrint.type === 'sur_place' ? 'SUR PLACE / EMPORTER' : 'LIVRAISON'}</p>
                  <p style={{textAlign:'center'}}>{d.toLocaleDateString()} - {heure}</p>
                  {orderToPrint.commentaire && <div style={{border:'2px dashed black', padding:'10px', margin:'10px 0', fontWeight:'bold', fontSize:'18px'}}>NOTE: {orderToPrint.commentaire}</div>}
                  
                  <ul style={{listStyle:'none', padding:0, marginTop:'20px'}}>
                      {orderToPrint.items.map((it, i) => (
                          <li key={i} style={{fontSize:'16px', fontWeight:'bold', borderBottom:'1px dotted black', padding:'10px 0'}}>
                              <div>{it.nom}</div>
                              {it.sans?.length > 0 && <div style={{fontSize:'14px'}}>SANS: {it.sans.join(', ')}</div>}
                              {it.sauces?.length > 0 && <div style={{fontSize:'14px'}}>SAUCES: {it.sauces.join(', ')}</div>}
                          </li>
                      ))}
                  </ul>
              </div>

              <div className="page-break"></div>

              {/* TICKET CLIENT */}
              <div className="ticket-80mm">
                  <h1 style={{textAlign:'center', fontSize:'28px'}}>FOODJI</h1>
                  <p style={{textAlign:'center', fontSize:'14px'}}>Sala Al Jadida</p>
                  <p style={{textAlign:'center', fontSize:'14px'}}>Tél: 06 00 00 00 00</p>
                  <hr style={{borderTop:'2px dashed black'}}/>
                  <p>Date: {d.toLocaleDateString()} {heure}</p>
                  <p>Client: {orderToPrint.client}</p>
                  <p>Tél: {orderToPrint.tel}</p>
                  <hr style={{borderTop:'2px dashed black'}}/>
                  <table style={{width:'100%', fontSize:'14px', marginBottom:'20px'}}>
                      <tbody>
                          {orderToPrint.items.map((it, i) => (
                              <tr key={i}>
                                  <td style={{paddingTop:'5px'}}>{it.nom}</td>
                                  <td style={{textAlign:'right', paddingTop:'5px'}}>{it.prixFinal} DH</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
                  <hr style={{borderTop:'2px dashed black'}}/>
                  <h2 style={{textAlign:'right', fontSize:'24px'}}>TOTAL: {orderToPrint.total} DH</h2>
                  <p style={{textAlign:'right', fontSize:'14px'}}>Paiement: {orderToPrint.methodePaiement || 'Non spécifié'}</p>
                  <p style={{textAlign:'center', marginTop:'30px', fontWeight:'bold'}}>Merci de votre visite !</p>
              </div>
          </div>
      );
  };


  // ==========================================
  // RENDU 2 : CAISSE TACTILE (POS)
  // ==========================================
  if (appMode === 'POS') {
      const zData = genererZDeCaisse();
      
      return (
          <div className="pos-container no-print" style={{display:'flex', height:'100vh', background:'#f0f2f5', fontFamily:'sans-serif'}}>
              {renderTickets()}
              
              {/* PARTIE GAUCHE : MENU */}
              <div style={{flex: 1, display:'flex', flexDirection:'column', padding:'10px'}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', background:'white', padding:'15px', borderRadius:'10px', marginBottom:'10px'}}>
                      <h2 style={{margin:0, color:COLORS.primary}}>🍔 Foodji POS</h2>
                      <button onClick={()=>setAppMode('ADMIN')} style={{padding:'10px 20px', background:COLORS.secondary, color:'white', borderRadius:'8px', border:'none', cursor:'pointer'}}>Retour Admin</button>
                  </div>
                  
                  <div style={{display:'flex', gap:'10px', overflowX:'auto', paddingBottom:'10px', scrollbarWidth:'none'}}>
                      {TOUTES_CATEGORIES.map(c => (
                          <button key={c} onClick={()=>setPosCategory(c)} style={{padding:'15px 25px', fontSize:'1.1rem', fontWeight:'bold', borderRadius:'10px', border:'none', background: posCategory===c ? COLORS.primary : 'white', color: posCategory===c ? 'white' : 'black', cursor:'pointer', flexShrink:0}}>{c}</button>
                      ))}
                  </div>

                  <div style={{flex:1, overflowY:'auto', display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))', gap:'10px', alignContent:'start'}}>
                      {menu.filter(p => p.categorie === posCategory && p.available !== false).map(p => (
                          <div key={p.id} style={{background:'white', borderRadius:'10px', overflow:'hidden', boxShadow:'0 2px 5px rgba(0,0,0,0.1)', cursor:'pointer'}}>
                              {p.variantes?.length > 0 ? (
                                  <div style={{padding:'10px'}}>
                                      <div style={{fontWeight:'bold', textAlign:'center', marginBottom:'10px'}}>{p.nom}</div>
                                      <div style={{display:'flex', flexDirection:'column', gap:'5px'}}>
                                          {p.variantes.filter(v=>v.available !== false).map((v, i) => (
                                              <button key={i} onClick={()=>addToCart(p, v)} style={{padding:'8px', background:'#eee', border:'none', borderRadius:'5px'}}>{v.nom} - {v.prix}DH</button>
                                          ))}
                                      </div>
                                  </div>
                              ) : (
                                  <div onClick={()=>addToCart(p)} style={{padding:'20px 10px', textAlign:'center'}}>
                                      <div style={{fontWeight:'bold'}}>{p.nom}</div>
                                      <div style={{color:COLORS.primary, fontWeight:'bold', marginTop:'5px'}}>{p.prix} DH</div>
                                  </div>
                              )}
                          </div>
                      ))}
                  </div>
              </div>

              {/* PARTIE DROITE : PANIER & PAIEMENT */}
              <div style={{width:'380px', background:'white', display:'flex', flexDirection:'column', borderLeft:'2px solid #ddd', boxShadow:'-5px 0 15px rgba(0,0,0,0.05)'}}>
                  <div style={{padding:'20px', borderBottom:'1px solid #eee', background:COLORS.secondary, color:'white'}}>
                      <input type="text" placeholder="Nom Client (ex: Table 4 / Ali)" value={posClientName} onChange={e=>setPosClientName(e.target.value)} style={{width:'100%', padding:'12px', borderRadius:'8px', border:'none', marginBottom:'10px', fontSize:'1rem'}}/>
                      <input type="tel" placeholder="N° Téléphone (Optionnel)" value={posPhone} onChange={e=>setPosPhone(e.target.value)} style={{width:'100%', padding:'12px', borderRadius:'8px', border:'none', fontSize:'1rem'}}/>
                  </div>

                  <div style={{flex:1, overflowY:'auto', padding:'10px'}}>
                      {posCart.length === 0 ? <p style={{textAlign:'center', color:'#999', marginTop:'50px'}}>Panier vide</p> : null}
                      {posCart.map(item => (
                          <div key={item.idCart} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px', borderBottom:'1px dashed #ddd'}}>
                              <div style={{fontWeight:'bold'}}>{item.nom}</div>
                              <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                                  <span>{item.prixFinal} DH</span>
                                  <button onClick={()=>removeFromCart(item.idCart)} style={{background:'#fee2e2', color:'red', border:'none', padding:'5px 10px', borderRadius:'5px', cursor:'pointer'}}>X</button>
                              </div>
                          </div>
                      ))}
                  </div>

                  <div style={{padding:'20px', borderTop:'2px solid #eee', background:'#fafafa'}}>
                      <textarea placeholder="Commentaire (ex: Sans oignons)" value={posNote} onChange={e=>setPosNote(e.target.value)} style={{width:'100%', padding:'10px', borderRadius:'8px', border:'1px solid #ddd', marginBottom:'15px', resize:'none'}}/>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px', fontSize:'1.5rem', fontWeight:'bold'}}>
                          <span>TOTAL</span>
                          <span style={{color:COLORS.primary}}>{totalCart} DH</span>
                      </div>
                      <div style={{display:'flex', gap:'10px', marginBottom:'10px'}}>
                          <button onClick={()=>validerCommandePOS('Espèces')} disabled={loading || posCart.length===0} style={{flex:1, padding:'15px', background:COLORS.success, color:'white', border:'none', borderRadius:'8px', fontSize:'1.1rem', fontWeight:'bold', cursor:'pointer'}}>💵 ESPÈCES</button>
                          <button onClick={()=>validerCommandePOS('TPE')} disabled={loading || posCart.length===0} style={{flex:1, padding:'15px', background:'#3B82F6', color:'white', border:'none', borderRadius:'8px', fontSize:'1.1rem', fontWeight:'bold', cursor:'pointer'}}>💳 TPE</button>
                      </div>
                      <button onClick={()=>setPosCart([])} style={{width:'100%', padding:'12px', background:'#fee2e2', color:'red', border:'none', borderRadius:'8px', fontWeight:'bold', cursor:'pointer'}}>🗑️ Vider le panier</button>
                  </div>
              </div>
          </div>
      );
  }

  // ==========================================
  // RENDU 3 : ÉCRAN ADMIN CLASSIQUE
  // ==========================================
  const zData = genererZDeCaisse();

  return (
    <div className="no-print" style={{ background: COLORS.bg, minHeight: '100vh', paddingBottom: '100px', color: COLORS.secondary }}>
      <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
          
          <div style={{marginBottom:'20px', display:'flex', flexWrap:'wrap', gap:'10px', alignItems:'center', justifyContent:'space-between'}}>
              <h2 style={{margin:0}}>⚙️ Tableau de Bord</h2>
              <div style={{display:'flex', gap:'10px'}}>
                  <button onClick={()=>setShowZDeCaisse(true)} style={{padding:'10px 15px', borderRadius:'8px', border:'none', background:'#3B82F6', color:'white', fontWeight:'bold', cursor:'pointer'}}>📊 Z de Caisse</button>
                  <button onClick={()=>setAppMode('POS')} style={{padding:'10px 15px', borderRadius:'8px', border:'none', background:COLORS.primary, color:'white', fontWeight:'bold', cursor:'pointer'}}>🍔 OUVRIR LA CAISSE</button>
                  <button onClick={() => auth.signOut()} style={{padding:'10px 15px', borderRadius:'8px', border:'none', background:'#eee', cursor:'pointer'}}>Déconnexion</button>
              </div>
          </div>

          {/* MODAL Z DE CAISSE */}
          {showZDeCaisse && (
              <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000}}>
                  <div style={{background:'white', padding:'30px', borderRadius:'15px', width:'90%', maxWidth:'400px'}}>
                      <h2 style={{marginTop:0, textAlign:'center'}}>📊 Fin de Service</h2>
                      <p style={{textAlign:'center', color:'#666'}}>Aujourd'hui ({new Date().toLocaleDateString()})</p>
                      <hr style={{margin:'20px 0'}}/>
                      <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px', fontSize:'1.2rem'}}><span>Espèces (Tiroir) :</span> <strong>{zData.totalEspeces} DH</strong></div>
                      <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px', fontSize:'1.2rem'}}><span>TPE (Carte) :</span> <strong>{zData.totalTPE} DH</strong></div>
                      <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px', fontSize:'1.2rem', color:'#666'}}><span>Livr. App/Web :</span> <strong>{zData.totalLivrApp} DH</strong></div>
                      <hr style={{margin:'20px 0'}}/>
                      <div style={{display:'flex', justifyContent:'space-between', fontSize:'1.5rem', color:COLORS.primary}}><span>TOTAL JOUR :</span> <strong>{zData.totalGeneral} DH</strong></div>
                      <div style={{textAlign:'center', marginTop:'10px', color:'#666'}}>Nombre de commandes : {zData.nbCommandes}</div>
                      <button onClick={()=>setShowZDeCaisse(false)} style={{width:'100%', padding:'15px', background:COLORS.secondary, color:'white', border:'none', borderRadius:'10px', marginTop:'20px', fontSize:'1.1rem', cursor:'pointer'}}>Fermer</button>
                  </div>
              </div>
          )}

          {/* STATUS BOUTIQUE */}
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
            {commandes.slice(0, 50).map(cmd => (
              <div key={cmd.id} style={{ background:'white', borderRadius:'16px', padding:'15px', borderLeft: cmd.status === 'Terminé' ? '5px solid #ccc' : (cmd.status === 'Annulé' ? `5px solid ${COLORS.danger}` : `5px solid ${COLORS.success}`), opacity: cmd.status === 'Annulé' ? 0.6 : 1 }}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'start', borderBottom:'1px solid #f0f0f0', paddingBottom:'10px', marginBottom:'10px'}}>
                  <div>
                      <strong style={{fontSize:'1.2rem'}}>{cmd.client || 'Client'}</strong>
                      <div style={{color: COLORS.textLight}}>📞 {cmd.tel || 'N/A'}</div>
                      <div style={{fontSize:'0.8rem', color: '#666'}}>{cmd.methodePaiement ? `💳 ${cmd.methodePaiement}` : '🌐 App/Web'}</div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:'1.3rem', fontWeight:'bold', color: COLORS.primary}}>{cmd.total} DH</div>
                    <div style={{fontSize:'0.8rem', color:cmd.status==='Annulé'?'red':'#666'}}>{cmd.status}</div>
                  </div>
                </div>
                
                {cmd.commentaire && <div style={{background: COLORS.warning, color:'white', padding:'8px', borderRadius:'8px', fontSize:'0.9rem', fontWeight:'bold', marginBottom:'10px'}}>📝 {cmd.commentaire}</div>}
                
                <ul style={{listStyle:'none', padding:0, marginBottom:'15px'}}>
                  {cmd.items?.map((it, i) => (
                    <li key={i} style={{padding:'5px 0', borderBottom:'1px dashed #eee', display:'flex', justifyContent:'space-between'}}>
                      <span><strong>{it.nom}</strong> <span style={{fontSize:'0.8rem', color:'#666'}}>{it.varianteNom ? `(${it.varianteNom})` : ''}</span></span>
                      <span>{it.prixFinal} DH</span>
                    </li>
                  ))}
                </ul>

                <div style={{display:'flex', gap:'10px'}}>
                  {cmd.status !== 'Terminé' && cmd.status !== 'Annulé' && <button onClick={()=>changerStatus(cmd.id, 'Terminé')} style={{flex:1, padding:'10px', background: COLORS.success, color:'white', border:'none', borderRadius:'8px', fontWeight:'bold'}}>✅ SERVI</button>}
                  {cmd.status !== 'Annulé' && <button onClick={()=>changerStatus(cmd.id, 'Annulé')} style={{flex:1, padding:'10px', background: COLORS.danger, color:'white', border:'none', borderRadius:'8px', fontWeight:'bold'}}>❌ ANNULER</button>}
                  <button onClick={()=>supprimerCmd(cmd.id)} style={{padding:'10px', background:'#fee2e2', color:'red', border:'none', borderRadius:'8px'}}>🗑️</button>
                </div>
              </div>
            ))}
          </div>

          <h3 style={{marginBottom:'15px'}}>📦 Gestion du Menu</h3>
          <div style={{background:'white', padding:'20px', borderRadius:'15px'}}>
             <div style={{ overflowX: 'auto', display:'flex', gap:'10px', paddingBottom:'15px', marginBottom:'15px' }}>
              {Array.isArray(menu) && [...new Set(menu.map(p=>p.categorie))].map(c => <button key={c} onClick={() => setAdminCategorie(c)} style={{padding:'8px 15px', borderRadius:'20px', border:'none', background: adminCategorie===c?COLORS.secondary:'#eee', color:adminCategorie===c?'white':'black', cursor:'pointer', whiteSpace:'nowrap'}}>{c}</button>)}
             </div>

             {menu.filter(p => p.categorie === adminCategorie).map(p => (
              <div key={p.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px', borderBottom:'1px solid #f0f0f0', background: p.available === false ? '#FFF5F5' : 'white'}}>
                <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                  <button onClick={() => toggleAvailability(p)} style={{padding:'5px 10px', border:'none', borderRadius:'5px', background:p.available?COLORS.success:'#ccc', color:'white'}}>{p.available ? 'ON' : 'OFF'}</button>
                  <div style={{fontWeight:'bold', textDecoration: p.available === false ? 'line-through' : 'none'}}>{p.nom} - {p.variantes?.length>0 ? 'Multi' : p.prix+' DH'}</div>
                </div>
                <div style={{display:'flex', gap:'10px'}}>
                    <button onClick={() => {setEditId(p.id); setFormProd({nom: p.nom, description: p.description||'', categorie: p.categorie, prixBase: p.prix, variantes: p.variantes||[]}); window.scrollTo(0,0);}} style={{border:'none', background:'transparent', fontSize:'1.2rem', cursor:'pointer'}}>✏️</button>
                    <button onClick={()=>supprimerProduit(p.id)} style={{color:'red', border:'none', background:'transparent', cursor:'pointer'}}>X</button>
                </div>
              </div>
            ))}
          </div>
      </div>
    </div>
  );
}

// STYLES D'IMPRESSION (À ajouter manuellement dans ton App.css si le JS ne suffit pas, mais géré ici)
const printStyles = `
  @media print {
    .no-print { display: none !important; }
    .print-only { display: block !important; width: 80mm; font-family: 'Courier New', monospace; color: black; background: white; padding: 0; margin: 0; }
    .ticket-80mm { width: 75mm; margin: 0 auto; padding-bottom: 20px; }
    .page-break { page-break-after: always; }
    body, html { background: white; width: 80mm; margin: 0; padding: 0; }
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
