import type { AstroInstance } from 'astro';
import { Github, Instagram } from 'lucide-astro';

export interface SocialLink {
	name: string;
	url: string;
	icon: AstroInstance;
}

export default {
	title: 'Sennet Visuals',
	favicon: 'favicon.ico',
	owner: 'Sennet',
	profileImage: 'profile.webp',
	socialLinks: [
        {
            name: 'GitHub',
            url: 'https://github.com/Killeasin',
            icon: Github,
        } as SocialLink,
        {
            name: 'Instagram',
            url: 'https://www.instagram.com/sennetvisuals',
            icon: Instagram,
        } as SocialLink,
    ],
};
