import path from 'path';
import {
	type Collection,
	type GalleryData,
	type GalleryImage,
	type Image,
	type ImageModule,
	loadGallery,
} from './galleryData.ts';

/**
 * Error class for image-related errors
 */
export class ImageStoreError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ImageStoreError';
	}
}

/**
 * Import all images from /src directory
 */
const imageModules = import.meta.glob('/src/**/*.{jpg,jpeg,png,gif}', {
	eager: true,
});

const defaultGalleryPath = 'src/gallery/gallery.yaml';

export const featuredCollectionId = 'featured';
const builtInCollections = [featuredCollectionId];

/**
 * Options for retrieving images from the gallery
 * @property {string} [galleryPath] - Path to the gallery YAML file
 * @property {string} [collection] - Collection name to filter images by
 * @property {string} [sortBy] - Property to sort images by (e.g., 'captureDate')
 * @property {'asc' | 'desc'} [order] - Sort order, either ascending or descending
 */
interface GetImagesOptions {
	galleryPath?: string;
	collection?: string;
	sortBy?: 'captureDate';
	order?: 'asc' | 'desc';
}

/**
 * Retrieves images from a specified gallery path and optionally filters them by a collection name.
 *
 * @param {GetImagesOptions} [options={}] - Configuration options for retrieving the images.
 * @param {string} [options.galleryPath=defaultGalleryPath] - The path to the gallery to load the images from.
 * @param {string} [options.collection] - The name of the collection to filter images by. If not provided, all images are retrieved.
 * @returns {Promise<Image[]>} Retrieved images.
 * @throws {ImageStoreError} Throws an error if loading the gallery data fails.
 */
export const normalizeImagePath = (imagePath: string): string => {
	return imagePath.replace(/\\/g, '/').replace(/\/+/g, '/');
};

const getImageModuleCandidates = (galleryPath: string, imageEntryPath: string): string[] => {
	const galleryDir = normalizeImagePath(path.parse(galleryPath).dir);
	const normalizedImagePath = normalizeImagePath(path.posix.join('/', galleryDir, imageEntryPath));
	const resolvedImagePath = path.resolve(process.cwd(), normalizedImagePath.replace(/^\/+/, ''));
	const relativeImagePath = normalizeImagePath(path.relative(process.cwd(), resolvedImagePath));
	const absoluteImagePath = normalizeImagePath(resolvedImagePath);

	return Array.from(
		new Set([
			normalizedImagePath,
			`/${relativeImagePath}`,
			`/@fs/${absoluteImagePath}`,
			absoluteImagePath,
		]),
	);
};

export const getImages = async (options: GetImagesOptions = {}): Promise<Image[]> => {
	const { galleryPath = defaultGalleryPath, collection } = options;
	try {
		let images = (await loadGalleryData(galleryPath)).images;
		images = filterImagesByCollection(collection, images);
		images = sortImages(images, options);
		return processImages(images, galleryPath);
	} catch (error) {
		throw new ImageStoreError(
			`Failed to load images from ${galleryPath}: ${getErrorMsgFrom(error)}`,
		);
	}
};

function getErrorMsgFrom(error: unknown) {
	return error instanceof Error ? error.message : 'Unknown error';
}

/**
 * Loads collections data from YAML file
 * @throws {ImageStoreError} If YAML file cannot be read or parsed
 * @param galleryPath
 */
const loadGalleryData = async (galleryPath: string): Promise<GalleryData> => {
	try {
		const gallery = await loadGallery(galleryPath);
		const mergedGallery = mergeGalleryDataWithDiscoveredImages(gallery, galleryPath);
		validateGalleryData(mergedGallery);
		return mergedGallery;
	} catch (error) {
		throw new ImageStoreError(
			`Failed to load gallery data from ${galleryPath}: ${getErrorMsgFrom(error)}`,
		);
	}
};

function mergeGalleryDataWithDiscoveredImages(gallery: GalleryData, galleryPath: string): GalleryData {
	const discoveredImages = discoverImagesFromGalleryDirectory(galleryPath);
	const mergedImages = new Map<string, GalleryImage>();

	for (const image of gallery.images) {
		mergedImages.set(normalizeImagePath(image.path), {
			...image,
			meta: {
				...image.meta,
				collections: image.meta.collections ?? [],
			},
		});
	}

	for (const discoveredImage of discoveredImages) {
		const key = normalizeImagePath(discoveredImage.path);
		const existingImage = mergedImages.get(key);
		if (existingImage) {
			mergedImages.set(key, {
				...existingImage,
				meta: {
					...existingImage.meta,
					title: existingImage.meta.title || discoveredImage.meta.title,
					description: existingImage.meta.description || discoveredImage.meta.description,
					collections: Array.from(
						new Set([...(existingImage.meta.collections ?? []), ...(discoveredImage.meta.collections ?? [])]),
					),
				},
			});
		} else {
			mergedImages.set(key, discoveredImage);
		}
	}

	const mergedCollections = new Map<string, Collection>();
	for (const collection of gallery.collections) {
		mergedCollections.set(collection.id, normalizeCollection(collection));
	}
	for (const image of mergedImages.values()) {
		for (const collectionId of image.meta.collections ?? []) {
			if (!mergedCollections.has(collectionId)) {
				mergedCollections.set(collectionId, {
					id: collectionId,
					name: toCollectionName(collectionId),
				});
			}
		}
	}

	return {
		collections: Array.from(mergedCollections.values()),
		images: Array.from(mergedImages.values()),
	};
}

