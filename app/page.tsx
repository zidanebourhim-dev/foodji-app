import { useState, useEffect, useRef } from 'react';
import { db, auth } from './firebase';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  doc, 
  deleteDoc, 
  updateDoc, 
  query, 
  writeBatch,
  setDoc,
  getDoc
} from 'firebase/firestore';
import './App.css';

const CODE_MANAGER = "1909"; 
const PHONE_NUMBER = "0537536689"; 
const RESTO_COORDS = { 
  lat: 33.997484, 
  lng: -6.735644 
}; 

const LISTE_VIANDES = [
  "Poulet", "Viande Hachée", "Cordon Bleu", "Nuggets", "Poulet Crispy"
];

const LISTE_GARNITURES_PIZZA = [
  "Viande Hachée", "Poulet", "4 Fromages", "Cannibale", "Pepperoni", 
  "Thon", "Charcuterie", "Végétarienne", "Fruits de Mer"
];

const LISTE_SAUCES = [
  "Algérienne Fait Maison", "Biggy Fait Maison", "Barbecue Fait Maison", "Pas de sauce"
]; 

const TYPES_PATES = ["Penne", "Tagliatelle", "Spaghetti"];

const EXTRAS_PIZZA = [
    { nom: "Extra Champignons", prix: 10 },
    { nom: "Extra Mozzarella", prix: 10 },
    { nom: "Extra Parmesan", prix: 15 },
    { nom: "Extra Cheddar", prix: 15 }
];

const RETRAIT_INGREDIENTS = [
  "Sans Tomate", "Sans Salade", "Sans Oignons", "Sans Cornichons", "Sans Sauce"
];

const PIZZAS_EXCLUES_PROMO = [
  "4 saisons", "fruits de mer", "cannibale", "2 saisons"
];

const TOUTES_CATEGORIES = [
  "Tacos", "Pizzas", "Burgers", "Pâtes", "Sides", 
  "Les Burritos", "Koniks", "Plats", "Salades", "Boissons", "Desserts"
];

const NOTIF_SOUND = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

const logoImg = "/logo.png";
const iconImg = "/icon.png";
const promoImg = "/promo.jpg"; 

