/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @next/next/no-img-element */
'use client';
import { useState, useEffect } from 'react';
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, setDoc, addDoc, collection } from 'firebase/firestore';

// --- ⚠️ VOS CLÉS ICI SINON ÇA NE MARCHE PAS ⚠️ ---
const firebaseConfig = {
  apiKey: "AIzaSyDqXN8tkXCnpXB_QdyHAUX6DzbsiT795FY",
    authDomain: "foodji-app.firebaseapp.com",
    projectId: "foodji-app",
    storageBucket: "foodji-app.firebasestorage.app",
    messagingSenderId: "760216056378",
    appId: "1:760216056378:web:594f079a9ccb031d033b03"
};

// Init Firebase Safe
let app;
let db: any;
try {
    // Vérification si on est dans le navigateur pour éviter les erreurs serveur
    if (typeof window !== "undefined") {
        app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
        db = getFirestore(app);
    }
} catch (error) {
    console.error("Firebase Init Error", error);
}

const COLORS = {
  bg: "bg-[#151e32]", 
  bgLight: "bg-[#1f2b45]", 
  accent: "bg-[#a31d24]", 
  textAccent: "text-[#a31d24]", 
};

// --- CONFIGURATION ---
const PHONE_NUMBER_RESTO = "+212668197671"; 
const PHONE_NUMBER_LIVREUR = "+212668197671"; 

// Upsell Items
const UPSELL_ITEMS = [
    { name: "Soda 33cl", price: 12, emoji: "🥤" }, 
    { name: "Frites", price: 15, emoji: "🍟" }
];

// Types pour éviter les erreurs de compilation
type Variation = { size: string; price: number; };
type MenuItem = { name: string; desc: string; image?: string; logic?: string; hasSauce?: boolean; variations: Variation[]; };
type Category = { title: string; items: MenuItem[]; };

// Menu
const categories: Category[] = [
  {
    title: "🌮 Tacos",
    items: [
      { name: "Tacos Mixte", desc: "Composez votre mélange.", logic: "tacos_mixte", hasSauce: true, variations: [{size: "L", price: 42}, {size: "XL", price: 76}, {size: "XXL", price: 112}] },
      { name: "Tacos Le Taj Mahal", desc: "Viande hachée, Cordon bleu, Nuggets.", hasSauce: true, variations: [{size: "L", price: 34}, {size: "XL", price: 54}, {size: "XXL", price: 96}] },
      { name: "Tacos Crispy", desc: "Poulet pané croustillant.", hasSauce: true, variations: [{size: "L", price: 42}, {size: "XL", price: 76}, {size: "XXL", price: 112}] },
      { name: "Tacos Viande hachée", desc: "", hasSauce: true, variations: [{size: "L", price: 39}, {size: "XL", price: 72}, {size: "XXL", price: 104}] },
    ]
  },
  {
    title: "🍕 Pizzas",
    items: [
      { name: "2 Saisons", desc: "2 moitiés au choix.", logic: "pizza_2", variations: [{size: "M", price: 52}, {size: "L", price: 84}] },
      { name: "4 Saisons", desc: "3 à 4 ingrédients au choix.", logic: "pizza_4", variations: [{size: "M", price: 58}, {size: "L", price: 92}] },
      { name: "Pep's", desc: "Sauce tomate, mozzarella, origan.", variations: [{size: "M", price: 28}] },
    ]
  },
   {
    title: "🍔 Burgers",
    items: [
      { name: "Burger Cheese", desc: "Simple et efficace.", variations: [{size: "Unique", price: 48}] },
      { name: "Burger Double", desc: "Double steak, double plaisir.", variations: [{size: "Unique", price: 69}] },
    ]
  }
];

const SAUCES = ["Algérienne Maison", "Biggy Maison", "BbQ Maison", "Mayonnaise"];
const VIANDES_TACOS = ["Poulet", "Viande hachée", "Nuggets", "Crispy", "Cordon bleu", "Charcuterie"];
const GARNITURES_PIZZA = ["Viande hachée", "Poulet", "Cannibale", "Fruits de mer", "Charcuterie", "4 fromages", "Thon", "Végétarienne", "Pepperoni", "Salami", "Surprenez-moi !"];
const TYPES_PATES = ["Spaghetti", "Penne", "Tagliatelle"];

