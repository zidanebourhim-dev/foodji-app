import { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, query, writeBatch } from 'firebase/firestore';
import './App.css';

// --- CONFIGURATION OPTIONS ---
const LISTE_VIANDES = ["Viande Hachée", "Poulet", "Dinde", "Nuggets", "Cordon Bleu", "Merguez"];
const LISTE_GARNITURES_PIZZA = ["Champignons", "Poivrons", "Thon", "Viande Hachée", "Poulet", "Jambon", "Oignons", "Olives"];
const LISTE_SAUCES = ["Algérienne", "Biggy", "Blanche", "Barbecue", "Samouraï", "Cheesy"];

// --- THEME ---
const COLORS = {
  primary: '#A84438',    
  secondary: '#1A1E29',  
  bg: '#F9FAFB',         
  card: '#FFFFFF',       
  success: '#10B981',
  danger: '#EF4444',    
  textLight: '#6B7280'   
};

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('client'); 
  const [menu, setMenu] = useState([]);
  const [commandes, setCommandes] = useState([]);
  
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [categorieActive, setCategorieActive] = useState('Tout'); 
  const [adminCategorie, setAdminCategorie] = useState('Tout');

  const [panier, setPanier] = useState([]);
  const [clientNom, setClientNom] = useState('');
  const [clientTel, setClientTel] = useState('');
  const [typeCommande, setTypeCommande] = useState('sur_place');
  const [adresse, setAdresse] = useState('');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // États manuels
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
      setCommandes(list);
    });
    return () => { unsubscribeAuth(); unsubscribeMenu(); unsubscribeCmd(); };
  }, []);

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
        client: clientNom, tel: clientTel, type: typeCommande, adresse, items: panier, total, date: new Date(), status: 'En attente'
      });
      setPanier([]); setClientNom(''); setClientTel(''); setAdresse('');
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
    navigator.clipboard.writeText(t).then(() => alert("📋 Copié pour Odoo !"));
  };
  const changerStatus = async (id, st) => await updateDoc(doc(db, "commandes", id), { status: st });
  const supprimerCmd = async (id) => { if(confirm("Supprimer ?")) await deleteDoc(doc(db, "commandes", id)); };
  
  const handleImage = (e) => {
      const file = e.target.files[0]; if(!file) return;
      const reader = new FileReader(); reader.readAsDataURL(file);
      reader.onload = (evt) => {
        const img = document.createElement("img"); img.src = evt.target.result;
        img.onload = () => {
            const c = document.createElement("canvas"); const ctx = c.getContext("2d");
            const s = 800/img.width; c.width=800; c.height=img.height*s;
            ctx.drawImage(img,0,0,c.width,c.height); setImage(c.toDataURL("image/jpeg", 0.7));
        }
      };
  };

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

  // --- IMPORT CSV SPECIAL (LOGIQUE SANDWICH) ---
  const handleCSVImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      const rows = text.split('\n').filter(r => r.trim() !== '');
      let count = 0;

      if(confirm(`Importer ${rows.length} lignes ?\n(Assurez-vous d'avoir vidé le menu avant)`)) {
        setLoading(true);
        // Sauter la ligne d'entête si besoin
        const start = rows[0].toLowerCase().includes('catégorie') ? 1 : 0;

        for (let i = start; i < rows.length; i++) {
          const row = rows[i];
          // On splitte par la virgule (format standard CSV)
          const tokens = row.split(','); 
          
          // Il faut au moins 5 colonnes (Cat, Nom, Desc, P1, P2...)
          if (tokens.length >= 5) {
             // 1. LE DÉBUT
             const cat = tokens[0].trim();
             const name = tokens[1].trim();

             // 2. LA FIN (Les 3 derniers sont FORCÉMENT les prix, ou vides)
             // On part de la fin du tableau pour être sûr
             const len = tokens.length;
             const p3Raw = tokens[len - 1];
             const p2Raw = tokens[len - 2];
             const p1Raw = tokens[len - 3];

             // 3. LE MILIEU (Tout ce qui reste est la Description)
             // On recolle les morceaux de description qui ont été coupés par des virgules
             const descTokens = tokens.slice(2, len - 3);
             const desc = descTokens.join(', ').replace(/"/g, '').trim();

             // Nettoyage Prix
             const cleanPrice = (val) => val ? Number(val.toString().replace(/[^0-9]/g, '')) : 0;
             const p1 = cleanPrice(p1Raw);
             const p2 = cleanPrice(p2Raw);
             const p3 = cleanPrice(p3Raw);

             let variantsList = [];
             let finalPrice = p1;

             // Logique Variantes Automatiques
             if (p2 > 0 || p3 > 0) {
                finalPrice = 0; // Si variantes, on affiche 0 (ou le min)
                const catLower = cat.toLowerCase();
                let n1 = "Standard", n2 = "Moyen", n3 = "Grand";
                
                if (catLower.includes('tacos')) { n1 = "L"; n2 = "XL"; n3 = "XXL"; }
                else if (catLower.includes('pizza')) { n1 = "M"; n2 = "L"; n3 = "XL"; } // M, L pour Pizza

                if(p1 > 0) variantsList.push({ nom: n1, prix: p1 });
                if(p2 > 0) variantsList.push({ nom: n2, prix: p2 });
                if(p3 > 0) variantsList.push({ nom: n3, prix: p3 });
             }
             // Si pas de variante, le prix est P1. Si P1 est 0, c'est une erreur du fichier ou un gratuit.
             if (variantsList.length === 0 && p1 > 0) {
                 finalPrice = p1;
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
        setLoading(false); 
        alert(`${count} produits importés ! Vérifiez les prix.`);
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
      
      {/* HEADER */}
      <div style={{ background: COLORS.card, padding: '15px 20px', position: 'sticky', top: 0, zIndex: 50, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{display:'flex', alignItems:'center', gap:'8px'}}>
          <div style={{width:'30px', height:'30px', background: COLORS.primary, borderRadius: '8px 0 8px 0'}}></div>
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

      {/* --- MODAL PRODUIT DETAIL --- */}
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
          <button onClick={() => setView('client')} style={{marginTop:'20px', background:'transparent', border:'none', color: COLORS.textLight}}>Retour</button>
        </div>
      )}

      {/* --- ADMIN DASHBOARD --- */}
      {view === 'admin' && user && (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
          
          <div style={{marginBottom:'20px', display:'flex', gap:'10px', alignItems:'center'}}>
              <h2 style={{margin:0}}>⚙️ Admin</h2>
              <button onClick={viderMenu} style={{background: COLORS.danger, color:'white', border:'none', padding:'8px 15px', borderRadius:'8px', cursor:'pointer', fontWeight:'bold'}}>
                  🗑️ TOUT SUPPRIMER (Reset)
              </button>
          </div>

          <details style={{marginBottom:'20px', background:'#E0E7FF', padding:'15px', borderRadius:'10px'}}>
             <summary style={{cursor:'pointer', fontWeight:'bold', color:'#3730A3'}}>📥 Importer CSV</summary>
             <div style={{marginTop:'10px'}}>
               <p style={{fontSize:'0.9rem'}}>Le fichier doit avoir : Cat, Nom, Desc, P1, P2, P3.</p>
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
                {cmd.type === 'livraison' && <div style={{background:'#FEF3C7', color:'#D97706', padding:'8px', borderRadius:'8px', fontSize:'0.9rem', marginBottom:'10px'}}>🛵 <strong>{cmd.adresse}</strong></div>}
                
                <ul style={{listStyle:'none', marginBottom:'15px'}}>
                  {cmd.items.map((it, i) => (
                    <li key={i} style={{padding:'6px 0', borderBottom:'1px dashed #eee', lineHeight:'1.4'}}>
                      <strong>{it.nom}</strong> 
                      {it.varianteNom && <span style={{color: COLORS.textLight}}> ({it.varianteNom})</span>}
                      {it.optionsChoisies && it.optionsChoisies.length > 0 && <div style={{fontSize:'0.85rem', color:'#555', marginLeft:'10px'}}>+ {it.optionsChoisies.join(', ')}</div>}
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
                    <div style={{fontSize:'0.8rem', color: COLORS.textLight}}>
                         {p.variantes && p.variantes.length > 0 
                            ? p.variantes.map(v => `${v.nom}:${v.prix}`).join(' | ') 
                            : `${p.prix} DH`}
                    </div>
                  </div>
                </div>
                <button onClick={()=>supprimerProduit(p.id)} style={{color:'red', border:'none', background:'transparent', cursor:'pointer'}}>X</button>
              </div>
            ))}
          </div>
          
           {/* FORM MANUEL (Replié par défaut) */}
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

      {/* --- CLIENT MENU --- */}
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
                       {plat.variantes?.length > 0 ? `${Math.min(...plat.variantes.map(v=>v.prix))} DH` : `${plat.prix} DH`}
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
                            {item.optionsChoisies && <div style={{fontSize:'0.8rem'}}>{item.optionsChoisies.join(', ')}</div>}
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
                <h3 style={{marginTop:0, fontSize:'1.1rem', marginBottom:'15px'}}>Finaliser</h3>
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

// --- MODAL PRODUIT ---
function ProductModal({ product, onClose, onAdd }) {
  const [selectedVar, setSelectedVar] = useState(product.variantes && product.variantes.length > 0 ? product.variantes[0] : null);
  const [optionsChoisies, setOptionsChoisies] = useState([]);

  // LOGIQUE COMPLEXE
  let maxChoix = 0;
  let listeOptions = [];
  let titreOptions = "";
  const nomLower = product.nom.toLowerCase();
  const catLower = product.categorie.toLowerCase();
  
  // Tacos
  if (catLower.includes('tacos') && (nomLower.includes('mixte') || selectedVar)) {
      listeOptions = LISTE_VIANDES;
      titreOptions = "Viandes";
      if (selectedVar?.nom === 'L') maxChoix = 2;
      else if (selectedVar?.nom === 'XL') maxChoix = 3;
      else if (selectedVar?.nom === 'XXL') maxChoix = 4;
      else maxChoix = 1;
  }
  // Pizzas
  else if (catLower.includes('pizza')) {
      if (nomLower.includes('2 saisons')) { maxChoix = 2; listeOptions = LISTE_GARNITURES_PIZZA; titreOptions = "2 Garnitures"; }
      if (nomLower.includes('4 saisons')) { maxChoix = 4; listeOptions = LISTE_GARNITURES_PIZZA; titreOptions = "4 Garnitures"; }
  }

  const toggleOption = (opt) => {
    if (optionsChoisies.includes(opt)) setOptionsChoisies(optionsChoisies.filter(o => o !== opt));
    else if (optionsChoisies.length < maxChoix) setOptionsChoisies([...optionsChoisies, opt]);
    else alert(`Max ${maxChoix}`);
  };

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

        {/* Choix Options */}
        {maxChoix > 0 && (
            <div style={{marginTop:'25px', borderTop:'1px solid #eee', paddingTop:'15px'}}>
                <div style={{fontWeight:'bold', marginBottom:'5px'}}>{titreOptions} <small style={{color: COLORS.primary}}>({optionsChoisies.length}/{maxChoix})</small></div>
                <div style={{display:'flex', flexWrap:'wrap', gap:'8px'}}>
                    {listeOptions.map(opt => (
                        <button key={opt} onClick={() => toggleOption(opt)}
                            style={{
                                padding:'8px 12px', borderRadius:'20px', border:'1px solid #ddd', fontSize:'0.9rem',
                                background: optionsChoisies.includes(opt) ? COLORS.secondary : 'white',
                                color: optionsChoisies.includes(opt) ? 'white' : 'black'
                            }}>
                            {opt}
                        </button>
                    ))}
                </div>
            </div>
        )}

        <button onClick={() => {
            if (maxChoix > 0 && optionsChoisies.length < maxChoix) { if(!confirm("Choix incomplets. Continuer ?")) return; }
            onAdd(product, selectedVar ? { ...selectedVar, optionsChoisies } : { optionsChoisies });
        }} style={{
            background: COLORS.primary, color: 'white', border: 'none', borderRadius: '12px', 
            padding: '15px', fontWeight: 'bold', width: '100%', marginTop: '30px', fontSize: '1.1rem'
        }}>
            Ajouter au panier - {currentPrice} DH
        </button>
      </div>
    </div>
  );
}

export default App;