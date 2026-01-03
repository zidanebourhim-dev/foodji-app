import { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, query, orderBy } from 'firebase/firestore';
import './App.css';

function App() {
  // --- ETATS GLOBAUX ---
  const [user, setUser] = useState(null);
  const [view, setView] = useState('client'); // 'client', 'login', 'admin', 'panier'
  const [menu, setMenu] = useState([]);
  const [commandes, setCommandes] = useState([]); // Pour le dashboard admin
  
  // --- ETATS PANIER (CLIENT) ---
  const [panier, setPanier] = useState([]);
  const [clientNom, setClientNom] = useState('');
  const [clientTable, setClientTable] = useState(''); // Ou adresse
  
  // --- ETATS LOGIN ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // --- ETATS ADMIN (PRODUITS) ---
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [categorie, setCategorie] = useState('Burgers');
  const [prixBase, setPrixBase] = useState('');
  const [variantes, setVariantes] = useState([]);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Etats temporaires
  const [tempVarNom, setTempVarNom] = useState('');
  const [tempVarPrix, setTempVarPrix] = useState('');
  const [tempOptNom, setTempOptNom] = useState('');
  const [tempOptPrix, setTempOptPrix] = useState('');

  // --- 1. SURVEILLANCE TEMPS RÉEL ---
  useEffect(() => {
    // Auth
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) setView('admin');
    });

    // Menu
    const unsubscribeMenu = onSnapshot(collection(db, "produits"), (snapshot) => {
      const liste = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMenu(liste);
    });

    // Commandes (Seulement si admin connecté pour économiser la data, mais ici on charge tout pour simplifier)
    // On trie par date (le plus récent en haut n'est pas garanti sans index, on triera en JS)
    const q = query(collection(db, "commandes"));
    const unsubscribeCommandes = onSnapshot(q, (snapshot) => {
      const listeCmd = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Tri manuel par date décroissante
      listeCmd.sort((a, b) => b.date.seconds - a.date.seconds);
      setCommandes(listeCmd);
    });

    return () => { unsubscribeAuth(); unsubscribeMenu(); unsubscribeCommandes(); };
  }, []);

  // --- 2. GESTION PANIER (CLIENT) ---
  const ajouterAuPanier = (plat, varianteChoisie = null) => {
    const item = {
      ...plat,
      uniqueId: Date.now(), // Pour pouvoir supprimer cet item précis
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
    if (!clientNom) return alert("Merci d'indiquer votre nom.");

    setLoading(true);
    try {
      await addDoc(collection(db, "commandes"), {
        client: clientNom,
        table: clientTable, // Peut être une adresse ou un n° de table
        items: panier,
        total: calculerTotal(),
        date: new Date(),
        status: 'En attente' // En attente, Prêt, Payé
      });
      setPanier([]);
      setClientNom('');
      setClientTable('');
      alert("✅ Commande envoyée en cuisine !");
      setView('client');
    } catch (error) {
      alert("Erreur lors de la commande.");
      console.error(error);
    }
    setLoading(false);
  };

  // --- 3. ACTIONS ADMIN ---
  const changerStatus = async (id, nouveauStatus) => {
    const ref = doc(db, "commandes", id);
    await updateDoc(ref, { status: nouveauStatus });
  };
  
  const supprimerCommande = async (id) => {
    if(window.confirm("Supprimer l'historique de cette commande ?")) await deleteDoc(doc(db, "commandes", id));
  };

  // --- AUTRES FONCTIONS (Login, Image, Produit) ---
  const handleLogin = async (e) => { e.preventDefault(); try { await signInWithEmailAndPassword(auth, email, password); } catch (error) { setLoginError("Erreur login"); } };
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
          <div style={{display:'flex', gap:'10px'}}>
             <button onClick={() => setView(view === 'admin' ? 'client' : 'admin')} style={{background:'white', color:'black', border:'none', padding:'5px 10px', borderRadius:'4px', cursor:'pointer'}}>
               {view === 'admin' ? 'Voir App' : 'Dashboard'}
             </button>
          </div>
        ) : (
          view === 'client' && <button onClick={() => setView('login')} style={{background:'transparent', border:'none', color:'#333'}}>🔒</button>
        )}
      </div>

      {/* --- VUE LOGIN --- */}
      {view === 'login' && !user && (
        <div style={{padding: '40px 20px', textAlign: 'center'}}>
          <h3>Staff Foodji</h3>
          <form onSubmit={handleLogin} style={{maxWidth: '300px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '10px'}}>
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{padding: '10px'}} required/>
            <input type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} style={{padding: '10px'}} required/>
            <button type="submit" style={{padding: '10px', background: 'black', color: 'white', border: 'none'}}>Connexion</button>
          </form>
          <button onClick={() => setView('client')} style={{marginTop:'20px', background:'transparent', border:'none'}}>Retour</button>
        </div>
      )}

      {/* --- VUE ADMIN (DASHBOARD) --- */}
      {view === 'admin' && user && (
        <div style={{ padding: '15px' }}>
          
          {/* SECTION COMMANDES */}
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{borderBottom: '2px solid black', paddingBottom: '10px'}}>🔥 Commandes en Cuisine ({commandes.filter(c => c.status !== 'Terminé').length})</h2>
            
            {commandes.length === 0 && <p>Aucune commande pour l'instant.</p>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {commandes.map(cmd => (
                <div key={cmd.id} style={{ 
                  background: cmd.status === 'Terminé' ? '#eee' : 'white', 
                  borderLeft: cmd.status === 'Terminé' ? '5px solid gray' : '5px solid #00C851',
                  padding: '15px', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' 
                }}>
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}>
                    <div>
                      <strong style={{fontSize:'1.1em'}}>{cmd.client}</strong> 
                      <span style={{background:'#000', color:'white', padding:'2px 6px', borderRadius:'4px', marginLeft:'8px', fontSize:'0.8em'}}>
                        {cmd.table ? `Table ${cmd.table}` : 'Emporter'}
                      </span>
                    </div>
                    <div style={{fontWeight:'bold'}}>{cmd.total} DH</div>
                  </div>

                  {/* Liste des items de la commande */}
                  <ul style={{paddingLeft: '20px', margin:'5px 0', color: '#444'}}>
                    {cmd.items.map((item, idx) => (
                      <li key={idx}>
                        {item.nom} {item.varianteNom && `(${item.varianteNom})`} 
                      </li>
                    ))}
                  </ul>

                  <div style={{marginTop: '15px', display: 'flex', gap: '10px', overflowX: 'auto'}}>
                    {cmd.status !== 'Terminé' && (
                      <button onClick={() => changerStatus(cmd.id, 'Terminé')} style={{flex:1, background: 'black', color: 'white', border: 'none', padding: '10px', borderRadius: '5px', fontWeight: 'bold'}}>
                        ✅ PRÊT / SERVI
                      </button>
                    )}
                    <button onClick={() => supprimerCommande(cmd.id)} style={{background: 'transparent', color: 'red', border: '1px solid red', padding: '5px 10px', borderRadius: '5px'}}>
                      Supprimer
                    </button>
                  </div>
                  <div style={{fontSize: '0.7em', color: '#999', marginTop: '5px', textAlign:'right'}}>
                     {new Date(cmd.date.seconds * 1000).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION MENU (Repliée pour faire de la place, on garde juste le formulaire simple) */}
          <details style={{background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #ddd'}}>
            <summary style={{fontWeight: 'bold', cursor: 'pointer'}}>➕ Ajouter un nouveau plat au menu</summary>
            <div style={{marginTop: '15px'}}>
               {/* Formulaire simplifié pour l'admin */}
               <input type="file" onChange={handleImageUpload} style={{marginBottom: '10px'}} />
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <select value={categorie} onChange={e => setCategorie(e.target.value)} style={{padding: '10px'}}><option>Burgers</option><option>Pizzas</option><option>Tacos</option></select>
                  <input placeholder="Nom" value={nom} onChange={e => setNom(e.target.value)} style={{padding: '10px'}} />
               </div>
               <input type="number" placeholder="Prix" value={prixBase} onChange={e => setPrixBase(e.target.value)} style={{width:'100%', marginTop:'10px', padding:'10px'}} />
               <button onClick={sauvegarderProduit} style={{width:'100%', marginTop:'10px', background:'blue', color:'white', padding:'10px', border:'none'}}>Ajouter au menu</button>
            </div>
          </details>
          <div style={{textAlign: 'center', marginTop: '30px'}}>
             <button onClick={handleLogout} style={{color: 'red', background: 'transparent', border: 'none'}}>Se déconnecter</button>
          </div>
        </div>
      )}

      {/* --- VUE CLIENT (MENU) --- */}
      {view === 'client' && (
        <div style={{ padding: '15px' }}>
          <div style={{ overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '15px' }}>
             {['Tout', 'Burgers', 'Pizzas', 'Tacos'].map(c => <span key={c} style={{display:'inline-block', padding:'8px 15px', background:'white', borderRadius:'20px', marginRight:'10px', fontSize:'0.9rem', boxShadow: '0 2px 5px rgba(0,0,0,0.05)'}}>{c}</span>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            {menu.map((plat) => (
              <div key={plat.id} style={{ background: 'white', borderRadius: '15px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <div style={{ height: '120px', background: '#eee', backgroundImage: `url(${plat.image || 'https://via.placeholder.com/150'})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
                <div style={{ padding: '10px' }}>
                  <h4 style={{ margin: '0 0 5px 0', fontSize: '15px' }}>{plat.nom}</h4>
                  <div style={{ marginTop: '8px', fontWeight: 'bold', fontSize: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     {/* Gestion affichage prix selon variantes */}
                     <span>{plat.variantes && plat.variantes.length > 0 ? `dès ${Math.min(...plat.variantes.map(v => v.prix))} DH` : `${plat.prix} DH`}</span>
                     
                     {/* Bouton Ajouter */}
                     <button 
                        onClick={() => {
                          if(plat.variantes && plat.variantes.length > 0) {
                            // Si variantes, on prend la 1ère par défaut pour simplifier (à améliorer plus tard)
                            ajouterAuPanier(plat, plat.variantes[0]);
                            alert(`Ajouté : ${plat.nom} (${plat.variantes[0].nom})`);
                          } else {
                            ajouterAuPanier(plat);
                          }
                        }}
                        style={{background: 'black', color: 'white', width: '30px', height: '30px', borderRadius: '50%', border: 'none', cursor: 'pointer'}}>
                        +
                     </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- VUE PANIER (MODAL) --- */}
      {view === 'panier' && (
        <div style={{ padding: '20px', background: 'white', minHeight: '100vh' }}>
          <h2>Votre Panier 🛒</h2>
          {panier.length === 0 ? <p>Panier vide.</p> : (
            <>
              {panier.map(item => (
                <div key={item.uniqueId} style={{display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #eee'}}>
                  <div>{item.nom} <small>{item.varianteNom}</small></div>
                  <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                    <strong>{item.prixFinal} DH</strong>
                    <button onClick={() => retirerDuPanier(item.uniqueId)} style={{color:'red', background:'transparent', border:'none'}}>X</button>
                  </div>
                </div>
              ))}
              <h3 style={{textAlign:'right', marginTop:'20px'}}>Total : {calculerTotal()} DH</h3>
              
              <div style={{marginTop: '30px', background: '#f9f9f9', padding: '15px', borderRadius: '10px'}}>
                <label style={{display:'block', marginBottom:'5px'}}>Votre Nom :</label>
                <input type="text" value={clientNom} onChange={e => setClientNom(e.target.value)} style={{width:'100%', padding:'10px', marginBottom:'10px'}} placeholder="Ex: Karim" />
                
                <label style={{display:'block', marginBottom:'5px'}}>Table n° (ou Emporter) :</label>
                <input type="text" value={clientTable} onChange={e => setClientTable(e.target.value)} style={{width:'100%', padding:'10px', marginBottom:'20px'}} placeholder="Ex: 4" />
                
                <button onClick={envoyerCommande} disabled={loading} style={{width:'100%', padding:'15px', background:'#00C851', color:'white', border:'none', borderRadius:'8px', fontSize:'1.1em', fontWeight:'bold'}}>
                  {loading ? 'Envoi...' : 'VALIDER LA COMMANDE'}
                </button>
              </div>
            </>
          )}
          <button onClick={() => setView('client')} style={{marginTop: '20px', width: '100%', padding: '10px', background: 'transparent', border: '1px solid #ccc', borderRadius: '8px'}}>Continuer les achats</button>
        </div>
      )}

      {/* --- BARRE FLOTTANTE PANIER (Visible si client + items dans panier) --- */}
      {view === 'client' && panier.length > 0 && (
        <div onClick={() => setView('panier')} style={{
          position: 'fixed', bottom: '20px', left: '5%', width: '90%', 
          background: 'black', color: 'white', padding: '15px', 
          borderRadius: '50px', display: 'flex', justifyContent: 'space-between', 
          alignItems: 'center', boxShadow: '0 5px 15px rgba(0,0,0,0.3)', cursor: 'pointer', zIndex: 999
        }}>
          <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
            <span style={{background:'white', color:'black', width:'25px', height:'25px', borderRadius:'50%', display:'flex', justifyContent:'center', alignItems:'center', fontWeight:'bold'}}>
              {panier.length}
            </span>
            <span>Voir le panier</span>
          </div>
          <span style={{fontWeight:'bold', fontSize:'1.1em'}}>{calculerTotal()} DH</span>
        </div>
      )}

    </div>
  );
}

export default App;
