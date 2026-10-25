import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query,
  where,
  getDocFromServer
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Campaign, ProductItem, ClientOrder } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  };
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection per skill instructions
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or starting up.');
      return false;
    }
    // Any other response means we connected to the server endpoint
    return true;
  }
}

// Collections helper
export const Collections = {
  CAMPAIGNS: 'campaigns',
  PRODUCTS: 'products',
  ORDERS: 'orders',
};

// Helper to remove any undefined fields before writing to Firestore
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined || data === null) {
    return null as any;
  }
  if (Array.isArray(data)) {
    return data
      .filter(item => item !== undefined)
      .map(item => sanitizeForFirestore(item)) as any;
  }
  if (typeof data === 'object' && !(data instanceof Date)) {
    const res: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) {
        const cleaned = sanitizeForFirestore(val);
        if (cleaned !== undefined) {
          res[key] = cleaned;
        }
      }
    }
    return res as any;
  }
  return data;
}

// Campaign API
export async function getCampaigns(): Promise<Campaign[]> {
  try {
    const snap = await getDocs(collection(db, Collections.CAMPAIGNS));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Campaign));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, Collections.CAMPAIGNS);
    return [];
  }
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  try {
    const d = await getDoc(doc(db, Collections.CAMPAIGNS, id));
    if (!d.exists()) return null;
    return { id: d.id, ...d.data() } as Campaign;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `${Collections.CAMPAIGNS}/${id}`);
    return null;
  }
}

export async function saveCampaign(campaign: Campaign): Promise<void> {
  try {
    await setDoc(doc(db, Collections.CAMPAIGNS, campaign.id), sanitizeForFirestore(campaign));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${Collections.CAMPAIGNS}/${campaign.id}`);
  }
}

// Product API
export async function getProducts(campaignId?: string): Promise<ProductItem[]> {
  try {
    const snap = await getDocs(collection(db, Collections.PRODUCTS));
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductItem));
    if (campaignId) {
      return all.filter(p => !p.campaignId || p.campaignId === campaignId);
    }
    return all;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, Collections.PRODUCTS);
    return [];
  }
}

export async function saveProduct(product: ProductItem): Promise<void> {
  try {
    await setDoc(doc(db, Collections.PRODUCTS, product.id), sanitizeForFirestore(product));
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${Collections.PRODUCTS}/${product.id}`);
  }
}

export async function saveMultipleProducts(products: ProductItem[]): Promise<void> {
  if (products.length === 0) return;
  try {
    const chunkSize = 400;
    for (let i = 0; i < products.length; i += chunkSize) {
      const chunk = products.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach(p => {
        batch.set(doc(db, Collections.PRODUCTS, p.id), sanitizeForFirestore(p));
      });
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, Collections.PRODUCTS);
  }
}

