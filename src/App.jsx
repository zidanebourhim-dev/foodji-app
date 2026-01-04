import { useState, useEffect, useRef } from 'react';
import { db, auth } from './firebase';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, query, writeBatch } from 'firebase/firestore';
import './App.css';

// --- CONFIGURATION ---
const CODE_MANAGER = "1234"; 
const PHONE_NUMBER = "0537536689"; // Ton Fixe
// 📍 COORDONNEES EXACTES (Sala Al Jadida)
const RESTO_COORDS = { lat: 33.997484, lng: -6.735644 }; 

// --- LISTES DE DONNEES (COMPLETES) ---
const LISTE_VIANDES = ["Poulet", "Viande Hachée", "Cordon Bleu", "Nuggets", "Poulet Crispy"];
const LISTE_GARNITURES_PIZZA = ["Viande Hachée", "Poulet", "4 Fromages", "Cannibale", "Pepperoni", "Thon", "Charcuterie", "Végétarienne", "Fruits de Mer"];
const LISTE_SAUCES = ["Algérienne Fait Maison", "Biggy Fait Maison", "Barbecue Fait Maison", "Pas de sauce"]; 
const TYPES_PATES = ["Penne", "Tagliatelle", "Spaghetti"];

const EXTRAS_PIZZA = [
    { nom: "Extra Champignons", prix: 10 },
    { nom: "Extra Mozzarella", prix: 10 },
    { nom: "Extra Parmesan", prix: 15 },
    { nom: "Extra Cheddar", prix: 15 }
];

const RETRAIT_INGREDIENTS = ["Sans Tomate", "Sans Salade", "Sans Oignons", "Sans Cornichons", "Sans Sauce"];
const PIZZAS_EXCLUES_PROMO = ["4 saisons", "fruits de mer", "cannibale", "2 saisons"];
const TOUTES_CATEGORIES = ["Tacos", "Pizzas", "Burgers", "Pâtes", "Sides", "Les Burritos", "Koniks", "Plats", "Salades", "Boissons", "Desserts"];

const NOTIF_SOUND = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

