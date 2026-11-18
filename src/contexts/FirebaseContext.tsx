import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  isBootstrappedAdminEmail,
  signInWithGooglePopup,
  signOutFirebase,
} from "../firebase";
import {
  ensureUserBootstrap,
  fetchAllFirestoreData,
  migrateNormalizedDatasetToFirestore,
  subscribeToFirestoreCollections,
} from "../services/firestoreDb";
import type { NormalizedDataset } from "../utils/firestoreNormalization";

interface FirebaseContextValue {
  firebaseUser: User | null;
  isAuthReady: boolean;
  isAuthorizedFirebase: boolean;
  authError: string | null;
  firestoreDataset: NormalizedDataset | null;
  firestoreAccessRules: Record<string, Record<string, boolean>> | null;
  hasFirestoreData: boolean;
  isLoadingFirestore: boolean;
  isMigrating: boolean;
  migrationStage: string | null;
  connectGoogle: () => Promise<User>;
  disconnectGoogle: () => Promise<void>;
  migrateDatasetToFirestore: (
    dataset: NormalizedDataset,
    accessRules: Record<string, Record<string, boolean>>,
  ) => Promise<{ totalDocs: number }>;
  reloadFromFirestore: () => Promise<NormalizedDataset | null>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [firestoreDataset, setFirestoreDataset] = useState<NormalizedDataset | null>(null);
  const [firestoreAccessRules, setFirestoreAccessRules] = useState<Record<
    string,
    Record<string, boolean>
  > | null>(null);
  const [isLoadingFirestore, setIsLoadingFirestore] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStage, setMigrationStage] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user && (!user.emailVerified || !isBootstrappedAdminEmail(user.email))) {
        setAuthError(
          `Akses ditolak untuk ${user.email || "akun ini"}. Database Firebase hanya dapat diakses oleh akun ${BOOTSTRAPPED_ADMIN_EMAIL}.`,
        );
        setFirebaseUser(null);
        setFirestoreDataset(null);
        setFirestoreAccessRules(null);
        setIsAuthReady(true);
        signOutFirebase().catch(() => {});
        return;
      }

      if (user) {
        setAuthError(null);
      }
      setFirebaseUser(user);
      setIsAuthReady(true);
      if (!user) {
        setFirestoreDataset(null);
        setFirestoreAccessRules(null);
      }
    });
    return () => unsub();
  }, []);

  const isAuthorizedFirebase = Boolean(
    firebaseUser &&
      firebaseUser.emailVerified &&
      isBootstrappedAdminEmail(firebaseUser.email),
  );

  const reloadFromFirestore = useCallback(async (): Promise<NormalizedDataset | null> => {
    const current = auth.currentUser;
    if (
      !current ||
      !current.emailVerified ||
      !isBootstrappedAdminEmail(current.email)
    ) {
      return null;
    }
    setIsLoadingFirestore(true);
    try {
      await ensureUserBootstrap(current);
      const data = await fetchAllFirestoreData(current);
      setFirestoreDataset(data.dataset);
      if (Object.keys(data.accessRules).length > 0) {
        setFirestoreAccessRules(data.accessRules);
      }
      return data.dataset;
    } finally {
      setIsLoadingFirestore(false);
    }
  }, []);

  // Attach real-time Firestore listeners ONLY when auth is ready and user is sole verified admin
  useEffect(() => {
    if (!isAuthReady || !isAuthorizedFirebase || !firebaseUser) return;

    let unsubFirestore: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      try {
        await reloadFromFirestore();
        if (cancelled) return;
        unsubFirestore = subscribeToFirestoreCollections(firebaseUser, (partial) => {
          if (cancelled) return;
          if (partial.dataset) {
            setFirestoreDataset((prev) => ({
              employees: partial.dataset?.employees ?? prev?.employees ?? [],
              partners: partial.dataset?.partners ?? prev?.partners ?? [],
              hybrids: partial.dataset?.hybrids ?? prev?.hybrids ?? [],
              lots: partial.dataset?.lots ?? prev?.lots ?? [],
              dr_shipments: partial.dataset?.dr_shipments ?? prev?.dr_shipments ?? [],
              opname_logs: partial.dataset?.opname_logs ?? prev?.opname_logs ?? [],
            }));
          }
          if (partial.accessRules && Object.keys(partial.accessRules).length > 0) {
            setFirestoreAccessRules(partial.accessRules);
          }
        });
      } catch (err) {
        console.error("Failed to initialize Firestore listeners:", err);
      }
    })();

    return () => {
      cancelled = true;
      if (unsubFirestore) unsubFirestore();
    };
  }, [isAuthReady, isAuthorizedFirebase, firebaseUser, reloadFromFirestore]);

  const connectGoogle = useCallback(async () => {
    setAuthError(null);
    try {
      const user = await signInWithGooglePopup();
      await ensureUserBootstrap(user);
      return user;
    } catch (err: any) {
      const msg =
        err?.message ||
        `Gagal autentikasi. Gunakan akun ${BOOTSTRAPPED_ADMIN_EMAIL}.`;
      setAuthError(msg);
      throw err;
    }
  }, []);

  const disconnectGoogle = useCallback(async () => {
    await signOutFirebase();
    setFirebaseUser(null);
    setFirestoreDataset(null);
    setFirestoreAccessRules(null);
  }, []);

  const migrateDatasetToFirestore = useCallback(
    async (
      dataset: NormalizedDataset,
      accessRules: Record<string, Record<string, boolean>>,
    ) => {
      const current = auth.currentUser;
      if (
        !current ||
        !current.emailVerified ||
        !isBootstrappedAdminEmail(current.email)
      ) {
        throw new Error(
          `Silakan login menggunakan akun ${BOOTSTRAPPED_ADMIN_EMAIL} sebelum menyimpan data ke Firestore.`,
        );
      }
      setIsMigrating(true);
      setMigrationStage("Menyiapkan sinkronisasi ke Firestore...");
      try {
        const res = await migrateNormalizedDatasetToFirestore(
          current,
          dataset,
          accessRules,
          (msg) => setMigrationStage(msg),
        );
        await reloadFromFirestore();
        return res;
      } finally {
        setIsMigrating(false);
        setMigrationStage(null);
      }
    },
    [reloadFromFirestore],
  );

  const hasFirestoreData = Boolean(
    firestoreDataset &&
      (firestoreDataset.employees.length > 0 ||
        firestoreDataset.partners.length > 0 ||
        firestoreDataset.opname_logs.length > 0 ||
        firestoreDataset.dr_shipments.length > 0),
  );

  return (
    <FirebaseContext.Provider
      value={{
        firebaseUser,
        isAuthReady,
        isAuthorizedFirebase,
        authError,
        firestoreDataset,
        firestoreAccessRules,
        hasFirestoreData,
        isLoadingFirestore,
        isMigrating,
        migrationStage,
        connectGoogle,
        disconnectGoogle,
        migrateDatasetToFirestore,
        reloadFromFirestore,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error("useFirebase must be used inside FirebaseProvider");
  }
  return ctx;
}
