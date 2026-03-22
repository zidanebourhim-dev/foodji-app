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

  // 1. FORÇAGE DE LA PERSISTANCE (Exécuté une seule fois)
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => {});
  }, []);

  // 2. ÉCOUTEUR D'AUTHENTIFICATION (Indépendant)
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => { 
        setUser(u);
        if (u) setView('admin');
        else setView('login');
        setIsAuthLoading(false);
    });
    return () => { unsubscribeAuth(); };
  }, []);

  // 3. ÉCOUTEURS DE DONNÉES SÉCURISÉS (Se déclenchent UNIQUEMENT si connecté)
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
             