export default function Home() {
  const [view, setView] = useState('home'); 
  const [activeCategory, setActiveCategory] = useState(categories[0].title);
  const [cart, setCart] = useState<any[]>([]); 
  const [user, setUser] = useState({ name: '', phone: '', address: '', points: 0, comment: '', locationLink: '', pendingPoints: 0, pendingCode: '' });
  const [usePoints, setUsePoints] = useState(false);
  const [orderMethod, setOrderMethod] = useState('livraison'); 
  
  const [customizingItem, setCustomizingItem] = useState<any>(null); 
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]); 
  
  // États visuels
  const [showUpsell, setShowUpsell] = useState(false); 
  const [toast, setToast] = useState<string | null>(null); 
  const [inputCode, setInputCode] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  
  // GPS LOADING
  const [gpsLoading, setGpsLoading] = useState(false);

  // --- CHARGEMENT FIREBASE ---
  useEffect(() => {
    const localData = localStorage.getItem('foodji_account');
    if (localData) {
      const localUser = JSON.parse(localData);
      if (localUser.phone && db) {
         const docRef = doc(db, "clients", localUser.phone);
         getDoc(docRef).then((docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setUser(prev => ({ ...prev, ...localUser, points: data.points, pendingPoints: data.pendingPoints || 0, pendingCode: data.pendingCode || '' }));
            } else setUser(localUser);
         }).catch(e => console.error(e));
      } else setUser(localUser);
    }
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  // --- LOCALISATION (Corrigée) ---
  const getLocation = () => {
    if (!navigator.geolocation) { alert("GPS non supporté"); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const link = `https://www.google.com/maps?q=${position.coords.latitude},${position.coords.longitude}`;
        setUser(prev => ({ ...prev, locationLink: link, address: "📍 Position GPS récupérée" }));
        setGpsLoading(false);
        alert("GPS Trouvé ! Le lien sera envoyé au livreur.");
      },
      (error) => {
        alert("Erreur GPS. Vérifiez que la localisation est activée.");
        setGpsLoading(false);
      }
    );
  };

  // --- AJOUT PANIER + UPSELL ---
  const initiateAddToCart = (item: any, variation: any) => {
    if (item.logic) {
      setCustomizingItem({ item, variation, phase: 'logic', previousOptions: [] });
      setSelectedOptions([]);
    } else if (item.hasSauce) {
      setCustomizingItem({ item, variation, phase: 'simple_sauce', previousOptions: [] });
      setSelectedOptions([]);
    } else {
      addToCart(item, variation, []);
    }
  };

  const addToCart = (item: any, variation: any, options: string[] = []) => {
    const cartItem = {
      name: item.name,
      price: variation.price,
      size: variation.size === "Unique" ? "" : variation.size,
      options: options,
      id: Math.random()
    };
    setCart([...cart, cartItem]);
    setCustomizingItem(null);
    showToast(`"${item.name}" ajouté !`);
    
    // UPSELL FORCE (Sans condition de prix pour test)
    setShowUpsell(true);
  };

  const addUpsellItem = (uItem: any) => {
    setCart(prev => [...prev, { name: uItem.name, price: uItem.price, size: "Unique", options: [], id: Math.random() }]);
    showToast(`+ ${uItem.name} ajouté !`);
    setShowUpsell(false); 
  };

  // --- GESTION OPTIONS ---
  const handleOptionToggle = (option: string, maxLimit: number) => {
    const SURPRISE = "Surprenez-moi !";
    if (option === SURPRISE) {
        setSelectedOptions(selectedOptions.includes(SURPRISE) ? [] : [SURPRISE]);
        return;
    }
    let currentOptions = selectedOptions.includes(SURPRISE) ? [] : [...selectedOptions];
    if (currentOptions.includes(option)) {
        currentOptions = currentOptions.filter(o => o !== option);
    } else {
        if (maxLimit === 1) currentOptions = [option];
        else if (currentOptions.length < maxLimit) currentOptions.push(option);
    }
    setSelectedOptions(currentOptions);
  };

  const handleValidateConfig = () => {
      if (customizingItem.phase === 'logic' && customizingItem.item.hasSauce) {
          setCustomizingItem({ ...customizingItem, phase: 'sauce', previousOptions: selectedOptions });
          setSelectedOptions([]); 
      } else {
          addToCart(customizingItem.item, customizingItem.variation, [...(customizingItem.previousOptions || []), ...selectedOptions]);
      }
  };

  // --- ENVOI COMMANDE ---
  const sendToResto = async () => {
    const uniqueCode = Math.floor(1000 + Math.random() * 9000).toString();
    const total = cart.reduce((sum, i) => sum + i.price, 0);
    const discount = usePoints ? Math.min(user.points, total) : 0;
    const finalTotal = (total - discount) + (orderMethod === 'livraison' && total < 45 ? 5 : 0);
    const earnedPoints = parseFloat(((total - discount) * 0.05).toFixed(1));

    // Sauvegarde
    const userToSave = { 
        ...user, 
        points: user.points - discount, 
        pendingPoints: earnedPoints, 
        pendingCode: uniqueCode 
    };
    setUser(userToSave);
    localStorage.setItem('foodji_account', JSON.stringify(userToSave));

    // Firebase (Essai sans bloquer)
    if (db && user.phone) {
        try {
            await setDoc(doc(db, "clients", user.phone), userToSave, { merge: true });
            await addDoc(collection(db, "orders"), {
                date: new Date().toISOString(),
                client: userToSave,
                cart: cart,
                total: finalTotal,
                code: uniqueCode
            });
        } catch (e) { console.error("Erreur Save", e); }
    }

    // Message WhatsApp
    let methodLabel = orderMethod === 'livraison' ? "🛵 Livraison" : "🍽️ Sur place/Emporter";
    let message = `🔐 *CODE FIDÉLITÉ : ${uniqueCode}* 🔐\n\n`;
    message += `*NOUVELLE COMMANDE V52*\n----------------\n`;
    message += `👤 ${user.name} (${user.phone})\n`;
    message += `📌 ${methodLabel}\n`;
    if (orderMethod === 'livraison') message += `📍 ${user.address}\n`;
    if (user.comment) message += `💬 ${user.comment}\n`;
    message += `----------------\n`;
    cart.forEach(i => message += `- ${i.name} (${i.size}) ${i.options ? i.options.join(', ') : ''}\n`);
    message += `\n💰 *TOTAL : ${finalTotal} DH*\n`;
    
    window.open(`https://wa.me/${PHONE_NUMBER_RESTO.replace('+','')}?text=${encodeURIComponent(message)}`, '_blank');
    setView('success');
  };

  const sendToDriver = () => {
    let message = `*📦 LIVRAISON FOODJI*\n----------------\n`;
    message += `👤 ${user.name}\n📞 ${user.phone}\n📍 ${user.address}\n`;
    // ICI LE LIEN GPS APPARAITRA SI LOCATIONLINK EST REMPLI
    if (user.locationLink) message += `🗺️ *LIEN GPS :* ${user.locationLink}\n`;
    if (user.comment) message += `💬 ${user.comment}\n`;
    
    const total = cart.reduce((sum, i) => sum + i.price, 0);
    const discount = usePoints ? Math.min(user.points, total) : 0;
    const finalTotal = (total - discount) + (orderMethod === 'livraison' && total < 45 ? 5 : 0);

    message += `----------------\n💰 *A ENCAISSER : ${finalTotal} DH*\n`;
    
    window.open(`https://wa.me/${PHONE_NUMBER_LIVREUR.replace('+','')}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const validatePointsCode = async () => {
      if (inputCode.trim() === user.pendingCode) {
          const newPoints = user.points + user.pendingPoints;
          const updatedUser = { ...user, points: newPoints, pendingPoints: 0, pendingCode: '' };
          setUser(updatedUser);
          localStorage.setItem('foodji_account', JSON.stringify(updatedUser));
          if(db && user.phone) await setDoc(doc(db, "clients", user.phone), updatedUser, { merge: true });
          
          alert(`Félicitations ! Vous avez maintenant ${newPoints} points.`);
          setShowCodeInput(false);
      } else {
          alert(`Code incorrect. Le bon code est : ${user.pendingCode}`);
      }
  };

  return (
    <div className={`min-h-screen ${COLORS.bg} text-white font-sans pb-24 p-4`}>
      
      {/* BANDEAU DE TEST OBLIGATOIRE */}
      <div className="bg-yellow-500 text-black font-bold text-center p-2 mb-4">
          🚧 VERSION TEST V52 🚧<br/>
          (Si vous voyez ça, la mise à jour a marché)
      </div>

      {/* TOAST */}
      {toast && <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-[200] bg-green-500 text-white px-6 py-3 rounded-full font-bold">{toast}</div>}

      {/* UPSELL MODAL */}
      {showUpsell && (
          <div className="fixed inset-0 z-[160] bg-black/90 flex items-center justify-center p-4">
              <div className="bg-[#1f2b45] p-6 rounded-xl w-full max-w-xs text-center border border-white/20">
                  <h3 className="text-xl font-bold mb-4">Un supplément ?</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                      {UPSELL_ITEMS.map(u => (
                          <button key={u.name} onClick={() => addUpsellItem(u)} className="bg-black/40 p-3 rounded hover:bg-[#a31d24] border border-white/10">
                              <div className="text-2xl">{u.emoji}</div><div>{u.name}</div><div className="text-sm text-yellow-400">{u.price} DH</div>
                          </button>
                      ))}
                  </div>
                  <button onClick={() => setShowUpsell(false)} className="underline text-gray-400">Non merci</button>
              </div>
          </div>
      )}

      {/* HOME */}
      {view === 'home' && (
          <div className="text-center mt-10">
              <h1 className="text-4xl font-bold mb-4 text-[#a31d24]">FOODJI</h1>
              {user.name && <div className="bg-white/10 inline-block px-4 py-2 rounded-full mb-8">🏆 {user.points} Points</div>}
              <button onClick={() => setView('menu')} className="bg-[#a31d24] text-white px-10 py-4 rounded-full text-xl font-bold shadow-lg shadow-red-900/50">COMMANDER</button>
              {user.pendingPoints > 0 && <button onClick={() => setShowCodeInput(true)} className="block mx-auto mt-6 text-yellow-400 underline">J'ai un code fidélité</button>}
          </div>
      )}

      {/* MENU */}
      {view === 'menu' && (
          <div>
              <div className="flex overflow-x-auto gap-4 pb-4 mb-4 border-b border-white/10">
                  {categories.map(c => <button key={c.title} onClick={() => setActiveCategory(c.title)} className={`font-bold ${activeCategory === c.title ? 'text-[#a31d24]' : 'text-gray-400'}`}>{c.title}</button>)}
              </div>
              <div className="space-y-4">
                  {categories.find(c => c.title === activeCategory)?.items.map((item, i) => (
                      <div key={i} className="bg-[#1f2b45] p-4 rounded-xl border border-white/5 flex flex-col">
                          <div className="flex justify-between items-start">
                              <div>
                                  <h4 className="font-bold text-lg">{item.name}</h4>
                                  <p className="text-xs text-gray-400 mb-2">{item.desc}</p>
                              </div>
                          </div>
                          <div className="flex gap-2 mt-auto">
                              {item.variations.map((v, vi) => (
                                  <button key={vi} onClick={() => initiateAddToCart(item, v)} className="bg-black/20 hover:bg-[#a31d24] border border-white/10 px-3 py-2 rounded text-sm flex-grow flex justify-between">
                                      <span>{v.size === "Unique" ? "Commander" : v.size}</span>
                                      <span className="font-bold">{v.price} DH</span>
                                  </button>
                              ))}
                          </div>
                      </div>
                  ))}
              </div>
              {cart.length > 0 && <button onClick={() => setView('cart')} className="fixed bottom-4 left-4 right-4 bg-[#a31d24] text-white p-4 rounded-xl font-bold shadow-lg flex justify-between"><span>Voir Panier ({cart.length})</span><span>Voir</span></button>}
          </div>
      )}

      {/* CART & CHECKOUT */}
      {(view === 'cart' || view === 'checkout') && (
          <div>
              <h2 className="text-2xl font-bold mb-6">{view === 'cart' ? 'Mon Panier' : 'Validation'}</h2>
              {cart.map((item, i) => (
                  <div key={i} className="flex justify-between items-center bg-[#1f2b45] p-3 rounded-lg mb-2 border border-white/5">
                      <div><div className="font-bold">{item.name}</div><div className="text-xs text-gray-400">{item.options?.join(', ')}</div></div>
                      <div className="flex items-center gap-3"><span className="font-bold">{item.price} DH</span><button onClick={() => setCart(cart.filter((_, idx) => idx !== i))} className="text-red-500">X</button></div>
                  </div>
              ))}
              
              {view === 'cart' ? (
                  <button onClick={() => setView('checkout')} className="w-full bg-[#a31d24] py-4 rounded-xl font-bold mt-6">VALIDER LE PANIER</button>
              ) : (
                  <div className="mt-6 space-y-4">
                      {/* CHOIX METHODE */}
                      <div className="grid grid-cols-3 gap-2">
                          <button onClick={() => setOrderMethod('sur_place')} className={`p-2 text-xs font-bold border rounded ${orderMethod === 'sur_place' ? 'bg-[#a31d24] border-transparent' : 'border-gray-600'}`}>🍽️ Sur Place</button>
                          <button onClick={() => setOrderMethod('emporter')} className={`p-2 text-xs font-bold border rounded ${orderMethod === 'emporter' ? 'bg-[#a31d24] border-transparent' : 'border-gray-600'}`}>🛍️ Emporter</button>
                          <button onClick={() => setOrderMethod('livraison')} className={`p-2 text-xs font-bold border rounded ${orderMethod === 'livraison' ? 'bg-[#a31d24] border-transparent' : 'border-gray-600'}`}>🛵 Livraison</button>
                      </div>

                      {/* FORMULAIRE */}
                      <input type="text" name="name" placeholder="Nom" value={user.name} onChange={handleInputChange} className="w-full p-3 rounded bg-[#1f2b45] border border-white/10" />
                      <input type="tel" name="phone" placeholder="Téléphone" value={user.phone} onChange={handleInputChange} className="w-full p-3 rounded bg-[#1f2b45] border border-white/10" />
                      
                      {/* LOCALISATION */}
                      <div className="bg-[#1f2b45] p-3 rounded border border-white/10">
                          <label className="text-xs text-gray-400">ADRESSE / LOCALISATION</label>
                          <textarea name="address" value={user.address} onChange={handleInputChange} className="w-full bg-transparent outline-none text-sm h-16 mt-1" placeholder="Écrivez votre adresse ici..." />
                          <button onClick={getLocation} className="text-xs bg-blue-600 px-2 py-1 rounded mt-2 flex items-center gap-1">
                             {gpsLoading ? 'Recherche...' : '📍 Ajouter ma position GPS'}
                          </button>
                          {user.locationLink && <div className="text-xs text-green-400 mt-1">Position enregistrée ✅</div>}
                      </div>

                      <input type="text" name="comment" placeholder="Commentaire (optionnel)" value={user.comment} onChange={handleInputChange} className="w-full p-3 rounded bg-[#1f2b45] border border-white/10" />
                      
                      {/* FIDELITÉ */}
                      {user.points > 0 && (
                        <div className="flex justify-between items-center bg-green-900/20 p-3 rounded border border-green-500/30">
                            <span>Utiliser {user.points} points ?</span>
                            <input type="checkbox" checked={usePoints} onChange={() => setUsePoints(!usePoints)} />
                        </div>
                      )}

                      <button onClick={sendToResto} className="w-full bg-green-600 py-4 rounded-xl font-bold text-lg mt-4">CONFIRMER SUR WHATSAPP</button>
                  </div>
              )}
          </div>
      )}

      {/* MODAL CODE */}
      {showCodeInput && (
          <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4">
              <div className="bg-[#1f2b45] p-6 rounded-xl w-full max-w-xs text-center">
                  <h3 className="font-bold mb-4">Code Ticket</h3>
                  <input type="text" value={inputCode} onChange={e => setInputCode(e.target.value)} className="w-full p-2 text-black mb-4 text-center font-bold" placeholder="XXXX" />
                  <button onClick={validatePointsCode} className="bg-green-600 w-full py-2 rounded font-bold mb-2">Valider</button>
                  <button onClick={() => setShowCodeInput(false)} className="text-gray-400 underline text-sm">Annuler</button>
              </div>
          </div>
      )}

      {/* SUCCESS SCREEN */}
      {view === 'success' && (
          <div className="fixed inset-0 z-[50] bg-[#151e32] flex flex-col items-center justify-center p-6 text-center">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-2xl font-bold mb-4">Commande Envoyée !</h2>
              {orderMethod === 'livraison' && (
                  <button onClick={sendToDriver} className="bg-blue-600 w-full py-3 rounded-xl font-bold mb-4 shadow-lg">
                      📤 Envoyer infos au Livreur
                  </button>
              )}
              <button onClick={() => setView('home')} className="text-gray-400 underline">Retour</button>
          </div>
      )}

      {/* CUSTOMIZER */}
      {customizingItem && (
         <div className="fixed inset-0 z-[150] bg-black/90 flex items-center justify-center p-4">
            <div className="bg-[#1f2b45] w-full max-w-md p-6 rounded-xl border border-[#a31d24] max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-bold mb-4">{customizingItem.item.name}</h3>
                <div className="grid grid-cols-2 gap-2 mb-4">
                    {(customizingItem.phase === 'logic' ? getConfigRules().list : SAUCES).map(opt => (
                        <button key={opt} onClick={() => handleOptionToggle(opt, (customizingItem.phase === 'logic' && customizingItem.item.logic.includes('pizza')) ? 4 : 2)} className={`p-2 rounded border text-xs font-bold ${selectedOptions.includes(opt) ? 'bg-[#a31d24] border-white' : 'border-gray-600'}`}>{opt}</button>
                    ))}
                </div>
                <button onClick={handleValidateConfig} className="w-full bg-white text-black font-bold py-3 rounded">Suivant / Valider</button>
            </div>
         </div>
      )}

    </div>
  );
} 