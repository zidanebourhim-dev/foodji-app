/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @next/next/no-img-element */
'use client';
import { useState, useEffect } from 'react';
// 👇 IMPORTATION DE LA CONNEXION FIREBASE
import { db } from './firebase'; 
import { doc, getDoc, setDoc } from 'firebase/firestore';

// --- CONFIGURATION ---
const PHONE_NUMBER_RESTO = "+212668197671"; 
const PHONE_NUMBER_LIVREUR = "+212668197671"; 

const COLORS = {
  bg: "bg-[#151e32]", 
  bgLight: "bg-[#1f2b45]", 
  accent: "bg-[#a31d24]", 
  textAccent: "text-[#a31d24]", 
};

// --- DATA MARKETING ---
const UPSELL_ITEMS = [
  { name: "Soda 33cl", price: 12, emoji: "🥤" },
  { name: "Frites", price: 15, emoji: "🍟" }
];

const PROMO_TEXT = "🔥 OFFRE DU MOMENT : Livraison offerte dès 150 DH !";

// --- LISTES D'OPTIONS ---
const SAUCES = ["Algérienne Maison", "Biggy Maison", "BbQ Maison", "Mayonnaise"];
const VIANDES_TACOS = ["Poulet", "Viande hachée", "Nuggets", "Crispy", "Cordon bleu", "Charcuterie"];
const GARNITURES_PIZZA = ["Viande hachée", "Poulet", "Cannibale", "Fruits de mer", "Charcuterie", "4 fromages", "Thon", "Végétarienne", "Pepperoni", "Salami", "Surprenez-moi !"];
const TYPES_PATES = ["Spaghetti", "Penne", "Tagliatelle"];

// --- HORAIRES ---
const SCHEDULE: Record<number, { day: string; open: number | null; close: number | null }> = {
  0: { day: "Dimanche", open: 18, close: 1 },
  1: { day: "Lundi",    open: 12, close: 1 },
  2: { day: "Mardi",    open: 12, close: 1 },
  3: { day: "Mercredi", open: 12, close: 1 },
  4: { day: "Jeudi",    open: 12, close: 1 },
  5: { day: "Vendredi", open: 12, close: 2 },
  6: { day: "Samedi",   open: 18, close: 1 },
};

// --- DONNÉES DU MENU ---
type Variation = { size: string; price: number; };
type MenuItem = { name: string; desc: string; image?: string; logic?: string; hasSauce?: boolean; variations: Variation[]; };
type Category = { title: string; items: MenuItem[]; };

const categories: Category[] = [
  {
    title: "🌮 Tacos",
    items: [
      { name: "Tacos Mixte", desc: "Composez votre mélange.", logic: "tacos_mixte", hasSauce: true, variations: [{size: "L", price: 42}, {size: "XL", price: 76}, {size: "XXL", price: 112}] },
      { name: "Tacos Le Taj Mahal", desc: "Viande hachée, Cordon bleu, Nuggets.", hasSauce: true, variations: [{size: "L", price: 34}, {size: "XL", price: 54}, {size: "XXL", price: 96}] },
      { name: "Tacos Crispy", desc: "Poulet pané croustillant.", hasSauce: true, variations: [{size: "L", price: 42}, {size: "XL", price: 76}, {size: "XXL", price: 112}] },
      { name: "Tacos Viande hachée", desc: "", hasSauce: true, variations: [{size: "L", price: 39}, {size: "XL", price: 72}, {size: "XXL", price: 104}] },
      { name: "Tacos Cordon Bleu", desc: "", hasSauce: true, variations: [{size: "L", price: 39}, {size: "XL", price: 72}, {size: "XXL", price: 104}] },
      { name: "Tacos Nuggets", desc: "", hasSauce: true, variations: [{size: "L", price: 39}, {size: "XL", price: 72}, {size: "XXL", price: 104}] },
    ]
  },
  {
    title: "🍕 Pizzas",
    items: [
      { name: "2 Saisons", desc: "2 moitiés au choix.", logic: "pizza_2", variations: [{size: "M", price: 52}, {size: "L", price: 84}] },
      { name: "4 Saisons", desc: "3 à 4 ingrédients au choix.", logic: "pizza_4", variations: [{size: "M", price: 58}, {size: "L", price: 92}] },
      { name: "Pep's", desc: "Sauce tomate, mozzarella, origan.", variations: [{size: "M", price: 28}] },
      { name: "Burrata", desc: "Crémeuse et fraîche.", variations: [{size: "M", price: 78}] },
      { name: "4 Fromages", desc: "Mozza, gorgonzola, chèvre, parmesan.", variations: [{size: "M", price: 52}, {size: "L", price: 84}] },
      { name: "Pepperoni", desc: "", variations: [{size: "M", price: 52}, {size: "L", price: 84}] },
      { name: "Cannibale", desc: "Viande hachée, poulet, merguez.", variations: [{size: "M", price: 56}, {size: "L", price: 87}] },
      { name: "Thon", desc: "", variations: [{size: "M", price: 46}, {size: "L", price: 62}] },
      { name: "Fruits de mer", desc: "", variations: [{size: "M", price: 58}, {size: "L", price: 92}] },
      { name: "Charcuterie", desc: "", variations: [{size: "M", price: 48}, {size: "L", price: 68}] },
      { name: "Végétarienne", desc: "", variations: [{size: "M", price: 46}, {size: "L", price: 62}] },
      { name: "Salami", desc: "", variations: [{size: "M", price: 58}, {size: "L", price: 92}] },
      { name: "Calzone", desc: "", variations: [{size: "M", price: 48}, {size: "L", price: 68}] },
      { name: "Pizza Viande Hachée", desc: "", variations: [{size: "M", price: 52}, {size: "L", price: 84}] },
      { name: "Pizza Poulet", desc: "", variations: [{size: "M", price: 52}, {size: "L", price: 84}] },
    ]
  },
  {
    title: "🍔 Burgers",
    items: [
      { name: "Burger Cheese", desc: "Simple et efficace.", variations: [{size: "Unique", price: 48}] },
      { name: "Burger Double", desc: "Double steak, double plaisir.", variations: [{size: "Unique", price: 69}] },
      { name: "Burger Le Buddha", desc: "Recette signature végétarienne.", variations: [{size: "Unique", price: 50}] },
      { name: "Burger L'Extrême", desc: "Pour les grosses faims.", variations: [{size: "Unique", price: 74}] },
      { name: "Burger Le Foodji", desc: "Le best-seller de la maison.", variations: [{size: "Unique", price: 58}] },
      { name: "Burger Chicken Foodji", desc: "", variations: [{size: "Unique", price: 58}] },
      { name: "Burger Chicken", desc: "", variations: [{size: "Unique", price: 48}] },
      { name: "Burger Le Tasty", desc: "", variations: [{size: "Unique", price: 58}] },
    ]
  },
  {
    title: "🍝 Pâtes",
    items: [
      { name: "Pâtes Bolognaise", desc: "", logic: "pates_choix", variations: [{size: "Unique", price: 58}] },
      { name: "Pâtes Saumon épinard", desc: "", logic: "pates_choix", variations: [{size: "Unique", price: 60}] },
      { name: "Pâtes Poulet Champignon", desc: "", logic: "pates_choix", variations: [{size: "Unique", price: 62}] },
      { name: "Pâtes Arrabiata", desc: "Sauce tomate pimentée.", logic: "pates_choix", variations: [{size: "Unique", price: 42}] },
      { name: "Pâtes Carbonara", desc: "", logic: "pates_choix", variations: [{size: "Unique", price: 52}] },
      { name: "Pâtes 4 fromages", desc: "", logic: "pates_choix", variations: [{size: "Unique", price: 58}] },
      { name: "Pâtes Alfredo", desc: "", logic: "pates_choix", variations: [{size: "Unique", price: 62}] },
      { name: "Pâtes Fruits de Mer", desc: "", logic: "pates_choix", variations: [{size: "Unique", price: 62}] },
      { name: "Pâtes Salami", desc: "", logic: "pates_choix", variations: [{size: "Unique", price: 54}] },
    ]
  },
  {
    title: "🌯 Burritos",
    items: [
      { name: "Burrito Poulet", desc: "Pain tortilla, poulet, riz, maïs, laitue, tomate, cheddar.", variations: [{size: "Unique", price: 42}] },
      { name: "Burrito Viande hachée", desc: "Pain tortilla, viande hachée, riz, cheddar, légumes.", variations: [{size: "Unique", price: 47}] },
      { name: "Burrito Veggie", desc: "Pain tortilla, légumes sautés, riz, laitue, tomate, maïs, cheddar.", variations: [{size: "Unique", price: 39}] },
    ]
  },
  {
    title: "🥙 Koniks",
    items: [
      { name: "Koniks Poulet", desc: "Pain tortilla, poulet, cheddar, mélange de légumes.", variations: [{size: "Unique", price: 48}] },
      { name: "Koniks Viande Hachée", desc: "Pain tortilla, viande hachée, cheddar, légumes.", variations: [{size: "Unique", price: 52}] },
      { name: "L'IKonik", desc: "Pain tortilla, poulet et viande hachée, cheddar, légumes.", variations: [{size: "Unique", price: 58}] },
    ]
  },
  {
    title: "🍟 Sides",
    items: [
      { name: "Ration Frites", desc: "", variations: [{size: "Unique", price: 15}] },
      { name: "Frites Fromagères", desc: "", variations: [{size: "Unique", price: 30}] },
      { name: "Tenders x5", desc: "", variations: [{size: "Unique", price: 35}] },
      { name: "Mozza' Fingers x5", desc: "", variations: [{size: "Unique", price: 25}] },
      { name: "Cheese Bomb x5", desc: "", variations: [{size: "Unique", price: 25}] },
      { name: "Onion rings x5", desc: "", variations: [{size: "Unique", price: 25}] },
      { name: "Frites Carbo", desc: "", variations: [{size: "Unique", price: 45}] },
      { name: "Nuggets x5", desc: "", variations: [{size: "Unique", price: 25}] },
    ]
  }
];

