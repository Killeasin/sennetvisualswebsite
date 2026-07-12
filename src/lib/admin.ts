import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const uploadDir = path.resolve(process.cwd(), 'public/uploads');
const storePath = path.resolve(process.cwd(), 'src/data/admin-store.json');

type StoreCollection = {
  id: string;
  name: string;
  displayOrder: number;
  createdAt: string;
};

type StorePhoto = {
  id: number;
  path: string;
  collectionId: string;
  title: string;
  description: string;
  exif: string;
  createdAt: string;
};

type StoreEvent = {
  id: number;
  eventType: string;
  page: string;
  details: string;
  createdAt: string;
};

type AdminStore = {
  collections: StoreCollection[];
  photos: StorePhoto[];
  analytics: StoreEvent[];
};

const defaultStore: AdminStore = {
  collections: [
    { id: 'graduation', name: 'Graduation', displayOrder: 1, createdAt: new Date().toISOString() },
    { id: 'studio', name: 'Studio', displayOrder: 2, createdAt: new Date().toISOString() },
    { id: 'portraits', name: 'Portraits', displayOrder: 3, createdAt: new Date().toISOString() },
    { id: 'groups', name: 'Groups', displayOrder: 4, createdAt: new Date().toISOString() },
    { id: 'boards', name: 'Boards', displayOrder: 5, createdAt: new Date().toISOString() },
  ],
  photos: [],
  analytics: [],
};

async function ensureStore(): Promise<AdminStore> {
  try {
    const raw = await readFile(storePath, 'utf8');
    const parsed = JSON.parse(raw) as AdminStore;
    return {
      collections: parsed.collections ?? defaultStore.collections,
      photos: parsed.photos ?? [],
      analytics: parsed.analytics ?? [],
    };
  } catch {
    await mkdir(path.dirname(storePath), { recursive: true });
    await writeFile(storePath, JSON.stringify(defaultStore, null, 2));
    return defaultStore;
  }
}

async function saveStore(store: AdminStore) {
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2));
}

export async function ensureCollectionsSeed() {
  const store = await ensureStore();
  if (store.collections.length === 0) {
    store.collections = defaultStore.collections;
    await saveStore(store);
  }
}

export async function saveUploadedPhoto(file: File, collectionId: string) {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const safeName = `${Date.now()}-${file.name.replace(/\s+/g, '-').toLowerCase()}`;
  const targetPath = path.join(uploadDir, safeName);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(targetPath, buffer);

  const publicPath = `/uploads/${safeName}`;
  const store = await ensureStore();
  const photo: StorePhoto = {
    id: Date.now(),
    path: publicPath,
    collectionId,
    title: file.name,
    description: '',
    exif: '{}',
    createdAt: new Date().toISOString(),
  };
  store.photos = [photo, ...store.photos];
  await saveStore(store);
  return publicPath;
}

export async function listPhotos() {
  const store = await ensureStore();
  return [...store.photos].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getDbPhotosForGallery() {
  const rows = await listPhotos();
  return rows.map((row) => ({
    path: row.path,
    collectionId: row.collectionId,
    title: row.title,
    description: row.description,
  }));
}

export async function listCollections() {
  const store = await ensureStore();
  return [...store.collections].sort((a, b) => a.displayOrder - b.displayOrder);
}

export async function getDbCollections() {
  return listCollections();
}

export async function updateCollectionOrder(collectionId: string, displayOrder: number) {
  const store = await ensureStore();
  store.collections = store.collections.map((collection) =>
    collection.id === collectionId ? { ...collection, displayOrder } : collection,
  );
  await saveStore(store);
}

export async function updateCollectionName(collectionId: string, name: string) {
  const store = await ensureStore();
  store.collections = store.collections.map((collection) =>
    collection.id === collectionId ? { ...collection, name } : collection,
  );
  await saveStore(store);
}

export async function deletePhotoById(photoId: number) {
  const store = await ensureStore();
  const photo = store.photos.find((entry) => entry.id === photoId);
  if (!photo) return;
  store.photos = store.photos.filter((entry) => entry.id !== photoId);
  await saveStore(store);
  return photo.path;
}

export async function trackEvent(eventType: string, page: string, details: string) {
  const store = await ensureStore();
  store.analytics = [
    {
      id: Date.now(),
      eventType,
      page,
      details,
      createdAt: new Date().toISOString(),
    },
    ...store.analytics,
  ];
  await saveStore(store);
}

export async function getAnalyticsSummary() {
  const store = await ensureStore();
  const rows = [...store.analytics].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    totalEvents: rows.length,
    recentEvents: rows.slice(0, 12),
    popularPages: rows.reduce<Record<string, number>>((acc, row) => {
      const page = row.page || 'unknown';
      acc[page] = (acc[page] || 0) + 1;
      return acc;
    }, {}),
  };
}
