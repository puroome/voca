let firebaseApp, auth, db, rt_db;
let initializeApp;
let getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup;
let getDatabase, ref, get, set;
let getFirestore, doc, getDoc, setDoc, updateDoc, increment;

document.addEventListener('firebaseSDKLoaded', () => {
    ({
        initializeApp,
        getAuth, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup,
        getDatabase, ref, get, set,
        getFirestore, doc, getDoc, setDoc, updateDoc, increment
    } = window.firebaseSDK);
    app.init();
});
