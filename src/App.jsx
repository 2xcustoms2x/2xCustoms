import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { Sparkles, Brush, Feather, DollarSign, Menu, X, CheckCircle, Info, Upload, Zap, Shirt, List, Settings, MessageCircle, MapPin, Lock } from 'lucide-react';

// --- Configuration ---
// Read config from Vite env vars if available (recommended). These should be set
// in a `.env` file as `VITE_FIREBASE_CONFIG='{"apiKey":"...",...}'`
const APP_ID = typeof __app_id !== 'undefined' ? __app_id : (import.meta.env.VITE_APP_ID || 'default-2xcustoms-app-id');
let FIREBASE_CONFIG = null;
try {
  if (typeof __firebase_config !== 'undefined') {
    FIREBASE_CONFIG = JSON.parse(__firebase_config);
  } else if (import.meta.env.VITE_FIREBASE_CONFIG) {
    FIREBASE_CONFIG = JSON.parse(import.meta.env.VITE_FIREBASE_CONFIG);
  }
} catch (err) {
  console.error('Failed to parse FIREBASE config from environment:', err);
  FIREBASE_CONFIG = null;
}

const INITIAL_AUTH_TOKEN = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : (import.meta.env.VITE_INITIAL_AUTH_TOKEN || null);
const UPLOADED_IMAGE_URL = 'https://storage.googleapis.com/canvas-content-store/{6C931EF4-E907-449A-878C-A5E26BC8F977}.png';

// --- Global Data & Content ---
const PAGE_ROUTES = {
  home: { title: 'Home', icon: Sparkles },
  custom: { title: 'Book a Custom', icon: Brush },
  cleaning: { title: 'Cleaning Services', icon: Feather },
  gallery: { title: 'Gallery', icon: Shirt },
  pricing: { title: 'Pricing', icon: DollarSign },
  about: { title: 'About', icon: Info },
  contact: { title: 'Contact', icon: MessageCircle },
  submissions: { title: 'Dashboard', icon: List }
};

const CLEANING_LEVELS = [
  { level: 'Quick Clean', price: '$10', desc: 'A fast refresh for mild dirt and scuffs. Perfect for daily wear.' },
  { level: 'Deep Clean', price: '$20', desc: 'Full restoration, deep scrubbing of uppers, midsoles, and laces.' },
  { level: 'Restore & Repaint', price: '$35–$60', desc: 'Fixing deep scuffs, removing oxidation, and professional repainting of key areas.' },
];

const CUSTOM_PRICING = [
  { type: 'Simple Customs', price: '$30–$40', desc: 'Basic color changes, minor accents, and single logo application.' },
  { type: 'Medium Customs', price: '$50–$80', desc: 'Detailed line work, complex patterns, and full panel color transitions.' },
  { type: 'Advanced Customs', price: '$100+', desc: 'Full design concept, intricate artwork, airbrushing, and detailed finish work.' },
  { type: 'Cleaning (Deep)', price: '$20', desc: 'Full restoration, deep scrubbing of uppers, midsoles, and laces.' },
  { type: 'Restore/Repaint', price: '$35–$60', desc: 'Fixing deep scuffs and professional repainting of key areas.' },
];

// --- Utility Components ---

const Button = ({ children, onClick, variant = 'primary', className = '', icon: Icon, type = 'button', disabled = false }) => {
  const baseStyle = "flex items-center justify-center px-6 py-3 font-semibold rounded-xl transition-all duration-300 shadow-xl active:scale-[0.98] focus:outline-none focus:ring-4";
  let variantStyle = '';
  switch (variant) {
    case 'primary':
      variantStyle = 'bg-red-600 text-white hover:bg-red-700 ring-red-500/50';
      break;
    case 'secondary':
      variantStyle = 'bg-white text-gray-900 hover:bg-gray-100 ring-white/50';
      break;
    case 'ghost':
      variantStyle = 'bg-transparent text-red-500 hover:bg-gray-900 border border-red-600 ring-red-700/50';
      break;
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${baseStyle} ${variantStyle} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      {Icon && <Icon className="w-5 h-5 mr-2" />}
      {children}
    </button>
  );
};

const SectionTitle = ({ children }) => (
  <h2 className="text-4xl sm:text-5xl font-extrabold text-white mb-10 text-center tracking-tight border-b-4 border-red-600 inline-block pb-2 px-4 mx-auto">
    {children}
  </h2>
);

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex justify-center items-center p-4">
      <div className="bg-gray-900 p-8 rounded-xl shadow-2xl max-w-lg w-full border-t-4 border-red-600 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-red-500">
          <X className="w-6 h-6" />
        </button>
        <h3 className="text-3xl font-bold text-white mb-6">{title}</h3>
        {children}
      </div>
    </div>
  );
};

