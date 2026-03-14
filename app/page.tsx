import { useState, useEffect, useRef } from 'react';
import { db, auth } from './firebase';
import { signInWithEmailAndPassword, onAuthStateChanged, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  doc, 
  deleteDoc, 
  updateDoc, 
  setDoc,
  query, 
  writeBatch
} from 'firebase/firestore';
import './App.css';

const COLORS = {
  primary: '#A84438',    
  secondary: '#1A1E29',  
  bg: '#F3F4F6',        
  card: '#FFFFFF',        
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  promo: '#D97706',    
  textLight: '#6B7280',
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

const TOUTES_CATEGORIES = ["Tacos", "Pizzas", "Burgers", "Pâtes", "Sides", "Les Burritos", "Koniks", "Plats", "Salades", "Boissons", "Desserts"];

const STOCK_TABS = [
    { id: 'viandes', label: '🌮 Viandes' },
    { id: 'garnitures', label: '🍕 Garnitures' },
    { id: 'tailles_pizza', label: '📏 Tailles' },
    { id: 'pates', label: '🍝 Pâtes' },
    { id: 'sauces', label: '🥣 Sauces' }
];

const NOTIF_SOUND = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

function App() {
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [view, setView] = useState('login'); 
  
  const [menu, setMenu] = useState([]);
  const [commandes, setCommandes] = useState([]);
  
  const prevCommandesLength = useRef(0);
  const audioRef = useRef(null);
  const fileInputRef = useRef(null); 

  const [adminCategorie, setAdminCategorie] = useState(''); 
  const [rushMode, setRushMode] = useState('standard');
  const [isStoreOpen, setIsStoreOpen] = useState(true);

  const [stocks, setStocks] = useState({
      viandes: INIT_VIANDES, garnitures: INIT_GARNITURES_PIZZA, sauces: INIT_SAUCES, pates: INIT_PATES, tailles_pizza: INIT_TAILLES_PIZZA
  });
  const [activeStockTab, setActiveStockTab] = useState('viandes');
  const [newItemName, setNewItemName] = useState('');

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

  const SYNC_ID_VERSION = "053700";

  // 1. DESTRUCTEUR DE CACHE ET NETTOYAGE LOCAL STORAGE
  useEffect(() => {
    localStorage.clear();
    sessionStorage.clear();
    
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for(let registration of registrations) {
          registration.unregister();
        }
      });
    }
  }, []);

  // 2. FORÇAGE DE LA PERSISTANCE (Exécuté une seule fois)
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => {});
  }, []);

  // 3. ÉCOUTEUR D'AUTHENTIFICATION (Indépendant)
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => { 
        setUser(u);
        if (u) setView('admin');
        else setView('login');
        setIsAuthLoading(false);
    });
    return () => { unsubscribeAuth(); };
  }, []);

  // 4. ÉCOUTEURS DE DONNÉES SÉCURISÉS (Se déclenchent UNIQUEMENT si connecté)
  useEffect(() => {
    if (!user) return;

    const unsubStatus = onSnapshot(doc(db, "parametres", "status"), (docSnap) => {
      if (docSnap.exists()) setRushMode(docSnap.data().mode);
      else setDoc(doc(db, "parametres", "status"), { mode: 'standard' });
    });

    const unsubHoraires = onSnapshot(doc(db, "parametres", "horaires"), (docSnap) => {
        if (docSnap.exists()) setIsStoreOpen(docSnap.data().isOuvert);
        else setDoc(doc(db, "parametres", "horaires"), { isOuvert: true });
    });

    const unsubStocks = onSnapshot(doc(db, "parametres", "stocks"), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            setStocks({
                viandes: data.viandes || INIT_VIANDES, garnitures: data.garnitures || INIT_GARNITURES_PIZZA,
                sauces: data.sauces || INIT_SAUCES, pates: data.pates || INIT_PATES, tailles_pizza: data.tailles_pizza || INIT_TAILLES_PIZZA
            });
        } else {
            const initData = { viandes: INIT_VIANDES, garnitures: INIT_GARNITURES_PIZZA, sauces: INIT_SAUCES, pates: INIT_PATES, tailles_pizza: INIT_TAILLES_PIZZA };
            setDoc(doc(db, "parametres", "stocks"), initData);
            setStocks(initData);
        }
    });

    const unsubMenu = onSnapshot(collection(db, "produits"), (snap) => {
      setMenu(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const q = query(collection(db, "commandes"));
    const unsubCmd = onSnapshot(q, (snap) => {
      try {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          list.sort((a, b) => {
              const timeA = a.date?.seconds || (a.date ? new Date(a.date).getTime() / 1000 : 0);
              const timeB = b.date?.seconds || (b.date ? new Date(b.date).getTime() / 1000 : 0);
              return timeB - timeA;
          });
          
          if (list.length > prevCommandesLength.current) {
              if (!audioRef.current) audioRef.current = new Audio(NOTIF_SOUND);
              audioRef.current.play().catch(() => {});
          }
          prevCommandesLength.current = list.length;
          setCommandes(list);
      } catch (error) {
          console.error("Erreur de tri évitée");
      }
    });

    return () => { 
        unsubStatus(); unsubHoraires(); unsubStocks(); unsubMenu(); unsubCmd(); 
    };
  }, [user]);

  const categoriesReelles = [...new Set(menu.map(p => p.categorie))];
  const categoriesSelectAdmin = [...new Set([...TOUTES_CATEGORIES, ...categoriesReelles])];

  useEffect(() => {
      if (categoriesReelles.length > 0 && !adminCategorie) setAdminCategorie(categoriesReelles[0]);
  }, [menu]);

  let menuAdmin = [];
  if (adminCategorie === 'RUPTURE') menuAdmin = menu.filter(p => p.available === false);
  else menuAdmin = menu.filter(p => p.categorie === adminCategorie);

  const checkManagerAuth = () => {
      const code = prompt("🔒 Code Manager requis :");
      if (code === SYNC_ID_VERSION) return true;
      alert("❌ Code incorrect !");
      return false;
  };

  const triggerImport = () => { if (checkManagerAuth()) fileInputRef.current.click(); };

  const handleCSVImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      const rows = text.split('\n').filter(r => r.trim() !== '');
      if(confirm(`Importer ${rows.length} lignes ?`)) {
        setLoading(true);
        for (let i = 1; i < rows.length; i++) { 
          const row = rows[i];
          const tokens = row.split(','); 
          if (tokens.length >= 5) {
             const cat = tokens[0].trim(); const name = tokens[1].trim();
             const len = tokens.length;
             const p1Raw = tokens[len - 3]; const p2Raw = tokens[len - 2]; const p3Raw = tokens[len - 1];
             const clean = (val) => val ? Number(val.toString().replace(/[^0-9.]/g, '')) : 0;
             const p1 = clean(p1Raw.replace(',','.')); const p2 = clean(p2Raw.replace(',','.')); const p3 = clean(p3Raw.replace(',','.'));
             let vars = [];
             if (p2 > 0 || p3 > 0) {
                let n1="Standard", n2="Moyen", n3="Grand";
                if (cat.toLowerCase().includes('tacos')) { n1="L"; n2="XL"; n3="XXL"; }
                else if (cat.toLowerCase().includes('pizza')) { n1="M"; n2="L"; n3="XL"; }
                if(p1>0) vars.push({nom:n1, prix:p1, available: true});
                if(p2>0) vars.push({nom:n2, prix:p2, available: true});
                if(p3>0) vars.push({nom:n3, prix:p3, available: true});
             }
             if(name && cat) await addDoc(collection(db, "produits"), { categorie: cat, nom: name, description: tokens.slice(2, len - 3).join(', ').replace(/"/g, ''), prix: vars.length>0?0:p1, image: '', variantes: vars, date: new Date(), available: true });
          }
        }
        setLoading(false); alert("Import terminé !"); e.target.value = null; 
      }
    };
    reader.readAsText(file);
  };

  const viderMenu = async () => {
      if (!checkManagerAuth()) return;
      if(confirm("⚠️ SUPPRIMER TOUT LE MENU ?")) {
          setLoading(true);
          const batch = writeBatch(db);
          menu.forEach(p => { batch.delete(doc(db, "produits", p.id)); });
          await batch.commit();
          setLoading(false); alert("Menu vidé !");
      }
  };

  const toggleAvailability = async (item) => { await updateDoc(doc(db, "produits", item.id), { available: !item.available }); };
  
  const handleCategoryChange = (e) => {
      const cat = e.target.value;
      setCategorie(cat);
      if (!editId) {
          if (cat === 'Tacos') { setVariantes([{nom: 'L', prix: '', available: true}, {nom: 'XL', prix: '', available: true}, {nom: 'XXL', prix: '', available: true}]); setPrixBase(''); }
          else if (cat === 'Pizzas') { setVariantes([{nom: 'M', prix: '', available: true}, {nom: 'L', prix: '', available: true}]); setPrixBase(''); }
          else { setVariantes([]); }
      }
  };

  const handleEdit = (p) => {
      setEditId(p.id); setNom(p.nom); setDescription(p.description || ''); setCategorie(p.categorie);
      if (p.variantes && p.variantes.length > 0) { setVariantes(p.variantes.map(v => ({...v, available: v.available !== false}))); setPrixBase(''); } 
      else { setVariantes([]); setPrixBase(p.prix); }
      window.scrollTo(0,0);
  };

  const updateVariantPrice = (index, field, newVal) => {
      const newVars = [...variantes];
      if(field === 'available') newVars[index].available = newVal;
      else newVars[index].prix = Number(newVal);
      setVariantes(newVars);
  };

  const saveProduit = async () => {
    if(!nom) return; setLoading(true);
    const data = { nom, description, categorie, prix: variantes.length > 0 ? 0 : Number(prixBase), variantes, available: true, date: new Date() };
    if(image) data.image = image;
    if (editId) { await updateDoc(doc(db, "produits", editId), data); alert("Modifié !"); setEditId(null); } 
    else { await addDoc(collection(db, "produits"), data); alert("Ajouté !"); }
    setNom(''); setDescription(''); setImage(''); setPrixBase(''); setVariantes([]); setLoading(false);
  };

  const supprimerProduit = async (id) => { 
      if (!checkManagerAuth()) return;
      if(confirm("Confirmer la suppression définitive ?")) { await deleteDoc(doc(db, "produits", id)); }
  };

  const toggleStockItem = async (listName, index) => {
      const newList = [...stocks[listName]];
      newList[index].available = !newList[index].available;
      const newData = { ...stocks, [listName]: newList };
      await updateDoc(doc(db, "parametres", "stocks"), newData);
  };

  const addNewStockItem = async () => {
      if(!checkManagerAuth()) return;
      if(!newItemName.trim()) return;
      const newList = [...stocks[activeStockTab], { nom: newItemName.trim(), available: true }];
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
  
  const changerStatus = async (id, st) => { await updateDoc(doc(db, "commandes", id), { status: st }); };
  const supprimerCmd = async (id) => { if(confirm("Supprimer cette commande ?")) await deleteDoc(doc(db, "commandes", id)); };
  
  const updateProductImage = async (id, file) => {
    if(!file) return;
    const reader = new FileReader(); reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = document.createElement("img"); img.src = e.target.result;
      img.onload = async () => {
         const c = document.createElement("canvas"); const ctx = c.getContext("2d");
         const s = 800/img.width; c.width = 800; c.height = img.height*s;
         ctx.drawImage(img,0,0,c.width,c.height); 
         await updateDoc(doc(db, "produits", id), { image: c.toDataURL("image/jpeg", 0.7) });
         alert("Image mise à jour !");
      }
    };
  };

  const btnStyle = { 
      background: COLORS.primary, color: 'white', border: 'none', borderRadius: '12px', 
      padding: '12px 20px', fontWeight: '600', cursor: 'pointer', width: '100%', 
      fontSize: '1rem', boxShadow: '0 4px 6px rgba(168, 68, 56, 0.2)' 
  };
  const inputStyle = { 
      width: '100%', padding: '12px', borderRadius: '10px', 
      border: '1px solid #E5E7EB', background: 'white', marginBottom: '10px', 
      fontSize: '1rem', outline: 'none' 
  };
  const cardStyle = { 
      background: COLORS.card, borderRadius: '16px', padding: '15px', 
      boxShadow: '0 2px 10px rgba(0,0,0,0.03)', border: '1px solid #F3F4F6' 
  };

  if (isAuthLoading) {
      return (
          <div style={{ background: COLORS.secondary, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <div style={{fontSize:'3rem', marginBottom:'20px'}}>⚙️</div>
              <h3 style={{margin:0}}>Démarrage Admin...</h3>
          </div>
      );
  }

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', paddingBottom: '100px', color: COLORS.secondary }}>
      
      {view === 'login' && !user && (
        <div style={{ padding: '40px 20px', maxWidth: '400px', margin: '0 auto', textAlign: 'center', paddingTop: '10vh' }}>
          <h2 style={{marginBottom: '20px'}}>⚙️ Foodji Admin</h2>
          <input type="email" placeholder="Email Manager" value={email} onChange={e=>setEmail(e.target.value)} style={inputStyle}/>
          <input type="password" placeholder="Mot de passe" value={password} onChange={e=>setPassword(e.target.value)} style={inputStyle}/>
          
          <button onClick={async (e)=>{
              e.preventDefault(); 
              setLoading(true);
              try{
                  await signInWithEmailAndPassword(auth, email, password); 
                  setView('admin');
              } catch(error) {
                  alert('Erreur de connexion');
              }
              setLoading(false);
          }} style={btnStyle}>{loading ? '...' : 'Connexion'}</button>
        </div>
      )}

      {view === 'admin' && user && (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
          
          <div style={{marginBottom:'20px', display:'flex', gap:'10px', alignItems:'center', justifyContent:'space-between'}}>
              <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                <h2 style={{margin:0}}>⚙️ Tableau de Bord</h2>
                <div style={{fontSize:'0.8rem', color: COLORS.success, background:'#ECFDF5', padding:'5px 10px', borderRadius:'10px'}}>🔊 Son Actif</div>
              </div>
          </div>

          <div style={{background: 'white', padding: '15px', borderRadius: '16px', marginBottom: '20px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)'}}>
              <h3 style={{marginTop:0, marginBottom:'15px', fontSize:'1rem'}}>Ouverture / Fermeture du Restaurant</h3>
              <div style={{display:'flex', gap:'10px'}}>
                  <button onClick={() => updateDoc(doc(db, "parametres", "horaires"), { isOuvert: true })} style={{flex:1, padding:'12px', borderRadius:'10px', border: isStoreOpen ? `2px solid ${COLORS.success}` : '1px solid #ddd', background: isStoreOpen ? '#ECFDF5' : 'white', color: isStoreOpen ? COLORS.success : 'black', fontWeight:'bold', cursor:'pointer'}}>🟢 OUVERT</button>
                  <button onClick={() => updateDoc(doc(db, "parametres", "horaires"), { isOuvert: false })} style={{flex:1, padding:'12px', borderRadius:'10px', border: !isStoreOpen ? `2px solid ${COLORS.danger}` : '1px solid #ddd', background: !isStoreOpen ? '#FEF2F2' : 'white', color: !isStoreOpen ? COLORS.danger : 'black', fontWeight:'bold', cursor:'pointer'}}>🔴 FERMÉ</button>
              </div>
          </div>

          <div style={{background: 'white', padding: '15px', borderRadius: '16px', marginBottom: '30px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)'}}>
              <h3 style={{marginTop:0, marginBottom:'15px', fontSize:'1rem'}}>Gestion du Rush</h3>
              <div style={{display:'flex', gap:'10px', flexWrap:'wrap'}}>
                  <button onClick={() => updateDoc(doc(db, "parametres", "status"), { mode: 'standard' })} style={{flex:1, padding:'12px', borderRadius:'10px', border: rushMode === 'standard' ? `2px solid ${COLORS.success}` : '1px solid #ddd', background: rushMode === 'standard' ? '#ECFDF5' : 'white', color: rushMode === 'standard' ? COLORS.success : 'black', fontWeight:'bold', cursor:'pointer'}}>✅ Standard</button>
                  <button onClick={() => updateDoc(doc(db, "parametres", "status"), { mode: 'rush' })} style={{flex:1, padding:'12px', borderRadius:'10px', border: rushMode === 'rush' ? `2px solid ${COLORS.warning}` : '1px solid #ddd', background: rushMode === 'rush' ? '#FFFBEB' : 'white', color: rushMode === 'rush' ? COLORS.warning : 'black', fontWeight:'bold', cursor:'pointer'}}>⚠️ Rush (30min+)</button>
                  <button onClick={() => updateDoc(doc(db, "parametres", "status"), { mode: 'gros_rush' })} style={{flex:1, padding:'12px', borderRadius:'10px', border: rushMode === 'gros_rush' ? `2px solid ${COLORS.danger}` : '1px solid #ddd', background: rushMode === 'gros_rush' ? '#FEF2F2' : 'white', color: rushMode === 'gros_rush' ? COLORS.danger : 'black', fontWeight:'bold', cursor:'pointer'}}>🔥 Gros Rush (1h+)</button>
              </div>
          </div>

          <h3 style={{marginTop:'30px'}}>Commandes ({commandes.filter(c => c.status !== 'Terminé').length})</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px', marginBottom:'40px' }}>
            {commandes.map(cmd => (
              <div key={cmd.id} style={{ ...cardStyle, borderLeft: cmd.status === 'Terminé' ? '5px solid #ccc' : (cmd.status === 'En cours de validation' ? `5px solid ${COLORS.pending}` : `5px solid ${COLORS.success}`) }}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:'15px', paddingBottom:'15px', borderBottom:'1px solid #f0f0f0'}}>
                  <div>
                      <strong style={{fontSize:'1.2rem', display:'block'}}>{cmd.client || 'Client'}</strong>
                      <div style={{color: COLORS.textLight, marginTop:'4px'}}>📞 {cmd.tel || 'N/A'}</div>
                      <div style={{marginTop:'5px', fontSize:'0.8rem', fontWeight:'bold', color: COLORS.secondary, display:'flex', gap:'10px', alignItems:'center'}}>
                          <span>📍 {cmd.distance ? cmd.distance : 'N/A'} km</span>
                          {cmd.lat && cmd.lng && (<a href={`https://www.google.com/maps/search/?api=1&query=${cmd.lat},${cmd.lng}`} target="_blank" rel="noreferrer" style={{color: COLORS.primary, textDecoration:'underline'}}>Voir Map</a>)}
                      </div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:'1.3rem', fontWeight:'bold', color: COLORS.primary}}>{cmd.total || 0} DH</div>
                    <button onClick={() => copierOdoo(cmd)} style={{marginTop:'5px', background: COLORS.secondary, color:'white', border:'none', padding:'6px 12px', borderRadius:'6px', fontSize:'0.75rem', cursor:'pointer'}}>📋 COPIER</button>
                  </div>
                </div>
                
                <div style={{marginBottom:'10px'}}>
                    {cmd.status === 'En cours de validation' && <div style={{background: '#FFF7ED', color: '#C2410C', padding:'8px', borderRadius:'8px', fontSize:'0.9rem', fontWeight:'bold', marginBottom:'10px', border:'1px solid #FED7AA'}}>⚠️ GROS PANIER - À VALIDER TEL</div>}
                    {cmd.type === 'livraison' && <div style={{background:'#FEF3C7', color:'#D97706', padding:'8px', borderRadius:'8px', fontSize:'0.9rem', marginBottom:'5px'}}>🛵 <strong>{cmd.adresse || 'N/A'}</strong></div>}
                    {cmd.commentaire && <div style={{background: COLORS.warning, color:'white', padding:'8px', borderRadius:'8px', fontSize:'0.9rem', fontWeight:'bold'}}>📝 Note: {cmd.commentaire}</div>}
                    {cmd.remisePromo > 0 && <div style={{color: COLORS.danger, fontSize:'0.9rem', fontWeight:'bold', border:'1px solid red', padding:'5px', borderRadius:'5px', display:'inline-block'}}>🎁 REMISE PROMO: -{cmd.remisePromo} DH</div>}
                </div>
                
                <ul style={{listStyle:'none', marginBottom:'15px'}}>
                  {Array.isArray(cmd.items) && cmd.items.map((it, i) => (
                    <li key={i} style={{padding:'8px 0', borderBottom:'1px dashed #eee', lineHeight:'1.4'}}>
                      <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'2px'}}>
                          <span style={{fontSize:'0.75rem', fontWeight:'bold', color: COLORS.primary, background:'#FEE2E2', padding:'2px 6px', borderRadius:'4px'}}>
                              [{it.categorie ? it.categorie.toUpperCase() : 'PLAT'}]
                          </span>
                          <strong style={{fontSize:'1.1rem'}}>{it.nom || 'Inconnu'}</strong>
                      </div>
                      <div style={{display:'flex', justifyContent:'space-between', color: COLORS.secondary}}>
                          <span>
                              {it.choixPates && <strong style={{color: COLORS.primary, marginRight:'5px'}}>{it.choixPates}</strong>}
                              {it.varianteNom && <strong style={{color: COLORS.secondary, fontSize:'0.95rem'}}>({it.varianteNom})</strong>}
                          </span>
                          <strong style={{color: COLORS.textLight}}>{it.prixFinal || 0} DH</strong>
                      </div>
                      <div style={{fontSize:'0.85rem', color:'#444', marginLeft:'10px', marginTop:'2px'}}>
                          {it.isCheesyCrust && <div style={{fontWeight:'bold', color: COLORS.promo}}>★ CHEESY CRUST</div>}
                          {Array.isArray(it.extras) && it.extras.length > 0 && <div>+ {it.extras.map(e => e.nom).join(', ')}</div>}
                          {Array.isArray(it.sauces) && it.sauces.length > 0 && <div>Sauces: {formatOptions(it.sauces)}</div>}
                          {Array.isArray(it.optionsChoisies) && it.optionsChoisies.length > 0 && <div>+ {formatOptions(it.optionsChoisies)}</div>}
                          {Array.isArray(it.sans) && it.sans.length > 0 && <div style={{color: COLORS.danger, fontWeight:'bold'}}>🚫 {it.sans.join(', ')}</div>}
                      </div>
                    </li>
                  ))}
                </ul>

                <div style={{display:'flex', gap:'10px', flexWrap:'wrap'}}>
                  {cmd.status === 'En cours de validation' ? (
                      <>
                        <button onClick={()=>changerStatus(cmd.id, 'En attente')} style={{...btnStyle, background: COLORS.success, padding:'10px', flex:1}}>☎️ CLIENT OK</button>
                        <button onClick={()=>changerStatus(cmd.id, 'Refusé')} style={{...btnStyle, background: COLORS.danger, padding:'10px', flex:1}}>REFUSER</button>
                      </>
                  ) : (
                      <>
                          {cmd.status !== 'Terminé' && cmd.status !== 'Refusé' && <button onClick={()=>changerStatus(cmd.id, 'Terminé')} style={{...btnStyle, background: COLORS.success, padding:'10px'}}>✅ SERVI</button>}
                          <button onClick={()=>supprimerCmd(cmd.id)} style={{...btnStyle, background:'white', color:'red', border:'1px solid #eee', padding:'10px'}}>🗑️</button>
                      </>
                  )}
                </div>
              </div>
            ))}
          </div>

           <div style={{marginTop:'40px', borderTop:'2px solid #eee', paddingTop:'20px'}}>
             <h3 style={{marginBottom:'15px'}}>📦 Menu</h3>
             <div style={{ overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '15px', display:'flex', gap:'10px' }}>
              {categoriesReelles.map(c => (
                <button key={c} onClick={() => setAdminCategorie(c)} style={{padding:'8px 15px', borderRadius:'20px', border:'none', background: adminCategorie===c?COLORS.secondary:'#eee', color:adminCategorie===c?'white':'black', cursor:'pointer'}}>{c}</button>
              ))}
              <button onClick={() => setAdminCategorie('RUPTURE')} style={{padding:'8px 15px', borderRadius:'20px', border:'none', background: adminCategorie==='RUPTURE'?COLORS.danger:'#FEE2E2', color: adminCategorie==='RUPTURE'?'white':COLORS.danger, fontWeight:'bold', cursor:'pointer'}}>🚫 RUPTURE</button>
             </div>

             {menuAdmin.map(p => (
              <div key={p.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px', borderBottom:'1px solid #f0f0f0', background: p.available === false ? '#FFF5F5' : 'white', opacity: p.available === false ? 0.7 : 1}}>
                <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                  <div onClick={() => toggleAvailability(p)} style={{width:'50px', height:'26px', background: p.available !== false ? COLORS.success : '#ccc', borderRadius:'20px', position:'relative', cursor:'pointer', transition:'0.3s'}}>
                    <div style={{width:'20px', height:'20px', background:'white', borderRadius:'50%', position:'absolute', top:'3px', left: p.available !== false ? '27px' : '3px', transition:'0.3s'}}></div>
                  </div>
                  <div style={{width:'40px', height:'40px', background:'#eee', borderRadius:'5px', overflow:'hidden', position:'relative'}}>
                    {p.image && <img src={p.image} style={{width:'100%', height:'100%', objectFit:'cover'}} alt="" />}
                    <input type="file" onChange={(e)=>updateProductImage(p.id, e.target.files[0])} style={{position:'absolute', top:0, left:0, width:'100%', height:'100%', opacity:0, cursor:'pointer'}} />
                  </div>
                  <div>
                    <div style={{fontWeight:'bold', textDecoration: p.available === false ? 'line-through' : 'none'}}>{p.nom}</div>
                    <div style={{fontSize:'0.8rem', color: COLORS.textLight}}>{p.categorie} • {p.variantes?.length > 0 ? 'Multi-tailles' : p.prix + ' DH'}</div>
                  </div>
                </div>
                <div style={{display:'flex', gap:'10px'}}>
                    <button onClick={() => handleEdit(p)} style={{border:'none', background:'transparent', fontSize:'1.2rem', cursor:'pointer'}}>✏️</button>
                    <button onClick={()=>supprimerProduit(p.id)} style={{color:'red', border:'none', background:'transparent', cursor:'pointer'}}>X</button>
                </div>
              </div>
            ))}
          </div>
          
           <details style={{marginTop:'30px', background:'white', padding:'15px', borderRadius:'10px'}}>
             <summary>{editId ? '✏️ Modifier Produit' : 'Ajout Manuel'}</summary>
             <div style={{marginTop:'10px'}}>
                 <input placeholder="Nom" value={nom} onChange={e=>setNom(e.target.value)} style={inputStyle} />
                 <textarea placeholder="Description" value={description} onChange={e=>setDescription(e.target.value)} style={{...inputStyle, height:'60px', fontFamily:'inherit', resize:'vertical'}} />
                 <div style={{display:'flex', gap:'10px', alignItems:'start'}}>
                   <select value={categorie} onChange={handleCategoryChange} style={{...inputStyle, width:'50%'}}>
                       {categoriesSelectAdmin.map(cat => <option key={cat}>{cat}</option>)}
                   </select>
                   {variantes.length > 0 ? (
                       <div style={{width:'50%', display:'flex', gap:'5px', flexWrap:'wrap'}}>
                           {variantes.map((v, index) => (
                               <div key={index} style={{flex:1, minWidth:'120px', display:'flex', alignItems:'center', gap:'5px', background:'#F9FAFB', padding:'5px', borderRadius:'8px', border:'1px solid #eee'}}>
                                   <div style={{flex:1}}>
                                       <label style={{fontSize:'0.7rem', fontWeight:'bold', color: COLORS.textLight, display:'block'}}>{v.nom}</label>
                                       <input type="number" value={v.prix} onChange={(e) => updateVariantPrice(index, 'prix', e.target.value)} style={{...inputStyle, marginBottom:0, padding:'5px', fontSize:'0.9rem'}} />
                                   </div>
                                   <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                                       <label style={{fontSize:'0.6rem', color: COLORS.textLight}}>Dispo</label>
                                       <input type="checkbox" checked={v.available !== false} onChange={(e) => updateVariantPrice(index, 'available', e.target.checked)} style={{width:'20px', height:'20px'}} />
                                   </div>
                               </div>
                           ))}
                       </div>
                   ) : (
                       <input type="number" placeholder="Prix" value={prixBase} onChange={e=>setPrixBase(e.target.value)} style={{...inputStyle, width:'50%'}} />
                   )}
                 </div>
                 <button onClick={saveProduit} style={{...btnStyle, width:'auto', marginTop:'15px'}}>{editId ? 'Mettre à jour' : 'Ajouter'}</button>
                 {editId && <button onClick={() => {setEditId(null); setNom(''); setPrixBase(''); setVariantes([]); setDescription('');}} style={{...btnStyle, background:'gray', width:'auto', marginLeft:'10px'}}>Annuler</button>}
             </div>
           </details>

           <details style={{marginTop:'30px', background:'#FFF7ED', padding:'15px', borderRadius:'10px', border:`1px solid ${COLORS.promo}`}}>
                <summary style={{fontWeight:'bold', color: '#C2410C', cursor:'pointer'}}>🥕 GESTION DES STOCKS (ON/OFF)</summary>
                <div style={{marginTop:'20px'}}>
                    <div style={{ overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '20px', scrollbarWidth: 'none', display:'flex', gap:'10px' }}>
                        {STOCK_TABS.map(tab => (
                            <button key={tab.id} onClick={() => setActiveStockTab(tab.id)} style={{display:'inline-block', padding:'10px 20px', borderRadius:'25px', background: activeStockTab === tab.id ? COLORS.secondary : 'white', color: activeStockTab === tab.id ? 'white' : COLORS.secondary, fontWeight:'600', fontSize:'0.9rem', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', cursor: 'pointer', transition: '0.2s', border: activeStockTab === tab.id ? 'none' : '1px solid #ddd'}}>{tab.label}</button>
                        ))}
                    </div>
                    <div style={{background:'white', padding:'15px', borderRadius:'15px', marginTop:'10px'}}>
                        <div style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
                            {activeStockTab !== 'tailles_pizza' && (
                                 <>
                                    <input type="text" placeholder={`Ajouter dans ${STOCK_TABS.find(t=>t.id===activeStockTab).label}...`} value={newItemName} onChange={(e) => setNewItemName(e.target.value)} style={{...inputStyle, marginBottom:0}} />
                                    <button onClick={addNewStockItem} style={{...btnStyle, width:'auto'}}>Ajouter</button>
                                 </>
                            )}
                        </div>
                        <div style={{display:'flex', flexWrap:'wrap', gap:'10px'}}>
                            {stocks[activeStockTab] && Array.isArray(stocks[activeStockTab]) && stocks[activeStockTab].map((item, index) => (
                                <div key={item.nom} onClick={() => toggleStockItem(activeStockTab, index)} style={{padding:'12px 18px', borderRadius:'25px', cursor:'pointer', fontWeight:'bold', transition:'0.2s', background: item.available ? COLORS.success : '#E5E7EB', color: item.available ? 'white' : '#9CA3AF', border: item.available ? `1px solid ${COLORS.success}` : '1px solid #D1D5DB', display:'flex', alignItems:'center', gap:'8px', fontSize:'0.95rem'}}>
                                    <div style={{width:'12px', height:'12px', borderRadius:'50%', background: item.available ? 'white' : '#9CA3AF'}}></div>{item.nom}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
           </details>

           <details style={{marginTop:'50px', background:'#FEE2E2', padding:'15px', borderRadius:'10px', border:`1px solid ${COLORS.danger}`}}>
             <summary style={{fontWeight:'bold', color: COLORS.danger, cursor:'pointer'}}>💀 ZONE DANGEREUSE (Import / Reset)</summary>
             <input type="file" accept=".csv" ref={fileInputRef} onChange={handleCSVImport} style={{display:'none'}} />
             <div style={{marginTop:'20px', display:'flex', gap:'10px', flexDirection:'column'}}>
                <button onClick={triggerImport} style={{...btnStyle, background: 'white', color: COLORS.secondary, border:'1px solid #ccc'}}>📂 IMPORTER UN MENU (CSV)</button>
                <button onClick={viderMenu} style={{...btnStyle, background: COLORS.danger, color:'white'}}>🗑️ TOUT SUPPRIMER (RESET)</button>
             </div>
           </details>
        </div>
      )}
    </div>
  );
}

function formatOptions(list) {
    if(!list || !Array.isArray(list)) return "";
    const counts = {};
    list.forEach(x => { counts[x] = (counts[x] || 0) + 1; });
    return Object.entries(counts).map(([name, count]) => count > 1 ? `${name} x${count}` : name).join(', ');
}

export default App;