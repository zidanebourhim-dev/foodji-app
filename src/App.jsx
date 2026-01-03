import { useState, useEffect } from 'react';
import { db, auth } from './firebase'; // On importe l'auth
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, addDoc, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import './App.css';

function App() {
  // --- ETATS GLOBAUX ---
  const [user, setUser] = useState(null); // Est-ce que l'admin est connecté ?
  const [view, setView] = useState('client'); // 'client', 'login', 'admin'
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
  const [tempVarNom, setTempVarNom] = useState('');
  const [tempVarPrix, setTempVarPrix] = useState('');
  const [tempOptNom, setTempOptNom] = useState('');
  const [tempOptPrix, setTempOptPrix] = useState('');

  // --- 1. SURVEILLANCE : QUI EST LÀ ? ---
  useEffect(() => {
    // Vérifie si l'utilisateur est connecté via Firebase
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setView('admin'); // Si connecté, on montre l'admin direct
      }
    });

    // Charge le menu
    const unsubscribeData = onSnapshot(collection(db, "produits"), (snapshot) => {
      const liste = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMenu(liste);
    });

    return () => { unsubscribeAuth(); unsubscribeData(); };
  }, []);

  // --- 2. GESTION AUTHENTIFICATION ---
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Firebase gère le reste via onAuthStateChanged
      setLoginError('');
    } catch (error) {
      setLoginError("Email ou mot de passe incorrect.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setView('client');
  };

  // --- 3. FONCTION IMAGE ---
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

  // --- LOGIQUE ADMIN (Ajout) ---
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
      document.getElementById('fileInput').value = ""; 
      alert("Plat ajouté !");
    } catch (error) { alert("Erreur d'enregistrement"); }
    setLoading(false);
  };

  const supprimerProduit = async (id) => { if(window.confirm("Supprimer ?")) await deleteDoc(doc(db, "produits", id)); };

  // --- RENDU ---
  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto', paddingBottom: '50px' }}>
      
      {/* HEADER NOIR */}
      <div style={{ position: 'sticky', top: 0, background: 'black', padding: '15px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 100 }}>
        <h2 style={{margin:0, fontSize: '1.2rem'}}>Foodji App</h2>
        
        {/* Bouton Intelligent */}
        {user ? (
          <div style={{display:'flex', gap:'10px'}}>
             <button onClick={() => setView(view === 'admin' ? 'client' : 'admin')} style={{background:'white', color:'black', border:'none', padding:'5px 10px', borderRadius:'4px', cursor:'pointer'}}>
               {view === 'admin' ? 'Voir Menu' : 'Gérer'}
             </button>
             <button onClick={handleLogout} style={{background:'red', color:'white', border:'none', padding:'5px 10px', borderRadius:'4px', cursor:'pointer'}}>X</button>
          </div>
        ) : (
          view !== 'login' && (
            <button onClick={() => setView('login')} style={{background:'transparent', color:'#aaa', border:'1px solid #555', padding:'5px 10px', borderRadius:'4px', fontSize:'0.8rem', cursor:'pointer'}}>
              Admin ?
            </button>
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
        <div style={{ padding: '20px' }}>
          <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '12px', border: '1px solid #ddd' }}>
            <h3 style={{marginTop:0}}>Nouveau Plat</h3>
            <label style={{display:'block', marginBottom:'5px', fontWeight:'bold', fontSize: '0.9rem'}}>Photo</label>
            <input id="fileInput" type="file" accept="image/*" onChange={handleImageUpload} style={{marginBottom: '10px'}} />
            {image && <img src={image} style={{height: '60px', borderRadius: '5px', display: 'block', marginBottom: '10px'}} />}
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <select value={categorie} onChange={e => setCategorie(e.target.value)} style={{padding: '10px'}}>
                <option>Burgers</option><option>Pizzas</option><option>Tacos</option><option>Salades</option>
              </select>
              <input placeholder="Nom" value={nom} onChange={e => setNom(e.target.value)} style={{padding: '10px'}} />
            </div>
            <textarea placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} style={{width: '100%', marginTop: '10px', padding: '10px'}} />

            {/* Variantes & Options simplifiées visuellement */}
            <div style={{ marginTop: '10px', padding: '10px', background: '#e3f2fd', borderRadius: '5px' }}>
              <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                <input placeholder="Taille (ex: L)" value={tempVarNom} onChange={e => setTempVarNom(e.target.value)} style={{flex: 1, padding: '5px'}} />
                <input type="number" placeholder="Prix" value={tempVarPrix} onChange={e => setTempVarPrix(e.target.value)} style={{width: '50px', padding: '5px'}} />
                <button onClick={ajouterVariante} style={{background: 'blue', color: 'white', border: 'none'}}>+</button>
              </div>
              <div style={{fontSize: '0.8em'}}>{variantes.map(v => `${v.nom} (${v.prix}dh) `)}</div>
            </div>

            {/* Prix Simple */}
            {variantes.length === 0 && (
              <input type="number" placeholder="Prix Unique (DH)" value={prixBase} onChange={e => setPrixBase(e.target.value)} style={{marginTop: '10px', padding: '10px', width: '100%'}} />
            )}

            <button onClick={sauvegarderProduit} disabled={loading} style={{ width: '100%', marginTop: '15px', padding: '12px', background: 'black', color: 'white', border: 'none', fontWeight: 'bold' }}>
              {loading ? "..." : "ENREGISTRER"}
            </button>
          </div>
          
          <h4 style={{marginTop: '20px'}}>Modifier le stock</h4>
          {menu.map(p => (
            <div key={p.id} style={{display:'flex', justifyContent:'space-between', padding:'10px', borderBottom:'1px solid #eee', alignItems: 'center'}}>
              <span>{p.nom}</span>
              <button onClick={() => supprimerProduit(p.id)} style={{color:'red', border:'none', background:'transparent'}}>Supprimer</button>
            </div>
          ))}
        </div>
      )}

      {/* --- VUE CLIENT (VITRINE) --- */}
      {view === 'client' && (
        <div style={{ padding: '15px', background: '#f5f5f5', minHeight: '100vh' }}>
          {/* Menu Catégories (Fake scroll) */}
          <div style={{ overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '15px' }}>
             {['Tout', 'Burgers', 'Pizzas', 'Tacos'].map(c => <span key={c} style={{display:'inline-block', padding:'8px 15px', background:'white', borderRadius:'20px', marginRight:'10px', fontSize:'0.9rem'}}>{c}</span>)}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            {menu.map((plat) => (
              <div key={plat.id} style={{ background: 'white', borderRadius: '15px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                <div style={{ height: '120px', background: '#eee', backgroundImage: `url(${plat.image || 'https://via.placeholder.com/150'})`, backgroundSize: 'cover', backgroundPosition: 'center' }}></div>
                <div style={{ padding: '10px' }}>
                  <h4 style={{ margin: '0 0 5px 0', fontSize: '15px' }}>{plat.nom}</h4>
                  <p style={{ fontSize: '11px', color: '#888', margin: 0, height:'30px', overflow:'hidden' }}>{plat.description}</p>
                  <div style={{ marginTop: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                     {plat.variantes && plat.variantes.length > 0 ? `dès ${Math.min(...plat.variantes.map(v => v.prix))} DH` : `${plat.prix} DH`}
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