// --- IMAGES ---
const logoImg = "/logo.png";
const iconImg = "/icon.png";
const promoImg = "/promo.jpg"; 

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
  textLight: '#6B7280',
  pending: '#F97316' 
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
  const [showPromoWizard, setShowPromoWizard] = useState(false); 
  const [categorieActive, setCategorieActive] = useState(''); 
  const [adminCategorie, setAdminCategorie] = useState(''); 

  const [panier, setPanier] = useState([]);
  const [clientNom, setClientNom] = useState('');
  const [clientTel, setClientTel] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [typeCommande, setTypeCommande] = useState('sur_place');
  const [adresse, setAdresse] = useState('');
  
  // --- VARIABLES V59 (DISTANCE & BLOCAGE) ---
  const [distanceClient, setDistanceClient] = useState(null);
  const [clientCoords, setClientCoords] = useState(null);
  const [showDistanceBlocker, setShowDistanceBlocker] = useState(false); // Le Mur > 10km
  
  const [derniereCommande, setDerniereCommande] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Admin Form
  const [editId, setEditId] = useState(null); 
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState(''); 
  const [image, setImage] = useState('');
  const [categorie, setCategorie] = useState('Burgers');
  const [prixBase, setPrixBase] = useState('');
  const [variantes, setVariantes] = useState([]); 

  // --- UTILS GEO ---
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371; 
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c; 
  };

  // --- DATA LOADING ---
  useEffect(() => {
      const savedNom = localStorage.getItem('clientNom');
      const savedTel = localStorage.getItem('clientTel');
      const savedAdresse = localStorage.getItem('clientAdresse');
      const savedTicket = localStorage.getItem('derniereCommande'); 

      if (savedNom) setClientNom(savedNom);
      if (savedTel) setClientTel(savedTel);
      if (savedAdresse) setAdresse(savedAdresse);
      if (savedTicket) setDerniereCommande(JSON.parse(savedTicket));
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => { setUser(u); });
    
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
      if (categoriesReelles.length > 0 && !adminCategorie) setAdminCategorie(categoriesReelles[0]);
  }, [menu, adminCategorie]);

  const isDimanche = new Date().getDay() === 0;
  let categoriesClient = [...categoriesReelles];
  if (isDimanche) categoriesClient = ['🔥 PROMOTIONS', ...categoriesReelles];
  
  useEffect(() => {
      if (categoriesClient.length > 0 && !categorieActive) setCategorieActive(categoriesClient[0]);
  }, [menu, categorieActive, isDimanche]);

  // --- FILTRAGE MENU ---
  let menuClient = [];
  if (categorieActive === '🔥 PROMOTIONS') {
      menuClient = [{
          id: 'promo-sunday-card', nom: 'OFFRE DIMANCHE', description: '2 PIZZAS ACHETÉES = 1 OFFERTE (Moyennes uniquement)',
          categorie: '🔥 PROMOTIONS', prix: 0, image: promoImg, available: true, isPromoTrigger: true 
      }];
  } else {
      menuClient = menu.filter(p => p.categorie === categorieActive && p.available !== false);
  }

  let menuAdmin = [];
  if (adminCategorie === 'RUPTURE') menuAdmin = menu.filter(p => p.available === false);
  else menuAdmin = menu.filter(p => p.categorie === adminCategorie);

  // --- GESTION IMPORT / RESET ---
  const checkManagerAuth = () => {
      const code = prompt("🔒 Code Manager requis :");
      if (code === CODE_MANAGER) return true;
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
                else if (cat.toLowerCase().includes('pizza')) { n1="M"; n2="L"; n3 = "XL"; }
                if(p1>0) vars.push({nom:n1, prix:p1});
                if(p2>0) vars.push({nom:n2, prix:p2});
                if(p3>0) vars.push({nom:n3, prix:p3});
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

  // --- NAVIGATION ---
  const handleStaffAccess = () => { if (user) setView('admin'); else setView('login'); };

  // --- PANIER & CALCULS ---
  const ajouterAuPanier = (item) => {
    if (item.isPromoTrigger) { setShowPromoWizard(true); return; }
    if (item.isInfo) return alert("Info seulement.");
    setPanier([...panier, { ...item, uniqueId: Date.now() }]);
    setSelectedProduct(null); 
  };

  const ajouterLotAuPanier = (lot) => {
      setPanier([...panier, ...lot.map((p,i) => ({ ...p, uniqueId: Date.now()+i }))]);
      setShowPromoWizard(false);
  };

  const retirerDuPanier = (uid) => setPanier(panier.filter(i => i.uniqueId !== uid));
  
  const getPrixItemAjuste = (item) => {
      let prix = Number(item.prixFinal) || 0;
      if (item.nom.toLowerCase().includes("pep's") && (typeCommande === 'livraison' || typeCommande === 'emporter')) prix += 5;
      return prix;
  };

  const calculerTotal = () => {
      let sousTotal = 0, pizzas = [];
      panier.forEach(item => {
          const p = getPrixItemAjuste(item);
          sousTotal += p;
          if (item.isPromoEligible) pizzas.push({ ...item, prixCalcul: p });
      });

      let remise = 0;
      if (pizzas.length >= 3) {
          pizzas.sort((a, b) => a.prixCalcul - b.prixCalcul);
          for (let i = 0; i < Math.floor(pizzas.length / 3); i++) remise += pizzas[i].prixCalcul;
      }
      
      const frais = (typeCommande === 'livraison' && (sousTotal - remise) < 45 && (sousTotal - remise) > 0) ? 5 : 0;
      return { sousTotal, remisePromo: remise, fraisLivraison: frais, grandTotal: (sousTotal - remise) + frais };
  };

  const { remisePromo, fraisLivraison, grandTotal } = calculerTotal();

  // --- LOGIQUE GEO V59 (BLOCAGE STRICT 10KM) ---
  const handleOpenPanier = () => {
      if (panier.length === 0) return alert("Panier vide !");

      if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition((position) => {
              const uLat = position.coords.latitude;
              const uLng = position.coords.longitude;
              setClientCoords({ lat: uLat, lng: uLng });
              const dist = calculateDistance(RESTO_COORDS.lat, RESTO_COORDS.lng, uLat, uLng);
              setDistanceClient(dist);

              // ⛔️ LE MUR V59 : BLOCAGE ABSOLU > 10KM
              if (dist > 10) {
                  setShowDistanceBlocker(true); // Affiche l'écran noir
                  return; // Stop tout
              }

              // RÈGLES INTERNES (< 10km)
              if (grandTotal >= 300) {
                  setView('panier'); // Gros panier autorisé
                  return;
              }
              
              if (dist > 4 && grandTotal < 300) {
                  // Bloque l'accès au panier si trop loin et pas assez cher
                  return alert(`⛔️ Zone 4km-10km (${dist.toFixed(1)} km).\nMinimum de commande : 300 DH.`);
              }

              setView('panier'); // Tout est OK

          }, () => {
              // Si GPS refusé ou erreur
              if (grandTotal >= 300) setView('panier'); 
              else alert("⚠️ Géolocalisation OBLIGATOIRE pour commander.");
          });
      } else {
          alert("GPS non supporté.");
      }
  };

  const envoyerCommande = async () => {
    if (panier.length === 0) return alert("Vide !");
    if (!clientNom.trim() || !clientTel.trim()) return alert("Nom et Tél obligatoires.");
    const telClean = clientTel.replace(/\s/g, ''); 
    if (!/^(06|07)\d{8}$/.test(telClean)) return alert("Numéro invalide (06... ou 07...)");
    if (typeCommande === 'livraison' && !adresse.trim()) return alert("Adresse obligatoire.");

    // Sécurité ultime V59
    if (distanceClient > 10) return alert("Trop loin ( > 10km). Appelez-nous.");

    setLoading(true);
    localStorage.setItem('clientNom', clientNom);
    localStorage.setItem('clientTel', telClean);
    if(adresse) localStorage.setItem('clientAdresse', adresse);
    
    // Statut
    let status = 'En attente';
    if (grandTotal >= 300) status = 'En cours de validation';

    const data = {
        client: clientNom, tel: telClean, type: typeCommande, adresse, commentaire,
        items: panier.map(i => ({...i, prixFinal: getPrixItemAjuste(i)})), 
        total: grandTotal, remisePromo, fraisLivraison, 
        date: new Date(), status, 
        distance: distanceClient ? distanceClient.toFixed(2) : 'N/A',
        lat: clientCoords?.lat || 0, lng: clientCoords?.lng || 0
    };

    try {
      const ref = await addDoc(collection(db, "commandes"), data);
      const ticket = { ...data, id: ref.id, date: new Date().toLocaleString() };
      localStorage.setItem('derniereCommande', JSON.stringify(ticket));
      setDerniereCommande(ticket);
      setPanier([]); setCommentaire(''); setView('ticket'); 
    } catch (e) { alert("Erreur envoi"); }
    setLoading(false);
  };

  // --- ADMIN & CRUD ---
  const toggleAvailability = async (item) => await updateDoc(doc(db, "produits", item.id), { available: !item.available });
  const saveProduit = async () => {
    if(!nom) return; setLoading(true);
    const d = { nom, description, categorie, prix: variantes.length>0?0:Number(prixBase), variantes, available: true, date: new Date() };
    if(image) d.image = image;
    if(editId) await updateDoc(doc(db, "produits", editId), d); else await addDoc(collection(db, "produits"), d);
    setEditId(null); setNom(''); setPrixBase(''); setVariantes([]); setLoading(false); alert("Enregistré");
  };
  const handleEdit = (p) => { setEditId(p.id); setNom(p.nom); setDescription(p.description); setCategorie(p.categorie); if(p.variantes && p.variantes.length>0) {setVariantes(p.variantes); setPrixBase('');} else {setVariantes([]); setPrixBase(p.prix);} window.scrollTo(0,0); };
  const updateVariantPrice = (index, newVal) => { const newVars = [...variantes]; newVars[index].prix = Number(newVal); setVariantes(newVars); };
  const copierOdoo = (cmd) => { navigator.clipboard.writeText(`Nom : ${cmd.client}\nTél : ${cmd.tel}\n${cmd.type === 'livraison' ? 'Adresse : '+cmd.adresse : cmd.type}\nNote : ${cmd.commentaire||''}`).then(() => alert("Copié !")); };
  const updateProductImage = async (id, file) => {
    const reader = new FileReader(); reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = document.createElement("img"); img.src = e.target.result;
      img.onload = async () => {
         const c = document.createElement("canvas"); c.width=800; c.height=img.height*(800/img.width);
         c.getContext("2d").drawImage(img,0,0,c.width,c.height);
         await updateDoc(doc(db, "produits", id), { image: c.toDataURL("image/jpeg", 0.7) });
         alert("Image OK");
      }
    }
  };

  // Styles
  const btnStyle = { background: COLORS.primary, color: 'white', border: 'none', borderRadius: '12px', padding: '12px 20px', fontWeight: 'bold', width: '100%', cursor:'pointer', fontSize:'1rem' };
  const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd', marginBottom: '10px', fontSize:'1rem' };
  const cardStyle = { background: COLORS.card, borderRadius: '16px', padding: '15px', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', border: '1px solid #eee' };

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', paddingBottom: '100px', color: COLORS.secondary }}>
      
      {/* ⛔️ LE MUR V59 (BLOCAGE VISUEL) */}
      {showDistanceBlocker && (
          <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.95)', zIndex:9999, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'30px', color:'white', textAlign:'center'}}>
              <div style={{fontSize:'4rem', marginBottom:'20px'}}>⛔</div>
              <h2 style={{fontSize:'1.8rem', color: COLORS.danger, marginBottom:'20px'}}>Trop loin pour commander</h2>
              <p style={{fontSize:'1.1rem', marginBottom:'30px', lineHeight:'1.5'}}>
                  Vous êtes situé à <strong>{distanceClient ? distanceClient.toFixed(1) : '?'} km</strong>.<br/>
                  Nous limitons les commandes en ligne à 10 km pour garantir la qualité.
              </p>
              <a href={`tel:${PHONE_NUMBER}`} style={{
                  background: 'white', color: 'black', padding: '20px 40px', borderRadius: '50px',
                  textDecoration: 'none', fontWeight: 'bold', fontSize: '1.2rem', display:'flex', alignItems:'center', gap:'10px'
              }}>
                  📞 APPELER LE RESTO
              </a>
              <button onClick={() => setShowDistanceBlocker(false)} style={{marginTop:'40px', background:'transparent', border:'1px solid #555', color:'#aaa', padding:'10px 20px', borderRadius:'20px'}}>Fermer</button>
          </div>
      )}

      {/* Landing */}
      {view === 'landing' && (
        <div style={{ position: 'fixed', top:0, left:0, width:'100%', height:'100%', background:'#1A1E29', color:'white', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <img src={logoImg} style={{width:'200px', marginBottom:'40px'}} onError={(e)=>e.target.style.display='none'} />
          <button onClick={()=>setView('client')} style={{...btnStyle, width:'auto', padding:'15px 50px', borderRadius:'50px', fontSize:'1.2rem'}}>VOIR LE MENU</button>
          <button onClick={handleStaffAccess} style={{marginTop:'50px', background:'transparent', border:'1px solid #555', color:'#888', padding:'10px 20px', borderRadius:'20px'}}>Staff</button>
        </div>
      )}

      {/* Header */}
      {view !== 'landing' && (
        <div style={{ padding: '15px', background: 'white', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, zIndex:50, boxShadow:'0 2px 5px rgba(0,0,0,0.05)' }}>
          <div onClick={()=>setView('landing')} style={{fontWeight:'bold', fontSize:'1.2rem', display:'flex', alignItems:'center', gap:'10px'}}>
             <img src={iconImg} style={{height:'30px'}} onError={(e)=>e.target.style.display='none'} /> Foodji
          </div>
          {user && <button onClick={()=>setView(view==='admin'?'client':'admin')} style={{background:'#eee', border:'none', padding:'5px 10px', borderRadius:'10px'}}>{view==='admin'?'App':'Admin'}</button>}
        </div>
      )}

      {/* Modals */}
      {showPromoWizard && <PromoWizard menu={menu} onClose={()=>setShowPromoWizard(false)} onValidate={ajouterLotAuPanier} />}
      {selectedProduct && <ProductModal product={selectedProduct} onClose={()=>setSelectedProduct(null)} onAdd={ajouterAuPanier} />}

      {/* Client View */}
      {view === 'client' && (
        <div style={{padding:'20px'}}>
          <div style={{overflowX:'auto', whiteSpace:'nowrap', marginBottom:'20px', paddingBottom:'5px'}}>
             {categoriesClient.map(c => (
                 <button key={c} onClick={()=>setCategorieActive(c)} style={{marginRight:'10px', padding:'10px 20px', borderRadius:'20px', border:'none', background:categorieActive===c?COLORS.primary:'white', color:categorieActive===c?'white':'black', boxShadow:'0 2px 5px rgba(0,0,0,0.05)'}}>{c}</button>
             ))}
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
             {menuClient.map(p => (
                 <div key={p.id} onClick={()=>setSelectedProduct(p)} style={{background:'white', borderRadius:'15px', overflow:'hidden', boxShadow:'0 2px 5px rgba(0,0,0,0.05)', display:'flex', flexDirection:'column'}}>
                    <div style={{height:'120px', background:'#eee', backgroundImage:`url(${p.image})`, backgroundSize:'cover', position:'relative'}}>
                         {p.isPromoTrigger && <div style={{position:'absolute', bottom:0, width:'100%', background:'rgba(0,0,0,0.6)', color:'white', fontSize:'0.8rem', padding:'5px', textAlign:'center'}}>PROMO</div>}
                    </div>
                    <div style={{padding:'10px', flex:1, display:'flex', flexDirection:'column', justifyContent:'space-between'}}>
                        <div>
                            <div style={{fontWeight:'bold'}}>{p.nom}</div>
                            <div style={{fontSize:'0.8rem', color:'#888', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden'}}>{p.description}</div>
                        </div>
                        <div style={{marginTop:'10px', fontWeight:'bold', color:COLORS.primary, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                            <span>{p.prix>0 ? p.prix+' DH' : (p.variantes?.length>0 ? 'dès '+Math.min(...p.variantes.map(v=>v.prix))+' DH' : 'GRATUIT')}</span>
                            <span style={{background:COLORS.secondary, color:'white', width:'25px', height:'25px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center'}}>+</span>
                        </div>
                    </div>
                 </div>
             ))}
          </div>
          {panier.length > 0 && (
             <div onClick={handleOpenPanier} style={{position:'fixed', bottom:'30px', left:'5%', width:'90%', background:COLORS.secondary, color:'white', padding:'15px', borderRadius:'50px', display:'flex', justifyContent:'space-between', alignItems:'center', boxShadow:'0 5px 15px rgba(0,0,0,0.2)', cursor:'pointer', zIndex:99}}>
                <span style={{fontWeight:'bold'}}>🛒 {panier.length} article(s)</span>
                <span style={{fontWeight:'bold', fontSize:'1.2rem'}}>{grandTotal} DH</span>
             </div>
          )}
        </div>
      )}

      {/* Panier View */}
      {view === 'panier' && (
         <div style={{padding:'20px', background:'white', minHeight:'100vh'}}>
            <h2>Mon Panier</h2>
            {typeCommande === 'livraison' && <div style={{background:'#FEF2F2', color:'#B91C1C', padding:'10px', borderRadius:'10px', marginBottom:'20px', fontSize:'0.9rem', border:'1px solid #FCA5A5'}}>⚠️ <strong>Zones Spéciales (UIR, Techno...) :</strong><br/>Supplément (10-15 DH) à payer directement au livreur.</div>}
            
            {panier.length === 0 ? <p>Votre panier est vide.</p> : panier.map(i => (
                <div key={i.uniqueId} style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #eee', padding:'15px 0'}}>
                    <div>
                        <div style={{fontWeight:'bold'}}>{i.nom} <small style={{color:'#666'}}>({i.varianteNom})</small></div>
                        <div style={{fontSize:'0.85rem', color:'#666'}}>
                            {i.choixPates && <span>Pâtes: {i.choixPates}<br/></span>}
                            {i.sauces && i.sauces.length>0 && <span>Sauces: {i.sauces.join(', ')}<br/></span>}
                            {i.optionsChoisies && i.optionsChoisies.length>0 && <span>+ {formatOptions(i.optionsChoisies)}<br/></span>}
                            {i.extras && i.extras.length>0 && <span>+ {i.extras.map(e=>e.nom).join(', ')}<br/></span>}
                            {i.isCheesyCrust && <span style={{color:COLORS.promo}}>★ Cheesy Crust<br/></span>}
                            {i.sans && i.sans.length>0 && <span style={{color:'red'}}>Sans: {i.sans.join(', ')}</span>}
                        </div>
                    </div>
                    <div style={{display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'5px'}}>
                        <b>{getPrixItemAjuste(i)} DH</b>
                        <button onClick={()=>retirerDuPanier(i.uniqueId)} style={{color:'red', border:'none', background:'transparent', fontSize:'1.2rem'}}>×</button>
                    </div>
                </div>
            ))}
            
            {remisePromo > 0 && <div style={{background:'#ECFDF5', color:'green', padding:'10px', borderRadius:'10px', textAlign:'center', margin:'10px 0', fontWeight:'bold'}}>🎁 Promo Dimanche : -{remisePromo} DH</div>}
            {fraisLivraison > 0 && <div style={{textAlign:'right', color:'#666'}}>+ Frais livraison (Petite commande) : 5 DH</div>}
            
            <div style={{textAlign:'right', fontSize:'1.5rem', fontWeight:'bold', margin:'20px 0', color: COLORS.secondary}}>Total : {grandTotal} DH</div>
            
            <div style={{background: COLORS.bg, padding: '20px', borderRadius: '15px'}}>
                <h3 style={{marginTop:0}}>Vos Infos</h3>
                <div style={{display:'flex', gap:'10px', marginBottom:'15px'}}>
                    {['sur_place','emporter','livraison'].map(m => (
                        <button key={m} onClick={()=>setTypeCommande(m)} style={{flex:1, padding:'10px', borderRadius:'10px', border:typeCommande===m?`2px solid ${COLORS.secondary}`:'1px solid #ddd', background:typeCommande===m?COLORS.secondary:'white', color:typeCommande===m?'white':'black', fontWeight:'bold', fontSize:'0.9rem'}}>{m.replace('_',' ')}</button>
                    ))}
                </div>
                <input placeholder="Nom *" value={clientNom} onChange={e=>setClientNom(e.target.value)} style={inputStyle} />
                <input placeholder="Tél (06/07...) *" value={clientTel} onChange={e=>setClientTel(e.target.value)} style={inputStyle} type="tel" />
                {typeCommande==='livraison' && <textarea placeholder="Adresse complète *" value={adresse} onChange={e=>setAdresse(e.target.value)} style={{...inputStyle, height:'80px'}} />}
                <textarea placeholder="Commentaire (Code, Sans oignon...)" value={commentaire} onChange={e=>setCommentaire(e.target.value)} style={{...inputStyle, height:'60px'}} />
                <button onClick={envoyerCommande} disabled={loading} style={{...btnStyle, background:COLORS.success, marginTop:'10px'}}>{loading?'Envoi...':'VALIDER LA COMMANDE'}</button>
            </div>
            <button onClick={()=>setView('client')} style={{marginTop:'20px', width:'100%', border:'none', background:'transparent', padding:'10px', color:'#666'}}>Retour au menu</button>
         </div>
      )}

      {/* Ticket View */}
      {view === 'ticket' && derniereCommande && (
          <div style={{textAlign:'center', padding:'40px 20px', background:'white', minHeight:'100vh'}}>
              <div style={{width:'80px', height:'80px', background: derniereCommande.status==='En attente' ? COLORS.success : COLORS.pending, color:'white', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'3rem', margin:'0 auto 20px auto'}}>
                  {derniereCommande.status==='En attente' ? '✓' : '!'}
              </div>
              <h2 style={{color: COLORS.secondary}}>{derniereCommande.status==='En attente' ? 'Commande Reçue !' : 'En Validation'}</h2>
              <p style={{color:'#666', marginBottom:'30px'}}>
                  {derniereCommande.status==='En attente' ? 'Votre commande est en préparation.' : 'Montant élevé : Nous allons vous appeler.'}
              </p>
              
              <div style={{border:'2px dashed #eee', padding:'20px', borderRadius:'10px', textAlign:'left', marginBottom:'30px'}}>
                  <div style={{display:'flex', justifyContent:'space-between', marginBottom:'15px', fontWeight:'bold'}}>
                      <span>Commande #{derniereCommande.id.slice(-4).toUpperCase()}</span>
                      <span>{derniereCommande.total} DH</span>
                  </div>
                  {derniereCommande.items.map((it,i) => (
                      <div key={i} style={{fontSize:'0.9rem', color:'#555', marginBottom:'5px'}}>
                          - {it.nom} ({it.varianteNom})
                      </div>
                  ))}
              </div>

              <button onClick={()=>setView('client')} style={btnStyle}>Nouvelle commande</button>
          </div>
      )}

      {/* Login */}
      {view === 'login' && (
          <div style={{textAlign:'center', padding:'50px 20px'}}>
              <h2>Accès Staff</h2>
              <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={inputStyle} />
              <input type="password" placeholder="Mot de passe" value={password} onChange={e=>setPassword(e.target.value)} style={inputStyle} />
              <button onClick={async (e)=>{e.preventDefault(); try{await signInWithEmailAndPassword(auth,email,password); setView('admin');}catch(e){alert('Erreur')}}} style={btnStyle}>Connexion</button>
              <button onClick={()=>setView('landing')} style={{marginTop:'20px', background:'transparent', border:'none'}}>Retour</button>
          </div>
      )}

      {/* Admin */}
      {view === 'admin' && user && (
          <div style={{padding:'20px', maxWidth:'1200px', margin:'0 auto'}}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'30px'}}>
                  <h2>Admin Dashboard</h2>
                  <div style={{display:'flex', gap:'10px'}}>
                      <button onClick={viderMenu} style={{background:'red', color:'white', border:'none', padding:'8px 15px', borderRadius:'8px'}}>Reset Menu</button>
                  </div>
              </div>
              
              <h3>Commandes en cours</h3>
              <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'20px', marginBottom:'40px'}}>
                  {commandes.map(c => (
                      <div key={c.id} style={{...cardStyle, borderLeft:`5px solid ${c.status==='Terminé'?'#ccc':(c.status==='En cours de validation'?'orange':COLORS.success)}`}}>
                          <div style={{display:'flex', justifyContent:'space-between', alignItems:'start'}}>
                              <div>
                                  <div style={{fontWeight:'bold', fontSize:'1.1rem'}}>{c.client}</div>
                                  <div style={{fontSize:'0.9rem', color:'#555'}}>{c.tel}</div>
                                  <div style={{fontSize:'0.8rem', fontWeight:'bold', marginTop:'5px'}}>📍 {c.distance} km</div>
                                  {c.lat && c.lng && <a href={`https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`} target="_blank" rel="noreferrer" style={{fontSize:'0.8rem', color:'blue'}}>Voir Map</a>}
                              </div>
                              <div style={{textAlign:'right'}}>
                                  <div style={{fontWeight:'bold', fontSize:'1.2rem', color:COLORS.primary}}>{c.total} DH</div>
                                  <button onClick={()=>copierOdoo(c)} style={{fontSize:'0.7rem', padding:'5px', marginTop:'5px'}}>Copier</button>
                              </div>
                          </div>
                          
                          <div style={{background:'#f9f9f9', padding:'10px', borderRadius:'8px', margin:'10px 0', fontSize:'0.9rem'}}>
                              {c.items.map((i,idx)=>(
                                  <div key={idx} style={{marginBottom:'5px'}}>
                                      <strong>{i.nom} ({i.varianteNom})</strong>
                                      <div style={{fontSize:'0.8rem', color:'#666', paddingLeft:'10px'}}>
                                          {i.choixPates} {i.sauces?.join(', ')} {i.extras?.map(e=>e.nom).join(', ')} {i.optionsChoisies?.join(', ')} {i.isCheesyCrust && 'Cheesy'} {i.sans?.length>0 && 'Sans: '+i.sans}
                                      </div>
                                  </div>
                              ))}
                          </div>
                          
                          {c.commentaire && <div style={{background:COLORS.warning, color:'white', padding:'5px', borderRadius:'5px', fontSize:'0.8rem', marginBottom:'10px'}}>📝 {c.commentaire}</div>}
                          {c.type === 'livraison' && <div style={{fontSize:'0.9rem', marginBottom:'10px'}}>🛵 {c.adresse}</div>}

                          <div style={{display:'flex', gap:'5px'}}>
                              {c.status === 'En cours de validation' ? (
                                  <>
                                      <button onClick={()=>updateDoc(doc(db,"commandes",c.id),{status:'En attente'})} style={{flex:1, background:COLORS.success, color:'white', border:'none', padding:'10px', borderRadius:'8px'}}>Valider</button>
                                      <button onClick={()=>updateDoc(doc(db,"commandes",c.id),{status:'Refusé'})} style={{flex:1, background:COLORS.danger, color:'white', border:'none', padding:'10px', borderRadius:'8px'}}>Refuser</button>
                                  </>
                              ) : (
                                  c.status!=='Terminé' && <button onClick={()=>updateDoc(doc(db,"commandes",c.id),{status:'Terminé'})} style={{flex:1, background:COLORS.secondary, color:'white', border:'none', padding:'10px', borderRadius:'8px'}}>Terminer</button>
                              )}
                              <button onClick={()=>deleteDoc(doc(db,"commandes",c.id))} style={{background:'white', border:'1px solid #ccc', borderRadius:'8px', padding:'0 10px'}}>🗑️</button>
                          </div>
                      </div>
                  ))}
              </div>

              <h3>Gestion Menu</h3>
              <div style={{marginBottom:'20px', overflowX:'auto', whiteSpace:'nowrap', paddingBottom:'10px'}}>
                  {categoriesSelectAdmin.map(c => <button key={c} onClick={()=>setAdminCategorie(c)} style={{marginRight:'5px', padding:'8px 15px', borderRadius:'20px', border:'none', background:adminCategorie===c?COLORS.secondary:'#eee', color:adminCategorie===c?'white':'black'}}>{c}</button>)}
                  <button onClick={()=>setAdminCategorie('RUPTURE')} style={{background:'#FEE2E2', color:'red', border:'none', padding:'8px 15px', borderRadius:'20px'}}>RUPTURE</button>
              </div>
              
              {menuAdmin.map(p => (
                  <div key={p.id} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px', background:'white', borderBottom:'1px solid #eee'}}>
                      <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                          <div onClick={()=>toggleAvailability(p)} style={{width:'40px', height:'24px', background:p.available?'#10B981':'#ccc', borderRadius:'20px', position:'relative', cursor:'pointer'}}>
                              <div style={{width:'18px', height:'18px', background:'white', borderRadius:'50%', position:'absolute', top:'3px', left:p.available?'19px':'3px', transition:'0.2s'}}></div>
                          </div>
                          <img src={p.image||'https://via.placeholder.com/50'} style={{width:'40px', height:'40px', borderRadius:'5px', objectFit:'cover'}} />
                          <input type="file" onChange={(e)=>updateProductImage(p.id, e.target.files[0])} style={{width:'80px', fontSize:'0.7rem'}} />
                          <div>
                              <div style={{fontWeight:'bold', textDecoration:p.available?'none':'line-through'}}>{p.nom}</div>
                              <div style={{fontSize:'0.8rem', color:'#888'}}>{p.categorie} - {p.prix} DH</div>
                          </div>
                      </div>
                      <div>
                          <button onClick={()=>handleEdit(p)} style={{border:'none', background:'transparent', fontSize:'1.2rem', marginRight:'10px'}}>✏️</button>
                          <button onClick={()=>deleteDoc(doc(db,"produits",p.id))} style={{border:'none', background:'transparent', color:'red'}}>X</button>
                      </div>
                  </div>
              ))}
              
              <div style={{marginTop:'30px', background:'white', padding:'20px', borderRadius:'10px'}}>
                  <h4>{editId ? 'Modifier' : 'Ajouter'} Produit</h4>
                  <input placeholder="Nom" value={nom} onChange={e=>setNom(e.target.value)} style={inputStyle} />
                  <textarea placeholder="Description" value={description} onChange={e=>setDescription(e.target.value)} style={{...inputStyle, height:'60px'}} />
                  <div style={{display:'flex', gap:'10px'}}>
                      <select value={categorie} onChange={e=>setCategorie(e.target.value)} style={inputStyle}>{categoriesSelectAdmin.map(c=><option key={c}>{c}</option>)}</select>
                      {variantes.length>0 ? (
                           <div style={{flex:1, display:'flex', gap:'5px'}}>
                               {variantes.map((v,i)=><div key={i}><small>{v.nom}</small><input type="number" value={v.prix} onChange={e=>updateVariantPrice(i,e.target.value)} style={{...inputStyle, padding:'5px'}} /></div>)}
                           </div>
                      ) : (
                           <input type="number" placeholder="Prix" value={prixBase} onChange={e=>setPrixBase(e.target.value)} style={inputStyle} />
                      )}
                  </div>
                  <button onClick={saveProduit} style={btnStyle}>Enregistrer</button>
              </div>

              <div style={{marginTop:'40px', border:'1px solid red', padding:'20px', borderRadius:'10px', background:'#FEF2F2'}}>
                  <h4 style={{color:'red', marginTop:0}}>Zone Danger</h4>
                  <input type="file" accept=".csv" ref={fileInputRef} onChange={handleCSVImport} style={{display:'none'}} />
                  <button onClick={triggerImport} style={{background:'white', border:'1px solid #ccc', padding:'10px', borderRadius:'8px', marginRight:'10px'}}>Importer CSV</button>
              </div>
          </div>
      )}
    </div>
  );
}

