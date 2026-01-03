import { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, query } from 'firebase/firestore';
import './App.css';

// --- THEME ---
const COLORS = {
  primary: '#A84438',    
  secondary: '#1A1E29',  
  bg: '#F9FAFB',         
  card: '#FFFFFF',       
  success: '#10B981',    
  textLight: '#6B7280'   
};

function App() {
  // --- ETATS ---
  const [user, setUser] = useState(null);
  const [view, setView] = useState('client'); 
  const [menu, setMenu] = useState([]);
  const [commandes, setCommandes] = useState([]);
  const [categorieActive, setCategorieActive] = useState('Tout');

  // Panier & Client
  const [panier, setPanier] = useState([]);
  const [clientNom, setClientNom] = useState('');
  const [clientTel, setClientTel] = useState('');
  const [typeCommande, setTypeCommande] = useState('sur_place');
  const [adresse, setAdresse] = useState('');
  
  // Admin
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [categorie, setCategorie] = useState('Burgers');
  const [prixBase, setPrixBase] = useState('');
  const [variantes, setVariantes] = useState([]);
  const [loading, setLoading] = useState(false);
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

  // --- PANIER ---
  const ajouterAuPanier = (plat, variante = null) => {
    if (navigator.vibrate) navigator.vibrate(50);
    setPanier([...panier, {
      ...plat,
      uniqueId: Date.now(),
      prixFinal: variante ? variante.prix : plat.prix,
      varianteNom: variante ? variante.nom : null
    }]);
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

  const menuFiltre = categorieActive === 'Tout' ? menu : menu.filter(p => p.categorie === categorieActive);

  // --- ADMIN UTILS ---
  const copierOdoo = (cmd) => {
    let t = `Nom: ${cmd.client}\nTél: ${cmd.tel}\n`;
    t += cmd.type === 'livraison' ? `Livraison: ${cmd.adresse}` : `Mode: ${cmd.type === 'sur_place' ? 'Sur Place' : 'Emporter'}`;
    navigator.clipboard.writeText(t).then(() => alert("📋 Copié pour Odoo !"));
  };
  const changerStatus = async (id, st) => await updateDoc(doc(db, "commandes", id), { status: st });
  const supprimerCmd = async (id) => { if(confirm("Supprimer ?")) await deleteDoc(doc(db, "commandes", id)); };
  
  const handleImage = (e) => { processImage(e.target.files[0], setImage); };
  
  const processImage = (file, callback) => {
    if(!file) return;
    const reader = new FileReader(); reader.readAsDataURL(file);
    reader.onload = (evt) => {
      const img = document.createElement("img"); img.src = evt.target.result;
      img.onload = () => {
        const c = document.createElement("canvas"); const ctx = c.getContext("2d");
        const s = 800/img.width; c.width=800; c.height=img.height*s;
        ctx.drawImage(img,0,0,c.width,c.height); callback(c.toDataURL("image/jpeg", 0.7));
      }
    };
  };

  const updateProductImage = async (id, file) => {
    processImage(file, async (base64) => {
      await updateDoc(doc(db, "produits", id), { image: base64 });
      alert("Image mise à jour !");
    });
  };

  const saveProduit = async () => {
    if(!nom) return; setLoading(true);
    await addDoc(collection(db, "produits"), { nom, description, categorie, image, date: new Date(), prix: variantes.length>0?0:Number(prixBase), variantes });
    setNom(''); setDescription(''); setImage(''); setPrixBase(''); setVariantes([]); setLoading(false); alert("Plat ajouté");
  };
  const supprimerProduit = async (id) => { if(confirm("Supprimer ?")) await deleteDoc(doc(db, "produits", id)); };

  // --- IMPORT CSV INTELLIGENT (TACOS/PIZZA) ---
  const handleCSVImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result;
      const rows = text.split('\n');
      let count = 0;

      if(confirm(`Importer ${rows.length} lignes ?\nAttention : Supprimez les plats de test avant.`)) {
        setLoading(true);
        for (let row of rows) {
          const cols = row.includes(';') ? row.split(';') : row.split(',');
          
          if (cols.length >= 4) {
             const cat = cols[0].trim(); // Colonne A
             const name = cols[1].trim(); // Colonne B
             const desc = cols[2].trim(); // Colonne C
             
             // Prix (Col D, E, F)
             const p1 = cols[3] ? Number(cols[3].trim().replace(/[^0-9.]/g, '')) : 0;
             const p2 = cols[4] ? Number(cols[4].trim().replace(/[^0-9.]/g, '')) : 0;
             const p3 = cols[5] ? Number(cols[5].trim().replace(/[^0-9.]/g, '')) : 0;

             let variantsList = [];
             let finalPrice = p1;

             // --- LOGIQUE DE NOMMAGE INTELLIGENTE ---
             if (p2 > 0 || p3 > 0) {
                finalPrice = 0; 
                const catLower = cat.toLowerCase();
                
                // Noms par défaut
                let n1 = "Standard", n2 = "Moyen", n3 = "Grand";

                // Si c'est un Tacos (3 tailles: L, XL, XXL)
                if (catLower.includes('tacos')) {
                    n1 = "L"; n2 = "XL"; n3 = "XXL";
                }
                // Si c'est une Pizza (2 tailles: M, L)
                else if (catLower.includes('pizza')) {
                    n1 = "M"; n2 = "L"; n3 = "XL";
                }

                if(p1 > 0) variantsList.push({ nom: n1, prix: p1 });
                if(p2 > 0) variantsList.push({ nom: n2, prix: p2 });
                if(p3 > 0) variantsList.push({ nom: n3, prix: p3 });
             }

             if(name) {
               await addDoc(collection(db, "produits"), {
                 categorie: cat || 'Autre',
                 nom: name,
                 description: desc,
                 prix: finalPrice,
                 image: '',
                 variantes: variantsList,
                 date: new Date()
               });
               count++;
             }
          }
        }
        setLoading(false);
        alert(`${count} produits importés !`);
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
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', letterSpacing: '-0.5px', color: COLORS.secondary }}>oodji</h1>
        </div>
        {user ? (
          <button onClick={() => setView(view === 'admin' ? 'client' : 'admin')} style={{background: COLORS.secondary, color: 'white', border: 'none', padding: '8px 15px', borderRadius: '20px', fontSize:'0.8rem', fontWeight:'600'}}>
            {view === 'admin' ? 'Voir App' : 'Admin'}
          </button>
        ) : (
          view === 'client' && <button onClick={() => setView('login')} style={{background:'transparent', border:'none', fontSize:'1.2rem'}}>🔒</button>
        )}
      </div>

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
          
          {/* IMPORT CSV */}
          <details style={{marginBottom:'20px', background:'#E0E7FF', padding:'15px', borderRadius:'10px'}}>
             <summary style={{cursor:'pointer', fontWeight:'bold', color:'#3730A3'}}>📥 Importer Menu Excel (CSV)</summary>
             <div style={{marginTop:'10px'}}>
               <p style={{fontSize:'0.9rem', marginBottom:'10px'}}>
                 Format: <code>Catégorie;Nom;Desc;Prix1;Prix2;Prix3</code><br/>
                 <small>Détection automatique des tailles (L/XL pour Tacos, M/L pour Pizzas)</small>
               </p>
               <input type="file" accept=".csv" onChange={handleCSVImport} />
               {loading && <p>Importation...</p>}
             </div>
          </details>

          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
             <h2 style={{fontSize:'1.5rem', fontWeight:'bold'}}>🔥 Cuisine</h2>
             <span style={{background: COLORS.primary, color:'white', padding:'5px 12px', borderRadius:'20px', fontWeight:'bold'}}>{commandes.filter(c => c.status !== 'Terminé').length} en cours</span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
            {commandes.map(cmd => (
              <div key={cmd.id} style={{ ...cardStyle, borderLeft: cmd.status === 'Terminé' ? '5px solid #ccc' : `5px solid ${COLORS.success}` }}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:'15px', paddingBottom:'15px', borderBottom:'1px solid #f0f0f0'}}>
                  <div><strong style={{fontSize:'1.2rem', display:'block'}}>{cmd.client}</strong><div style={{color: COLORS.textLight, marginTop:'4px'}}>📞 {cmd.tel}</div></div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:'1.3rem', fontWeight:'bold', color: COLORS.primary}}>{cmd.total} DH</div>
                    <button onClick={() => copierOdoo(cmd)} style={{marginTop:'5px', background: COLORS.secondary, color:'white', border:'none', padding:'6px 12px', borderRadius:'6px', fontSize:'0.75rem', cursor:'pointer'}}>📋 COPIER ODOO</button>
                  </div>
                </div>
                {cmd.type === 'livraison' && <div style={{background:'#FEF3C7', color:'#D97706', padding:'8px', borderRadius:'8px', fontSize:'0.9rem', marginBottom:'10px'}}>🛵 <strong>{cmd.adresse}</strong></div>}
                <ul style={{listStyle:'none', marginBottom:'15px'}}>{cmd.items.map((it, i) => (<li key={i} style={{padding:'4px 0', borderBottom:'1px dashed #eee'}}><strong>{it.nom}</strong> {it.varianteNom && <span style={{color: COLORS.textLight}}>({it.varianteNom})</span>}</li>))}</ul>
                <div style={{display:'flex', gap:'10px'}}>
                  {cmd.status !== 'Terminé' && <button onClick={()=>changerStatus(cmd.id, 'Terminé')} style={{...btnStyle, background: COLORS.success, padding:'10px'}}>✅ SERVI</button>}
                  <button onClick={()=>supprimerCmd(cmd.id)} style={{...btnStyle, background:'white', color:'red', border:'1px solid #eee', padding:'10px'}}>🗑️</button>
                </div>
              </div>
            ))}
          </div>

          <div style={{marginTop:'50px', background:'white', padding:'25px', borderRadius:'16px'}}>
            <h3 style={{marginBottom:'20px'}}>➕ Ajouter un Plat (Manuel)</h3>
            <div style={{display:'grid', gridTemplateColumns:'1fr 2fr', gap:'20px'}}>
              <div style={{border:'2px dashed #ddd', borderRadius:'12px', display:'flex', alignItems:'center', justifyContent:'center', height:'100px', overflow:'hidden', position:'relative'}}>
                 {image ? <img src={image} style={{width:'100%', height:'100%', objectFit:'cover'}} /> : <span style={{color:'#aaa'}}>Photo</span>}
                 <input type="file" onChange={handleImage} style={{position:'absolute', width:'100%', height:'100%', opacity:0}} />
              </div>
              <div>
                <input placeholder="Nom du plat" value={nom} onChange={e=>setNom(e.target.value)} style={inputStyle} />
                <div style={{display:'flex', gap:'10px'}}>
                   <select value={categorie} onChange={e=>setCategorie(e.target.value)} style={{...inputStyle, width:'50%'}}><option>Burgers</option><option>Pizzas</option><option>Tacos</option></select>
                   {variantes.length===0 && <input type="number" placeholder="Prix (DH)" value={prixBase} onChange={e=>setPrixBase(e.target.value)} style={{...inputStyle, width:'50%'}} />}
                </div>
              </div>
            </div>
            
            <div style={{background: COLORS.bg, padding:'15px', borderRadius:'10px', marginTop:'10px'}}>
               <div style={{display:'flex', gap:'10px'}}>
                 <input placeholder="Variante (ex: L)" value={tempVarNom} onChange={e=>setTempVarNom(e.target.value)} style={{...inputStyle, marginBottom:0}} />
                 <input type="number" placeholder="Prix" value={tempVarPrix} onChange={e=>setTempVarPrix(e.target.value)} style={{...inputStyle, width:'100px', marginBottom:0}} />
                 <button onClick={()=>{if(tempVarNom){setVariantes([...variantes,{nom:tempVarNom,prix:Number(tempVarPrix)}]);setTempVarNom('');setTempVarPrix('')}}} style={{...btnStyle, width:'auto'}}>+</button>
               </div>
               <div style={{marginTop:'5px', fontSize:'0.9rem', color: COLORS.textLight}}>{variantes.map(v=>`${v.nom} (${v.prix}dh) • `)}</div>
            </div>
            <button onClick={saveProduit} style={{...btnStyle, marginTop:'20px'}}>Enregistrer au Menu</button>
            
            <h4 style={{marginTop:'30px'}}>Gérer le stock actuel</h4>
            {menu.map(p => (
              <div key={p.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px', borderBottom:'1px solid #f0f0f0'}}>
                <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                  <div style={{width:'40px', height:'40px', background:'#eee', borderRadius:'5px', overflow:'hidden', position:'relative'}}>
                    {p.image && <img src={p.image} style={{width:'100%', height:'100%', objectFit:'cover'}} />}
                    <input type="file" onChange={(e)=>updateProductImage(p.id, e.target.files[0])} style={{position:'absolute', top:0, left:0, width:'100%', height:'100%', opacity:0, cursor:'pointer'}} title="Changer la photo" />
                  </div>
                  <div>
                    <div style={{fontWeight:'bold'}}>{p.nom}</div>
                    <div style={{fontSize:'0.8rem', color: COLORS.textLight}}>{p.categorie} - {p.prix || 'Variantes'} DH</div>
                  </div>
                </div>
                <button onClick={()=>supprimerProduit(p.id)} style={{color:'red', border:'none', background:'transparent', cursor:'pointer'}}>Supprimer</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- CLIENT MENU --- */}
      {view === 'client' && (
        <div style={{ padding: '20px' }}>
          
          <div style={{ overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '20px', scrollbarWidth: 'none', display:'flex', gap:'10px' }}>
            {['Tout', 'Burgers', 'Pizzas', 'Tacos'].map(c => (
              <button 
                key={c} 
                onClick={() => setCategorieActive(c)}
                style={{
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
            {menuFiltre.map((plat) => (
              <div 
                key={plat.id} 
                onClick={() => {
                  if(plat.variantes?.length > 0) { ajouterAuPanier(plat, plat.variantes[0]); } 
                  else { ajouterAuPanier(plat); }
                }}
                style={{ ...cardStyle, padding: 0, overflow: 'hidden', display:'flex', flexDirection:'column', cursor: 'pointer', position: 'relative' }}
              >
                <div style={{ height: '140px', background: '#eee', backgroundImage: `url(${plat.image || 'https://via.placeholder.com/300?text=Foodji'})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
                <div style={{ padding: '12px', flex: 1, display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
                  <div>
                    <h4 style={{ margin: '0 0 5px 0', fontSize: '1rem', fontWeight:'700', color: COLORS.secondary }}>{plat.nom}</h4>
                    <p style={{ fontSize: '0.8rem', color: COLORS.textLight, margin: 0, lineHeight:'1.2', display:'-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{plat.description || 'Délicieux et fait maison.'}</p>
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
          
          {menuFiltre.length === 0 && (
            <div style={{textAlign:'center', marginTop:'50px', color: COLORS.textLight}}>
              Aucun plat dans cette catégorie.
            </div>
          )}
        </div>
      )}

      {/* --- PANIER CHECKOUT --- */}
      {view === 'panier' && (
        <div style={{ padding: '20px', background: 'white', minHeight: '100vh' }}>
          <h2 style={{color: COLORS.secondary}}>🛒 Votre Panier</h2>
          {panier.length === 0 ? <p>Panier vide.</p> : (
            <>
              <div style={{marginBottom:'30px'}}>
                {panier.map(item => (
                  <div key={item.uniqueId} style={{display:'flex', justifyContent:'space-between', padding:'15px 0', borderBottom:'1px solid #f0f0f0'}}>
                    <div><div style={{fontWeight:'600'}}>{item.nom}</div><div style={{color: COLORS.textLight, fontSize:'0.9rem'}}>{item.varianteNom}</div></div>
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
                    }}>{t==='sur_place'?'Sur Place':(t==='emporter'?'Emporter':'Livraison')}</button>
                  ))}
                </div>
                <input type="text" value={clientNom} onChange={e => setClientNom(e.target.value)} style={inputStyle} placeholder="Votre Nom" />
                <input type="tel" value={clientTel} onChange={e => setClientTel(e.target.value)} style={inputStyle} placeholder="Votre Tél (06...)" />
                {typeCommande === 'livraison' && <textarea value={adresse} onChange={e => setAdresse(e.target.value)} style={{...inputStyle, height:'80px'}} placeholder="Adresse exacte..." />}
                <button onClick={envoyerCommande} disabled={loading} style={{...btnStyle, marginTop:'10px', background: COLORS.success}}>{loading ? '...' : 'COMMANDER MAINTENANT'}</button>
              </div>
            </>
          )}
          <button onClick={() => setView('client')} style={{marginTop: '20px', width: '100%', padding: '15px', background: 'transparent', border: 'none', color: COLORS.textLight, fontWeight:'600'}}>← Retour au menu</button>
        </div>
      )}

      {/* --- FLOTTANT PANIER --- */}
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

export default App;