const COLORS = {
  primary: '#A84438',    
  secondary: '#1A1E29',  
  bg: '#F3F4F6',
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
  const [isZooming, setIsZooming] = useState(false);
  const [showCGU, setShowCGU] = useState(false);
  
  const [rushLevel, setRushLevel] = useState(null); 

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
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c; 
  };

  useEffect(() => {
      const savedNom = localStorage.getItem('clientNom');
      const savedTel = localStorage.getItem('clientTel');
      const savedAdresse = localStorage.getItem('clientAdresse');
      const savedTicket = localStorage.getItem('derniereCommande'); 
      const cguAccepted = localStorage.getItem('cgu_accepted');

      if (savedNom) setClientNom(savedNom);
      if (savedTel) setClientTel(savedTel);
      if (savedAdresse) setAdresse(savedAdresse);
      if (savedTicket) setDerniereCommande(JSON.parse(savedTicket));
      if (!cguAccepted) setShowCGU(true);
  }, []);

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
          audioRef.current.play().catch(e => {});
      }
      prevCommandesLength.current = list.length;
      setCommandes(list);
    });

    const unsubscribeSettings = onSnapshot(doc(db, "settings", "config"), (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            if (data.rushUntil && data.rushUntil > Date.now()) {
                setRushLevel(data.rushLevel || 'orange');
            } else {
                setRushLevel(null);
            }
        }
    });

    return () => { unsubscribeAuth(); unsubscribeMenu(); unsubscribeCmd(); unsubscribeSettings(); };
  }, [user]);

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

  let menuClient = [];
  if (categorieActive === '🔥 PROMOTIONS') {
      menuClient = [{
          id: 'promo-sunday-card',
          nom: 'OFFRE DIMANCHE',
          description: '2 PIZZAS ACHETÉES = 1 OFFERTE (Moyennes uniquement)',
          categorie: '🔥 PROMOTIONS',
          prix: 0,
          image: promoImg, 
          available: true,
          isPromoTrigger: true 
      }];
  } else {
      menuClient = menu.filter(p => p.categorie === categorieActive && p.available !== false);
  }

  let menuAdmin = [];
  if (adminCategorie === 'RUPTURE') {
      menuAdmin = menu.filter(p => p.available === false);
  } else {
      menuAdmin = menu.filter(p => p.categorie === adminCategorie);
  }

  const checkManagerAuth = () => {
      const code = prompt("🔒 Code Manager requis :");
      if (code === CODE_MANAGER) return true;
      alert("❌ Code incorrect !");
      return false;
  };

  const triggerImport = () => {
      if (checkManagerAuth()) {
          fileInputRef.current.click();
      }
  };

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
             const cat = tokens[0].trim();
             const name = tokens[1].trim();
             const len = tokens.length;
             const p1Raw = tokens[len - 3];
             const p2Raw = tokens[len - 2];
             const p3Raw = tokens[len - 1];
             
             const clean = (val) => val ? Number(val.toString().replace(/[^0-9.]/g, '')) : 0;
             const p1 = clean(p1Raw.replace(',','.'));
             const p2 = clean(p2Raw.replace(',','.'));
             const p3 = clean(p3Raw.replace(',','.'));

             let vars = [];
             if (p2 > 0 || p3 > 0) {
                let n1="Standard", n2="Moyen", n3="Grand";
                if (cat.toLowerCase().includes('tacos')) { n1="L"; n2="XL"; n3="XXL"; }
                else if (cat.toLowerCase().includes('pizza')) { n1="M"; n2="L"; n3="XL"; }
                if(p1>0) vars.push({nom:n1, prix:p1});
                if(p2>0) vars.push({nom:n2, prix:p2});
                if(p3>0) vars.push({nom:n3, prix:p3});
             }
             if(name && cat) {
               await addDoc(collection(db, "produits"), {
                 categorie: cat, nom: name, description: tokens.slice(2, len - 3).join(', ').replace(/"/g, ''),
                 prix: vars.length>0?0:p1, image: '', variantes: vars, date: new Date(), available: true 
               });
             }
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

  const handleStaffAccess = () => {
      if (user) setView('admin'); 
      else setView('login'); 
  };

  const handleEnterApp = () => {
      setView('client');
  };

  const accepterCGU = () => {
      localStorage.setItem('cgu_accepted', 'true');
      setShowCGU(false);
  };

  const checkIsOpen = () => {
      const now = new Date();
      let day = now.getDay();
      const h = now.getHours();

      // Gestion des heures après minuit (appartiennent au jour d'avant pour le service)
      if (h < 5) {
          day = day - 1;
          if (day === -1) day = 6;
      }

      // Lundi (1) à Jeudi (4) : 12h00 - 01h00
      if (day >= 1 && day <= 4) {
          return (h >= 12 || h < 1);
      }

      // Vendredi (5) : 12h00 - 02h00
      if (day === 5) {
          return (h >= 12 || h < 2);
      }

      // Samedi (6) et Dimanche (0) : 18h00 - 02h00
      if (day === 6 || day === 0) {
          return (h >= 18 || h < 2);
      }

      return false;
  };

  const activateRush = async (level) => {
      const time = level === 'orange' ? 45 : 60;
      const until = Date.now() + time * 60 * 1000;
      await setDoc(doc(db, "settings", "config"), { rushUntil: until, rushLevel: level }, { merge: true });
      alert(`Mode RUSH ${level === 'orange' ? 'Standard' : 'EXPLOSION'} activé pour ${time} min.`);
  };

  const ajouterAuPanier = (itemMerged) => {
    if (itemMerged.isPromoTrigger) {
        setShowPromoWizard(true);
        return;
    }
    if (itemMerged.isInfo) return alert("Info seulement.");
    
    setPanier([...panier, { ...itemMerged, uniqueId: Date.now() }]);
    setSelectedProduct(null); 
  };

  const ajouterLotAuPanier = (lotPizzas) => {
      setPanier([...panier, ...lotPizzas.map((p, index) => ({ ...p, uniqueId: Date.now() + index }))]);
      setShowPromoWizard(false);
  };

  const retirerDuPanier = (uid) => {
      setPanier(panier.filter(i => i.uniqueId !== uid));
  };
  
  const getPrixItemAjuste = (item) => {
      let prix = Number(item.prixFinal) || 0;
      if (item.nom.toLowerCase().includes("pep's") && (typeCommande === 'livraison' || typeCommande === 'emporter')) {
          prix += 5;
      }
      return prix;
  };

  const calculerTotal = () => {
      let sousTotal = 0;
      let pizzasEligibles = [];

      panier.forEach(item => {
          const p = getPrixItemAjuste(item);
          sousTotal += p;
          if (item.isPromoEligible) pizzasEligibles.push({ ...item, prixCalcul: p });
      });

      let remisePromo = 0;
      if (pizzasEligibles.length >= 3) {
          pizzasEligibles.sort((a, b) => a.prixCalcul - b.prixCalcul);
          const nbGratuites = Math.floor(pizzasEligibles.length / 3);
          for (let i = 0; i < nbGratuites; i++) {
              remisePromo += pizzasEligibles[i].prixCalcul;
          }
      }

      const fraisLivraison = (typeCommande === 'livraison' && (sousTotal - remisePromo) < 45 && (sousTotal - remisePromo) > 0) ? 5 : 0;
      const grandTotal = (sousTotal - remisePromo) + fraisLivraison;

      return { sousTotal, remisePromo, fraisLivraison, grandTotal };
  };

  const { remisePromo, fraisLivraison, grandTotal } = calculerTotal();

  const handleOpenPanier = () => {
      if (panier.length === 0) return alert("Panier vide !");

      if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition((position) => {
              const uLat = position.coords.latitude;
              const uLng = position.coords.longitude;
              setClientCoords({ lat: uLat, lng: uLng });
              
              const dist = calculateDistance(RESTO_COORDS.lat, RESTO_COORDS.lng, uLat, uLng);
              setDistanceClient(dist);

              if (dist > 10) {
                  setShowDistanceBlocker(true); 
                  return; 
              }

              if (grandTotal >= 300) {
                  setView('panier');
                  return;
              }
              if (dist > 4 && grandTotal < 300) {
                  return alert(`⛔️ Zone 4km-10km (${dist.toFixed(1)} km).\n\nLe minimum de commande est de 300 DH.`);
              }

              setView('panier');

          }, (error) => {
              if (grandTotal >= 300) {
                  setView('panier');
              } else {
                  alert("⚠️ La géolocalisation est OBLIGATOIRE pour vérifier votre zone de livraison.");
              }
          });
      } else {
          alert("GPS non supporté.");
      }
  };

  const envoyerCommande = async () => {
    if (!checkIsOpen()) {
        return alert("😴 Le restaurant est fermé.\n\nHoraires :\nLundi-Jeudi : 12h00 - 01h00\nVendredi : 12h00 - 02h00\nSamedi-Dimanche : 18h00 - 02h00");
    }

    if (panier.length === 0) return alert("Panier vide !");
    if (!clientNom.trim()) return alert("Nom obligatoire.");
    
    const telClean = clientTel.replace(/\s/g, ''); 
    if (!/^(06|07)\d{8}$/.test(telClean)) return alert("Numéro invalide (06... ou 07...)");
    if (typeCommande === 'livraison' && !adresse.trim()) return alert("Adresse obligatoire.");
    if (distanceClient > 10) return alert("Trop loin (>10km).");

    setLoading(true);
    localStorage.setItem('clientNom', clientNom);
    localStorage.setItem('clientTel', telClean);
    if(adresse) localStorage.setItem('clientAdresse', adresse);

    const panierFinal = panier.map(item => ({
        ...item,
        prixFinal: getPrixItemAjuste(item)
    }));

    let status = 'En attente';
    if (grandTotal >= 300) status = 'En cours de validation';

    const data = {
        client: clientNom, 
        tel: telClean, 
        type: typeCommande, 
        adresse, 
        commentaire,
        items: panierFinal, 
        total: grandTotal, 
        remisePromo, 
        fraisLivraison, 
        date: new Date(), 
        status, 
        distance: distanceClient ? distanceClient.toFixed(2) : 'N/A',
        lat: clientCoords?.lat || 0,
        lng: clientCoords?.lng || 0
    };

    try {
      const ref = await addDoc(collection(db, "commandes"), data);
      const ticket = { ...data, id: ref.id, date: new Date().toLocaleString() };
      localStorage.setItem('derniereCommande', JSON.stringify(ticket));
      setDerniereCommande(ticket);
      setPanier([]); 
      setCommentaire('');
      setView('ticket'); 
    } catch (e) { 
        alert("Erreur réseau"); 
    }
    setLoading(false);
  };

  const toggleAvailability = async (item) => {
    await updateDoc(doc(db, "produits", item.id), { available: !item.available });
  };
  
  const handleCategoryChange = (e) => {
      const cat = e.target.value;
      setCategorie(cat);
      if (!editId) {
          if (cat === 'Tacos') {
              setVariantes([{nom: 'L', prix: ''}, {nom: 'XL', prix: ''}, {nom: 'XXL', prix: ''}]);
              setPrixBase('');
          } else if (cat === 'Pizzas') {
              setVariantes([{nom: 'M', prix: ''}, {nom: 'L', prix: ''}]);
              setPrixBase('');
          } else {
              setVariantes([]);
          }
      }
  };

  const handleEdit = (p) => {
      setEditId(p.id);
      setNom(p.nom);
      setDescription(p.description || ''); 
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
        nom, description, categorie, 
        prix: variantes.length > 0 ? 0 : Number(prixBase), 
        variantes, 
        available: true,
        date: new Date()
    };
    if(image) data.image = image;
    if (editId) {
        await updateDoc(doc(db, "produits", editId), data);
        alert("Modifié !");
        setEditId(null);
    } else {
        await addDoc(collection(db, "produits"), data);
        alert("Ajouté !");
    }
    setNom(''); setDescription(''); setImage(''); setPrixBase(''); setVariantes([]); 
    setLoading(false);
  };

  const supprimerProduit = async (id) => { 
      if (!checkManagerAuth()) return;
      if(confirm("Confirmer la suppression définitive ?")) {
          await deleteDoc(doc(db, "produits", id)); 
      }
  };
  
  const copierOdoo = (cmd) => {
    let t = `Nom : ${cmd.client}\nTél : ${cmd.tel}\n`;
    if (cmd.type === 'livraison') t += `Adresse : ${cmd.adresse}`;
    else t += `Mode : ${cmd.type === 'sur_place' ? 'Sur Place' : 'Emporter'}`;
    if (cmd.commentaire) t += `\nNote : ${cmd.commentaire}`;
    navigator.clipboard.writeText(t).then(() => alert("Copié !"));
  };
  
  const changerStatus = async (id, st) => {
      await updateDoc(doc(db, "commandes", id), { status: st });
  };
  
  const supprimerCmd = async (id) => { 
      if(confirm("Supprimer cette commande ?")) await deleteDoc(doc(db, "commandes", id)); 
  };
  
  const updateProductImage = async (id, file) => {
    if(!file) return;
    const reader = new FileReader(); 
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = document.createElement("img"); 
      img.src = e.target.result;
      img.onload = async () => {
         const c = document.createElement("canvas"); 
         const ctx = c.getContext("2d");
         const s = 800/img.width; 
         c.width = 800; 
         c.height = img.height*s;
         ctx.drawImage(img,0,0,c.width,c.height); 
         await updateDoc(doc(db, "produits", id), { image: c.toDataURL("image/jpeg", 0.7) });
         alert("Image mise à jour !");
      }
    };
  };

  const btnStyle = { 
      background: COLORS.primary, color: 'white', border: 'none', borderRadius: '12px', 
      padding: '12px 20px', fontWeight: '600', cursor: 'pointer', width: '100%', 
      fontSize: '1rem', boxShadow: '0 4px 6px rgba(168, 68, 56, 0.2)' 
  };
  const inputStyle = { 
      width: '100%', padding: '12px', borderRadius: '10px', 
      border: '1px solid #E5E7EB', background: 'white', marginBottom: '10px', 
      fontSize: '1rem', outline: 'none' 
  };
  const cardStyle = { 
      background: COLORS.card, borderRadius: '16px', padding: '15px', 
      boxShadow: '0 2px 10px rgba(0,0,0,0.03)', border: '1px solid #F3F4F6' 
  };

  return (
    <div style={{ background: COLORS.bg, minHeight: '100vh', paddingBottom: '100px', color: COLORS.secondary }}>
      
      {showDistanceBlocker && (
          <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.95)', zIndex:9999, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'30px', color:'white', textAlign:'center'}}>
              <div style={{fontSize:'4rem', marginBottom:'20px'}}>⛔</div>
              <h2 style={{fontSize:'1.8rem', color: COLORS.danger, marginBottom:'20px'}}>Trop loin pour commander</h2>
              <p style={{fontSize:'1.1rem', marginBottom:'30px', lineHeight:'1.5'}}>
                  Vous êtes situé à <strong>{distanceClient ? distanceClient.toFixed(1) : '?'} km</strong>.<br/>
                  Nous limitons les commandes en ligne à 10 km.
              </p>
              <a href={`tel:${PHONE_NUMBER}`} style={{background: 'white', color: 'black', padding: '20px 40px', borderRadius: '50px', textDecoration: 'none', fontWeight: 'bold', fontSize: '1.2rem'}}>📞 APPELER</a>
              <button onClick={() => setShowDistanceBlocker(false)} style={{marginTop:'40px', background:'transparent', border:'1px solid #555', color:'#aaa', padding:'10px 20px', borderRadius:'20px'}}>Fermer</button>
          </div>
      )}

      {/* --- POPUP CGU --- */}
      {showCGU && (
          <div style={{
              position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
              background: 'rgba(0,0,0,0.85)',
              zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
              backdropFilter: 'blur(5px)'
          }}>
              <div style={{
                  background: 'white', width: '100%', maxWidth: '600px', borderRadius: '20px',
                  padding: '25px', maxHeight: '85vh', display: 'flex', flexDirection: 'column',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
              }}>
                  <h2 style={{margin: '0 0 20px 0', textAlign: 'center', color: COLORS.primary}}>CONDITIONS GÉNÉRALES</h2>
                  <div style={{
                      flex: 1, overflowY: 'auto', paddingRight: '10px',
                      fontSize: '0.85rem', lineHeight: '1.6', textAlign: 'justify', borderBottom: '1px solid #eee', marginBottom: '20px'
                  }}>
                      <p><strong>PRÉAMBULE</strong><br/>L'accès et l'utilisation de l'application Foodji impliquent l'acceptation intégrale et sans réserve des présentes Conditions Générales par tout utilisateur.</p>
                      <p><strong>ARTICLE 1 : OBJET</strong><br/>Les présentes conditions régissent les ventes entre le restaurant Foodji et le Client.</p>
                      <p><strong>ARTICLE 2 : GÉOLOCALISATION</strong><br/>L'utilisation du service nécessite l'activation du GPS. Aucune commande ne pourra être livrée si la position du Client se situe au-delà de 10km du restaurant.</p>
                      <p><strong>ARTICLE 3 : ZONES DE LIVRAISON</strong><br/>- Zone 1 (0 à 4 km) : Aucun minimum de commande.<br/>- Zone 2 (4 à 10 km) : Un minimum de commande de 300,00 DH est exigé.</p>
                      <p><strong>ARTICLE 4 : ZONES SPÉCIALES</strong><br/>Le Client est informé que certaines zones (UIR, Technopolis, UM6P) font l'objet d'un supplément de livraison (10 à 15 DH) payable directement au livreur.</p>
                      <p><strong>ARTICLE 5 : PRODUITS ET PHOTOS</strong><br/>Les photographies des produits sont non contractuelles. Foodji ne saurait être tenu responsable des différences visuelles minimes.</p>
                      <p><strong>ARTICLE 6 : VALIDATION DES COMMANDES</strong><br/>Pour toute commande supérieure à 300,00 DH, une validation téléphonique est obligatoire. Sans réponse du Client, la commande sera annulée.</p>
                      <p><strong>ARTICLE 7 : PAIEMENT</strong><br/>Le paiement s'effectue intégralement à la livraison. En cas de non-paiement ou de commande "fantôme", le Client sera banni.</p>
                      <p><strong>ARTICLE 8 : HORAIRES D'OUVERTURE</strong><br/>Le service est ouvert :<br/>- Lundi à Jeudi : 12h00 à 01h00<br/>- Vendredi : 12h00 à 02h00<br/>- Samedi et Dimanche : 18h00 à 02h00.<br/>En dehors de ces horaires, la commande est impossible.</p>
                      <p><strong>ARTICLE 9 : RUSH ET DÉLAIS</strong><br/>En période de forte affluence signalée, les délais de livraison peuvent être considérablement allongés. Le Client accepte ces délais en validant sa commande.</p>
                      <p><strong>ARTICLE 10 : ALLERGIES</strong><br/>Le Client est tenu de signaler toute allergie dans les commentaires. Foodji décline toute responsabilité en cas d'omission.</p>
                      <p><strong>ARTICLE 11 : DONNÉES</strong><br/>Les données collectées servent uniquement au traitement de la commande et ne sont pas revendues.</p>
                  </div>
                  <button onClick={accepterCGU} style={{...btnStyle, padding:'15px', fontSize:'1.1rem'}}>J'ACCEPTE LES CONDITIONS</button>
              </div>
          </div>
      )}

      {/* --- ALERTE RUSH (Visible sur la Landing) --- */}
      {rushLevel && !showCGU && view === 'landing' && (
          <div style={{
              position:'fixed', bottom:'100px', left:'5%', width:'90%', 
              background: rushLevel === 'red' ? '#FEF2F2' : '#FFF7ED', 
              border: rushLevel === 'red' ? '2px solid red' : '2px solid orange', 
              padding:'15px', borderRadius:'15px', zIndex:5000, textAlign:'center', 
              boxShadow:'0 10px 30px rgba(0,0,0,0.2)'
          }}>
              <h3 style={{margin:'0 0 5px 0', color: rushLevel === 'red' ? '#991B1B' : '#C2410C'}}>
                  {rushLevel === 'red' ? '🚨 EXPLOSION EN CUISINE' : '🔥 FORTE AFFLUENCE'}
              </h3>
              <p style={{margin:0, fontSize:'0.9rem', color: rushLevel === 'red' ? '#7F1D1D' : '#9A3412'}}>
                  {rushLevel === 'red' ? 'Délais très longs (> 1h). Merci de votre patience.' : 'Les délais de livraison sont allongés (+45min).'}
              </p>
          </div>
      )}

      {/* --- LANDING --- */}
      {view === 'landing' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
          background: 'linear-gradient(135deg, #1A1E29 0%, #000000 100%)', 
          color: 'white', zIndex: 2000, 
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
          overflow:'hidden'
        }}>
          <img 
            src={logoImg} 
            alt="Foodji" 
            className="logo-idle"
            style={{ width: '220px', height: '220px', objectFit: 'contain', marginBottom: '40px', zIndex: 10 }} 
            onError={(e) => {e.target.style.display='none';}} 
          /> 
          
          <div className="content-enter" style={{textAlign:'center', marginTop:'40px', width:'100%', maxWidth:'300px'}}>
              <button onClick={handleEnterApp} style={{
                background: COLORS.primary, color: 'white', border: 'none', padding: '18px 0', width:'100%',
                borderRadius: '50px', fontSize: '1.2rem', fontWeight: 'bold', 
                boxShadow: '0 10px 30px rgba(168, 68, 56, 0.5)', cursor:'pointer'
              }}>
                VOIR LE MENU
              </button>

              {derniereCommande && (
                  <button onClick={() => setView('ticket')} style={{
                      marginTop: '30px', display:'block', margin:'30px auto 0 auto', background: 'transparent', 
                      border: '1px solid #374151', color: COLORS.primary, padding: '10px 20px', 
                      borderRadius: '30px', cursor:'pointer', fontSize:'0.9rem'
                  }}>
                      📄 Ma dernière commande
                  </button>
              )}

              <button onClick={handleStaffAccess} style={{
                  marginTop:'60px', background: 'transparent', border: 'none', color: '#4B5563', fontSize: '0.8rem', cursor:'pointer'
              }}>
                  Staff Access
              </button>
          </div>
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

      {showPromoWizard && <PromoWizard menu={menu} onClose={()=>setShowPromoWizard(false)} onValidate={ajouterLotAuPanier} />}
      {selectedProduct && <ProductModal product={selectedProduct} onClose={()=>setSelectedProduct(null)} onAdd={ajouterAuPanier} />}

      {/* --- CLIENT --- */}
      {view === 'client' && (
        <div style={{ padding: '20px' }}>
          
          {rushLevel && (
              <div style={{
                  background: rushLevel === 'red' ? '#FEF2F2' : '#FFF7ED', 
                  border: rushLevel === 'red' ? '1px solid #FCA5A5' : '1px solid #FDBA74', 
                  color: rushLevel === 'red' ? '#991B1B' : '#C2410C', 
                  padding:'10px', borderRadius:'10px', marginBottom:'20px', textAlign:'center', fontWeight:'bold'
              }}>
                  {rushLevel === 'red' ? '🚨 EXPLOSION EN CUISINE (ATTENTE > 1H)' : '🔥 FORTE AFFLUENCE (ATTENTE ~45 MIN)'}
              </div>
          )}

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
                
                <div style={{ 
                    width: '100%',
                    aspectRatio: '1/1',
                    background: '#eee', 
                    backgroundImage: `url(${plat.image || 'https://via.placeholder.com/300?text=Foodji'})`, 
                    backgroundSize: 'cover', 
                    backgroundPosition: 'center' 
                }}>
                    {plat.isPromoTrigger && <div style={{position:'absolute', bottom:0, width:'100%', background:'rgba(0,0,0,0.6)', color:'white', fontSize:'0.8rem', padding:'5px', textAlign:'center'}}>PROMO</div>}
                </div>

                <div style={{padding:'10px', flex:1, display:'flex', flexDirection:'column', justifyContent:'space-between'}}>
                  <div>
                    <h4 style={{ margin: '0 0 5px 0', fontSize: '1rem', fontWeight:'700', color: COLORS.secondary }}>{plat.nom}</h4>
                    <p style={{ fontSize: '0.8rem', color: COLORS.textLight, margin: 0, lineHeight:'1.2', display:'-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{plat.description}</p>
                  </div>
                  {!plat.isPromoTrigger && (
                      <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <span style={{ fontWeight: '700', fontSize: '1rem', color: COLORS.primary }}>
                           {displayPrice > 0 ? (plat.variantes?.length > 0 ? `dès ${displayPrice} DH` : `${displayPrice} DH`) : 'GRATUIT'}
                         </span>
                         <div style={{background: COLORS.secondary, color: 'white', width: '32px', height: '32px', borderRadius: '50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem'}}>+</div>
                      </div>
                  )}
                </div>
              </div>
            )})}
          </div>
          {panier.length > 0 && (
            <div onClick={handleOpenPanier} style={{
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
      )}

      {/* --- PANIER --- */}
      {view === 'panier' && (
        <div style={{ padding: '20px', background: 'white', minHeight: '100vh' }}>
          <h2 style={{color: COLORS.secondary}}>🛒 Panier</h2>
          
          {typeCommande === 'livraison' && (
             <div style={{background: '#FEF2F2', border: '1px solid #FCA5A5', padding:'10px', borderRadius:'8px', marginBottom:'20px', fontSize:'0.9rem', color: '#B91C1C'}}>
                 <strong>⚠️ Info Zones Spéciales :</strong><br/>
                 Pour <strong>UIR, Technopolis, UM6P</strong>, un supplément (10-15 DH) sera demandé <strong>directement par le livreur</strong>.
             </div>
          )}

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
                            {item.isCheesyCrust && <div style={{color: COLORS.promo, fontWeight:'bold'}}>+ Cheesy Crust</div>}
                            {item.extras && item.extras.length > 0 && <div>+ {item.extras.map(e => e.nom).join(', ')}</div>}
                            {item.sauces && item.sauces.length > 0 && <div>Sauces: {formatOptions(item.sauces)}</div>}
                            {item.optionsChoisies && item.optionsChoisies.length > 0 && <div>+ {formatOptions(item.optionsChoisies)}</div>}
                            {item.sans && item.sans.length > 0 && <div style={{color: COLORS.danger}}>Sans: {item.sans.join(', ')}</div>}
                        </div>
                    </div>
                    <div style={{display:'flex', gap:'15px', alignItems:'center'}}>
                      <strong style={{color: COLORS.primary}}>{getPrixItemAjuste(item)} DH</strong>
                      <button onClick={() => retirerDuPanier(item.uniqueId)} style={{color:'#ccc', background:'transparent', border:'none', fontSize:'1.5rem'}}>×</button>
                    </div>
                  </div>
                ))}
                
                {remisePromo > 0 && (
                    <div style={{background: '#ECFDF5', color: COLORS.success, padding:'10px', borderRadius:'8px', marginTop:'15px', fontWeight:'bold', textAlign:'center'}}>
                        🎁 Promo Dimanche : -{remisePromo} DH
                    </div>
                )}

                {fraisLivraison > 0 && typeCommande === 'livraison' && (
                    <div style={{textAlign:'right', color: COLORS.textLight, marginTop:'10px'}}>
                        + Frais livraison (Petite commande) : 5 DH
                    </div>
                )}
                
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

                <button onClick={envoyerCommande} disabled={loading} style={{...btnStyle, marginTop:'10px', background: COLORS.success}}>{loading ? '...' : 'VALIDER LA COMMANDE'}</button>
              </div>
            </>
          )}
          <button onClick={() => setView('client')} style={{marginTop: '20px', width: '100%', padding: '15px', background: 'transparent', border: 'none', color: COLORS.textLight, fontWeight:'600'}}>Retour</button>
        </div>
      )}

      {/* --- TICKET --- */}
      {view === 'ticket' && derniereCommande && (
          <div style={{padding: '20px', background: COLORS.bg, minHeight: '100vh', display:'flex', flexDirection:'column', alignItems:'center'}}>
              <div style={{background: 'white', padding: '30px 20px', borderRadius: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', width: '100%', maxWidth: '400px', textAlign: 'center'}}>
                  <div style={{width:'60px', height:'60px', background: derniereCommande.status === 'En cours de validation' ? COLORS.pending : COLORS.success, color:'white', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'2rem', margin:'0 auto 20px auto'}}>
                      {derniereCommande.status === 'En cours de validation' ? '!' : '✓'}
                  </div>
                  
                  {derniereCommande.status === 'En cours de validation' ? (
                      <>
                        <h2 style={{margin: '0 0 10px 0', color: COLORS.pending}}>En attente de validation</h2>
                        <p style={{color: COLORS.textLight, fontSize:'0.9rem', marginBottom:'30px'}}>
                            Votre commande dépasse 300 DH. Nous allons vous appeler pour la valider.
                        </p>
                      </>
                  ) : (
                      <>
                        <h2 style={{margin: '0 0 10px 0', color: COLORS.secondary}}>Commande Transmise !</h2>
                        <p style={{color: COLORS.textLight, fontSize:'0.9rem', marginBottom:'30px'}}>
                            Votre commande a bien été reçue.
                        </p>
                      </>
                  )}
                  
                  <div style={{borderTop: '2px dashed #eee', borderBottom: '2px dashed #eee', padding: '20px 0', marginBottom: '20px', textAlign:'left'}}>
                      <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px', fontWeight:'bold'}}>
                          <span>Commande N°</span>
                          <span>#{derniereCommande.id ? derniereCommande.id.slice(-4).toUpperCase() : '----'}</span>
                      </div>
                      
                      <ul style={{listStyle:'none', padding:0, marginTop:'20px'}}>
                          {derniereCommande.items.map((it, i) => (
                              <li key={i} style={{marginBottom:'10px', fontSize:'0.95rem', borderBottom:'1px solid #f9f9f9', paddingBottom:'5px'}}>
                                  <div style={{display:'flex', justifyContent:'space-between'}}>
                                      <span>{it.nom} {it.varianteNom && `(${it.varianteNom})`}</span>
                                      <span style={{fontWeight:'bold'}}>{it.prixFinal} DH</span>
                                  </div>
                              </li>
                          ))}
                      </ul>
                  </div>

                  <div style={{display:'flex', justifyContent:'space-between', fontSize:'1.2rem', fontWeight:'800', color: COLORS.primary}}>
                      <span>TOTAL</span>
                      <span>{derniereCommande.total} DH</span>
                  </div>
              </div>

              <button onClick={() => { setView('client'); }} style={{marginTop:'30px', background: COLORS.secondary, color:'white', border:'none', padding:'15px 30px', borderRadius:'30px', fontWeight:'bold', cursor:'pointer'}}>
                  Commander à nouveau
              </button>
          </div>
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

      {/* --- ADMIN --- */}
      {view === 'admin' && user && (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
          
          <div style={{marginBottom:'20px', display:'flex', gap:'10px', alignItems:'center', justifyContent:'space-between'}}>
              <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                <h2 style={{margin:0}}>⚙️ Admin</h2>
                <div style={{fontSize:'0.8rem', color: COLORS.success, background:'#ECFDF5', padding:'5px 10px', borderRadius:'10px'}}>🔊 Son Actif</div>
              </div>
              <div style={{display:'flex', gap:'5px'}}>
                  <button onClick={() => activateRush('orange')} style={{background: 'orange', color:'white', border:'none', padding:'8px 15px', borderRadius:'8px', cursor:'pointer', fontWeight:'bold', fontSize:'0.9rem'}}>🟠 RUSH (45min)</button>
                  <button onClick={() => activateRush('red')} style={{background: 'red', color:'white', border:'none', padding:'8px 15px', borderRadius:'8px', cursor:'pointer', fontWeight:'bold', fontSize:'0.9rem'}}>🔴 EXPLOSION (1H+)</button>
              </div>
          </div>

          <h3 style={{marginTop:'30px'}}>Commandes ({commandes.filter(c => c.status !== 'Terminé').length})</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px', marginBottom:'40px' }}>
            {commandes.map(cmd => (
              <div key={cmd.id} style={{ 
                  ...cardStyle, 
                  borderLeft: cmd.status === 'Terminé' ? '5px solid #ccc' : (cmd.status === 'En cours de validation' ? `5px solid ${COLORS.pending}` : `5px solid ${COLORS.success}`) 
              }}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'start', marginBottom:'15px', paddingBottom:'15px', borderBottom:'1px solid #f0f0f0'}}>
                  <div>
                      <strong style={{fontSize:'1.2rem', display:'block'}}>{cmd.client}</strong>
                      <div style={{color: COLORS.textLight, marginTop:'4px'}}>📞 {cmd.tel}</div>
                      
                      <div style={{marginTop:'5px', fontSize:'0.8rem', fontWeight:'bold', color: COLORS.secondary, display:'flex', gap:'10px', alignItems:'center'}}>
                          <span>📍 {cmd.distance} km</span>
                          {cmd.lat && cmd.lng && (
                             <a href={`https://www.google.com/maps/search/?api=1&query=${cmd.lat},${cmd.lng}`} target="_blank" rel="noreferrer" style={{color: COLORS.primary, textDecoration:'underline'}}>Voir Map</a>
                          )}
                      </div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontSize:'1.3rem', fontWeight:'bold', color: COLORS.primary}}>{cmd.total} DH</div>
                    <button onClick={() => copierOdoo(cmd)} style={{marginTop:'5px', background: COLORS.secondary, color:'white', border:'none', padding:'6px 12px', borderRadius:'6px', fontSize:'0.75rem', cursor:'pointer'}}>📋 COPIER</button>
                  </div>
                </div>
                
                <div style={{marginBottom:'10px'}}>
                    {cmd.status === 'En cours de validation' && (
                        <div style={{background: '#FFF7ED', color: '#C2410C', padding:'8px', borderRadius:'8px', fontSize:'0.9rem', fontWeight:'bold', marginBottom:'10px', border:'1px solid #FED7AA'}}>
                            ⚠️ GROS PANIER - À VALIDER TEL
                        </div>
                    )}
                    {cmd.type === 'livraison' && <div style={{background:'#FEF3C7', color:'#D97706', padding:'8px', borderRadius:'8px', fontSize:'0.9rem', marginBottom:'5px'}}>🛵 <strong>{cmd.adresse}</strong></div>}
                    {cmd.commentaire && <div style={{background: COLORS.warning, color:'white', padding:'8px', borderRadius:'8px', fontSize:'0.9rem', fontWeight:'bold'}}>📝 Note: {cmd.commentaire}</div>}
                    {cmd.remisePromo > 0 && <div style={{color: COLORS.danger, fontSize:'0.9rem', fontWeight:'bold', border:'1px solid red', padding:'5px', borderRadius:'5px', display:'inline-block'}}>🎁 REMISE PROMO: -{cmd.remisePromo} DH</div>}
                </div>
                
                <ul style={{listStyle:'none', marginBottom:'15px'}}>
                  {cmd.items && cmd.items.map((it, i) => (
                    <li key={i} style={{padding:'8px 0', borderBottom:'1px dashed #eee', lineHeight:'1.4'}}>
                      <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'2px'}}>
                          <span style={{fontSize:'0.75rem', fontWeight:'bold', color: COLORS.primary, background:'#FEE2E2', padding:'2px 6px', borderRadius:'4px'}}>
                              [{it.categorie ? it.categorie.toUpperCase() : 'PLAT'}]
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
                      
                      <div style={{fontSize:'0.85rem', color:'#444', marginLeft:'10px', marginTop:'2px'}}>
                          {it.isCheesyCrust && <div style={{fontWeight:'bold', color: COLORS.promo}}>★ CHEESY CRUST</div>}
                          {it.extras && it.extras.length > 0 && <div>+ {it.extras.map(e => e.nom).join(', ')}</div>}
                          {it.sauces && it.sauces.length > 0 && <div>Sauces: {formatOptions(it.sauces)}</div>}
                          {it.optionsChoisies && it.optionsChoisies.length > 0 && <div>+ {formatOptions(it.optionsChoisies)}</div>}
                          {it.sans && it.sans.length > 0 && <div style={{color: COLORS.danger, fontWeight:'bold'}}>🚫 {it.sans.join(', ')}</div>}
                      </div>
                    </li>
                  ))}
                </ul>

                <div style={{display:'flex', gap:'10px', flexWrap:'wrap'}}>
                  {cmd.status === 'En cours de validation' ? (
                      <>
                        <button onClick={()=>changerStatus(cmd.id, 'En attente')} style={{...btnStyle, background: COLORS.success, padding:'10px', flex:1}}>☎️ CLIENT OK</button>
                        <button onClick={()=>changerStatus(cmd.id, 'Refusé')} style={{...btnStyle, background: COLORS.danger, padding:'10px', flex:1}}>REFUSER</button>
                      </>
                  ) : (
                      <>
                         {cmd.status !== 'Terminé' && cmd.status !== 'Refusé' && <button onClick={()=>changerStatus(cmd.id, 'Terminé')} style={{...btnStyle, background: COLORS.success, padding:'10px'}}>✅ SERVI</button>}
                         <button onClick={()=>supprimerCmd(cmd.id)} style={{...btnStyle, background:'white', color:'red', border:'1px solid #eee', padding:'10px'}}>🗑️</button>
                      </>
                  )}
                </div>
              </div>
            ))}
          </div>

           <div style={{marginTop:'40px', borderTop:'2px solid #eee', paddingTop:'20px'}}>
             <h3 style={{marginBottom:'15px'}}>📦 Menu</h3>
             <div style={{ overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: '15px', display:'flex', gap:'10px' }}>
              {categoriesReelles.map(c => (
                <button key={c} onClick={() => setAdminCategorie(c)} style={{
                    padding:'8px 15px', borderRadius:'20px', border:'none', 
                    background: adminCategorie===c?COLORS.secondary:'#eee', 
                    color:adminCategorie===c?'white':'black', cursor:'pointer'
                }}>{c}</button>
              ))}
              <button onClick={() => setAdminCategorie('RUPTURE')} style={{padding:'8px 15px', borderRadius:'20px', border:'none', background: adminCategorie==='RUPTURE'?COLORS.danger:'#FEE2E2', color: adminCategorie==='RUPTURE'?'white':COLORS.danger, fontWeight:'bold', cursor:'pointer'}}>🚫 RUPTURE</button>
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
          </div>
          
           <details style={{marginTop:'30px', background:'white', padding:'15px', borderRadius:'10px'}}>
             <summary>{editId ? '✏️ Modifier Produit' : 'Ajout Manuel'}</summary>
             <div style={{marginTop:'10px'}}>
                 <input placeholder="Nom" value={nom} onChange={e=>setNom(e.target.value)} style={inputStyle} />
                 <textarea placeholder="Description" value={description} onChange={e=>setDescription(e.target.value)} style={{...inputStyle, height:'60px', fontFamily:'inherit', resize:'vertical'}} />
                 <div style={{display:'flex', gap:'10px', alignItems:'start'}}>
                   <select value={categorie} onChange={handleCategoryChange} style={{...inputStyle, width:'50%'}}>
                       {categoriesSelectAdmin.map(cat => <option key={cat}>{cat}</option>)}
                   </select>
                   {variantes.length > 0 ? (
                       <div style={{width:'50%', display:'flex', gap:'5px', flexWrap:'wrap'}}>
                           {variantes.map((v, index) => (
                               <div key={index} style={{flex:1, minWidth:'80px'}}>
                                   <label style={{fontSize:'0.7rem', fontWeight:'bold', color: COLORS.textLight}}>{v.nom}</label>
                                   <input type="number" value={v.prix} onChange={(e) => updateVariantPrice(index, e.target.value)} style={{...inputStyle, marginBottom:0}} />
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
    </div>
  );
}

function formatOptions(list) {
    if(!list) return "";
    const counts = {};
    list.forEach(x => { counts[x] = (counts[x] || 0) + 1; });
    return Object.entries(counts).map(([name, count]) => count > 1 ? `${name} x${count}` : name).join(', ');
}

function PromoWizard({ menu, onClose, onValidate }) {
    const [choix, setChoix] = useState([]);
    useEffect(() => { setChoix([]); }, []);

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
            ...pizza, prixFinal: Number(prixFinal), originalPrice: Number(prixFinal), varianteNom: varianteNom, isPromoEligible: true 
        }]);
    };

    const handleRemoveChoice = (indexToRemove) => {
        setChoix(choix.filter((_, index) => index !== indexToRemove));
    };

    return (
        <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.9)', zIndex:2000, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'20px'}}>
            <div style={{background:'white', width:'100%', maxWidth:'600px', borderRadius:'20px', padding:'20px', maxHeight:'90vh', overflowY:'auto'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
                    <h3 style={{margin:0}}>Choix {choix.length} / 3</h3>
                    <button onClick={onClose} style={{border:'none', background:'transparent', fontSize:'1.5rem'}}>×</button>
                </div>

                <div style={{display:'flex', gap:'10px', marginBottom:'20px', background:'#F3F4F6', padding:'10px', borderRadius:'10px'}}>
                    {[0, 1, 2].map(i => (
                        <div key={i} style={{
                            flex:1, height:'60px', background:'white', border:'2px dashed #ddd', borderRadius:'8px',
                            display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.8rem', textAlign:'center', position:'relative', fontWeight:'bold'
                        }}>
                            {choix[i] ? (
                                <>
                                    {choix[i].nom}
                                    <div onClick={() => handleRemoveChoice(i)} style={{position:'absolute', top:'-5px', right:'-5px', background:'red', color:'white', width:'20px', height:'20px', borderRadius:'50%', cursor:'pointer', fontSize:'0.7rem', display:'flex', alignItems:'center', justifyContent:'center'}}>×</div>
                                </>
                            ) : <span style={{color:'#ccc'}}>Vide</span>}
                        </div>
                    ))}
                </div>
                
                {choix.length < 3 ? (
                    <div style={{display:'grid', gridTemplateColumns:'1fr', gap:'10px'}}>
                        {pizzasEligibles.map(p => (
                            <button key={p.id} onClick={() => handleSelect(p)} style={{
                                padding:'15px', borderRadius:'12px', border:'1px solid #eee', 
                                background:'white', textAlign:'left', display:'flex', justifyContent:'space-between', alignItems:'center',
                                boxShadow:'0 2px 5px rgba(0,0,0,0.05)', cursor:'pointer'
                            }}>
                                <span style={{fontWeight:'bold'}}>{p.nom}</span>
                                <span style={{color: COLORS.primary, fontWeight:'bold', background:'#FEE2E2', padding:'5px 10px', borderRadius:'15px'}}>+ Ajouter</span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <button onClick={() => onValidate(choix)} style={{
                        background: COLORS.success, color:'white', width:'100%', padding:'20px', border:'none', 
                        borderRadius:'15px', fontSize:'1.2rem', fontWeight:'bold', cursor:'pointer'
                    }}>
                        ✅ VALIDER CES 3 PIZZAS
                    </button>
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

  let maxChoix = 0, minChoix = 0, listeOptions = [], titreOptions = "";
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

  const incrementOption = (opt, currentList, setList, max) => { if (currentList.length < max) { setList([...currentList, opt]); } };
  const decrementOption = (opt, currentList, setList) => { const index = currentList.indexOf(opt); if (index > -1) { const newList = [...currentList]; newList.splice(index, 1); setList(newList); } };
  const toggleExtraPizza = (extraObj) => { if (extrasPizza.some(e => e.nom === extraObj.nom)) { setExtrasPizza(extrasPizza.filter(e => e.nom !== extraObj.nom)); } else { setExtrasPizza([...extrasPizza, extraObj]); } };
  const toggleSans = (item) => { if (sansIngredients.includes(item)) { setSansIngredients(sansIngredients.filter(x => x !== item)); } else { setSansIngredients([...sansIngredients, item]); } };
  const getCount = (opt, list) => list.filter(x => x === opt).length;

  let basePrice = selectedVar ? Number(selectedVar.prix) : Number(product.prix);
  let totalExtras = extrasPizza.reduce((acc, curr) => acc + curr.prix, 0);
  let prixCheesy = (isCheesyCrust ? (selectedVar?.nom === 'M' || selectedVar?.nom === 'Standard' || !selectedVar ? 15 : 25) : 0);
  const finalPriceCalculated = basePrice + totalExtras + prixCheesy;

  return (
    <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'flex-end', justifyContent:'center'}}>
      <div style={{background:'white', width:'100%', maxWidth:'600px', borderRadius:'20px 20px 0 0', padding:'25px', maxHeight:'90vh', overflowY:'auto'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'start'}}>
            <h2 style={{margin:0, fontSize:'1.4rem'}}>{product.nom}</h2>
            <button onClick={onClose} style={{border:'none', background:'transparent', fontSize:'1.5rem', fontWeight:'bold'}}>×</button>
        </div>
        <p style={{color: COLORS.textLight, marginTop:'5px'}}>{product.description}</p>
        
        {product.variantes && product.variantes.length > 0 && (<div style={{marginTop:'20px'}}><div style={{fontWeight:'bold', marginBottom:'10px'}}>Taille</div><div style={{display:'flex', gap:'10px', flexWrap:'wrap'}}>{product.variantes.map(v => (<button key={v.nom} onClick={() => { setSelectedVar(v); setOptionsChoisies([]); }} style={{padding:'10px 20px', borderRadius:'8px', border: selectedVar?.nom === v.nom ? `2px solid ${COLORS.primary}` : '1px solid #ddd', background: selectedVar?.nom === v.nom ? '#FFF5F5' : 'white', fontWeight:'bold'}}>{v.nom} - {v.prix} DH</button>))}</div></div>)}
        {isPates && (<div style={{marginTop:'25px', borderTop:'1px solid #eee', paddingTop:'15px'}}><div style={{fontWeight:'bold', marginBottom:'10px'}}>Type de Pâtes (Obligatoire)</div><div style={{display:'flex', gap:'10px'}}>{TYPES_PATES.map(type => (<button key={type} onClick={() => setTypePates(type)} style={{flex:1, padding:'12px', borderRadius:'12px', border: typePates === type ? `2px solid ${COLORS.primary}` : '1px solid #ddd', background: typePates === type ? '#FFF5F5' : 'white', fontWeight: 'bold', color: typePates === type ? COLORS.primary : 'black'}}>{type}</button>))}</div></div>)}
        {isPizza && (<div style={{marginTop:'25px', borderTop:'1px solid #eee', paddingTop:'15px'}}><div style={{fontWeight:'bold', marginBottom:'10px'}}>Suppléments</div><div onClick={() => setIsCheesyCrust(!isCheesyCrust)} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'15px', borderRadius:'10px', border: isCheesyCrust ? `2px solid ${COLORS.promo}` : '1px solid #ddd', background: isCheesyCrust ? '#FFFBF0' : 'white', cursor:'pointer', marginBottom:'15px'}}><span style={{fontWeight:'bold'}}>🧀 Cheesy Crust (Bords Fourrés)</span><span style={{color: COLORS.primary, fontWeight:'bold'}}>+{selectedVar?.nom === 'M' || selectedVar?.nom === 'Standard' || !selectedVar ? '15' : '25'} DH</span></div><div style={{display:'flex', flexWrap:'wrap', gap:'10px'}}>{EXTRAS_PIZZA.map(ex => { const isSelected = extrasPizza.some(e => e.nom === ex.nom); return (<button key={ex.nom} onClick={() => toggleExtraPizza(ex)} style={{padding:'8px 12px', borderRadius:'20px', border: isSelected ? `1px solid ${COLORS.primary}` : '1px solid #ddd', background: isSelected ? '#FFF5F5' : 'white', color: isSelected ? COLORS.primary : 'black', fontWeight:'bold', fontSize:'0.9rem'}}>{isSelected ? '✓ ' : '+ '}{ex.nom} ({ex.prix} DH)</button>) })}</div></div>)}
        {isBurger && (<div style={{marginTop:'25px', borderTop:'1px solid #eee', paddingTop:'15px'}}><div style={{fontWeight:'bold', marginBottom:'10px', color: COLORS.danger}}>Je ne veux pas de...</div><div style={{display:'flex', flexWrap:'wrap', gap:'10px'}}>{RETRAIT_INGREDIENTS.map(ing => (<button key={ing} onClick={() => toggleSans(ing)} style={{padding:'8px 12px', borderRadius:'20px', border: '1px solid #FCA5A5', background: sansIngredients.includes(ing) ? '#FEF2F2' : 'white', color: COLORS.danger, fontWeight:'bold', fontSize:'0.9rem', opacity: sansIngredients.includes(ing) ? 1 : 0.6}}>{sansIngredients.includes(ing) ? '🚫 ' : ''}{ing}</button>))}</div></div>)}
        {isTacos && (<div style={{marginTop:'25px', borderTop:'1px solid #eee', paddingTop:'15px'}}><div style={{fontWeight:'bold', marginBottom:'10px'}}>Sauces <small style={{color: COLORS.danger}}>(Minimum 1, Max 2)</small></div><div style={{display:'flex', flexDirection:'column', gap:'10px'}}>{LISTE_SAUCES.map(s => { const count = getCount(s, sauces); return (<div key={s} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px dashed #eee'}}><span>{s}</span><div style={{display:'flex', alignItems:'center', gap:'10px'}}>{count > 0 && <button onClick={() => decrementOption(s, sauces, setSauces)} style={{width:'30px', height:'30px', borderRadius:'50%', border:'1px solid #ddd', background:'white', fontWeight:'bold'}}>-</button>}{count > 0 && <span style={{fontWeight:'bold'}}>{count}</span>}<button onClick={() => incrementOption(s, sauces, setSauces, 2)} style={{width:'30px', height:'30px', borderRadius:'50%', border:'none', background:COLORS.secondary, color:'white', fontWeight:'bold'}}>+</button></div></div>); })}</div></div>)}
        {maxChoix > 0 && (<div style={{marginTop:'25px', borderTop:'1px solid #eee', paddingTop:'15px'}}><div style={{fontWeight:'bold', marginBottom:'10px'}}>{titreOptions} <small style={{color: optionsChoisies.length < minChoix ? COLORS.danger : COLORS.success}}>({optionsChoisies.length}/{maxChoix}) {minChoix > 0 ? `- Min ${minChoix}` : ''}</small></div><div style={{display:'flex', flexDirection:'column', gap:'10px'}}>{listeOptions.map(opt => { const count = getCount(opt, optionsChoisies); return (<div key={opt} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px dashed #eee'}}><span>{opt}</span><div style={{display:'flex', alignItems:'center', gap:'10px'}}>{count > 0 && <button onClick={() => decrementOption(opt, optionsChoisies, setOptionsChoisies)} style={{width:'30px', height:'30px', borderRadius:'50%', border:'1px solid #ddd', background:'white', fontWeight:'bold'}}>-</button>}{count > 0 && <span style={{fontWeight:'bold'}}>{count}</span>}<button onClick={() => incrementOption(opt, optionsChoisies, setOptionsChoisies, maxChoix)} style={{width:'30px', height:'30px', borderRadius:'50%', border:'none', background:COLORS.primary, color:'white', fontWeight:'bold'}}>+</button></div></div>); })}</div></div>)}

        <button onClick={() => {
            if (isPates && !typePates) return alert("Veuillez choisir le type de pâtes !");
            if (minChoix > 0 && optionsChoisies.length < minChoix) return alert(`Veuillez choisir au moins ${minChoix} options !`); 
            if (isTacos && sauces.length === 0) return alert("⚠️ Veuillez choisir au moins une sauce (ou 'Pas de sauce') !");
            onAdd({ ...product, prixFinal: finalPriceCalculated, varianteNom: selectedVar ? selectedVar.nom : null, sauces, optionsChoisies, choixPates: typePates, isCheesyCrust, extras: extrasPizza, sans: sansIngredients });
        }} style={{background: COLORS.primary, color: 'white', border: 'none', borderRadius: '12px', padding: '15px', fontWeight: 'bold', width: '100%', marginTop: '30px', fontSize: '1.1rem', opacity: (minChoix > 0 && optionsChoisies.length < minChoix) ? 0.5 : 1}}>
            {minChoix > 0 && optionsChoisies.length < minChoix ? `Choisir encore ${minChoix - optionsChoisies.length}` : `Ajouter au panier - ${finalPriceCalculated} DH`}
        </button>
      </div>
    </div>
  );
}

export default App;