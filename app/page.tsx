/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @next/next/no-img-element */
'use client';
import { useState, useEffect } from 'react';

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
const categories = [
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

// GÉNÉRATION CODE ALÉATOIRE SIMPLE (4 CHIFFRES)
const generateRandomCode = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
};

const cleanPhoneForLink = (p: string) => p.replace('+', '');

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('home'); 
  const [activeCategory, setActiveCategory] = useState(categories[0].title);
  const [cart, setCart] = useState<any[]>([]); 
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
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const checkStatus = () => setStatus(getRestaurantStatus());
    checkStatus();
    const timer = setInterval(checkStatus, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const savedData = localStorage.getItem('foodji_account');
    if (savedData) {
      const parsed = JSON.parse(savedData);
      setUser({...parsed, comment: '', locationLink: ''});
    }
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const getLocation = () => {
    if (!navigator.geolocation) {
      alert("La géolocalisation n'est pas supportée.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const link = `http://googleusercontent.com/maps.google.com/?q=${position.coords.latitude},${position.coords.longitude}`;
        setUser(prev => ({ ...prev, locationLink: link, address: prev.address || "📍 Position GPS récupérée" }));
        setIsLocating(false);
      },
      (error) => {
        alert("Impossible de récupérer la position.");
        setIsLocating(false);
      }
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
        if (selectedOptions.includes(SURPRISE)) {
            setSelectedOptions([]);
        } else {
            setSelectedOptions([SURPRISE]);
        }
        return;
    }
    let currentOptions = selectedOptions.includes(SURPRISE) ? [] : [...selectedOptions];
    if (currentOptions.includes(option)) {
      currentOptions = currentOptions.filter(o => o !== option);
    } else {
      if (maxLimit === 1) {
        currentOptions = [option];
      } else if (currentOptions.length < maxLimit) {
        currentOptions.push(option);
      }
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
    const isMainDish = item.price > 20; 
    if (isMainDish) {
        setTimeout(() => setShowUpsell(true), 500); 
    }
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

  const validatePointsCode = () => {
      // Comparaison stricte avec le code généré pour CETTE commande
      // On nettoie les espaces potentiels
      if (inputCode.trim() === user.pendingCode) {
          const newPoints = user.points + user.pendingPoints;
          saveUserData({ ...user, points: newPoints, pendingPoints: 0, pendingCode: '' }); 
          showToast(`Félicitations ! +${user.pendingPoints} points !`);
          setShowCodeInput(false);
          setInputCode('');
      } else {
          alert(`Code incorrect. Code attendu : ${user.pendingCode} (Regardez sur le message WhatsApp que vous avez envoyé !)`);
      }
  };

  const saveUserData = (newData: any) => {
    setUser(newData);
    localStorage.setItem('foodji_account', JSON.stringify(newData));
  };

  const handlePrint = () => {
      window.print();
  };

  const sendToResto = () => {
    const currentStatus = getRestaurantStatus();
    if (!currentStatus.isOpen) {
        setShowClosedMessage(true);
        return;
    }

    // GÉNÉRATION DU CODE ALÉATOIRE 4 CHIFFRES
    const uniqueCode = generateRandomCode();

    const amountEligibleForPoints = cartTotal - discount; 
    const earnedPoints = parseFloat((amountEligibleForPoints * 0.05).toFixed(1));
    
    setFinalTotal(currentFinalPrice);
    const { comment, locationLink, ...userToSave } = user;
    const pointsAfterUsage = user.points - discount;
    
    // SAUVEGARDE AVEC LE CODE UNIQUE
    saveUserData({ ...userToSave, points: pointsAfterUsage, pendingPoints: earnedPoints, pendingCode: uniqueCode });

    let methodLabel = "🛵 Livraison";
    if (orderMethod === 'emporter') methodLabel = "🛍️ Je passe la récupérer";
    if (orderMethod === 'sur_place') methodLabel = "🍽️ Sur Place";

    let message = `🔐 *CODE FIDÉLITÉ : ${uniqueCode}* 🔐\n`; // Code tout en haut
    message += `(A recopier sur le ticket)\n\n`;
    message += `*NOUVELLE COMMANDE FOODJI* 🌋\n`;
    message += `---------------------------\n`;
    message += `📌 *Type :* ${methodLabel}\n`;
    message += `👤 *Client :* ${user.name}\n`;
    message += `📞 *Tél :* ${user.phone}\n`;
    if (orderMethod === 'livraison') message += `📍 *Adresse :* ${user.address}\n`;
    // PAS DE LIEN GPS POUR RESTO
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
    // LIEN GPS UNIQUEMENT POUR LIVREUR
    if (user.locationLink) message += `🗺️ *GPS :* ${user.locationLink}\n`;
    if (user.comment) message += `💬 *Note :* ${user.comment}\n`;
    message += `--------------------------