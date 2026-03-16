import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  type User,
  type NextOrObserver,
} from "firebase/auth";
import { auth } from "./firebase";

export async function signUp(email: string, password: string): Promise<User> {
  const { user } = await createUserWithEmailAndPassword(auth, email, password);
  return user;
}

export async function signIn(email: string, password: string): Promise<User> {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  return user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export function onAuthStateChanged(callback: NextOrObserver<User>) {
  return firebaseOnAuthStateChanged(auth, callback);
}

export async function getIdToken(): Promise<string | null> {
  // If the SDK has already resolved auth state, use it synchronously.
  if (auth.currentUser) {
    return auth.currentUser.getIdToken();
  }
  // Otherwise wait for the first definitive auth state emission.
  return new Promise((resolve) => {
    const unsubscribe = firebaseOnAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (!user) return resolve(null);
      resolve(await user.getIdToken());
    });
  });
}
