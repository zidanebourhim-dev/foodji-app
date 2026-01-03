import { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, addDoc, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import './App.css';

function App() {
  // --- ETATS GLOBAUX ---
  const [user, setUser] = useState(null);
  const [view, setView] = useState('client');
  const [menu, setMenu] = useState([]);
  
  // --- ETATS LOGIN ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // --- ETATS ADMIN ---
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

  // --- 1. SURVEILLANCE ---
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) setView('admin');
    });

    const unsubscribeData = onSnapshot(collection(db, "produits"), (snapshot) => {
      const liste = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMenu(liste);
    });

    return () => { unsubscribeAuth(); unsubscribeData(); };
  }, []);

  // --- 2. AUTHENTIFICATION ---
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      setLoginError('');
    } catch (error) {
      setLoginError("Email ou mot de passe incorrect.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setView('client');
  };

  // --- 3. IMAGE ---
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const imgElement = document.createElement("img");
      imgElement.src = event.target.result;
      imgElement.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 800;
        const scaleSize = MAX_WIDTH / imgElement.width;
        canvas.width = MAX_WIDTH;
        canvas.height = imgElement.height * scaleSize;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(imgElement, 0, 0, canvas.width, canvas.height);
        setImage(canvas.toDataURL("image/jpeg", 0.7));
      }
    };
  };

  // --- LOGIQUE ADMIN ---
  const ajouterVariante = (e) => { e.preventDefault(); if (tempVarNom && tempVarPrix) { setVariantes([...variantes, { nom: tempVarNom, prix: Number(tempVarPrix) }]); setTempVarNom(''); setTempVarPrix(''); } };
  const ajouterOption = (e) => { e.preventDefault(); if (tempOptNom) { setOptions([...options, { nom: tempOptNom, prix: Number(tempOptPrix) }]); setTempOptNom(''); setTempOptPrix(''); } };

  const sauvegarderProduit = async () => {
    if (!nom) return alert("Le nom est obligatoire");
    setLoading(true);
    try {
      await addDoc(collection(db, "produits"), {
        nom, description, categorie, image, date: new Date(),
        prix: variantes.length > 0 ? 0 : Number(prixBase),
        variantes, options
      });
      setNom(''); setDescription(''); setImage(''); setPrixBase(''); setVariantes([]); setOptions([]);
      const fileInput = document.getElementById('fileInput');
      if(fileInput) fileInput.value = ""; 
      alert("Plat ajouté !");
    } catch (error) { alert("Erreur d'enregistrement"); }
    setLoading(false);
  };

  const supprimerProduit = async (id) => { if(window.confirm("Supprimer ?")) await deleteDoc(doc(db, "produits", id)); };

  // --- RENDU ---
  return (
    // ICI : J'ai mis width 100% et supprimé le maxWidth
    <div style={{ fontFamily: 'sans-serif', width: '100%', minHeight: '100vh', margin: 0, padding: 0, paddingBottom: '50px', background: '#f5f5f5' }}>
      
      {/* HEADER PLEINE LARGEUR */}
      <div style={{ position: 'sticky', top: 0, background: 'black', padding: '15px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 100, width: '100%' }}>
        <h2 style={{margin:0, fontSize: '1.2rem'}}>Foodji App</h2>
        {user ? (
          <div style={{display:'flex', gap:'10px'}}>
             <button onClick={() => setView(view === 'admin' ? 'client' : 'admin')} style={{background:'white', color:'black', border:'none', padding:'5px 10px', borderRadius:'4px', cursor:'pointer'}}>
               {view === 'admin' ? 'Voir Menu' : 'Gérer'}
             </button>
             <button onClick={handleLogout} style={{background:'red', color:'white', border:'none', padding:'5px 10px', borderRadius:'4px', cursor:'pointer'}}>X</button>
          </div>
        ) : (
          view !== 'login' && (
            <button onClick={() => setView('login')} style={{background:'transparent', color:'#aaa', border:'1px solid #555', padding:'5px 10px', borderRadius:'4px', fontSize:'0.8rem', cursor:'pointer'}}>Admin ?</button>
          )
        )}
      </div>

      {/* --- VUE LOGIN --- */}
      {view === 'login' && !user && (
        <div style={{padding: '40px 20px', textAlign: 'center'}}>
          <h3>Accès Réservé 🔒</h3>
          <form onSubmit={handleLogin} style={{maxWidth: '300px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '10px'}}>
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{padding: '10px'}} required/>
            <input type="password" placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} style={{padding: '10px'}} required/>
            {loginError && <div style={{color: 'red'}}>{loginError}</div>}
            <button type="submit" style={{padding: '10px', background: 'black', color: 'white', border: 'none', cursor: 'pointer'}}>Se connecter</button>
          </form>
          <button onClick={() => setView('client')} style={{marginTop: '20px', background: 'transparent', border: 'none', textDecoration: 'underline', cursor: 'pointer'}}>Retour au menu</button>
        </div>
      )}

      {/* --- VUE ADMIN --- */}
      {view === 'admin' && user && (
        <div style={{ padding: '15px' }}>
          <div style={{ background: '#fff', padding: '15px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
            <h3 style={{marginTop:0}}>Nouveau Plat</h3>
            <label style={{display:'block', marginBottom:'5px', fontWeight:'bold', fontSize: '0.9rem'}}>Photo</label>
            <input id="fileInput" type="file" accept="image/*" onChange={handleImageUpload} style={{marginBottom: '10px', width: '100%'}} />
            {image && <img src={image} style={{height: '80px', borderRadius: '5px', display: 'block', marginBottom: '10px'}} />}
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <select value={categorie} onChange={e => setCategorie(e.target.value)} style={{padding: '12px', border: '1px solid #ccc', borderRadius: '5px', background: 'white'}}>
                <option>Burgers</option><option>Pizzas</option><option>Tacos</option><option>Salades</option>
              </select>
              <input placeholder="Nom" value={nom} onChange={e => setNom(e.target.value)} style={{padding: '12px', border: '1px solid #ccc', borderRadius: '5px'}} />
            </div>
            <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} style={{width: '100%', marginTop: '10px', padding: '10px', border: '1px solid #ccc', borderRadius: '5px'}} />

            <div style={{ marginTop: '10px', padding: '10px', background: '#f0f7ff', borderRadius: '5px' }}>
              <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                <input placeholder="Taille (ex: L)" value={tempVarNom} onChange={e => setTempVarNom(e.target.value)} style={{flex: 1, padding: '8px', border: '1px solid #ddd'}} />
                <input type="number" placeholder="Prix" value={tempVarPrix} onChange={e => setTempVarPrix(e.target.value)} style={{width: '60px', padding: '8px', border: '1px solid #ddd'}} />
                <button onClick={ajouterVariante} style={{background: 'blue', color: 'white', border: 'none', width: '30px', borderRadius: '3px'}}>+</button>
              </div>
              <div style={{fontSize: '0.8em'}}>{variantes.map(v => `${v.nom} (${v.prix}dh) `)}</div>
            </div>

            {variantes.length === 0 && (
              <input type="number" placeholder="Prix Unique (DH)" value={prixBase} onChange={e => setPrixBase(e.target.value)} style={{marginTop: '10px', padding: '12px', width: '100%', border: '1px solid #ccc', borderRadius: '5px'}} />
            )}

            <button onClick={sauvegarderProduit} disabled={loading} style={{ width: '100%', marginTop: '15px', padding: '15px', background: 'black', color: 'white', border: 'none', fontWeight: 'bold', borderRadius: '8px' }}>
              {loading ? "..." : "ENREGISTRER"}
            </button>
          </div>
          
          <h4 style={{marginTop: '20px'}}>Modifier le stock</h4>
          {menu.map(p => (
            <div key={p.id} style={{display:'flex', justifyContent:'space-between', padding:'15px', background: 'white', marginBottom: '10px', borderRadius: '8px', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'}}>
              <span style={{fontWeight: '500'}}>{p.nom}</span>
              <button onClick={() => supprimerProduit(p.id)} style={{color:'red', border:'none', background:'transparent', padding: '5px'}}>Supprimer</button>
            </div>
          ))}
        </div>
      )}

      {/* --- VUE CLIENT --- */}
      {view === 'client' && (
        <div style={{ padding: '15px', background: '#f5f5f5', minHeight: '100vh' }}>
          <div style={{ overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '15px', scrollbarWidth: 'none' }}>
             {['Tout', 'Burgers', 'Pizzas', 'Tacos'].map(c => <span key={c} style={{display:'inline-block', padding:'10px 20px', background:'white', borderRadius:'25px', marginRight:'10px', fontSize:'0.9rem', boxShadow: '0 2px 5px rgba(0,0,0,0.05)'}}>{c}</span>)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            {menu.map((plat) => (
              <div key={plat.id} style={{ background: 'white', borderRadius: '15px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <div style={{ height: '130px', background: '#eee', backgroundImage: `url(${plat.image || 'https://via.placeholder.com/150'})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
                <div style={{ padding: '12px' }}>
                  <h4 style={{ margin: '0 0 5px 0', fontSize: '15px' }}>{plat.nom}</h4>
                  <p style={{ fontSize: '12px', color: '#888', margin: 0, height:'34px', overflow:'hidden', lineHeight: '1.2' }}>{plat.description}</p>
                  <div style={{ marginTop: '10px', fontWeight: 'bold', fontSize: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <span>{plat.variantes && plat.variantes.length > 0 ? `${Math.min(...plat.variantes.map(v => v.prix))} DH` : `${plat.prix} DH`}</span>
                     <button style={{background: 'black', color: 'white', width: '24px', height: '24px', borderRadius: '50%', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>+</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;