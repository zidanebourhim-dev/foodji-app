import { useState, useEffect, useRef } from 'react';
import { db, auth } from './firebase';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, addDoc, onSnapshot, doc, deleteDoc, updateDoc, query, writeBatch } from 'firebase/firestore';
import './App.css';

// ==========================================
// CONFIGURATION
// ==========================================
const CODE_MANAGER = "1234"; 
const PHONE_NUMBER = "0537536689"; 
const RESTO_COORDS = { lat: 33.997484, lng: -6.735644 }; 

// ==========================================
// DATA
// ==========================================
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

const logoImg = "/logo.png";
const iconImg = "/icon.png";
const promoImg = "/promo.jpg"; 

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
  const [isZooming, setIsZooming] = useState(false); // État pour l'animation Zoom

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
  
  const [distanceClient, setDistanceClient] = useState(null);
  const [clientCoords, setClientCoords] = useState(null);
  const [showDistanceBlocker, setShowDistanceBlocker] = useState(false);
  
  const [derniereCommande, setDerniereCommande] = useState(null);

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

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371; 
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c; 
  };

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
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => setUser(u));
    const unsubscribeMenu = onSnapshot(collection(db, "produits"), (snap) => setMenu(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const q = query(collection(db, "commandes"));
    const unsubscribeCmd = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => b.date.seconds - a.date.seconds);
      if (list.length > prevCommandesLength.current && user) audioRef.current.play().catch(e => console.log("Son bloqué"));
      prevCommandesLength.current = list.length;
      setCommandes(list);
    });
    return () => { unsubscribeAuth(); unsubscribeMenu(); unsubscribeCmd(); };
  }, [user]);

  const categoriesReelles = [...new Set(menu.map(p => p.categorie))];
  const categoriesSelectAdmin = [...new Set([...TOUTES_CATEGORIES, ...categoriesReelles])];

  useEffect(() => { if (categoriesReelles.length > 0 && !adminCategorie) setAdminCategorie(categoriesReelles[0]); }, [menu, adminCategorie]);

  const isDimanche = new Date().getDay() === 0;
  let categoriesClient = [...categoriesReelles];
  if (isDimanche) categoriesClient = ['🔥 PROMOTIONS', ...categoriesReelles];
  useEffect(() => { if (categoriesClient.length > 0 && !categorieActive) setCategorieActive(categoriesClient[0]); }, [menu, categorieActive, isDimanche]);

  let menuClient = [];
  if (categorieActive === '🔥 PROMOTIONS') menuClient = [{ id: 'promo-sunday-card', nom: 'OFFRE DIMANCHE', description: '2 PIZZAS ACHETÉES = 1 OFFERTE (Moyennes uniquement)', categorie: '🔥 PROMOTIONS', prix: 0, image: promoImg, available: true, isPromoTrigger: true }];
  else menuClient = menu.filter(p => p.categorie === categorieActive && p.available !== false);

  let menuAdmin = [];
  if (adminCategorie === 'RUPTURE') menuAdmin = menu.filter(p => p.available === false);
  else menuAdmin = menu.filter(p => p.categorie === adminCategorie);

  const checkManagerAuth = () => { const code = prompt("🔒 Code Manager :"); if (code === CODE_MANAGER) return true; alert("❌ Incorrect"); return false; };
  const triggerImport = () => { if (checkManagerAuth()) fileInputRef.current.click(); };
  const handleCSVImport = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target.result; const rows = text.split('\n').filter(r => r.trim() !== '');
      if(confirm(`Importer ${rows.length} lignes ?`)) {
        setLoading(true);
        for (let i = 1; i < rows.length; i++) { 
          const row = rows[i]; const tokens = row.split(','); 
          if (tokens.length >= 5) {
             const cat = tokens[0].trim(); const name = tokens[1].trim(); const len = tokens.length;
             const p1 = Number(tokens[len-3].replace(',','.'))||0; const p2 = Number(tokens[len-2].replace(',','.'))||0; const p3 = Number(tokens[len-1].replace(',','.'))||0;
             let vars = [];
             if (p2 > 0 || p3 > 0) {
                let n1="Standard", n2="Moyen", n3="Grand";
                if (cat.toLowerCase().includes('tacos')) { n1="L"; n2="XL"; n3="XXL"; }
                else if (cat.toLowerCase().includes('pizza')) { n1="M"; n2="L"; n3="XL"; }
                if(p1>0) vars.push({nom:n1, prix:p1}); if(p2>0) vars.push({nom:n2, prix:p2}); if(p3>0) vars.push({nom:n3, prix:p3});
             }
             if(name && cat) await addDoc(collection(db, "produits"), { categorie: cat, nom: name, description: tokens.slice(2, len-3).join(', ').replace(/"/g, ''), prix: vars.length>0?0:p1, image: '', variantes: vars, date: new Date(), available: true });
          }
        }
        setLoading(false); alert("Terminé"); e.target.value = null; 
      }
    };
    reader.readAsText(file);
  };
  const viderMenu = async () => { if (!checkManagerAuth()) return; if(confirm("⚠️ TOUT SUPPRIMER ?")) { setLoading(true); const batch = writeBatch(db); menu.forEach(p => batch.delete(doc(db, "produits", p.id))); await batch.commit(); setLoading(false); alert("Menu vidé"); } };
  const handleStaffAccess = () => { if (user) setView('admin'); else setView('login'); };

  // --- LOGIQUE ZOOM ---
  const handleEnterApp = () => {
      setIsZooming(true);
      setTimeout(() => {
          setView('client');
          setIsZooming(false);
      }, 700); // 0.7s correspond au CSS
  };

  const ajouterAuPanier = (item) => { if (item.isPromoTrigger) { setShowPromoWizard(true); return; } if (item.isInfo) return alert("Info"); setPanier([...panier, { ...item, uniqueId: Date.now() }]); setSelectedProduct(null); };
  const ajouterLotAuPanier = (lot) => { setPanier([...panier, ...lot.map((p,i) => ({ ...p, uniqueId: Date.now()+i }))]); setShowPromoWizard(false); };
  const retirerDuPanier = (uid) => setPanier(panier.filter(i => i.uniqueId !== uid));
  const getPrixItemAjuste = (item) => { let p = Number(item.prixFinal)||0; if (item.nom.toLowerCase().includes("pep's") && (typeCommande==='livraison'||typeCommande==='emporter')) p+=5; return p; };
  const calculerTotal = () => {
      let sous=0, pizzas=[]; panier.forEach(i => { const p=getPrixItemAjuste(i); sous+=p; if(i.isPromoEligible) pizzas.push({...i, pCalc:p}); });
      let rem=0; if(pizzas.length>=3) { pizzas.sort((a,b)=>a.pCalc-b.pCalc); for(let k=0; k<Math.floor(pizzas.length/3); k++) rem+=pizzas[k].pCalc; }
      const frais = (typeCommande==='livraison' && (sous-rem)<45 && (sous-rem)>0) ? 5 : 0;
      return { sousTotal:sous, remisePromo:rem, fraisLivraison:frais, grandTotal:(sous-rem)+frais };
  };
  const { remisePromo, fraisLivraison, grandTotal } = calculerTotal();

  const handleOpenPanier = () => {
      if (panier.length === 0) return alert("Panier vide !");
      if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition((pos) => {
              const d = calculateDistance(RESTO_COORDS.lat, RESTO_COORDS.lng, pos.coords.latitude, pos.coords.longitude);
              setClientCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
              setDistanceClient(d);
              if (d > 10) { setShowDistanceBlocker(true); return; }
              if (d > 4 && grandTotal < 300) return alert(`⛔️ Zone 4km-10km (${d.toFixed(1)} km).\nMin: 300 DH.`);
              setView('panier');
          }, () => { if (grandTotal >= 300) setView('panier'); else alert("⚠️ GPS Requis"); });
      } else alert("GPS HS");
  };

  const envoyerCommande = async () => {
    const h = new Date().getHours();
    if (h < 12 || h >= 23) return alert("😴 Restaurant Fermé (12h-23h)");
    if (panier.length===0) return alert("Vide");
    if (!clientNom.trim() || !clientTel.trim()) return alert("Nom/Tél requis");
    if (!/^(06|07)\d{8}$/.test(clientTel.replace(/\s/g,''))) return alert("Tél Invalide");
    if (typeCommande==='livraison' && !adresse.trim()) return alert("Adresse requise");
    if (distanceClient > 10) return alert("Trop loin (>10km)");

    setLoading(true);
    localStorage.setItem('clientNom', clientNom); localStorage.setItem('clientTel', clientTel); if(adresse) localStorage.setItem('clientAdresse', adresse);
    const data = { client: clientNom, tel: clientTel, type: typeCommande, adresse, commentaire, items: panier.map(i=>({...i, prixFinal:getPrixItemAjuste(i)})), total: grandTotal, remisePromo, fraisLivraison, date: new Date(), status: grandTotal>=300?'En cours de validation':'En attente', distance: distanceClient?distanceClient.toFixed(2):'N/A', lat: clientCoords?.lat||0, lng: clientCoords?.lng||0 };
    try { const ref = await addDoc(collection(db, "commandes"), data); setDerniereCommande({...data, id:ref.id}); setPanier([]); setView('ticket'); } catch(e){alert("Erreur");}
    setLoading(false);
  };

  // Admin
  const toggleAvailability = async (item) => await updateDoc(doc(db,"produits",item.id), {available:!item.available});
  const saveProduit = async () => { if(!nom) return; setLoading(true); const d={nom,description,categorie,prix:variantes.length>0?0:Number(prixBase),variantes,available:true,date:new Date()}; if(image) d.image=image; if(editId) await updateDoc(doc(db,"produits",editId),d); else await addDoc(collection(db,"produits"),d); setEditId(null); setNom(''); setPrixBase(''); setVariantes([]); setLoading(false); alert("OK"); };
  const handleEdit = (p) => { setEditId(p.id); setNom(p.nom); setDescription(p.description); setCategorie(p.categorie); if(p.variantes?.length>0) {setVariantes(p.variantes); setPrixBase('');} else {setVariantes([]); setPrixBase(p.prix);} window.scrollTo(0,0); };
  const updateProductImage = async (id, file) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload=(e)=>{ const img=document.createElement("img"); img.src=e.target.result; img.onload=async()=>{ const c=document.createElement("canvas"); c.width=800; c.height=img.height*(800/img.width); c.getContext("2d").drawImage(img,0,0,c.width,c.height); await updateDoc(doc(db,"produits",id),{image:c.toDataURL("image/jpeg",0.7)}); alert("Img OK"); } } };

  const btnStyle = { background: COLORS.primary, color: 'white', border: 'none', borderRadius: '12px', padding: '12px 20px', fontWeight: 'bold', width: '100%', cursor:'pointer', fontSize:'1rem', boxShadow: '0 4px 6px rgba(168, 68, 56, 0.2)' };
  const inputStyle = { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #E5E7EB', background: 'white', marginBottom: '10px', fontSize: '1rem', outline: 'none' };
  const cardStyle = { background: COLORS.card, borderRadius: '16px', padding: '15px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', border: '1px solid #F3F4F6' };

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', paddingBottom: '100px', color: COLORS.secondary }}>
      
      {showDistanceBlocker && (
          <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.95)', zIndex:9999, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'30px', color:'white', textAlign:'center'}}>
              <div style={{fontSize:'4rem', marginBottom:'20px'}}>⛔</div>
              <h2>Trop loin</h2>
              <p>Limité à 10km.</p>
              <a href={`tel:${PHONE_NUMBER}`} style={{background:'white', color:'black', padding:'15px 30px', borderRadius:'50px', textDecoration:'none', fontWeight:'bold'}}>📞 APPELER</a>
              <button onClick={()=>setShowDistanceBlocker(false)} style={{marginTop:'30px', background:'transparent', border:'1px solid #555', color:'#aaa', padding:'10px'}}>Fermer</button>
          </div>
      )}

      {/* --- LANDING MINIMALISTE & ZOOM --- */}
      {view === 'landing' && (
        <div style={{ position: 'fixed', top:0, left:0, width: '100%', height: '100%', background: 'linear-gradient(135deg, #1A1E29 0%, #000000 100%)', color: 'white', zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow:'hidden' }}>
          
          {/* LOGO QUI ZOOM */}
          <img 
            src={logoImg} 
            alt="Foodji" 
            className={`logo-idle ${isZooming ? 'super-zoom' : ''}`}
            style={{ width: '220px', height: '220px', objectFit: 'contain', zIndex: 10 }} 
            onError={(e)=>e.target.style.display='none'} 
          /> 
          
          {/* BOUTONS (DISPARAISSENT AU CLIC) */}
          <div className={isZooming ? 'fade-out' : 'content-enter'} style={{textAlign:'center', marginTop:'40px'}}>
              <button onClick={handleEnterApp} style={{
                background: COLORS.primary, color: 'white', border: 'none', padding: '18px 50px', 
                borderRadius: '50px', fontSize: '1.2rem', fontWeight: 'bold', 
                boxShadow: '0 10px 30px rgba(168, 68, 56, 0.5)'
              }}>
                VOIR LE MENU
              </button>

              {derniereCommande && (
                  <button onClick={() => setView('ticket')} style={{
                      display:'block', margin:'30px auto 0 auto', background: 'transparent', 
                      border: '1px solid #374151', color: COLORS.primary, padding: '10px 20px', 
                      borderRadius: '30px'
                  }}>
                      📄 Ma dernière commande
                  </button>
              )}

              <button onClick={handleStaffAccess} style={{marginTop:'50px', background:'transparent', border:'none', color:'#4B5563', fontSize:'0.8rem'}}>Staff Access</button>
          </div>
        </div>
      )}

      {view !== 'landing' && (
        <div style={{ background: COLORS.card, padding: '15px 20px', position: 'sticky', top: 0, zIndex: 50, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div onClick={()=>setView('landing')} style={{fontWeight:'bold', fontSize:'1.2rem', display:'flex', alignItems:'center', gap:'10px'}}><img src={iconImg} style={{height:'35px'}}/> Foodji</div>
          {user ? <button onClick={()=>setView(view==='admin'?'client':'admin')}>{view==='admin'?'App':'Admin'}</button> : (view==='client' && <button onClick={()=>setView('login')}>🔒</button>)}
        </div>
      )}

      {showPromoWizard && <PromoWizard menu={menu} onClose={()=>setShowPromoWizard(false)} onValidate={ajouterLotAuPanier} />}
      {selectedProduct && <ProductModal product={selectedProduct} onClose={()=>setSelectedProduct(null)} onAdd={ajouterAuPanier} />}

      {view === 'client' && (
        <div style={{padding:'20px'}}>
          <div style={{overflowX:'auto', whiteSpace:'nowrap', marginBottom:'20px', paddingBottom:'5px'}}>
             {categoriesClient.map(c => <button key={c} onClick={()=>setCategorieActive(c)} style={{marginRight:'10px', padding:'10px 20px', borderRadius:'20px', border:'none', background:categorieActive===c?COLORS.primary:'white', color:categorieActive===c?'white':'black', boxShadow:'0 2px 5px rgba(0,0,0,0.05)'}}>{c}</button>)}
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
             {menuClient.map(p => (
                 <div key={p.id} onClick={()=>setSelectedProduct(p)} style={{...cardStyle, padding:0, overflow:'hidden', cursor:'pointer', position:'relative'}}>
                    {/* IMAGE CARRÉE 1:1 */}
                    <div style={{width:'100%', aspectRatio:'1/1', background:'#eee', backgroundImage:`url(${p.image||'https://via.placeholder.com/300'})`, backgroundSize:'cover', backgroundPosition:'center'}}>
                        {p.isPromoTrigger && <div style={{position:'absolute', bottom:0, width:'100%', background:'rgba(0,0,0,0.6)', color:'white', textAlign:'center', padding:'5px', fontSize:'0.8rem'}}>PROMO</div>}
                    </div>
                    <div style={{padding:'10px'}}>
                        <div style={{fontWeight:'bold', fontSize:'0.95rem'}}>{p.nom}</div>
                        <div style={{fontSize:'0.75rem', color:'#888', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden'}}>{p.description}</div>
                        <div style={{marginTop:'8px', fontWeight:'bold', color:COLORS.primary, display:'flex', justifyContent:'space-between'}}>
                            <span>{p.prix>0?p.prix+' DH':'Choix'}</span><span style={{background:COLORS.secondary, color:'white', width:'22px', height:'22px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center'}}>+</span>
                        </div>
                    </div>
                 </div>
             ))}
          </div>
          {panier.length > 0 && (
             <div onClick={handleOpenPanier} style={{position:'fixed', bottom:'30px', left:'5%', width:'90%', background:COLORS.secondary, color:'white', padding:'15px 25px', borderRadius:'50px', display:'flex', justifyContent:'space-between', alignItems:'center', boxShadow:'0 10px 25px rgba(0,0,0,0.2)', cursor:'pointer', zIndex:99}}>
                <span>🛒 {panier.length}</span><span style={{fontWeight:'bold'}}>{grandTotal} DH</span>
             </div>
          )}
        </div>
      )}

      {view === 'panier' && (
         <div style={{padding:'20px', background:'white', minHeight:'100vh'}}>
            <h2>Panier</h2>
            {typeCommande==='livraison' && <div style={{background:'#FEF2F2', color:'#B91C1C', padding:'10px', borderRadius:'8px', marginBottom:'20px', fontSize:'0.9rem'}}>⚠️ Zones UIR/Techno : Supplément à payer au livreur.</div>}
            {panier.map(i => (
                <div key={i.uniqueId} style={{display:'flex', justifyContent:'space-between', borderBottom:'1px solid #eee', padding:'10px 0'}}>
                    <div><b>{i.nom}</b> <small>({i.varianteNom})</small><br/><small style={{color:'#666'}}>{i.sauces?.join(', ')} {i.isCheesyCrust?'Cheesy':''} {i.extras?.map(e=>e.nom)}</small></div>
                    <div style={{display:'flex', alignItems:'center', gap:'10px'}}><b>{getPrixItemAjuste(i)} DH</b><button onClick={()=>retirerDuPanier(i.uniqueId)} style={{color:'red', border:'none', background:'transparent'}}>×</button></div>
                </div>
            ))}
            <div style={{textAlign:'right', fontSize:'1.5rem', fontWeight:'bold', margin:'20px 0'}}>Total: {grandTotal} DH</div>
            <div style={{background: COLORS.bg, padding: '20px', borderRadius: '15px'}}>
                <div style={{display:'flex', gap:'10px', marginBottom:'15px'}}>{['sur_place','emporter','livraison'].map(m=><button key={m} onClick={()=>setTypeCommande(m)} style={{flex:1, padding:'10px', borderRadius:'10px', border:typeCommande===m?`2px solid ${COLORS.secondary}`:'1px solid #ddd', background:typeCommande===m?COLORS.secondary:'white', color:typeCommande===m?'white':'black'}}>{m.replace('_',' ')}</button>)}</div>
                <input placeholder="Nom" value={clientNom} onChange={e=>setClientNom(e.target.value)} style={inputStyle} />
                <input placeholder="Tél (06/07...)" value={clientTel} onChange={e=>setClientTel(e.target.value)} style={inputStyle} />
                {typeCommande==='livraison' && <textarea placeholder="Adresse" value={adresse} onChange={e=>setAdresse(e.target.value)} style={{...inputStyle, height:'80px'}} />}
                <textarea placeholder="Commentaire" value={commentaire} onChange={e=>setCommentaire(e.target.value)} style={inputStyle} />
                <button onClick={envoyerCommande} disabled={loading} style={{...btnStyle, background:COLORS.success}}>{loading?'...':'VALIDER'}</button>
            </div>
            <button onClick={()=>setView('client')} style={{marginTop:'20px', width:'100%', border:'none', background:'transparent'}}>Retour</button>
         </div>
      )}

      {view === 'ticket' && derniereCommande && (
          <div style={{textAlign:'center', padding:'40px 20px', background:'white', minHeight:'100vh'}}>
              <div style={{fontSize:'3rem', marginBottom:'20px'}}>{derniereCommande.status==='En attente'?'✅':'⚠️'}</div>
              <h2>{derniereCommande.status==='En attente' ? 'Reçu !' : 'En Validation'}</h2>
              <p>Total: {derniereCommande.total} DH</p>
              <button onClick={()=>setView('client')} style={{...btnStyle, width:'auto', marginTop:'30px'}}>Nouvelle commande</button>
          </div>
      )}

      {view === 'login' && (
          <div style={{textAlign:'center', padding:'50px 20px'}}><h2>Staff</h2><input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} style={inputStyle} /><input type="password" placeholder="Pass" value={password} onChange={e=>setPassword(e.target.value)} style={inputStyle} /><button onClick={()=>signInWithEmailAndPassword(auth, email, password).then(()=>setView('admin')).catch(()=>alert('Erreur'))} style={btnStyle}>GO</button></div>
      )}

      {view === 'admin' && user && (
          <div style={{padding:'20px'}}>
              <div style={{display:'flex', justifyContent:'space-between'}}><h2>Admin</h2><button onClick={viderMenu} style={{background:'red', color:'white', border:'none', borderRadius:'5px'}}>Reset</button></div>
              <div style={{display:'grid', gap:'15px', marginTop:'20px'}}>
                  {commandes.map(c => (
                      <div key={c.id} style={{background:'white', padding:'15px', borderRadius:'10px', borderLeft:`5px solid ${c.status==='Terminé'?'#ccc':(c.status==='En cours de validation'?'orange':'green')}`}}>
                          <div style={{display:'flex', justifyContent:'space-between'}}><b>{c.client} ({c.distance} km)</b><b>{c.total} DH</b></div>
                          <div>{c.tel} | {c.type}</div>
                          {c.items.map((i,idx)=><div key={idx} style={{fontSize:'0.9rem'}}>- {i.nom} ({i.varianteNom})</div>)}
                          {c.status==='En cours de validation' ? (<div style={{marginTop:'10px', display:'flex', gap:'10px'}}><button onClick={()=>updateDoc(doc(db,"commandes",c.id),{status:'En attente'})} style={{flex:1, background:'green', color:'white', border:'none', padding:'10px'}}>Valider</button><button onClick={()=>updateDoc(doc(db,"commandes",c.id),{status:'Refusé'})} style={{flex:1, background:'red', color:'white', border:'none', padding:'10px'}}>Refuser</button></div>) : (c.status!=='Terminé' && <button onClick={()=>updateDoc(doc(db,"commandes",c.id),{status:'Terminé'})} style={{marginTop:'10px', width:'100%', background:'#ccc', border:'none', padding:'10px'}}>Servi</button>)}
                          {c.lat && c.lng && <a href={`https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`} target="_blank" style={{display:'block', marginTop:'10px', color:'blue'}}>Map</a>}
                      </div>
                  ))}
              </div>
              <h3 style={{marginTop:'40px'}}>Produits</h3>
              <div style={{marginBottom:'15px', overflowX:'auto', whiteSpace:'nowrap'}}>{categoriesSelectAdmin.map(c=><button key={c} onClick={()=>setAdminCategorie(c)} style={{marginRight:'5px', padding:'5px'}}>{c}</button>)}</div>
              {menuAdmin.map(p => (<div key={p.id} style={{display:'flex', justifyContent:'space-between', background:'white', padding:'10px', borderBottom:'1px solid #eee'}}><div onClick={()=>toggleAvailability(p)} style={{color:p.available?'green':'red'}}>{p.nom}</div><div><button onClick={()=>handleEdit(p)}>✏️</button><button onClick={()=>deleteDoc(doc(db,"produits",p.id))}>🗑️</button></div></div>))}
              <div style={{marginTop:'30px', background:'white', padding:'15px'}}>
                  <input placeholder="Nom" value={nom} onChange={e=>setNom(e.target.value)} style={inputStyle} />
                  <textarea placeholder="Desc" value={description} onChange={e=>setDescription(e.target.value)} style={inputStyle} />
                  <select value={categorie} onChange={e=>setCategorie(e.target.value)} style={inputStyle}>{categoriesSelectAdmin.map(c=><option key={c}>{c}</option>)}</select>
                  <input placeholder="Prix" value={prixBase} onChange={e=>setPrixBase(e.target.value)} style={inputStyle} />
                  <button onClick={saveProduit} style={btnStyle}>OK</button>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleCSVImport} style={{display:'none'}} />
              <button onClick={triggerImport} style={{marginTop:'30px'}}>Import CSV</button>
          </div>
      )}
    </div>
  );
}