const getRestaurantStatus = () => {
  const now = new Date();
  const day = now.getDay(); 
  const hour = now.getHours(); 
  const prevDay = (day === 0) ? 6 : day - 1;
  const prevSchedule = SCHEDULE[prevDay];
  if (prevSchedule.open !== null && prevSchedule.close !== null && prevSchedule.close < prevSchedule.open && hour < prevSchedule.close) {
    return { isOpen: true, closeAt: prevSchedule.close, openAt: null };
  }
  const todaySchedule = SCHEDULE[day];
  if (todaySchedule.open === null) return { isOpen: false, closeAt: null, openAt: "Demain" };
  
  let isLateNightShift = false;
  if (todaySchedule.close !== null && todaySchedule.open !== null) {
    isLateNightShift = todaySchedule.close < todaySchedule.open;
  }

  if (todaySchedule.open !== null && todaySchedule.close !== null) {
    if (isLateNightShift) {
        if (hour >= todaySchedule.open) return { isOpen: true, closeAt: todaySchedule.close, openAt: null };
    } else {
        if (hour >= todaySchedule.open && hour < todaySchedule.close) return { isOpen: true, closeAt: todaySchedule.close, openAt: null };
    }
  }
  return { isOpen: false, closeAt: null, openAt: todaySchedule.open };
};

const isValidMoroccanPhone = (phone: string) => {
  const cleanPhone = phone.replace(/\s/g, '');
  const regex = /^(05|06|07)\d{8}$/;
  return regex.test(cleanPhone);
};

// --- FONCTION CODE ALÉATOIRE ---
const generateRandomCode = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
};

