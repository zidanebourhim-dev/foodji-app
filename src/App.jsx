import { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  doc, 
  setDoc,
  query, 
  getDocs, 
  where 
} from 'firebase/firestore';
import { Helmet, HelmetProvider } from 'react-helmet-async';
import './App.css';

const PHONE_NUMBER = "0537536689"; 
const RESTO_COORDS = { lat: 33.997484, lng: -6.735644 }; 

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

// --- LISTES PAR DÉFAUT ---
const INIT_VIANDES = [
    { nom: "Poulet", available: true }, { nom: "Viande Hachée", available: true }, 
    { nom: "Cordon Bleu", available: true }, { nom: "Nuggets", available: true }, 
    { nom: "Poulet Crispy", available: true }
];
const INIT_GARNITURES_PIZZA = [
    { nom: "Viande Hachée", available: true }, { nom: "Poulet", available: true }, 
    { nom: "4 Fromages", available: true }, { nom: "Cannibale", available: true }, 
    { nom: "Pepperoni", available: true }, { nom: "Thon", available: true }, 
    { nom: "Charcuterie", available: true }, { nom: "Végétarienne", available: true }, 
    { nom: "Fruits de Mer", available: true }
];
const INIT_SAUCES = [
    { nom: "Algérienne Fait Maison", available: true }, { nom: "Biggy Fait Maison", available: true }, 
    { nom: "Barbecue Fait Maison", available: true }, { nom: "Pas de sauce", available: true }
];
const INIT_PATES = [
    { nom: "Penne", available: true }, { nom: "Tagliatelle", available: true }, 
    { nom: "Spaghetti", available: true }
];
const INIT_TAILLES_PIZZA = [
    { nom: "M", available: true }, { nom: "L", available: true }
];

const EXTRAS_PIZZA = [
    { nom: "Extra Champignons", prix: 10 },
    { nom: "Extra Mozzarella", prix: 10 },
    { nom: "Extra Parmesan", prix: 15 },
    { nom: "Extra Cheddar", prix: 15 }
];

const RETRAIT_INGREDIENTS = ["Sans Tomate", "Sans Salade", "Sans Oignons", "Sans Cornichons", "Sans Sauce"];
const PIZZAS_EXCLUES_PROMO = ["4 saisons", "fruits de mer", "cannibale", "2 saisons"];

const WELCOME_TOKEN_REF = "START2026"; 
const POURCENTAGE_REMISE = 0.20;

const logoImg = "/logo.png";
const iconImg = "/icon.png";
const promoImg = "/promo.jpg"; 

const seoConfig = {
  title: "Foodji - Le Fait Maison à Sala Al Jadida | Burgers & Tacos (Jusqu'à 2h)",
  description: "Arrêtez de payer cher pour du surgelé. Chez Foodji, découvrez le vrai goût du Fait Maison : Burgers et Tacos haute qualité à prix accessible. Livraison sur Sala Al Jadida jusqu'à 2h du matin !",
  keywords: "restaurant sala al jadida, livraison burger, tacos technopolis, cuisine minute, uir, pizza nuit, fait maison",
  image: "https://foodji.ma/promo.jpg",
  url: "https://foodji.ma"
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "Restaurant",
  "name": "Foodji",
  "image": seoConfig.image,
  "description": "Foodji propose une cuisine minute à Sala Al Jadida avec une promesse simple : du Fait Maison et de la haute qualité à prix moyen.",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": "Sala Al Jadida",
    "addressRegion": "Rabat-Salé-Kénitra",
    "addressCountry": "MA"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 33.997484,
    "longitude": -6.735644
  },
  "url": seoConfig.url,
  "telephone": "+212537536689",
  "priceRange": "$$",
  "servesCuisine": ["Burger", "Tacos", "Pizza", "Cuisine Minute"],
  "openingHoursSpecification": [
    { "@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday"], "opens": "12:00", "closes": "01:00" },
    { "@type": "OpeningHoursSpecification", "dayOfWeek": ["Friday"], "opens": "12:00", "closes": "02:00" },
    { "@type": "OpeningHoursSpecification", "dayOfWeek": ["Saturday", "Sunday"], "opens": "18:00", "closes": "02:00" }
  ]
};

