import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// For GitHub Pages, set VITE_BASE_PATH env or edit base to '/your-repo/'
const base = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
	plugins: [react()],
	base,
	build: {
		target: 'es2020'
	}
}); 