const cleanPhoneForLink = (p: string) => p.replace('+', '');

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('home'); 
  const [activeCategory, setActiveCategory] = useState(categories[0].title);
  const [cart, setCart] = useState<any[]>([]); 
  
  // User State avec valeurs par défaut
  const [user, setUser] = useState({ name: '', phone: '', address: '', points: 0, comment: '', locationLink: '', pendingPoints: 0, pendingCode: '' });
  
  const [usePoints, setUsePoints] = useState(false);
  const [orderMethod, setOrderMethod] = useState('livraison'); 
  const [showClosedMessage, setShowClosedMessage] = useState(false);
  const [status, setStatus] = useState<{isOpen: boolean, closeAt: number | null, openAt: any}>({ isOpen: false, closeAt: null, openAt: null });
  const [isLocating, setIsLocating] = useState(false);
  const [finalTotal, setFinalTotal] = useState(0);
  const [customizingItem, setCustomizingItem] = useState<any>(null); 
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]); 
  const [showUpsell, setShowUpsell] = useState(false); 
  const [toast, setToast] = useState<string | null>(null); 
  const [inputCode, setInputCode] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => { setLoading(false); }, 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const checkStatus = () => setStatus(getRestaurantStatus());
    checkStatus();
    const timer = setInterval(checkStatus, 60000);
    return () => clearInterval(timer);
  }, []);

  // --- CHARGEMENT INTELLIGENT DES DONNÉES ---
  // 1. On charge le LocalStorage (rapide)
  // 2. Si on a un numéro, on va chercher la vérité dans le Cloud (Firebase)
  useEffect(() => {
    const localData = localStorage.getItem('foodji_account');
    if (localData) {
      const localUser = JSON.parse(localData);
      
      if (localUser.phone) {
         const docRef = doc(db, "clients", localUser.phone);
         getDoc(docRef).then((docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                // Fusion des données : Firebase gagne pour les points
                setUser(prev => ({ 
                    ...prev, 
                    ...localUser, 
                    points: data.points, 
                    pendingPoints: data.pendingPoints || 0, 
                    pendingCode: data.pendingCode || '' 
                }));
            } else {
                // Nouvel utilisateur sur Firebase
                setUser(localUser);
            }
         }).catch(e => console.log("Mode hors ligne ou erreur firebase", e));
      } else {
          setUser(localUser);
      }
    }
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const getLocation = () => {
    if (!navigator.geolocation) { alert("Géolocalisation non supportée."); return; }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const link = `http://googleusercontent.com/maps.google.com/?q=${position.coords.latitude},${position.coords.longitude}`;
        setUser(prev => ({ ...prev, locationLink: link, address: prev.address || "📍 Position GPS récupérée" }));
        setIsLocating(false);
      },
      (error) => { alert("Impossible de récupérer la position."); setIsLocating(false); }
    );
  };

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

  const handleOptionToggle = (option: string, maxLimit: number) => {
    const SURPRISE = "Surprenez-moi !";
    if (option === SURPRISE) {
        if (selectedOptions.includes(SURPRISE)) setSelectedOptions([]);
        else setSelectedOptions([SURPRISE]);
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

  const getConfigRules = () => {
    if (!customizingItem) return { list: [], max: 0, min: 0, title: "" };
    const { item, variation, phase } = customizingItem;
    if (phase === 'sauce' || phase === 'simple_sauce') return { list: SAUCES, max: 2, min: 0, title: "Choisis tes sauces (max 2)" };
    if (item.logic === 'tacos_mixte') {
      let max = 2;
      if (variation.size === 'XL') max = 3;
      if (variation.size === 'XXL') max = 4;
      return { list: VIANDES_TACOS, max, min: 1, title: `Choisis tes ${max} viandes` };
    }
    if (item.logic === 'pizza_2') return { list: GARNITURES_PIZZA, max: 2, min: 2, title: "Choisis tes 2 moitiés" };
    if (item.logic === 'pizza_4') return { list: GARNITURES_PIZZA, max: 4, min: 3, title: "Choisis 3 ou 4 garnitures" };
    if (item.logic === 'pates_choix') return { list: TYPES_PATES, max: 1, min: 1, title: "Choisissez vos pâtes" };
    return { list: [], max: 0, min: 0, title: "" };
  };

  const rules = getConfigRules();
  const isConfigValid = selectedOptions.length >= rules.min || selectedOptions.includes("Surprenez-moi !");

  const handleValidateConfig = () => {
      if (customizingItem.phase === 'logic' && customizingItem.item.hasSauce) {
          setCustomizingItem({ ...customizingItem, phase: 'sauce', previousOptions: selectedOptions });
          setSelectedOptions([]); 
      } else {
          const allOptions = [...(customizingItem.previousOptions || []), ...selectedOptions];
          addToCart(customizingItem.item, customizingItem.variation, allOptions);
      }
  };

  const addToCart = (item: any, variation: any, options: string[] = []) => {
    const cartItem = {
      name: item.name,
      price: variation.price,
      size: variation.size === "Unique" ? "" : variation.size,
      options: options,
      image: item.image,
      id: Math.random()
    };
    setCart([...cart, cartItem]);
    setCustomizingItem(null);
    showToast(`"${item.name}" ajouté au panier !`);
  };

  const addUpsellItem = (uItem: any) => {
      const cartItem = {
          name: uItem.name,
          price: uItem.price,
          size: "Unique",
          options: [],
          id: Math.random()
      };
      setCart(prev => [...prev, cartItem]);
      showToast(`+ ${uItem.name} ajouté !`);
      setShowUpsell(false); 
  };

  const removeFromCart = (indexToRemove: number) => setCart(cart.filter((_, index) => index !== indexToRemove));
  
  const cartTotal = cart.reduce((sum, item) => sum + item.price, 0);
  const deliveryFee = (orderMethod === 'livraison' && cartTotal < 45) ? 5 : 0;
  const discount = usePoints ? Math.min(user.points, cartTotal) : 0;
  const currentFinalPrice = cartTotal + deliveryFee - discount;

  const handleInputChange = (e: any) => {
    const { name, value } = e.target;
    setUser({ ...user, [name]: value });
  };

  // --- SAUVEGARDE INTELLIGENTE (CLOUD + LOCAL) ---
  const saveUserToFirebase = async (updatedUser: any) => {
      // Toujours sauvegarder en local pour l'interface immédiate
      localStorage.setItem('foodji_account', JSON.stringify(updatedUser));
      
      try {
        // Essayer de sauvegarder sur le Cloud si on a un numéro
        if(updatedUser.phone) {
            const userRef = doc(db, "clients", updatedUser.phone);
            await setDoc(userRef, {
                name: updatedUser.name,
                phone: updatedUser.phone,
                address: updatedUser.address,
                points: updatedUser.points,
                pendingPoints: updatedUser.pendingPoints,
                pendingCode: updatedUser.pendingCode
            }, { merge: true });
        }
      } catch (e) {
          console.error("Erreur de sauvegarde Cloud", e);
      }
  };

  const validatePointsCode = async () => {
      if (inputCode.trim() === user.pendingCode) {
          const newPoints = user.points + user.pendingPoints;
          const updatedUser = { ...user, points: newPoints, pendingPoints: 0, pendingCode: '' };
          
          setUser(updatedUser);
          await saveUserToFirebase(updatedUser); 
          
          showToast(`Félicitations ! +${user.pendingPoints} points !`);
          setShowCodeInput(false);
          setInputCode('');
      } else {
          alert("Code incorrect. Vérifiez le ticket.");
      }
  };

  const handlePrint = () => {
      window.print();
  };

  const sendToResto = async () => {
    const currentStatus = getRestaurantStatus();
    if (!currentStatus.isOpen) {
        setShowClosedMessage(true);
        return;
    }

    const uniqueCode = generateRandomCode();
    const amountEligibleForPoints = cartTotal - discount; 
    const earnedPoints = parseFloat((amountEligibleForPoints * 0.05).toFixed(1));
    
    setFinalTotal(currentFinalPrice);
    const pointsAfterUsage = user.points - discount;
    
    const updatedUser = { ...user, points: pointsAfterUsage, pendingPoints: earnedPoints, pendingCode: uniqueCode };
    setUser(updatedUser);
    await saveUserToFirebase(updatedUser);

    let methodLabel = "🛵 Livraison";
    if (orderMethod === 'emporter') methodLabel = "🛍️ Je passe la récupérer";
    if (orderMethod === 'sur_place') methodLabel = "🍽️ Sur Place";

    let message = `🔐 *CODE FIDÉLITÉ : ${uniqueCode}* 🔐\n`;
    message += `(À recopier sur le ticket)\n\n`;
    message += `*NOUVELLE COMMANDE FOODJI* 🌋\n`;
    message += `---------------------------\n`;
    message += `📌 *Type :* ${methodLabel}\n`;
    message += `👤 *Client :* ${user.name}\n`;
    message += `📞 *Tél :* ${user.phone}\n`;
    if (orderMethod === 'livraison') message += `📍 *Adresse :* ${user.address}\n`;
    if (user.comment) message += `💬 *Note :* ${user.comment}\n`;
    message += `🏆 *Fidélité :* ${pointsAfterUsage} pts (En attente : +${earnedPoints})\n`;
    message += `---------------------------\n`;
    message += `*COMMANDE :*\n`;
    
    cart.forEach(item => {
      message += `- ${item.name} ${item.size ? `(${item.size})` : ''} : ${item.price} DH\n`;
      if (item.options && item.options.length > 0) message += `  └ _${item.options.join(', ')}_\n`;
    });

    message += `\n🧾 *DÉTAIL :*`;
    message += `\nPanier : ${cartTotal} DH`;
    if (deliveryFee > 0) message += `\n🛵 Frais de livraison : +${deliveryFee} DH`;
    if (usePoints && discount > 0) message += `\n💎 Points utilisés : -${discount} DH`;
    message += `\n\n💰 *TOTAL À PAYER : ${currentFinalPrice} DH*`;
    
    const url = `https://wa.me/${cleanPhoneForLink(PHONE_NUMBER_RESTO)}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');

    setView('success');
  };

  const sendToDriver = () => {
    let message = `*📦 COURSE LIVRAISON FOODJI*\n`;
    message += `---------------------------\n`;
    message += `👤 *Client :* ${user.name}\n`;
    message += `📞 *Tél :* ${user.phone}\n`;
    message += `📍 *Adresse :* ${user.address}\n`;
    if (user.locationLink) message += `🗺️ *GPS :* ${user.locationLink}\n`;
    if (user.comment) message += `💬 *Note :* ${user.comment}\n`;
    message += `---------------------------\n`;
    message += `💰 *A ENCAISSER : ${finalTotal} DH*\n`;
    
    const url = `https://wa.me/${cleanPhoneForLink(PHONE_NUMBER_LIVREUR)}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const currentItems = categories.find(c => c.title === activeCategory)?.items || [];
  const isAddressNeeded = orderMethod === 'livraison';
  const canOrder = user.name && isValidMoroccanPhone(user.phone) && (!isAddressNeeded || user.address);

  if (loading) {
      return (
          <div className="fixed inset-0 bg-[#151e32] flex flex-col items-center justify-center z-[999]">
              <img src="/foodji.png" alt="Logo" className="w-48 h-48 mb-6 animate-pulse drop-shadow-2xl" />
              <div className="text-[#a31d24] font-bold tracking-[0.3em] text-sm animate-bounce">CHARGEMENT...</div>
              <div className="w-32 h-1 bg-gray-800 mt-4 rounded-full overflow-hidden"><div className="h-full bg-[#a31d24] animate-progress"></div></div>
              <style jsx>{`@keyframes progress { 0% { width: 0%; } 100% { width: 100%; } } .animate-progress { animation: progress 2.5s ease-out forwards; }`}</style>
          </div>
      );
  }

  return (
    <div className={`min-h-screen ${COLORS.bg} text-white font-sans pb-24 selection:bg-red-900 relative`}>
      
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #receipt-print, #receipt-print * { visibility: visible; }
          #receipt-print { position: absolute; left: 0; top: 0; width: 100%; color: black; background: white; }
          .no-print { display: none; }
        }
        @keyframes lava { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        .bg-animated { background: linear-gradient(-45deg, #151e32, #0f172a, #1e293b, #2a0a0d); background-size: 400% 400%; animation: lava 15s ease infinite; }
      `}</style>
      <div className="fixed inset-0 bg-animated -z-10"></div>
      {toast && <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[200] bg-green-500 text-white px-6 py-3 rounded-full shadow-2xl font-bold animate-bounce-slight flex items-center gap-2"><span>✅</span> {toast}</div>}

      {showUpsell && (
          <div className="fixed inset-0 z-[160] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
              <div className={`${COLORS.bgLight} p-6 rounded-2xl border border-white/10 max-w-sm w-full text-center backdrop-blur-md`}>
                  <h3 className="text-xl font-bold text-white mb-1">Un petit supplément ? 😋</h3>
                  <div className="grid grid-cols-2 gap-3 mb-6">{UPSELL_ITEMS.map((uItem) => (<button key={uItem.name} onClick={() => addUpsellItem(uItem)} className="bg-[#151e32] p-3 rounded-xl border border-white/5 hover:border-[#a31d24] transition group"><div className="text-3xl mb-2 group-hover:scale-110 transition">{uItem.emoji}</div><div className="text-xs font-bold text-white">{uItem.name}</div><div className="text-xs text-[#a31d24]">{uItem.price} DH</div></button>))}</div>
                  <button onClick={() => setShowUpsell(false)} className="text-gray-500 text-sm hover:text-white underline">Non merci, je continue</button>
              </div>
          </div>
      )}

      {showCodeInput && (
          <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
              <div className={`${COLORS.bgLight} p-6 rounded-2xl border border-white/10 max-w-sm w-full text-center`}>
                  <h3 className="text-xl font-bold text-white mb-4">Valider mes points 🎁</h3>
                  <p className="text-sm text-gray-400 mb-4">Entrez le code présent sur votre ticket :</p>
                  <input type="text" className="w-full p-3 rounded-lg bg-black/30 border border-gray-600 text-white text-center text-xl tracking-widest mb-4 uppercase" placeholder="#CODE" value={inputCode} onChange={(e) => setInputCode(e.target.value)} />
                  <button onClick={validatePointsCode} className="w-full bg-green-600 text-white py-3 rounded-xl font-bold mb-3">Valider</button>
                  <button onClick={() => setShowCodeInput(false)} className="text-gray-500 text-sm underline">Annuler</button>
              </div>
          </div>
      )}

      {showReceipt && (
          <div className="fixed inset-0 z-[250] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white text-black w-full max-w-sm p-6 rounded-lg shadow-2xl max-h-[90vh] overflow-y-auto relative">
                  <button onClick={() => setShowReceipt(false)} className="absolute top-2 right-2 text-gray-500 text-2xl no-print">✕</button>
                  <div id="receipt-print" className="text-center font-mono text-sm">
                      <img src="/foodji.png" alt="Foodji" className="w-24 mx-auto mb-2" />
                      <p className="text-xs mb-4">L'éruption des saveurs</p>
                      <p className="mb-4 border-b border-dashed border-black pb-2">{new Date().toLocaleString('fr-MA')}<br/>Client : {user.name}<br/>Tél : {user.phone}</p>
                      <div className="text-left mb-4">
                          {cart.map((item, i) => (
                              <div key={i} className="mb-2">
                                  <div className="flex justify-between font-bold"><span>{item.name} {item.size !== "Unique" && `(${item.size})`}</span><span>{item.price} dh</span></div>
                                  {item.options && item.options.length > 0 && (<div className="text-xs text-gray-600 ml-2">- {item.options.join(', ')}</div>)}
                              </div>
                          ))}
                      </div>
                      <div className="border-t border-dashed border-black pt-2 mb-4">
                          {deliveryFee > 0 && <div className="flex justify-between"><span>Livraison</span><span>{deliveryFee} dh</span></div>}
                          {discount > 0 && <div className="flex justify-between"><span>Remise Fidélité</span><span>-{discount} dh</span></div>}
                          <div className="flex justify-between text-xl font-black mt-2"><span>TOTAL</span><span>{finalTotal} DH</span></div>
                      </div>
                      <p className="text-xs mt-4">Merci de votre visite !</p>
                  </div>
                  <button onClick={handlePrint} className="w-full bg-black text-white py-3 rounded-lg font-bold mt-4 no-print">🖨️ Imprimer</button>
              </div>
          </div>
      )}
      
      {customizingItem && (
         <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-sm flex items-end sm:items-center justify-center animate-fade-in">
            <div className={`bg-[#1f2b45] w-full max-w-md p-6 rounded-t-3xl sm:rounded-2xl border-t-2 sm:border-2 border-[#a31d24] shadow-2xl flex flex-col max-h-[90vh]`}>
                <div className="flex justify-between items-start mb-4">
                    <div><h3 className="text-xl font-bold text-white">{customizingItem.item.name}</h3><p className="text-[#a31d24] font-bold text-sm mt-1">{rules.title}</p></div>
                    <button onClick={() => setCustomizingItem(null)} className="text-gray-400 hover:text-white font-bold text-xl">✕</button>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-6 overflow-y-auto flex-grow">
                    {rules.list.map((opt: string) => (
                        <button key={opt} onClick={() => handleOptionToggle(opt, rules.max)} className={`p-3 rounded-lg text-sm font-bold transition-all border flex justify-between items-center text-left ${selectedOptions.includes(opt) ? 'bg-[#a31d24] border-[#a31d24] text-white' : 'bg-[#151e32] border-gray-700 text-gray-300 hover:border-gray-500'}`}><span>{opt}</span>{selectedOptions.includes(opt) && <span>✓</span>}</button>
                    ))}
                </div>
                <div className="flex justify-between items-center border-t border-white/10 pt-4"><span className="text-xs text-gray-400">Choix : {selectedOptions.length} / {rules.max}</span><button onClick={handleValidateConfig} disabled={!isConfigValid} className={`px-8 py-3 rounded-xl font-bold transition-all ${isConfigValid ? 'bg-white text-black hover:bg-gray-200' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}>{(customizingItem.phase === 'logic' && customizingItem.item.hasSauce) ? 'Suivant →' : 'Valider'}</button></div>
            </div>
         </div>
      )}

      {showClosedMessage && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#1f2b45] border-2 border-[#a31d24] p-8 rounded-2xl text-center max-w-sm shadow-2xl transform scale-110"><div className="text-6xl mb-4 animate-bounce">🚫</div><h3 className="text-2xl font-bold text-[#a31d24] mb-4">Oups, c'est fermé !</h3><p className="text-gray-300 text-lg mb-8 leading-relaxed font-medium">On sait qu'on te manque mais fallait venir plus tôt...<br/><span className="text-white font-bold text-xl block mt-2">NE POUSSEZ PAS ! 😤</span><span className="text-sm text-gray-400 block mt-2">Un peu de patience, on ouvre bientôt.</span></p><button onClick={() => setShowClosedMessage(false)} className="bg-white text-black px-6 py-3 rounded-full font-bold hover:bg-gray-200 w-full">D'accord, à demain ❤️</button></div>
        </div>
      )}

      {view === 'success' && (
          <div className="fixed inset-0 z-[50] bg-[#151e32] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-4xl mb-6 shadow-[0_0_30px_rgba(34,197,94,0.5)]">🎉</div>
              <h2 className="text-3xl font-bold text-white mb-2">Commande Envoyée !</h2>
              <p className="text-gray-400 mb-8">Merci, on s'occupe de tout.</p>
              
              <button onClick={() => setShowReceipt(true)} className="mb-4 text-white underline text-sm">📄 Voir mon ticket</button>

              {user.pendingPoints > 0 && (
                  <div className="w-full max-w-sm bg-[#a31d24]/20 p-4 rounded-xl border border-[#a31d24] mb-6">
                      <p className="text-white font-bold mb-2">🎁 Vous avez {user.pendingPoints} points en attente !</p>
                      <button onClick={() => setShowCodeInput(true)} className="bg-[#a31d24] text-white px-4 py-2 rounded-lg text-sm font-bold animate-pulse">Entrer le code ticket</button>
                  </div>
              )}
              {orderMethod === 'livraison' && (
                  <div className="w-full max-w-sm bg-[#1f2b45] p-6 rounded-2xl border border-white/10 mb-6">
                      <p className="text-sm text-gray-300 mb-4">Pour aider le livreur à arriver plus vite, envoyez-lui votre position 👇</p>
                      <button onClick={sendToDriver} className="w-full bg-[#007acc] text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:scale-[1.02] transition flex items-center justify-center gap-2"><span>🛵 Envoyer infos au Livreur</span></button>
                  </div>
              )}
              <button onClick={() => {setCart([]); setView('home');}} className="text-gray-500 hover:text-white underline">Retour à l'accueil</button>
          </div>
      )}

      {view === 'home' && (
        <div className={`flex flex-col items-center justify-center h-screen p-4 text-center ${COLORS.bg} relative overflow-hidden`}>
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent to-black opacity-60 pointer-events-none"></div>
          <button onClick={() => setView('profile')} className={`absolute top-6 right-6 ${COLORS.bgLight} backdrop-blur-md px-4 py-2 rounded-full flex items-center border border-white/10 z-10 hover:bg-white/10 transition`}>
             <span className="mr-2 text-lg">👤</span>
             <span className="font-bold text-sm text-gray-200">{user.name ? user.name : 'Compte'}</span>
          </button>
          <div className="z-10 flex flex-col items-center w-full max-w-md">
            <div className="relative group cursor-pointer">
                <div className="absolute -inset-1 bg-red-600 rounded-full blur-3xl opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                <img src="/foodji.png" alt="Logo Foodji" className="relative w-72 mb-10 drop-shadow-2xl transition-all duration-700 ease-in-out transform hover:scale-105 hover:rotate-2 animate-pulse" />
            </div>
            {user.name && (<div className="mb-8 bg-white/5 px-6 py-2 rounded-xl border border-white/10 backdrop-blur-sm animate-fade-in-up"><span className="text-[#a31d24] font-bold">🏆 {user.points} Points</span> {user.pendingPoints > 0 && <span className="text-xs text-yellow-400 block">({user.pendingPoints} en attente)</span>}</div>)}
            {user.pendingPoints > 0 && (<button onClick={() => setShowCodeInput(true)} className="mb-6 bg-yellow-600/80 text-white px-4 py-2 rounded-full text-xs font-bold animate-bounce border border-yellow-400">🎁 Valider mes points en attente</button>)}
            <div className={`mb-6 flex items-center gap-2 px-4 py-1 rounded-full border border-white/5 backdrop-blur-md ${status.isOpen ? 'bg-green-900/30' : 'bg-red-900/30'}`}><div className={`w-2 h-2 rounded-full ${status.isOpen ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div><span className="text-xs text-gray-200 uppercase tracking-widest font-bold">{status.isOpen ? `OUVERT JUSQU'À ${status.closeAt}H00` : `FERMÉ • OUVRE À ${status.openAt}H00`}</span></div>
            <button onClick={() => {if(status.isOpen) setView('menu'); else setShowClosedMessage(true);}} className={`${COLORS.accent} text-white px-12 py-5 rounded-full text-xl font-bold shadow-[0_0_30px_rgba(163,29,36,0.5)] hover:scale-105 transition transform duration-300 border border-red-900 ${!status.isOpen ? 'opacity-50 grayscale' : ''}`}>VOIR LA CARTE</button>
          </div>
        </div>
      )}

      {view === 'profile' && (
        <div className="p-4 max-w-md mx-auto min-h-screen">
          <header className="flex justify-between items-center mb-8 mt-4"><button onClick={() => setView('home')} className="text-gray-400 font-bold hover:text-white transition">← ACCUEIL</button><h2 className="text-2xl font-bold text-white">Mon Espace</h2><div className="w-8"></div></header>
          <div className={`bg-gradient-to-br from-[#a31d24] to-[#5c0b10] p-8 rounded-2xl shadow-2xl mb-8 text-center relative overflow-hidden border border-red-900/50`}><div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div><p className="text-white/80 font-bold uppercase text-xs tracking-widest mb-2">Carte de Fidélité</p><p className="text-6xl font-extrabold text-white drop-shadow-md">{user.points || 0}</p><p className="text-white/90 text-sm mt-2 font-medium">Points Foodji (10dh = 0.5 pt)</p><div className="w-full bg-black/30 h-3 rounded-full mt-6 overflow-hidden backdrop-blur-sm"><div className="bg-white h-full shadow-[0_0_10px_white]" style={{ width: `${Math.min((user.points || 0), 100)}%` }}></div></div></div>
          <div className={`${COLORS.bgLight} p-6 rounded-xl border border-white/5`}>
            <h3 className={`text-lg font-bold ${COLORS.textAccent} mb-6`}>Mes Coordonnées</h3>
            <div className="space-y-5">
              <div className="group"><label className="block text-xs font-bold text-gray-500 mb-1">NOM</label><input type="text" name="name" value={user.name} onChange={handleInputChange} className={`w-full ${COLORS.bg} border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-[#a31d24] transition-colors`}/></div>
              <div className="group"><label className="block text-xs font-bold text-gray-500 mb-1">TÉLÉPHONE</label><input type="tel" name="phone" value={user.phone} onChange={handleInputChange} placeholder="06..." className={`w-full ${COLORS.bg} p-4 rounded-lg text-white border outline-none transition ${user.phone && !isValidMoroccanPhone(user.phone) ? 'border-red-500' : 'border-gray-700 focus:border-[#a31d24]'}`}/></div>
              <div className="group"><label className="block text-xs font-bold text-gray-500 mb-1">ADRESSE</label><textarea name="address" value={user.address} onChange={handleInputChange} placeholder="Adresse de livraison" className={`w-full ${COLORS.bg} p-4 rounded-lg text-white border border-gray-700 focus:border-[#a31d24] outline-none h-24 transition`}/></div>
              <button onClick={() => saveUserData(user)} className={`w-full py-4 rounded-lg font-bold transition mt-2 bg-gray-700 text-white hover:bg-gray-600`}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {view === 'menu' && (
        <div className="max-w-md mx-auto min-h-screen flex flex-col">
          <header className={`${COLORS.bg}/95 backdrop-blur-lg sticky top-0 z-20 border-b border-white/5 pt-4 pb-0`}>
            <div className="bg-gradient-to-r from-[#a31d24] to-[#ff5722] text-white text-xs font-bold text-center py-2 px-4 animate-pulse">{PROMO_TEXT}</div>
            <div className="flex justify-between items-center px-4 mb-4 mt-2"><button onClick={() => setView('home')} className="text-gray-400 text-sm font-bold hover:text-white">← RETOUR</button><span className="font-bold text-xl tracking-tighter">FOODJI</span><div className="w-16 text-right"><button onClick={() => setView('cart')} className="relative p-2"><span className="text-2xl">🛒</span>{cart.length > 0 && <span className={`absolute top-0 right-0 ${COLORS.accent} text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold`}>{cart.length}</span>}</button></div></div><div className="flex overflow-x-auto pb-0 px-4 gap-6 no-scrollbar">{categories.map((cat) => (<button key={cat.title} onClick={() => setActiveCategory(cat.title)} className={`whitespace-nowrap pb-3 text-sm font-bold border-b-2 transition-all duration-300 ${activeCategory === cat.title ? 'border-[#a31d24] text-white scale-105' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>{cat.title}</button>))}</div>
          </header>
          <div className="p-4 space-y-4 flex-grow overflow-y-auto bg-gradient-to-b from-transparent to-black/20"><h3 className="text-xl font-bold text-white mb-2 mt-2 flex items-center"><span className="w-1 h-6 bg-[#a31d24] mr-3 rounded-full"></span>{activeCategory}</h3>
            {currentItems.map((item, index) => (
              <div key={index} className={`${COLORS.bgLight} p-4 rounded-xl shadow-lg border border-white/5 hover:border-[#a31d24]/30 transition-colors`}><div className="mb-3">
                {item.image && <img src={item.image} alt={item.name} className="w-full h-32 object-cover rounded-lg mb-3" />}
                <h4 className="font-bold text-lg text-gray-100 leading-tight">{item.name}</h4>{item.desc && <p className="text-xs text-gray-400 mt-1 font-light">{item.desc}</p>}</div>
                <div className="flex flex-wrap gap-2">{item.variations.map((v, vIndex) => (<button key={vIndex} onClick={() => initiateAddToCart(item, v)} className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-bold transition-all flex-grow ${item.variations.length > 1 ? 'bg-[#151e32] text-gray-300 border border-gray-700 hover:border-[#a31d24] hover:text-white' : 'bg-white text-black hover:bg-gray-200'}`}><span>{v.size === "Unique" ? "Commander" : v.size}</span><span className={`ml-2 ${item.variations.length > 1 ? COLORS.textAccent : 'text-black'}`}>{v.price}dh</span>{item.variations.length === 1 && <span className="ml-2 text-[#a31d24]">+</span>}</button>))}</div>
              </div>
            ))}
            <div className="h-24"></div>
          </div>
        </div>
      )}

      {(view === 'cart' || view === 'checkout') && (
        <div className="p-4 max-w-md mx-auto min-h-screen">
          <header className="flex justify-between items-center mb-6 mt-2"><button onClick={() => setView(view === 'checkout' ? 'cart' : 'menu')} className="text-gray-400 font-bold hover:text-white">← RETOUR</button><h2 className="text-2xl font-bold text-white">{view === 'cart' ? 'Mon Panier' : 'Validation'}</h2><div className="w-8"></div></header>
          {view === 'cart' && cart.length === 0 && (<div className="text-center mt-32 opacity-50"><p className="text-7xl mb-4">🛒</p><p className="text-gray-400">Votre panier est vide.</p></div>)}
          {view === 'cart' && cart.length > 0 && (
             <div className="space-y-4 animate-fade-in">
             {cart.map((item, index) => (
               <div key={index} className={`${COLORS.bgLight} p-4 rounded-xl border border-white/5 flex flex-col`}>
                 <div className="flex justify-between items-center"><div><div className="font-bold">{item.name}</div>{item.size && <div className={`text-xs ${COLORS.textAccent} font-bold mt-1`}>Taille {item.size}</div>}</div><div className="flex items-center gap-4"><span className="font-bold text-lg">{item.price} <span className="text-xs text-gray-500">DH</span></span><button onClick={() => removeFromCart(index)} className="text-red-400 bg-red-900/20 w-8 h-8 rounded-full flex items-center justify-center font-bold hover:bg-red-900/50 transition">✕</button></div></div>
                 {item.options && item.options.length > 0 && (<div className="text-xs text-gray-400 mt-2 border-t border-white/5 pt-2">+ {item.options.join(', ')}</div>)}
               </div>
             ))}
             <div className="mt-4"><label className="block text-xs font-bold text-gray-500 mb-1">COMMENTAIRE / PRÉCISIONS</label><input type="text" name="comment" value={user.comment || ''} onChange={handleInputChange} placeholder="Ex: Sans oignons, code porte..." className={`w-full ${COLORS.bgLight} border border-white/10 rounded-xl p-4 text-white outline-none focus:border-[#a31d24] transition-colors`}/></div>
             <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/5"><div className="flex justify-between text-gray-400 mb-2"><span>Nombre d'articles</span><span>{cart.length}</span></div><div className="flex justify-between text-2xl font-bold text-white pt-4 border-t border-white/10"><span>Total Panier</span><span className={COLORS.textAccent}>{cartTotal} DH</span></div></div>
             <button onClick={() => setView('checkout')} className={`w-full ${COLORS.accent} text-white py-4 rounded-xl font-bold text-lg shadow-lg mt-4 hover:scale-[1.02] transition transform`}>Choisir mode de livraison →</button>
           </div>
          )}
          {view === 'checkout' && (
            <div className="space-y-6">
                <div className="grid grid-cols-3 gap-2"><button onClick={() => setOrderMethod('sur_place')} className={`p-3 rounded-xl text-xs font-bold border-2 transition-all ${orderMethod === 'sur_place' ? 'bg-[#a31d24] border-[#a31d24] text-white' : 'bg-transparent border-gray-600 text-gray-400'}`}>🍽️ Sur Place</button><button onClick={() => setOrderMethod('emporter')} className={`p-3 rounded-xl text-xs font-bold border-2 transition-all ${orderMethod === 'emporter' ? 'bg-[#a31d24] border-[#a31d24] text-white' : 'bg-transparent border-gray-600 text-gray-400'}`}>🛍️ Je passe la récupérer</button><button onClick={() => setOrderMethod('livraison')} className={`p-3 rounded-xl text-xs font-bold border-2 transition-all ${orderMethod === 'livraison' ? 'bg-[#a31d24] border-[#a31d24] text-white' : 'bg-transparent border-gray-600 text-gray-400'}`}>🛵 Livraison</button></div>
                <div className={`${COLORS.bgLight} p-6 rounded-2xl border border-white/5 shadow-xl`}>
                    {user.name ? (
                        <div className="mb-6 p-4 bg-[#15803d]/20 border border-[#15803d]/50 rounded-xl flex items-start"><span className="text-2xl mr-3">👋</span><div><p className="text-[#4ade80] font-bold">Ravi de vous revoir, {user.name}.</p><p className="text-[#4ade80]/70 text-xs mt-1">Vos informations sont prêtes.</p></div></div>
                    ) : (
                        <p className="text-gray-400 text-sm mb-6 text-center border-b border-white/10 pb-4">Complétez vos informations 👇</p>
                    )}
                    <div className="space-y-4">
                        <div className="group"><label className="block text-xs font-bold text-gray-500 mb-1">NOM</label><input type="text" name="name" value={user.name} onChange={handleInputChange} className={`w-full ${COLORS.bg} border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-[#a31d24] transition-colors`}/></div>
                        <div className="group"><label className="block text-xs font-bold text-gray-500 mb-1">TÉLÉPHONE</label><input type="tel" name="phone" value={user.phone} onChange={handleInputChange} className={`w-full ${COLORS.bg} border rounded-lg p-3 text-white outline-none transition-colors ${user.phone && !isValidMoroccanPhone(user.phone) ? 'border-red-500' : 'border-gray-700 focus:border-[#a31d24]'}`}/>{user.phone && !isValidMoroccanPhone(user.phone) && (<p className="text-red-500 text-xs mt-1 font-bold">⚠️ Numéro invalide</p>)}</div>
                        {orderMethod === 'livraison' && (<div className="group animate-fade-in"><label className="block text-xs font-bold text-gray-500 mb-1">ADRESSE DE LIVRAISON</label><div className="relative"><textarea name="address" value={user.address} onChange={handleInputChange} className={`w-full ${COLORS.bg} border border-gray-700 rounded-lg p-3 text-white outline-none focus:border-[#a31d24] transition-colors h-24 pr-10`}/><button type="button" onClick={getLocation} className="absolute bottom-2 right-2 bg-blue-600 text-white p-2 rounded-full text-xs font-bold shadow-lg hover:bg-blue-500 flex items-center gap-1">{isLocating ? '⏳' : '📍 Ma position'}</button></div>{user.locationLink && <p className="text-xs text-green-400 mt-1">✅ Position GPS prête</p>}</div>)}
                    </div>
                </div>
                {user.points > 0 && (
                   <div className={`${COLORS.bgLight} p-4 rounded-xl border border-white/5 flex items-center justify-between shadow-lg`}>
                       <div><p className="font-bold text-white">Utiliser mes points ?</p><p className="text-xs text-gray-400">Solde : {user.points} pts (-{Math.min(user.points, cartTotal)} DH)</p></div>
                       <label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" checked={usePoints} onChange={() => setUsePoints(!usePoints)} className="sr-only peer"/><div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#a31d24]"></div></label>
                   </div>
                )}
                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                     <div className="flex justify-between text-gray-400 mb-1"><span>Panier</span><span>{cartTotal} DH</span></div>
                     {deliveryFee > 0 && (<div className="flex justify-between text-orange-400 mb-1 text-sm"><span>Frais Livraison (- 45dh)</span><span>+{deliveryFee} DH</span></div>)}
                     {usePoints && discount > 0 && (<div className="flex justify-between text-[#4ade80] mb-1 font-bold"><span>Réduction Fidélité</span><span>-{discount} DH</span></div>)}
                     <div className="flex justify-between text-2xl font-bold text-white pt-4 border-t border-white/10 mt-2"><span>Total à Payer</span><span className={COLORS.textAccent}>{currentFinalPrice} DH</span></div>
                </div>
                <button 
                    onClick={sendToResto} 
                    disabled={!canOrder || !status.isOpen} 
                    className={`w-full py-4 rounded-xl font-bold text-lg shadow-[0_0_20px_rgba(37,211,102,0.2)] flex items-center justify-center gap-3 transition-all transform 
                    ${(!canOrder || !status.isOpen) ? 'bg-gray-700 cursor-not-allowed text-gray-500 opacity-50' : 'bg-[#25D366] text-white hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(37,211,102,0.4)]'}`}
                >
                    <span className="text-2xl">📱</span>
                    <span>{!status.isOpen ? 'Fermé (Voir horaires)' : (canOrder ? 'Confirmer la commande' : 'Info Manquante')}</span>
                </button>
            </div>
          )}
        </div>
      )}
      
      {cart.length > 0 && view === 'menu' && (
        <div className="fixed bottom-6 left-4 right-4 max-w-md mx-auto z-50">
          <button onClick={() => setView('cart')} className={`w-full ${COLORS.accent} text-white p-4 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex justify-between items-center font-bold border border-white/10 transform transition hover:scale-[1.02]`}>
            <div className="flex items-center"><span className="bg-white text-[#a31d24] rounded-full w-8 h-8 flex items-center justify-center font-bold mr-3 shadow-sm">{cart.length}</span><span className="font-medium">Voir mon panier</span></div><span className="text-xl tracking-tight">{cartTotal} DH</span>
          </button>
        </div>
      )}
    </div>
  );
}