function App() {
  const [view, setView] = useState('landing'); 
  const [menu, setMenu] = useState([]);
  
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showPromoWizard, setShowPromoWizard] = useState(false); 
  const [showCGV, setShowCGV] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [isMenuLoading, setIsMenuLoading] = useState(true); 
  
  const [categorieActive, setCategorieActive] = useState(''); 
  const [rushMode, setRushMode] = useState('standard');
  const [isStoreOpen, setIsStoreOpen] = useState(true);

  const [stocks, setStocks] = useState({
      viandes: INIT_VIANDES,
      garnitures: INIT_GARNITURES_PIZZA,
      sauces: INIT_SAUCES,
      pates: INIT_PATES,
      tailles_pizza: INIT_TAILLES_PIZZA
  });

  const [panier, setPanier] = useState([]);
  const [clientNom, setClientNom] = useState('');
  const [clientTel, setClientTel] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [typeCommande, setTypeCommande] = useState('sur_place');
  const [adresse, setAdresse] = useState('');
  
  const [codePromo, setCodePromo] = useState(''); 
  const [remiseAppliquee, setRemiseAppliquee] = useState(0); 
  const [isPromoValidee, setIsPromoValidee] = useState(false); 
  
  const [distanceClient, setDistanceClient] = useState(null);
  const [clientCoords, setClientCoords] = useState(null);
  const [showDistanceBlocker, setShowDistanceBlocker] = useState(false);
  
  const [derniereCommande, setDerniereCommande] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIosInstall, setShowIosInstall] = useState(false);

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

      if (savedNom) setClientNom(savedNom);
      if (savedTel) setClientTel(savedTel);
      if (savedAdresse) setAdresse(savedAdresse);
      if (savedTicket) setDerniereCommande(JSON.parse(savedTicket));
  }, []);

  useEffect(() => {
     if (panier.length === 0) {
         setRemiseAppliquee(0);
         setIsPromoValidee(false);
         setCodePromo('');
     } else if (isPromoValidee) {
         const { sousTotal } = calculerTotalInterne();
         const newRemise = Math.round(sousTotal * POURCENTAGE_REMISE);
         setRemiseAppliquee(newRemise);
     }
  }, [panier, typeCommande]);

  useEffect(() => {
      if (isPromoValidee) {
          setIsPromoValidee(false);
          setRemiseAppliquee(0);
      }
  }, [clientTel]);

  useEffect(() => {
    const unsubStatus = onSnapshot(doc(db, "parametres", "status"), (docSnap) => {
      if (docSnap.exists()) {
        setRushMode(docSnap.data().mode);
      } else {
        setDoc(doc(db, "parametres", "status"), { mode: 'standard' });
      }
    });

    const unsubHoraires = onSnapshot(doc(db, "parametres", "horaires"), (docSnap) => {
        if (docSnap.exists()) {
          setIsStoreOpen(docSnap.data().isOuvert);
        } else {
          setDoc(doc(db, "parametres", "horaires"), { isOuvert: true });
        }
    });

    const unsubStocks = onSnapshot(doc(db, "parametres", "stocks"), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            setStocks({
                viandes: data.viandes || INIT_VIANDES,
                garnitures: data.garnitures || INIT_GARNITURES_PIZZA,
                sauces: data.sauces || INIT_SAUCES,
                pates: data.pates || INIT_PATES,
                tailles_pizza: data.tailles_pizza || INIT_TAILLES_PIZZA
            });
        } else {
            const initData = {
                viandes: INIT_VIANDES,
                garnitures: INIT_GARNITURES_PIZZA,
                sauces: INIT_SAUCES,
                pates: INIT_PATES,
                tailles_pizza: INIT_TAILLES_PIZZA
            };
            setDoc(doc(db, "parametres", "stocks"), initData);
            setStocks(initData);
        }
    });

    const unsubscribeMenu = onSnapshot(collection(db, "produits"), (snap) => {
      setMenu(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setIsMenuLoading(false); 
    });

    return () => { unsubStatus(); unsubStocks(); unsubHoraires(); unsubscribeMenu(); };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    const hasRefused = localStorage.getItem('iosInstallRefused');

    if (isIos && !isStandalone && !hasRefused) {
        setShowIosInstall(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const closeIosInstall = () => {
      setShowIosInstall(false);
      localStorage.setItem('iosInstallRefused', 'true');
  };

  const categoriesReelles = [...new Set(menu.map(p => p.categorie))];
  const isDimanche = new Date().getDay() === 0;
  let categoriesClient = [...categoriesReelles];
  if (isDimanche) categoriesClient = ['🔥 PROMOTIONS', ...categoriesReelles];
  
  useEffect(() => {
      if (categoriesClient.length > 0 && !categorieActive) setCategorieActive(categoriesClient[0]);
  }, [menu, categorieActive, isDimanche]);

  let menuClient = [];
  if (categorieActive === '🔥 PROMOTIONS') {
      menuClient = [{
          id: 'promo-sunday-card', nom: 'OFFRE DIMANCHE', description: '2 PIZZAS ACHETÉES = 1 OFFERTE (Moyennes uniquement)',
          categorie: '🔥 PROMOTIONS', prix: 0, image: promoImg, available: true, isPromoTrigger: true 
      }];
  } else {
      menuClient = menu.filter(p => p.categorie === categorieActive && p.available !== false);
  }

  const ajouterAuPanier = (itemMerged) => {
    if (itemMerged.isPromoTrigger) { setShowPromoWizard(true); return; }
    if (itemMerged.isInfo) return alert("Info seulement.");
    setPanier([...panier, { ...itemMerged, uniqueId: Date.now() }]);
    setSelectedProduct(null); 
  };

  const ajouterLotAuPanier = (lotPizzas) => {
      setPanier([...panier, ...lotPizzas.map((p, index) => ({ ...p, uniqueId: Date.now() + index }))]);
      setShowPromoWizard(false);
  };

  const retirerDuPanier = (uid) => setPanier(panier.filter(i => i.uniqueId !== uid));
  
  const getPrixItemAjuste = (item) => {
      let prix = Number(item.prixFinal) || 0;
      if (item.nom.toLowerCase().includes("pep's") && (typeCommande === 'livraison' || typeCommande === 'emporter')) prix += 5;
      return prix;
  };

  const calculerTotalInterne = () => {
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
      return { sousTotal, remisePromoSysteme: remise, fraisLivraison: frais };
  }

  const calculerTotal = () => {
      const { sousTotal, remisePromoSysteme, fraisLivraison } = calculerTotalInterne();
      const totalAvantRemiseCode = (sousTotal - remisePromoSysteme) + fraisLivraison;
      const totalFinal = Math.max(0, totalAvantRemiseCode - remiseAppliquee);
      
      return { sousTotal, remisePromo: remisePromoSysteme, fraisLivraison, grandTotal: totalFinal };
  };

  const { remisePromo, fraisLivraison, grandTotal } = calculerTotal();

  const verifierCodePromo = async () => {
    if (!codePromo.trim()) return alert("Veuillez entrer un code promo.");
    
    const telClean = clientTel.replace(/\s/g, ''); 
    if (!/^(06|07)\d{8}$/.test(telClean)) {
        return alert("⚠️ Veuillez d'abord entrer un numéro de téléphone valide (06... ou 07...) dans la case ci-dessus.");
    }

    if (codePromo.toUpperCase() !== WELCOME_TOKEN_REF) {
        return alert("❌ Code promo invalide ou expiré.");
    }

    setLoading(true);
    try {
        const qCheck = query(collection(db, "commandes"), where("tel", "==", telClean));
        const historySnapshot = await getDocs(qCheck);

        if (historySnapshot.empty) {
            const { sousTotal } = calculerTotalInterne();
            const montantRemise = Math.round(sousTotal * POURCENTAGE_REMISE);
            setRemiseAppliquee(montantRemise);
            setIsPromoValidee(true);
            alert(`BOOM ! 💥\n\nFoodji régale : -20% de bienvenue rien que pour vous !`);
        } else {
            alert("⚠️ Ce code est réservé aux nouveaux clients pour leur 1ère commande.");
            setRemiseAppliquee(0);
            setIsPromoValidee(false);
        }
    } catch (e) {
        console.error(e);
        alert("Erreur de connexion lors de la vérification.");
    }
    setLoading(false);
  };

  const handleOpenPanier = () => {
      if (panier.length === 0) return alert("Panier vide !");

      setGpsLoading(true);

      if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition((position) => {
              const uLat = position.coords.latitude;
              const uLng = position.coords.longitude;
              setClientCoords({ lat: uLat, lng: uLng });
              const dist = calculateDistance(RESTO_COORDS.lat, RESTO_COORDS.lng, uLat, uLng);
              setDistanceClient(dist);
              setGpsLoading(false);

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
              setGpsLoading(false);
              if (error.code === 1) {
                  alert("⚠️ Localisation bloquée.\n\nPour vérifier que vous êtes à Sala Al Jadida, veuillez l'activer dans vos Réglages > Confidentialité > Services de localisation.");
              } else {
                  alert("⚠️ Impossible de vérifier votre position. Veuillez réessayer.");
              }
          });
      } else {
          setGpsLoading(false);
          alert("GPS non supporté.");
      }
  };

  const envoyerCommande = async () => {
    if (!isStoreOpen) {
        return alert("😴 Le restaurant est actuellement fermé. Les commandes sont suspendues.");
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

    let commentaireFinal = commentaire;
    if (isPromoValidee) {
        commentaireFinal = commentaireFinal + ` [🎁 CODE PROMO: -${remiseAppliquee} DH]`;
    }

    const data = {
        client: clientNom, tel: telClean, type: typeCommande, adresse, commentaire: commentaireFinal,
        items: panierFinal, total: grandTotal, remisePromo: remisePromo + remiseAppliquee, fraisLivraison, 
        date: new Date(), status, distance: distanceClient ? distanceClient.toFixed(2) : 'N/A',
        lat: clientCoords?.lat || 0, lng: clientCoords?.lng || 0,
        codePromoUtilise: isPromoValidee ? codePromo : 'NON'
    };

    try {
        const ref = await addDoc(collection(db, "commandes"), data);
        const ticket = { ...data, id: ref.id, date: new Date().toLocaleString() };
        localStorage.setItem('derniereCommande', JSON.stringify(ticket));
        setDerniereCommande(ticket);
        
        if(isPromoValidee) {
            alert(`👏 COMMANDE VALIDÉE AVEC LA REMISE !\n\nBienvenue chez Foodji !`);
        }

        setPanier([]); setCommentaire(''); setCodePromo(''); setRemiseAppliquee(0); setIsPromoValidee(false);
        setView('ticket'); 
    } catch (e) { alert("Erreur réseau"); }
    setLoading(false);
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
    <HelmetProvider>
    <div style={{ background: COLORS.bg, minHeight: '100vh', paddingBottom: '100px', color: COLORS.secondary }}>
      
      <Helmet>
        <title>{seoConfig.title}</title>
        <meta name="description" content={seoConfig.description} />
        <meta name="keywords" content={seoConfig.keywords} />
        <meta property="og:title" content="Foodji - La Faim n'attend pas !" />
        <meta property="og:description" content={seoConfig.description} />
        <meta property="og:image" content={seoConfig.image} />
        <meta property="og:url" content={seoConfig.url} />
        <meta property="og:type" content="restaurant.menu" />
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

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

      {showIosInstall && (
        <div style={{
            position: 'fixed', bottom: 0, left: 0, width: '100%',
            background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)',
            borderTopLeftRadius: '20px', borderTopRightRadius: '20px',
            boxShadow: '0 -5px 20px rgba(0,0,0,0.1)', padding: '20px', zIndex: 9999,
            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'
        }}>
            <div style={{display:'flex', justifyContent:'space-between', width:'100%', marginBottom:'10px'}}>
                <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                   <img src={iconImg} alt="Foodji" style={{width:'40px', borderRadius:'10px'}} />
                   <div style={{textAlign:'left'}}>
                       <div style={{fontWeight:'bold', fontSize:'1rem'}}>Installer l'App Foodji</div>
                       <div style={{fontSize:'0.8rem', color:'#666'}}>Accès direct et chargement rapide</div>
                   </div>
                </div>
                <button onClick={closeIosInstall} style={{background:'transparent', border:'none', fontSize:'1.5rem', color:'#999'}}>×</button>
            </div>
            
            <div style={{width:'100%', height:'1px', background:'#eee', margin:'10px 0'}}></div>

            <div style={{fontSize:'0.95rem', lineHeight:'1.8', textAlign:'left', width:'100%', color:'#333'}}>
                1. Appuyez sur <strong>Partager</strong> <svg width="15" height="18" viewBox="0 0 15 18" style={{verticalAlign:'middle', margin:'0 4px'}}><path d="M7.5 0.5L7.5 10.5M7.5 0.5L3.5 4.5M7.5 0.5L11.5 4.5M2.5 7.5L0.5 7.5L0.5 17.5L14.5 17.5L14.5 7.5L12.5 7.5" stroke="#007AFF" strokeWidth="1.5" fill="none" /></svg> en bas<br/>
                2. Défilez vers le bas du menu<br/>
                3. Sélectionnez <strong>"Sur l'écran d'accueil"</strong> <svg width="16" height="16" viewBox="0 0 16 16" style={{verticalAlign:'middle', margin:'0 4px'}}><rect x="0.5" y="0.5" width="15" height="15" rx="3" fill="#ccc" /><path d="M8 4L8 12M4 8L12 8" stroke="white" strokeWidth="2" /></svg>
            </div>
        </div>
      )}

      {showCGV && (
        <div style={{
            position:'fixed', top:0, left:0, width:'100%', height:'100%', 
            background:'rgba(0,0,0,0.85)', zIndex:3000, 
            display:'flex', alignItems:'center', justifyContent:'center', padding:'20px'
        }}>
            <div style={{
                background:'white', width:'100%', maxWidth:'600px', borderRadius:'15px', 
                maxHeight:'85vh', boxShadow:'0 20px 50px rgba(0,0,0,0.5)',
                display: 'flex', flexDirection: 'column', overflow: 'hidden' 
            }}>
                <div style={{
                    display:'flex', justifyContent:'space-between', alignItems:'center', 
                    padding:'20px 25px', borderBottom:'1px solid #eee', background:'white', zIndex:10
                }}>
                    <h2 style={{margin:0, fontSize:'1.2rem'}}>Conditions Générales</h2>
                    <button onClick={() => setShowCGV(false)} style={{border:'none', background:'transparent', fontSize:'1.5rem', fontWeight:'bold', cursor:'pointer', padding:'0 10px'}}>×</button>
                </div>

                <div style={{
                    padding:'0 25px', 
                    overflowY:'auto', 
                    flex: 1, 
                    WebkitOverflowScrolling: 'touch' 
                }}>
                    <div style={{fontSize:'0.9rem', lineHeight:'1.6', color:'#333', textAlign:'justify', paddingBottom:'20px', paddingTop:'20px'}}>
                        <h3 style={{fontSize:'1.1rem', fontWeight:'bold', marginTop:'0', textAlign:'center'}}>CONDITIONS GÉNÉRALES D'UTILISATION ET DE VENTE (CGUV) - FOODJI</h3>
                        <p style={{textAlign:'center', fontStyle:'italic', marginBottom:'20px'}}>Dernière mise à jour : Janvier 2026</p>

                        <h4 style={{fontWeight:'bold', marginTop:'15px'}}>PRÉAMBULE</h4>
                        <p>L'accès, la consultation et l'utilisation de l'application mobile et web « Foodji » impliquent l'acceptation intégrale et sans réserve des présentes Conditions Générales d'Utilisation et de Vente par tout utilisateur.</p>

                        <h4 style={{fontWeight:'bold', marginTop:'15px'}}>ARTICLE 2 : ACCÈS AU SERVICE ET GÉOLOCALISATION</h4>
                        <p><strong>2.1.</strong> L'utilisation du service de commande en livraison nécessite impérativement l'activation de la fonction de géolocalisation (GPS) sur le terminal du Client.</p>
                        <p><strong>2.2.</strong> Le Vendeur a mis en place un système de restriction géographique strict. Le Client reconnaît et accepte que :</p>
                        <ul style={{paddingLeft:'20px', margin:'5px 0'}}>
                            <li>Aucune commande en livraison ne pourra être validée si la position GPS du Client se situe au-delà d'un rayon de 10 kilomètres.</li>
                            <li>Toute tentative de contournement des systèmes de géolocalisation (VPN, fausse localisation) entraînera l'annulation immédiate de la commande.</li>
                        </ul>

                        <h4 style={{fontWeight:'bold', marginTop:'15px'}}>ARTICLE 4 : COMMANDE ET VALIDATION</h4>
                        <ul style={{paddingLeft:'20px', margin:'5px 0'}}>
                            <li>Pour toute commande dont le montant total excède 300,00 DH, une procédure de validation manuelle est déclenchée. Le Client doit impérativement être joignable sur le numéro de téléphone renseigné. À défaut de réponse, la commande sera annulée.</li>
                        </ul>

                        <h4 style={{fontWeight:'bold', marginTop:'15px'}}>ARTICLE 5 : ZONES, FRAIS ET CONDITIONS DE LIVRAISON</h4>
                        <ul style={{paddingLeft:'20px', margin:'5px 0'}}>
                            <li><strong>Zone 1 (0 à 4 km) :</strong> Aucun minimum de commande n'est requis.</li>
                            <li><strong>Zone 2 (4 à 10 km) :</strong> Un minimum de commande strict de 300,00 DH est exigé.</li>
                        </ul>
                        <p><strong>5.2.</strong> Zones Spéciales (Surcharge) : Le Client est informé que certaines zones spécifiques, incluant sans s'y limiter le campus de l'UIR, Technopolis, et UM6P, font l'objet d'une tarification spéciale (supplément de 10 à 15 DH réclamé par le livreur).</p>

                        <h4 style={{fontWeight:'bold', marginTop:'15px'}}>ARTICLE 7 : ABSENCE DE DROIT DE RÉTRACTATION</h4>
                        <p>Conformément à la législation en vigueur relative à la vente de denrées périssables, le Client ne dispose d'aucun droit de rétractation. Toute commande validée et mise en préparation est due dans son intégralité.</p>
                    </div>
                </div>

                <div style={{
                    padding:'20px 25px', borderTop:'1px solid #eee', background:'white', zIndex:10
                }}>
                    <button onClick={() => setShowCGV(false)} style={{width:'100%', background:'black', color:'white', padding:'15px', borderRadius:'10px', fontWeight:'bold', border:'none', cursor:'pointer'}}>J'ai compris</button>
                </div>
            </div>
        </div>
      )}

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
            className="logo-anim"
            style={{ width: '220px', height: '220px', objectFit: 'contain', marginBottom: '40px', zIndex: 10 }} 
            onError={(e) => {e.target.style.display='none';}} 
          /> 
          
          <div className="content-anim" style={{textAlign:'center', marginTop:'40px', width:'100%', maxWidth:'300px'}}>
              <button onClick={() => setView('client')} style={{
                background: COLORS.primary, color: 'white', border: 'none', padding: '18px 0', width:'100%',
                borderRadius: '50px', fontSize: '1.2rem', fontWeight: 'bold', 
                boxShadow: '0 10px 30px rgba(168, 68, 56, 0.5)', cursor:'pointer'
              }}>
                VOIR LE MENU
              </button>
              
              {deferredPrompt && (
                  <button onClick={handleInstallClick} style={{
                    background: 'white', color: 'black', border: 'none', padding: '15px 0', width:'100%',
                    borderRadius: '50px', fontSize: '1.1rem', fontWeight: 'bold', marginTop: '20px',
                    display: 'flex', alignItems:'center', justifyContent:'center', gap:'10px',
                    boxShadow: '0 5px 15px rgba(255, 255, 255, 0.2)', cursor:'pointer'
                  }}>
                    📲 INSTALLER L'APP
                  </button>
              )}
              
              <p style={{marginTop:'15px', fontSize:'0.75rem', color:'#aaa'}}>
                  En continuant, vous acceptez les <span onClick={() => setShowCGV(true)} style={{textDecoration:'underline', cursor:'pointer', color:'white'}}>Conditions Générales d'Utilisation</span>.
              </p>

              {derniereCommande && (
                  <button onClick={() => setView('ticket')} style={{
                      marginTop: '30px', display:'block', margin:'30px auto 0 auto', background: 'transparent', 
                      border: '1px solid #374151', color: COLORS.primary, padding: '10px 20px', 
                      borderRadius: '30px', cursor:'pointer', fontSize:'0.9rem'
                  }}>
                      📄 Ma dernière commande
                  </button>
              )}
          </div>
        </div>
      )}

      {view !== 'landing' && (
        <div style={{ background: COLORS.card, padding: '15px 20px', position: 'sticky', top: 0, zIndex: 50, display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{display:'flex', alignItems:'center', gap:'10px', cursor:'pointer'}} onClick={() => setView('landing')}>
            <img src={iconImg} style={{height:'35px', objectFit:'contain'}} alt="Accueil" />
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', letterSpacing: '-0.5px', color: COLORS.secondary }}>Foodji</h1>
          </div>
        </div>
      )}

      {/* BANNIÈRE RUSH */}
      {rushMode !== 'standard' && view === 'client' && (
          <div style={{background: rushMode === 'gros_rush' ? COLORS.danger : COLORS.warning, color:'white', textAlign:'center', padding:'10px', fontWeight:'bold', fontSize:'0.9rem'}}>
              {rushMode === 'gros_rush' ? '⚠️ Très forte affluence : Attente > 1h' : '⚠️ Forte affluence : Attente estimée 30 min+'}
          </div>
      )}

      {/* BANNIÈRE FERMETURE */}
      {!isStoreOpen && view === 'client' && (
          <div style={{background: COLORS.danger, color:'white', textAlign:'center', padding:'10px', fontWeight:'bold', fontSize:'0.9rem'}}>
              ⛔ RESTAURANT ACTUELLEMENT FERMÉ ⛔
          </div>
      )}

      {showPromoWizard && <PromoWizard menu={menu} onClose={()=>setShowPromoWizard(false)} onValidate={ajouterLotAuPanier} />}
      {selectedProduct && <ProductModal product={selectedProduct} stocks={stocks} onClose={()=>setSelectedProduct(null)} onAdd={ajouterAuPanier} />}

      {view === 'client' && (
        <div style={{ padding: '20px' }}>
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
            
            {isMenuLoading ? (
               <div style={{gridColumn:'span 2', textAlign:'center', padding:'50px', color:'#888'}}>
                   Chargement du menu...
               </div>
            ) : (
                <>
                    {menuClient.length === 0 ? (
                        <div style={{gridColumn:'span 2', textAlign:'center', marginTop:'50px', color: COLORS.textLight}}>
                            Aucun plat disponible pour cette catégorie.
                        </div>
                    ) : (
                        menuClient.map((plat) => {
                          const displayPrice = plat.prix > 0 
                              ? plat.prix 
                              : (plat.variantes?.length > 0 ? Math.min(...plat.variantes.filter(v => v.available !== false).map(v=>v.prix)) : 0);

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
                        )})
                    )}
                </>
            )}
          </div>
          
          {panier.length > 0 && (
            <div onClick={handleOpenPanier} style={{
              position: 'fixed', bottom: '30px', left: '5%', width: '90%', 
              background: COLORS.secondary, color: 'white', padding: '15px 25px', 
              borderRadius: '50px', display: 'flex', justifyContent: 'space-between', 
              alignItems: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', cursor: 'pointer', zIndex: 99
            }}>
              {gpsLoading ? (
                  <div style={{width:'100%', textAlign:'center', fontWeight:'bold', fontSize:'1rem'}}>Chargement...</div>
              ) : (
                  <>
                      <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                        <span style={{background: COLORS.primary, color:'white', width:'28px', height:'28px', borderRadius:'50%', display:'flex', justifyContent:'center', alignItems:'center', fontWeight:'bold', fontSize:'0.9rem'}}>{panier.length}</span>
                        <span style={{fontSize:'1rem', fontWeight:'500'}}>Voir le panier</span>
                      </div>
                      <span style={{fontWeight:'800', fontSize:'1.1rem'}}>{grandTotal} DH</span>
                  </>
              )}
            </div>
          )}
        </div>
      )}

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
                
                {remiseAppliquee > 0 && (
                    <div style={{background: '#FFF7ED', color: '#EA580C', padding:'10px', borderRadius:'8px', marginTop:'15px', fontWeight:'bold', textAlign:'center', border:'1px dashed #EA580C'}}>
                        🎉 CODE VALIDÉ : -{remiseAppliquee} DH
                    </div>
                )}

                {fraisLivraison > 0 && typeCommande === 'livraison' && (
                    <div style={{textAlign:'right', color: COLORS.textLight, marginTop:'10px'}}>
                        + Frais livraison (Petite commande) : 5 DH
                    </div>
                )}
                
                <div style={{textAlign:'right', fontSize:'1.5rem', fontWeight:'800', marginTop:'10px', color: COLORS.secondary}}>
                    Total : 
                    {remiseAppliquee > 0 ? (
                        <>
                            <span style={{textDecoration:'line-through', color:'#999', fontSize:'1rem', marginRight:'10px'}}>{grandTotal + remiseAppliquee} DH</span>
                            <span style={{color: COLORS.success}}>{grandTotal} DH</span>
                        </>
                    ) : (
                         <span> {grandTotal} DH</span>
                    )}
                </div>
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

                <div style={{marginTop:'20px', marginBottom:'15px', padding:'15px', background:'white', borderRadius:'10px', border:'1px solid #eee'}}>
                    <div style={{fontSize:'0.9rem', fontWeight:'bold', marginBottom:'10px', color: COLORS.secondary}}>Avez-vous un Code Promo ?</div>
                    <div style={{display:'flex', gap:'10px'}}>
                        <input 
                            type="text" 
                            placeholder="Code Promo" 
                            value={codePromo} 
                            disabled={isPromoValidee}
                            onChange={(e) => setCodePromo(e.target.value.toUpperCase())} 
                            style={{...inputStyle, marginBottom:0, border: '2px dashed #ccc', textAlign:'center', fontWeight:'bold', letterSpacing:'1px', flex:1}}
                        />
                        {isPromoValidee ? (
                             <button onClick={() => { setIsPromoValidee(false); setRemiseAppliquee(0); setCodePromo(''); }} style={{background: '#ccc', color: 'white', border: 'none', borderRadius: '10px', padding: '0 15px', fontWeight: 'bold', cursor:'pointer'}}>X</button>
                        ) : (
                             <button onClick={verifierCodePromo} style={{background: COLORS.secondary, color: 'white', border: 'none', borderRadius: '10px', padding: '0 20px', fontWeight: 'bold', cursor:'pointer'}}>APPLIQUER</button>
                        )}
                    </div>
                </div>

                <button onClick={envoyerCommande} disabled={loading || !isStoreOpen} style={{...btnStyle, marginTop:'10px', background: !isStoreOpen ? 'gray' : COLORS.success}}>{loading ? '...' : (!isStoreOpen ? 'FERMÉ' : 'VALIDER LA COMMANDE')}</button>
              </div>
            </>
          )}
          <button onClick={() => setView('client')} style={{marginTop: '20px', width: '100%', padding: '15px', background: 'transparent', border: 'none', color: COLORS.textLight, fontWeight:'600'}}>Retour</button>
        </div>
      )}

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

    </div>
    </HelmetProvider>
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
        let varianteM = pizza.variantes?.find(v => (v.nom === 'M' || v.nom === 'Standard') && v.available !== false);
        if (!varianteM && pizza.variantes?.length > 0) varianteM = pizza.variantes.find(v => v.available !== false);
        
        if (!varianteM) return alert("Ce produit n'est pas disponible actuellement.");

        const prixFinal = varianteM.prix;
        const varianteNom = varianteM.nom;
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
                        <div key={i} style={{flex:1, height:'60px', background:'white', border:'2px dashed #ddd', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.8rem', textAlign:'center', position:'relative', fontWeight:'bold'}}>
                            {choix[i] ? (
                                <>{choix[i].nom}<div onClick={() => handleRemoveChoice(i)} style={{position:'absolute', top:'-5px', right:'-5px', background:'red', color:'white', width:'20px', height:'20px', borderRadius:'50%', cursor:'pointer', fontSize:'0.7rem', display:'flex', alignItems:'center', justifyContent:'center'}}>×</div></>
                            ) : <span style={{color:'#ccc'}}>Vide</span>}
                        </div>
                    ))}
                </div>
                {choix.length < 3 ? (
                    <div style={{display:'grid', gridTemplateColumns:'1fr', gap:'10px'}}>
                        {pizzasEligibles.map(p => (
                            <button key={p.id} onClick={() => handleSelect(p)} style={{padding:'15px', borderRadius:'12px', border:'1px solid #eee', background:'white', textAlign:'left', display:'flex', justifyContent:'space-between', alignItems:'center', boxShadow:'0 2px 5px rgba(0,0,0,0.05)', cursor:'pointer'}}>
                                <span style={{fontWeight:'bold'}}>{p.nom}</span>
                                <span style={{color: COLORS.primary, fontWeight:'bold', background:'#FEE2E2', padding:'5px 10px', borderRadius:'15px'}}>+ Ajouter</span>
                            </button>
                        ))}
                    </div>
                ) : (
                    <button onClick={() => onValidate(choix)} style={{background: COLORS.success, color:'white', width:'100%', padding:'20px', border:'none', borderRadius:'15px', fontSize:'1.2rem', fontWeight:'bold', cursor:'pointer'}}>✅ VALIDER CES 3 PIZZAS</button>
                )}
            </div>
        </div>
    );
}

