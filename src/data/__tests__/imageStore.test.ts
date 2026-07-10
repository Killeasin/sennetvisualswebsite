import { describe, expect, it } from 'vitest';
import kukuTrees from './gallery/kuku/kuku-trees.jpg';
import popoView from './gallery/popo/popo-view.jpg';
import landscape from './gallery/landscape.jpg';
import { getCollections, getImages, ImageStoreError, normalizeImagePath } from '../imageStore.ts';

const GALLERY = {
	VALID: 'src/data/__tests__/gallery/valid-gallery.yaml',
	INVALID: 'src/data/__tests__/gallery/invalid-gallery.yaml',
	MISSING: 'src/data/__tests__/gallery/no-gallery.yaml',
	INVALID_COLLECTION: 'src/data/__tests__/gallery/invalid-collection-gallery.yaml',
	INFERRED_COLLECTIONS: 'src/data/__tests__/gallery/inferred-collections-gallery.yaml',
};

describe('Images Store', () => {
	describe('Get Images', () => {
		it('should retrieve all present images', async () => {
			const imagesData = await getImages({ galleryPath: GALLERY.VALID });
			expect(imagesData).toHaveLength(3);
			expect(imagesData[0].src).toEqual(kukuTrees);
			expect(imagesData[1].src).toEqual(popoView);
			expect(imagesData[2].src).toEqual(landscape);
		});

		it('should retrieve images of specific collection', async () => {
			const images = await getImages({ galleryPath: GALLERY.VALID, collection: 'featured' });
			expect(images).toHaveLength(2);
			expect(images[0].src).toEqual(popoView);
			expect(images[1].src).toContain(landscape);
		});

		it('should retrieve title & description', async () => {
			const images = await getImages({ galleryPath: GALLERY.VALID, collection: 'popo' });
			expect(images).toHaveLength(1);
			expect(images[0].title).toEqual('Popo View');
			expect(images[0].description).toContain('popo album');
		});

		it('should normalize backslashes in image paths', () => {
			expect(normalizeImagePath('src\\gallery\\graduation\\photo.jpg')).toEqual(
				'src/gallery/graduation/photo.jpg',
			);
		});

		it('should infer collections from image folders when metadata is empty', async () => {
			const images = await getImages({ galleryPath: GALLERY.INFERRED_COLLECTIONS });
			expect(images).toHaveLength(1);
			expect(images[0].collections).toContain('kuku');
		});

		describe('Failures', () => {
			it('should fail on a missing gallery file', async () => {
				await expect(getImages({ galleryPath: GALLERY.MISSING })).rejects.toThrow(ImageStoreError);
			});

			it('should fail on invalid gallery file', async () => {
				await expect(getImages({ galleryPath: GALLERY.INVALID })).rejects.toThrow(ImageStoreError);
			});

			it('should fail on invalid collection', async () => {
				await expect(getImages({ galleryPath: GALLERY.INVALID_COLLECTION })).rejects.toThrow(
					ImageStoreError,
				);
			});
		});

		describe('Sorting', () => {
			it('should sort images by capture date', async () => {
				const images = await getImages({ galleryPath: GALLERY.VALID, sortBy: 'captureDate' });
				expect(images[0].src).toEqual(landscape);
				expect(images[1].src).toEqual(popoView);
				expect(images[2].src).toEqual(kukuTrees);
			});

			it('should sort images by capture date in descending order', async () => {
				const images = await getImages({
					galleryPath: GALLERY.VALID,
					sortBy: 'captureDate',
					order: 'desc',
				});
				expect(images[0].src).toEqual(kukuTrees);
				expect(images[1].src).toEqual(popoView);
				expect(images[2].src).toEqual(landscape);
			});

			it('should retrieve images in reverse order', async () => {
				const images = await getImages({
					galleryPath: GALLERY.VALID,
					order: 'desc',
				});
				expect(images[0].src).toEqual(landscape);
				expect(images[1].src).toEqual(popoView);
				expect(images[2].src).toEqual(kukuTrees);
			});
		});
	});

	describe('Get Collections', () => {
		it('should retrieve all collection names', async () => {
			const collections = await getCollections(GALLERY.VALID);
			expect(collections).toHaveLength(2);
			expect(collections[0].id).toEqual('kuku');
			expect(collections[0].name).toEqual('Kuku');
			expect(collections[1].id).toEqual('popo');
			expect(collections[1].name).toEqual('Popo');
		});

		it('should infer collection pages from image folders when YAML omits them', async () => {
			const collections = await getCollections(GALLERY.INFERRED_COLLECTIONS);
			expect(collections).toHaveLength(1);
			expect(collections[0].id).toEqual('kuku');
			expect(collections[0].name).toEqual('Kuku');
		});

		it('should restore collection names from existing gallery YAML entries', async () => {
			const collections = await getCollections('src/gallery/gallery.yaml');
			const graduationCollection = collections.find((collection) => collection.id === 'graduation');
			expect(graduationCollection?.name).toEqual('Graduation');
		});
	});
});
