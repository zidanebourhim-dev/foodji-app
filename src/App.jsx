import { useState, useEffect, useRef } from 'react';
import { db, auth } from './firebase';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, query } from 'firebase/firestore';
import './App.css';

function App() {
  // --- ETATS GLOBAUX ---
  const [user, setUser] = useState(null);
  const [view, setView] = useState('client'); 
  const [menu, setMenu] = useState([]);
  const [commandes, setCommandes] = useState([]);
  
  // --- ETATS PANIER & CLIENT ---
  const [panier, setPanier] = useState([]);
  const [clientNom, setClientNom] = useState('');
  const [clientTel, setClientTel] = useState(''); // NOUVEAU : Téléphone
  const [typeCommande, setTypeCommande] = useState('sur_place'); // 'sur_place', 'emporter', 'livraison'
  const [adresse, setAdresse] = useState(''); // Pour livraison
  
  // --- ETATS LOGIN & ADMIN ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [categorie, setCategorie] = useState('Burgers');
  const [prixBase, setPrixBase] = useState('');
  const [variantes, setVariantes] = useState([]);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Etats temporaires admin
  const [tempVarNom, setTempVarNom] = useState('');
  const [tempVarPrix, setTempVarPrix] = useState('');
  const [tempOptNom, setTempOptNom] = useState('');
  const [tempOptPrix, setTempOptPrix] = useState('');

  // --- 1. SURVEILLANCE TEMPS RÉEL ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) setView('admin');
    });

    const unsubscribeMenu = onSnapshot(collection(db, "produits"), (snapshot) => {
      const liste = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMenu(liste);
    });

    const q = query(collection(db, "commandes"));
    const unsubscribeCommandes = onSnapshot(q, (snapshot) => {
      const listeCmd = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      listeCmd.sort((a, b) => b.date.seconds - a.date.seconds);
      setCommandes(listeCmd);
    });

    return () => { unsubscribeAuth(); unsubscribeMenu(); unsubscribeCommandes(); };
  }, []);

  // --- 2. GESTION PANIER ---
  const ajouterAuPanier = (plat, varianteChoisie = null) => {
    const item = {
      ...plat,
      uniqueId: Date.now(),
      prixFinal: varianteChoisie ? varianteChoisie.prix : plat.prix,
      varianteNom: varianteChoisie ? varianteChoisie.nom : null
    };
    setPanier([...panier, item]);
  };

  const retirerDuPanier = (uniqueId) => {
    setPanier(panier.filter(item => item.uniqueId !== uniqueId));
  };

  const calculerTotal = () => {
    return panier.reduce((total, item) => total + Number(item.prixFinal), 0);
  };

  const envoyerCommande = async (e) => {
    e.preventDefault();
    if (panier.length === 0) return alert("Votre panier est vide !");
    if (!clientNom) return alert("Le nom est obligatoire.");
    if (!clientTel) return alert("Le téléphone est obligatoire.");
    if (typeCommande === 'livraison' && !adresse) return alert("L'adresse est obligatoire pour la livraison.");

    setLoading(true);
    try {
      await addDoc(collection(db, "commandes"), {
        client: clientNom,
        tel: clientTel,
        type: typeCommande, // Sur place, emporter, livraison
        adresse: adresse, // Si livraison
        items: panier,
        total: calculerTotal(),
        date: new Date(),
        status: 'En attente'
      });
      setPanier([]); setClientNom(''); setClientTel(''); setAdresse('');
      alert("✅ Commande reçue ! On vous appelle pour confirmer.");
      setView('client');
    } catch (error) {
      alert("Erreur réseau");
    }
    setLoading(false);
  };

  // --- 3. ACTIONS ADMIN ---
  const changerStatus = async (id, nouveauStatus) => {
    const ref = doc(db, "commandes", id);
    await updateDoc(ref, { status: nouveauStatus });
  };
  
  const supprimerCommande = async (id) => {
    if(window.confirm("Supprimer ?")) await deleteDoc(doc(db, "commandes", id));
  };

  // --- OUTILS ADMIN ---
  const handleLogin = async (e) => { e.preventDefault(); try { await signInWithEmailAndPassword(auth, email, password); } catch (error) { alert("Erreur login"); } };
  const handleLogout = async () => { await signOut(auth); setView('client'); };
  const handleImageUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader(); reader.readAsDataURL(file);
    reader.onload = (evt) => {
      const img = document.createElement("img"); img.src = evt.target.result;
      img.onload = () => {
        const cvs = document.createElement("canvas"); const ctx = cvs.getContext("2d");
        const scale = 800 / img.width; cvs.width = 800; cvs.height = img.height * scale;
        ctx.drawImage(img, 0, 0, cvs.width, cvs.height); setImage(cvs.toDataURL("image/jpeg", 0.7));
      }
    };
  };
  const ajouterVariante = (e) => { e.preventDefault(); if (tempVarNom && tempVarPrix) { setVariantes([...variantes, { nom: tempVarNom, prix: Number(tempVarPrix) }]); setTempVarNom(''); setTempVarPrix(''); } };
  const ajouterOption = (e) => { e.preventDefault(); if (tempOptNom) { setOptions([...options, { nom: tempOptNom, prix: Number(tempOptPrix) }]); setTempOptNom(''); setTempOptPrix(''); } };
  
  const sauvegarderProduit = async () => {
    if (!nom) return; setLoading(true);
    await addDoc(collection(db, "produits"), { nom, description, categorie, image, date: new Date(), prix: variantes.length > 0 ? 0 : Number(prixBase), variantes, options });
    setNom(''); setDescription(''); setImage(''); setPrixBase(''); setVariantes([]); setOptions([]); setLoading(false); alert("Plat ajouté");
  };
  const supprimerProduit = async (id) => { if(window.confirm("Supprimer ?")) await deleteDoc(doc(db, "produits", id)); };

  // --- RENDU ---
  return (
    <div style={{ fontFamily: 'sans-serif', width: '100%', minHeight: '100vh', margin: 0, padding: 0, paddingBottom: '80px', background: '#f5f5f5' }}>
      
      {/* HEADER */}
      <div style={{ position: 'sticky', top: 0, background: 'black', padding: '15px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 100, width: '100%' }}>
        <h2 style={{margin:0, fontSize: '1.2rem'}}>Foodji</h2>
        {user ? (
          <button onClick={() => setView(view === 'admin' ? 'client' : 'admin')} style={{background:'white', color:'black', border:'none', padding:'5px 10px', borderRadius:'4px', cursor:'pointer'}}>
            {view === 'admin' ? 'App Client' : 'Dashboard'}
          </button>
        ) : (
          view === 'client' && <button onClick={() => setView('login')} style={{background:'transparent', border:'none', color:'#333'}}>🔒</button>
        )}
      </div>

      {/* --- VUE LOGIN --- */}
      {view === 'login' && !user && (
        <div style={{padding: '40px 20px', textAlign: 'center'}}>
          <h3>Staff Login</h3>
          <form onSubmit={handleLogin} style={{maxWidth: '300px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '10px'}}>
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{padding: '10px'}} required/>
            <input type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} style={{padding: '10px'}} required/>
            <button type="submit" style={{padding: '10px', background: 'black', color: 'white', border: 'none'}}>Entrer</button>
          </form>
          <button onClick={() => setView('client')} style={{marginTop:'20px', background:'transparent', border:'none'}}>Annuler</button>
        </div>
      )}

      {/* --- VUE ADMIN (DASHBOARD) --- */}
      {view === 'admin' && user && (
        <div style={{ padding: '15px' }}>
          
          {/* SECTION COMMANDES */}
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{borderBottom: '2px solid black', paddingBottom: '10px'}}>🔥 Commandes ({commandes.filter(c => c.status !== 'Terminé').length})</h2>
            {commandes.length === 0 && <p style={{color:'#888'}}>En attente de commandes...</p>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {commandes.map(cmd => (
                <div key={cmd.id} style={{ 
                  background: cmd.status === 'Terminé' ? '#eee' : 'white', 
                  borderLeft: cmd.status === 'Terminé' ? '5px solid gray' : '5px solid #00C851',
                  padding: '15px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' 
                }}>
                  {/* Header Commande */}
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
                    <strong style={{fontSize:'1.1em'}}>{cmd.client}</strong>
                    <div style={{fontWeight:'bold', fontSize:'1.1em'}}>{cmd.total} DH</div>
                  </div>
                  
                  {/* Détails Client */}
                  <div style={{fontSize:'0.9em', color:'#555', marginBottom:'10px', display:'flex', flexDirection:'column', gap:'2px'}}>
                    <span>📞 <a href={`tel:${cmd.tel}`} style={{color:'blue', textDecoration:'none'}}>{cmd.tel}</a></span>
                    <span style={{fontWeight:'bold', color: cmd.type === 'livraison' ? 'orange' : 'black'}}>
                      {cmd.type === 'livraison' ? `🛵 Livraison : ${cmd.adresse}` : (cmd.type === 'emporter' ? '🛍️ À Emporter' : '🍽️ Sur Place')}
                    </span>
                  </div>

                  {/* Liste Items */}
                  <ul style={{paddingLeft: '20px', margin:'5px 0', color: '#444', borderTop:'1px solid #eee', paddingTop:'10px'}}>
                    {cmd.items.map((item, idx) => (
                      <li key={idx}>
                        {item.nom} {item.varianteNom && `(${item.varianteNom})`} 
                        {item.options && item.options.map(o => ` + ${o.nom}`)}
                      </li>
                    ))}
                  </ul>

                  {/* Actions */}
                  <div style={{marginTop: '15px', display: 'flex', gap: '10px'}}>
                    {cmd.status !== 'Terminé' && (
                      <button onClick={() => changerStatus(cmd.id, 'Terminé')} style={{flex:1, background: 'black', color: 'white', border: 'none', padding: '10px', borderRadius: '5px', fontWeight: 'bold'}}>
                        OK (SERVI)
                      </button>
                    )}
                    <button onClick={() => supprimerCommande(cmd.id)} style={{background: 'transparent', color: 'red', border: '1px solid #ddd', padding: '5px 10px', borderRadius: '5px'}}>
                      X
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AJOUTER PLAT (Replié) */}
          <details style={{background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #ddd'}}>
            <summary style={{fontWeight: 'bold', cursor: 'pointer'}}>➕ Gérer le Menu</summary>
            <div style={{marginTop: '15px'}}>
               <label style={{display:'block', fontWeight:'bold', marginBottom:'5px'}}>Nouveau Plat</label>
               <input type="file" onChange={handleImageUpload} style={{marginBottom: '10px', width:'100%'}} />
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <select value={categorie} onChange={e => setCategorie(e.target.value)} style={{padding: '10px', background:'white', border:'1px solid #ccc'}}><option>Burgers</option><option>Pizzas</option><option>Tacos</option></select>
                  <input placeholder="Nom" value={nom} onChange={e => setNom(e.target.value)} style={{padding: '10px', border:'1px solid #ccc'}} />
               </div>
               
               {/* Variantes Admin */}
               <div style={{marginTop:'10px', background:'#f0f8ff', padding:'10px', borderRadius:'5px'}}>
                 <small>Variantes (Taille)</small>
                 <div style={{display:'flex', gap:'5px'}}>
                   <input placeholder="Nom" value={tempVarNom} onChange={e => setTempVarNom(e.target.value)} style={{flex:1, padding:'5px'}}/>
                   <input type="number" placeholder="Prix" value={tempVarPrix} onChange={e => setTempVarPrix(e.target.value)} style={{width:'60px', padding:'5px'}}/>
                   <button onClick={ajouterVariante}>+</button>
                 </div>
                 <div style={{fontSize:'0.8em'}}>{variantes.map(v=>`${v.nom}-${v.prix}dh `)}</div>
               </div>

               {variantes.length === 0 && <input type="number" placeholder="Prix Unique" value={prixBase} onChange={e => setPrixBase(e.target.value)} style={{width:'100%', marginTop:'10px', padding:'10px'}} />}
               
               <button onClick={sauvegarderProduit} style={{width:'100%', marginTop:'15px', background:'blue', color:'white', padding:'12px', border:'none', fontWeight:'bold'}}>Enregistrer</button>
               
               <h4 style={{marginTop:'20px'}}>Supprimer un plat</h4>
               {menu.map(p => <div key={p.id} style={{display:'flex', justifyContent:'space-between', padding:'5px', borderBottom:'1px solid #eee'}}><span>{p.nom}</span><button onClick={()=>supprimerProduit(p.id)} style={{color:'red', border:'none', background:'transparent'}}>X</button></div>)}
            </div>
          </details>
          <div style={{textAlign: 'center', marginTop: '30px'}}><button onClick={handleLogout} style={{color: 'red', background: 'transparent', border: 'none'}}>Déconnexion</button></div>
        </div>
      )}

      {/* --- VUE CLIENT (MENU) --- */}
      {view === 'client' && (
        <div style={{ padding: '15px' }}>
          <div style={{ overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '15px', scrollbarWidth: 'none' }}>
             {['Tout', 'Burgers', 'Pizzas', 'Tacos'].map(c => <span key={c} style={{display:'inline-block', padding:'10px 20px', background:'white', borderRadius:'25px', marginRight:'10px', fontSize:'0.9rem', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', fontWeight:'500'}}>{c}</span>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            {menu.map((plat) => (
              <div key={plat.id} style={{ background: 'white', borderRadius: '15px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <div style={{ height: '130px', background: '#eee', backgroundImage: `url(${plat.image || 'https://via.placeholder.com/150'})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
                <div style={{ padding: '12px' }}>
                  <h4 style={{ margin: '0 0 5px 0', fontSize: '15px' }}>{plat.nom}</h4>
                  <div style={{ marginTop: '10px', fontWeight: 'bold', fontSize: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <span>{plat.variantes && plat.variantes.length > 0 ? `${Math.min(...plat.variantes.map(v => v.prix))} DH` : `${plat.prix} DH`}</span>
                     <button 
                        onClick={() => {
                          if(plat.variantes && plat.variantes.length > 0) { ajouterAuPanier(plat, plat.variantes[0]); alert("Ajouté (Taille Standard)"); } 
                          else { ajouterAuPanier(plat); }
                        }}
                        style={{background: 'black', color: 'white', width: '28px', height: '28px', borderRadius: '50%', border: 'none', cursor: 'pointer', display:'flex', alignItems:'center', justifyContent:'center'}}>
                        +
                     </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- VUE PANIER (CHECKOUT) --- */}
      {view === 'panier' && (
        <div style={{ padding: '20px', background: 'white', minHeight: '100vh' }}>
          <h2 style={{marginTop:0}}>Mon Panier 🛒</h2>
          
          {/* Liste Items */}
          {panier.length === 0 ? <p>Panier vide.</p> : (
            <>
              <div style={{marginBottom:'20px'}}>
                {panier.map(item => (
                  <div key={item.uniqueId} style={{display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #eee'}}>
                    <div>{item.nom} <small style={{color:'#888'}}>{item.varianteNom}</small></div>
                    <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                      <strong>{item.prixFinal} DH</strong>
                      <button onClick={() => retirerDuPanier(item.uniqueId)} style={{color:'red', background:'transparent', border:'none', fontSize:'1.2em'}}>×</button>
                    </div>
                  </div>
                ))}
                <div style={{textAlign:'right', fontSize:'1.2em', fontWeight:'bold', marginTop:'15px'}}>Total : {calculerTotal()} DH</div>
              </div>
              
              {/* Formulaire Client */}
              <div style={{background: '#f9f9f9', padding: '20px', borderRadius: '15px'}}>
                <h3 style={{marginTop:0, fontSize:'1.1em'}}>Coordonnées</h3>
                
                {/* Choix Type */}
                <div style={{display:'flex', gap:'10px', marginBottom:'15px'}}>
                  {['sur_place', 'emporter', 'livraison'].map(t => (
                    <button key={t} 
                      onClick={() => setTypeCommande(t)}
                      style={{
                        flex:1, padding:'10px 5px', borderRadius:'8px', border:'1px solid #ddd', 
                        background: typeCommande === t ? 'black' : 'white',
                        color: typeCommande === t ? 'white' : 'black',
                        fontSize: '0.9em'
                      }}>
                      {t === 'sur_place' ? 'Sur Place' : (t === 'emporter' ? 'Emporter' : 'Livraison')}
                    </button>
                  ))}
                </div>

                <label style={{display:'block', marginBottom:'5px', fontSize:'0.9em'}}>Nom complet *</label>
                <input type="text" value={clientNom} onChange={e => setClientNom(e.target.value)} style={{width:'100%', padding:'12px', marginBottom:'10px', border:'1px solid #ddd', borderRadius:'8px'}} placeholder="Ex: Karim B." />
                
                <label style={{display:'block', marginBottom:'5px', fontSize:'0.9em'}}>Téléphone *</label>
                <input type="tel" value={clientTel} onChange={e => setClientTel(e.target.value)} style={{width:'100%', padding:'12px', marginBottom:'10px', border:'1px solid #ddd', borderRadius:'8px'}} placeholder="06..." />
                
                {typeCommande === 'livraison' && (
                  <>
                    <label style={{display:'block', marginBottom:'5px', fontSize:'0.9em'}}>Adresse de livraison *</label>
                    <textarea value={adresse} onChange={e => setAdresse(e.target.value)} style={{width:'100%', padding:'12px', marginBottom:'10px', border:'1px solid #ddd', borderRadius:'8px'}} placeholder="Quartier, Rue..." />
                  </>
                )}
                
                <button onClick={envoyerCommande} disabled={loading} style={{width:'100%', padding:'15px', background:'#00C851', color:'white', border:'none', borderRadius:'8px', fontSize:'1.1em', fontWeight:'bold', marginTop:'10px'}}>
                  {loading ? 'Envoi...' : 'CONFIRMER LA COMMANDE'}
                </button>
              </div>
            </>
          )}
          <button onClick={() => setView('client')} style={{marginTop: '20px', width: '100%', padding: '15px', background: 'transparent', border: 'none', textDecoration:'underline'}}>Retour au menu</button>
        </div>
      )}

      {/* --- BARRE FLOTTANTE PANIER --- */}
      {view === 'client' && panier.length > 0 && (
        <div onClick={() => setView('panier')} style={{
          position: 'fixed', bottom: '20px', left: '5%', width: '90%', 
          background: 'black', color: 'white', padding: '15px', 
          borderRadius: '50px', display: 'flex', justifyContent: 'space-between', 
          alignItems: 'center', boxShadow: '0 5px 15px rgba(0,0,0,0.3)', cursor: 'pointer', zIndex: 999
        }}>
          <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
            <span style={{background:'white', color:'black', width:'25px', height:'25px', borderRadius:'50%', display:'flex', justifyContent:'center', alignItems:'center', fontWeight:'bold', fontSize:'0.9em'}}>
              {panier.length}
            </span>
            <span style={{fontSize:'0.9em'}}>Voir panier</span>
          </div>
          <span style={{fontWeight:'bold', fontSize:'1em'}}>{calculerTotal()} DH</span>
        </div>
      )}

    </div>
  );
}

export default App;