// --- SOUS-COMPOSANTS COMPLETS (NON CONDENSÉS) ---

function formatOptions(list) {
    if(!list) return "";
    const counts = {};
    list.forEach(x => { counts[x] = (counts[x] || 0) + 1; });
    return Object.entries(counts).map(([name, count]) => count > 1 ? `${name} x${count}` : name).join(', ');
}

function PromoWizard({ menu, onClose, onValidate }) {
    const [choix, setChoix] = useState([]);
    
    // Filtre des pizzas éligibles
    const pizzasEligibles = menu.filter(p => 
        p.categorie === 'Pizzas' && 
        p.available !== false &&
        !PIZZAS_EXCLUES_PROMO.some(ex => p.nom.toLowerCase().includes(ex))
    );

    const handleSelect = (pizza) => {
        if (choix.length >= 3) return;
        let varianteM = pizza.variantes?.find(v => v.nom === 'M' || v.nom === 'Standard');
        if (!varianteM && pizza.variantes?.length > 0) varianteM = pizza.variantes[0];

        const prixFinal = varianteM ? varianteM.prix : pizza.prix;
        const varianteNom = varianteM ? varianteM.nom : null;

        setChoix([...choix, {
            ...pizza,
            prixFinal: Number(prixFinal),
            originalPrice: Number(prixFinal),
            varianteNom: varianteNom,
            isPromoEligible: true
        }]);
    };

    const remove = (idx) => setChoix(choix.filter((_, i) => i !== idx));

    return (
        <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.9)', zIndex:3000, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'20px'}}>
            <div style={{background:'white', width:'100%', maxWidth:'600px', borderRadius:'20px', padding:'20px', maxHeight:'90vh', overflowY:'auto'}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
                    <h3>Promo Dimanche ({choix.length}/3)</h3>
                    <button onClick={onClose} style={{border:'none', background:'transparent', fontSize:'1.5rem'}}>×</button>
                </div>
                
                <div style={{display:'flex', gap:'5px', marginBottom:'20px', background:'#eee', padding:'10px', borderRadius:'10px'}}>
                    {[0,1,2].map(i => (
                        <div key={i} style={{flex:1, height:'50px', border:'1px dashed #999', borderRadius:'5px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.8rem', position:'relative', background:'white'}}>
                            {choix[i] ? (
                                <>
                                    {choix[i].nom}
                                    <div onClick={()=>remove(i)} style={{position:'absolute', top:'-5px', right:'-5px', background:'red', color:'white', width:'20px', height:'20px', borderRadius:'50%', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center'}}>x</div>
                                </>
                            ) : <span style={{color:'#ccc'}}>Choix {i+1}</span>}
                        </div>
                    ))}
                </div>

                {choix.length < 3 ? (
                    <div style={{display:'grid', gap:'10px'}}>
                        {pizzasEligibles.map(p => (
                            <button key={p.id} onClick={()=>handleSelect(p)} style={{padding:'15px', borderRadius:'10px', border:'1px solid #eee', background:'white', textAlign:'left', display:'flex', justifyContent:'space-between'}}>
                                <b>{p.nom}</b>
                                <span style={{color:'green'}}>Ajouter</span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <button onClick={()=>onValidate(choix)} style={{width:'100%', padding:'20px', background:COLORS.success, color:'white', border:'none', borderRadius:'10px', fontSize:'1.2rem', fontWeight:'bold'}}>VALIDER LE LOT</button>
                )}
            </div>
        </div>
    );
}

function ProductModal({ product, onClose, onAdd }) {
  const [selectedVar, setSelectedVar] = useState(product.variantes && product.variantes.length > 0 ? product.variantes[0] : null);
  const [optionsChoisies, setOptionsChoisies] = useState([]); 
  const [sauces, setSauces] = useState([]); 
  const [typePates, setTypePates] = useState(null); 
  const [isCheesyCrust, setIsCheesyCrust] = useState(false);
  const [extrasPizza, setExtrasPizza] = useState([]); 
  const [sansIngredients, setSansIngredients] = useState([]); 

  let maxChoix = 0;
  let minChoix = 0;
  let listeOptions = [];
  let titreOptions = "";
  
  const nomLower = product.nom.toLowerCase();
  const catLower = product.categorie.toLowerCase();
  const isPates = catLower.includes('pâtes') || catLower.includes('pates');
  const isTacos = catLower.includes('tacos');
  const isPizza = catLower.includes('pizza');
  const isBurger = catLower.includes('burger');
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
  else if (isPizza) {
      if (nomLower.includes('2 saisons')) { maxChoix = 2; minChoix = 2; listeOptions = LISTE_GARNITURES_PIZZA; titreOptions = "2 Garnitures"; }
      if (nomLower.includes('4 saisons')) { maxChoix = 4; minChoix = 4; listeOptions = LISTE_GARNITURES_PIZZA; titreOptions = "4 Garnitures"; }
  }

  // Fonctions logiques complètes
  const incrementOption = (opt, currentList, setList, max) => {
      if (currentList.length < max) setList([...currentList, opt]);
  };
  const decrementOption = (opt, currentList, setList) => {
      const index = currentList.indexOf(opt);
      if (index > -1) {
          const newList = [...currentList];
          newList.splice(index, 1);
          setList(newList);
      }
  };
  const toggleExtraPizza = (extraObj) => {
      if (extrasPizza.some(e => e.nom === extraObj.nom)) setExtrasPizza(extrasPizza.filter(e => e.nom !== extraObj.nom));
      else setExtrasPizza([...extrasPizza, extraObj]);
  };
  const toggleSans = (item) => {
      if (sansIngredients.includes(item)) setSansIngredients(sansIngredients.filter(x => x !== item));
      else setSansIngredients([...sansIngredients, item]);
  };
  const getCount = (opt, list) => list.filter(x => x === opt).length;

  // Calcul Prix
  let basePrice = selectedVar ? Number(selectedVar.prix) : Number(product.prix);
  let totalExtras = extrasPizza.reduce((acc, curr) => acc + curr.prix, 0);
  let prixCheesy = 0;
  if (isCheesyCrust) {
      if (selectedVar?.nom === 'M' || selectedVar?.nom === 'Standard' || !selectedVar) prixCheesy = 15;
      else prixCheesy = 25;
  }
  const finalPriceCalculated = basePrice + totalExtras + prixCheesy;

  return (
    <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.5)', zIndex:2500, display:'flex', alignItems:'flex-end', justifyContent:'center'}}>
      <div style={{background:'white', width:'100%', maxWidth:'600px', borderRadius:'20px 20px 0 0', padding:'25px', maxHeight:'90vh', overflowY:'auto'}}>
        
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
                        <button key={v.nom} onClick={() => { setSelectedVar(v); setOptionsChoisies([]); }} style={{padding:'10px 20px', borderRadius:'8px', border: selectedVar?.nom === v.nom ? `2px solid ${COLORS.primary}` : '1px solid #ddd', background: selectedVar?.nom === v.nom ? '#FFF5F5' : 'white', fontWeight:'bold'}}>
                            {v.nom} - {v.prix} DH
                        </button>
                    ))}
                </div>
            </div>
        )}

        {/* Pâtes */}
        {isPates && (
            <div style={{marginTop:'25px', borderTop:'1px solid #eee', paddingTop:'15px'}}>
                <div style={{fontWeight:'bold', marginBottom:'10px'}}>Type de Pâtes</div>
                <div style={{display:'flex', gap:'10px'}}>
                    {TYPES_PATES.map(type => (
                        <button key={type} onClick={() => setTypePates(type)} style={{flex:1, padding:'12px', borderRadius:'12px', border: typePates === type ? `2px solid ${COLORS.primary}` : '1px solid #ddd', background: typePates === type ? '#FFF5F5' : 'white', fontWeight: 'bold', color: typePates === type ? COLORS.primary : 'black'}}>{type}</button>
                    ))}
                </div>
            </div>
        )}

        {/* Pizza Extras */}
        {isPizza && (
            <div style={{marginTop:'25px', borderTop:'1px solid #eee', paddingTop:'15px'}}>
                 <div style={{fontWeight:'bold', marginBottom:'10px'}}>Suppléments</div>
                 <div onClick={() => setIsCheesyCrust(!isCheesyCrust)} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'15px', borderRadius:'10px', border: isCheesyCrust ? `2px solid ${COLORS.promo}` : '1px solid #ddd', background: isCheesyCrust ? '#FFFBF0' : 'white', cursor:'pointer', marginBottom:'15px'}}>
                     <span style={{fontWeight:'bold'}}>🧀 Cheesy Crust</span>
                     <span style={{color: COLORS.primary, fontWeight:'bold'}}>+{selectedVar?.nom === 'M' || !selectedVar ? '15' : '25'} DH</span>
                 </div>
                 <div style={{display:'flex', flexWrap:'wrap', gap:'10px'}}>
                     {EXTRAS_PIZZA.map(ex => {
                         const isSelected = extrasPizza.some(e => e.nom === ex.nom);
                         return (
                            <button key={ex.nom} onClick={() => toggleExtraPizza(ex)} style={{padding:'8px 12px', borderRadius:'20px', border: isSelected ? `1px solid ${COLORS.primary}` : '1px solid #ddd', background: isSelected ? '#FFF5F5' : 'white', color: isSelected ? COLORS.primary : 'black', fontWeight:'bold', fontSize:'0.9rem'}}>
                                {isSelected ? '✓ ' : '+ '}{ex.nom} ({ex.prix} DH)
                            </button>
                         )
                     })}
                 </div>
            </div>
        )}

        {/* Sans Ingrédients */}
        {isBurger && (
            <div style={{marginTop:'25px', borderTop:'1px solid #eee', paddingTop:'15px'}}>
                <div style={{fontWeight:'bold', marginBottom:'10px', color: COLORS.danger}}>Je ne veux pas de...</div>
                <div style={{display:'flex', flexWrap:'wrap', gap:'10px'}}>
                    {RETRAIT_INGREDIENTS.map(ing => (
                         <button key={ing} onClick={() => toggleSans(ing)} style={{padding:'8px 12px', borderRadius:'20px', border: '1px solid #FCA5A5', background: sansIngredients.includes(ing) ? '#FEF2F2' : 'white', color: COLORS.danger, fontWeight:'bold', fontSize:'0.9rem', opacity: sansIngredients.includes(ing) ? 1 : 0.6}}>
                            {sansIngredients.includes(ing) ? '🚫 ' : ''}{ing}
                        </button>
                    ))}
                </div>
            </div>
        )}

        {/* Sauces Tacos */}
        {isTacos && (
            <div style={{marginTop:'25px', borderTop:'1px solid #eee', paddingTop:'15px'}}>
                <div style={{fontWeight:'bold', marginBottom:'10px'}}>Sauces (Max 2)</div>
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

        {/* Options (Viandes / Garnitures) */}
        {maxChoix > 0 && (
            <div style={{marginTop:'25px', borderTop:'1px solid #eee', paddingTop:'15px'}}>
                <div style={{fontWeight:'bold', marginBottom:'10px'}}>
                    {titreOptions} <small style={{color: optionsChoisies.length < minChoix ? COLORS.danger : COLORS.success}}>({optionsChoisies.length}/{maxChoix})</small>
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
            if (isTacos && sauces.length === 0) return alert("⚠️ Veuillez choisir au moins une sauce !");

            onAdd({
                ...product,
                prixFinal: finalPriceCalculated,
                varianteNom: selectedVar ? selectedVar.nom : null, 
                sauces, optionsChoisies, choixPates: typePates, isCheesyCrust, extras: extrasPizza, sans: sansIngredients
            });
        }} style={{background: COLORS.primary, color: 'white', border: 'none', borderRadius: '12px', padding: '15px', fontWeight: 'bold', width: '100%', marginTop: '30px', fontSize: '1.1rem', opacity: (minChoix > 0 && optionsChoisies.length < minChoix) ? 0.5 : 1}}>
            {minChoix > 0 && optionsChoisies.length < minChoix ? `Choisir encore ${minChoix - optionsChoisies.length}` : `AJOUTER ${finalPriceCalculated} DH`}
        </button>
      </div>
    </div>
  );
}

export default App;