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
  firestoreReadError: string | null;
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
  retryFirestoreSync: () => void;
}

const EMPTY_DATASET: NormalizedDataset = {
  employees: [],
  partners: [],
  hybrids: [],
  lots: [],
  dr_shipments: [],
  opname_logs: [],
};

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [firestoreReadError, setFirestoreReadError] = useState<string | null>(null);
  const [firestoreDataset, setFirestoreDataset] = useState<NormalizedDataset | null>(null);
  const [firestoreAccessRules, setFirestoreAccessRules] = useState<Record<
    string,
    Record<string, boolean>
  > | null>(null);
  const [isLoadingFirestore, setIsLoadingFirestore] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStage, setMigrationStage] = useState<string | null>(null);
  const [listenerRetryTick, setListenerRetryTick] = useState(0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user && (!user.emailVerified || !isBootstrappedAdminEmail(user.email))) {
        setAuthError(
          `Akses admin ditolak untuk ${user.email || "akun ini"}. Login admin hanya untuk ${BOOTSTRAPPED_ADMIN_EMAIL}.`,
        );
        setFirebaseUser(null);
        setIsAuthReady(true);
        signOutFirebase().catch(() => {});
        return;
      }

      if (user) {
        setAuthError(null);
      }
      setFirebaseUser(user);
      setIsAuthReady(true);
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
    const verifiedAdmin =
      current && current.emailVerified && isBootstrappedAdminEmail(current.email)
        ? current
        : null;

    setIsLoadingFirestore(true);
    try {
      if (verifiedAdmin) {
        await ensureUserBootstrap(verifiedAdmin);
      }
      const data = await fetchAllFirestoreData(verifiedAdmin);
      setFirestoreReadError(null);
      setFirestoreDataset(data.dataset);
      if (Object.keys(data.accessRules).length > 0) {
        setFirestoreAccessRules(data.accessRules);
      }
      return data.dataset;
    } catch (err: any) {
      const errText = String(err?.message || err || "");
      const isPermDenied =
        errText.toLowerCase().includes("permission") ||
        errText.toLowerCase().includes("insufficient");
      setFirestoreReadError(
        isPermDenied
          ? "Akses baca & edit tanpa login belum aktif di Firestore Rules radaradv-95dbf. Salin & publikasikan firestore.rules terbaru di Firebase Console."
          : "Gagal memuat data dari Firestore. Periksa koneksi internet Anda.",
      );
      setFirestoreDataset((prev) => prev || EMPTY_DATASET);
      return null;
    } finally {
      setIsLoadingFirestore(false);
    }
  }, []);

  // Attach real-time Firestore listeners once auth state is settled (supports Public Read + Admin Read/Write)
  useEffect(() => {
    if (!isAuthReady) return;

    let unsubFirestore: (() => void) | null = null;
    let cancelled = false;
    const listenerUser = isAuthorizedFirebase && firebaseUser ? firebaseUser : null;

    (async () => {
      try {
        const loaded = await reloadFromFirestore();
        if (cancelled || !loaded) return;
        unsubFirestore = subscribeToFirestoreCollections(
          listenerUser,
          (partial) => {
            if (cancelled) return;
            setFirestoreReadError(null);
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
          },
          (err) => {
            if (cancelled) return;
            const errText = String((err as any)?.message || err || "");
            const isPermDenied =
              errText.toLowerCase().includes("permission") ||
              errText.toLowerCase().includes("insufficient");
            setFirestoreReadError(
              isPermDenied
                ? "Akses baca & edit tanpa login belum aktif di Firestore Rules radaradv-95dbf. Salin & publikasikan firestore.rules terbaru di Firebase Console."
                : "Sinkronisasi real-time Firestore terganggu.",
            );
            setFirestoreDataset((prev) => prev || EMPTY_DATASET);
          },
        );
      } catch (err) {
        console.error("Failed to initialize Firestore listeners:", err);
      }
    })();

    return () => {
      cancelled = true;
      if (unsubFirestore) unsubFirestore();
    };
  }, [isAuthReady, isAuthorizedFirebase, firebaseUser, listenerRetryTick, reloadFromFirestore]);

  const retryFirestoreSync = useCallback(() => {
    setListenerRetryTick((t) => t + 1);
  }, []);

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
    setAuthError(null);
  }, []);

  const migrateDatasetToFirestore = useCallback(
    async (
      dataset: NormalizedDataset,
      accessRules: Record<string, Record<string, boolean>>,
    ) => {
      const current = auth.currentUser;
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
        firestoreReadError,
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
        retryFirestoreSync,
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