// --- Admin Login ---
const AdminLogin = ({ isOpen, onClose, onSuccess, signInWithEmail }) => {
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const ADMIN_PASSWORD = typeof __admin_password !== 'undefined' ? __admin_password : (import.meta.env.VITE_ADMIN_PASSWORD || null);

  const useFirebaseAdmin = Boolean(FIREBASE_CONFIG && import.meta.env.VITE_USE_FIREBASE_ADMIN === '1' && typeof signInWithEmail === 'function');

  const handleSubmitPassword = (e) => {
    e.preventDefault();
    if (!ADMIN_PASSWORD) {
      console.warn('No admin password is configured (VITE_ADMIN_PASSWORD). Login will always fail until you set one.');
    }
    if (password === ADMIN_PASSWORD) {
      onSuccess();
      setPassword('');
      setError('');
      onClose();
    } else {
      setError('Invalid password');
    }
  };

  const handleSubmitFirebase = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }
    const res = await signInWithEmail(email, password);
    if (res.success) {
      onSuccess();
      setEmail(''); setPassword('');
      onClose();
    } else {
      setError(res.error || 'Sign-in failed');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Admin Login">
      {useFirebaseAdmin ? (
        <form onSubmit={handleSubmitFirebase} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-red-500 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-white mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-red-500 focus:ring-red-500" />
          </div>
          {error && <div className="text-red-400">{error}</div>}
          <div className="flex justify-end">
            <Button variant="primary" type="submit">Sign in</Button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSubmitPassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-red-500 focus:ring-red-500" />
          </div>
          {error && <div className="text-red-400">{error}</div>}
          <div className="flex justify-end">
            <Button variant="primary" type="submit">Enter</Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

// --- Firebase Context and Hook ---

const useFirebase = () => {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    if (!FIREBASE_CONFIG) {
      console.error("Firebase config is missing.");
      setIsReady(true);
      return;
    }

    try {
      const app = initializeApp(FIREBASE_CONFIG);
      const newAuth = getAuth(app);
      const newDb = getFirestore(app);

      const signIn = async () => {
        if (INITIAL_AUTH_TOKEN) {
          await signInWithCustomToken(newAuth, INITIAL_AUTH_TOKEN);
        } else {
          // Try anonymous sign-in for general public submissions. Admins will sign in explicitly.
          try { await signInAnonymously(newAuth); } catch (e) { /* ignore */ }
        }
      };

      const unsubscribe = onAuthStateChanged(newAuth, (user) => {
        if (user) {
          setUserId(user.uid);
          setCurrentUser(user);
        } else {
          setUserId(null);
          setCurrentUser(null);
        }
        setIsReady(true);
      });

      signIn();
      setAuth(newAuth);
      setDb(newDb);

      return () => unsubscribe();
    } catch (error) {
      console.error("Firebase initialization failed:", error);
      setIsReady(true);
    }
  }, []);

  // Public submission path: /artifacts/{appId}/public/data/submissions
  const getSubmissionsCollectionRef = useCallback(() => {
    if (!db) return null;
    return collection(db, 'artifacts', APP_ID, 'public', 'data', 'submissions');
  }, [db]);

  const addSubmission = useCallback(async (data) => {
    const submissionsRef = getSubmissionsCollectionRef();
    if (!submissionsRef) {
      console.error("Firestore database not ready.");
      return { success: false, error: "Database not ready." };
    }
    
    try {
      const docRef = await addDoc(submissionsRef, {
        ...data,
        userId: userId,
        timestamp: serverTimestamp(),
      });
      return { success: true, docId: docRef.id };
    } catch (error) {
      console.error("Error adding document:", error);
      return { success: false, error: error.message };
    }
  }, [getSubmissionsCollectionRef, userId]);
  
  const fetchSubmissions = useCallback(async () => {
    const submissionsRef = getSubmissionsCollectionRef();
    if (!submissionsRef) return [];
    
    try {
      // Fetch and order by timestamp (most recent first)
      const q = query(submissionsRef, orderBy('timestamp', 'desc'), limit(50));
      const querySnapshot = await getDocs(q);
      const submissions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate().toLocaleString() || 'N/A'
      }));
      return submissions;
    } catch (error) {
      console.error("Error fetching documents:", error);
      return [];
    }
  }, [getSubmissionsCollectionRef]);

  const signInAdminWithEmail = useCallback(async (email, password) => {
    if (!auth) return { success: false, error: 'Auth not initialized' };
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      setCurrentUser(cred.user);
      return { success: true, user: cred.user };
    } catch (error) {
      console.error('Admin sign-in failed', error);
      return { success: false, error: error.message };
    }
  }, [auth]);

  const signOutAdmin = useCallback(async () => {
    if (!auth) return;
    try {
      await firebaseSignOut(auth);
      setCurrentUser(null);
    } catch (e) {
      console.error('Sign out failed', e);
    }
  }, [auth]);


  return { db, auth, userId, isReady, addSubmission, fetchSubmissions, signInAdminWithEmail, signOutAdmin, currentUser };
};

// --- Page Components ---

