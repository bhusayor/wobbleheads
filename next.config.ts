import type { NextConfig } from 'next';
import path from 'node:path';
import webpack from 'webpack';

const nextConfig: NextConfig = {
	webpack: (config) => {
		config.resolve.alias['@/lib/runtime-env'] = path.resolve(process.cwd(), 'lib/cloudflare-env.ts');
		config.plugins.push(new webpack.NormalModuleReplacementPlugin(/runtime-env\.ts$/, path.resolve(process.cwd(), 'lib/cloudflare-env.ts')));
		return config;
	},
};

export default nextConfig;
