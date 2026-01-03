import { useState, useEffect, useRef } from 'react';
import { db, auth } from './firebase';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, query, writeBatch } from 'firebase/firestore';
import './App.css';

// --- CONFIGURATION ---
const LISTE_VIANDES = ["Poulet", "Viande Hachée", "Cordon Bleu", "Nuggets", "Poulet Crispy"];
const LISTE_GARNITURES_PIZZA = ["Viande Hachée", "Poulet", "4 Fromages", "Cannibale", "Pepperoni", "Thon", "Charcuterie", "Végétarienne", "Fruits de Mer"];
const LISTE_SAUCES = ["Algérienne Fait Maison", "Biggy Fait Maison", "Barbecue Fait Maison"];

// SON NOTIFICATION
const NOTIF_SOUND = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

// --- THEME ---
const COLORS = {
  primary: '#A84438',    
  secondary: '#1A1E29',  
  bg: '#F9FAFB',         
  card: '#FFFFFF',       
  success: '#10B981',
  danger: '#EF4444',
  warning: '#F59E0B',    
  textLight: '#6B7280'   
};

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('landing'); 
  const [menu, setMenu] = useState([]);
  const [commandes, setCommandes] = useState([]);
  
  // Son
  const prevCommandesLength = useRef(0);
  const audioRef = useRef(new Audio(NOTIF_SOUND));

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [categorieActive, setCategorieActive] = useState('Tout'); 
  const [adminCategorie, setAdminCategorie] = useState('Tout');

  const [panier, setPanier] = useState([]);
  const [clientNom, setClientNom] = useState('');
  const [clientTel, setClientTel] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [typeCommande, setTypeCommande] = useState('sur_place');
  const [adresse, setAdresse] = useState('');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Admin manuel
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [categorie, setCategorie] = useState('Burgers');
  const [prixBase, setPrixBase] = useState('');
  const [variantes, setVariantes] = useState([]);
  const [tempVarNom, setTempVarNom] = useState('');
  const [tempVarPrix, setTempVarPrix] = useState('');

  // --- DATA ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) setView('admin');
    });
    
    const unsubscribeMenu = onSnapshot(collection(db, "produits"), (snap) => {
      setMenu(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const q = query(collection(db, "commandes"));
    const unsubscribeCmd = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => b.date.seconds - a.date.seconds);
      
      // SON ADMIN
      if (list.length > prevCommandesLength.current && user) {
          audioRef.current.play().catch(e => console.log("Clic requis"));
      }
      prevCommandesLength.current = list.length;
      setCommandes(list);
    });

    return () => { unsubscribeAuth(); unsubscribeMenu(); unsubscribeCmd(); };
  }, [user]);

  // --- LOGIQUE CLIENT ---
  const categoriesUniques = ['Tout', ...new Set(menu.map(p => p.categorie))];

  const menuClient = menu.filter(p => {
    const isCatOK = categorieActive === 'Tout' ? true : p.categorie === categorieActive;
    return isCatOK && p.available !== false;
  });

  const menuAdmin = adminCategorie === 'Tout' ? menu : menu.filter(p => p.categorie === adminCategorie);

  const ajouterAuPanier = (itemFinal) => {
    if (navigator.vibrate) navigator.vibrate(50);
    setPanier([...panier, { ...itemFinal, uniqueId: Date.now() }]);
    setSelectedProduct(null); 
  };

  const retirerDuPanier = (uid) => setPanier(panier.filter(i => i.uniqueId !== uid));
  const total = panier.reduce((acc, i) => acc + Number(i.prixFinal), 0);

  const envoyerCommande = async () => {
    if (panier.length === 0) return alert("Panier vide !");
    if (!clientNom || !clientTel) return alert("Nom et Tél obligatoires.");
    if (typeCommande === 'livraison' && !adresse) return alert("Adresse obligatoire.");

    setLoading(true);
    try {
      await addDoc(collection(db, "commandes"), {
        client: clientNom, tel: clientTel, type: typeCommande, adresse, 
        commentaire: commentaire,
        items: panier, total, date: new Date(), status: 'En attente'
      });
      setPanier([]); setClientNom(''); setClientTel(''); setAdresse(''); setCommentaire('');
      alert("✅ Commande envoyée !"); setView('client');
    } catch (e) { alert("Erreur envoi"); }
    setLoading(false);
  };

  // --- ADMIN UTILS ---
  const toggleAvailability = async (item) => {
    await updateDoc(doc(db, "produits", item.id), { available: (item.available === false ? true : false) });
  };
  const copierOdoo = (cmd) => {
    let t = `Nom: ${cmd.client}\nTél: ${cmd.tel}\n`;
    t += cmd.type === 'livraison' ? `Livraison: ${cmd.adresse}` : `Mode: ${cmd.type === 'sur_place' ? 'Sur Place' : 'Emporter'}`;
    if(cmd.commentaire) t += `\nNOTE: ${cmd.commentaire}`;
    navigator.clipboard.writeText(t).then(() => alert("📋 Copié pour Odoo !"));
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

  const saveProduit = async () => {
    if(!nom) return; setLoading(true);
    await addDoc(collection(db, "produits"), { nom, description, categorie, image, date: new Date(), prix: variantes.length>0?0:Number(prixBase), variantes, available: true });
    setNom(''); setDescription(''); setImage(''); setPrixBase(''); setVariantes([]); setLoading(false); alert("Plat ajouté");
  };

  const supprimerProduit = async (id) => { if(confirm("Supprimer ?")) await deleteDoc(doc(db, "produits", id)); };
  
  const viderMenu = async () => {
      if(confirm("ATTENTION: Cela va supprimer TOUT le menu. Sûr ?")) {
          setLoading(true);
          const batch = writeBatch(db);
          menu.forEach(p => { const ref = doc(db, "produits", p.id); batch.delete(ref); });
          await batch.commit();
          setLoading(false); alert("Menu vidé !");
      }
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
        const start = rows[0].toLowerCase().includes('catégorie') ? 1 : 0;

        for (let i = start; i < rows.length; i++) {
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
                finalPrice = 0; 
                const catLower = cat.toLowerCase();
                let n1 = "Standard", n2 = "Moyen", n3 = "Grand";
                if (catLower.includes('tacos')) { n1 = "L"; n2 = "XL"; n3 = "XXL"; }
                else if (catLower.includes('pizza')) { n1 = "M"; n2 = "L"; n3 = "XL"; } 
                if(p1 > 0) variantsList.push({ nom: n1, prix: p1 });
                if(p2 > 0) variantsList.push({ nom: n2, prix: p2 });
                if(p3 > 0) variantsList.push({ nom: n3, prix: p3 });
             }
             if (variantsList.length === 0 && p1 > 0) finalPrice = p1;

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
      }
    };
    reader.readAsText(file);
  };

  // --- STYLES ---
  const btnStyle = { background: COLORS.primary, color: 'white', border: 'none', borderRadius: '12px', padding: '12px 20px', fontWeight: '600', cursor: 'pointer', width: '100%', fontSize: '1rem', boxShadow: '0 4px 6px rgba(168, 68, 56, 0.2)' };
  const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #E5E7EB', background: 'white', marginBottom: '10px', fontSize: '1rem', outline: 'none' };
  const cardStyle = { background: COLORS.card, borderRadius: '16px', padding: '15px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', border: '1px solid #F3F4F6' };

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', paddingBottom: '100px', color: COLORS.secondary }}>
      
      {/* --- LANDING PAGE --- */}
      {view === 'landing' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
          background: '#1A1E29', color: 'white', zIndex: 2000, 
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '20px'
        }}>
          {/* LOGO PNG ICI */}
          <img src="/logo.PNG" alt="Foodji Logo" style={{width: '180px', height: '180px', objectFit: 'contain', marginBottom: '20px', borderRadius: '20px'}} 
               onError={(e) => {e.target.style.display='none';}} /> 
          
          <h1 style={{fontSize: '3rem', margin: 0, color: '#A84438'}}>Foodji</h1>
          <p style={{fontSize: '1.2rem', color: '#9CA3AF', margin: '10px 0 40px 0'}}>Le goût authentique, en un clic.</p>
          
          <button onClick={() => setView('client')} style={{
            background: COLORS.primary, color: 'white', border: 'none', padding: '18px 40px', 
            borderRadius: '50px', fontSize: '1.2rem', fontWeight: 'bold', boxShadow: '0 0 20px rgba(168, 68, 56, 0.5)', cursor:'pointer'
          }}>
            COMMANDER
          </button>

          <button onClick={() => setView('login')} style={{
            background: 'transparent', border: '1px solid #374151', color: '#6B7280', 
            padding: '10px 20px', borderRadius: '30px', marginTop: '50px', fontSize: '0.8rem'
          }}>
            Accès Staff
          </button>
        </div>
      )}

      {/* HEADER */}
      {view !== 'landing' && (
        <div style={{ background: COLORS.card, padding: '15px 20px', position: 'sticky', top: 0, zIndex: 50, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{display:'flex', alignItems:'center', gap:'10px'}} onClick={() => setView('landing')}>
            <img src="/logo.PNG" style={{height:'30px', borderRadius:'5px'}} onError={(e)=>e.target.style.display='none'}/>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', letterSpacing: '-0.5px', color: COLORS.secondary }}>Foodji</h1>
          </div>
          {user ? (
            <button onClick={() => setView(view === 'admin' ? 'client' : 'admin')} style={{background: COLORS.secondary, color: 'white', border: 'none', padding: '8px 15px', borderRadius: '20px', fontSize:'0.8rem', fontWeight:'600'}}>
              {view === 'admin' ? 'Voir App' : 'Admin'}
            </button>
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
          <button onClick={async (e)=>{e.preventDefault(); try{await signInWithEmailAndPassword(auth,email,password)}catch(e){alert('Erreur')}}} style={btnStyle}>Connexion</button>
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
              <button onClick={viderMenu} style={{background: COLORS.danger, color:'white', border:'none', padding:'8px 15px', borderRadius:'8px', cursor:'pointer', fontWeight:'bold'}}>
                  🗑️ Reset
              </button>
          </div>

          <details style={{marginBottom:'20px', background:'#E0E7FF', padding:'15px', borderRadius:'10px'}}>
             <summary style={{cursor:'pointer', fontWeight:'bold', color:'#3730A3'}}>📥 Importer CSV</summary>
             <div style={{marginTop:'10px'}}>
               <p style={{fontSize:'0.9rem'}}>Format: Cat, Nom, Desc, P1, P2, P3</p>
               <input type="file" accept=".csv" onChange={handleCSVImport} />
               {loading && <p>Importation...</p>}
             </div>
          </details>

          <h3 style={{marginTop:'30px'}}>Commandes ({commandes.filter(c => c.status !== 'Terminé').length})</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px', marginBottom:'40px' }}>
            {commandes.map(cmd => (
              <div key={cmd.id} style={{ ...cardStyle, borderLeft: cmd.status === 'Terminé' ? '5px solid #ccc' : `5px solid ${COLORS.success}` }}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:'15px', paddingBottom:'15px', borderBottom:'1px solid #f0f0f0'}}>
                  <div><strong style={{fontSize:'1.2rem', display:'block'}}>{cmd.client}</strong><div style={{color: COLORS.textLight, marginTop:'4px'}}>📞 {cmd.tel}</div></div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:'1.3rem', fontWeight:'bold', color: COLORS.primary}}>{cmd.total} DH</div>
                    <button onClick={() => copierOdoo(cmd)} style={{marginTop:'5px', background: COLORS.secondary, color:'white', border:'none', padding:'6px 12px', borderRadius:'6px', fontSize:'0.75rem', cursor:'pointer'}}>📋 ODOO</button>
                  </div>
                </div>
                
                <div style={{marginBottom:'10px'}}>
                    {cmd.type === 'livraison' && <div style={{background:'#FEF3C7', color:'#D97706', padding:'8px', borderRadius:'8px', fontSize:'0.9rem', marginBottom:'5px'}}>🛵 <strong>{cmd.adresse}</strong></div>}
                    {cmd.commentaire && <div style={{background: COLORS.warning, color:'white', padding:'8px', borderRadius:'8px', fontSize:'0.9rem', fontWeight:'bold'}}>📝 Note: {cmd.commentaire}</div>}
                </div>
                
                <ul style={{listStyle:'none', marginBottom:'15px'}}>
                  {cmd.items.map((it, i) => (
                    <li key={i} style={{padding:'6px 0', borderBottom:'1px dashed #eee', lineHeight:'1.4'}}>
                      <strong>{it.nom}</strong> 
                      {it.varianteNom && <span style={{color: COLORS.textLight}}> ({it.varianteNom})</span>}
                      {it.sauces && it.sauces.length > 0 && <div style={{fontSize:'0.85rem', color:'#555', marginLeft:'10px'}}>Sauces: {formatOptions(it.sauces)}</div>}
                      {it.optionsChoisies && it.optionsChoisies.length > 0 && <div style={{fontSize:'0.85rem', color:'#555', marginLeft:'10px'}}>+ {formatOptions(it.optionsChoisies)}</div>}
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
             <div style={{ overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '15px', display:'flex', gap:'10px' }}>
              {categoriesUniques.map(c => (
                <button key={c} onClick={() => setAdminCategorie(c)} style={{padding:'8px 15px', borderRadius:'20px', border:'none', background: adminCategorie===c?COLORS.secondary:'#eee', color:adminCategorie===c?'white':'black', cursor:'pointer'}}>{c}</button>
              ))}
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
                <button onClick={()=>supprimerProduit(p.id)} style={{color:'red', border:'none', background:'transparent', cursor:'pointer'}}>X</button>
              </div>
            ))}
          </div>
          
           <details style={{marginTop:'30px', background:'white', padding:'15px', borderRadius:'10px'}}>
             <summary>Ajout Manuel</summary>
             <div style={{marginTop:'10px'}}>
                 <input placeholder="Nom" value={nom} onChange={e=>setNom(e.target.value)} style={inputStyle} />
                 <div style={{display:'flex', gap:'10px'}}>
                   <select value={categorie} onChange={e=>setCategorie(e.target.value)} style={{...inputStyle, width:'50%'}}><option>Burgers</option><option>Pizzas</option><option>Tacos</option></select>
                   <input type="number" placeholder="Prix" value={prixBase} onChange={e=>setPrixBase(e.target.value)} style={{...inputStyle, width:'50%'}} />
                 </div>
                 <button onClick={saveProduit} style={{...btnStyle, width:'auto'}}>Ajouter</button>
             </div>
           </details>
        </div>
      )}

      {/* --- CLIENT --- */}
      {view === 'client' && (
        <div style={{ padding: '20px' }}>
          <div style={{ overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '20px', scrollbarWidth: 'none', display:'flex', gap:'10px' }}>
            {categoriesUniques.map(c => (
              <button key={c} onClick={() => setCategorieActive(c)} style={{
                  border: 'none', display:'inline-block', padding:'10px 20px', borderRadius:'25px', 
                  background: categorieActive === c ? COLORS.secondary : 'white', 
                  color: categorieActive === c ? 'white' : COLORS.secondary,
                  fontWeight:'600', fontSize:'0.9rem', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', 
                  cursor: 'pointer', transition: '0.2s'
                }}>
                {c}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            {menuClient.map((plat) => (
              <div key={plat.id} onClick={() => setSelectedProduct(plat)} style={{ ...cardStyle, padding: 0, overflow: 'hidden', display:'flex', flexDirection:'column', cursor: 'pointer', position: 'relative' }}>
                <div style={{ height: '140px', background: '#eee', backgroundImage: `url(${plat.image || 'https://via.placeholder.com/300?text=Foodji'})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
                <div style={{ padding: '12px', flex: 1, display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
                  <div>
                    <h4 style={{ margin: '0 0 5px 0', fontSize: '1rem', fontWeight:'700', color: COLORS.secondary }}>{plat.nom}</h4>
                    <p style={{ fontSize: '0.8rem', color: COLORS.textLight, margin: 0, lineHeight:'1.2', display:'-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{plat.description}</p>
                  </div>
                  <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <span style={{ fontWeight: '700', fontSize: '1rem', color: COLORS.primary }}>
                       {plat.variantes?.length > 0 ? `dès ${Math.min(...plat.variantes.map(v=>v.prix))} DH` : `${plat.prix} DH`}
                     </span>
                     <div style={{background: COLORS.secondary, color: 'white', width: '32px', height: '32px', borderRadius: '50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem'}}>+</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {menuClient.length === 0 && <div style={{textAlign:'center', marginTop:'50px', color: COLORS.textLight}}>Aucun plat.</div>}
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
                        <div style={{fontWeight:'600'}}>{item.nom}</div>
                        <div style={{color: COLORS.textLight, fontSize:'0.9rem'}}>
                            {item.varianteNom}
                            {item.sauces && item.sauces.length > 0 && <div>+ {formatOptions(item.sauces)}</div>}
                            {item.optionsChoisies && item.optionsChoisies.length > 0 && <div>+ {formatOptions(item.optionsChoisies)}</div>}
                        </div>
                    </div>
                    <div style={{display:'flex', gap:'15px', alignItems:'center'}}>
                      <strong style={{color: COLORS.primary}}>{item.prixFinal} DH</strong>
                      <button onClick={() => retirerDuPanier(item.uniqueId)} style={{color:'#ccc', background:'transparent', border:'none', fontSize:'1.5rem'}}>×</button>
                    </div>
                  </div>
                ))}
                <div style={{textAlign:'right', fontSize:'1.5rem', fontWeight:'800', marginTop:'20px', color: COLORS.secondary}}>Total : {total} DH</div>
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
                <input type="text" value={clientNom} onChange={e => setClientNom(e.target.value)} style={inputStyle} placeholder="Nom" />
                <input type="tel" value={clientTel} onChange={e => setClientTel(e.target.value)} style={inputStyle} placeholder="Tél" />
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
          <span style={{fontWeight:'800', fontSize:'1.1rem'}}>{total} DH</span>
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

  let maxChoix = 0;
  let minChoix = 0;
  let listeOptions = [];
  let titreOptions = "";
  
  const nomLower = product.nom.toLowerCase();
  const catLower = product.categorie.toLowerCase();
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

  const currentPrice = selectedVar ? selectedVar.prix : product.prix;

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

        {/* Choix Sauces (TOUS LES TACOS) */}
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

        {/* Choix Options (Viandes / Garnitures) avec Compteurs */}
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
            if (minChoix > 0 && optionsChoisies.length < minChoix) { 
                alert(`Veuillez choisir au moins ${minChoix} options !`); 
                return; 
            }
            onAdd(product, selectedVar ? { ...selectedVar, optionsChoisies, sauces } : { optionsChoisies, sauces });
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