const HomePage = ({ navigate }) => (
  <div className="min-h-screen">
    {/* Hero Section */}
    <div className="relative h-[80vh] flex items-center justify-center text-center p-4" 
         style={{ 
           backgroundImage: `url(${UPLOADED_IMAGE_URL}), linear-gradient(to bottom, #000000, #111827)`,
           backgroundSize: 'cover', 
           backgroundPosition: 'center',
           backgroundBlendMode: 'overlay',
           backgroundColor: 'rgba(0, 0, 0, 0.6)'
         }}>
      <div className="z-10 bg-black/70 p-8 rounded-xl border border-red-600/50 max-w-3xl">
        <h1 className="text-6xl sm:text-8xl font-black text-red-600 tracking-tighter shadow-red-800/50 drop-shadow-lg">
          2X CUSTOMS
        </h1>
        <p className="text-xl sm:text-3xl text-white font-light mt-4 mb-10 tracking-wider">
          TURN YOUR KICKS INTO ART
        </p>
        <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-6">
          <Button onClick={() => navigate('custom')} variant="primary" className="text-lg">
            <Brush className="w-5 h-5" /> Book a Custom
          </Button>
          <Button onClick={() => navigate('cleaning')} variant="secondary" className="text-lg">
            <Feather className="w-5 h-5" /> Get a Cleaning
          </Button>
        </div>
      </div>
    </div>

    {/* Why Choose Section */}
    <div className="py-20 bg-gray-950">
      <SectionTitle>Why Choose 2X Customs</SectionTitle>
      <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-10 max-w-6xl">
        <div className="p-6 bg-gray-900 rounded-xl shadow-2xl border-t-4 border-red-600 text-center hover:shadow-red-900/40 transition-shadow">
          <Zap className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Fast Turnaround</h3>
          <p className="text-gray-400">Get your fresh heat back in days, not weeks. Quick, professional service.</p>
        </div>
        <div className="p-6 bg-gray-900 rounded-xl shadow-2xl border-t-4 border-red-600 text-center hover:shadow-red-900/40 transition-shadow">
          <Settings className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Affordable Artistry</h3>
          <p className="text-gray-400">High-quality customization and restoration without breaking the bank. Great value.</p>
        </div>
        <div className="p-6 bg-gray-900 rounded-xl shadow-2xl border-t-4 border-red-600 text-center hover:shadow-red-900/40 transition-shadow">
          <CheckCircle className="w-10 h-10 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Expert Care</h3>
          <p className="text-gray-400">Specializing in durable custom paint and deep, non-damaging cleaning methods.</p>
        </div>
      </div>
    </div>
    
    {/* Gallery Preview Section */}
    <div className="py-20 bg-gray-900">
      <SectionTitle>Gallery Preview</SectionTitle>
      <div className="container mx-auto px-4 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-6xl">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="aspect-square rounded-xl overflow-hidden shadow-lg border border-gray-700 hover:border-red-600 transition-all cursor-pointer" onClick={() => navigate('gallery')}>
             <img src={`https://placehold.co/400x400/1F2937/FCA5A5?text=Custom+Shoe+${i}`} alt={`Custom Shoe ${i}`} className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"/>
          </div>
        ))}
      </div>
      <div className="text-center mt-10">
        <Button onClick={() => navigate('gallery')} variant="ghost">View Full Gallery</Button>
      </div>
    </div>

    {/* Testimonials Section */}
    <div className="py-20 bg-gray-950">
      <SectionTitle>What Our Clients Say</SectionTitle>
      <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
        <div className="p-6 bg-gray-900 rounded-xl border border-gray-800 italic text-gray-300">
          "The best deep clean I've ever had. My Jordans look brand new, not a scuff in sight. Fast service too!"
          <p className="mt-4 font-bold text-red-400">— Marcus L.</p>
        </div>
        <div className="p-6 bg-gray-900 rounded-xl border border-gray-800 italic text-gray-300">
          "Got a simple custom and it turned out fire! The paint quality is great and the attention to detail is crazy."
          <p className="mt-4 font-bold text-red-400">— Jessica P.</p>
        </div>
      </div>
    </div>
  </div>
);

// --- Form & Data Logic ---