function discoverImagesFromGalleryDirectory(galleryPath: string): GalleryImage[] {
	const galleryDir = path.resolve(process.cwd(), path.parse(galleryPath).dir);
	const discoveredImages = Object.keys(imageModules)
		.map((modulePath) => normalizeImagePath(modulePath))
		.filter((modulePath) => {
			const absolutePath = path.resolve(process.cwd(), modulePath.replace(/^\/+/, ''));
			return absolutePath.startsWith(galleryDir + path.sep) || absolutePath === galleryDir;
		})
		.map((modulePath) => {
			const absolutePath = path.resolve(process.cwd(), modulePath.replace(/^\/+/, ''));
			const relativePath = normalizeImagePath(path.relative(galleryDir, absolutePath));
			return {
				path: relativePath,
				meta: {
					title: toReadableCaption(path.basename(relativePath, path.extname(relativePath))),
					description: '',
					collections: inferCollectionsFromPath(relativePath),
				},
				exif: {},
			} satisfies GalleryImage;
		});

	return discoveredImages;
}

function toReadableCaption(input: string): string {
	return input
		.replace(/[^a-zA-Z0-9]+/g, ' ')
		.split(' ')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(' ')
		.trim();
}

function filterImagesByCollection(collection: string | undefined, images: GalleryImage[]) {
	if (collection) {
		images = images.filter((image) => {
			const collections = image.meta.collections ?? [];
			return collections.includes(collection);
		});
	}
	return images;
}

function validateGalleryData(gallery: GalleryData) {
	const collectionIds = new Set(gallery.collections.map((col) => col.id).concat(builtInCollections));
	const collectionsById = new Map(gallery.collections.map((col) => [col.id, col]));
	for (const image of gallery.images) {
		const imageCollections = image.meta.collections ?? [];
		const inferredCollections = inferCollectionsFromPath(image.path);
		const mergedCollections = Array.from(
			new Set(imageCollections.concat(inferredCollections.filter((col) => !imageCollections.includes(col)))),
		);
		for (const inferredCollection of inferredCollections) {
			if (!collectionIds.has(inferredCollection)) {
				collectionIds.add(inferredCollection);
				collectionsById.set(inferredCollection, {
					id: inferredCollection,
					name: toCollectionName(inferredCollection),
				});
			}
		}
		image.meta.collections = mergedCollections;
	}
	gallery.collections = Array.from(collectionsById.values());
}

function inferCollectionsFromPath(imagePath: string): string[] {
	const normalizedPath = normalizeImagePath(imagePath);
	const segments = normalizedPath.split('/').filter(Boolean);
	if (segments.length <= 1) {
		return [];
	}
	return segments.slice(0, -1);
}

function normalizeCollection(collection: Collection): Collection {
	return {
		...collection,
		name: collection.name || (collection as Collection & { title?: string }).title || toCollectionName(collection.id),
	};
}

function toCollectionName(collectionId: string): string {
	return collectionId
		.replace(/[_-]+/g, ' ')
		.replace(/\b\w/g, (char) => char.toUpperCase())
		.trim();
}

function sortImages(images: GalleryImage[], options: GetImagesOptions) {
	const { sortBy, order } = options;
	let result: GalleryImage[] = images;
	if (sortBy) {
		result.sort((a, b) => {
			const dateA = a.exif?.captureDate?.getTime() || 0;
			const dateB = b.exif?.captureDate?.getTime() || 0;
			return dateA - dateB;
		});
	}
	if (order === 'desc') {
		result.reverse();
	}
	return result;
}

/**
 * Processes gallery images and returns an array of Image objects
 * @param {GalleryImage[]} images - Array of images to process
 * @param {string} galleryPath - Path to the collections directory
 * @returns {Image[]} Array of processed images with metadata
 * @throws {ImageStoreError} If an image module cannot be found
 */
const processImages = (images: GalleryImage[], galleryPath: string): Image[] => {
	return images.reduce<Image[]>((acc, imageEntry) => {
		try {
			acc.push(createImageDataFor(galleryPath, imageEntry));
		} catch (error) {
			console.warn(`[WARN] ${getErrorMsgFrom(error)}`);
		}
		return acc;
	}, []);
};

/**
 * Creates image data for a given image path and entry
 * @param {string} imagePath - Path to the image file
 * @param {GalleryImage} img - Gallery image entry
 * @returns {Image} Processed image with metadata
 * @throws {ImageStoreError} If image module cannot be found
 */
const createImageDataFor = (galleryPath: string, img: GalleryImage): Image => {
	const imagePath = normalizeImagePath(path.posix.join('/', path.parse(galleryPath).dir, img.path));
	const imageModule = getImageModuleCandidates(galleryPath, img.path).reduce<ImageModule | undefined>(
		(acc, candidate) => acc ?? (imageModules[candidate] as ImageModule | undefined),
		undefined,
	);

	if (!imageModule) {
		throw new ImageStoreError(`Image not found: ${imagePath}`);
	}

	return {
		src: typeof imageModule.default === 'string' ? imageModule.default : imageModule.default.src,
		title: img.meta.title,
		description: img.meta.description,
		collections: img.meta.collections,
	};
};

/**
 * Retrieves all collections from the gallery
 * @param galleryPath - Path to the gallery YAML file
 * @returns {Promise<Collection[]>} Array of collections
 */
export const getCollections = async (
	galleryPath: string = defaultGalleryPath,
): Promise<Collection[]> => {
	return (await loadGalleryData(galleryPath)).collections;
};