// Sub-components
function PromoWizard({menu, onClose, onValidate}) {
    const [choix, setChoix] = useState([]);
    const pizzas = menu.filter(p => p.categorie==='Pizzas' && p.available!==false && !PIZZAS_EXCLUES_PROMO.some(e=>p.nom.toLowerCase().includes(e)));
    const add = (p) => { if(choix.length<3) setChoix([...choix, {...p, prixFinal: p.prix, originalPrice: p.prix, isPromoEligible: true}]) };
    return (<div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.9)', zIndex:3000, padding:'20px', color:'white', overflowY:'auto'}}><h3>Choix {choix.length}/3 <button onClick={onClose} style={{float:'right'}}>X</button></h3>{choix.length<3 ? pizzas.map(p=><button key={p.id} onClick={()=>add(p)} style={{display:'block', width:'100%', padding:'15px', marginBottom:'10px', borderRadius:'10px'}}>{p.nom}</button>) : <button onClick={()=>onValidate(choix)} style={{width:'100%', padding:'20px', background:'green', color:'white', fontSize:'1.2rem'}}>VALIDER</button>}</div>)
}

function ProductModal({product, onClose, onAdd}) {
    const [selVar, setSelVar] = useState(product.variantes?.[0] || null);
    const [opts, setOpts] = useState([]); const [sauces, setSauces] = useState([]); const [pates, setPates] = useState(null); const [cheesy, setCheesy] = useState(false); const [extras, setExtras] = useState([]); const [sans, setSans] = useState([]);
    const isTacos = product.categorie.toLowerCase().includes('tacos'); const isPizza = product.categorie.toLowerCase().includes('pizza');
    let base = selVar ? Number(selVar.prix) : Number(product.prix);
    let total = base + extras.reduce((a,b)=>a+b.prix,0) + (cheesy? (selVar?.nom==='M'||!selVar?15:25) : 0);
    return (<div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.5)', zIndex:2500, display:'flex', alignItems:'flex-end'}}><div style={{background:'white', width:'100%', padding:'20px', borderRadius:'20px 20px 0 0', maxHeight:'80vh', overflowY:'auto'}}><h3>{product.nom} <button onClick={onClose} style={{float:'right'}}>X</button></h3>{product.variantes && <div style={{display:'flex', gap:'10px', marginBottom:'10px'}}>{product.variantes.map(v=><button key={v.nom} onClick={()=>setSelVar(v)} style={{border:selVar===v?'2px solid red':'1px solid #ddd', padding:'5px 10px'}}>{v.nom}</button>)}</div>}{isPizza && EXTRAS_PIZZA.map(e=><button key={e.nom} onClick={()=>setExtras(extras.includes(e)?extras.filter(x=>x!==e):[...extras,e])} style={{margin:'5px', background:extras.includes(e)?'#eee':'white'}}>{e.nom}</button>)}{isTacos && LISTE_SAUCES.map(s=><div key={s} onClick={()=>setSauces(sauces.includes(s)?sauces.filter(x=>x!==s):[...sauces,s])}>{s} {sauces.includes(s)?'V':''}</div>)}<button onClick={()=>onAdd({...product, prixFinal: total, varianteNom: selVar?.nom, sauces, optionsChoisies: opts, choixPates: pates, isCheesyCrust: cheesy, extras, sans})} style={{width:'100%', padding:'15px', background:'red', color:'white', marginTop:'20px'}}>AJOUTER {total} DH</button></div></div>)
}

export default App;