const CustomForm = ({ addSubmission }) => {
  const [form, setForm] = useState({ name: '', email: '', shoeModel: '', designRequest: '', budget: '', image: null });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const budgetOptions = ['<$50', '$50-$100', '$100-$200', '$200+'];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // In a real app, you would upload this file to Firebase Storage.
      // Here, we just store a placeholder and the file name/size.
      setForm(prev => ({ ...prev, image: { name: file.name, size: file.size, type: file.type } }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Data structure for Firestore
    const submissionData = {
      type: 'custom_booking',
      status: 'New',
      name: form.name,
      email: form.email,
      shoeModel: form.shoeModel,
      designRequest: form.designRequest,
      budget: form.budget,
      imageFile: form.image ? `${form.image.name} (${(form.image.size / 1024).toFixed(1)} KB)` : 'No image uploaded',
    };

    const result = await addSubmission(submissionData);
    
    if (result.success) {
      // Simulate "backend email alert" by displaying success message
      setModalOpen(true);
      setForm({ name: '', email: '', shoeModel: '', designRequest: '', budget: '', image: null }); // Reset form
    } else {
      console.error("Submission failed:", result.error);
      alert("Submission failed. Check console for details.");
    }
    
    setIsSubmitting(false);
  };

  return (
    <div className="container mx-auto p-4 md:p-10 max-w-4xl">
      <Modal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        title="Request Received!"
      >
        <p className="text-gray-300 text-lg flex items-center">
          <CheckCircle className="w-6 h-6 text-green-500 mr-3" />
          Thank you, {form.name.split(' ')[0] || 'Sneakerhead'}! Your custom shoe request has been received. We will be in touch via email soon!
        </p>
      </Modal>

      <SectionTitle>Book Your Custom Kicks</SectionTitle>
      <div className="bg-gray-900 p-8 rounded-xl shadow-2xl border border-red-600/50">
        <p className="text-gray-400 mb-6 text-lg">
          Ready to turn your vision into reality? Fill out the details below to start the design process.
        </p>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="col-span-1">
              <label htmlFor="name" className="block text-sm font-medium text-white mb-1">Name</label>
              <input type="text" id="name" name="name" value={form.name} onChange={handleChange} required className="w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-red-500 focus:ring-red-500"/>
            </div>
            <div className="col-span-1">
              <label htmlFor="email" className="block text-sm font-medium text-white mb-1">Email</label>
              <input type="email" id="email" name="email" value={form.email} onChange={handleChange} required className="w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-red-500 focus:ring-red-500"/>
            </div>
          </div>

          <div>
            <label htmlFor="shoeModel" className="block text-sm font-medium text-white mb-1">Shoe Type / Model (e.g., Air Force 1, Dunk Low, Vans)</label>
            <input type="text" id="shoeModel" name="shoeModel" value={form.shoeModel} onChange={handleChange} required className="w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-red-500 focus:ring-red-500"/>
          </div>

          <div>
            <label htmlFor="designRequest" className="block text-sm font-medium text-white mb-1">Custom Design Request (Describe your idea!)</label>
            <textarea id="designRequest" name="designRequest" value={form.designRequest} onChange={handleChange} required rows="4" className="w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-red-500 focus:ring-red-500"></textarea>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
            <div>
              <label htmlFor="budget" className="block text-sm font-medium text-white mb-1">Budget Range (Customization cost only)</label>
              <select id="budget" name="budget" value={form.budget} onChange={handleChange} required className="w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-red-500 focus:ring-red-500 appearance-none">
                <option value="" disabled>Select a range</option>
                {budgetOptions.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            
            <div>
              <label htmlFor="imageUpload" className="block text-sm font-medium text-white mb-1">Upload Reference Image (Optional)</label>
              <div className="flex items-center space-x-2 p-3 rounded-lg bg-gray-800 border border-gray-700">
                <Upload className="w-5 h-5 text-red-500 flex-shrink-0" />
                <input 
                  type="file" 
                  id="imageUpload" 
                  name="imageUpload" 
                  accept="image/*" 
                  onChange={handleImageUpload}
                  className="block w-full text-sm text-gray-400 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-gray-700 file:text-red-400 hover:file:bg-gray-600"
                />
              </div>
              {form.image && <p className="text-xs text-gray-500 mt-1">File: {form.image.name}</p>}
            </div>
          </div>
          
          <Button type="submit" variant="primary" className="w-full text-xl mt-6" disabled={isSubmitting}>
            {isSubmitting ? 'Sending Request...' : 'Submit Custom Request'}
          </Button>
        </form>
      </div>
    </div>
  );
};

const CleaningPage = ({ navigate }) => (
  <div className="container mx-auto p-4 md:p-10 max-w-4xl">
    <SectionTitle>Shoe Cleaning & Restoration</SectionTitle>
    <div className="bg-gray-900 p-8 rounded-xl shadow-2xl border border-red-600/50">
      <p className="text-gray-400 mb-10 text-lg text-center">
        From a quick touch-up to bringing a dead pair back to life, we handle it all with specialist, non-damaging solutions.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {CLEANING_LEVELS.map((item, index) => (
          <div key={item.level} className="p-5 bg-gray-800 rounded-xl border border-gray-700 hover:border-red-500 transition-all">
            <h3 className="text-2xl font-bold text-red-400 mb-2">{item.level}</h3>
            <p className="text-3xl font-extrabold text-white mb-3">{item.price}</p>
            <p className="text-gray-400">{item.desc}</p>
          </div>
        ))}
      </div>
      
      <SectionTitle>Before & After</SectionTitle>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-white text-center mb-2 font-semibold">Before</h4>
          <img src={`https://placehold.co/400x300/4B5563/FFFFFF?text=DIRTY+SHOE`} alt="Dirty Shoe Before Clean" className="w-full h-auto rounded-lg shadow-lg" />
        </div>
        <div>
          <h4 className="text-white text-center mb-2 font-semibold">After</h4>
          <img src={`https://placehold.co/400x300/10B981/FFFFFF?text=CLEAN+SHOE`} alt="Clean Shoe After Restoration" className="w-full h-auto rounded-lg shadow-lg" />
        </div>
      </div>

      <div className="text-center mt-12">
        <Button onClick={() => navigate('contact')} variant="primary" className="text-lg">
          Book Cleaning Service
        </Button>
      </div>
    </div>
  </div>
);

const GalleryPage = () => {
  const [selectedImage, setSelectedImage] = useState(null);

  const galleryItems = useMemo(() => ([
    { id: 1, category: 'Advanced Customs', title: 'Neon Matrix', url: 'https://placehold.co/400x400/8B5CF6/000?text=ADV-1' },
    { id: 2, category: 'Simple Customs', title: 'Triple Red', url: 'https://placehold.co/400x400/EF4444/000?text=SIMPLE-1' },
    { id: 3, category: 'Restorations', title: 'AJ1 Re-Dye', url: 'https://placehold.co/400x400/9CA3AF/000?text=RESTORE-1' },
    { id: 4, category: 'Medium Customs', title: 'Camo Split', url: 'https://placehold.co/400x400/F97316/000?text=MED-1' },
    { id: 5, category: 'Advanced Customs', title: 'Galaxy Flow', url: 'https://placehold.co/400x400/3B82F6/000?text=ADV-2' },
    { id: 6, category: 'Simple Customs', title: 'Black Out', url: 'https://placehold.co/400x400/1F2937/FFF?text=SIMPLE-2' },
    { id: 7, category: 'Restorations', title: 'Oxidation Fix', url: 'https://placehold.co/400x400/374151/FFF?text=RESTORE-2' },
    { id: 8, category: 'Medium Customs', title: 'Cyber Drip', url: 'https://placehold.co/400x400/EC4899/000?text=MED-2' },
    { id: 9, category: 'Advanced Customs', title: 'Graffiti Tag', url: 'https://placehold.co/400x400/000000/FCA5A5?text=GRAF-TAG' },
    { id: 10, category: 'Simple Customs', title: 'Yellow Toe', url: 'https://placehold.co/400x400/FBBF24/000?text=SIMPLE-3' },
    { id: 11, category: 'Restorations', title: 'Sole Swap', url: 'https://placehold.co/400x400/9333EA/000?text=RESTORE-3' },
    { id: 12, category: 'Medium Customs', title: 'Street Maps', url: 'https://placehold.co/400x400/4F46E5/000?text=MED-3' },
  ]), []);

  const categories = useMemo(() => [
    'All', 'Simple Customs', 'Medium Customs', 'Advanced Customs', 'Restorations'
  ], []);

  const [activeCategory, setActiveCategory] = useState('All');

  const filteredItems = galleryItems.filter(item => 
    activeCategory === 'All' || item.category === activeCategory
  );

  return (
    <div className="container mx-auto p-4 md:p-10">
      <SectionTitle>Our Art & Archive</SectionTitle>

      <div className="text-center mb-8 overflow-x-auto whitespace-nowrap py-2">
        {categories.map(cat => (
          <button 
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 mx-2 text-sm font-medium rounded-full transition-colors duration-200 ${
              activeCategory === cat 
                ? 'bg-red-600 text-white shadow-lg' 
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredItems.map(item => (
          <div 
            key={item.id} 
            className="group relative rounded-xl overflow-hidden shadow-xl border border-gray-800 cursor-pointer hover:border-red-600 transition-all"
            onClick={() => setSelectedImage(item)}
          >
            <img 
              src={item.url} 
              alt={item.title} 
              className="w-full aspect-square object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-end opacity-0 group-hover:opacity-100 transition-opacity p-3">
              <div className="text-white">
                <p className="text-xl font-bold">{item.title}</p>
                <p className="text-xs text-red-400">{item.category}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={!!selectedImage} onClose={() => setSelectedImage(null)} title={selectedImage?.title || ''}>
        {selectedImage && (
          <>
            <img src={selectedImage.url} alt={selectedImage.title} className="w-full h-auto rounded-lg mb-4" />
            <p className="text-sm text-red-400">{selectedImage.category}</p>
          </>
        )}
      </Modal>
    </div>
  );
};

const PricingPage = ({ navigate }) => (
  <div className="container mx-auto p-4 md:p-10 max-w-4xl">
    <SectionTitle>Custom & Cleaning Price Breakdown</SectionTitle>

    <div className="bg-gray-900 p-8 rounded-xl shadow-2xl border border-red-600/50">
      <table className="min-w-full divide-y divide-gray-700">
        <thead className="bg-gray-800">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-red-400 uppercase tracking-wider">Service</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-red-400 uppercase tracking-wider">Price Range</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-red-400 uppercase tracking-wider hidden sm:table-cell">Description</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {CUSTOM_PRICING.map((item, index) => (
            <tr key={index} className="hover:bg-gray-800 transition-colors">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-lg font-bold text-white">{item.type}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-xl font-extrabold text-red-500">{item.price}</div>
              </td>
              <td className="px-6 py-4 text-gray-400 hidden sm:table-cell">{item.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-12 text-center">
        <Button onClick={() => navigate('custom')} variant="primary" className="text-xl">
          Book Now & Start Designing
        </Button>
      </div>
    </div>
  </div>
);

const AboutPage = () => (
  <div className="container mx-auto p-4 md:p-10 max-w-4xl">
    <SectionTitle>About 2X Customs</SectionTitle>
    <div className="bg-gray-900 p-8 rounded-xl shadow-2xl border border-red-600/50 flex flex-col md:flex-row items-center space-y-6 md:space-y-0 md:space-x-8">
      
      <div className="md:w-1/3 flex-shrink-0">
        <img 
          src="https://placehold.co/300x300/111827/FCA5A5?text=LILRO" 
          alt="Lilro - Owner of 2X Customs" 
          className="rounded-full w-40 h-40 object-cover mx-auto border-4 border-red-600"
        />
        <h3 className="text-center text-xl font-bold text-white mt-4">Lilro, Founder</h3>
      </div>

      <div className="md:w-2/3 text-gray-300 space-y-4">
        <p className="text-xl font-semibold text-white">
          My name is Lilro, and I run 2X Customs.
        </p>
        <p className="text-lg">
          I specialize in transforming everyday footwear into wearable art—from full custom shoe designs using durable, flexible paints, to deep cleaning and restoring beat pairs into fresh heat.
        </p>
        <p className="text-lg border-l-4 border-red-600 pl-4 italic">
          Fast turnaround. Affordable. High quality. I treat every pair like my own. Let's make some noise.
        </p>
      </div>
    </div>
  </div>
);

const ContactForm = ({ addSubmission }) => {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const submissionData = {
      type: 'contact_message',
      name: form.name,
      email: form.email,
      message: form.message,
    };

    const result = await addSubmission(submissionData);
    
    if (result.success) {
      setModalOpen(true);
      setForm({ name: '', email: '', message: '' }); // Reset form
    } else {
      console.error("Submission failed:", result.error);
      alert("Submission failed. Check console for details.");
    }
    
    setIsSubmitting(false);
  };

  return (
    <div className="container mx-auto p-4 md:p-10 max-w-2xl">
      <Modal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        title="Message Sent!"
      >
        <p className="text-gray-300 text-lg flex items-center">
          <CheckCircle className="w-6 h-6 text-green-500 mr-3" />
          Got it! Thanks for reaching out. I'll reply to your email soon.
        </p>
      </Modal>

      <SectionTitle>Get In Touch</SectionTitle>
      <div className="bg-gray-900 p-8 rounded-xl shadow-2xl border border-red-600/50">
        <p className="text-gray-400 mb-6 text-center">
          Have a question about pricing, turnaround time, or a special request? Drop me a line!
        </p>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="contactName" className="block text-sm font-medium text-white mb-1">Name</label>
            <input type="text" id="contactName" name="name" value={form.name} onChange={handleChange} required className="w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-red-500 focus:ring-red-500"/>
          </div>
          <div>
            <label htmlFor="contactEmail" className="block text-sm font-medium text-white mb-1">Email</label>
            <input type="email" id="contactEmail" name="email" value={form.email} onChange={handleChange} required className="w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-red-500 focus:ring-red-500"/>
          </div>
          <div>
            <label htmlFor="contactMessage" className="block text-sm font-medium text-white mb-1">Message</label>
            <textarea id="contactMessage" name="message" value={form.message} onChange={handleChange} required rows="5" className="w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:border-red-500 focus:ring-red-500"></textarea>
          </div>
          
          <Button type="submit" variant="primary" className="w-full text-xl mt-6" disabled={isSubmitting}>
            {isSubmitting ? 'Sending Message...' : 'Send Message'}
          </Button>
        </form>
        <div className="mt-8 text-center text-gray-500 text-sm flex items-center justify-center">
          <MapPin className="w-4 h-4 mr-2"/> Based in NYC Metro Area, Shipping Nationwide
        </div>
      </div>
    </div>
  );
};


const SubmissionsDashboard = ({ fetchSubmissions }) => {
  const [submissions, setSubmissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSubmissions = async () => {
      setIsLoading(true);
      const data = await fetchSubmissions();
      setSubmissions(data);
      setIsLoading(false);
    };
    loadSubmissions();
    // Note: In a production app, we would use onSnapshot for real-time updates here.
  }, [fetchSubmissions]);
  
  const customBookings = submissions.filter(s => s.type === 'custom_booking');
  const contactMessages = submissions.filter(s => s.type === 'contact_message');

  return (
    <div className="container mx-auto p-4 md:p-10">
      <SectionTitle>Admin Dashboard</SectionTitle>
      <p className="text-gray-400 text-center mb-8">All form submissions are stored here in Firestore (acting as your backend dashboard).</p>
      
      {isLoading ? (
        <div className="text-center text-red-500 text-xl p-10">Loading submissions...</div>
      ) : (
        <div className="space-y-12">
          
          {/* Custom Bookings Table */}
          <div className="bg-gray-900 p-6 rounded-xl shadow-2xl border border-red-600/50">
            <h3 className="text-2xl font-bold text-red-400 mb-4 flex items-center"><Brush className="w-6 h-6 mr-2"/> Custom Booking Requests ({customBookings.length})</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead>
                  <tr className="bg-gray-800">
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Name/Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Shoe/Budget</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Design Request</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {customBookings.map(s => (
                    <tr key={s.id} className="hover:bg-gray-800/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{s.timestamp}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-white font-semibold">{s.name}</div>
                        <div className="text-red-400 text-xs">{s.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-gray-300">{s.shoeModel}</div>
                        <div className="text-red-500 font-bold text-sm">{s.budget}</div>
                      </td>
                      <td className="px-6 py-4 max-w-xs overflow-hidden truncate text-sm text-gray-400" title={s.designRequest}>{s.designRequest}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Contact Messages Table */}
          <div className="bg-gray-900 p-6 rounded-xl shadow-2xl border border-red-600/50">
            <h3 className="text-2xl font-bold text-red-400 mb-4 flex items-center"><MessageCircle className="w-6 h-6 mr-2"/> Contact Messages ({contactMessages.length})</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead>
                  <tr className="bg-gray-800">
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Name/Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {contactMessages.map(s => (
                    <tr key={s.id} className="hover:bg-gray-800/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{s.timestamp}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-white font-semibold">{s.name}</div>
                        <div className="text-red-400 text-xs">{s.email}</div>
                      </td>
                      <td className="px-6 py-4 max-w-xs overflow-hidden truncate text-sm text-gray-400" title={s.message}>{s.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


// --- App Structure Components ---

const Header = ({ navigate, activePage, adminAuth, onOpenAdmin, onLogoutAdmin }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-gray-950/95 backdrop-blur-sm shadow-xl border-b border-red-600/50">
      <div className="container mx-auto flex justify-between items-center p-4 md:p-6">
        {/* Logo */}
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => navigate('home')}>
          <Zap className="w-8 h-8 text-red-600" />
          <h1 className="text-2xl font-black text-white tracking-widest">
            2X CUSTOMS
          </h1>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex space-x-6 items-center">
          {Object.entries(PAGE_ROUTES).map(([key, { title }]) => (
            <button
              key={key}
              onClick={() => navigate(key)}
              className={`text-lg font-medium transition duration-150 relative group ${activePage === key ? 'text-red-500' : 'text-gray-300 hover:text-red-400'}`}
            >
              {title}
              <span className={`absolute bottom-0 left-0 w-full h-[3px] bg-red-600 transition-transform duration-300 ${activePage === key ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-75'}`}></span>
            </button>
          ))}
          {adminAuth && (
            <Button variant="ghost" onClick={onLogoutAdmin} className="ml-4">Logout</Button>
          )}
        </nav>

        {/* Admin lock + Mobile Menu Button */}
        <div className="flex items-center space-x-3">
          {!adminAuth && (
            <button title="Admin" onClick={onOpenAdmin} className="text-white hidden sm:inline-flex p-2 rounded-md hover:bg-gray-800">
              <Lock className="w-6 h-6" />
            </button>
          )}
          <button className="md:hidden text-white" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="w-8 h-8" /> : <Menu className="w-8 h-8" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      <div className={`md:hidden bg-gray-900/95 backdrop-blur-sm transition-all duration-300 ${menuOpen ? 'max-h-96 opacity-100 p-4' : 'max-h-0 opacity-0 overflow-hidden'}`}>
        <nav className="flex flex-col space-y-2">
          {Object.entries(PAGE_ROUTES).map(([key, { title, icon: Icon }]) => (
            // Hide submissions link in mobile menu unless adminAuth is true
            (key !== 'submissions' || adminAuth) && (
            <button
              key={key}
              onClick={() => { navigate(key); setMenuOpen(false); }}
              className={`flex items-center px-4 py-3 rounded-lg text-left transition-colors duration-200 ${activePage === key ? 'bg-red-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-red-400'}`}
            >
              <Icon className="w-5 h-5 mr-3" /> {title}
            </button>
            )
          ))}
          {adminAuth && (
            <Button variant="ghost" onClick={onLogoutAdmin} className="mt-4">Logout</Button>
          )}
        </nav>
      </div>
    </header>
  );
};

const Footer = ({ navigate }) => (
  <footer className="bg-gray-900 border-t border-red-600/50 py-10">
    <div className="container mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8">
      {/* Brand Info */}
      <div className="col-span-2 md:col-span-1">
        <h3 className="text-2xl font-black text-red-600 mb-3">2X CUSTOMS</h3>
        <p className="text-gray-400 text-sm">Turn Your Kicks Into Art. Custom Shoes • Cleaning • Restorations.</p>
      </div>

      {/* Navigation Links */}
      <div>
        <h4 className="text-white font-bold mb-3 uppercase text-sm tracking-wider">Services</h4>
        <nav className="space-y-2 flex flex-col">
          <button onClick={() => navigate('custom')} className="text-gray-400 hover:text-red-400 text-sm transition-colors text-left">Book a Custom</button>
          <button onClick={() => navigate('cleaning')} className="text-gray-400 hover:text-red-400 text-sm transition-colors text-left">Cleaning Services</button>
          <button onClick={() => navigate('pricing')} className="text-gray-400 hover:text-red-400 text-sm transition-colors text-left">Pricing Table</button>
        </nav>
      </div>
      
      {/* Company Links */}
      <div>
        <h4 className="text-white font-bold mb-3 uppercase text-sm tracking-wider">Company</h4>
        <nav className="space-y-2 flex flex-col">
          <button onClick={() => navigate('about')} className="text-gray-400 hover:text-red-400 text-sm transition-colors text-left">About Lilro</button>
          <button onClick={() => navigate('gallery')} className="text-gray-400 hover:text-red-400 text-sm transition-colors text-left">Gallery</button>
          <button onClick={() => navigate('contact')} className="text-gray-400 hover:text-red-400 text-sm transition-colors text-left">Contact</button>
        </nav>
      </div>
      
      {/* Contact Info (Placeholder) */}
      <div>
        <h4 className="text-white font-bold mb-3 uppercase text-sm tracking-wider">Connect</h4>
        <p className="text-gray-400 text-sm">2xcustoms@example.com</p>
        <p className="text-gray-400 text-sm mt-1">@2x.customs (Social Placeholder)</p>
      </div>
    </div>
    
    <div className="mt-10 pt-6 border-t border-gray-800 text-center text-gray-500 text-xs">
      &copy; {new Date().getFullYear()} 2X Customs. All rights reserved.
    </div>
  </footer>
);

// --- Main Application Component ---

const App = () => {
  const [page, setPage] = useState('home');
  const { isReady, addSubmission, fetchSubmissions, userId, signInAdminWithEmail, signOutAdmin, currentUser } = useFirebase();

  const navigate = (newPage) => setPage(newPage);

  // Admin auth state (persisted to localStorage)
  const [adminAuth, setAdminAuth] = useState(() => {
    try {
      return localStorage.getItem('2x_admin_auth') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [adminModalOpen, setAdminModalOpen] = useState(false);

  const handleAdminSuccess = useCallback(() => {
    setAdminAuth(true);
    try { localStorage.setItem('2x_admin_auth', 'true'); } catch (e) {}
    setPage('submissions');
  }, []);

  const handleLogoutAdmin = useCallback(async () => {
    setAdminAuth(false);
    try { localStorage.removeItem('2x_admin_auth'); } catch (e) {}
    // If Firebase sign-out helper exists, call it
    try { if (signOutAdmin) await signOutAdmin(); } catch (e) { /* ignore */ }
    setPage('home');
  }, [signOutAdmin]);

  const renderPage = () => {
    // Show a loading screen while Firebase initializes
    if (!isReady) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center text-red-600 text-2xl">
          <Sparkles className="w-8 h-8 animate-spin mr-3"/> Authenticating and preparing services...
        </div>
      );
    }
    
    switch (page) {
      case 'custom':
        return <CustomForm addSubmission={addSubmission} />;
      case 'cleaning':
        return <CleaningPage navigate={navigate} />;
      case 'gallery':
        return <GalleryPage />;
      case 'pricing':
        return <PricingPage navigate={navigate} />;
      case 'about':
        return <AboutPage />;
      case 'contact':
        return <ContactForm addSubmission={addSubmission} />;
      case 'submissions':
        // Require admin authentication to view submissions dashboard
        return adminAuth ? <SubmissionsDashboard fetchSubmissions={fetchSubmissions} userId={userId} /> : (
          <div className="container mx-auto p-10 text-center">
            <p className="text-gray-300 mb-4">Admin access required to view this page.</p>
            <Button onClick={() => setAdminModalOpen(true)} variant="primary">Enter Admin Password</Button>
          </div>
        );
      case 'home':
      default:
        return <HomePage navigate={navigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      <style>{`
        /* Load Inter font from Google Fonts */
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap');
        body {
          font-family: 'Inter', sans-serif;
          background-color: #0a0a0a;
        }
        /* Custom SEO Metadata (Simulated) */
        head > title { content: "2X Customs | Custom Shoes, Cleaning & Restoration"; }
        head > meta[name="description"] { content: "Turn your kicks into art. High-quality custom shoe designs, deep cleaning, and restoration services."; }
        head > link[rel="icon"] { href: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">👟</text></svg>'; }
      `}</style>
      
      <Header navigate={navigate} activePage={page} adminAuth={adminAuth} onOpenAdmin={() => setAdminModalOpen(true)} onLogoutAdmin={handleLogoutAdmin} />
      <AdminLogin isOpen={adminModalOpen} onClose={() => setAdminModalOpen(false)} onSuccess={handleAdminSuccess} signInWithEmail={signInAdminWithEmail} />

      <main className="min-h-[70vh] py-10">
        {renderPage()}
      </main>
      <Footer navigate={navigate} />
    </div>
  );
};

export default App;