export async function deleteProduct(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, Collections.PRODUCTS, id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${Collections.PRODUCTS}/${id}`);
  }
}

export async function clearAllProductsFromFirestore(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, Collections.PRODUCTS));
    if (snap.empty) return;
    const chunkSize = 400;
    for (let i = 0; i < snap.docs.length; i += chunkSize) {
      const chunk = snap.docs.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach(d => {
        batch.delete(doc(db, Collections.PRODUCTS, d.id));
      });
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, Collections.PRODUCTS);
  }
}

export async function deleteProductsBySupplier(supplier: string): Promise<number> {
  try {
    const q = query(collection(db, Collections.PRODUCTS), where('supplier', '==', supplier));
    const snap = await getDocs(q);
    if (snap.empty) return 0;
    const chunkSize = 400;
    for (let i = 0; i < snap.docs.length; i += chunkSize) {
      const chunk = snap.docs.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach(d => {
        batch.delete(doc(db, Collections.PRODUCTS, d.id));
      });
      await batch.commit();
    }
    return snap.docs.length;
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, Collections.PRODUCTS);
    return 0;
  }
}

// Orders API
export async function getOrders(campaignId?: string): Promise<ClientOrder[]> {
  try {
    const snap = await getDocs(collection(db, Collections.ORDERS));
    const all = snap.docs.map(d => {
      const data = d.data();
      let parsedItems = data.items;
      if (typeof parsedItems === 'string') {
        try {
          parsedItems = JSON.parse(parsedItems);
        } catch {
          parsedItems = [];
        }
      }
      return {
        id: d.id,
        ...data,
        items: parsedItems,
      } as ClientOrder;
    });
    if (campaignId) {
      return all.filter(o => o.campaignId === campaignId);
    }
    return all;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, Collections.ORDERS);
    return [];
  }
}

export async function getOrder(id: string): Promise<ClientOrder | null> {
  try {
    const d = await getDoc(doc(db, Collections.ORDERS, id));
    if (!d.exists()) return null;
    const data = d.data();
    let parsedItems = data.items;
    if (typeof parsedItems === 'string') {
      try {
        parsedItems = JSON.parse(parsedItems);
      } catch {
        parsedItems = [];
      }
    }
    return { id: d.id, ...data, items: parsedItems } as ClientOrder;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `${Collections.ORDERS}/${id}`);
    return null;
  }
}

export async function saveOrder(order: ClientOrder): Promise<void> {
  try {
    // Format items as JSON string to adhere safely to blueprint schema if needed
    const payload = sanitizeForFirestore({
      ...order,
      items: typeof order.items === 'string' ? order.items : JSON.stringify(order.items || []),
    });
    await setDoc(doc(db, Collections.ORDERS, order.id), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${Collections.ORDERS}/${order.id}`);
  }
}

export async function updateOrderPaymentSettled(orderId: string, settled: boolean): Promise<void> {
  try {
    const updateData = sanitizeForFirestore({
      paymentSettled: settled,
      status: settled ? 'settled' : 'submitted',
      paymentSettledAt: settled ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    });
    await updateDoc(doc(db, Collections.ORDERS, orderId), updateData);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${Collections.ORDERS}/${orderId}`);
  }
}

export async function deleteOrder(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, Collections.ORDERS, id));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `${Collections.ORDERS}/${id}`);
  }
}

export async function clearAllOrdersFromFirestore(): Promise<void> {
  try {
    const snap = await getDocs(collection(db, Collections.ORDERS));
    if (snap.empty) return;
    const chunkSize = 400;
    for (let i = 0; i < snap.docs.length; i += chunkSize) {
      const chunk = snap.docs.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach(d => {
        batch.delete(doc(db, Collections.ORDERS, d.id));
      });
      await batch.commit();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, Collections.ORDERS);
  }
}

// Real-time subscriptions
export function subscribeToOrders(
  campaignId: string | null,
  callback: (orders: ClientOrder[]) => void
): () => void {
  const ref = collection(db, Collections.ORDERS);
  return onSnapshot(
    ref,
    snapshot => {
      const orders = snapshot.docs.map(d => {
        const data = d.data();
        let parsedItems = data.items;
        if (typeof parsedItems === 'string') {
          try {
            parsedItems = JSON.parse(parsedItems);
          } catch {
            parsedItems = [];
          }
        }
        return { id: d.id, ...data, items: parsedItems } as ClientOrder;
      });
      if (campaignId) {
        callback(orders.filter(o => o.campaignId === campaignId));
      } else {
        callback(orders);
      }
    },
    error => {
      handleFirestoreError(error, OperationType.LIST, Collections.ORDERS);
    }
  );
}

export function subscribeToProducts(
  campaignId: string | null,
  callback: (products: ProductItem[]) => void
): () => void {
  const ref = collection(db, Collections.PRODUCTS);
  return onSnapshot(
    ref,
    snapshot => {
      const products = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ProductItem));
      if (campaignId) {
        callback(products.filter(p => !p.campaignId || p.campaignId === campaignId));
      } else {
        callback(products);
      }
    },
    error => {
      handleFirestoreError(error, OperationType.LIST, Collections.PRODUCTS);
    }
  );
}
