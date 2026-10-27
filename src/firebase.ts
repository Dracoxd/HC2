import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyDeT8lkVzwgynbP0CKtLOObuewF7fD2VwE',
  authDomain: 'quintin-de-borja-center.firebaseapp.com',
  projectId: 'quintin-de-borja-center',
  storageBucket: 'quintin-de-borja-center.firebasestorage.app',
  messagingSenderId: '828809179012',
  appId: '1:828809179012:web:f7d85840a2f5b2f7fe37d1',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
