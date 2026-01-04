import { useState, useEffect, useRef } from 'react';
import { db, auth } from './firebase';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, query, writeBatch } from 'firebase/firestore';
import './App.css';

// --- CONFIGURATION ---
const SECURITY_CODE = "1234"; 
const LISTE_VIANDES = ["Poulet", "Viande Hachée", "Cordon Bleu", "Nuggets", "Poulet Crispy"];
const LISTE_GARNITURES_PIZZA = ["Viande Hachée", "Poulet", "4 Fromages", "Cannibale", "Pepperoni", "Thon", "Charcuterie", "Végétarienne", "Fruits de Mer"];
const LISTE_SAUCES = ["Algérienne Fait Maison", "Biggy Fait Maison", "Barbecue Fait Maison"];
const TYPES_PATES = ["Penne", "Tagliatelle", "Spaghetti"];

const TOUTES_CATEGORIES = ["Tacos", "Pizzas", "Burgers", "Pâtes", "Sides", "Les Burritos", "Koniks", "Plats", "Salades", "Boissons", "Desserts"];

const NOTIF_SOUND = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

// --- IMAGES ---
const logoImg = "/logo.png";
const iconImg = "/icon.png";

// --- THEME ---
const COLORS = {
  primary: '#A84438',    
  secondary: '#1A1E29',  
  bg: '#F9FAFB',         
  card: '#FFFFFF',       
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',
  promo: '#D97706',    
  textLight: '#6B7280'   
};

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('landing'); 
  const [menu, setMenu] = useState([]);
  const [commandes, setCommandes] = useState([]);
  
  const prevCommandesLength = useRef(0);
  const audioRef = useRef(new Audio(NOTIF_SOUND));
  const fileInputRef = useRef(null); 

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [categorieActive, setCategorieActive] = useState(''); 
  const [adminCategorie, setAdminCategorie] = useState(''); 

  const [panier, setPanier] = useState([]);
  const [clientNom, setClientNom] = useState('');
  const [clientTel, setClientTel] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [typeCommande, setTypeCommande] = useState('sur_place');
  const [adresse, setAdresse] = useState('');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Admin Form & Edit Mode
  const [editId, setEditId] = useState(null); 
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState(''); // State description
  const [image, setImage] = useState('');
  const [categorie, setCategorie] = useState('Burgers');
  const [prixBase, setPrixBase] = useState('');
  const [variantes, setVariantes] = useState([]); 

  // --- CHARGEMENT MEMOIRE CLIENT ---
  useEffect(() => {
      const savedNom = localStorage.getItem('clientNom');
      const savedTel = localStorage.getItem('clientTel');
      const savedAdresse = localStorage.getItem('clientAdresse');
      if (savedNom) setClientNom(savedNom);
      if (savedTel) setClientTel(savedTel);
      if (savedAdresse) setAdresse(savedAdresse);
  }, []);

  // --- DATA ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    
    const unsubscribeMenu = onSnapshot(collection(db, "produits"), (snap) => {
      setMenu(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const q = query(collection(db, "commandes"));
    const unsubscribeCmd = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => b.date.seconds - a.date.seconds);
      
      if (list.length > prevCommandesLength.current && user) {
          audioRef.current.play().catch(e => console.log("Clic requis pour son"));
      }
      prevCommandesLength.current = list.length;
      setCommandes(list);
    });

    return () => { unsubscribeAuth(); unsubscribeMenu(); unsubscribeCmd(); };
  }, [user]);

  // --- LOGIQUE CATEGORIES ---
  const categoriesReelles = [...new Set(menu.map(p => p.categorie))];
  const categoriesSelectAdmin = [...new Set([...TOUTES_CATEGORIES, ...categoriesReelles])];

  useEffect(() => {
      if (categoriesReelles.length > 0 && !adminCategorie) {
          setAdminCategorie(categoriesReelles[0]);
      }
  }, [menu, adminCategorie]);

  const isDimanche = new Date().getDay() === 0;
  let categoriesClient = [...categoriesReelles];
  if (isDimanche) {
      categoriesClient = ['🔥 PROMOTIONS', ...categoriesReelles];
  }
  useEffect(() => {
      if (categoriesClient.length > 0 && !categorieActive) {
          setCategorieActive(categoriesClient[0]);
      }
  }, [menu, categorieActive, isDimanche]);


  // --- FILTRAGE CLIENT ---
  let menuClient = [];
  if (categorieActive === '🔥 PROMOTIONS') {
      menuClient = [{
          id: 'promo-sunday',
          nom: '2 PIZZAS ACHETÉES = 1 OFFERTE',
          description: 'Offre du Dimanche : Ajoutez 3 pizzas, la moins chère est offerte en caisse !',
          categorie: '🔥 PROMOTIONS',
          prix: 0,
          image: 'https://img.freepik.com/free-vector/pizza-time-promo-banner_23-2148967986.jpg',
          available: true,
          isInfo: true 
      }];
  } else {
      menuClient = menu.filter(p => p.categorie === categorieActive && p.available !== false);
  }

  // --- FILTRAGE ADMIN ---
  let menuAdmin = [];
  if (adminCategorie === 'RUPTURE') {
      menuAdmin = menu.filter(p => p.available === false);
  } else {
      menuAdmin = menu.filter(p => p.categorie === adminCategorie);
  }

  // --- SECURITE ---
  const checkSecurity = () => {
      const code = prompt("🔒 Code de sécurité requis :");
      return code === SECURITY_CODE;
  };

  const triggerImport = () => {
      if(checkSecurity()) fileInputRef.current.click();
      else alert("Code incorrect ❌");
  };

  const handleCSVImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      const rows = text.split('\n').filter(r => r.trim() !== '');
      let count = 0;

      if(confirm(`Importer ${rows.length} lignes ?`)) {
        setLoading(true);
        for (let i = 1; i < rows.length; i++) { 
          const row = rows[i];
          const tokens = row.split(','); 
          
          if (tokens.length >= 5) {
             const cat = tokens[0].trim();
             const name = tokens[1].trim();
             const len = tokens.length;
             const p3Raw = tokens[len - 1];
             const p2Raw = tokens[len - 2];
             const p1Raw = tokens[len - 3];
             const descTokens = tokens.slice(2, len - 3);
             const desc = descTokens.join(', ').replace(/"/g, '').trim();
             const cleanPrice = (val) => val ? Number(val.toString().replace(/[^0-9.]/g, '')) : 0;
             const p1 = cleanPrice(p1Raw.replace(',','.'));
             const p2 = cleanPrice(p2Raw.replace(',','.'));
             const p3 = cleanPrice(p3Raw.replace(',','.'));

             let variantsList = [];
             let finalPrice = p1;

             if (p2 > 0 || p3 > 0) {
                finalPrice = p1 > 0 ? p1 : 0; 
                const catLower = cat.toLowerCase();
                let n1 = "Standard", n2 = "Moyen", n3 = "Grand";
                if (catLower.includes('tacos')) { n1 = "L"; n2 = "XL"; n3 = "XXL"; }
                else if (catLower.includes('pizza')) { n1 = "M"; n2 = "L"; n3 = "XL"; } 
                
                if(p1 > 0) variantsList.push({ nom: n1, prix: p1 });
                if(p2 > 0) variantsList.push({ nom: n2, prix: p2 });
                if(p3 > 0) variantsList.push({ nom: n3, prix: p3 });
             }

             if(name && cat) {
               await addDoc(collection(db, "produits"), {
                 categorie: cat, nom: name, description: desc, prix: finalPrice, 
                 image: '', variantes: variantsList, date: new Date(), available: true
               });
               count++;
             }
          }
        }
        setLoading(false); alert(`${count} produits importés !`);
        e.target.value = null; 
      }
    };
    reader.readAsText(file);
  };

  const viderMenu = async () => {
      if(!checkSecurity()) return alert("Code incorrect ❌");
      if(confirm("⚠️ ATTENTION : SUPPRESSION TOTALE DU MENU.\nConfirmer ?")) {
          setLoading(true);
          const batch = writeBatch(db);
          menu.forEach(p => { const ref = doc(db, "produits", p.id); batch.delete(ref); });
          await batch.commit();
          setLoading(false); alert("Menu vidé !");
      }
  };

  // --- NAVIGATION ---
  const handleStaffAccess = () => {
      if (user) setView('admin'); 
      else setView('login'); 
  };

  const ajouterAuPanier = (itemMerged) => {
    if (itemMerged.isInfo) return alert("Ceci est une offre informative.");
    if (navigator.vibrate) navigator.vibrate(50);
    
    let safePrice = Number(itemMerged.prixFinal);
    if (safePrice === 0 && itemMerged.variantes?.length > 0) {
        safePrice = itemMerged.prix || 0; 
    }

    const itemSafe = {
        ...itemMerged,
        prixFinal: safePrice, 
        originalPrice: safePrice,
        uniqueId: Date.now()
    };
    setPanier([...panier, itemSafe]);
    setSelectedProduct(null); 
  };

  const retirerDuPanier = (uid) => setPanier(panier.filter(i => i.uniqueId !== uid));
  
  const getPrixItemAjuste = (item) => {
      let prix = Number(item.originalPrice) || 0;
      if (item.nom.toLowerCase().includes("pep's") || item.nom.toLowerCase().includes("peps")) {
          if (typeCommande === 'livraison' || typeCommande === 'emporter') {
              prix += 5;
          }
      }
      return prix;
  };

  const sousTotal = panier.reduce((acc, i) => acc + getPrixItemAjuste(i), 0);
  const fraisLivraison = (typeCommande === 'livraison' && sousTotal < 45 && sousTotal > 0) ? 5 : 0;
  const grandTotal = sousTotal + fraisLivraison;

  const envoyerCommande = async () => {
    if (panier.length === 0) return alert("Panier vide !");
    if (!clientNom.trim()) return alert("Nom obligatoire.");
    
    const telClean = clientTel.replace(/\s/g, ''); 
    const marocRegex = /^(06|07)\d{8}$/;
    
    if (!telClean) return alert("Téléphone obligatoire.");
    if (!marocRegex.test(telClean)) {
        return alert("❌ Numéro invalide (06... ou 07... sur 10 chiffres)");
    }

    if (typeCommande === 'livraison' && !adresse.trim()) return alert("Adresse obligatoire.");

    setLoading(true);
    
    localStorage.setItem('clientNom', clientNom);
    localStorage.setItem('clientTel', telClean);
    if(adresse) localStorage.setItem('clientAdresse', adresse);

    const panierFinal = panier.map(item => ({
        ...item,
        prixFinal: getPrixItemAjuste(item)
    }));

    try {
      await addDoc(collection(db, "commandes"), {
        client: clientNom, tel: telClean, type: typeCommande, adresse, 
        commentaire: commentaire,
        items: panierFinal, total: grandTotal, fraisLivraison, date: new Date(), status: 'En attente'
      });
      setPanier([]); setCommentaire('');
      alert("✅ Commande envoyée !"); setView('client');
    } catch (e) { alert("Erreur réseau"); }
    setLoading(false);
  };

  // --- ADMIN UTILS ---
  const toggleAvailability = async (item) => {
    await updateDoc(doc(db, "produits", item.id), { available: (item.available === false ? true : false) });
  };
  
  // --- MODIFICATION INTELLIGENTE ---
  const handleEdit = (p) => {
      setEditId(p.id);
      setNom(p.nom);
      setDescription(p.description); // On remplit la description existante
      setCategorie(p.categorie);
      
      if (p.variantes && p.variantes.length > 0) {
          setVariantes(p.variantes);
          setPrixBase(''); 
      } else {
          setVariantes([]);
          setPrixBase(p.prix);
      }
      window.scrollTo(0,0);
  };

  const updateVariantPrice = (index, newVal) => {
      const newVars = [...variantes];
      newVars[index].prix = Number(newVal);
      setVariantes(newVars);
  };

  const saveProduit = async () => {
    if(!nom) return; 
    setLoading(true);
    
    const data = { 
        nom, description, categorie, // Description ajoutée à la sauvegarde
        prix: variantes.length > 0 ? 0 : Number(prixBase), 
        variantes, 
        available: true,
        date: new Date()
    };

    if(image) data.image = image;

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

  const supprimerProduit = async (id) => { if(confirm("Supprimer ?")) await deleteDoc(doc(db, "produits", id)); };
  
  const copierOdoo = (cmd) => {
    let t = `Nom : ${cmd.client}\nTél : ${cmd.tel}\n`;
    if (cmd.type === 'livraison') t += `Adresse : ${cmd.adresse}`;
    else t += `Mode : ${cmd.type === 'sur_place' ? 'Sur Place' : 'Emporter'}`;
    if (cmd.commentaire) t += `\nNote : ${cmd.commentaire}`;
    navigator.clipboard.writeText(t).then(() => alert("📋 Infos Client Copiées !"));
  };
  
  const changerStatus = async (id, st) => await updateDoc(doc(db, "commandes", id), { status: st });
  const supprimerCmd = async (id) => { if(confirm("Supprimer ?")) await deleteDoc(doc(db, "commandes", id)); };
  
  const updateProductImage = async (id, file) => {
    if(!file) return;
    const reader = new FileReader(); reader.readAsDataURL(file);
    reader.onload = (evt) => {
      const img = document.createElement("img"); img.src = evt.target.result;
      img.onload = async () => {
        const c = document.createElement("canvas"); const ctx = c.getContext("2d");
        const s = 800/img.width; c.width=800; c.height=img.height*s;
        ctx.drawImage(img,0,0,c.width,c.height); 
        await updateDoc(doc(db, "produits", id), { image: c.toDataURL("image/jpeg", 0.7) });
        alert("Image mise à jour !");
      }
    };
  };

  // --- STYLES ---
  const btnStyle = { background: COLORS.primary, color: 'white', border: 'none', borderRadius: '12px', padding: '12px 20px', fontWeight: '600', cursor: 'pointer', width: '100%', fontSize: '1rem', boxShadow: '0 4px 6px rgba(168, 68, 56, 0.2)' };
  const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #E5E7EB', background: 'white', marginBottom: '10px', fontSize: '1rem', outline: 'none' };
  const cardStyle = { background: COLORS.card, borderRadius: '16px', padding: '15px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', border: '1px solid #F3F4F6' };

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', paddingBottom: '100px', color: COLORS.secondary }}>
      
      {/* --- LANDING --- */}
      {view === 'landing' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
          background: '#1A1E29', color: 'white', zIndex: 2000, 
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px'
        }}>
          <img src={logoImg} alt="Foodji" style={{width: '220px', height: '220px', objectFit: 'contain', marginBottom: '40px'}} onError={(e) => {e.target.style.display='none';}} /> 
          <p style={{fontSize: '1.2rem', color: '#9CA3AF', margin: '0 0 50px 0', maxWidth: '300px'}}>Le goût authentique, commandé en un clic.</p>
          <button onClick={() => setView('client')} style={{
            background: COLORS.primary, color: 'white', border: 'none', padding: '20px 50px', 
            borderRadius: '50px', fontSize: '1.3rem', fontWeight: 'bold', boxShadow: '0 5px 20px rgba(168, 68, 56, 0.4)', cursor:'pointer'
          }}>VOIR LE MENU</button>
          <button onClick={handleStaffAccess} style={{background: 'transparent', border: '1px solid #374151', color: '#6B7280', padding: '10px 25px', borderRadius: '30px', marginTop: '60px', fontSize: '0.8rem', cursor:'pointer'}}>Accès Staff</button>
        </div>
      )}

      {/* HEADER */}
      {view !== 'landing' && (
        <div style={{ background: COLORS.card, padding: '15px 20px', position: 'sticky', top: 0, zIndex: 50, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{display:'flex', alignItems:'center', gap:'10px', cursor:'pointer'}} onClick={() => setView('landing')}>
            <img src={iconImg} style={{height:'35px', objectFit:'contain'}} alt="Accueil" />
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', letterSpacing: '-0.5px', color: COLORS.secondary }}>Foodji</h1>
          </div>
          {user ? (
            <button onClick={() => setView(view === 'admin' ? 'client' : 'admin')} style={{background: COLORS.secondary, color: 'white', border: 'none', padding: '8px 15px', borderRadius: '20px', fontSize:'0.8rem', fontWeight:'600'}}>{view === 'admin' ? 'App' : 'Admin'}</button>
          ) : (
            view === 'client' && <button onClick={() => setView('login')} style={{background:'transparent', border:'none', fontSize:'1.2rem'}}>🔒</button>
          )}
        </div>
      )}

      {/* --- MODAL --- */}
      {selectedProduct && (
        <ProductModal 
          product={selectedProduct} 
          onClose={() => setSelectedProduct(null)} 
          onAdd={ajouterAuPanier}
        />
      )}

      {/* --- LOGIN --- */}
      {view === 'login' && !user && (
        <div style={{ padding: '40px 20px', maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{marginBottom: '20px'}}>Staff Access</h2>
          <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={inputStyle}/>
          <input type="password" placeholder="Mot de passe" value={password} onChange={e=>setPassword(e.target.value)} style={inputStyle}/>
          <button onClick={async (e)=>{e.preventDefault(); try{await signInWithEmailAndPassword(auth,email,password); setView('admin');}catch(e){alert('Erreur')}}} style={btnStyle}>Connexion</button>
          <button onClick={() => setView('landing')} style={{marginTop:'20px', background:'transparent', border:'none', color: COLORS.textLight}}>Retour</button>
        </div>
      )}

      {/* --- ADMIN DASHBOARD --- */}
      {view === 'admin' && user && (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
          
          <div style={{marginBottom:'20px', display:'flex', gap:'10px', alignItems:'center', justifyContent:'space-between'}}>
              <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                <h2 style={{margin:0}}>⚙️ Admin</h2>
                <div style={{fontSize:'0.8rem', color: COLORS.success, background:'#ECFDF5', padding:'5px 10px', borderRadius:'10px'}}>🔊 Son Actif</div>
              </div>
              <button onClick={viderMenu} style={{background: COLORS.danger, color:'white', border:'none', padding:'8px 15px', borderRadius:'8px', cursor:'pointer', fontWeight:'bold'}}>🗑️ Reset</button>
          </div>

          <h3 style={{marginTop:'30px'}}>Commandes ({commandes.filter(c => c.status !== 'Terminé').length})</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px', marginBottom:'40px' }}>
            {commandes.map(cmd => (
              <div key={cmd.id} style={{ ...cardStyle, borderLeft: cmd.status === 'Terminé' ? '5px solid #ccc' : `5px solid ${COLORS.success}` }}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:'15px', paddingBottom:'15px', borderBottom:'1px solid #f0f0f0'}}>
                  <div><strong style={{fontSize:'1.2rem', display:'block'}}>{cmd.client}</strong><div style={{color: COLORS.textLight, marginTop:'4px'}}>📞 {cmd.tel}</div></div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:'1.3rem', fontWeight:'bold', color: COLORS.primary}}>{cmd.total} DH</div>
                    <button onClick={() => copierOdoo(cmd)} style={{marginTop:'5px', background: COLORS.secondary, color:'white', border:'none', padding:'6px 12px', borderRadius:'6px', fontSize:'0.75rem', cursor:'pointer'}}>📋 COPIER</button>
                  </div>
                </div>
                
                <div style={{marginBottom:'10px'}}>
                    {cmd.type === 'livraison' && <div style={{background:'#FEF3C7', color:'#D97706', padding:'8px', borderRadius:'8px', fontSize:'0.9rem', marginBottom:'5px'}}>🛵 <strong>{cmd.adresse}</strong></div>}
                    {cmd.commentaire && <div style={{background: COLORS.warning, color:'white', padding:'8px', borderRadius:'8px', fontSize:'0.9rem', fontWeight:'bold'}}>📝 Note: {cmd.commentaire}</div>}
                    {cmd.fraisLivraison > 0 && <div style={{color: COLORS.primary, fontSize:'0.85rem'}}>+ Livraison: 5 DH</div>}
                </div>
                
                <ul style={{listStyle:'none', marginBottom:'15px'}}>
                  {cmd.items.map((it, i) => (
                    <li key={i} style={{padding:'8px 0', borderBottom:'1px dashed #eee', lineHeight:'1.4'}}>
                      <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'2px'}}>
                          <span style={{fontSize:'0.75rem', fontWeight:'bold', color: COLORS.primary, background:'#FEE2E2', padding:'2px 6px', borderRadius:'4px'}}>
                              [{it.categorie.toUpperCase()}]
                          </span>
                          <strong style={{fontSize:'1.1rem'}}>{it.nom}</strong>
                      </div>
                      <div style={{display:'flex', justifyContent:'space-between', color: COLORS.secondary}}>
                          <span>
                              {it.choixPates && <strong style={{color: COLORS.primary, marginRight:'5px'}}>{it.choixPates}</strong>}
                              {it.varianteNom && <strong style={{color: COLORS.secondary, fontSize:'0.95rem'}}>({it.varianteNom})</strong>}
                          </span>
                          <strong style={{color: COLORS.textLight}}>{it.prixFinal} DH</strong>
                      </div>
                      {it.sauces && it.sauces.length > 0 && <div style={{fontSize:'0.85rem', color:'#555', marginLeft:'10px', marginTop:'2px'}}>Sauces: {formatOptions(it.sauces)}</div>}
                      {it.optionsChoisies && it.optionsChoisies.length > 0 && <div style={{fontSize:'0.85rem', color:'#555', marginLeft:'10px', marginTop:'2px'}}>+ {formatOptions(it.optionsChoisies)}</div>}
                    </li>
                  ))}
                </ul>

                <div style={{display:'flex', gap:'10px'}}>
                  {cmd.status !== 'Terminé' && <button onClick={()=>changerStatus(cmd.id, 'Terminé')} style={{...btnStyle, background: COLORS.success, padding:'10px'}}>✅ SERVI</button>}
                  <button onClick={()=>supprimerCmd(cmd.id)} style={{...btnStyle, background:'white', color:'red', border:'1px solid #eee', padding:'10px'}}>🗑️</button>
                </div>
              </div>
            ))}
          </div>

          <div style={{marginTop:'40px', borderTop:'2px solid #eee', paddingTop:'20px'}}>
             <h3 style={{marginBottom:'15px'}}>📦 Menu</h3>
             {/* ONGLETS ADMIN */}
             <div style={{ overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '15px', display:'flex', gap:'10px' }}>
              {categoriesReelles.map(c => (
                <button key={c} onClick={() => setAdminCategorie(c)} style={{
                    padding:'8px 15px', borderRadius:'20px', border:'none', 
                    background: adminCategorie===c?COLORS.secondary:'#eee', 
                    color:adminCategorie===c?'white':'black', cursor:'pointer'
                }}>{c}</button>
              ))}
              
              <button onClick={() => setAdminCategorie('RUPTURE')} style={{
                  padding:'8px 15px', borderRadius:'20px', border:'none', 
                  background: adminCategorie==='RUPTURE'?COLORS.danger:'#FEE2E2', 
                  color: adminCategorie==='RUPTURE'?'white':COLORS.danger, 
                  fontWeight:'bold', cursor:'pointer'
              }}>🚫 RUPTURE</button>
             </div>

             {menuAdmin.map(p => (
              <div key={p.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px', borderBottom:'1px solid #f0f0f0', background: p.available === false ? '#FFF5F5' : 'white', opacity: p.available === false ? 0.7 : 1}}>
                <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
                  <div onClick={() => toggleAvailability(p)} style={{width:'50px', height:'26px', background: p.available !== false ? COLORS.success : '#ccc', borderRadius:'20px', position:'relative', cursor:'pointer', transition:'0.3s'}}>
                    <div style={{width:'20px', height:'20px', background:'white', borderRadius:'50%', position:'absolute', top:'3px', left: p.available !== false ? '27px' : '3px', transition:'0.3s'}}></div>
                  </div>
                  <div style={{width:'40px', height:'40px', background:'#eee', borderRadius:'5px', overflow:'hidden', position:'relative'}}>
                    {p.image && <img src={p.image} style={{width:'100%', height:'100%', objectFit:'cover'}} />}
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
            
            {menuAdmin.length === 0 && <div style={{textAlign:'center', padding:'20px', color:'#999'}}>Aucun article ici.</div>}
          </div>
          
           <details style={{marginTop:'30px', background:'white', padding:'15px', borderRadius:'10px'}}>
             <summary>{editId ? '✏️ Modifier Produit' : 'Ajout Manuel'}</summary>
             <div style={{marginTop:'10px'}}>
                 <input placeholder="Nom" value={nom} onChange={e=>setNom(e.target.value)} style={inputStyle} />
                 
                 {/* NOUVEAU CHAMP DESCRIPTION (V47) */}
                 <textarea 
                    placeholder="Description" 
                    value={description} 
                    onChange={e=>setDescription(e.target.value)} 
                    style={{...inputStyle, height:'60px', fontFamily:'inherit', resize:'vertical'}} 
                 />

                 <div style={{display:'flex', gap:'10px', alignItems:'start'}}>
                   <select value={categorie} onChange={e=>setCategorie(e.target.value)} style={{...inputStyle, width:'50%'}}>
                       {categoriesSelectAdmin.map(cat => <option key={cat}>{cat}</option>)}
                   </select>
                   
                   {/* GESTION INTELLIGENTE DES PRIX VARIANTES */}
                   {variantes.length > 0 ? (
                       <div style={{width:'50%', display:'flex', gap:'5px', flexWrap:'wrap'}}>
                           {variantes.map((v, index) => (
                               <div key={index} style={{flex:1, minWidth:'80px'}}>
                                   <label style={{fontSize:'0.7rem', fontWeight:'bold', color: COLORS.textLight}}>{v.nom}</label>
                                   <input 
                                       type="number" 
                                       value={v.prix} 
                                       onChange={(e) => updateVariantPrice(index, e.target.value)} 
                                       style={{...inputStyle, marginBottom:0}} 
                                   />
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

           {/* ZONE DANGEREUSE */}
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

      {/* --- CLIENT --- */}
      {view === 'client' && (
        <div style={{ padding: '20px' }}>
          
          <div style={{ overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '20px', scrollbarWidth: 'none', display:'flex', gap:'10px' }}>
            {categoriesClient.map(c => (
              <button key={c} onClick={() => setCategorieActive(c)} style={{
                  border: 'none', display:'inline-block', padding:'10px 20px', borderRadius:'25px', 
                  background: categorieActive === c ? (c === '🔥 PROMOTIONS' ? COLORS.promo : COLORS.secondary) : 'white', 
                  color: categorieActive === c ? 'white' : COLORS.secondary,
                  fontWeight:'600', fontSize:'0.9rem', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', 
                  cursor: 'pointer', transition: '0.2s'
                }}>
                {c}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            {menuClient.map((plat) => {
              const displayPrice = plat.prix > 0 
                  ? plat.prix 
                  : (plat.variantes?.length > 0 ? Math.min(...plat.variantes.map(v=>v.prix)) : 0);

              return (
              <div key={plat.id} onClick={() => setSelectedProduct(plat)} style={{ ...cardStyle, padding: 0, overflow: 'hidden', display:'flex', flexDirection:'column', cursor: 'pointer', position: 'relative' }}>
                <div style={{ height: '140px', background: '#eee', backgroundImage: `url(${plat.image || 'https://via.placeholder.com/300?text=Foodji'})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                    {plat.isInfo && <div style={{position:'absolute', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:'bold', fontSize:'1.2rem', textAlign:'center', padding:'10px'}}>2 + 1 OFFERTE</div>}
                </div>
                <div style={{ padding: '12px', flex: 1, display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
                  <div>
                    <h4 style={{ margin: '0 0 5px 0', fontSize: '1rem', fontWeight:'700', color: COLORS.secondary }}>{plat.nom}</h4>
                    <p style={{ fontSize: '0.8rem', color: COLORS.textLight, margin: 0, lineHeight:'1.2', display:'-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{plat.description}</p>
                  </div>
                  <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <span style={{ fontWeight: '700', fontSize: '1rem', color: COLORS.primary }}>
                       {displayPrice > 0 ? (plat.variantes?.length > 0 ? `dès ${displayPrice} DH` : `${displayPrice} DH`) : 'GRATUIT'}
                     </span>
                     <div style={{background: COLORS.secondary, color: 'white', width: '32px', height: '32px', borderRadius: '50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem'}}>+</div>
                  </div>
                </div>
              </div>
            )})}
          </div>
          {menuClient.length === 0 && <div style={{textAlign:'center', marginTop:'50px', color: COLORS.textLight}}>Aucun plat disponible.</div>}
        </div>
      )}

      {/* --- PANIER --- */}
      {view === 'panier' && (
        <div style={{ padding: '20px', background: 'white', minHeight: '100vh' }}>
          <h2 style={{color: COLORS.secondary}}>🛒 Panier</h2>
          {panier.length === 0 ? <p>Panier vide.</p> : (
            <>
              <div style={{marginBottom:'30px'}}>
                {panier.map(item => (
                  <div key={item.uniqueId} style={{display:'flex', justifyContent:'space-between', padding:'15px 0', borderBottom:'1px solid #f0f0f0'}}>
                    <div>
                        <div style={{fontSize:'0.75rem', fontWeight:'bold', color: COLORS.primary, marginBottom:'2px'}}>
                            {item.categorie.toUpperCase()}
                        </div>
                        <div style={{fontWeight:'600'}}>
                            {item.nom} 
                            {item.choixPates && <span style={{color: COLORS.secondary, fontWeight:'bold'}}> ({item.choixPates})</span>}
                            {item.varianteNom && <span style={{color: COLORS.textLight}}> ({item.varianteNom})</span>}
                        </div>
                        <div style={{color: COLORS.textLight, fontSize:'0.9rem'}}>
                            {item.sauces && item.sauces.length > 0 && <div>Sauces: {formatOptions(item.sauces)}</div>}
                            {item.optionsChoisies && item.optionsChoisies.length > 0 && <div>+ {formatOptions(item.optionsChoisies)}</div>}
                        </div>
                    </div>
                    <div style={{display:'flex', gap:'15px', alignItems:'center'}}>
                      <strong style={{color: COLORS.primary}}>{getPrixItemAjuste(item)} DH</strong>
                      <button onClick={() => retirerDuPanier(item.uniqueId)} style={{color:'#ccc', background:'transparent', border:'none', fontSize:'1.5rem'}}>×</button>
                    </div>
                  </div>
                ))}
                
                {fraisLivraison > 0 && <div style={{textAlign:'right', color: COLORS.textLight, marginTop:'10px'}}>+ Frais de livraison (petites commandes) : 5 DH</div>}
                
                <div style={{textAlign:'right', fontSize:'1.5rem', fontWeight:'800', marginTop:'10px', color: COLORS.secondary}}>Total : {grandTotal} DH</div>
              </div>
              
              <div style={{background: COLORS.bg, padding: '20px', borderRadius: '16px'}}>
                <h3 style={{marginTop:0, fontSize:'1.1rem', marginBottom:'15px'}}>Infos Client</h3>
                <div style={{display:'flex', gap:'10px', marginBottom:'15px'}}>
                  {['sur_place', 'emporter', 'livraison'].map(t => (
                    <button key={t} onClick={() => setTypeCommande(t)} style={{
                      flex:1, padding:'10px 5px', borderRadius:'10px', border: typeCommande===t ? `2px solid ${COLORS.secondary}` : '1px solid #ddd', 
                      background: typeCommande===t ? COLORS.secondary : 'white', color: typeCommande===t ? 'white' : COLORS.textLight, fontWeight:'600', fontSize:'0.85rem'
                    }}>{t.replace('_',' ')}</button>
                  ))}
                </div>
                <input type="text" value={clientNom} onChange={e => setClientNom(e.target.value)} style={{...inputStyle, border: !clientNom ? '1px solid red' : '1px solid #ddd'}} placeholder="Nom *" required />
                <input type="tel" value={clientTel} onChange={e => setClientTel(e.target.value)} style={{...inputStyle, border: !clientTel ? '1px solid red' : '1px solid #ddd'}} placeholder="Tél (06/07...) *" required />
                {typeCommande === 'livraison' && <textarea value={adresse} onChange={e => setAdresse(e.target.value)} style={{...inputStyle, height:'80px'}} placeholder="Adresse..." />}
                
                <textarea 
                    value={commentaire} 
                    onChange={e => setCommentaire(e.target.value)} 
                    style={{...inputStyle, height:'60px', marginTop:'10px'}} 
                    placeholder="Commentaire (ex: sans oignons, code porte...)" 
                />

                <button onClick={envoyerCommande} disabled={loading} style={{...btnStyle, marginTop:'10px', background: COLORS.success}}>{loading ? '...' : 'COMMANDER'}</button>
              </div>
            </>
          )}
          <button onClick={() => setView('client')} style={{marginTop: '20px', width: '100%', padding: '15px', background: 'transparent', border: 'none', color: COLORS.textLight, fontWeight:'600'}}>Retour</button>
        </div>
      )}

      {/* --- FLOTTANT --- */}
      {view === 'client' && panier.length > 0 && (
        <div onClick={() => setView('panier')} style={{
          position: 'fixed', bottom: '30px', left: '5%', width: '90%', 
          background: COLORS.secondary, color: 'white', padding: '15px 25px', 
          borderRadius: '50px', display: 'flex', justifyContent: 'space-between', 
          alignItems: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', cursor: 'pointer', zIndex: 99
        }}>
          <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
            <span style={{background: COLORS.primary, color:'white', width:'28px', height:'28px', borderRadius:'50%', display:'flex', justifyContent:'center', alignItems:'center', fontWeight:'bold', fontSize:'0.9rem'}}>{panier.length}</span>
            <span style={{fontSize:'1rem', fontWeight:'500'}}>Voir le panier</span>
          </div>
          <span style={{fontWeight:'800', fontSize:'1.1rem'}}>{grandTotal} DH</span>
        </div>
      )}
    </div>
  );
}

// Fonction utilitaire
function formatOptions(list) {
    if(!list) return "";
    const counts = {};
    list.forEach(x => { counts[x] = (counts[x] || 0) + 1; });
    return Object.entries(counts).map(([name, count]) => count > 1 ? `${name} x${count}` : name).join(', ');
}

// --- MODAL PRODUIT ---
function ProductModal({ product, onClose, onAdd }) {
  const [selectedVar, setSelectedVar] = useState(product.variantes && product.variantes.length > 0 ? product.variantes[0] : null);
  const [optionsChoisies, setOptionsChoisies] = useState([]); 
  const [sauces, setSauces] = useState([]); 
  const [typePates, setTypePates] = useState(null); 

  let maxChoix = 0;
  let minChoix = 0;
  let listeOptions = [];
  let titreOptions = "";
  
  const nomLower = product.nom.toLowerCase();
  const catLower = product.categorie.toLowerCase();
  const isPates = catLower.includes('pâtes') || catLower.includes('pates');
  const isTacos = catLower.includes('tacos');
  const isMixte = isTacos && nomLower.includes('mixte');

  if (isMixte) {
      listeOptions = LISTE_VIANDES;
      titreOptions = "Choisissez vos viandes";
      minChoix = 2; 
      
      if (selectedVar?.nom === 'L' || selectedVar?.nom === 'Standard') maxChoix = 2;
      else if (selectedVar?.nom === 'XL') maxChoix = 3;
      else if (selectedVar?.nom === 'XXL') maxChoix = 4;
      else maxChoix = 2;
  }
  else if (catLower.includes('pizza')) {
      if (nomLower.includes('2 saisons')) { maxChoix = 2; minChoix = 2; listeOptions = LISTE_GARNITURES_PIZZA; titreOptions = "2 Garnitures"; }
      if (nomLower.includes('4 saisons')) { maxChoix = 4; minChoix = 4; listeOptions = LISTE_GARNITURES_PIZZA; titreOptions = "4 Garnitures"; }
  }

  const incrementOption = (opt, currentList, setList, max) => {
      if (currentList.length < max) {
          setList([...currentList, opt]);
      }
  };

  const decrementOption = (opt, currentList, setList) => {
      const index = currentList.indexOf(opt);
      if (index > -1) {
          const newList = [...currentList];
          newList.splice(index, 1);
          setList(newList);
      }
  };

  const getCount = (opt, list) => list.filter(x => x === opt).length;

  const currentPrice = selectedVar ? Number(selectedVar.prix) : Number(product.prix);

  return (
    <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'flex-end', justifyContent:'center'}}>
      <div style={{background:'white', width:'100%', maxWidth:'600px', borderRadius:'20px 20px 0 0', padding:'25px', maxHeight:'90vh', overflowY:'auto', animation:'slideUp 0.3s'}}>
        
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'start'}}>
            <h2 style={{margin:0, fontSize:'1.4rem'}}>{product.nom}</h2>
            <button onClick={onClose} style={{border:'none', background:'transparent', fontSize:'1.5rem', fontWeight:'bold'}}>×</button>
        </div>
        <p style={{color: COLORS.textLight, marginTop:'5px'}}>{product.description}</p>
        
        {/* Choix Taille */}
        {product.variantes && product.variantes.length > 0 && (
            <div style={{marginTop:'20px'}}>
                <div style={{fontWeight:'bold', marginBottom:'10px'}}>Taille</div>
                <div style={{display:'flex', gap:'10px', flexWrap:'wrap'}}>
                    {product.variantes.map(v => (
                        <button key={v.nom} 
                            onClick={() => { setSelectedVar(v); setOptionsChoisies([]); }} 
                            style={{
                                padding:'10px 20px', borderRadius:'8px', border: selectedVar?.nom === v.nom ? `2px solid ${COLORS.primary}` : '1px solid #ddd',
                                background: selectedVar?.nom === v.nom ? '#FFF5F5' : 'white', fontWeight:'bold'
                            }}>
                            {v.nom} - {v.prix} DH
                        </button>
                    ))}
                </div>
            </div>
        )}

        {/* --- SECTION PATES --- */}
        {isPates && (
            <div style={{marginTop:'25px', borderTop:'1px solid #eee', paddingTop:'15px'}}>
                <div style={{fontWeight:'bold', marginBottom:'10px'}}>Type de Pâtes (Obligatoire)</div>
                <div style={{display:'flex', gap:'10px'}}>
                    {TYPES_PATES.map(type => (
                        <button key={type} onClick={() => setTypePates(type)} style={{
                            flex:1, padding:'12px', borderRadius:'12px', 
                            border: typePates === type ? `2px solid ${COLORS.primary}` : '1px solid #ddd',
                            background: typePates === type ? '#FFF5F5' : 'white',
                            fontWeight: 'bold', color: typePates === type ? COLORS.primary : 'black'
                        }}>
                            {type}
                        </button>
                    ))}
                </div>
            </div>
        )}

        {/* Choix Sauces */}
        {isTacos && (
            <div style={{marginTop:'25px', borderTop:'1px solid #eee', paddingTop:'15px'}}>
                <div style={{fontWeight:'bold', marginBottom:'10px'}}>Sauces Maison <small style={{color:COLORS.textLight}}>(Max 2)</small></div>
                <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                    {LISTE_SAUCES.map(s => {
                        const count = getCount(s, sauces);
                        return (
                            <div key={s} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px dashed #eee'}}>
                                <span>{s}</span>
                                <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                                    {count > 0 && <button onClick={() => decrementOption(s, sauces, setSauces)} style={{width:'30px', height:'30px', borderRadius:'50%', border:'1px solid #ddd', background:'white', fontWeight:'bold'}}>-</button>}
                                    {count > 0 && <span style={{fontWeight:'bold'}}>{count}</span>}
                                    <button onClick={() => incrementOption(s, sauces, setSauces, 2)} style={{width:'30px', height:'30px', borderRadius:'50%', border:'none', background:COLORS.secondary, color:'white', fontWeight:'bold'}}>+</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}

        {/* Choix Options */}
        {maxChoix > 0 && (
            <div style={{marginTop:'25px', borderTop:'1px solid #eee', paddingTop:'15px'}}>
                <div style={{fontWeight:'bold', marginBottom:'10px'}}>
                    {titreOptions} <small style={{color: optionsChoisies.length < minChoix ? COLORS.danger : COLORS.success}}>
                        ({optionsChoisies.length}/{maxChoix}) {minChoix > 0 ? `- Min ${minChoix}` : ''}
                    </small>
                </div>
                <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                    {listeOptions.map(opt => {
                        const count = getCount(opt, optionsChoisies);
                        return (
                            <div key={opt} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px dashed #eee'}}>
                                <span>{opt}</span>
                                <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                                    {count > 0 && <button onClick={() => decrementOption(opt, optionsChoisies, setOptionsChoisies)} style={{width:'30px', height:'30px', borderRadius:'50%', border:'1px solid #ddd', background:'white', fontWeight:'bold'}}>-</button>}
                                    {count > 0 && <span style={{fontWeight:'bold'}}>{count}</span>}
                                    <button onClick={() => incrementOption(opt, optionsChoisies, setOptionsChoisies, maxChoix)} style={{width:'30px', height:'30px', borderRadius:'50%', border:'none', background:COLORS.primary, color:'white', fontWeight:'bold'}}>+</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        )}

        <button onClick={() => {
            if (isPates && !typePates) return alert("Veuillez choisir le type de pâtes !");
            if (minChoix > 0 && optionsChoisies.length < minChoix) return alert(`Veuillez choisir au moins ${minChoix} options !`); 
            
            const itemMerged = {
                ...product,
                prixFinal: currentPrice,
                varianteNom: selectedVar ? selectedVar.nom : null, 
                sauces: sauces,
                optionsChoisies: optionsChoisies,
                choixPates: typePates
            };

            onAdd(itemMerged);
        }} style={{
            background: COLORS.primary, color: 'white', border: 'none', borderRadius: '12px', 
            padding: '15px', fontWeight: 'bold', width: '100%', marginTop: '30px', fontSize: '1.1rem',
            opacity: (minChoix > 0 && optionsChoisies.length < minChoix) ? 0.5 : 1
        }}>
            {minChoix > 0 && optionsChoisies.length < minChoix ? `Choisir encore ${minChoix - optionsChoisies.length}` : `Ajouter au panier - ${currentPrice} DH`}
        </button>
      </div>
    </div>
  );
}

export default App;