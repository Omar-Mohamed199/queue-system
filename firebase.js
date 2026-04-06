const firebaseConfig = {
    apiKey: "AIzaSyCbOmlByMcbAeY5fcFf1l1hYaUIqMGMkCI",
    authDomain: "queue-system-f605c.firebaseapp.com",
    projectId: "queue-system-f605c",
    storageBucket: "queue-system-f605c.firebasestorage.app",
    messagingSenderId: "230220754670",
    appId: "1:230220754670:web:67fc28749359451424cdff"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();