function ProductModal({ product, stocks, onClose, onAdd }) {
  const taillesGlobalesDispo = stocks.tailles_pizza ? stocks.tailles_pizza.filter(t => t.available).map(t => t.nom) : [];
  
  const isPizza = product.categorie.toLowerCase().includes('pizza');
  const variantesDispo = product.variantes ? product.variantes.filter(v => {
      const isProductAvailable = v.available !== false;
      const isGlobalSizeAvailable = isPizza ? taillesGlobalesDispo.includes(v.nom) : true;
      return isProductAvailable && isGlobalSizeAvailable;
  }) : [];
  
  const [selectedVar, setSelectedVar] = useState(variantesDispo.length > 0 ? variantesDispo[0] : null);
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
  const isPizzaProduct = catLower.includes('pizza');
  const isBurger = catLower.includes('burger');
  const isMixte = isTacos && nomLower.includes('mixte');

  const viandesDispo = stocks.viandes.filter(v => v.available).map(v => v.nom);
  const garnituresDispo = stocks.garnitures.filter(g => g.available).map(g => g.nom);
  const patesDispo = stocks.pates.filter(p => p.available).map(p => p.nom);
  const saucesDispo = stocks.sauces.filter(s => s.available).map(s => s.nom);

  if (isMixte) {
      listeOptions = viandesDispo;
      titreOptions = "Choisissez vos viandes";
      minChoix = 2; 
      if (selectedVar?.nom === 'L' || selectedVar?.nom === 'Standard') maxChoix = 2;
      else if (selectedVar?.nom === 'XL') maxChoix = 3;
      else if (selectedVar?.nom === 'XXL') maxChoix = 4;
      else maxChoix = 2;
  }
  else if (isPizzaProduct) {
      if (nomLower.includes('2 saisons')) { maxChoix = 2; minChoix = 2; listeOptions = garnituresDispo; titreOptions = "2 Garnitures"; }
      if (nomLower.includes('4 saisons')) { maxChoix = 4; minChoix = 4; listeOptions = garnituresDispo; titreOptions = "4 Garnitures"; }
  }

  const incrementOption = (opt, currentList, setList, max) => { if (currentList.length < max) setList([...currentList, opt]); };
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
        
        {variantesDispo.length > 0 && (
            <div style={{marginTop:'20px'}}>
                <div style={{fontWeight:'bold', marginBottom:'10px'}}>Taille</div>
                <div style={{display:'flex', gap:'10px', flexWrap:'wrap'}}>
                    {variantesDispo.map(v => (
                        <button key={v.nom} onClick={() => { setSelectedVar(v); setOptionsChoisies([]); }} style={{padding:'10px 20px', borderRadius:'8px', border: selectedVar?.nom === v.nom ? `2px solid ${COLORS.primary}` : '1px solid #ddd', background: selectedVar?.nom === v.nom ? '#FFF5F5' : 'white', fontWeight:'bold'}}>{v.nom} - {v.prix} DH</button>
                    ))}
                </div>
            </div>
        )}
        
        {isPates && (
            <div style={{marginTop:'25px', borderTop:'1px solid #eee', paddingTop:'15px'}}>
                <div style={{fontWeight:'bold', marginBottom:'10px'}}>Type de Pâtes (Obligatoire)</div>
                <div style={{display:'flex', gap:'10px'}}>
                    {patesDispo.map(type => (
                        <button key={type} onClick={() => setTypePates(type)} style={{flex:1, padding:'12px', borderRadius:'12px', border: typePates === type ? `2px solid ${COLORS.primary}` : '1px solid #ddd', background: typePates === type ? '#FFF5F5' : 'white', fontWeight:'bold', color: typePates === type ? COLORS.primary : 'black'}}>{type}</button>
                    ))}
                </div>
            </div>
        )}
        
        {isPizzaProduct && (<div style={{marginTop:'25px', borderTop:'1px solid #eee', paddingTop:'15px'}}><div style={{fontWeight:'bold', marginBottom:'10px'}}>Suppléments</div><div onClick={() => setIsCheesyCrust(!isCheesyCrust)} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'15px', borderRadius:'10px', border: isCheesyCrust ? `2px solid ${COLORS.promo}` : '1px solid #ddd', background: isCheesyCrust ? '#FFFBF0' : 'white', cursor:'pointer', marginBottom:'15px'}}><span style={{fontWeight:'bold'}}>🧀 Cheesy Crust (Bords Fourrés)</span><span style={{color: COLORS.primary, fontWeight:'bold'}}>+{selectedVar?.nom === 'M' || selectedVar?.nom === 'Standard' || !selectedVar ? '15' : '25'} DH</span></div><div style={{display:'flex', flexWrap:'wrap', gap:'10px'}}>{EXTRAS_PIZZA.map(ex => { const isSelected = extrasPizza.some(e => e.nom === ex.nom); return (<button key={ex.nom} onClick={() => toggleExtraPizza(ex)} style={{padding:'8px 12px', borderRadius:'20px', border: isSelected ? `1px solid ${COLORS.primary}` : '1px solid #ddd', background: isSelected ? '#FFF5F5' : 'white', color: isSelected ? COLORS.primary : 'black', fontWeight:'bold', fontSize:'0.9rem'}}>{isSelected ? '✓ ' : '+ '}{ex.nom} ({ex.prix} DH)</button>) })}</div></div>)}
        {isBurger && (<div style={{marginTop:'25px', borderTop:'1px solid #eee', paddingTop:'15px'}}><div style={{fontWeight:'bold', marginBottom:'10px', color: COLORS.danger}}>Je ne veux pas de...</div><div style={{display:'flex', flexWrap:'wrap', gap:'10px'}}>{RETRAIT_INGREDIENTS.map(ing => (<button key={ing} onClick={() => toggleSans(ing)} style={{padding:'8px 12px', borderRadius:'20px', border: '1px solid #FCA5A5', background: sansIngredients.includes(ing) ? '#FEF2F2' : 'white', color: COLORS.danger, fontWeight:'bold', fontSize:'0.9rem', opacity: sansIngredients.includes(ing) ? 1 : 0.6}}>{sansIngredients.includes(ing) ? '🚫 ' : ''}{ing}</button>))}</div></div>)}
        
        {isTacos && (
            <div style={{marginTop:'25px', borderTop:'1px solid #eee', paddingTop:'15px'}}>
                <div style={{fontWeight:'bold', marginBottom:'10px'}}>Sauces <small style={{color: COLORS.danger}}>(Minimum 1, Max 2)</small></div>
                <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                    {saucesDispo.map(s => { 
                        const count = getCount(s, sauces); 
                        return (<div key={s} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px dashed #eee'}}><span>{s}</span><div style={{display:'flex', alignItems:'center', gap:'10px'}}>{count > 0 && <button onClick={() => decrementOption(s, sauces, setSauces)} style={{width:'30px', height:'30px', borderRadius:'50%', border:'1px solid #ddd', background:'white', fontWeight:'bold'}}>-</button>}{count > 0 && <span style={{fontWeight:'bold'}}>{count}</span>}<button onClick={() => incrementOption(s, sauces, setSauces, 2)} style={{width:'30px', height:'30px', borderRadius:'50%', border:'none', background:COLORS.secondary, color:'white', fontWeight:'bold'}}>+</button></div></div>); 
                    })}
                </div>
            </div>
        )}
        
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